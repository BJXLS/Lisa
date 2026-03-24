"""LLM Router — 分层模型路由

根据任务类型自动选择最合适的模型：
- 重度任务（简历生成、面试对话、反馈评估） → 强模型 (GPT-4o / DeepSeek-Chat)
- 轻度任务（关键词提取、格式检查）         → 轻量模型 (GPT-4o-mini / DeepSeek)
"""

from collections.abc import AsyncGenerator

from openai import AsyncOpenAI

from app.config import settings

TASK_MODEL_MAP: dict[str, str] = {
    "resume_generation": "heavy",
    "resume_optimization": "heavy",
    "interview_dialogue": "heavy",
    "interview_feedback": "heavy",
    "career_advice": "heavy",
    "keyword_extraction": "light",
    "ats_check": "light",
    "general": "heavy",
}


class LLMRouter:
    def __init__(self):
        self._providers: dict[str, dict] = {}
        self._setup_providers()

    def _setup_providers(self):
        if settings.OPENAI_API_KEY:
            self._providers["openai"] = {
                "client": AsyncOpenAI(
                    api_key=settings.OPENAI_API_KEY,
                    base_url=settings.OPENAI_BASE_URL,
                ),
                "heavy_model": settings.OPENAI_MODEL,
                "light_model": "gpt-4o-mini",
            }
        if settings.DEEPSEEK_API_KEY:
            self._providers["deepseek"] = {
                "client": AsyncOpenAI(
                    api_key=settings.DEEPSEEK_API_KEY,
                    base_url=settings.DEEPSEEK_BASE_URL,
                ),
                "heavy_model": settings.DEEPSEEK_MODEL,
                "light_model": settings.DEEPSEEK_MODEL,
            }

    def _get_provider(self) -> dict:
        provider_name = settings.DEFAULT_LLM_PROVIDER
        if provider_name in self._providers:
            return self._providers[provider_name]
        for p in self._providers.values():
            return p
        raise RuntimeError("未配置任何 LLM provider，请检查 .env 中的 API Key 配置")

    def get_model_for_task(self, task_type: str) -> str:
        provider = self._get_provider()
        weight = TASK_MODEL_MAP.get(task_type, "heavy")
        return provider["heavy_model"] if weight == "heavy" else provider["light_model"]

    async def complete(
        self,
        messages: list[dict],
        task_type: str = "general",
        temperature: float = 0.7,
        max_tokens: int = 4096,
    ) -> str:
        provider = self._get_provider()
        model = self.get_model_for_task(task_type)

        response = await provider["client"].chat.completions.create(
            model=model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
        )
        return response.choices[0].message.content or ""

    async def stream(
        self,
        messages: list[dict],
        task_type: str = "general",
        temperature: float = 0.7,
        max_tokens: int = 4096,
    ) -> AsyncGenerator[str, None]:
        provider = self._get_provider()
        model = self.get_model_for_task(task_type)

        response = await provider["client"].chat.completions.create(
            model=model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            stream=True,
        )
        async for chunk in response:
            delta = chunk.choices[0].delta.content
            if delta:
                yield delta
