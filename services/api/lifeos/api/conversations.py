from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from lifeos.ai.provider import AIProviderError, nemotron_provider
from lifeos.api.deps import get_current_user
from lifeos.core.database import get_db
from lifeos.models.conversation import Conversation, Message
from lifeos.models.user import User
from lifeos.models.workspace import ContextPack
from lifeos.schemas.conversation import (
    ContextPreviewResponse,
    ConversationCreate,
    ConversationDetail,
    ConversationSummary,
    ConversationTurnResponse,
    MessageCreate,
    MessageResponse,
)
from lifeos.services.context_engine import ContextEngine

router = APIRouter(prefix="/conversations", tags=["conversations"])


def _detail(row: Conversation) -> dict:
    return {
        "id": row.id,
        "title": row.title,
        "summary_text": row.summary_text,
        "context_pack_id": row.context_pack_id,
        "created_at": row.created_at,
        "updated_at": row.updated_at,
        "messages": row.messages,
    }


def _turn_response(user_msg: Message, assistant_msg: Message) -> ConversationTurnResponse:
    return ConversationTurnResponse(
        user_message=MessageResponse.model_validate(user_msg),
        assistant_message=MessageResponse.model_validate(assistant_msg),
        active_constraints=assistant_msg.metadata_json.get("active_constraints", {}),
        diagnostics=None,
    )


@router.post("", response_model=ConversationDetail, status_code=status.HTTP_201_CREATED)
async def create_conversation(
    payload: ConversationCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if payload.context_pack_id:
        pack = (await db.execute(select(ContextPack.id).where(ContextPack.id == payload.context_pack_id, ContextPack.user_id == current_user.id))).scalar_one_or_none()
        if not pack:
            raise HTTPException(status_code=404, detail="Context Pack not found")
    conversation = Conversation(
        user_id=current_user.id,
        context_pack_id=payload.context_pack_id,
        title=(payload.title or "New conversation").strip()[:255] or "New conversation",
        messages=[],
    )
    db.add(conversation)
    await db.commit()
    return {
        "id": conversation.id,
        "title": conversation.title,
        "summary_text": None,
        "context_pack_id": conversation.context_pack_id,
        "created_at": conversation.created_at,
        "updated_at": conversation.updated_at,
        "messages": [],
    }


@router.get("", response_model=list[ConversationSummary])
async def list_conversations(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Conversation)
        .where(Conversation.user_id == current_user.id)
        .options(selectinload(Conversation.messages))
        .order_by(Conversation.updated_at.desc())
    )
    rows = result.scalars().all()
    return [
        {
            "id": row.id,
            "title": row.title,
            "summary_text": row.summary_text,
            "context_pack_id": row.context_pack_id,
            "created_at": row.created_at,
            "updated_at": row.updated_at,
            "message_count": len(row.messages),
            "last_message_preview": row.messages[-1].content[:180] if row.messages else None,
        }
        for row in rows
    ]


@router.get("/{conversation_id}", response_model=ConversationDetail)
async def get_conversation(
    conversation_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Conversation)
        .where(Conversation.id == conversation_id, Conversation.user_id == current_user.id)
        .options(selectinload(Conversation.messages))
    )
    conversation = result.scalars().first()
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return _detail(conversation)


@router.delete("/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_conversation(
    conversation_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Conversation)
        .where(
            Conversation.id == conversation_id,
            Conversation.user_id == current_user.id,
        )
        .options(selectinload(Conversation.messages))
    )
    conversation = result.scalars().first()
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    await db.delete(conversation)
    await db.commit()


@router.post("/{conversation_id}/messages", response_model=ConversationTurnResponse)
async def send_message(
    conversation_id: str,
    payload: MessageCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Multi-turn conversation endpoint that assembles prior context, constraints, and returns grounded replies."""
    conv_result = await db.execute(
        select(Conversation)
        .where(Conversation.id == conversation_id, Conversation.user_id == current_user.id)
        .options(selectinload(Conversation.messages))
    )
    conversation = conv_result.scalars().first()
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # 1. Reuse an existing client request after a timeout/retry, or persist it once.
    user_msg = None
    if payload.client_message_id:
        existing_res = await db.execute(
            select(Message).where(
                Message.conversation_id == conversation.id,
                Message.role == "USER",
                Message.client_message_id == payload.client_message_id,
            )
        )
        user_msg = existing_res.scalars().first()
        if user_msg and (user_msg.content != payload.content.strip() or user_msg.source != payload.source):
            raise HTTPException(status_code=409, detail="client_message_id was already used for a different message")
        if user_msg:
            reply_res = await db.execute(
                select(Message).where(Message.reply_to_message_id == user_msg.id)
            )
            existing_reply = reply_res.scalars().first()
            if existing_reply and existing_reply.status != "FAILED":
                return _turn_response(user_msg, existing_reply)
            if existing_reply:
                await db.delete(existing_reply)
                await db.commit()

    if not user_msg:
        user_msg = Message(
            conversation_id=conversation.id,
            role="USER",
            content=payload.content.strip(),
            source=payload.source,
            status="COMPLETED",
            metadata_json={},
            client_message_id=payload.client_message_id,
        )
        db.add(user_msg)

        if conversation.title == "New conversation":
            first_line = next((line.strip() for line in payload.content.splitlines() if line.strip()), "")
            conversation.title = first_line[:255] or "New conversation"

        conversation.updated_at = datetime.now(timezone.utc)
        try:
            await db.commit()
            await db.refresh(user_msg)
        except IntegrityError:
            await db.rollback()
            if not payload.client_message_id:
                raise
            existing_res = await db.execute(
                select(Message).where(
                    Message.conversation_id == conversation_id,
                    Message.role == "USER",
                    Message.client_message_id == payload.client_message_id,
                )
            )
            user_msg = existing_res.scalars().first()
            if not user_msg or user_msg.content != payload.content.strip():
                raise HTTPException(status_code=409, detail="Unable to safely resolve duplicate message request")
            reply_res = await db.execute(
                select(Message).where(Message.reply_to_message_id == user_msg.id)
            )
            existing_reply = reply_res.scalars().first()
            if existing_reply and existing_reply.status != "FAILED":
                return _turn_response(user_msg, existing_reply)

    parent_message_id = user_msg.id

    # 2. Assemble multi-turn context
    try:
        assembled = await ContextEngine.assemble_context(
            db=db,
            user_id=current_user.id,
            conversation_id=conversation_id,
            current_query=payload.content,
            current_query_in_history=True,
        )
    except PermissionError:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # 3. Model Request with assembled context
    model_used = "local-deterministic"
    assistant_content = ""
    msg_status = "COMPLETED"

    health = await nemotron_provider.health_check()
    provider_configured = bool(health.get("configured")) and health.get("status") == "CONFIGURED"

    if provider_configured:
        try:
            # Build unified prompt from model messages
            formatted_history = "\n".join(
                f"{m['role'].upper()}: {m['content']}" for m in assembled.model_messages if m["role"] != "system"
            )
            full_prompt = (
                f"Conversation turns:\n{formatted_history}\n\n"
                "Respond to the latest USER turn. Acknowledge and maintain known constraints. "
                "Ask for any missing essential requirements needed to achieve the objective."
            )
            res = await nemotron_provider.generate(
                prompt=full_prompt,
                system_prompt=assembled.system_prompt,
                temperature=0.2,
            )
            assistant_content = res.get("content", "").strip()
            model_used = res.get("model_used", "nebius/nemotron")
        except AIProviderError as e:
            msg_status = "FAILED"
            assistant_content = (
                "The configured inference provider encountered an error. Your message has been saved, "
                "and your conversation context remains intact. You can retry your request."
            )
            model_used = "provider-error"
    else:
        # Deterministic grounded local response preserving constraints
        constraints = assembled.active_constraints
        constraint_phrases = []
        if "destination" in constraints:
            constraint_phrases.append(f"destination '{constraints['destination']}'")
        if "budget_limit" in constraints:
            constraint_phrases.append(f"budget under ₹{int(constraints['budget_limit']):,}")
        if "headcount" in constraints:
            constraint_phrases.append(f"{constraints['headcount']} person(s)")
        if "duration" in constraints:
            constraint_phrases.append(f"{constraints['duration']} night(s)/day(s)")

        constraints_summary = ", ".join(constraint_phrases) if constraint_phrases else "your stated objective"

        assistant_content = (
            f"Understood. Retaining context for {constraints_summary}. "
            "No language model provider is currently active, but your constraints and history are persisted. "
            "Please provide your exact travel dates or additional preferences to continue."
        )

    # 4. Persist Assistant Response atomically
    assistant_msg = Message(
        conversation_id=conversation.id,
        role="ASSISTANT",
        content=assistant_content,
        source="conversation_turn",
        status=msg_status,
        metadata_json={
            "model_used": model_used,
            "active_constraints": assembled.active_constraints,
            "context_items_count": len(assembled.items),
        },
        reply_to_message_id=parent_message_id,
    )
    db.add(assistant_msg)
    conversation.updated_at = datetime.now(timezone.utc)
    try:
        await db.commit()
        await db.refresh(assistant_msg)
    except IntegrityError:
        await db.rollback()
        reply_res = await db.execute(select(Message).where(Message.reply_to_message_id == parent_message_id))
        existing_reply = reply_res.scalars().first()
        if not existing_reply:
            raise
        user_res = await db.execute(select(Message).where(Message.id == parent_message_id))
        persisted_user = user_res.scalars().first()
        return _turn_response(persisted_user, existing_reply)

    return ConversationTurnResponse(
        user_message=MessageResponse.model_validate(user_msg),
        assistant_message=MessageResponse.model_validate(assistant_msg),
        active_constraints=assembled.active_constraints,
        diagnostics=assembled.diagnostics.model_dump(),
    )


@router.get("/{conversation_id}/context-preview", response_model=ContextPreviewResponse)
async def preview_conversation_context(
    conversation_id: str,
    query: str = "",
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Diagnostic internal endpoint showing assembled context, source provenance, and active constraints with secrets redacted."""
    try:
        assembled = await ContextEngine.assemble_context(
            db=db,
            user_id=current_user.id,
            conversation_id=conversation_id,
            current_query=query,
        )
    except PermissionError:
        raise HTTPException(status_code=404, detail="Conversation not found")

    return ContextPreviewResponse(
        conversation_id=conversation_id,
        total_items=assembled.diagnostics.total_items,
        categories_present=assembled.diagnostics.categories_present,
        items=assembled.diagnostics.items,
        active_constraints=assembled.diagnostics.active_constraints,
        history_message_count=assembled.diagnostics.history_message_count,
        truncated=assembled.diagnostics.truncated,
        summary_applied=assembled.diagnostics.summary_applied,
    )
