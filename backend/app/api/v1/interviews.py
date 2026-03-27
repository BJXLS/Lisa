import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.deps import get_current_user
from app.database import get_db
from app.models.interview import Interview, InterviewFeedback, InterviewMessage
from app.models.enums import InterviewStatus, MessageRole
from app.models.user import User
from app.schemas.interview import (
    AnswerRequest,
    InterviewCreate,
    InterviewDetailOut,
    InterviewFeedbackOut,
    InterviewOut,
)
from app.services.ai_engine.interview_agent import InterviewAgent

router = APIRouter(prefix="/interviews", tags=["模拟面试"])


@router.get("", response_model=list[InterviewOut])
async def list_interviews(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Interview)
        .where(Interview.user_id == current_user.id)
        .order_by(Interview.created_at.desc())
    )
    return result.scalars().all()


@router.post("", response_model=InterviewDetailOut, status_code=status.HTTP_201_CREATED)
async def create_interview(
    body: InterviewCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    interview = Interview(
        user_id=current_user.id,
        target_job=body.target_job,
        resume_id=body.resume_id,
        job_description=body.job_description,
        type=body.type,
        difficulty=body.difficulty,
    )
    db.add(interview)
    await db.flush()

    agent = InterviewAgent()
    opening = await agent.generate_opening(
        target_job=body.target_job,
        interview_type=body.type,
        difficulty=body.difficulty,
        job_description=body.job_description,
    )

    msg = InterviewMessage(
        interview_id=interview.id,
        role=MessageRole.INTERVIEWER.value,
        content=opening,
        sequence=0,
    )
    db.add(msg)
    await db.flush()

    result = await db.execute(
        select(Interview)
        .where(Interview.id == interview.id)
        .options(selectinload(Interview.messages), selectinload(Interview.feedback))
    )
    return result.scalar_one()


@router.get("/{interview_id}", response_model=InterviewDetailOut)
async def get_interview(
    interview_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Interview)
        .where(Interview.id == interview_id, Interview.user_id == current_user.id)
        .options(selectinload(Interview.messages), selectinload(Interview.feedback))
    )
    interview = result.scalar_one_or_none()
    if interview is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="面试不存在")
    return interview


@router.post("/{interview_id}/answer", response_model=InterviewDetailOut)
async def submit_answer(
    interview_id: uuid.UUID,
    body: AnswerRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Interview)
        .where(Interview.id == interview_id, Interview.user_id == current_user.id)
        .options(selectinload(Interview.messages), selectinload(Interview.feedback))
    )
    interview = result.scalar_one_or_none()
    if interview is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="面试不存在")
    if interview.status != InterviewStatus.IN_PROGRESS.value:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="面试已结束")

    next_seq = len(interview.messages)

    candidate_msg = InterviewMessage(
        interview_id=interview.id,
        role=MessageRole.CANDIDATE.value,
        content=body.content,
        sequence=next_seq,
    )
    db.add(candidate_msg)

    agent = InterviewAgent()
    history = [{"role": m.role, "content": m.content} for m in interview.messages]
    history.append({"role": MessageRole.CANDIDATE.value, "content": body.content})

    response = await agent.generate_response(
        history=history,
        target_job=interview.target_job,
        interview_type=interview.type,
        difficulty=interview.difficulty,
        job_description=interview.job_description,
    )

    interviewer_msg = InterviewMessage(
        interview_id=interview.id,
        role=MessageRole.INTERVIEWER.value,
        content=response,
        sequence=next_seq + 1,
    )
    db.add(interviewer_msg)
    await db.flush()

    result = await db.execute(
        select(Interview)
        .where(Interview.id == interview.id)
        .options(selectinload(Interview.messages), selectinload(Interview.feedback))
    )
    return result.scalar_one()


@router.post("/{interview_id}/end", response_model=InterviewFeedbackOut)
async def end_interview(
    interview_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Interview)
        .where(Interview.id == interview_id, Interview.user_id == current_user.id)
        .options(selectinload(Interview.messages), selectinload(Interview.feedback))
    )
    interview = result.scalar_one_or_none()
    if interview is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="面试不存在")

    if interview.feedback:
        return interview.feedback

    interview.status = InterviewStatus.COMPLETED.value
    interview.ended_at = datetime.utcnow()
    if interview.started_at:
        interview.duration = int((interview.ended_at - interview.started_at).total_seconds())

    agent = InterviewAgent()
    history = [{"role": m.role, "content": m.content} for m in interview.messages]
    feedback_data = await agent.generate_feedback(
        history=history,
        target_job=interview.target_job,
        interview_type=interview.type,
    )

    payload = _normalize_feedback_payload(feedback_data)
    feedback = InterviewFeedback(interview_id=interview.id, **payload)
    db.add(feedback)
    await db.flush()
    return feedback


def _normalize_feedback_payload(data: dict) -> dict:
    def score_field(key: str, default: int = 0) -> int:
        try:
            v = data.get(key)
            return int(v) if v is not None else default
        except (TypeError, ValueError):
            return default

    def as_json_list(key: str) -> list:
        v = data.get(key)
        if v is None:
            return []
        if isinstance(v, list):
            return v
        return [v]

    return {
        "overall_score": score_field("overall_score"),
        "content_score": score_field("content_score"),
        "structure_score": score_field("structure_score"),
        "expression_score": score_field("expression_score"),
        "professional_score": score_field("professional_score"),
        "communication_score": score_field("communication_score"),
        "summary": str(data.get("summary") or ""),
        "strengths": as_json_list("strengths"),
        "improvements": as_json_list("improvements"),
        "question_feedbacks": as_json_list("question_feedbacks"),
        "suggestions": as_json_list("suggestions"),
        "recommended_topics": as_json_list("recommended_topics"),
    }
