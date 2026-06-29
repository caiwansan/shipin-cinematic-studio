# V4.1 Platform Convergence Decision（PCD）

> **文档版本**: v1.0  
> **基线日期**: 2026-07-19  
> **状态**: V4.1 Architecture Freeze 核心交付物  
> **方法**: 基于审计扫描的真实代码结构，逐模块评估归属

---

## 1. 决策标准

| 决策 | 含义 | 条件 |
|------|------|------|
| ✅ Keep | 长期保留 | 符合 SST 结构，有明确所有者，有实际使用 |
| 🔄 Move | 迁移到正确层级 | 归属错误但代码有价值 |
| ⏸️ Deprecate | 废弃（保留不开发） | 有价值但已被替代或无需维护 |
| ❌ Remove | 删除 | 无依赖、无使用、重复或实验性代码 |
| ➕ Promote | 提升为平台能力 | 从 Workspace 到 Core |

---

## 2. 后端模块评估

### 2.1 backend/src/ 顶层目录

| 模块 | 当前层级 | 审计发现 | 决策 | 目标层级 |
|------|---------|---------|------|---------|
| `admin/` | ✅ 正确 | Admin 相关功能 | ✅ Keep | Admin |
| `agents/` | ⚠️ 模糊 | 短剧 Agent（script-breakdown, character, aigc-spec 等） | 🔄 Move | Workspace/short-drama |
| `ai/` | ⚠️ 模糊 | AI 相关工具 | 🔄 Move | Core（评估复用性后） |
| `api/` | ⚠️ 遗留 | V3 API 兼容层 | ⏸️ Deprecate | 保持但停止开发 |
| `audits/` | ✅ 正确 | 审计功能 | ✅ Keep | Core/Governance |
| `authority/` | ⚠️ 模糊 | 授权模块 | 🔄 Move | Core/Permission |
| `autonomous-director/` | ⚠️ 实验性 | 自主导演实验 | ⏸️ Deprecate | 保留代码但不活跃开发 |
| `billing/` | ✅ 正确 | 计费模块 | ✅ Keep | Core |
| `bootstrap/` | ✅ 正确 | 启动引导 | ✅ Keep | Core |
| `causal-engine/` | ⚠️ 模糊 | 因果引擎 | ⏸️ Deprecate | 复用率未知 |
| `causal-graph/` | ⚠️ 模糊 | 因果图 | ⏸️ Deprecate | 复用率未知 |
| `character-persistence/` | ⚠️ 模糊 | 角色持久化 | 🔄 Move | Core/Asset（迁移后） |
| `cinematic-compiler/` | ⚠️ 工作台 | 电影编译器 | ✅ Keep | Core（平台级） |
| `cinematic-grammar/` | ⚠️ 工作台 | 电影语法 DSL | ✅ Keep | Core |
| `cinematic-motion-planner/` | ⚠️ 工作台 | 动作规划 | ✅ Keep | Core |
| `config/` | ✅ 正确 | 配置管理 | ✅ Keep | Infrastructure |
| `config-runtime/` | ✅ 正确 | 运行时配置 | ✅ Keep | Infrastructure |
| `contracts/` | ✅ 正确 | 合约定义 | ✅ Keep | Core |
| `control-layer/` | ✅ 正确 | 控制层 | ✅ Keep | Core |
| `control-plane/` | ✅ 正确 | 控制面 | ✅ Keep | Core（与 core/control-plane 合并评估） |
| `core/` | ✅ 正确 | 核心模块 | ✅ Keep | Core（详见 2.2） |
| `core-runtime/` | ⚠️ 模糊 | 核心运行时 | 🔄 Move | Core/Runtime（合并到 runtime/） |
| `creative-economy/` | ⚠️ 实验性 | 创意经济 | ⏸️ Deprecate | 复用率未知 |
| `creative-os-gateway/` | ⚠️ 模糊 | 创意 OS 网关 | ⏸️ Deprecate | 待评估 |
| `data/` | ⚠️ 模糊 | 数据处理 | 🔄 Move | Core（评估复用性） |
| `decision-runtime/` | ⚠️ 实验性 | 决策运行时 | ⏸️ Deprecate | 复用率未知 |
| `director/` | ⚠️ 模糊 | Director 相关 | 🔄 Move | Workspace/short-drama（核心逻辑） |
| `director-economy/` | ⚠️ 实验性 | Director 经济 | ⏸️ Deprecate | 复用率未知 |
| `director-intelligence/` | ⚠️ 实验性 | Director 智能 | ⏸️ Deprecate | 复用率未知 |
| `director-ir/` | ⚠️ 模糊 | Director IR | ✅ Keep | Core（平台级 IR） |
| `director-marketplace/` | ⚠️ 实验性 | Director 市场 | ⏸️ Deprecate | 独立功能 |
| `director-registry/` | ⚠️ 模糊 | Director 注册 | 🔄 Move | Core/Registry |
| `director-runtime/` | ⚠️ 模糊 | Director 运行时 | 🔄 Move | Core/Runtime（合并） |
| `director-v2/` | ⚠️ 模糊 | Director V2 | ✅ Keep | Core（平台级） |
| `domain/` | ⚠️ 模糊 | 领域模型 | ✅ Keep | Core（统一领域定义） |
| `engine/` | ⚠️ 模糊 | 引擎 | ✅ Keep | Core（平台级引擎） |
| `events/` | ✅ 正确 | 事件处理 | ✅ Keep | Core/Event |
| `execution/` | ⚠️ 模糊 | 执行引擎 | 🔄 Move | Core/Execution（与 Execution Runtime 合并） |
| `execution-debug/` | ⚠️ 模糊 | 执行调试 | ✅ Keep | Core/Execution |
| `execution-intelligence/` | ⚠️ 实验性 | 执行智能 | ⏸️ Deprecate | 复用率未知 |
| `execution-memory/` | ⚠️ 模糊 | 执行记忆 | 🔄 Move | Core/Execution |
| `execution-observatory/` | ⚠️ 模糊 | 执行观测 | ✅ Keep | Core/Observability |
| `execution-safety/` | ⚠️ 模糊 | 执行安全 | ✅ Keep | Core/Safety |
| `execution-trace/` | ✅ 正确 | 执行追踪 | ✅ Keep | Core/Observability |
| `gateway/` | ✅ 正确 | API 网关 | ✅ Keep | Infrastructure |
| `governance/` | ✅ 正确 | 治理系统 | ✅ Keep | Core/Governance |
| `graph-optimization/` | ⚠️ 模糊 | 图优化 | 🔄 Move | Core/Agent-Graph |
| `graph-patch/` | ⚠️ 模糊 | 图补丁 | 🔄 Move | Core/Agent-Graph |
| `guards/` | ✅ 正确 | 守卫/保护 | ✅ Keep | Core/Security |
| `health/` | ✅ 正确 | 健康检查 | ✅ Keep | Core/Observability |
| `infra/` | ✅ 正确 | 基础设施 | ✅ Keep | Infrastructure |
| `jobs/` | ✅ 正确 | 定时任务 | ✅ Keep | Infrastructure |
| `kernel/` | ⚠️ 模糊 | 内核相关 | 🔄 Move | Core/Kernel（与 packages/studio-platform 区分） |
| `llm-execution-graph-v2/` | ⚠️ 模糊 | LLM 执行图 V2 | 🔄 Move | Core/Execution |
| `middleware/` | ✅ 正确 | 中间件 | ✅ Keep | Core |
| `model-adapters/` | ✅ 正确 | 模型适配器 | ✅ Keep | Core/Provider |
| `narrative-constraint/` | ⚠️ 模糊 | 叙事约束 | 🔄 Move | Core（平台级） |
| `observability/` | ✅ 正确 | 可观测性 | ✅ Keep | Core/Observability |
| `optimization/` | ⚠️ 模糊 | 优化引擎 | 🔄 Move | Core（评估复用性） |
| `payment/` | ✅ 正确 | 支付系统 | ✅ Keep | Core |
| `plugins/` | ⚠️ 模糊 | 插件系统 | ⏸️ Deprecate | 无实际插件使用 |
| `plugin-sandbox/` | ⚠️ 实验性 | 插件沙箱 | ⏸️ Deprecate | 无实际使用 |
| `production-loop/` | ⚠️ 模糊 | 生产循环 | 🔄 Move | Workspace/short-drama |
| `production-validation/` | ⚠️ 模糊 | 生产验证 | 🔄 Move | Workspace/short-drama |
| `prompts/` | ⚠️ 模糊 | Prompt 管理 | 🔄 Move | Core（平台级 Prompt Registry） |
| `providers/` | ✅ 正确 | Provider 管理 | ✅ Keep | Core/Provider |
| `queue/` | ✅ 正确 | 消息队列 | ✅ Keep | Infrastructure |
| `replay/` | ⚠️ 模糊 | 回放系统 | 🔄 Move | Core/Execution |
| `replay-analytics/` | ⚠️ 模糊 | 回放分析 | 🔄 Move | Core/Execution |
| `replay-engine/` | ⚠️ 模糊 | 回放引擎 | 🔄 Move | Core/Execution |
| `rfvl/` | ⚠️ 模糊 | RFVL 相关 | ⏸️ Deprecate | 复用率未知 |
| `routes/` | ⚠️ 混合 | 路由文件（95+ 个） | ✅ Keep | 按层级分散（详见第 4 节） |
| `runtime/` | ⚠️ 遗留 | Phase I Runtime（大量模块） | ⏸️ 冻结清理 | 详见 Phase I 评估 |
| `runtime-observability/` | ✅ 正确 | 运行时可观测性 | ✅ Keep | Core/Observability |
| `safety/` | ✅ 正确 | 安全模块 | ✅ Keep | Core/Safety |
| `schema-runtime/` | ⚠️ 模糊 | Schema 运行时 | 🔄 Move | Core/Schema |
| `schemas/` | ✅ 正确 | Schema 定义 | ✅ Keep | Core/Schema |
| `scripts/` | ✅ 正确 | 脚本工具 | ✅ Keep | Infrastructure |
| `security/` | ✅ 正确 | 网络安全 | ✅ Keep | Infrastructure |
| `services/` | ⚠️ 混合 | 各类服务（详见 2.3） | ✅ Keep | 按归属分散 |
| `shared/` | ✅ 正确 | 共享代码 | ✅ Keep | Core |
| `storage/` | ⚠️ 模糊 | 存储管理 | 🔄 Move | Core/Asset |
| `style-dsl/` | ⚠️ 模糊 | 风格 DSL | 🔄 Move | Core（平台级） |
| `style-runtime/` | ⚠️ 模糊 | 风格运行时 | 🔄 Move | Core |
| `temporal-engine/` | ⚠️ 实验性 | 时序引擎 | ⏸️ Deprecate | 复用率未知 |
| `tir/` | ⚠️ 模糊 | TIR（时序 IR） | 🔄 Move | Core/IR |
| `truth/` | ⚠️ 模糊 | 真实性引擎 | 🔄 Move | Core（未来 Trust Engine 前置） |
| `types/` | ✅ 正确 | 类型定义 | ✅ Keep | Core |
| `utils/` | ✅ 正确 | 工具函数 | ✅ Keep | Core |
| `workbench/` | ⚠️ 实验性 | 工作台工具 | ⏸️ Deprecate | Director OS 已经覆盖 |
| `worker/` | ✅ 正确 | Worker 模块 | ✅ Keep | Infrastructure |
| `workers/` | ✅ 正确 | Workers 运行池 | ✅ Keep | Infrastructure |
| `workflow/` | ⚠️ 模糊 | 工作流（与 platform/workflow 重复？） | ⚠️ 待评估 | 需要确定是否为独立实现 |

### 2.2 backend/src/core/ 模块

| 模块 | 审计发现 | 决策 | 说明 |
|------|---------|------|------|
| `agent-graph/` | Agent 图引擎 | ✅ Keep | Core/Agent |
| `asset-economy/` | 资产经济模型 | ✅ Keep | Core/Asset |
| `citation/` | 引用引擎 P2.1 | ✅ Keep | Core/Knowledge |
| `cluster/` | 集群管理 | ✅ Keep | Infrastructure |
| `constraint-physics/` | 约束物理引擎 | ⏸️ Deprecate → **❌ REMOVE** | 已执行 Batch 1 删除（2026-07-19）— 零引用孤岛模块 |
| `control-plane/` | 控制面 | ✅ Keep | Core |
| `global/` | 全局配置 | ✅ Keep | Core |
| `governance/` | 治理逻辑 | ✅ Keep | Core/Governance |
| `job-envelope.ts` | 任务封装 | ✅ Keep | Core |
| `lifecycle-integration.ts` | 生命周期集成 | ✅ Keep | Core |
| `lifecycle-state-machine.ts` | 生命周期状态机 | ✅ Keep | Core |
| `policy-adapter/` | 策略适配器 | ✅ Keep | Core/Governance |
| `policy-signal/` | 策略信号 | ✅ Keep | Core/Governance |
| `provider-registry/` | Provider 注册 | ✅ Keep | Core/Provider |
| `rate-limiter.ts` | 限流器 | ✅ Keep | Core/Governance |
| `runtime/` | 运行时核心 | ✅ Keep | Core/Runtime |
| `stream-plane/` | 流平面 | ✅ Keep | Core |
| `style-evolution/` | 风格演进 | ⏸️ Deprecate → **❌ REMOVE** | 已执行 Batch 1 删除（2026-07-19）— 零引用孤岛模块 |

### 2.3 backend/src/services/ 关键服务

| 服务 | 当前归属 | 决策 | 说明 |
|------|---------|------|------|
| `geo/` | Workspace/GEO | ✅ Keep | GEO 后端服务，完整业务域 |
| `platform/` | Core | ✅ Keep | 平台运行时 6 大模块完整 |
| `asset/` | Core | ✅ Keep | 资产管理 |
| `semantic/` | Core | ✅ Keep | 语义引擎 |
| `community/` | Core | ✅ Keep | 社区服务 |
| `goal/` | Workspace/Short-drama | ⏸️ Deprecate | 目标/策略系统，复用率未知 |
| `hdz/` | Workspace/HDZ | ✅ Keep | 混洞织产品线 |
| `narrative/` | Workspace/Short-drama | ✅ Keep | 叙事相关 |
| `music/` | Workspace/Music | ⚠️ 待定 | 待评估完成度 |
| `p18/` | 实验性 | ❌ Remove 候选 | 评估使用率 |
| `audio-runtime/` | Workspace | ⚠️ 待定 | 音频运行时 |
| `visual-constraint/` | Workspace | ⚠️ 待定 | 视觉约束 |

---

## 3. Phase I Runtime 冻结清理

backend/src/runtime/ 下包含大量 Phase I 实现的运行时模块。V4.1 平台已提供替代方案。

| Phase I 模块 | 替代方案 | 决策 |
|-------------|---------|------|
| `runtime/adapters/` | Platform SDK Adapter 模式 | ⏸️ 冻结 |
| `runtime/director/` | PLAT-009 Workspace Runtime | ⏸️ 冻结 |
| `runtime/persistence/` | Repository 模式 + Workspace Runtime | ⏸️ 冻结 |
| `runtime/providers/` | PLAT-008 Resource Runtime + Provider Registry | ⏸️ 冻结 |
| `runtime/prompt/` | Capability Registry | ⏸️ 冻结 |
| `runtime/provider-middleware.ts` | PLAT-006 Capability Platform | ⏸️ 冻结 |
| `runtime/routing/` | Capability Resolver | ⏸️ 冻结 |
| `runtime/trace/` | Observability Service | ⏸️ 冻结 |
| `runtime/feedback-loop/` | Workflow Runtime | ⏸️ 冻结 |
| `runtime/graph/` | Execution Kernel | ⏸️ 冻结 |
| `runtime/graph-runtime.ts` | Execution Kernel | ⏸️ 冻结 |
| `runtime/schema-validator/` | Schema Runtime | ⏸️ 冻结 |
| `runtime/ccp-*` | Capability Platform | ⏸️ 冻结 |
| `runtime/cee-*` | Agent Runtime | ⏸️ 冻结 |
| `runtime/ckb-*` | Knowledge Object Service | ⏸️ 冻结 |
| `runtime/coe-*` | 需评估 | ⏸️ 冻结 |
| `runtime/vep-*` | Citation/Evidence Engine | ⏸️ 冻结 |

**冻结原则**：代码保留、不删除、不修复、不开发新功能。待所有消费者迁移后归档。

---

## 4. 重复服务检查

| # | 重复功能 | 位置 1 | 位置 2 | 决策 |
|---|---------|--------|--------|------|
| 1 | GeoProject / GEOProject | `prisma model GeoProject` | `prisma model GEOProject` | 🔄 合并为保留一个 |
| 2 | Asset / UnifiedAsset | `prisma model Asset` | `prisma model UnifiedAsset` | 🔄 合并（评估使用率后） |
| 3 | Agent Definition | `prisma model AgentDef` | `prisma model AgentDefinition` | 🔄 合并 |
| 4 | 支付 | `payment/` | `services/balance/` | ✅ 互补（支付 vs 余额） |
| 5 | Project CRUD | `routes/projects.ts` | `routes/projects-v2.ts` | ⏸️ v1 deprecate，使用 v2 |
| 6 | 模型管理 | `routes/admin-models.ts` | `routes/admin-models-v2.ts` | ⏸️ v1 deprecate |
| 7 | Workflow | `platform/workflow/` | `backend/routes/goal/workflow.route.ts` | ✅ 不同层级（平台 vs 工作台） |
| 8 | Admin 入口 | `pages/admin/aigc/` | `pages/director-os/` | 🔄 迁移到 director-os |

---

## 5. 遗留文件清理

| 文件/目录 | 说明 | 决策 |
|-----------|------|------|
| `p0-gateway-route.ts.bak` | 备份文件 | ❌ 删除 |
| `provider-resolver.ts.bak` | 备份文件 | ❌ 删除 |
| `llm-client.ts.bak` | 备份文件 | ❌ 删除 |
| 多个 `.vue.bak` 文件 | Vue 备份 | ❌ 删除 |
| `backend/..output.bak_v2.5/` | 前端构建备份 | ❌ 删除 |
| `frontend/..output.bak_v2.5/` | 前端构建备份 | ❌ 删除 |
| 非核心模块（生活助手等） | 不在已知代码中 | 保持关注 |

---

## 6. 汇总决策

| 决策类型 | 数量 | 说明 |
|---------|------|------|
| ✅ Keep | ~70 | 长期保留 |
| 🔄 Move | ~25 | 迁移到正确层级 |
| ⏸️ Deprecate | ~20 | 废弃但保留代码 |
| ❌ Remove | ~5 | 删除（确认无依赖后） |
| ⚠️ 待评估 | ~10 | 需要更多使用率数据 |

---

> **文档历史**
> | 版本 | 日期 | 变更 |
> |------|------|------|
> | v1.0 | 2026-07-19 | 初次建立 — V4.1 Architecture Freeze |
