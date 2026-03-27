"""Interview Agent — 面试官 Agent

负责生成面试开场白、根据对话历史生成下一个问题/追问、生成面试反馈报告。
"""

import json
import logging

from app.services.ai_engine.llm_router import LLMRouter
from app.services.ai_engine.prompt_manager import PromptManager

logger = logging.getLogger(__name__)


class InterviewAgent:
    def __init__(self):
        self.llm = LLMRouter()
        self.prompts = PromptManager()

    async def generate_opening(
        self,
        target_job: str,
        interview_type: str = "behavioral",
        difficulty: str = "medium",
        job_description: str | None = None,
    ) -> str:
        system_prompt = self.prompts.get_interviewer_prompt(
            interview_type=interview_type,
            target_job=target_job,
            difficulty=difficulty,
        )
        if job_description:
            system_prompt += f"\n\n岗位JD参考：\n{job_description[:2000]}"

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": "面试开始，请以面试官身份开场并提出第一个问题。"},
        ]

        return await self.llm.complete(
            messages=messages,
            task_type="interview_dialogue",
            temperature=0.8,
        )

    async def generate_response(
        self,
        history: list[dict],
        target_job: str,
        interview_type: str = "behavioral",
        difficulty: str = "medium",
        job_description: str | None = None,
    ) -> str:
        system_prompt = self.prompts.get_interviewer_prompt(
            interview_type=interview_type,
            target_job=target_job,
            difficulty=difficulty,
        )
        if job_description:
            system_prompt += f"\n\n岗位JD参考：\n{job_description[:2000]}"

        role_map = {"interviewer": "assistant", "candidate": "user", "system": "system"}
        messages = [{"role": "system", "content": system_prompt}]
        for msg in history:
            mapped_role = role_map.get(msg["role"], "user")
            messages.append({"role": mapped_role, "content": msg["content"]})

        return await self.llm.complete(
            messages=messages,
            task_type="interview_dialogue",
            temperature=0.8,
        )

    async def generate_feedback(
        self,
        history: list[dict],
        target_job: str,
        interview_type: str = "behavioral",
    ) -> dict:
        feedback_prompt = self.prompts.get_feedback_prompt()

        transcript = "\n".join(
            f"{'面试官' if m['role'] == 'interviewer' else '候选人'}: {m['content']}"
            for m in history
        )

        messages = [
            {"role": "system", "content": feedback_prompt},
            {
                "role": "user",
                "content": f"目标岗位：{target_job}\n面试类型：{interview_type}\n\n面试记录：\n{transcript}",
            },
        ]

        raw = await self.llm.complete(
            messages=messages,
            task_type="interview_feedback",
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
            logger.warning("Failed to parse feedback JSON, returning default structure")
            return {
                "overall_score": 0,
                "content_score": 0,
                "structure_score": 0,
                "expression_score": 0,
                "professional_score": 0,
                "communication_score": 0,
                "summary": raw[:500],
                "strengths": [],
                "improvements": [],
                "question_feedbacks": [],
                "suggestions": [],
                "recommended_topics": [],
            }
