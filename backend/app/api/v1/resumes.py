import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import Response
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.deps import get_current_user
from app.database import get_db
from app.models.conversation import Conversation, ConversationMessage
from app.models.enums import SectionType, VersionSource
from app.models.resume import Resume, ResumeSection, ResumeVersion
from app.models.user import User
from app.schemas.resume import (
    ApplyOptimizationsRequest,
    AtsCheckResult,
    OptimizeRequest,
    OptimizeResult,
    ParsedJdOut,
    ResumeCreate,
    ResumeListOut,
    ResumeOut,
    ResumeSectionCreate,
    ResumeSectionOut,
    ResumeUpdate,
    SyncConversationBody,
)
from app.services.ai_engine.resume_agent import ResumeAgent
from app.services.resume_parser import build_ats_report, parse_jd_text, parse_resume_file
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
        .options(selectinload(Resume.sections), selectinload(Resume.versions))
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
        .options(selectinload(Resume.sections), selectinload(Resume.versions))
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


@router.post("/parse-jd", response_model=ParsedJdOut)
async def parse_jd(body: OptimizeRequest):
    if not body.job_description or not body.job_description.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="JD 内容不能为空",
        )
    return parse_jd_text(body.job_description)


@router.post("/import/file", response_model=ResumeOut, status_code=status.HTTP_201_CREATED)
async def import_resume_file(
    file: UploadFile = File(...),
    title: str | None = Form(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not file.filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="文件名无效")

    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="文件内容为空")

    try:
        parsed_text = parse_resume_file(file.filename, raw)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"解析失败: {e!s}",
        ) from e

    if not parsed_text.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="未从文件中解析到文本")

    agent = ResumeAgent()
    snapshot = await agent.extract_snapshot_from_transcript(
        [f"用户简历内容：{parsed_text[:12000]}"]
    )

    resume = Resume(
        user_id=current_user.id,
        title=(title or snapshot.get("title") or f"导入简历-{file.filename}")[:200],
        target_job=(snapshot.get("target_job") or None),
        summary=(snapshot.get("summary") or None),
        basic_info=snapshot.get("basic_info") if isinstance(snapshot.get("basic_info"), dict) else {},
        status="draft",
    )
    db.add(resume)
    await db.flush()

    sections = snapshot.get("sections")
    has_section = False
    if isinstance(sections, list):
        for idx, sec in enumerate(sections):
            if not isinstance(sec, dict):
                continue
            st = (sec.get("type") or "custom")
            if st not in _ALLOWED_SECTION:
                st = SectionType.CUSTOM.value
            content = sec.get("content") if isinstance(sec.get("content"), dict) else {}
            db.add(
                ResumeSection(
                    resume_id=resume.id,
                    type=st,
                    title=(sec.get("title") or st)[:100],
                    sort_order=sec.get("sort_order") if isinstance(sec.get("sort_order"), int) else idx,
                    content=content,
                )
            )
            has_section = True

    # LLM 抽取失败时的兜底，至少保留一段可优化文本
    if not has_section:
        db.add(
            ResumeSection(
                resume_id=resume.id,
                type=SectionType.CUSTOM.value,
                title="导入原文",
                sort_order=0,
                content={"text": parsed_text[:12000]},
            )
        )

    await db.flush()
    out = await db.execute(
        select(Resume).where(Resume.id == resume.id).options(selectinload(Resume.sections))
    )
    return out.scalar_one()


@router.post("/{resume_id}/apply-optimizations", response_model=ResumeOut)
async def apply_optimizations(
    resume_id: uuid.UUID,
    body: ApplyOptimizationsRequest,
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

    replacements: list[tuple[str, str]] = []
    for s in body.suggestions:
        original = s.get("original")
        improved = s.get("improved")
        if isinstance(original, str) and isinstance(improved, str) and original.strip() and improved.strip():
            replacements.append((original.strip(), improved.strip()))

    if not replacements:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="没有可应用的优化建议")

    _save_resume_snapshot(
        db=db,
        resume=resume,
        source=VersionSource.AI_OPTIMIZE.value,
        change_log=f"应用优化建议 {len(replacements)} 条",
    )

    if body.apply_summary and isinstance(resume.summary, str):
        new_summary = resume.summary
        for original, improved in replacements:
            if original in new_summary:
                new_summary = new_summary.replace(original, improved)
        resume.summary = new_summary

    for sec in resume.sections:
        content = sec.content if isinstance(sec.content, dict) else {}
        changed = False
        for key in ("items", "bullets", "highlights"):
            value = content.get(key)
            if isinstance(value, list):
                content[key] = [
                    _apply_replace_on_text_or_map(v, replacements)
                    for v in value
                ]
                changed = True
        if changed:
            sec.content = content

    resume.status = "optimized"
    await db.flush()
    return resume


@router.post("/{resume_id}/rollback-last-optimization", response_model=ResumeOut)
async def rollback_last_optimization(
    resume_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Resume)
        .where(Resume.id == resume_id, Resume.user_id == current_user.id)
        .options(selectinload(Resume.sections), selectinload(Resume.versions))
    )
    resume = result.scalar_one_or_none()
    if resume is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="简历不存在")

    target = next(
        (v for v in resume.versions if v.source == VersionSource.AI_OPTIMIZE.value),
        None,
    )
    if target is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="没有可回滚的优化记录")

    snapshot = target.snapshot if isinstance(target.snapshot, dict) else {}
    _restore_resume_from_snapshot(resume, snapshot)
    await db.execute(delete(ResumeSection).where(ResumeSection.resume_id == resume.id))
    for i, sec in enumerate(snapshot.get("sections") or []):
        if not isinstance(sec, dict):
            continue
        st = sec.get("type") or SectionType.CUSTOM.value
        if st not in _ALLOWED_SECTION:
            st = SectionType.CUSTOM.value
        db.add(
            ResumeSection(
                resume_id=resume.id,
                type=st,
                title=(sec.get("title") or st)[:100],
                sort_order=sec.get("sort_order") if isinstance(sec.get("sort_order"), int) else i,
                content=sec.get("content") if isinstance(sec.get("content"), dict) else {},
            )
        )
    await db.delete(target)
    await db.flush()

    out = await db.execute(
        select(Resume).where(Resume.id == resume.id).options(selectinload(Resume.sections))
    )
    return out.scalar_one()


@router.get("/{resume_id}/ats-check", response_model=AtsCheckResult)
async def ats_check(
    resume_id: uuid.UUID,
    job_description: str | None = None,
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

    parts = [resume.summary or ""]
    for sec in resume.sections:
        parts.append(sec.title or "")
        parts.append(str(sec.content or ""))
    plain_text = "\n".join(parts)

    jd_info = parse_jd_text(job_description) if job_description else None
    return build_ats_report(plain_text, jd_info)


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


def _apply_replace_on_text_or_map(value: object, replacements: list[tuple[str, str]]) -> object:
    if isinstance(value, str):
        new_text = value
        for original, improved in replacements:
            if original in new_text:
                new_text = new_text.replace(original, improved)
        return new_text
    if isinstance(value, dict):
        out: dict = {}
        for k, v in value.items():
            out[k] = _apply_replace_on_text_or_map(v, replacements)
        return out
    if isinstance(value, list):
        return [_apply_replace_on_text_or_map(v, replacements) for v in value]
    return value


def _save_resume_snapshot(
    db: AsyncSession,
    resume: Resume,
    source: str,
    change_log: str,
) -> None:
    current_version = max((v.version for v in resume.versions), default=0)
    db.add(
        ResumeVersion(
            resume_id=resume.id,
            version=current_version + 1,
            snapshot={
                "title": resume.title,
                "target_job": resume.target_job,
                "summary": resume.summary,
                "basic_info": resume.basic_info,
                "status": resume.status,
                "score": resume.score,
                "sections": [
                    {
                        "type": s.type,
                        "title": s.title,
                        "sort_order": s.sort_order,
                        "content": s.content,
                    }
                    for s in sorted(resume.sections, key=lambda x: x.sort_order)
                ],
            },
            source=source,
            change_log=change_log,
        )
    )


def _restore_resume_from_snapshot(resume: Resume, snapshot: dict) -> None:
    resume.title = snapshot.get("title") or resume.title
    resume.target_job = snapshot.get("target_job")
    resume.summary = snapshot.get("summary")
    resume.basic_info = snapshot.get("basic_info") if isinstance(snapshot.get("basic_info"), dict) else {}
    resume.status = snapshot.get("status") or resume.status
    resume.score = snapshot.get("score") if isinstance(snapshot.get("score"), int) else resume.score
