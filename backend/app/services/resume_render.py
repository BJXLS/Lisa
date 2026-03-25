"""简历 HTML 模板渲染与 PDF 导出（WeasyPrint）。"""

from pathlib import Path

from jinja2 import Environment, FileSystemLoader, select_autoescape
from weasyprint import HTML

APP_DIR = Path(__file__).resolve().parent.parent
TEMPLATES_DIR = APP_DIR / "templates"


def build_resume_view(resume, sections: list) -> dict:
    bi = resume.basic_info or {}
    return {
        "title": resume.title,
        "target_job": resume.target_job or "",
        "summary": resume.summary or "",
        "basic_info": bi,
        "sections": [
            {
                "type": s.type,
                "title": s.title,
                "sort_order": s.sort_order,
                "content": s.content if s.content is not None else {},
            }
            for s in sorted(sections, key=lambda x: x.sort_order)
        ],
    }


def render_resume_html(view: dict, template_id: str = "classic") -> str:
    env = Environment(
        loader=FileSystemLoader(str(TEMPLATES_DIR)),
        autoescape=select_autoescape(["html", "xml"]),
    )
    try:
        tpl = env.get_template(f"resume/{template_id}.html")
    except Exception:
        tpl = env.get_template("resume/classic.html")
    return tpl.render(view=view)


def resume_view_to_pdf_bytes(view: dict, template_id: str = "classic") -> bytes:
    html_str = render_resume_html(view, template_id)
    return HTML(
        string=html_str,
        base_url=str(TEMPLATES_DIR),
    ).write_pdf()
