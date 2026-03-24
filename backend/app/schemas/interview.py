import uuid
from datetime import datetime

from pydantic import BaseModel


class InterviewCreate(BaseModel):
    target_job: str
    resume_id: uuid.UUID | None = None
    job_description: str | None = None
    type: str = "behavioral"
    difficulty: str = "medium"


class InterviewOut(BaseModel):
    id: uuid.UUID
    target_job: str
    type: str
    mode: str
    difficulty: str
    status: str
    started_at: datetime
    ended_at: datetime | None
    duration: int | None
    created_at: datetime

    model_config = {"from_attributes": True}


class InterviewMessageOut(BaseModel):
    id: uuid.UUID
    role: str
    content: str
    score: int | None
    evaluation: dict | None
    sequence: int
    created_at: datetime

    model_config = {"from_attributes": True}


class InterviewDetailOut(InterviewOut):
    messages: list[InterviewMessageOut] = []


class AnswerRequest(BaseModel):
    content: str


class InterviewFeedbackOut(BaseModel):
    overall_score: int
    content_score: int
    structure_score: int
    expression_score: int
    professional_score: int
    communication_score: int
    summary: str
    strengths: list
    improvements: list
    question_feedbacks: list
    suggestions: list
    recommended_topics: list

    model_config = {"from_attributes": True}
