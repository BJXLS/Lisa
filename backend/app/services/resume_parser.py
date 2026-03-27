import io
import re
from typing import Any

from docx import Document
from pypdf import PdfReader


def parse_resume_file(filename: str, content: bytes) -> str:
    ext = (filename.rsplit(".", 1)[-1] if "." in filename else "").lower()
    if ext == "pdf":
        return _parse_pdf(content)
    if ext == "docx":
        return _parse_docx(content)
    if ext in {"txt", "md"}:
        return content.decode("utf-8", errors="ignore")
    raise ValueError("仅支持 PDF / Word(docx) / 文本 文件")


def parse_jd_text(jd_text: str) -> dict[str, Any]:
    text = jd_text.strip()
    if not text:
        return {
            "target_job": "",
            "skills": [],
            "years_requirement": "",
            "education_requirement": "",
            "keywords": [],
        }

    lines = [ln.strip(" -\t") for ln in text.splitlines() if ln.strip()]
    title = lines[0][:120] if lines else ""

    # 常见技术关键词抽取（轻量规则，避免额外模型依赖）
    skill_pool = [
        "python",
        "java",
        "go",
        "javascript",
        "typescript",
        "react",
        "vue",
        "node.js",
        "docker",
        "kubernetes",
        "sql",
        "redis",
        "aws",
        "gcp",
        "ci/cd",
        "微前端",
        "性能优化",
    ]
    lowered = text.lower()
    skills = [s for s in skill_pool if s in lowered]

    years_match = re.search(r"(\d+\+?\s*年)", text)
    edu_match = re.search(r"(本科|硕士|博士|大专)", text)

    words = re.findall(r"[A-Za-z][A-Za-z0-9+./-]{1,20}|[\u4e00-\u9fa5]{2,8}", text)
    keywords = []
    for w in words:
        lw = w.lower()
        if lw in {"负责", "岗位", "要求", "优先", "我们", "公司", "经验", "能力"}:
            continue
        if lw not in [k.lower() for k in keywords]:
            keywords.append(w)
        if len(keywords) >= 20:
            break

    return {
        "target_job": title,
        "skills": skills,
        "years_requirement": years_match.group(1) if years_match else "",
        "education_requirement": edu_match.group(1) if edu_match else "",
        "keywords": keywords,
    }


def build_ats_report(resume_text: str, jd_info: dict[str, Any] | None = None) -> dict[str, Any]:
    text = resume_text or ""
    issues: list[str] = []
    score = 100

    if not text.strip():
        return {"score": 0, "issues": ["未检测到简历内容"], "suggestions": ["请先上传或创建简历内容"]}

    if len(text) > 5000:
        score -= 8
        issues.append("简历篇幅偏长，可能影响 ATS 抓取效率")
    if "@" not in text:
        score -= 15
        issues.append("缺少邮箱信息")
    if not re.search(r"\d{11}|(\+\d{1,3}\s?)?\d{3,4}[-\s]?\d{4,8}", text):
        score -= 10
        issues.append("缺少可识别的联系电话")

    headings = ["工作", "项目", "教育", "技能", "experience", "education", "skills"]
    if not any(h.lower() in text.lower() for h in headings):
        score -= 12
        issues.append("章节标题不清晰，建议使用标准模块名称")

    suggestions = [
        "尽量使用标准章节标题（教育背景/工作经历/项目经验/技能）",
        "增加与 JD 一致的关键词，提高 ATS 召回",
        "避免使用图片化文本和复杂表格",
    ]

    if jd_info:
        jd_keywords = [str(k).lower() for k in jd_info.get("keywords", [])[:30]]
        covered = [k for k in jd_keywords if k and k in text.lower()]
        if jd_keywords:
            coverage = int(len(covered) * 100 / len(jd_keywords))
            if coverage < 40:
                score -= 12
                issues.append(f"JD 关键词覆盖率偏低（约 {coverage}%）")
            suggestions.insert(0, f"当前 JD 关键词覆盖约 {coverage}%，建议补充缺失关键词")

    return {
        "score": max(0, min(100, score)),
        "issues": issues,
        "suggestions": suggestions,
    }


def _parse_pdf(content: bytes) -> str:
    reader = PdfReader(io.BytesIO(content))
    texts: list[str] = []
    for page in reader.pages:
        texts.append(page.extract_text() or "")
    return "\n".join(texts).strip()


def _parse_docx(content: bytes) -> str:
    doc = Document(io.BytesIO(content))
    return "\n".join(p.text for p in doc.paragraphs if p.text.strip()).strip()
