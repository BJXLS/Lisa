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

```text
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

## Sprint 3：简历优化（进行中，核心已实现）

已完成能力：

- **简历导入解析（PDF/Word/文本）**
  - 接口：`POST /api/v1/resumes/import/file`（multipart）
  - 支持：`.pdf`、`.docx`、`.txt/.md`
  - 后端会抽取文本并调用结构化提取，自动创建 `Resume` + `ResumeSection`

- **JD 输入与解析**
  - 接口：`POST /api/v1/resumes/parse-jd`
  - 输入：`{ "job_description": "..." }`
  - 输出：岗位名、技能关键词、年限/学历要求、关键词列表

- **简历优化分析引擎**
  - 接口：`POST /api/v1/resumes/{id}/optimize`
  - 输出：总分、多维度评分、优化建议、关键词覆盖/缺失

- **ATS 兼容性检测**
  - 接口：`GET /api/v1/resumes/{id}/ats-check?job_description=...`
  - 输出：ATS 评分、问题列表、改进建议

- **一键应用优化**
  - 接口：`POST /api/v1/resumes/{id}/apply-optimizations`
  - 输入：优化建议数组（含 original/improved）
  - 行为：将建议批量应用到 summary 与 sections 文本内容

- **优化应用回滚（新增）**
  - 接口：`POST /api/v1/resumes/{id}/rollback-last-optimization`
  - 行为：回滚最近一次由 AI 优化应用创建的快照

- **前端优化页联通真实后端**
  - 页面：`/resume-optimizer`
  - 流程：选择/上传简历 -> 输入 JD -> 分析 -> 展示建议和关键词/ATS -> 单条/高优/全部应用 -> 可回滚
  - 已移除该页原有 mock 展示逻辑

快速验收建议：

1. 登录后进入 `简历优化` 页面。
2. 上传一份 `pdf/docx/txt` 简历，或直接选择已有简历。
3. 粘贴一个岗位 JD，点击“开始分析”。
4. 检查是否展示：总分、建议列表、关键词覆盖/缺失、ATS 检测结果。
5. 点击“一键应用全部优化”，再次分析确认文本已更新。
6. 点击“仅应用高优建议”，确认仅高优建议被标记为已应用。
7. 点击“撤销最近一次应用”，确认 ATS 分数与内容可回退。
