/**
 * SPRINT-ECO-03 — KAOR Runtime Boundary Interface
 * KAOR = Kunlun AI Operating Runtime
 *
 * 这是生态 Runtime 的「契约层」：只定义接口，不实现执行。
 * 纪律（掌柜冻结）：
 *   ❌ 不拆 Hermes / 不重写 Runtime
 *   ❌ 不迁移现有 Agent（AgentTemplate / EnterpriseAgentProfile / EnterpriseAgentInstance / HermesProfileBinding 保持）
 *   ❌ 不开发本地执行（留给 Kunlun Media Local App Sprint）
 *   ❌ 不接插件执行（ECO-03 只建立 Runtime Contract）
 *
 * 每个方法的实现 = HermesAdapter（委托现有 Hermes，零修改）。
 */

// ─────────────────────────────────────────────────────────────
// 基础类型
// ─────────────────────────────────────────────────────────────

export interface KAORResult<T> {
  ok: boolean;
  data?: T;
  error?: {
    code: string; // NOT_IMPLEMENTED | PERMISSION_DENIED | NOT_FOUND | INTERNAL | VALIDATION
    message: string;
  };
  /** 诚实标注：真实执行 / 契约委托 / 未实现占位 */
  executedBy: 'hermes' | 'contract' | 'not_implemented';
}

export type KAORAgentStatusValue = 'active' | 'paused' | 'stopped' | 'archived' | 'draft';

export interface KAORAgentStatus {
  agentInstanceId: string;
  status: KAORAgentStatusValue;
  lifecycleState?: string;
  lastActiveAt?: Date;
  totalTasks?: number;
  totalErrors?: number;
}

export interface KAORAgentInstance {
  agentInstanceId: string;
  runtimeAgentId: string;
  namespace: string;
  role: string;
  status: KAORAgentStatusValue;
}

export interface KAORCreateAgentParams {
  organizationId: string;
  tenantId: string;
  role: string;
  name: string;
  agentType?: string;
  goal?: string;
  modelConfig?: { provider: string; model: string };
}

// 记忆契约（ECO-03 只声明；执行在 Local App Sprint）
export interface KAORMemoryQuery {
  namespace?: string;
  query?: string;
  limit?: number;
}

export interface KAORMemoryEntry {
  id: string;
  content: string;
  namespace: string;
  metadata?: Record<string, unknown>;
  createdAt?: Date;
}

// 工具契约（ECO-03 只做权限校验 + 委托声明；不执行插件代码）
export interface KAORToolCall {
  toolName: string;
  args: Record<string, unknown>;
  permission: string; // 工具对应权限点，如 'content.publish'
}

export interface KAORToolResult {
  toolName: string;
  success: boolean;
  output?: string;
  error?: string;
}

// 工作流契约（映射现有 Hermes WorkflowEngine）
export interface KAORWorkflowResult {
  workflowInstanceId?: string;
  status: 'running' | 'completed' | 'failed';
  result?: unknown;
  error?: string;
}

// 调度契约（映射现有 AgentScheduler / AgentScheduleService）
export interface KAORScheduledTask {
  scheduleId?: string;
  cron: string;
  taskType: string;
  input: string;
  enabled?: boolean;
}

export interface KAORScheduleReceipt {
  scheduleId: string;
  cron: string;
  status: 'scheduled' | 'delegated';
}

// ─────────────────────────────────────────────────────────────
// KAOR Runtime Boundary Interface
// ─────────────────────────────────────────────────────────────

export interface KAORRuntime {
  readonly runtimeId: string; // 'kaor'
  readonly adapterName: string; // 'hermes-adapter'
  readonly version: string;

  // ── Agent 生命周期（映射 Hermes IAgentLifecycle / AgentRuntimeAdapter）──
  createAgentInstance(params: KAORCreateAgentParams): Promise<KAORResult<KAORAgentInstance>>;
  startAgent(agentInstanceId: string): Promise<KAORResult<KAORAgentStatus>>;
  pauseAgent(agentInstanceId: string): Promise<KAORResult<KAORAgentStatus>>;
  stopAgent(agentInstanceId: string): Promise<KAORResult<KAORAgentStatus>>;
  getAgentStatus(agentInstanceId: string): Promise<KAORResult<KAORAgentStatus>>;

  // ── 记忆（契约声明，执行待 Local App Sprint）──
  loadMemory(agentInstanceId: string, query: KAORMemoryQuery): Promise<KAORResult<KAORMemoryEntry[]>>;

  // ── 工具（契约声明 + 权限校验，不执行插件代码）──
  executeTool(agentInstanceId: string, call: KAORToolCall): Promise<KAORResult<KAORToolResult>>;

  // ── 工作流（映射现有 Hermes WorkflowEngine）──
  executeWorkflow(
    agentInstanceId: string,
    workflowId: string,
    input: unknown
  ): Promise<KAORResult<KAORWorkflowResult>>;

  // ── 权限（映射 Hermes RuntimeContextService.hasPermission）──
  checkPermission(agentInstanceId: string, permission: string): Promise<KAORResult<boolean>>;

  // ── 调度（映射现有 AgentScheduler / AgentScheduleService）──
  scheduleTask(agentInstanceId: string, task: KAORScheduledTask): Promise<KAORResult<KAORScheduleReceipt>>;

  // ── 能力声明（Runtime Capability Registry 数据源）──
  getCapabilities(): KAORCapability[];
}

export interface KAORCapability {
  code: string; // 'agent.lifecycle' | 'memory' | 'workflow' | 'tool' | 'scheduler' | 'permission'
  name: string;
  description: string;
  /** 当前实现状态：delegated（委托现有 Hermes）/ contract（仅契约，执行待后续 Sprint） */
  status: 'delegated' | 'contract';
  /** 映射的现有 Hermes 服务/方法（只读映射表） */
  hermesMapping: string;
}
