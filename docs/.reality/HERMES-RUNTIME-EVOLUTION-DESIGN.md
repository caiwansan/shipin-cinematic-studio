# HERMES-RUNTIME-EVOLUTION-DESIGN.md

> **昆仑镜 AI 应用生态平台 — Task 04 Hermes Runtime 生态化设计**
> 版本：V1.1（融入技术总监评审：Hermes 定位升级为 Kunlun AI Operating Runtime） | 类型：架构设计（只读，不实施） | 日期：2026-08-03

---

## 〇、定位升级：Hermes → Kunlun AI Operating Runtime（KAOR）

**技术总监定调**：Hermes 不应只是「Agent 运行环境」，而应定义为：

> **Kunlun AI Operating Runtime = Docker + Node Runtime + Agent OS**

类比：Windows 卖软件、苹果卖 App、**昆仑镜卖 AI员工 + AI能力插件 + AI应用**——而 KAOR 就是承载这些资产的操作系统内核。

### KAOR 职责清单（九大模块）

| 模块 | 职责 | 现状资产 | 差距 |
|------|------|---------|------|
| Agent 生命周期 | 实例创建/启动/暂停/销毁 | `agent-runtime/lifecycle` + `orchestrator` | ✅ 基本就绪 |
| Memory | 统一记忆 API + 命名空间隔离 | `AgentMemory` / `memory-namespace` | 🟠 收敛 7 套记忆表 |
| Tool | 工具注册/调用/权限闸门 | `tool-permission` / `tools` | ✅ 基本就绪 |
| Browser | 浏览器控制（云端+本地） | `enterprise/channel` BrowserRuntime | 🟠 需下沉 Local Device Runtime |
| Workflow | 工作流引擎（收敛 5 套） | `workflow-definition` | 🔴 收敛 |
| Scheduler | 定时/事件触发 | `queue/` + `workers/` | 🟡 统一调度契约 |
| Plugin Loader | 插件加载/版本/依赖 | `plugin-sandbox`（沙箱） | 🟠 需 Manifest 解析器 |
| Permission Sandbox | 权限强制/资源隔离 | `plugin-sandbox` + `CapabilityGrant` | 🟠 需 Manifest 驱动 |
| Local Execution | 本地实例执行 | 无（Electron 内嵌待建） | 🔴 新建 |

**核心转变**：开发者开发 AI 员工不再「直接写业务」，而是：

```
Plugin → Hermes Runtime（KAOR）→ Agent Instance → User
```

---

## 一、现状评估：Hermes 已经是 Agent 底座

### 1.1 现有资产（事实）

| 资产 | 现状 | 生态化潜力 |
|------|------|-----------|
| `backend/src/agent-runtime/` | brain / context / execution / gates / gateway / interfaces / lifecycle / orchestrator / workflow | **核心内核，生态化基础** |
| `EnterpriseAgentInstance` | AI 员工实例（23 个存量） | 插件 = agent 模板实例化 |
| `AgentTemplate` | AI 员工模板 | **插件 Agent 类型的注册表** |
| `HermesProfileBinding` | AI员工↔Hermes子代理绑定（soul.md / toolAllowList / memoryNamespace / identityProvider） | **插件隔离边界已存在** |
| `AgentDefinition/AgentExecution/AgentMemory` | Agent 通用模型 | 需收敛（审计 R2/R3） |
| `plugin-sandbox/` | 已有插件沙箱 | 插件执行安全边界 |
| `tool-permission` / `memory-namespace` 路由 | 工具权限 + 记忆命名空间 | 生态安全基础 |

### 1.2 结论

**Hermes 具备成为统一 Agent 底座的条件**：编排内核（orchestrator/lifecycle/workflow/gates）已成型，AI 员工与 Hermes 子代理的绑定模型（HermesProfileBinding）已经是「插件化 AI 员工」的雏形。缺的不是内核，是**三层生态包装**：注册（模板→插件）、分发（订阅→实例）、隔离（租户/插件命名空间）。

---

## 二、KAOR 生态化目标架构

```
┌──────────────────────────────────────────────────────┐
│                 Hermes Runtime（统一 Agent 底座）      │
├──────────────────────────────────────────────────────┤
│  Agent Lifecycle（生命周期）                           │
│    create → init → ready ⇄ running ⇄ paused → stop    │
│    多实例管理（云端实例池 + 本地实例）                  │
├──────────────────────────────────────────────────────┤
│  Memory（记忆系统）                                    │
│    统一 Memory API：ns.get/put/search/forget           │
│    命名空间：tenant/{tenantId}/plugin/{pluginId}/...   │
│    收敛 7 套记忆表 → 1 套 API + 领域扩展存储            │
├──────────────────────────────────────────────────────┤
│  Tool Calling（工具调用）                              │
│    工具注册表（tool.register）                         │
│    权限闸门（tool-permission → PluginPermission）       │
│    内置工具：browser / file / model / http / cron      │
├──────────────────────────────────────────────────────┤
│  Workflow（工作流）                                    │
│    收敛 5 套编排 → 1 套 Workflow Engine                 │
│    插件注册 workflow 类型（如「爆款视频生产流程」）      │
├──────────────────────────────────────────────────────┤
│  Scheduler（调度）                                     │
│    定时任务 / 事件触发 / 队列（复用 TaskQueue）         │
├──────────────────────────────────────────────────────┤
│  Local Execution（本地执行）                           │
│    云端实例 + 本地实例（Electron 内嵌同一内核）          │
│    Device Bridge 适配器（browser/file）                │
├──────────────────────────────────────────────────────┤
│  Plugin Loading（插件加载）                            │
│    插件 = AgentTemplate + Manifest + 版本               │
│    沙箱执行（plugin-sandbox）+ 能力白名单               │
└──────────────────────────────────────────────────────┘
```

---

## 三、关键设计决策

### 3.1 Agent 即插件（Agent-as-Plugin）

```
Plugin Manifest（agent 类型）
  ├── type: "agent"
  ├── agentTemplateId（引用 AgentTemplate）
  ├── soul.md（角色定义，HermesProfileBinding 已有此概念）
  ├── toolAllowList（如 ["browser","content","analytics"]）
  ├── workflowIds（预置工作流）
  ├── modelPreferences（模型需求，走 Model Gateway）
  └── subscription（订阅定价）

安装插件 → 实例化 EnterpriseAgentInstance（AI 员工）
  ├── HermesProfileBinding 自动创建（隔离命名空间）
  ├── 权限按 Manifest 授予
  └── 进入 Agent Lifecycle 管理
```

### 3.2 收敛策略（不推倒重来）

| 现状多套 | 收敛动作 | 兼容期 |
|---------|---------|--------|
| Agent 实体 ×6（AgentDefinition/EnterpriseAgentInstance/MarketAgent/CareerAgentTask/HdzAgentTask/WorkerTask） | 统一以 `EnterpriseAgentInstance` 为生态主实体，其余按领域子类收敛 | 保留领域表，通过适配层映射 |
| 记忆表 ×7 | 统一 Memory API + 命名空间；领域记忆（角色/世界观）作为「领域存储」挂载 | 旧表继续写，API 层统一 |
| 工作流引擎 ×5 | Workflow Engine 统一契约；`workflow-definition` 为主实现 | 高频路径迁移，其余冻结 |

### 3.3 本地执行（Runtime Placement）

```
Agent 任务 → Hermes 调度器决策：
  ├─ 需要本地设备（浏览器/文件/扫码）→ 本地实例执行
  ├─ 纯推理/API → 云端实例
  └─ 混合 → 云端编排 + 本地叶子任务
```

本地实例 = 同一内核（agent-runtime）打包进 Electron，通过 Device Bridge 与云端同步状态。**同一内核是「Local 不是真相源」的技术保证**。

### 3.4 插件安全边界

1. **沙箱**：插件代码在 plugin-sandbox 执行（已有基础），限制文件系统/网络/进程访问。
2. **权限闸门**：Manifest 声明的权限 → 平台授权 → 运行时工具闸门强制。
3. **命名空间隔离**：记忆/资产/凭证按 `tenant/{tenantId}/plugin/{pluginId}/agent/{agentInstanceId}` 隔离。
4. **凭证保护**：插件不直接接触平台凭证（CredentialVault 已有），通过受控 API 间接使用。
5. **审计**：插件全部动作进 AuditLog + AgentAuditTrail（已有），可追溯可回滚。

---

### 3.5 在线授权链路（订阅强制，防永久破解）

技术总监强调：**插件必须在线授权，到期必须续订**。

```
用户启动本地 App
  → Hermes（KAOR）启动
  → 连接昆仑镜 License Server
  → 校验：用户身份 + 订阅状态 + 插件授权
  → 通过 → 加载插件（Agent 实例就绪）
  → 订阅过期 → 插件进入 Expired（能力暂停，数据保留）
  → 应用基础功能继续（不受插件过期影响）
```

- **避免一次购买永久破解**：License 在线校验 + 心跳续期 + 离线宽限（7 天）。
- **插件过期 ≠ 应用不可用**：Kunlun Media 免费基础功能（账号/内容/基础发布/基础数据）持续可用，仅付费插件能力暂停。

---

## 四、Runtime 接口契约（插件 SDK 视角）

```typescript
// @kunlun/hermes-sdk（插件开发 SDK 核心）
interface HermesRuntime {
  lifecycle: {
    start(agentId): Promise<AgentHandle>
    pause(handle): Promise<void>
    stop(handle): Promise<void>
  }
  memory: {
    ns(namespace: string): MemoryNamespace  // get/put/search/forget
  }
  tools: {
    register(tool: ToolDefinition): void
    invoke(toolName: string, args: unknown): Promise<unknown>
  }
  workflow: {
    run(workflowId: string, input: unknown): Promise<ExecutionHandle>
    on(event: WorkflowEvent, cb): void
  }
  scheduler: {
    cron(expr: string, task: () => void): ScheduleHandle
    onTrigger(event: string, cb): void
  }
  model: {
    call(req: ModelRequest): Promise<ModelResponse>  // 走平台网关，自动计费
  }
  device: {  // 本地运行时才有
    browser: BrowserControl
    file: FileAccess
  }
}
```

---

## 五、演进路线（与整体 Roadmap 对齐）

| 阶段 | 内容 |
|------|------|
| Phase A（新媒体试点期） | Hermes Runtime 冻结接口契约；新媒体 AI 员工作为第一个「agent 插件」以 Manifest 化方式注册（不新建表，用 AgentTemplate 扩展字段） |
| Phase B（开发者生态） | Hermes SDK 发布；插件沙箱强化；开发者中心接入 |
| Phase C（本地运行时） | Electron 内嵌 Hermes 内核；Device Bridge 打通 |
| Phase D（市场分发） | 插件商城 + 订阅分账 + 自动升级闭环 |

---

## 六、风险清单

| # | 风险 | 缓解 |
|---|------|------|
| 1 | 收敛 5 套工作流/7 套记忆成本高 | 不物理删除，契约统一 + 适配层；Reality Gate 按工作台验证 |
| 2 | 本地实例与云端状态分裂 | 同一内核 + 状态线上同步；心跳冲突检测 |
| 3 | 插件沙箱逃逸 | 沙箱 + 权限闸门 + 审计三层；插件审核人工 + 自动化 |
| 4 | Hermes 内核被插件拖垮（资源） | 实例级资源配额（复用 CostBudget/ResourceCost） |
