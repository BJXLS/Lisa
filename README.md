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

## 文档

详见 [doc/00-文档索引.md](doc/00-文档索引.md)
