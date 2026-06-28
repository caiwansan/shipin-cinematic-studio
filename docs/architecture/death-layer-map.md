# Death Layer Map — Runtime Layer Status Registry

**生成日期**: 2026-05-30  
**审计依据**: Source tree inspection + dist/ artifact scan + Database schema analysis  
**状态**: DRAFT（初次扫描，需团队确认后上线）

---

## 状态定义

| 状态 | 含义 |
|------|------|
| **ACTIVE** | 当前正在使用的核心层，继续维护 |
| **LEGACY** | 老旧但仍在运行，逐步迁移至新层 |
| **FROZEN** | 冻结，禁止新增逻辑，仅修复 blocking bug |
| **DEAD** | 无运行路径，可安全删除/归档 |
| **OBSERVE_ONLY** | 仅用于观察/监控，不参与执行路径 |

---

## 一、Execution 执行层

| Layer | 来源路径 | 状态 | 说明 |
|-------|----------|------|------|
| `scheduler/` | `backend/src/scheduler/` | **LEGACY** | 调度器，与 queue 重叠，建议迁移至 Runtime Core |
| `queue/` | `backend/src/queue/` | **ACTIVE** | 消息队列，应降为 transport only |
| `kernel-v1/` | `backend/src/kernel-v1/` | **ACTIVE** | 可保留作为 Runtime Core 基础 |
| `execution` | `backend/dist/execution` | **DEAD** | 编译产物存在，src 无对应目录，疑似已迁移 |
| `graph-runtime` | `backend/dist/graph-runtime` | **DEAD** | src 无源码，dist 有残留 |
| `graph-optimization` | `backend/dist/graph-optimization` | **DEAD** | 同上 |
| `graph-patch` | `backend/dist/graph-patch` | **DEAD** | 同上 |
| `execution-debug` | `backend/dist/execution-debug` | **DEAD** | 同上 |
| `execution-safety` | `backend/dist/execution-safety` | **DEAD** | 同上 |
| `execution-trace` | `backend/dist/execution-trace` | **DEAD** | 同上 |
| `director-v2` | `backend/dist/director-v2` | **LEGACY** | 编译产物不在 src 核心路径，需确认活跃度 |
| `director-simulation` | `backend/dist/director-simulation` | **DEAD** | 同上 |

## 二、Runtime 运行时层

| Layer | 来源路径 | 状态 | 说明 |
|-------|----------|------|------|
| `governance/` | `backend/src/governance/` | **LEGACY** | 治理层，应降级为 policy only |
| `optimization/` | `backend/src/optimization/` | **FROZEN** | 优化系统，属于 Capability Service 范畴 |
| `runtime` | `backend/dist/runtime` | **LEGACY** | 编译存在，src 无对应 |
| `runtime-provider-resolver` | `backend/src/runtime-provider-resolver.ts` | **LEGACY** | 单文件，应合并入 Capability Service |
| `showrunner` | `backend/dist/showrunner` | **OBSERVE_ONLY** | 编译产物存在，src 无源码 |
| `production-loop` | `backend/dist/production-loop` | **DEAD** | 编译产物残留 |
| `replay` | `backend/dist/replay` | **DEAD** | src 无源码 |
| `replay-analytics` | `backend/dist/replay-analytics` | **DEAD** | src 无源码 |
| `workflow` | `backend/dist/workflow` | **LEGACY** | 需确认是否被 runtime 引用 |

## 三、Kernel 内核层

| Layer | 来源路径 | 状态 | 说明 |
|-------|----------|------|------|
| `kernel-v1` | `backend/src/kernel-v1/` | **ACTIVE** | 保留为 Runtime Core 候选 |
| `kernel` | `backend/dist/kernel` | **DEAD** | 编译产物，src 无 runtime 路径 |
| `engine` | `backend/dist/engine` | **DEAD** | 编译产物残留 |
| `control-plane` | `backend/dist/control-plane` | **DEAD** | 编译产物残留 |
| `cognition-loop` | `backend/dist/cognition-loop` | **DEAD** | 编译产物残留 |
| `closure` | `backend/dist/closure` | **DEAD** | 编译产物残留 |

## 四、DB Schema 层

| Schema/Source | 表/文件 | 状态 | 说明 |
|--------------|---------|------|------|
| L7 Desktop Runtime | DesktopRuntimeConfig, LocalGPUNode, LicenseCache, LocalAssetIndex | **FROZEN** | 未来扩展，禁止新增。不上线则不占用。 |
| L8 Kernel | KernelEvent, KernelCutoverScore, KernelDualExecutionLog, etc. | **FROZEN** | 仅保留 event log 相关表 |
| L9 Cutover | KernelShadowEventLog, KernelRollbackHistory | **DEAD** | 双轨执行残留，可安全删除 |
| OMS World | World, Character, Event, NarrativeScene | **FROZEN** | 创意原型，禁止新增修改 |
| GPU Cloud | GPUNode, GPUTaskLog, GPUThrottleState | **FROZEN** | 禁止新增 |
| System Monitor | SystemMonitor, RateLimit, CircuitBreaker | **FROZEN** | 保留，禁止新增表 |
| Analytics | analytics_events | **FROZEN** | 保留，禁止扩展 |

## 五、Frontend 前端层

| 目录 | 状态 | 说明 |
|------|------|------|
| `kernel/` | **DEAD** | 与后端 kernel 概念对应，不应在前端 |
| `governance/` | **DEAD** | 后端概念向前端渗透，应移除 |
| `runtime/` | **DEAD** | 运行时概念不应在前端 |
| `planning/` | **DEAD** | 编排概念不应在前端 |
| `bridge/` | **FROZEN** | 桥接逻辑待评估去留 |
| `core/` | **OBSERVE_ONLY** | 与 composables 重叠 |
| `multiAgent/` | **OBSERVE_ONLY** | 后端概念，前端的 UI 版本 |
| `license-runtime/` | **DEAD** | License 逻辑，不在前端 |
| `studio-v2/` | **OBSERVE_ONLY** | 与 pages/studio/v2.vue 重叠 |
| `products/` | **OBSERVE_ONLY** | 内容展示，与 runtime 无关 |

---

## 下一步

1. 团队验证此 Death Layer Map 的准确性
2. DEAD 层的代码/目录/表在双周周期内清理
3. FROZEN 层写入 CI 门禁：禁止新增逻辑
4. LEGACY 层制定迁移计划
