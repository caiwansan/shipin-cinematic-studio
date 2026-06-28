# AIGC Cinematic Studio

**Runtime Version: 0.4**

AI Production Runtime OS — 具备持续执行能力的 AI 影视工业化生产平台。

## 核心能力

- Queue Runtime — BullMQ 驱动的异步任务队列
- DAG Runtime — 多图调度 + Never-Break Pipeline
- Worker Runtime — 多 Provider 自动 fallback 执行
- Persistent Pipeline — DB 为真相源的流水线状态持久化
- Director Intelligence — Showrunner → Cognition Loop → Simulation
- 角色一致性 / 场景一致性 / 镜头连续性
- 多模型适配（Kling / Veo / Wan / Hunyuan / CogVideoX / 百炼 / 火山引擎）

## 系统架构

```
UI Projection → Runtime OS → Queue → Worker → Provider Chain
                                   ↕
                              PostgreSQL (truth)
```

详细架构文档参见：
- [Runtime Architecture](docs/runtime-architecture.md) — 系统分层 + 组件职责 + 数据流
- [Execution Model](docs/execution-runtime.md) — 任务执行链路
- [Persistence Model](docs/persistence-model.md) — 状态持久化机制
- [Recovery Model](docs/recovery-model.md) — 故障恢复策略
- [Runtime Principles](docs/runtime-principles.md) — 不可破坏的运行时宪法

## 快速启动

```bash
# 后端
cd backend && npm install && npx prisma generate && npm run dev

# 前端
cd frontend && npm install && npm run dev

# Docker（可选）
docker compose up -d
```

## 目录结构

```
shipin-cinematic-studio/
├── frontend/          # Nuxt3 + Vue3 + TailwindCSS — UI Projection Layer
├── backend/           # Fastify + Prisma + PostgreSQL — Runtime OS
├── docker/            # Docker Compose 配置
├── docs/              # 系统架构文档
│   ├── runtime-architecture.md
│   ├── execution-runtime.md
│   ├── persistence-model.md
│   ├── recovery-model.md
│   └── runtime-principles.md
```

## 核心概念

本系统不是"AI 视频网页"，而是具备持续执行能力的 AI Production Runtime。核心差异：

- **状态跟着 project 生命周期，而非浏览器生命周期**
- **UI 只是 Runtime 的观察窗口（projection surface）**
- **DB 是唯一的真相源，localStorage 只是缓存**
- **系统即使没有前端也在运行**

> 这不是 README 能承载的东西。系统的存在方式定义在 `docs/runtime-principles.md` 中。
├── docs/              # 设计文档
└── README.md
```

## 开发阶段

- **Phase 1:** UI + 登录 + 工作台 + Shot Table + Prompt Engine + Mock
- **Phase 2:** Character Engine + Storyboard Engine + Scene Engine
- **Phase 3:** Video Adapter + 多镜头生成 + 连续性系统
- **Phase 4:** 自动拼接 + HLS播放 + 下载系统
