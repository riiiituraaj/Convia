"""Google Workspace read-only integration endpoints.

Only Gmail, Calendar and Drive read scopes are requested. No endpoint in this
module sends mail, changes events, or edits Drive files.
"""
import base64
import hashlib
import ipaddress
import json
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any
from urllib.parse import urlencode, urlsplit

import httpx
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from lifeos.api.deps import get_current_user
from lifeos.core.config import settings
from lifeos.core.database import get_db
from lifeos.models.memory import Integration
from lifeos.models.user import User


router = APIRouter(prefix="/integrations/google", tags=["Google Workspace"])
GOOGLE_SCOPES = (
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/calendar.readonly",
    "https://www.googleapis.com/auth/drive.metadata.readonly",
)
GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke"
GOOGLE_API_TIMEOUT = httpx.Timeout(20.0, connect=8.0)


def _frontend_origin() -> str:
    origins = settings.CORS_ORIGINS or ["http://localhost:3000"]
    return next(
        (origin.rstrip("/") for origin in origins if not origin.startswith(("http://localhost", "http://127.0.0.1"))),
        origins[0].rstrip("/"),
    )


def _oauth_ready() -> bool:
    return bool(settings.GOOGLE_CLIENT_ID and settings.GOOGLE_CLIENT_SECRET and settings.GOOGLE_REDIRECT_URI)


def _require_oauth_config() -> None:
    if not _oauth_ready():
        raise HTTPException(status_code=503, detail="Google OAuth is not configured on the server.")
    parsed = urlsplit(settings.GOOGLE_REDIRECT_URI or "")
    hostname = (parsed.hostname or "").lower()
    local_host = hostname in {"localhost", "127.0.0.1", "::1"}
    try:
        ipaddress.ip_address(hostname)
        raw_ip_host = not local_host
    except ValueError:
        raw_ip_host = False
    if not hostname or (parsed.scheme != "https" and not local_host) or raw_ip_host:
        raise HTTPException(
            status_code=503,
            detail="Google web OAuth requires an HTTPS redirect URI on a domain name; raw public IP addresses are not accepted.",
        )


def _state_secret() -> str:
    # Production settings validation requires a persistent AUTH_SECRET. The
    # generated development secret intentionally invalidates OAuth state on restart.
    from lifeos.core.security import _signing_secret

    return _signing_secret()


def _encrypt_credentials(user_id: str, credentials: dict[str, Any]) -> str:
    secret = settings.AUTH_SECRET or _state_secret()
    key = hashlib.sha256(("convia-google-token-v1:" + secret).encode("utf-8")).digest()
    nonce = secrets.token_bytes(12)
    plaintext = json.dumps(credentials, separators=(",", ":")).encode("utf-8")
    ciphertext = AESGCM(key).encrypt(nonce, plaintext, user_id.encode("utf-8"))
    return base64.urlsafe_b64encode(nonce + ciphertext).decode("ascii")


def _decrypt_credentials(user_id: str, encrypted: str) -> dict[str, Any]:
    secret = settings.AUTH_SECRET or _state_secret()
    key = hashlib.sha256(("convia-google-token-v1:" + secret).encode("utf-8")).digest()
    try:
        packed = base64.urlsafe_b64decode(encrypted.encode("ascii"))
        nonce, ciphertext = packed[:12], packed[12:]
        data = AESGCM(key).decrypt(nonce, ciphertext, user_id.encode("utf-8"))
        decoded = json.loads(data.decode("utf-8"))
        if not isinstance(decoded, dict):
            raise ValueError("invalid credential payload")
        return decoded
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Stored Google credentials cannot be decrypted. Reconnect Google.") from exc


async def _integration_for_user(user_id: str, db: AsyncSession, required_scope: str) -> Integration:
    result = await db.execute(
        select(Integration).where(
            Integration.user_id == user_id,
            Integration.provider == "google_workspace",
            Integration.status == "CONNECTED",
            Integration.credentials_encrypted.is_not(None),
        )
    )
    integration = result.scalars().first()
    if not integration:
        raise HTTPException(status_code=409, detail="Connect Google Workspace first.")
    granted = set((integration.metadata_json or {}).get("scopes", []))
    if required_scope not in granted:
        raise HTTPException(status_code=403, detail="This Google read-only scope was not granted. Update Google access from Integrations.")
    return integration


async def _post_token(data: dict[str, str]) -> dict[str, Any]:
    try:
        async with httpx.AsyncClient(timeout=GOOGLE_API_TIMEOUT) as client:
            response = await client.post(GOOGLE_TOKEN_URL, data=data)
        if response.is_error:
            raise HTTPException(status_code=502, detail="Google OAuth token exchange failed. Check the OAuth client and redirect URI.")
        try:
            payload = response.json()
        except ValueError as exc:
            raise HTTPException(status_code=502, detail="Google returned an invalid OAuth response.") from exc
        if not isinstance(payload, dict) or not payload.get("access_token"):
            raise HTTPException(status_code=502, detail="Google did not return an access token.")
        return payload
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail="Google OAuth could not be reached.") from exc


async def _credentials(integration: Integration, db: AsyncSession) -> dict[str, Any]:
    if not integration.credentials_encrypted:
        raise HTTPException(status_code=409, detail="Connect Google Workspace first.")
    credentials = _decrypt_credentials(integration.user_id, integration.credentials_encrypted)
    expires_at = float(credentials.get("expires_at", 0))
    if expires_at <= datetime.now(timezone.utc).timestamp() + 60:
        refresh_token = credentials.get("refresh_token")
        if not refresh_token:
            integration.status = "ERROR"
            await db.commit()
            raise HTTPException(status_code=409, detail="Google access expired. Reconnect Google Workspace.")
        try:
            refreshed = await _post_token({
                "client_id": settings.GOOGLE_CLIENT_ID or "",
                "client_secret": settings.GOOGLE_CLIENT_SECRET or "",
                "refresh_token": str(refresh_token),
                "grant_type": "refresh_token",
            })
        except HTTPException:
            integration.status = "ERROR"
            await db.commit()
            raise HTTPException(status_code=409, detail="Google refresh token is no longer valid. Reconnect Google Workspace.")
        credentials.update(refreshed)
        credentials["refresh_token"] = refresh_token
        credentials["expires_at"] = datetime.now(timezone.utc).timestamp() + int(refreshed.get("expires_in", 3600))
        integration.credentials_encrypted = _encrypt_credentials(integration.user_id, credentials)
        integration.last_synced_at = datetime.now(timezone.utc)
        await db.commit()
    return credentials


async def _google_get(
    integration: Integration,
    db: AsyncSession,
    url: str,
    params: dict[str, Any] | None = None,
) -> dict[str, Any]:
    credentials = await _credentials(integration, db)
    try:
        async with httpx.AsyncClient(timeout=GOOGLE_API_TIMEOUT) as client:
            response = await client.get(url, params=params, headers={"Authorization": f"Bearer {credentials['access_token']}"})
            if response.status_code == 401 and credentials.get("refresh_token"):
                credentials["expires_at"] = 0
                integration.credentials_encrypted = _encrypt_credentials(integration.user_id, credentials)
                await db.commit()
                credentials = await _credentials(integration, db)
                response = await client.get(url, params=params, headers={"Authorization": f"Bearer {credentials['access_token']}"})
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail="Google Workspace API could not be reached.") from exc

    if response.status_code == 401:
        integration.status = "ERROR"
        await db.commit()
        raise HTTPException(status_code=409, detail="Google authorization expired. Reconnect Google Workspace.")
    if response.status_code == 403:
        raise HTTPException(status_code=403, detail="Google denied this read request. Check the enabled APIs and granted scopes.")
    if response.is_error:
        raise HTTPException(status_code=502, detail=f"Google API request failed (HTTP {response.status_code}).")
    integration.last_synced_at = datetime.now(timezone.utc)
    await db.commit()
    data = response.json()
    return data if isinstance(data, dict) else {}


@router.post("/connect")
async def connect_google(current_user: User = Depends(get_current_user)):
    """Return the Google consent URL for this authenticated CONVIA account."""
    _require_oauth_config()
    state = jwt.encode(
        {"sub": current_user.id, "nonce": secrets.token_urlsafe(24), "exp": datetime.now(timezone.utc) + timedelta(minutes=10)},
        _state_secret(),
        algorithm="HS256",
    )
    params = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": settings.GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": " ".join(GOOGLE_SCOPES),
        "access_type": "offline",
        "prompt": "consent",
        "include_granted_scopes": "true",
        "state": state,
    }
    return {"authorization_url": f"{GOOGLE_AUTH_URL}?{urlencode(params)}"}


@router.get("/callback", include_in_schema=False)
async def google_callback(
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    """OAuth callback; the signed, short-lived state binds it to the initiating user."""
    _require_oauth_config()
    frontend = _frontend_origin()
    if error:
        return RedirectResponse(f"{frontend}/integrations?google=denied", status_code=303)
    if not code or not state:
        raise HTTPException(status_code=400, detail="Google OAuth callback is missing code or state.")
    try:
        claims = jwt.decode(state, _state_secret(), algorithms=["HS256"])
        user_id = claims.get("sub")
        if not user_id or not claims.get("nonce"):
            raise JWTError("missing state claims")
    except JWTError as exc:
        raise HTTPException(status_code=400, detail="Google OAuth state is invalid or expired. Start connection again.") from exc

    active_user = await db.scalar(select(User.id).where(User.id == str(user_id), User.is_active.is_(True)))
    if not active_user:
        return RedirectResponse(f"{frontend}/integrations?google=denied", status_code=303)

    token_payload = await _post_token({
        "code": code,
        "client_id": settings.GOOGLE_CLIENT_ID or "",
        "client_secret": settings.GOOGLE_CLIENT_SECRET or "",
        "redirect_uri": settings.GOOGLE_REDIRECT_URI or "",
        "grant_type": "authorization_code",
    })
    granted = set(str(token_payload.get("scope", "")).split())
    granted.intersection_update(GOOGLE_SCOPES)
    if not granted:
        return RedirectResponse(f"{frontend}/integrations?google=scope_error", status_code=303)

    result = await db.execute(select(Integration).where(
        Integration.user_id == str(user_id), Integration.provider == "google_workspace"
    ))
    integration = result.scalars().first()
    previous: dict[str, Any] = {}
    if integration and integration.credentials_encrypted:
        try:
            previous = _decrypt_credentials(str(user_id), integration.credentials_encrypted)
        except HTTPException:
            # Reauthorization must recover from AUTH_SECRET rotation or old
            # ciphertext without requiring an unavailable old key.
            previous = {}
    credentials: dict[str, Any] = dict(token_payload)
    credentials["refresh_token"] = token_payload.get("refresh_token") or previous.get("refresh_token")
    credentials["expires_at"] = datetime.now(timezone.utc).timestamp() + int(token_payload.get("expires_in", 3600))
    credentials["scope"] = sorted(granted)
    if not credentials.get("refresh_token"):
        return RedirectResponse(f"{frontend}/integrations?google=refresh_error", status_code=303)

    if not integration:
        integration = Integration(user_id=str(user_id), provider="google_workspace")
        db.add(integration)
    integration.status = "CONNECTED"
    integration.credentials_present = True
    integration.credentials_encrypted = _encrypt_credentials(str(user_id), credentials)
    integration.metadata_json = {"purpose": "Read-only Gmail, Calendar and Drive metadata access", "scopes": sorted(granted)}
    integration.last_synced_at = datetime.now(timezone.utc)
    await db.commit()
    return RedirectResponse(f"{frontend}/integrations?google=connected", status_code=303)


@router.delete("")
async def disconnect_google(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Integration).where(
        Integration.user_id == current_user.id, Integration.provider == "google_workspace"
    ))
    integration = result.scalars().first()
    if integration:
        if integration.credentials_encrypted:
            try:
                credentials = _decrypt_credentials(current_user.id, integration.credentials_encrypted)
            except HTTPException:
                credentials = {}
            token = credentials.get("refresh_token") or credentials.get("access_token")
            if token:
                try:
                    async with httpx.AsyncClient(timeout=GOOGLE_API_TIMEOUT) as client:
                        await client.post(GOOGLE_REVOKE_URL, data={"token": token})
                except httpx.HTTPError:
                    pass
        await db.delete(integration)
        await db.commit()
    return {"status": "DISCONNECTED"}


@router.get("/messages")
async def list_gmail_messages(
    q: str = Query(default="", max_length=200),
    limit: int = Query(default=10, ge=1, le=10),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    integration = await _integration_for_user(current_user.id, db, GOOGLE_SCOPES[0])
    query = q.strip() or "in:inbox"
    listed = await _google_get(integration, db, "https://gmail.googleapis.com/gmail/v1/users/me/messages", {
        "q": query, "maxResults": limit,
    })
    messages = listed.get("messages") or []

    async def message_summary(message: dict[str, Any]) -> dict[str, Any]:
        item = await _google_get(integration, db,
            f"https://gmail.googleapis.com/gmail/v1/users/me/messages/{message['id']}",
            {"format": "metadata", "metadataHeaders": ["From", "To", "Subject", "Date"]},
        )
        headers = {
            str(header.get("name", "")).lower(): header.get("value", "")
            for header in item.get("payload", {}).get("headers", [])
        }
        return {
            "id": item.get("id", message.get("id")),
            "thread_id": item.get("threadId"),
            "from": headers.get("from", ""),
            "to": headers.get("to", ""),
            "subject": headers.get("subject") or "(no subject)",
            "date": headers.get("date", ""),
            "snippet": item.get("snippet", ""),
            "unread": "UNREAD" in (item.get("labelIds") or []),
        }

    # Keep DB token refresh/last-sync writes sequential on the shared AsyncSession.
    summaries = [await message_summary(message) for message in messages]
    return {"query": query, "messages": summaries}


@router.get("/events")
async def list_calendar_events(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    integration = await _integration_for_user(current_user.id, db, GOOGLE_SCOPES[1])
    now = datetime.now(timezone.utc)
    data = await _google_get(integration, db,
        "https://www.googleapis.com/calendar/v3/calendars/primary/events", {
            "timeMin": now.isoformat(),
            "timeMax": (now + timedelta(days=30)).isoformat(),
            "maxResults": 25,
            "singleEvents": "true",
            "orderBy": "startTime",
        },
    )
    return {"events": [
        {
            "id": event.get("id"), "summary": event.get("summary") or "(no title)",
            "start": event.get("start", {}).get("dateTime") or event.get("start", {}).get("date"),
            "end": event.get("end", {}).get("dateTime") or event.get("end", {}).get("date"),
            "location": event.get("location", ""), "html_link": event.get("htmlLink"),
        }
        for event in data.get("items", [])
    ]}


@router.get("/files")
async def list_drive_files(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    integration = await _integration_for_user(current_user.id, db, GOOGLE_SCOPES[2])
    data = await _google_get(integration, db, "https://www.googleapis.com/drive/v3/files", {
        "q": "trashed = false",
        "pageSize": 25,
        "orderBy": "modifiedTime desc",
        "fields": "files(id,name,mimeType,modifiedTime,webViewLink),nextPageToken",
    })
    return {"files": data.get("files", [])}
