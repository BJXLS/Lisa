import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, gen_uuid
from app.models.enums import (
    InterviewDifficulty,
    InterviewMode,
    InterviewStatus,
    InterviewType,
)


class Interview(Base, TimestampMixin):
    __tablename__ = "interviews"
    __table_args__ = (Index("ix_interviews_user_status", "user_id", "status"),)

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=gen_uuid
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )

    resume_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    target_job: Mapped[str] = mapped_column(String(200))
    job_description: Mapped[str | None] = mapped_column(Text)

    type: Mapped[str] = mapped_column(
        String(20), default=InterviewType.BEHAVIORAL.value
    )
    mode: Mapped[str] = mapped_column(
        String(20), default=InterviewMode.TEXT.value
    )
    difficulty: Mapped[str] = mapped_column(
        String(20), default=InterviewDifficulty.MEDIUM.value
    )

    status: Mapped[str] = mapped_column(
        String(20), default=InterviewStatus.IN_PROGRESS.value
    )
    started_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime)
    duration: Mapped[int | None] = mapped_column(Integer)

    user: Mapped["User"] = relationship(back_populates="interviews")  # noqa: F821
    messages: Mapped[list["InterviewMessage"]] = relationship(
        back_populates="interview",
        cascade="all, delete-orphan",
        order_by="InterviewMessage.sequence",
    )
    feedback: Mapped["InterviewFeedback | None"] = relationship(
        back_populates="interview", uselist=False, cascade="all, delete-orphan"
    )


class InterviewMessage(Base):
    __tablename__ = "interview_messages"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=gen_uuid
    )
    interview_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("interviews.id", ondelete="CASCADE"),
        index=True,
    )

    role: Mapped[str] = mapped_column(String(20))
    content: Mapped[str] = mapped_column(Text)
    audio_url: Mapped[str | None] = mapped_column(String(500))

    score: Mapped[int | None] = mapped_column(Integer)
    evaluation: Mapped[dict | None] = mapped_column(JSON)

    sequence: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    interview: Mapped["Interview"] = relationship(back_populates="messages")


class InterviewFeedback(Base):
    __tablename__ = "interview_feedbacks"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=gen_uuid
    )
    interview_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("interviews.id", ondelete="CASCADE"),
        unique=True,
    )

    overall_score: Mapped[int] = mapped_column(Integer)
    content_score: Mapped[int] = mapped_column(Integer)
    structure_score: Mapped[int] = mapped_column(Integer)
    expression_score: Mapped[int] = mapped_column(Integer)
    professional_score: Mapped[int] = mapped_column(Integer)
    communication_score: Mapped[int] = mapped_column(Integer)

    summary: Mapped[str] = mapped_column(Text)
    strengths: Mapped[dict] = mapped_column(JSON)
    improvements: Mapped[dict] = mapped_column(JSON)
    question_feedbacks: Mapped[dict] = mapped_column(JSON)
    suggestions: Mapped[dict] = mapped_column(JSON)
    recommended_topics: Mapped[dict] = mapped_column(JSON)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    interview: Mapped["Interview"] = relationship(back_populates="feedback")
