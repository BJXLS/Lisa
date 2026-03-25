"""Resume Agent — 简历生成/优化 Agent

负责对话式简历信息采集、简历内容优化、JD匹配分析。
"""

import json
import logging
from collections.abc import AsyncGenerator

from app.services.ai_engine.llm_router import LLMRouter
from app.services.ai_engine.prompt_manager import PromptManager

logger = logging.getLogger(__name__)


class ResumeAgent:
    def __init__(self):
        self.llm = LLMRouter()
        self.prompts = PromptManager()

    async def chat_for_resume(
        self,
        history: list[dict],
        resume_context: dict | None = None,
    ) -> str:
        system_prompt = self.prompts.get_resume_builder_prompt()
        if resume_context:
            system_prompt += f"\n\n当前已采集的简历信息：\n{json.dumps(resume_context, ensure_ascii=False, indent=2)}"

        messages = [{"role": "system", "content": system_prompt}]
        for msg in history:
            role = "assistant" if msg["role"] == "assistant" else "user"
            messages.append({"role": role, "content": msg["content"]})

        return await self.llm.complete(
            messages=messages,
            task_type="resume_generation",
            temperature=0.7,
        )

    def _build_resume_messages(
        self,
        history: list[dict],
        resume_context: dict | None,
    ) -> list[dict]:
        system_prompt = self.prompts.get_resume_builder_prompt()
        if resume_context:
            system_prompt += (
                "\n\n当前已采集的简历信息（请在此基础上继续追问或确认）：\n"
                f"{json.dumps(resume_context, ensure_ascii=False, indent=2)}"
            )
        messages: list[dict] = [{"role": "system", "content": system_prompt}]
        for msg in history:
            role = "assistant" if msg["role"] == "assistant" else "user"
            messages.append({"role": role, "content": msg["content"]})
        return messages

    async def stream_chat_for_resume(
        self,
        history: list[dict],
        resume_context: dict | None = None,
    ) -> AsyncGenerator[str, None]:
        messages = self._build_resume_messages(history, resume_context)
        async for chunk in self.llm.stream(
            messages=messages,
            task_type="resume_generation",
            temperature=0.7,
        ):
            yield chunk

    async def extract_snapshot_from_transcript(
        self,
        transcript_lines: list[str],
    ) -> dict:
        system = self.prompts.get_resume_snapshot_extract_prompt()
        user = "对话记录：\n" + "\n".join(transcript_lines)
        messages = [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ]
        raw = await self.llm.complete(
            messages=messages,
            task_type="keyword_extraction",
            temperature=0.1,
            max_tokens=4096,
        )
        try:
            cleaned = raw.strip()
            if cleaned.startswith("```"):
                cleaned = cleaned.split("\n", 1)[1]
                cleaned = cleaned.rsplit("```", 1)[0]
            return json.loads(cleaned)
        except (json.JSONDecodeError, IndexError):
            logger.warning("Failed to parse resume snapshot JSON")
            return {
                "title": "",
                "target_job": "",
                "summary": "",
                "basic_info": {
                    "name": "",
                    "email": "",
                    "phone": "",
                    "city": "",
                    "linkedin_url": "",
                    "website": "",
                },
                "sections": [],
            }

    async def optimize_resume(
        self,
        resume_data: dict,
        job_description: str | None = None,
    ) -> dict:
        system_prompt = self.prompts.get_resume_optimizer_prompt()

        user_content = f"请分析以下简历并给出优化建议。\n\n简历内容：\n{json.dumps(resume_data, ensure_ascii=False, indent=2)}"
        if job_description:
            user_content += f"\n\n目标岗位JD：\n{job_description}"

        user_content += """

请严格输出以下JSON格式：
```json
{
  "overall_score": 78,
  "dimensions": {
    "skill_match": {"score": 85, "detail": "..."},
    "experience_match": {"score": 72, "detail": "..."},
    "education_match": {"score": 90, "detail": "..."},
    "keyword_coverage": {"score": 65, "detail": "..."},
    "ats_compatibility": {"score": 92, "detail": "..."}
  },
  "suggestions": [
    {
      "priority": "high",
      "type": "量化成果",
      "original": "原文",
      "improved": "优化后",
      "reason": "原因"
    }
  ],
  "keywords": {
    "covered": ["关键词1", "关键词2"],
    "missing": ["关键词3", "关键词4"]
  }
}
```"""

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content},
        ]

        raw = await self.llm.complete(
            messages=messages,
            task_type="resume_optimization",
            temperature=0.3,
            max_tokens=4096,
        )

        try:
            cleaned = raw.strip()
            if cleaned.startswith("```"):
                cleaned = cleaned.split("\n", 1)[1]
                cleaned = cleaned.rsplit("```", 1)[0]
            return json.loads(cleaned)
        except (json.JSONDecodeError, IndexError):
            logger.warning("Failed to parse optimization JSON")
            return {
                "overall_score": 0,
                "dimensions": {},
                "suggestions": [],
                "keywords": {"covered": [], "missing": []},
            }

    async def enhance_bullet(self, original: str, context: str = "") -> dict:
        messages = [
            {
                "role": "system",
                "content": "你是简历优化专家。将用户提供的简历描述优化为专业的 Bullet Point。"
                           "量化优先，动词引领，STAR结构。输出JSON: {\"original\": \"...\", \"enhanced\": \"...\", \"changes\": [\"...\"]}"
            },
            {
                "role": "user",
                "content": f"原文：{original}" + (f"\n上下文：{context}" if context else ""),
            },
        ]

        raw = await self.llm.complete(
            messages=messages, task_type="resume_generation", temperature=0.5
        )

        try:
            cleaned = raw.strip()
            if cleaned.startswith("```"):
                cleaned = cleaned.split("\n", 1)[1]
                cleaned = cleaned.rsplit("```", 1)[0]
            return json.loads(cleaned)
        except (json.JSONDecodeError, IndexError):
            return {"original": original, "enhanced": raw, "changes": []}
