# V4.1 Dependency Rules（DR）

> **文档版本**: v1.0  
> **基线日期**: 2026-07-19  
> **状态**: V4.1 Architecture Freeze 核心交付物  
> **目的**: 定义昆仑镜平台允许和禁止的依赖关系

---

## 1. 层定义

```
Workspace → 业务工作台
Core      → 平台能力层（SDK + Service + Engine）
Admin     → 统一后台
kmki-ui   → 共享 UI 组件库
Database  → 数据持久化层
Infra     → 基础设施（队列、配置、安全）
```

---

## 2. 允许的依赖（✅）

| 依赖方向 | 说明 | 强制规则 |
|---------|------|---------|
| **Workspace → Core SDK** | 工作台通过 `@studio/platform` 使用平台能力 | 必须通过 SDK 接口 |
| **Workspace → Core Service** | 工作台调用平台服务 API | 通过 WorkspaceAdapter |
| **Workspace → Database** | 工作台读取数据 | 必须通过 Repository 模式 |
| **Workspace → kmki-ui** | 工作台使用共享 UI 组件 | 允许 |
| **Workspace → WorkspaceAdapter** | 工作台实现适配器 | 强制要求 |
| **Core SDK → 无外部依赖** | SDK 是纯 TypeScript 库 | 必须保持纯净 |
| **Core Service → Database** | 平台服务操作数据 | 必须通过 Repository 模式 |
| **Core Service → Core SDK** | 平台服务使用 SDK 类型定义 | 允许 |
| **Core Service → Core Service** | 平台服务间调用 | 需经过 CapabilityOrchestrator |
| **Core Service → Infrastructure** | 平台服务使用队列、配置等 | 通过抽象接口 |
| **Admin → Core Service** | 管理后台调用平台服务 | 允许 |
| **Admin → Database** | 管理后台直接读取管理数据 | 允许（Admin 特权） |
| **Admin → kmki-ui** | 管理后台使用共享 UI | 允许 |
| **kmki-ui → 无业务依赖** | UI 组件库不能有业务依赖 | **强制规则** |
| **Infrastructure → Database** | 基础设施组件访问数据库 | 允许 |
| **Database → 无依赖** | 数据库层不依赖上层 | — |

---

## 3. 禁止的依赖（❌）

| 依赖方向 | 严重度 | 原因 | 违规示例 |
|---------|--------|------|---------|
| **Workspace → Workspace** | 🔴 致命 | 工作台应通过平台能力互操作，不直接耦合 | `import { something } from '@/workspace/novel/'` |
| **Core → Workspace** | 🔴 致命 | 平台能力不能依赖工作台业务逻辑 | `import { GeoService } from '@/services/geo/'` |
| **Runtime → Workspace** | 🔴 致命 | 运行时是平台层，不能感知具体工作台 | `if (workspaceType === 'geo')` 条件分支 |
| **kmki-ui → Core Service** | 🔴 致命 | UI 组件库不应直接调用业务服务 | `callApi('/api/project/')` |
| **kmki-ui → Database** | 🔴 致命 | UI 层不应直接操作数据 | 直接 Prisma import |
| **Workspace → 直接 Prisma** | 🔴 致命 | 绕过 Repository 模式 | `import { PrismaClient }` |
| **Workspace → 裸 HTTP** | 🔴 致命 | 未经过统一 API Client | `fetch('/api/xxx')` |
| **Database → Workspace** | 🔴 致命 | 数据库层不能反向依赖 | 触发器/视图引用工作台代码 |
| **Core SDK → Database** | 🔴 致命 | SDK 层不应有数据库依赖 | SDK 代码中使用 Prisma |
| **Core SDK → Workspace** | 🔴 致命 | SDK 不能依赖工作台 | import 工作台类型 |

---

## 4. 灰度依赖（⚠️）

| 依赖方向 | 说明 | 使用条件 |
|---------|------|---------|
| **Core Service → Self（循环依赖）** | 服务间循环引用 | 极少情况允许，需架构评审 |
| **Admin → Workspace** | Admin 管理功能需展示工作台数据 | 通过 Workspace API，不直接 import 代码 |
| **Workspace → Admin** | 工作台跳转到 Admin 页面 | 仅前端导航，无代码耦合 |
| **Core Service → 外部 API** | 调用外部 AI Provider API | 必须通过 Provider 抽象层 |

---

## 5. 依赖合规验证

### 5.1 CI 检查规则（architecture-linter.sh）

```bash
# 规则 R1: Workspace 独立 Runtime — 每个 workspace 不能有自己的 Runtime
# 规则 R2: Workspace 直接 HTTP 调用 — 检查裸 fetch/axios
# 规则 R3: Workspace 直接 prisma import — 检查 import prisma
# 规则 R4: 遗留命名模式 — 检查 Brand* 命名
# 规则 R5: 每个 workspace 有 Adapter — 检查 adapter file
# 规则 R6: Workspace Runtime 类数 — 限制 Runtime 实现
# 规则 R7: SDK Import 合规 — 检查 @studio/platform import
# 规则 R8: API 响应格式合规 — 检查 ApiResponse 使用
```

### 5.2 PR 审查清单

每次 PR 必须检查：

- [ ] 新增 import 是否违反层级限制？
- [ ] 新增路由是否放入正确命名空间？
- [ ] 新增组件是否放入正确目录？
- [ ] 新增数据操作是否通过 Repository？
- [ ] 新增 API 是否使用 ApiResponse 格式？
- [ ] 新增 UI 组件是否考虑 kmki-ui 复用？
- [ ] 是否影响了其他工作台？

---

## 6. 当前违规审计（2026-07-19）

基于审计扫描发现的已知违规：

| # | 违规 | 位置 | 风险 | 行动计划 |
|---|------|------|------|---------|
| 1 | brand-geo 使用裸 fetch | `frontend/studio-v2/workspace/brand-geo/services/` | 🟡 中 | 重构为 API Client（C1 扫描发现） |
| 2 | brand-geo 独立 Runtime (280 行) | `frontend/studio-v2/workspace/brand-geo/composables/` | 🟡 中 | 逻辑迁移到 GEOWorkspaceAdapter |
| 3 | brand-geo 后端依赖 | `backend/src/services/geo/` | 🟢 低 | 独立 services 属于 Workspace 自身，可接受 |
| 4 | Admin 后端与 Workspace 路由混在一起 | `backend/src/index.ts` — 普通 route 与 admin route 顺序注册 | 🟡 中 | 建议按层级分组 |
| 5 | EventBus 为 stub | `packages/studio-platform/src/event/` | 🟠 高 | 需要实现完整 EventBus |
| 6 | Legacy brand-geo 独立 Store | `frontend/studio-v2/workspace/brand-geo/stores/` | 🟢 低 | 已标记 DEPRECATED |

---

> **文档历史**
> | 版本 | 日期 | 变更 |
> |------|------|------|
> | v1.0 | 2026-07-19 | 初次建立 — V4.1 Architecture Freeze |
