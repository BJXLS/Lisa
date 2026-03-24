from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.database import get_db
from app.models.conversation import Conversation, ConversationMessage
from app.models.user import User
from app.schemas.chat import ChatRequest
from app.services.ai_engine.llm_router import LLMRouter

router = APIRouter(prefix="/chat", tags=["AI对话"])


@router.post("/stream")
async def chat_stream(
    body: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if body.conversation_id:
        result = await db.execute(
            select(Conversation).where(
                Conversation.id == body.conversation_id,
                Conversation.user_id == current_user.id,
            )
        )
        conversation = result.scalar_one_or_none()
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
        full_response = []
        async for chunk in llm.stream(messages=history, task_type=task_type):
            full_response.append(chunk)
            yield f"data: {chunk}\n\n"

        assistant_msg = ConversationMessage(
            conversation_id=conversation.id,
            role="assistant",
            content="".join(full_response),
            model=llm.get_model_for_task(task_type),
            sequence=next_seq + 1,
        )
        async with db.begin_nested():
            db.add(assistant_msg)
            await db.flush()

        yield "data: [DONE]\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")


def _map_conversation_type(conv_type: str) -> str:
    mapping = {
        "resume_build": "resume_generation",
        "resume_optimize": "resume_optimization",
        "career_advice": "career_advice",
    }
    return mapping.get(conv_type, "general")
