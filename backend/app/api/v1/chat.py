import json

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.deps import get_current_user
from app.database import get_db
from app.models.conversation import Conversation, ConversationMessage
from app.models.resume import Resume
from app.models.user import User
from app.schemas.chat import ChatRequest
from app.services.ai_engine.llm_router import LLMRouter
from app.services.ai_engine.resume_agent import ResumeAgent

router = APIRouter(prefix="/chat", tags=["AI对话"])


def _sse_payload(obj: dict) -> str:
    return f"data: {json.dumps(obj, ensure_ascii=False)}\n\n"


@router.post("/stream")
async def chat_stream(
    body: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    resume_context: dict | None = None
    if body.resume_id:
        r = await db.execute(
            select(Resume)
            .where(Resume.id == body.resume_id, Resume.user_id == current_user.id)
            .options(selectinload(Resume.sections))
        )
        resume = r.scalar_one_or_none()
        if resume is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="简历不存在",
            )
        resume_context = {
            "title": resume.title,
            "target_job": resume.target_job,
            "summary": resume.summary,
            "basic_info": resume.basic_info,
            "sections": [
                {"type": s.type, "title": s.title, "content": s.content}
                for s in sorted(resume.sections, key=lambda x: x.sort_order)
            ],
        }

    if body.conversation_id:
        result = await db.execute(
            select(Conversation).where(
                Conversation.id == body.conversation_id,
                Conversation.user_id == current_user.id,
            )
        )
        conversation = result.scalar_one_or_none()
        if conversation is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="会话不存在",
            )
    else:
        conversation = None

    if conversation is None:
        conversation = Conversation(
            user_id=current_user.id,
            type=body.conversation_type,
            title=body.message[:50],
        )
        db.add(conversation)
        await db.flush()

    result = await db.execute(
        select(ConversationMessage)
        .where(ConversationMessage.conversation_id == conversation.id)
        .order_by(ConversationMessage.sequence)
    )
    existing_messages = result.scalars().all()
    next_seq = len(existing_messages)

    user_msg = ConversationMessage(
        conversation_id=conversation.id,
        role="user",
        content=body.message,
        sequence=next_seq,
    )
    db.add(user_msg)
    await db.flush()

    history = [{"role": m.role, "content": m.content} for m in existing_messages]
    history.append({"role": "user", "content": body.message})

    llm = LLMRouter()
    task_type = _map_conversation_type(body.conversation_type)

    async def generate():
        full_response: list[str] = []

        if body.conversation_type == "resume_build":
            agent = ResumeAgent()
            async for chunk in agent.stream_chat_for_resume(
                history=history,
                resume_context=resume_context,
            ):
                full_response.append(chunk)
                yield _sse_payload({"e": "token", "t": chunk})
        else:
            messages = _history_to_openai_messages(history, task_type)
            async for chunk in llm.stream(messages=messages, task_type=task_type):
                full_response.append(chunk)
                yield _sse_payload({"e": "token", "t": chunk})

        text = "".join(full_response)
        assistant_msg = ConversationMessage(
            conversation_id=conversation.id,
            role="assistant",
            content=text,
            model=llm.get_model_for_task(task_type),
            sequence=next_seq + 1,
        )
        db.add(assistant_msg)
        await db.flush()

        meta: dict = {"conversation_id": str(conversation.id)}
        if body.resume_id:
            meta["resume_id"] = str(body.resume_id)
        yield _sse_payload({"e": "meta", **meta})
        yield _sse_payload({"e": "done"})

    return StreamingResponse(generate(), media_type="text/event-stream")


def _map_conversation_type(conv_type: str) -> str:
    mapping = {
        "resume_build": "resume_generation",
        "resume_optimize": "resume_optimization",
        "career_advice": "career_advice",
    }
    return mapping.get(conv_type, "general")


def _history_to_openai_messages(history: list[dict], task_type: str) -> list[dict]:
    """非简历场景：无单独 system 时，将首条 user 前插入简短 system。"""
    system = "你是 Lisa，专业求职顾问。用中文简洁、专业地回答。"
    messages: list[dict] = [{"role": "system", "content": system}]
    for msg in history:
        role = "assistant" if msg["role"] == "assistant" else "user"
        messages.append({"role": role, "content": msg["content"]})
    return messages
