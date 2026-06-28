# System Convergence Constitution

**生效日期**: 2026-05-30  
**状态**: ACTIVE — 系统进入收敛模式  
**覆写**: 本宪法优先级高于所有历史架构设计和新增功能需求

---

## Article I — 宪法冻结（Constitutional Freeze）

系统正式进入 **SYSTEM CONVERGENCE MODE**。

### 1.1 禁止新增

以下方向在收敛期内无条件冻结：

| 类别 | 说明 |
|------|------|
| 新 Runtime | 任何新的执行引擎、运行时层 |
| 新 Execution Layer | 新的执行抽象 |
| 新 Graph Engine | 新的图引擎 |
| 新 Queue Abstraction | 新的队列抽象层 |
| 新 Governance Layer | 新的治理层 |
| 新 Scheduler | 新的调度器 |
| 新 Replay Engine | 新的回放引擎 |
| 新 Frontend Runtime State | 前端新的运行时状态模块 |
| 新 Runtime Database Table | 新的运行时数据库表 |

### 1.2 禁止扩张

以下模块维持当前形态，不新增逻辑：

- OMS 世界观系统
- 创作者 DNA
- 多租户组织（Organization / Workspace）
- GPU 云平台层
- Kernel 双轨执行
- 社区经济体系

### 1.3 允许

- Bug fix
- Observability（可观测性增强）
- Deletion（删除代码/表/目录）
- Convergence（向最终架构收敛的重构）
- Topology Audit（拓扑审计）
- Runtime Collapse（执行层塌缩）
- Frontend De-Runtimeization（前端去运行时化）

---

## Article II — 最终架构目标（Target Architecture）

### 2.1 四层结构

```
┌─────────────────────────────────┐
│         Studio UI               │  — 编辑/可视化/交互
├─────────────────────────────────┤
│         Runtime Core            │  — 唯一执行真相层
├─────────────────────────────────┤
│       Capability Service        │  — 执行策略层
├─────────────────────────────────┤
│       Provider Adapter          │  — 厂商协议适配
└─────────────────────────────────┘
```

### 2.2 各层定义

#### Studio UI

**属于**：
- 编辑器状态
- Timeline 交互
- Scene Composition
- Asset Workspace
- 可视化（Visual Graph as view only）
- AI Co-Pilot UI

**禁止**：
- Orchestration（编排）
- Retry（重试）
- Dispatch Authority（调度权）
- Runtime Mutation（执行状态修改）
- Queue Ownership（队列所有权）

#### Runtime Core

**只拥有**：
- Execution lifecycle（执行生命周期）
- State machine（状态机）
- Event append（事件追加）
- Stream coordination（流协调）
- Cancellation（取消）
- Timeout boundary（超时边界）

**必须不知晓**：
- Provider names（厂商名）
- Routing policy（路由策略）
- Retry policy（重试策略）
- Cost optimization（成本优化）
- Fallback strategy（降级策略）
- Governance rules（治理规则）

**宪法条文 2.2-a**: Runtime Core 中出现 `if provider === "xxx"` 或同类条件判断，视为 **ARCHITECTURAL VIOLATION**，必须打回。

#### Capability Service

**负责**：
- Provider routing（厂商路由）
- Retry strategy（重试策略）
- Fallback policy（降级策略）
- Cost optimization（成本优化）
- Shadow execution（影子执行）
- Governance policy（治理策略）
- Experimentation（实验/AB测试）

**不拥有** execution truth（执行真相）。

**宪法条文 2.2-b — Capability Service 边界**：
Capability Service **禁止**：
1. 直接修改 execution state（不能写 task status、pipeline stage 等）
2. 直接写入 task lifecycle 状态
3. 直接调用 provider HTTP endpoint（必须通过 Provider Adapter）
4. 持有 runtime truth（不能成为 execution 状态源）
5. 参与 event append（不生产 execution event）
6. 被 frontend 直接作为 state source（前端不得绕过 Runtime Core 直接问 Capability Service 拿执行状态）

**Capability Service 唯一输出**：抽象的 execution plan（意图描述），而非 execution state。
**任何 executor/execute 动词出现在 Capability Service 中，视为 ARCHITECTURAL VIOLATION**。

数据流强制路径：
```
Frontend → Routes → Capability Service → Runtime Core → Provider Adapter → Provider
```
Capability Service 不得绕过 Runtime Core。

#### Provider Adapter

**负责**：
- Provider protocol translation（厂商协议翻译）
- Stream normalization（流归一化）
- Provider-specific payload conversion（特定厂商负载转换）

---

## Article III — Event Log 原则

### 3.1 Hybrid Event Projection

- **Event Log = Truth**（事件日志是唯一的真相源）
- **Projection State = Cache**（投影状态只是缓存）

禁止以 `UPDATE task SET status='running'` 作为唯一真相源。

### 3.2 迁移路径

```
Week 1: 建立 Runtime Event Log（老系统继续运行）
Week 2: 新任务 dual-write（old state + event append）
Week 3: Frontend/Queue 开始只读 event stream
Week 4: Projection reverse-build，关闭 legacy state path
```

---

## Article IV — 前端去运行时化

### 4.1 Frontend 只允许

- Editor state
- Viewport state
- Interaction state
- Temporary visualization state

### 4.2 Frontend 禁止

- Execution authority
- Runtime orchestration
- Retry ownership
- Graph execution ownership
- Replay authority

### 4.3 Visual Graph

可保留，但仅作为 **visualization layer**，不是 **execution layer**。

---

## Article V — 设计归属检查

所有新的代码提交必须先回答：

> **这个逻辑属于：Studio UI / Runtime Core / Capability Service / Provider Adapter？**

无法明确归属的，禁止进入系统。

---

## Article VI — 成功标准

90 天收敛成功的可验证标准：

1. **单一 Runtime Authority** — 系统只有一个执行真相源
2. **Frontend 不再承担 Runtime Execution**
3. **Runtime Core 不包含 Provider Awareness**
4. **Capability Strategy 与 Execution Truth 分离**
5. **数据库回归业务持久层** — 运行时状态不持久化到 PostgreSQL
6. **Execution Layer 收敛至 3 层以内**
7. **团队能凭直觉回答"这个逻辑属于哪一层"**

---

*本宪法可通过团队全员共识修改，单方不得违反。*
