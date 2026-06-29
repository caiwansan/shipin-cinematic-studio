# C1 平台仓库审计报告

> **审计时间**: 2026-07-19
> **审计范围**: 昆仑镜 V4 平台基础架构 + GEO Pilot 可复用性分析
> **审计人**: C1 实施团队

---

## 一、基线文档审计结论

| 基线文档 | 版本 | 状态 | 关键发现 |
|---------|------|------|----------|
| MANIFESTO.md | v1.0 | ✅ 基线冻结 | 8 条架构规则 + 禁止/允许清单完整 |
| PLATFORM-SDK.md | v1.0 | ✅ 基线冻结 | `@studio/platform` 命名空间定义完整，禁止绕过规范明确 |
| DATA-SPEC.md | v1.0 | ✅ 基线冻结 | 单一 Project 表 + Repository 模式定义完整 |
| API-SPEC.md | v1.0 | ✅ 基线冻结 | ApiResponse 统一格式、分页规范、错误类型完整 |
| RUNTIME-SPEC.md | v1.0 | ✅ 基线冻结 | 四种运行时类型定义 + Workspace 禁止清单完整 |
| WORKSPACE-SPEC.md | v1.0 | ✅ 基线冻结 | 目录结构 + WorkspaceAdapter 接口 + 能做/不能做清单完整 |
| CAPABILITY-SPEC.md | v1.0 | ✅ 基线冻结 | 四层能力架构 + Provider 透明性 + Model 层定义完整 |
| EVENT-SPEC.md | v1.0 | ✅ 基线冻结 | EventBus 接口 + Event/Command/Query 分离完整 |
| STATE-SPEC.md | v1.0 | ✅ 基线冻结 | 五种状态类型 + 事件派生状态原则完整 |
| GOVERNANCE-SPEC.md | v1.0 | ✅ 基线冻结 | RFC/ADR/废弃/违规处理流程 + 15 项 PR 审查清单完整 |

**结论**: 所有 10 份基线文档均已冻结，可以直接作为 C1 实施依据。

---

## 二、现有代码可复用性审计

### 2.1 可直接复用（as-is）

| 文件 | 位置 | 说明 |
|------|------|------|
| `workspace-adapter.ts` | `packages/studio-platform/src/workspace/` | ✅ C0.5 已创建，WorkspaceType/WorkspaceAdapter/Route/Menu/Capability/AssetType/CommandDefinition 接口均完整 |
| `auth.ts` (Fastify Plugin) | `backend/src/plugins/` | ✅ JWT 验证 + 单设备登录检查 + 会员等级检查逻辑可封装为平台 AuthService |
| `BrandGEOWorkspace.vue` | `frontend/studio-v2/workspace/brand-geo/` | ✅ GEO 主要 UI 组件，迁移到 workspace/geo/pages/ 后可直接使用 |
| `brand-geo/components/` | `frontend/studio-v2/workspace/brand-geo/components/` | ✅ GEO 业务组件可迁移到 workspace/geo/components/ |
| `brand-geo/services/` | `frontend/studio-v2/workspace/brand-geo/services/` | ✅ 业务逻辑可迁移，但需移除直接 fetch/axios 调用 |
| `architecture-linter.sh` | `scripts/` | ✅ C0.5 已创建，8 条规则 + 4 项 ADR 验证完整 |

### 2.2 需要重构后复用（refactor needed）

| 文件 | 位置 | 需要重构的内容 |
|------|------|---------------|
| `backend/src/plugins/auth.ts` | `backend/src/plugins/` | 🔄 从 Fastify Plugin 解耦为通用 AuthService，提取 JWT 验证逻辑 + membership 检查 |
| `backend/src/index.ts` | `backend/src/` | 🔄 路由注册需迁移到 ApiResponse 格式，现有 39 个路由文件需逐步适配 |
| `brand-geo/stores/useBrandGeoStore.ts` | `frontend/studio-v2/workspace/brand-geo/stores/` | 🔄 重命名为 useGeoStore，移除领域数据持久化，只保留 UI 状态编排 |
| `brand-geo/composables/useBrandGEORuntime.ts` | `frontend/studio-v2/workspace/brand-geo/composables/` | 🔄 独立 Runtime (280 行)，逻辑迁移到 GEOWorkspaceAdapter + PlatformSDK |
| `backend/prisma/schema.prisma` | `backend/prisma/` | 🔄 16.9 万行 schema，需确认 Geo* 模型已全部映射为 Knowledge* 模型 |

### 2.3 需要从零创建（new）

| 模块 | 原因 |
|------|------|
| `auth/auth-service.ts` | 需要从 Fastify Plugin 提取为通用平台 AuthService |
| `project/project-service.ts` | 统一 Project 模型 + CRUD 操作，当前不存在 |
| `api/types.ts` | ApiResponse 类型定义需要创建为平台核心类型 |
| `repository/base-repository.ts` | 需要创建 BaseRepository 基类 + ORMAdapter 接口 |
| `workspace/workspace-registry.ts` | Workspace 注册中心，当前不存在 |
| `capability/capability-runtime.ts` | 能力运行时接口 shim |
| `runtime/platform-runtime.ts` | 平台运行时接口 shim |
| `event/event-bus.ts` | 事件总线接口 stub |
| `state/state-runtime.ts` | 状态运行时接口 stub |
| `workspace/geo/adapter/adapter.ts` | GEO WorkspaceAdapter 实现 |
| `workspace/geo/services/geo-project-service.ts` | GEO 项目服务（包装 ProjectService） |
| `workspace/geo/stores/useGeoStore.ts` | GEO UI 状态 store |

---

## 三、依赖关系图（构建顺序）

```
Layer 0 (基础类型):
  api/types.ts ─── 无依赖（最底层）
  
Layer 1 (核心接口):
  auth/auth-service.ts ─── 依赖 api/types.ts
  project/project-service.ts ─── 依赖 api/types.ts
  repository/base-repository.ts ─── 依赖 api/types.ts
  workspace/workspace-adapter.ts ─── 无依赖（已存在）
  capability/capability-runtime.ts ─── 依赖 api/types.ts
  runtime/platform-runtime.ts ─── 依赖 workspace/workspace-adapter.ts
  event/event-bus.ts ─── 无依赖
  state/state-runtime.ts ─── 无依赖

Layer 2 (组合层):
  workspace/workspace-registry.ts ─── 依赖 workspace/workspace-adapter.ts
  index.ts (barrel export) ─── 依赖所有子模块

Layer 3 (GEO Pilot):
  workspace/geo/types/index.ts ─── 依赖 @studio/platform 类型
  workspace/geo/adapter/adapter.ts ─── 依赖 workspace-adapter.ts, project-service
  workspace/geo/services/geo-project-service.ts ─── 依赖 project-service, api/types
  workspace/geo/stores/useGeoStore.ts ─── 依赖 state-runtime (stub)
  
Layer 4 (文档):
  docs/plans/GEO-ROUTE-MIGRATION.md ─── 依赖 Layer 0-3 完成
  docs/reviews/C1-COMPLIANCE-REPORT.md ─── 依赖所有完成
```

---

## 四、当前违规状态摘要

| 违规项 | 严重程度 | 当前状态 | C1 处理 |
|-------|---------|---------|---------|
| brand-geo/ 目录名 | 🟡 Major | 存在 | C1 创建 workspace/geo/，C4 删除旧目录 |
| useBrandGEORuntime.ts | 🔴 Critical | 存在 | C1 创建 Adapter 替代，C2 删除 |
| brand-geo 后端路由 404 | 🔴 Critical | 待修复 | C2 路由迁移时修复 |
| 直接 fetch/axios | 🔴 Critical | brand-geo 前端可能仍有 | C1 要求所有新代码通过 PlatformSDK |
| 直接 prisma | 🔴 Critical | 当前代码可能仍有 | C1 要求所有新代码通过 BaseRepository |
| Non-ApiResponse 格式 | 🔴 Critical | 所有现有后端路由 | C2 路由迁移时逐步修复 |
| 无 auth 中间件 | 🔴 Critical | GEO 路由 | C1 在 adapter 中添加 auth，C2 完善 |

---

## 五、C1 实施优先级

```
P0 (当前 Sprint 必须完成):
  1. api/types.ts — 所有模块依赖此类型
  2. auth/auth-service.ts — 项目基础能力
  3. project/project-service.ts — 项目核心模型
  4. index.ts — barrel export
  
P1 (当前 Sprint 建议完成):
  5. workspace/workspace-registry.ts
  6. workspace/geo/adapter/adapter.ts
  7. workspace/geo/services/geo-project-service.ts
  8. workspace/geo/stores/useGeoStore.ts
  
P2 (当前 Sprint 收尾):
  9. repository/base-repository.ts
  10. capability/capability-runtime.ts (shim)
  11. runtime/platform-runtime.ts (shim)
  12. event/event-bus.ts (stub)
  13. state/state-runtime.ts (stub)
  
P3 (文档):
  14. GEO-ROUTE-MIGRATION.md
  15. C1-COMPLIANCE-REPORT.md
```
