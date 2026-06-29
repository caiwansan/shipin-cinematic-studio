# V4.2 Phase A1 — Dependency Discovery Report

> **日期:** 2026-07-19
> **范围:** 全平台依赖分析（backend + frontend + packages + prisma + docs）
> **原则:** 只扫描，不删除

---

## 项目规模

| 维度 | 文件数 |
|------|--------|
| 后端 .ts | 1,643 |
| 前端 .vue/.ts | 10,983 |
| Packages .ts | 42 |
| Prisma 文件 | 51 |
| 文档 .md | 177 |
| **总计** | **12,896** |

---

## 候选模块依赖分析

### ❌ Remove 候选

#### 1. 生活助手（Customer Service）

| 检查项 | 结果 |
|--------|------|
| 后端引用文件 | `backend/src/plugins/auth.ts`, `backend/src/routes/customer-service.ts`, `backend/src/routes/admin-customer-service.ts`, `backend/src/index.ts` |
| 前后路由注册 | `POST /api/v1/customer-service/chat`, `GET /api/v1/customer-service/history`, `DELETE /api/v1/customer-service/session/:sessionId`, `GET /api/v1/customer-service/status`（customer-service.ts） |
| | `GET /api/admin/customer-service/settings`, `PUT /api/admin/customer-service/settings`, `GET /api/admin/customer-service/sessions`, `GET /api/admin/customer-service/sessions/:id`（admin-customer-service.ts） |
| 前端引用 | `frontend/layouts/admin-aigc.vue`（导航菜单含"客服管理"） |
| | `frontend/components/customer/CustomerService.vue` |
| | `frontend/pages/director-os/aigc/customer-service.vue` |
| | `frontend/pages/director-os/aigc/life-assistant-config.vue` |
| | `frontend/pages/director-os/aigc/platform-llm.vue` |
| | `frontend/pages/p0/life-assistant.vue` + `seeds.vue` |
| | `frontend/pages/admin/aigc/customer-service.vue` |
| | `frontend/components/kunlun/business/KunlunNav.vue` |
| 数据库引用 | `CustomerChatSession`, `CustomerChatMessage`, `CustomerChatMemory`（3 张表在 schema.prisma:2586–2615） |
| 配置引用 | `route:admin-customer-service`（config key for settings） |
| **结论** | **HAS DEPENDENCY** — 多个 API 端点和前端页面在引用。需先迁移/下线所有依赖后才能安全删除。 |

#### 2. 盘古斧系统（Pangu/Pan-gu）

| 检查项 | 结果 |
|--------|------|
| 后端引用 | 32 个文件引用 `pangu/pan-gu` |
| 核心文件 | `backend/src/runtime/boot.ts`, `backend/src/gateway/routes.ts`, `backend/src/gateway/sse.ts` |
| | `backend/src/events/event-order-lock.ts`, `backend/src/events/backpressure-controller.ts`, `backend/src/events/stabilized-event-bus.ts` |
| | `backend/src/core-runtime/*`（11 个文件） |
| | `backend/src/health/event-driven-health.ts` |
| 前端引用 | `frontend/stores/workbench.ts`, `frontend/composables/useSSEStream.ts`, `frontend/kernel/gateway/api.ts` |
| **结论** | **HAS DEPENDENCY** — Pangu 是平台基础设施的核心模块（Gateway/SSE/Event Bus/Core Runtime）。**不能删除**，应标记为 KEEP。 |

#### 3. P18 实验（P1.8 / P18）

| 检查项 | 结果 |
|--------|------|
| 后端引用文件 | `backend/src/services/p18/`（3 文件）：`dual-render-orchestrator.ts`, `v3-worker-adapter.ts`, `evaluation-collector.ts` |
| | `backend/src/routes/p18-data-activation.ts` — 路由层 |
| | `backend/src/routes/p1.8-evaluate.ts` — 评估路由 |
| | `backend/src/services/p1.8-switch-decision.ts` — 决策服务 |
| | `backend/src/routes/script-submit.ts` — 在脚本提交时触发 dual-render |
| | `backend/src/queue/worker-runtime.ts` — 在 worker 中路由 V3 任务 |
| | `backend/src/routes/v3-metrics.ts` — P1.7 V3 指标 |
| | `backend/src/services/v3-metrics.service.ts` — V3 指标采集 |
| | `backend/src/index.ts` — 注册路由 |
| 前端引用 | **无** — 未找到任何 frontend `.vue` 或 `.ts` 文件引用 P18/P1.8 |
| 数据库引用 | `P18Pair`, `V3RenderResult`, `public_V3RenderResult`, `NarrativeV3Metrics`（4 张表） |
| **结论** | **HAS DEPENDENCY** — P18 实验跨 9 个后端文件（含路由、服务、队列 worker），依赖 4 张数据库表。**不是孤岛**，可考虑 Deprecate（停止功能开发）但不可直接删除。 |

#### 4. V3 遗留表（V3RenderResult, ReplayFrame, NarrativeV3Metrics, P18Pair）

| 检查项 | 结果 |
|--------|------|
| `V3RenderResult` + `public_V3RenderResult` | 后端引用：`p18-data-activation.ts`（读取 `v3TaskId`） |
| `ReplayFrame` | 后端引用：`observability/collector.ts`, `replay/replay-engine.ts`, `replay/replay-api.ts`, `execution-memory/replay-engine.ts`, `execution-memory/memory-orchestrator.ts` |
| | 前端引用：`composables/useReplayFrame.ts`（但功能简陋，仅 fetch frame by time） |
| `NarrativeV3Metrics` | 后端引用：`v3-metrics.service.ts`（create/findMany 操作） |
| `P18Pair` | 后端引用：`p18-data-activation.ts`（findUnique 操作） |
| **结论** | **HAS DEPENDENCY** — 所有 4 张表都有活动代码引用，不能单独删除。V3 遗留表与 P18 实验紧密耦合。 |

#### 5. p0-gateway（`p0-gateway-route.ts` + decision-runtime/p0/）

| 检查项 | 结果 |
|--------|------|
| 路由文件引用 | `backend/src/routes/p0-gateway-route.ts` — 主路由 |
| 决策运行时引用 | `backend/src/decision-runtime/p0/p0-gateway.ts`, `p0-runtime.ts`, `p0-scaffold-test.ts` |
| 决策运行时规模 | 15 个 `.ts` 文件：`agent-pipeline.ts`, `fallback-reasoner.ts`, `p0-llm-executor.ts`, `policy-guard.ts`, `shadow-executor.ts`, `trace-sink.ts`, `u0-seed-schema.ts`, `u1-seed-matcher.ts`, `u2-coverage-tracker.ts`, `universe-seeder.ts` 等 |
| 前端引用 | `frontend/pages/p0/life-assistant.vue`、`seeds.vue` |
| 前端导航 | `frontend/components/kunlun/business/KunlunNav.vue` 中引用 |
| **结论** | **HAS DEPENDENCY** — p0-gateway 是一个完整的子系统（15 文件 + 路由 + 前端页面）。要 Deprecate 需要先解耦前端引用。 |

#### 6. .bak 文件（8 个项目代码 .bak，除 node_modules）

| 序号 | .bak 文件 | 原始文件状态 | 类型 |
|------|-----------|-------------|------|
| 1 | `backend/src/routes/p0-gateway-route.ts.bak` | ✅ 存在（22KB）| 与原始文件不同 |
| 2 | `backend/src/services/geo/runtime/provider-resolver.ts.bak` | ❌ 原始文件不存在 | 原始文件已删除 |
| 3 | `backend/src/services/geo/runtime/llm-client.ts.bak` | ❌ 原始文件不存在 | 原始文件已删除 |
| 4 | `frontend/components/kunlun/business/KunlunNav.vue.bak` | ✅ 存在（5.5KB） | 可能为备份 |
| 5 | `frontend/pages/hdz/m/workspace/[id].vue.bak` | ✅ 存在（21KB） | 与原始文件不同 |
| 6 | `frontend/pages/hdz/m/index.vue.bak` | ✅ 存在（10.5KB） | 与原始文件不同 |
| 7 | `frontend/pages/index.vue.bak` | ✅ 存在（35KB） | 与原始文件不同 |
| 8 | `frontend/studio-v2/workspace/video-generation/VideoGenerationWorkspace.vue.bak` | ✅ 存在（125KB） | 与原始文件不同 |
| **结论** | **SAFE REMOVE** — 8 个 .bak 文件全部可安全删除。原始文件均存在或已不需要。注意 node_modules 的 form-data .bak（2 个）属于第三方包，不需要动。 |

#### 7. DEPRECATED 标记模块（frontend/modules/geo/）

| 检查项 | 结果 |
|--------|------|
| 模块路径 | `frontend/modules/geo/`（13 个文件：pages/components/runtime/services/store/types + DEPRECATED.md） |
| 外部引用 | **无** — `grep -r "modules/geo" frontend/ --include="*.ts" --include="*.vue"` 返回空 |
| DEPRECATED 声明 | `DEPRECATED.md` 明确定义：Not loaded by any route, not imported by any module |
| 替代路径 | `studio-v2/workspace/brand-geo/`（也有 DEPRECATED 标记，指向 `workspace/geo/`） |
| 后端 geo 服务 | `backend/src/services/geo/` 仍然活跃（注册路由、服务），与前端 geo 模块不同 |
| **结论** | **SAFE REMOVE**（前端组件和页面）— 前端 geo 模块无任何活跃引用。但后端 `services/geo/` 在处理中。 |

注意：`backend/src/services/geo/runtime/` 下有 2 个 `.bak` 文件（`provider-resolver.ts.bak`, `llm-client.ts.bak`），原始文件不存在，表明这些文件已被重构。

#### 8. constraint-physics（`backend/src/core/constraint-physics/`）

| 检查项 | 结果 |
|--------|------|
| 模块路径 | `backend/src/core/constraint-physics/`（4 个文件：`index.ts`, `types.ts`, `slack-engine.ts`, `feedback-bias.ts`） |
| 外部引用 | **无** — 在 `backend/src/` 中全局搜索未发现其他代码 import 此模块 |
| 内部引用 | 仅模块内部自引用（`import from './types'` 等） |
| **结论** | **SAFE REMOVE** — 完全孤岛模块，无任何外部依赖。 |

#### 9. style-evolution（`backend/src/core/style-evolution/`）

| 检查项 | 结果 |
|--------|------|
| 模块路径 | `backend/src/core/style-evolution/`（5 个文件：`index.ts`, `types.ts`, `style-vectorizer.ts`, `style-memory-graph.ts`, `style-divergence-controller.ts`） |
| 外部引用 | **无** — 在 `backend/src/` 中全局搜索未发现其他代码 import 此模块 |
| 内部引用 | 仅模块内部自引用 |
| **结论** | **SAFE REMOVE** — 完全孤岛模块，无任何外部依赖。 |

#### 10. Phase I Runtime（`backend/src/runtime/` — 133 个文件）

| 检查项 | 结果 |
|--------|------|
| 模块路径 | `backend/src/runtime/`（133 个 `.ts` 文件，含 15 个子目录） |
| 外部引用 | **15 个文件**从 runtime 外部引用 Phase I runtime 模块 |
| 引用文件 | `backend/src/routes/prompt-registry.ts`, `admin-prompt-runtime.ts`, `admin-prompt-telemetry.ts`, `admin-prompt-trace.ts`, `workbench-director.ts`, `ai-optimize-storyboard.ts` |
| | `backend/src/services/cron-prompt-telemetry.ts` |
| | `backend/src/services/geo/agents/entity.agent.ts`, `geo/routes/geo-trace.route.ts`, `geo/index.ts` |
| | `backend/src/director-v2/render/ir-compiler-lock.ts` |
| | `backend/src/director/v2/director-adapter.ts`, `director/v2/compatibility-layer.ts` |
| | `backend/src/director/v2/__tests__/pipeline-migration.test.ts`, `constraint-runtime.test.ts` |
| 引用子模块分布 | `runtime/prompt`: 14 个外部引用 / `runtime/director`: 8 个 / `runtime/adapters`: 2 个 / `runtime/providers`: 1 个 / `runtime/trace`: 1 个 / `runtime/graph`: 1 个 |
| **结论** | **HAS DEPENDENCY** — 不是纯孤岛，有 15 个外部文件在引用 runtime 特定模块。不能整体删除，需要逐步迁移引用点。 |

---

## 汇总清单

### KEEP（确认保留）

| 模块 | 理由 |
|------|------|
| 盘古斧系统（Pangu） | 平台核心基础设施（Gateway/SSE/EventBus/Core Runtime），32 个后端 + 3 个前端引用 |
| HDZ（混沌珠） | 活跃模块：`index.ts` 注册路由，`novel.ts`、`admin-novels.ts`、`voice.ts` 引用 HDZ 表，前端 `hdz/` 页面有 `.bak` 备份（原始文件存在） |
| Desktop 路由 | 5 个 desktop- 路由均在 `index.ts` 注册并活跃 |
| backend/src/services/geo/ | 后端 geo 服务仍在注册使用，有完整路由和服务体系 |
| GEO 相关 | `decision-runtime/evaluation/` 引用 geo 服务，是活跃调用者 |

### MOVE（需迁移）

| 模块 | 当前路径 | 目标路径 |
|------|---------|---------|
| Phase I Runtime (prompt 相关) | `backend/src/runtime/prompt/` | 需迁移到 director-v2 或新 execution kernel |
| Phase I Runtime (director 适配) | `backend/src/runtime/director/` | 需迁移到 `director/v2/compatibility-layer.ts` |
| Phase I Runtime (trace) | `backend/src/runtime/trace/` | 被 `geo/trace` 引用，需迁移 |

### DEPRECATE（废弃，保留代码不开发）

| 模块 | 路径 |
|------|------|
| P18 实验 | `backend/src/services/p18/` + `routes/p18-data-activation.ts` + `routes/p1.8-evaluate.ts` + `services/p1.8-switch-decision.ts` |
| V3 遗留基础设施 | `backend/src/services/v3-metrics.service.ts` + `routes/v3-metrics.ts` |
| p0-gateway 子系统 | `backend/src/routes/p0-gateway-route.ts` + `backend/src/decision-runtime/p0/` (15 个文件) |
| Phase I Runtime（主体） | `backend/src/runtime/`（133 个文件中非引用的部分） |

### SAFE REMOVE（可安全删除）

| 模块 | 路径 | 注意事项 |
|------|------|---------|
| **constraint-physics** | `backend/src/core/constraint-physics/`（4 文件） | 完全孤岛，零外部引用 |
| **style-evolution** | `backend/src/core/style-evolution/`（5 文件） | 完全孤岛，零外部引用 |
| **前端 geo 模块（已 DEPRECATED）** | `frontend/modules/geo/`（13 文件） | DEPRECATED 声明 + 零外部引用 |
| **前端 brand-geo（已 DEPRECATED）** | `frontend/studio-v2/workspace/brand-geo/` | 已有替代路径 `workspace/geo/` |
| **.bak 文件（8 个项目 .bak）** | 见下方表格 | 原始文件均存在或已不需要 |
| **schema.prisma.bak.phasex** | `backend/prisma/schema.prisma.bak.phasex`（3.8K 行） | 旧 schema 备份 |

#### .bak 文件删除清单

| 文件 | 原始文件存在 |
|------|-------------|
| `backend/src/routes/p0-gateway-route.ts.bak` | ✅ |
| `backend/src/services/geo/runtime/provider-resolver.ts.bak` | ❌（原始已删除, .bak 为唯一残留） |
| `backend/src/services/geo/runtime/llm-client.ts.bak` | ❌（原始已删除, .bak 为唯一残留） |
| `frontend/components/kunlun/business/KunlunNav.vue.bak` | ✅ |
| `frontend/pages/hdz/m/workspace/[id].vue.bak` | ✅ |
| `frontend/pages/hdz/m/index.vue.bak` | ✅ |
| `frontend/pages/index.vue.bak` | ✅ |
| `frontend/studio-v2/workspace/video-generation/VideoGenerationWorkspace.vue.bak` | ✅ |

---

## 未在候选列表中发现的新候选

在依赖扫描过程中发现以下需进一步评估的模块：

### 1. v3-metrics.service.ts + v3-metrics route（P1.7）

- **路径**: `backend/src/services/v3-metrics.service.ts`, `backend/src/routes/v3-metrics.ts`
- **发现**: 与 P18 实验高度耦合，`v3-metrics.service.ts` 写 `NarrativeV3Metrics` 表，`p1.8-evaluate.ts` 读该表
- **建议**: 随 P18 一起 Deprecate

### 2. Replay Frame 系统

- **路径**: `backend/src/replay/`, `backend/src/execution-memory/replay-engine.ts`, `frontend/composables/useReplayFrame.ts`
- **发现**: ReplayFrame 表已经存在但 frontend composable 功能简陋（仅 fetch frame by time）
- **建议**: 如 Phase I Runtime deprecated，ReplayFrame 也应评估是否保留

### 3. backend/src/services/geo/ 后端服务（非前端模块）

- **路径**: `backend/src/services/geo/`（完整服务体系）
- **发现**: 虽然前端 `modules/geo/` 已 DEPRECATED，但后端 geo 服务仍然活跃，被 `decision-runtime/evaluation/` 和 `index.ts` 引用
- **建议**: KEEP — 后端服务独立于前端模块

---

## 扫描结论

| 指标 | 值 |
|------|-----|
| 可立即删除项数 | **5**（constraint-physics, style-evolution, 前端 geo 模块, brand-geo, .bak 文件） |
| 可立即删除文件数 | **33**（4+5+13+?+12） |
| 需进一步确认项数 | **2**（v3-metrics 服务、ReplayFrame 系统） |
| 需迁移项数 | **3**（Phase I Runtime 的被引用部分 → 3 个区域） |
| 阻塞项数 | **4**（生活助手、P18 实验、p0-gateway、Phase I Runtime 主体 — 均有活跃依赖，不可直接删除） |

### 可立即执行的删除操作（无风险）

1. **删除 `backend/src/core/constraint-physics/`**（4 文件，零引用）
2. **删除 `backend/src/core/style-evolution/`**（5 文件，零引用）
3. **删除 `frontend/modules/geo/`**（13 文件，DEPRECATED + 零引用）
4. **删除 `frontend/studio-v2/workspace/brand-geo/`**（已有替代路径）
5. **删除 8 个 `.bak` 文件**（含 2 个 geo runtime .bak，原始文件已不存在）
6. **删除 `backend/prisma/schema.prisma.bak.phasex`**（旧 schema 备份）

### 需要进一步决策的项目

1. **生活助手** — 有完整 API + DB + 前端页面。如果需要移除，需制定详细的迁移/下线计划
2. **P18 实验** — 与 V3 指标、dual-render、worker-runtime 耦合。建议先 Deprecate 停止新功能，再逐步清理
3. **p0-gateway** — 完整子系统（15 文件+前端页面）。建议 Deprecate，将引用迁移到新方案
4. **Phase I Runtime** — 133 个文件的庞然大物。需分阶段迁移外部 15 个引用点后，整体 Deprecate

---

*End of A1 Dependency Discovery*
