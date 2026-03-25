import uuid
from datetime import datetime

from pydantic import BaseModel


class ResumeCreate(BaseModel):
    title: str
    target_job: str | None = None
    language: str = "zh-CN"
    template_id: str = "classic"


class ResumeUpdate(BaseModel):
    title: str | None = None
    target_job: str | None = None
    template_id: str | None = None
    basic_info: dict | None = None
    summary: str | None = None


class ResumeSectionCreate(BaseModel):
    type: str
    title: str
    sort_order: int = 0
    content: dict


class ResumeSectionUpdate(BaseModel):
    title: str | None = None
    sort_order: int | None = None
    content: dict | None = None


class ResumeSectionOut(BaseModel):
    id: uuid.UUID
    type: str
    title: str
    sort_order: int
    content: dict

    model_config = {"from_attributes": True}


class ResumeOut(BaseModel):
    id: uuid.UUID
    title: str
    target_job: str | None
    language: str
    template_id: str
    basic_info: dict | None
    summary: str | None
    status: str
    score: int | None
    sections: list[ResumeSectionOut] = []
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ResumeListOut(BaseModel):
    id: uuid.UUID
    title: str
    target_job: str | None
    status: str
    score: int | None
    template_id: str
    updated_at: datetime

    model_config = {"from_attributes": True}


class OptimizeRequest(BaseModel):
    job_description: str | None = None


class OptimizeResult(BaseModel):
    overall_score: int
    dimensions: dict
    suggestions: list[dict]
    keywords: dict


class SyncConversationBody(BaseModel):
    conversation_id: uuid.UUID
