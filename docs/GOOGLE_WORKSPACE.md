# Google Workspace integration

CONVIA supports a per-user Google OAuth connection with read-only access to Gmail, Calendar, and Drive metadata. It lists and searches inbox messages, reads upcoming primary-calendar events for the next 30 days, and lists recent Drive file metadata. It does not send or modify email, create or edit calendar events, or download/edit Drive files.

## Google Cloud setup

1. Create or select a Google Cloud project and enable the Gmail API, Google Calendar API, and Google Drive API.
2. Configure the OAuth consent screen and add your Google account as a test user. Restricted Gmail and Drive scopes require Google's verification before public production use; personal testing can stay in Testing mode.
3. Create an OAuth client with application type **Web application**.
4. Add the exact API callback URL under **Authorized redirect URIs**:

   ```text
   https://YOUR_PUBLIC_HOST/api/integrations/google/callback
   ```

   The deployed app needs a domain with HTTPS. Google does not accept a raw public IP address as the host for a web OAuth redirect URI. The callback URI must match exactly.

5. Keep the OAuth client ID and secret on the API server. Add these values to the deployment environment (for local development, use `.env`):

   ```dotenv
   GOOGLE_CLIENT_ID=your-web-client-id
   GOOGLE_CLIENT_SECRET=your-web-client-secret
   GOOGLE_REDIRECT_URI=https://YOUR_PUBLIC_HOST/api/integrations/google/callback
   ```

6. Rebuild the API image, run the Alembic migration with that image, then restart the services:

   ```bash
   docker compose build api web
   docker compose run --rm api alembic upgrade head
   docker compose up -d api web
   ```

   If the deployment uses a Compose override, include the same `-f` arguments in both commands.

7. Sign in to CONVIA, open **Integrations**, and choose **Connect Google**. Review the requested read-only scopes in Google's consent screen. If you approve only some scopes, CONVIA enables only those services; use **Update access** later to request the others.

## Security and behavior

- OAuth state is signed, account-bound, and expires after ten minutes.
- Access and refresh tokens are encrypted with AES-GCM before they are stored in the `integrations` table. The encryption key is derived from `AUTH_SECRET`; keep that production secret stable and back it up securely. Changing it requires reconnecting Google.
- The integrations status API never returns stored credentials.
- **Disconnect Google** asks Google to revoke the token and deletes the stored credential record.
- The requested Gmail (`gmail.readonly`) and Drive metadata scopes are restricted scopes. Google requires OAuth verification for public production use, and an app that transmits restricted-scope data through its server may also need a security assessment. Check Google's current [Gmail scope classifications](https://developers.google.com/workspace/gmail/api/auth/scopes) and [Workspace user-data policy](https://developers.google.com/workspace/workspace-api-user-data-developer-policy) before launching broadly.
- For personal testing, keep the consent screen in **Testing** and add your Google account as a test user. Google-issued refresh tokens for external apps in Testing expire after seven days, so reconnect when prompted. Production publishing and verification are separate Google requirements.
- Google may return `redirect_uri_mismatch`, `access_denied`, or scope-related errors if the URI, consent screen, APIs, or granted scopes are not configured.

Google references: [OAuth 2.0 web server flow](https://developers.google.com/identity/protocols/oauth2/web-server), [Gmail messages](https://developers.google.com/workspace/gmail/api/guides/list-messages), [Calendar events list](https://developers.google.com/calendar/api/v3/reference/events/list), and [Drive files list](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/list).
