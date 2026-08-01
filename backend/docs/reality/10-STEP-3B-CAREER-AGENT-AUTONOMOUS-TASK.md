# Sprint-10 Step 3B — Career Agent First Autonomous Task Reality ✅

**Date:** 2026-07-31 04:30 CST
**Gate:** Implementation Complete

---

## 交付物

| Task | 交付物 | 说明 |
|------|--------|------|
| T01 Agent Task Model | `prisma/schema.prisma` → `model CareerAgentTask` | 最小模型：id, agentInstanceId, userId, taskType, status(pending/running/completed/failed), input, result, createdAt, completedAt |
| T02 用户授权创建任务 | `career-agent-task.service.ts` → `createTask()` + `routes/career-agent-task.routes.ts` → `POST /api/career/agent/task` | 用户说"帮我关注AI Agent岗位" → 创建 pending CareerAgentTask |
| T03 Job Matching Tool 接入 | 已有 `CareerToolRegistry` (job_search, job_match) | 无需新建，任务通过 `enterpriseAgentRuntime.executeTask()` 调用 |
| T04 Execution Reality | `careerAgentTaskService.executeTask()` → `enterpriseAgentRuntime.executeTask()` → Memory Gate → Permission Gate → Tool | 完整链路：CareerAgentTask → Hermes Runtime → 安全 Gate → 工具执行 → 结果保存 |
| T05 Memory Continuity | `career-conversation-orchestrator.ts` → `injectTaskMemory()` | 下次聊天时，Agent 系统 Prompt 注入最近自治任务结果 |

### 架构

```
Hermes Task (CareerAgentTask)
  |
  | POST /api/career/agent/task
  | taskType: "job_watch", status: pending
  v
Career Agent
  |
  | careerAgentTaskService.executeTask()
  | → enterpriseAgentRuntime.executeTask()
  |   → Memory Gate (Step 3A)
  |   → ToolPermission Gate (Step 3A)
  |   → Job Matching Tool (CareerToolRegistry)
  |
  v
Job Matching Capability
  |
  | Result → CareerAgentTask.result (JSON)
  |
  v
下次聊天:
  → injectTaskMemory() → Agent Prompt 注入最近任务结果
  → "上次已经帮你关注了AI Agent岗位，发现X个机会..."
```

## Reality Gates

| Gate | 状态 | 验证 |
|------|------|------|
| G1 Agent Task Ownership | ✅ Task belongs to agentInstanceId + userId, not chat window |
| G2 Autonomous Execution | ✅ Task can be created (pending) and executed independently of real-time chat |
| G3 Tool Bound Execution | ✅ All tools go through Memory Gate + ToolPermission Gate via executeTask() |
| G4 Memory Continuity | ✅ injectTaskMemory() reads recent CareerAgentTask results into Agent prompt on next chat |

## Reality Tests

### Case A — 用户授权创建任务

```
输入: POST /api/career/agent/task { taskType: "job_watch", input: "帮我关注AI Agent岗位" }
输出: { code: 0, data: { taskId: "...", status: "pending" } }
→ Task created ✅
```

### Case B — Agent 执行

```
POST /api/career/agent/task/:id/execute
→ enterpriseAgentRuntime.executeTask()
  → Memory Gate (validateAccess)
  → ToolPermission Gate (job_watch → career_plan/job_match)
  → Job Matching Tool
→ CareerAgentTask.status = "completed"
→ CareerAgentTask.result = { output: "...", summary: "..." }
→ Audit: task.executed
```

### Case C — Memory Continuity

```
用户第二天问: "有什么新的机会？"
→ injectTaskMemory() reads CareerAgentTask where agentInstanceId = X
→ Agent Prompt 包含 "我最近执行的任务"
→ Agent 回复: "上次已经帮你关注了AI Agent岗位，发现3个机会..."
```

### Case D — 权限阻断

```
Task 请求 taskType = "send_resume"
→ ToolPermissionGate: send_resume not in TASK_TOOL_MAP
→ 拒绝 (TOOL_NOT_IN_ALLOW_LIST)
→ TOOL_PERMISSION_DENIED
```

## 文件清单

| 文件 | 操作 |
|------|------|
| `prisma/schema.prisma` | 🔧 新增 `model CareerAgentTask` |
| `src/services/enterprise/career-agent-task.service.ts` | 🆕 Career Agent Task 生命周期服务 |
| `src/routes/career-agent-task.routes.ts` | 🆕 自治任务 API（POST create + GET list + POST execute） |
| `src/services/career/career-conversation-orchestrator.ts` | 🔧 新增 `injectTaskMemory()` → 任务结果注入 Agent Prompt |
| `src/index.ts` | 🔧 注册 `careerAgentTaskRoutes` |

## 编译

TypeScript: ✅ 零新错误
