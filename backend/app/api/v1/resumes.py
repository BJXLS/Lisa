import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.deps import get_current_user
from app.database import get_db
from app.models.resume import Resume, ResumeSection
from app.models.user import User
from app.schemas.resume import (
    OptimizeRequest,
    OptimizeResult,
    ResumeCreate,
    ResumeListOut,
    ResumeOut,
    ResumeSectionCreate,
    ResumeSectionOut,
    ResumeUpdate,
)
from app.services.ai_engine.resume_agent import ResumeAgent

router = APIRouter(prefix="/resumes", tags=["简历"])


@router.get("", response_model=list[ResumeListOut])
async def list_resumes(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Resume)
        .where(Resume.user_id == current_user.id)
        .order_by(Resume.updated_at.desc())
    )
    return result.scalars().all()


@router.post("", response_model=ResumeOut, status_code=status.HTTP_201_CREATED)
async def create_resume(
    body: ResumeCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    resume = Resume(user_id=current_user.id, **body.model_dump())
    db.add(resume)
    await db.flush()

    result = await db.execute(
        select(Resume)
        .where(Resume.id == resume.id)
        .options(selectinload(Resume.sections))
    )
    return result.scalar_one()


@router.get("/{resume_id}", response_model=ResumeOut)
async def get_resume(
    resume_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Resume)
        .where(Resume.id == resume_id, Resume.user_id == current_user.id)
        .options(selectinload(Resume.sections))
    )
    resume = result.scalar_one_or_none()
    if resume is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="简历不存在")
    return resume


@router.put("/{resume_id}", response_model=ResumeOut)
async def update_resume(
    resume_id: uuid.UUID,
    body: ResumeUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Resume)
        .where(Resume.id == resume_id, Resume.user_id == current_user.id)
        .options(selectinload(Resume.sections))
    )
    resume = result.scalar_one_or_none()
    if resume is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="简历不存在")

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(resume, field, value)

    await db.flush()
    return resume


@router.delete("/{resume_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_resume(
    resume_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Resume).where(Resume.id == resume_id, Resume.user_id == current_user.id)
    )
    resume = result.scalar_one_or_none()
    if resume is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="简历不存在")
    await db.delete(resume)


@router.post("/{resume_id}/sections", response_model=ResumeSectionOut, status_code=status.HTTP_201_CREATED)
async def add_section(
    resume_id: uuid.UUID,
    body: ResumeSectionCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Resume).where(Resume.id == resume_id, Resume.user_id == current_user.id)
    )
    if result.scalar_one_or_none() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="简历不存在")

    section = ResumeSection(resume_id=resume_id, **body.model_dump())
    db.add(section)
    await db.flush()
    return section


@router.post("/{resume_id}/optimize", response_model=OptimizeResult)
async def optimize_resume(
    resume_id: uuid.UUID,
    body: OptimizeRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Resume)
        .where(Resume.id == resume_id, Resume.user_id == current_user.id)
        .options(selectinload(Resume.sections))
    )
    resume = result.scalar_one_or_none()
    if resume is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="简历不存在")

    resume_data = {
        "basic_info": resume.basic_info,
        "summary": resume.summary,
        "sections": [
            {"type": s.type, "title": s.title, "content": s.content}
            for s in resume.sections
        ],
    }

    agent = ResumeAgent()
    analysis = await agent.optimize_resume(
        resume_data=resume_data,
        job_description=body.job_description,
    )

    if analysis.get("overall_score"):
        resume.score = analysis["overall_score"]
        resume.status = "optimized"

    return analysis
