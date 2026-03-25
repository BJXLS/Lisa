# Lisa - 智能简历与求职 Agent

基于 LLM 的智能求职助手，支持简历生成、简历优化、模拟面试。

## 技术栈

- **前端**: Next.js 14 + shadcn/ui + Tailwind CSS
- **后端**: Python 3.12 + FastAPI + SQLAlchemy 2.0
- **数据库**: PostgreSQL 16 + Redis 7
- **AI**: OpenAI / DeepSeek + LangChain

## 快速开始

### 1. 启动基础服务

```bash
docker compose up -d
```

### 2. 启动后端

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate       # Windows
pip install -r requirements.txt
cp .env.example .env         # 编辑 .env 配置
alembic upgrade head         # 执行数据库迁移
uvicorn app.main:app --reload
```

### 3. 启动前端

```bash
cd frontend
npm install
npm run dev
```

## 项目结构

```
Lisa/
├── backend/          # FastAPI 后端
│   ├── app/          # 应用代码
│   ├── alembic/      # 数据库迁移
│   └── tests/        # 测试
├── frontend/         # Next.js 前端
├── doc/              # 项目文档
└── docker-compose.yml
```

## Sprint 2：简历生成（已实现）

- **对话**：`POST /api/v1/chat/stream`（`conversation_type=resume_build`，可选 `resume_id`）使用简历专用 System Prompt，SSE 事件为 JSON：`{ "e":"token","t":"..." }`、`{ "e":"meta","conversation_id":"..." }`、`{ "e":"done" }`。
- **同步预览**：每轮对话结束后前端调用 `POST /api/v1/resumes/{id}/sync-conversation`，根据会话记录抽取结构化 JSON 并写入 `Resume` / `ResumeSection`。
- **模板 + PDF**：Jinja2 模板在 `backend/app/templates/resume/classic.html`，导出 `POST /api/v1/resumes/{id}/export/pdf`（WeasyPrint）。**Windows** 若 PDF 报错，需按 [WeasyPrint 文档](https://doc.courtbouillon.org/weasyprint/stable/first_steps.html) 安装 GTK 等依赖。

前端 `简历生成` 页：登录后自动创建草稿简历，对话流式展示，右侧实时预览，支持导出 PDF。

