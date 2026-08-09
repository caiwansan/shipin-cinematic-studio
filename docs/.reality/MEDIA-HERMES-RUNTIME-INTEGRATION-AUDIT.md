# MEDIA-HERMES-RUNTIME-INTEGRATION-AUDIT.md

> **Date**: 2026-08-08
> **Auditor**: OpenClaw (AI Architect)
> **Phase**: 0 — Task 01 前置审计（零代码改动）

---

## 审计摘要

| 问题 | 结果 | 证据 |
|------|------|------|
| Hermes 是否支持 spawn 子代理 | ⚠️ 部分 | HermesProfileBinding 存身份，但执行=直接调 Gateway |
| Agent Instance 如何进入 Hermes | ⚠️ 部分 | Binding 表记录身份，无真正 spawn |
| Workspace 如何提交任务 | ✅ 有路径 | `EnterpriseAgentRuntimeService.executeTask()` |
| Worker 如何执行 | ⚠️ 仅直接LLM | `executeViaGateway()` 直接调 LLM，不经 Hermes Worker |
| 结果如何保存 | ✅ 完整 | AgentOutcome + Action + AuditTrail 链路完整 |

---

## 已存在的执行链路（可复用）

```
AgentScheduler (agent-scheduler.runtime.ts)
  │
  ├─ 当前: 仅记录 mock 输出 ← TODO 待补
  │
  └─ 目标: 调用 EnterpriseAgentRuntimeService.executeTask()
                │
                ├─ Capability Gate 检查
                ├─ HermesProfileBinding 读身份
                ├─ MemoryAccessGate 验证
                ├─ ToolPermissionRuntimeGate 校验
                ├─ resolveEnterpriseModel() BYOK
                ├─ executeViaGateway() LLM 调用
                ├─ EnterpriseAgentTask 状态更新
                ├─ EnterpriseOutcome 写入
                ├─ AgentAuditTrail 记录
                └─ UsageLog 归因
```

---

## 核心差距

### 差距 1: AgentScheduler 没有真正调用 Runtime

**现状**: `agent-scheduler.runtime.ts` 第 96 行:
```typescript
// TODO: 未来接入实际LLM调用
const mockOutput = `[自动执行] ${taskTemplate.slice(0, 100)}...`
```

调度引擎每分钟 tick 一次，但只记录模拟结果。**这是最大阻塞点。**

### 差距 2: Media Agent 没有 HermesProfileBinding

**现状**: HermesProfileBinding 表中，media 域 agent 零记录。Career agent 有绑定，media 没有。

### 差距 3: Capability 没有 `media.*` 注册

**现状**: `TASK_CAPABILITY_MAP` 仅映射 `career_agent`，无媒体任务。`CapabilityRegistry` 框架存在但无 media 能力注册。

### 差距 4: executeTask 是 DB 操作，不是 Hermes spawn

**现状**: `executeTask()` 执行 LLM 调用但不 spawn Hermes 子代理进程。它直接调用 `executeViaGateway()`。对于 Task 01 的 MVP 来说，**这可以作为第一阶段接入点**——因为我们先证明"agent 能被调度、执行、产生结果"，再升级为完整 Hermes spawn。

---

## Reality Gate 调整

基于审计结果，Task 01 分两步走：

```
Phase A (本周): 调度器接通真实 executeTask → 证明 Agent 能活
Phase B (下周): 升级为 Hermes 子代理 spawn → 证明 Agent 是真人
```

Phase A 验收标准:
1. AgentScheduler tick → 调用 EnterpriseAgentRuntimeService.executeTask()
2. 真实 LLM 调用发生（非 mock）
3. EnterpriseOutcome 写入真实结果
4. AgentAuditTrail 记录完整链路
5. 前端可查看执行历史

---

*审计完成。Phase A 可立即启动。*
