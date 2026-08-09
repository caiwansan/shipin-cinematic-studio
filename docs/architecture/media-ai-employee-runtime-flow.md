# Media AI Employee Runtime Flow — 运行时生命周期

> **Version**: 1.0
> **Date**: 2026-08-08
> **Author**: OpenClaw (AI Architect)
> **Status**: Design Phase — Pre-Development
> **Design Gate**: APPROVED (掌柜 2026-08-08)
> **优先级**: P0-CRITICAL — 开发前必须就绪

---

## 1. 文件目的

**AI Employee Spec** 描述「这个员工是谁」。

**本文档** 描述「这个员工怎么活」。

```
AI Employee Spec        →  Identity / Goal / Permission / Capability (静态)
Runtime Flow (本文)     →  Wake Up → Execute → Sleep → Feedback (动态)
```

没有 Runtime Flow，员工只是数据库里的记录。有了 Runtime Flow，员工才是 Hermes 里真正执行的活体。

---

## 2. 一次完整 AI 员工工作的生命周期

```
Schedule Trigger
       ↓
  ┌─ Agent Wake Up ──────────────────────────────────┐
  │  1. Load Profile (HermesProfileBinding)          │
  │  2. Inject SOUL.md (soulMdContent)               │
  │  3. Load Memory (memoryNamespace)                │
  │  4. Check Permission (当前 Mode 是否允许)         │
  │  5. Load Context (ChannelAccount / Goal / History)│
  └──────────────────────┬───────────────────────────┘
                         ↓
  ┌─ Task Selection ─────────────────────────────────┐
  │  6. Read AgentSchedule (到期任务)                 │
  │  7. Read AgentGoal (今日目标)                     │
  │  8. Determine Task (匹配 Capability)              │
  └──────────────────────┬───────────────────────────┘
                         ↓
  ┌─ Hermes Spawn ───────────────────────────────────┐
  │  9. Hermes Runtime spawn sub-agent               │
  │  10. Bind Identity (Profile + SOUL + Memory)     │
  │  11. Bind Tools (Capability → Platform API)      │
  │  12. Set Permission Boundary (allow/deny list)   │
  └──────────────────────┬───────────────────────────┘
                         ↓
  ┌─ Capability Execution ───────────────────────────┐
  │  13. Capability Resolver route to Adapter        │
  │  14. Adapter translate to Platform call          │
  │  15. Execute (Browser / API / LLM)               │
  │  16. Collect Result                              │
  └──────────────────────┬───────────────────────────┘
                         ↓
  ┌─ Result Processing ──────────────────────────────┐
  │  17. Write AgentOutcome (SSOT)                   │
  │  18. Update AgentGoal (actualCount++)            │
  │  19. Append Memory (关键信息 → memoryNamespace)  │
  │  20. Check Approval Need (Tier 2/3 → push)       │
  └──────────────────────┬───────────────────────────┘
                         ↓
  ┌─ Notify Human ───────────────────────────────────┐
  │  21. Push Notification (if needed)               │
  │  22. Update Dashboard (今日完成数)               │
  │  23. Log Audit Trail (ActionAuditLog)            │
  └──────────────────────┬───────────────────────────┘
                         ↓
  ┌─ Agent Sleep ────────────────────────────────────┐
  │  24. Release Resources (Hermes sub-agent end)    │
  │  25. Update Instance Status → IDLE               │
  │  26. Next Schedule Check                         │
  └──────────────────────────────────────────────────┘
```

---

## 3. 各阶段详细规格

### Phase 1: Agent Wake Up

```typescript
/**
 * Agent Wake Up — 从数据库记录变为活体
 * 
 * 输入: scheduleId (AgentScheduler 触发)
 * 输出: AgentExecutionContext (员工完整上下文)
 */
interface AgentWakeUpInput {
  scheduleId: string
  agentInstanceId: string
  triggeredBy: 'scheduler' | 'event' | 'manual'
  triggeredAt: Date
}

interface AgentExecutionContext {
  // 身份层
  profile: EnterpriseAgentProfile
  instance: EnterpriseAgentInstance
  binding: HermesProfileBinding
  soulContent: string              // SOUL.md 原文
  
  // 记忆层
  memoryNamespace: string          // tenant/{t}/agent/{a}
  shortTermMemory: Memory[]        // 最近 7 天
  longTermMemory: Memory[]         // 关键持久记忆
  
  // 权限层
  permission: AgentPermission
  mode: 'AUTO' | 'APPROVAL_REQUIRED' | 'ALERT_FIRST' | 'MANUAL'
  
  // 上下文层
  channelAccounts: ChannelAccount[]     // 已授权的平台账号
  todayGoals: AgentGoal[]               // 今日目标
  recentOutcomes: AgentOutcome[]        // 最近执行结果
  pendingApprovals: ApprovalItem[]      // 待审批事项
}

// Wake Up 流程
async function wakeUpAgent(input: AgentWakeUpInput): Promise<AgentExecutionContext> {
  // 1. 加载 Profile + Instance + Binding
  const profile = await loadAgentProfile(input.agentInstanceId)
  const binding = await loadHermesBinding(input.agentInstanceId)
  
  // 2. 注入 SOUL (准备 Hermes 子代理的系统提示)
  const soulContent = binding.soulMdContent
  
  // 3. 加载 Memory (从 Memory Service 读取 namespace 下的记忆)
  const memory = await loadMemory(binding.memoryNamespace)
  
  // 4. 检查 Permission
  const permission = await loadPermission(input.agentInstanceId)
  assertModeAllows(permission, input.triggeredBy)
  
  // 5. 加载业务上下文
  const channelAccounts = await loadChannelAccounts(profile.organizationId)
  const todayGoals = await loadTodayGoals(input.agentInstanceId)
  const recentOutcomes = await loadRecentOutcomes(input.agentInstanceId, 7)
  
  return {
    profile, instance: profile.instance, binding,
    soulContent, memory,
    permission, mode: permission.mode,
    channelAccounts, todayGoals, recentOutcomes,
    pendingApprovals: []
  }
}
```

### Phase 2: Task Selection

```typescript
/**
 * Task Selection — 确定本次要执行什么
 * 
 * 逻辑:
 *   1. AgentSchedule 到期任务 > 2. 今日未完成目标 > 3. 待审批事项 > 4. IDLE
 */
interface SelectedTask {
  taskId: string
  taskType: 'scheduled' | 'goal_driven' | 'event_driven' | 'approval_driven'
  capabilityId: string              // 将调用的 Capability
  priority: number                  // 0=最高 (scheduled), 1=goal, 2=event
  input: any                        // Capability 输入参数
  needsApproval: boolean            // 是否需要审批
}

async function selectTask(ctx: AgentExecutionContext): Promise<SelectedTask | null> {
  // 1. 检查 AgentSchedule 到期任务
  const dueSchedule = await checkDueSchedules(ctx.instance.id)
  if (dueSchedule) {
    return {
      taskId: dueSchedule.id,
      taskType: 'scheduled',
      capabilityId: dueSchedule.capabilityId,
      priority: 0,
      input: dueSchedule.taskParams,
      needsApproval: isApprovalRequired(ctx.permission, dueSchedule.capabilityId)
    }
  }
  
  // 2. 检查今日未完成目标
  const unfinishedGoal = ctx.todayGoals.find(g => g.actualCount < g.targetCount)
  if (unfinishedGoal) {
    return {
      taskId: unfinishedGoal.id,
      taskType: 'goal_driven',
      capabilityId: goalToCapability(unfinishedGoal.goalType),
      priority: 1,
      input: { goal: unfinishedGoal },
      needsApproval: isApprovalRequired(ctx.permission, goalToCapability(unfinishedGoal.goalType))
    }
  }
  
  // 3. 无需执行
  return null
}
```

### Phase 3: Hermes Spawn

```typescript
/**
 * Hermes Spawn — 在 Hermes Runtime 中创建子代理
 * 
 * 关键: 这不是"调用 LLM"，而是"spawn 一个有身份的执行体"
 */
interface HermesSpawnConfig {
  // 身份
  agentName: string                 // Alice / Bob / Carol
  soulContent: string               // SOUL.md → 系统提示
  role: string                      // 运营总监 / 内容运营 / 用户增长
  
  // 记忆
  memoryNamespace: string
  shortTermMemory: Memory[]
  
  // 工具
  toolAllowList: string[]           // Capability ID 列表
  
  // 输出
  outputSchema: any                 // 期望的输出格式
  
  // 约束
  maxSteps: number                  // 最大执行步数
  timeoutSeconds: number            // 超时
  requireApproval: boolean          // 是否需要审批
}

async function spawnHermesAgent(
  ctx: AgentExecutionContext,
  task: SelectedTask
): Promise<HermesSubAgent> {
  const config: HermesSpawnConfig = {
    agentName: ctx.profile.displayName,
    soulContent: ctx.soulContent,
    role: ctx.profile.role,
    memoryNamespace: ctx.memoryNamespace,
    shortTermMemory: ctx.shortTermMemory,
    toolAllowList: ctx.binding.toolAllowList,
    outputSchema: getOutputSchema(task.capabilityId),
    maxSteps: 20,
    timeoutSeconds: 300,
    requireApproval: task.needsApproval
  }
  
  // Hermes Runtime 创建子代理
  const subAgent = await hermesRuntime.spawnSubAgent({
    ...config,
    // BYOK: 使用用户自有 Key
    modelConfig: await loadUserModelConfig(ctx.profile.organizationId),
    // 父 Agent 引用 (用于审计)
    parentAgentId: ctx.instance.id,
    // 任务引用
    taskId: task.taskId,
    taskType: task.taskType
  })
  
  return subAgent
}
```

### Phase 4: Capability Execution

```typescript
/**
 * Capability Execution — 通过 Capability 路由到外部平台
 * 
 * 这是 AI 员工真正「动手」的阶段
 */
interface CapabilityCall {
  capabilityId: string
  adapterName: string               // DouyinAdapter / HermesAdapter / ...
  adapterCall: string               // publishContent / searchTrends / ...
  params: any
}

async function executeViaCapability(
  subAgent: HermesSubAgent,
  task: SelectedTask,
  ctx: AgentExecutionContext
): Promise<CapabilityResult> {
  // 1. Capability Resolver 路由
  const route = capabilityResolver.resolve(task.capabilityId)
  
  // 2. 获取凭证 (Credential Vault → 不解密，传引用)
  const credentialRef = ctx.channelAccounts.find(
    ca => ca.platform === route.platform
  )?.credentialRef
  
  // 3. Adapter 执行
  const adapter = PlatformAdapterFactory.create(route.platform, {
    credentialRef,
    sessionRef: getSessionRef(ctx, route.platform)
  })
  
  // 4. 执行 (子代理通过工具调用链)
  const result = await subAgent.executeToolCall({
    tool: route.adapterCall,
    params: {
      ...task.input,
      credentialRef,    // 凭证引用，Adapter 内部解密
      sessionContext: getPlatformSession(ctx, route.platform)
    }
  })
  
  return result
}
```

### Phase 5: Result Processing

```typescript
/**
 * Result Processing — 处理执行结果
 * 
 * 关键: 写入 AgentOutcome (执行结果 SSOT)
 */
async function processResult(
  ctx: AgentExecutionContext,
  task: SelectedTask,
  result: CapabilityResult
): Promise<void> {
  // 1. 写入 AgentOutcome
  await writeAgentOutcome({
    id: generateUUID(),
    agentInstanceId: ctx.instance.id,
    taskId: task.taskId,
    taskType: task.taskType,
    capabilityId: task.capabilityId,
    outcomeType: result.success ? 'success' : 'failure',
    metricValue: result.metrics || {},
    metadata: {
      platform: result.platform,
      duration: result.duration,
      params: summarizeParams(task.input),
      summary: result.summary
    },
    organizationId: ctx.profile.organizationId,
    createdAt: new Date()
  })
  
  // 2. 更新 AgentGoal 进度
  if (result.success) {
    await incrementGoalActual(ctx.instance.id, task.taskType)
  }
  
  // 3. 写入 Memory (关键信息)
  if (result.keyInsights?.length > 0) {
    await appendMemory(ctx.memoryNamespace, {
      type: 'execution_insight',
      content: result.keyInsights,
      timestamp: new Date(),
      source: `task:${task.taskId}`
    })
  }
  
  // 4. 检查是否需要推送审批
  if (task.needsApproval) {
    await createApprovalItem({
      agentInstanceId: ctx.instance.id,
      taskType: task.taskType,
      content: result.generatedContent,
      capabilityId: task.capabilityId,
      status: 'pending',
      createdAt: new Date()
    })
  }
}
```

### Phase 6: Notify Human

```typescript
/**
 * Notify Human — 通知用户
 * 
 * 原则: 不是每条都通知，按优先级和用户偏好
 */
async function notifyHuman(
  ctx: AgentExecutionContext,
  task: SelectedTask,
  result: CapabilityResult
): Promise<void> {
  const notification = {
    agentName: ctx.profile.displayName,
    agentAvatar: ctx.profile.avatar,
    title: generateNotificationTitle(task, result),
    body: generateNotificationBody(task, result),
    priority: getPriority(task, result),
    actionRequired: task.needsApproval,
    taskId: task.taskId
  }
  
  // 按用户偏好渠道推送
  await pushService.send(ctx.profile.organizationId, notification)
  
  // 审计日志
  await auditLog.log({
    actor: ctx.instance.id,
    action: 'notify_human',
    target: ctx.profile.organizationId,
    metadata: { taskId: task.taskId, notification: notification.title }
  })
}
```

### Phase 7: Agent Sleep

```typescript
/**
 * Agent Sleep — 释放资源，等待下一次唤醒
 */
async function sleepAgent(
  ctx: AgentExecutionContext,
  subAgent: HermesSubAgent
): Promise<void> {
  // 1. 结束 Hermes 子代理
  await hermesRuntime.endSubAgent(subAgent.id)
  
  // 2. 更新 Instance 状态
  await updateInstanceStatus(ctx.instance.id, 'IDLE')
  
  // 3. 更新最后活跃时间
  await updateLastActiveAt(ctx.instance.id, new Date())
  
  // 4. 检查是否有连续失败
  const recentFailures = await countRecentFailures(ctx.instance.id, 5)
  if (recentFailures >= 3) {
    await triggerAlert(ctx.instance.id, 'CONSECUTIVE_FAILURES')
    await pauseAgent(ctx.instance.id, 'AUTO_PAUSED_AFTER_FAILURES')
  }
  
  // 5. 更新下次调度时间
  await updateNextRunAt(ctx.instance.id)
}
```

---

## 4. 完整调用链示例

### 场景: Alice 执行「每日热点分析」

```
[08:00] AgentScheduler tick()
  │
  ├─ 检查 AgentSchedule: Alice 热点分析任务到期
  │
  ├─ Phase 1: Wake Up
  │   ├─ Load Profile → Alice (运营总监, org=xxx)
  │   ├─ Load SOUL → "你是 Alice，昆仑镜运营团队..."
  │   ├─ Load Memory → [近7天热点, 老板偏好, 竞品名单]
  │   ├─ Check Permission → Mode: AUTO_WITH_ALERT ✅
  │   ├─ Load ChannelAccounts → [抖音 ✅, 小红书 ✅, 快手 ✅]
  │   └─ Load Goals → today: {analysis: 0/1, report: 0/1}
  │
  ├─ Phase 2: Task Selection
  │   └─ SelectedTask: {capability: media.trend.analysis, priority: 0}
  │
  ├─ Phase 3: Hermes Spawn
  │   ├─ spawnSubAgent(name="Alice", soul="你是 Alice...", tools=[search, llm])
  │   ├─ Bind BYOK modelConfig
  │   └─ Set maxSteps=20, timeout=300s
  │
  ├─ Phase 4: Capability Execution
  │   ├─ Step 1: platform.search.trends → 抖音热搜 TOP20
  │   ├─ Step 2: platform.search.trends → 小红书热搜 TOP20
  │   ├─ Step 3: platform.search.web → 行业新闻
  │   ├─ Step 4: platform.llm.generate → 分析总结 + 选题建议
  │   └─ Step 5: platform.storage.put → 缓存报告
  │
  ├─ Phase 5: Result Processing
  │   ├─ Write AgentOutcome → {outcome: success, reportId: xxx}
  │   ├─ Update Goal → analysis: 1/1 ✅
  │   ├─ Append Memory → "今日发现热点: XX话题 +120%"
  │   └─ No Approval Needed (Tier 1 + Tier 2 auto)
  │
  ├─ Phase 6: Notify Human
  │   └─ Push: "📊 Alice 完成今日热点分析 — TOP5 已生成"
  │
  └─ Phase 7: Sleep
      ├─ End SubAgent
      ├─ Update Status → IDLE
      └─ Next Schedule: 20:00 运营复盘
```

---

## 5. 异常处理

### 5.1 执行失败

```
Execution Failed
  ├─ Retry (最多 3 次，间隔 30s/60s/120s)
  ├─ Still Failed
  │   ├─ Write AgentOutcome {outcome: 'failure', error: reason}
  │   ├─ Notify Human: "⚠️ Alice 的热点分析执行失败: reason"
  │   └─ Continue to Sleep (不阻塞下一个任务)
  └─ Consecutive Failures >= 3
      ├─ Pause Agent (自动)
      ├─ Alert Human: "🔴 Alice 连续 3 次失败，已自动暂停"
      └─ Require Manual Recover
```

### 5.2 权限不足

```
Permission Denied
  ├─ Log Attempt (ActionAuditLog)
  ├─ Skip Task (不执行)
  ├─ Notify Human: "⚠️ Alice 尝试执行 XX，但当前模式不允许"
  └─ Re-evaluate Next Task
```

### 5.3 凭证失效

```
Credential Expired
  ├─ Mark ChannelAccount health = 'expired'
  ├─ Skip Platform-related Tasks
  ├─ Notify Human: "🔴 快手登录态已失效，请重新扫码"
  └─ Continue with Available Platforms
```

### 5.4 超时

```
Execution Timeout (300s)
  ├─ Force End SubAgent
  ├─ Write AgentOutcome {outcome: 'timeout'}
  ├─ Notify Human: "⚠️ Alice 的热点分析超时（>5min）"
  └─ Sleep
```

---

## 6. 状态机

```
                    ┌──────────────────────────────────────────────┐
                    │                                              │
                    ▼                                              │
                  ┌──────┐                                         │
            ┌──── │ IDLE │ ←─────────────────────────────────────┐ │
            │     └──┬───┘                                       │ │
            │        │ Schedule Trigger                          │ │
            │        ▼                                           │ │
            │    ┌────────┐                                      │ │
            │    │ WAKING │ (Load Profile + Memory + Permission) │ │
            │    └──┬─────┘                                      │ │
            │       │                                            │ │
            │       ▼                                            │ │
            │   ┌──────────┐                                     │ │
            │   │ EXECUTING│ (Hermes Sub-Agent Running)          │ │
            │   └─┬────┬───┘                                     │ │
            │     │    │                                         │ │
            │  Success│  │Failure/Timeout                        │ │
            │     │    │                                         │ │
            │     ▼    ▼                                         │ │
            │  ┌───────────┐                                     │ │
            │  │ PROCESSING│ (Write Outcome + Update Goal)       │ │
            │  └─────┬─────┘                                     │ │
            │        │                                           │ │
            │        ▼                                           │ │
            │   ┌──────────┐                                     │ │
            │   │ NOTIFYING│ (Push if needed)                    │ │
            │   └─────┬────┘                                     │ │
            │        │                                           │ │
            │        ▼                                           │ │
            │      ┌──────┐                                      │ │
            └───── │ IDLE │ ────────────────────────────────────┘ │
                   └──────┘                                       │
                                                                   │
                  ┌──────────┐                                     │
          ┌────── │ PAUSED   │ ←─── User / Auto (Failures>=3)     │
          │       └────┬─────┘                                     │
          │            │ Resume                                    │
          │            ▼                                           │
          │          IDLE ────────────────────────────────────────┘
          │
          │       ┌──────────┐
          └────── │ STOPPED  │ ─── Manual Only
                  └──────────┘
```

---

## 7. 数据结构汇总

```typescript
// 核心执行上下文 (Phase 1 产出)
interface AgentExecutionContext {
  profile: EnterpriseAgentProfile
  instance: EnterpriseAgentInstance
  binding: HermesProfileBinding
  soulContent: string
  memory: { shortTerm: Memory[], longTerm: Memory[] }
  permission: AgentPermission
  mode: string
  channelAccounts: ChannelAccount[]
  todayGoals: AgentGoal[]
  recentOutcomes: AgentOutcome[]
}

// 选定任务 (Phase 2 产出)
interface SelectedTask {
  taskId: string
  taskType: 'scheduled' | 'goal_driven' | 'event_driven' | 'approval_driven'
  capabilityId: string
  priority: number
  input: any
  needsApproval: boolean
}

// 执行结果 (Phase 4 产出)
interface CapabilityResult {
  success: boolean
  platform?: string
  duration: number
  metrics?: Record<string, number>
  summary: string
  generatedContent?: any      // 需要审批的内容
  keyInsights?: string[]      // 写入 Memory
  error?: string
}

// 审批项 (Phase 5 产出，如需)
interface ApprovalItem {
  id: string
  agentInstanceId: string
  taskType: string
  content: any
  capabilityId: string
  status: 'pending' | 'approved' | 'rejected'
  createdAt: Date
}
```

---

## 8. 验收标准（Reality Gate）

| 验收项 | 标准 |
|--------|------|
| 员工不是数据库记录 | ✅ Hermes 子代理真实 spawn 并执行任务 |
| 执行链路完整 | ✅ Wake Up → Select → Spawn → Execute → Process → Notify → Sleep |
| 结果写入 SSOT | ✅ AgentOutcome 有记录，AgentGoal 进度更新 |
| Memory 持续积累 | ✅ 关键信息写入 memoryNamespace，下次唤醒可用 |
| 审批流工作 | ✅ Tier 2/3 内容进入 Approval Center，用户可审批 |
| 异常自愈 | ✅ 连续失败 3 次自动暂停，凭证过期跳过 |
| 权限控制 | ✅ 禁止的动作不执行，尝试记录审计日志 |
| BYOK | ✅ AI 调用走 UserModelConfigV2，不走平台 Key |

---

*本文档必须在开发前完成。是 P0-CRITICAL 前置条件。*
