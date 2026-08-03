# ECO-03-REALITY-GATE.md — KAOR Runtime Boundary

> **SPRINT-ECO-03 完成报告** | 日期：2026-08-03 23:10 | 状态：✅ PASS（33/33）
> 掌柜验收指令（2026-08-03 22:10）：建立 Plugin → KAOR Adapter → Existing Hermes 桥梁，**不是开发 Hermes 2.0**；零破坏 / 零重构 / 零迁移 / 零插件执行 / 零商城 / 零本地客户端

---

## 1. KAOR Runtime Boundary 接口

`backend/src/ecosystem/kaor/kaor-runtime.interface.ts` — 生态 Runtime 契约层（纯接口，不实现执行）：

```ts
interface KAORRuntime {
  readonly runtimeId: string;   // 'kaor'
  readonly adapterName: string; // 'hermes-adapter'

  // Agent 生命周期（映射 Hermes IAgentLifecycle / AgentRuntimeAdapter）
  createAgentInstance(params: KAORCreateAgentParams): Promise<KAORResult<KAORAgentInstance>>;
  startAgent(agentInstanceId: string): Promise<KAORResult<KAORAgentStatus>>;
  pauseAgent(agentInstanceId: string): Promise<KAORResult<KAORAgentStatus>>;
  stopAgent(agentInstanceId: string): Promise<KAORResult<KAORAgentStatus>>;
  getAgentStatus(agentInstanceId: string): Promise<KAORResult<KAORAgentStatus>>;

  // 记忆（契约声明，执行待 Local App Sprint）
  loadMemory(agentInstanceId: string, query: KAORMemoryQuery): Promise<KAORResult<KAORMemoryEntry[]>>;

  // 工具（契约声明 + 权限校验，不执行插件代码）
  executeTool(agentInstanceId: string, call: KAORToolCall): Promise<KAORResult<KAORToolResult>>;

  // 工作流（映射现有 Hermes WorkflowEngine）
  executeWorkflow(agentInstanceId: string, workflowId: string, input: unknown): Promise<KAORResult<KAORWorkflowResult>>;

  // 权限（映射 Hermes RuntimeContextService.hasPermission）
  checkPermission(agentInstanceId: string, permission: string): Promise<KAORResult<boolean>>;

  // 调度（映射现有 AgentScheduler / AgentScheduleService）
  scheduleTask(agentInstanceId: string, task: KAORScheduledTask): Promise<KAORResult<KAORScheduleReceipt>>;

  // 能力声明（Runtime Capability Registry 数据源）
  getCapabilities(): KAORCapability[];
}
```

统一结果类型：`KAORResult<T>` 带 `executedBy: 'hermes' | 'contract' | 'not_implemented'` 诚实标注（真实委托 / 契约占位 / 未实现）。

## 2. Hermes Adapter 映射（交付物 #2）

`backend/src/ecosystem/kaor/hermes-adapter.ts` — **新增**适配器，零修改现有 Hermes：

| KAOR 方法 | 委托的现有 Hermes 服务 | 状态 |
|-----------|----------------------|:----:|
| createAgentInstance | AgentRuntimeAdapter.createAgent | delegated |
| startAgent / stopAgent / pauseAgent | AgentRuntimeAdapter.startAgent/stopAgent | delegated |
| getAgentStatus | AgentRuntimeAdapter.getStatus | delegated |
| executeWorkflow | WorkflowEngineService.startWorkflow | delegated |
| checkPermission | RuntimeContextService.hasPermission | delegated |
| scheduleTask | AgentScheduleService.createSchedule | delegated |
| loadMemory | HermesProfileBinding.memoryNamespace 解析 | contract（执行待 Local App Sprint） |
| executeTool | ToolPermissionService.getBindingTools 权限校验 | contract（插件工具执行冻结） |

> 委托采用**动态 import**，现有服务保持原样；Adapter 只是「新的一层壳」，不改任何现有文件。

## 3. Runtime Capability Matrix（交付物 #3）

| 能力 code | 名称 | 状态 | Hermes 映射点 |
|-----------|------|:----:|---------------|
| agent.lifecycle | Agent 生命周期 | delegated | IAgentLifecycle + AgentRuntimeAdapter |
| permission | 权限校验 | delegated | RuntimeContextService.hasPermission |
| workflow | 工作流执行 | delegated | WorkflowEngineService |
| scheduler | 任务调度 | delegated | AgentScheduler + AgentScheduleService |
| memory | 记忆存取 | contract | HermesProfileBinding.memoryNamespace（执行待 Local App Sprint） |
| tool | 工具执行 | contract | ToolPermissionService + MemoryAccessGate（插件工具待后续） |

- **SSOT**：`kaor-capabilities.ts` 常量矩阵 + `ecology_runtime_capabilities` 表（seed 幂等同步）
- **G4 映射规则**：agent 类型插件 → agent.lifecycle+permission+memory(+workflow 若 kaor 声明)；workflow → workflow+scheduler+permission；tool → tool+permission

## 4. API（/api/ecosystem/runtime）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /runtime | Runtime 目录（含能力声明） |
| GET | /runtime/capabilities | 能力矩阵 SSOT |
| GET | /runtime/:runtimeId | Runtime 详情 |
| GET | /runtime/mapping/:pluginId | 插件 ↔ Runtime 能力映射（G4） |
| POST | /runtime/mapping/:pluginId/bind | 建立绑定（幂等） |
| GET | /runtime/contract/probe | HermesAdapter 契约探针（只读验证映射链路） |
| GET | /runtime-health | Runtime 层健康检查 |

## 5. 数据变化（G6）

**纯新增 3 张 ecology 表**，现有表零修改：

| 表 | 用途 | 约束 |
|----|------|------|
| ecology_runtimes | Runtime 身份 | runtime_id 唯一 |
| ecology_runtime_capabilities | 能力声明 | runtime_id+capability 唯一 |
| ecology_plugin_runtime_bindings | 插件↔Runtime 映射 | plugin_id+runtime_id 唯一 |

- ecology 表 4 → 10 张（ECO-01 4 + ECO-02 3 + ECO-03 3）
- **代码层铁证**：ECO-02 提交 schema model 清单 vs 当前，差异仅 3 个 Ecology 模型，零删除
- 迁移 SQL 静态证据：只建 ecology 表

## 6. Reality Gate 结果（33/33 PASS）

| Gate | 验证内容 | 结果 |
|------|---------|:----:|
| G1 | 现有 AI 员工全部正常 | ✅ instances=23 active=23 bindings=23 |
| G2 | Agent 创建流程不变 | ✅ agent-profiles/overview + templates=10 |
| G3 | Hermes 调用链不变 | ✅ hermes-profiles 路由可达（鉴权正常）+ workflow 模板链路 |
| G4 | Plugin Manifest 映射 Runtime 能力 | ✅ 3 类型插件映射正确（agent/workflow/tool）+ 幂等绑定 + 契约探针 6 能力 |
| G5 | 无 Hermes 文件大规模变化 | ✅ agent-runtime/ 零修改 + 零修改现有 Hermes 文件（仅新增 adapter） |
| G6 | 数据库只能新增 ecology 表 | ✅ 10 张 ecology + schema 差异仅 Ecology + 迁移 SQL 只建 ecology |
| 回滚 | DROP 3 新表无依赖 → 重建幂等 | ✅ 约束保留 |

> G4 实测映射：
> - eco3-agent-demo (agent) → agent.lifecycle,permission,memory,workflow ✅
> - eco3-workflow-demo (workflow) → workflow,scheduler,permission ✅
> - eco3-tool-demo (tool) → tool,permission ✅

## 7. 纪律遵守确认

- ✅ 不拆 Hermes（AgentTemplate / EnterpriseAgentProfile / EnterpriseAgentInstance / HermesProfileBinding 全部保持）
- ✅ 不迁移现有 Agent（23 实例零改动）
- ✅ 不开发本地执行（memory 为 contract 占位，执行待 Local App Sprint）
- ✅ 不接插件执行（executeTool 只做权限校验 + 契约声明，插件工具执行冻结）
- ✅ 零商城 / 零支付 / 零前端页面

## 8. 下一阶段 ECO-04 建议

掌柜路线图：ECO-04 License System ⏳ → Developer Center → Marketplace → Kunlun Media Local App

建议 ECO-04 冻结范围（License 身份登记，延续「只登记不执行」纪律）：
1. **License Manifest**：`{ pluginId, licenseType: 'trial'|'subscription'|'lifetime', price, billingCycle, entitlements }`（zod 严格校验，延续 ECO-02 模式）
2. **License Registry**：纯新增 ecology 表（licenses / license_grants），绑定组织安装记录
3. **权限门禁占位**：License 校验接口返回 entitlements（不做真实支付回调，不做商城 UI）
4. **Reality Gate**：非法 License 样本拒绝 / 现有插件零影响 / 数据库只增 ecology 表

## 9. 交付物清单

```
backend/src/ecosystem/kaor/kaor-runtime.interface.ts   (KAOR Boundary 接口)
backend/src/ecosystem/kaor/kaor-capabilities.ts        (能力矩阵 SSOT)
backend/src/ecosystem/kaor/hermes-adapter.ts           (HermesAdapter 委托映射)
backend/src/ecosystem/runtime-registry.service.ts      (Runtime Registry + G4 映射)
backend/src/routes/ecology-runtime.routes.ts           (/api/ecosystem/runtime 7 端点)
backend/prisma/schema.prisma                           (+3 EcologyRuntime 模型)
backend/prisma/migrations/sprint-eco-03-kaor-runtime-boundary/migration.sql
backend/src/index.ts                                   (+ECO-03 路由注册 + seed)
backend/scripts/reality-check-eco-03.mjs               (Reality Gate 33 项)
docs/.reality/ECO-03-REALITY-GATE.md                   (本报告)
```

**提交：** SPRINT-ECO-03 KAOR Runtime Boundary — 33/33 Reality Gate PASS（零 Hermes 修改）
