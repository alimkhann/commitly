from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from app.core.config import settings
from app.services.supabase_client import get_supabase_admin_client
from app.api.repos import _resolve_repo  # reuse helper

router = APIRouter()


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    repo_id: str
    message: ChatMessage
    user_id: Optional[str] = None


class ChatResponse(BaseModel):
    messages: List[ChatMessage]


def _fetch_history(repo_uuid: str, limit: int = 50) -> List[ChatMessage]:
    sb = get_supabase_admin_client()
    if not sb:
        return []
    rows = sb.table("agent_messages").select("role, content").eq("repo_id", repo_uuid).order("created_at", asc=True).limit(limit).execute()
    return [ChatMessage(role=row["role"], content=row["content"]) for row in rows.data]


@router.get("/history", response_model=ChatResponse)
def get_history(repo_id: str, limit: int = Query(50, ge=1, le=200)) -> ChatResponse:
    sb = get_supabase_admin_client()
    if not sb:
        return ChatResponse(messages=[])
    repo_uuid = _resolve_repo(sb, repo_id)
    if not repo_uuid:
        raise HTTPException(status_code=404, detail="Repository not found")
    return ChatResponse(messages=_fetch_history(repo_uuid, limit=limit))


@router.post("/message", response_model=ChatResponse)
def post_message(payload: ChatRequest) -> ChatResponse:
    sb = get_supabase_admin_client()
    if not sb:
        # fallback to echo only
        return ChatResponse(messages=[payload.message, ChatMessage(role="assistant", content=f"Echo: {payload.message.content}")])

    repo_uuid = _resolve_repo(sb, payload.repo_id)
    if not repo_uuid:
        raise HTTPException(status_code=404, detail="Repository not found")

    # Persist user message when user id provided
    if payload.user_id:
        sb.table("agent_messages").insert({
            "repo_id": repo_uuid,
            "user_id": payload.user_id,
            "role": payload.message.role,
            "content": payload.message.content[:4000],
        }).execute()

    reply_text = f"Thanks for sharing! I received: {payload.message.content[:300]}"
    sb.table("agent_messages").insert({
        "repo_id": repo_uuid,
        "user_id": str(settings.public_user_id),
        "role": "assistant",
        "content": reply_text,
    }).execute()

    return ChatResponse(messages=_fetch_history(repo_uuid))
