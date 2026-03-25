import uuid

from pydantic import BaseModel


class ChatRequest(BaseModel):
    conversation_id: uuid.UUID | None = None
    resume_id: uuid.UUID | None = None
    message: str
    conversation_type: str = "general"
    context: dict | None = None


class ChatMessageOut(BaseModel):
    role: str
    content: str
    model: str | None = None

    model_config = {"from_attributes": True}
