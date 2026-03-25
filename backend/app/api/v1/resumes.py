import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.deps import get_current_user
from app.database import get_db
from app.models.conversation import Conversation, ConversationMessage
from app.models.enums import SectionType
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
    SyncConversationBody,
)
from app.services.ai_engine.resume_agent import ResumeAgent
from app.services.resume_render import build_resume_view, resume_view_to_pdf_bytes

router = APIRouter(prefix="/resumes", tags=["简历"])

_ALLOWED_SECTION = {e.value for e in SectionType}


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


@router.post("/{resume_id}/sync-conversation", response_model=ResumeOut)
async def sync_resume_from_conversation(
    resume_id: uuid.UUID,
    body: SyncConversationBody,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(
        select(Resume)
        .where(Resume.id == resume_id, Resume.user_id == current_user.id)
        .options(selectinload(Resume.sections))
    )
    resume = r.scalar_one_or_none()
    if resume is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="简历不存在")

    cr = await db.execute(
        select(Conversation).where(
            Conversation.id == body.conversation_id,
            Conversation.user_id == current_user.id,
        )
    )
    conv = cr.scalar_one_or_none()
    if conv is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="会话不存在")

    mr = await db.execute(
        select(ConversationMessage)
        .where(ConversationMessage.conversation_id == conv.id)
        .order_by(ConversationMessage.sequence)
    )
    msgs = mr.scalars().all()
    lines: list[str] = []
    for m in msgs:
        who = "用户" if m.role == "user" else "Lisa"
        lines.append(f"{who}: {m.content}")

    agent = ResumeAgent()
    snapshot = await agent.extract_snapshot_from_transcript(lines)

    t = snapshot.get("title")
    if isinstance(t, str) and t.strip():
        resume.title = t.strip()[:200]

    tj = snapshot.get("target_job")
    if isinstance(tj, str) and tj.strip():
        resume.target_job = tj.strip()[:200]

    summ = snapshot.get("summary")
    if isinstance(summ, str) and summ.strip():
        resume.summary = summ.strip()

    new_bi = snapshot.get("basic_info")
    if isinstance(new_bi, dict):
        merged = dict(resume.basic_info or {})
        for k, v in new_bi.items():
            if v not in (None, "", [], {}):
                merged[k] = v
        resume.basic_info = merged

    secs = snapshot.get("sections")
    if isinstance(secs, list) and len(secs) > 0:
        await db.execute(
            delete(ResumeSection).where(ResumeSection.resume_id == resume_id)
        )
        for i, sec in enumerate(secs):
            if not isinstance(sec, dict):
                continue
            st = sec.get("type") or "custom"
            if st not in _ALLOWED_SECTION:
                st = SectionType.CUSTOM.value
            title = (sec.get("title") or st)[:100]
            sort_order = sec.get("sort_order")
            if not isinstance(sort_order, int):
                sort_order = i
            content = sec.get("content")
            if not isinstance(content, dict):
                content = {}
            db.add(
                ResumeSection(
                    resume_id=resume_id,
                    type=st,
                    title=title,
                    sort_order=sort_order,
                    content=content,
                )
            )

    await db.flush()

    out = await db.execute(
        select(Resume)
        .where(Resume.id == resume_id)
        .options(selectinload(Resume.sections))
    )
    return out.scalar_one()


@router.post("/{resume_id}/export/pdf")
async def export_resume_pdf(
    resume_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(
        select(Resume)
        .where(Resume.id == resume_id, Resume.user_id == current_user.id)
        .options(selectinload(Resume.sections))
    )
    resume = r.scalar_one_or_none()
    if resume is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="简历不存在")

    view = build_resume_view(resume, list(resume.sections))
    try:
        pdf_bytes = resume_view_to_pdf_bytes(view, resume.template_id or "classic")
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"PDF 生成失败: {e!s}",
        ) from e

    filename = f"resume-{resume_id}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
        },
    )
