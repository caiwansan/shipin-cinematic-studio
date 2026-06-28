// ============================================================
// Workflow Runtime Types (KMKI-PLAT-011)
// ============================================================

// ─── Node Types ───

export enum NodeType {
  Start = 'start',
  Agent = 'agent',
  Capability = 'capability',
  Condition = 'condition',
  Parallel = 'parallel',
  Loop = 'loop',
  Merge = 'merge',
  Delay = 'delay',
  Event = 'event',
  HumanApproval = 'humanApproval',
  HumanEdit = 'humanEdit',
  HumanReview = 'humanReview',
  HumanUpload = 'humanUpload',
  HumanDecision = 'humanDecision',
  End = 'end',
}

export const NODE_TYPES = Object.values(NodeType);

// ─── Node Status ───

export enum NodeStatus {
  Pending = 'pending',
  Running = 'running',
  Completed = 'completed',
  Failed = 'failed',
  Skipped = 'skipped',
  Paused = 'paused',
}

export enum InstanceStatus {
  Pending = 'pending',
  Running = 'running',
  Paused = 'paused',
  Completed = 'completed',
  Failed = 'failed',
  Cancelled = 'cancelled',
}

export enum WorkflowTrigger {
  Manual = 'manual',
  Event = 'event',
  Schedule = 'schedule',
  Webhook = 'webhook',
}

export enum VariableScope {
  Global = 'global',
  Workflow = 'workflow',
  Node = 'node',
  Output = 'output',
  Environment = 'environment',
}

// ─── DAG Types ───

export interface DagNode {
  id: string
  type: NodeType | string
  name: string
  config?: Record<string, any>
  position?: { x: number; y: number }
  metadata?: Record<string, any>
}

export interface DagEdge {
  id: string
  source: string
  target: string
  condition?: string
  label?: string
  metadata?: Record<string, any>
}

export interface DagDefinition {
  nodes: DagNode[]
  edges: DagEdge[]
}

// ─── Workflow Types ───

export interface WorkflowDefinition {
  id?: string
  code: string
  name: string
  version: string
  description?: string
  trigger?: string
  graph: DagDefinition | string
  variables?: Record<string, any> | string
  permissions?: Record<string, any> | string
  status?: string
  category?: string
  metadata?: Record<string, any> | string
  schemaVersion?: number
  createdAt?: Date
  updatedAt?: Date
}

export interface WorkflowInstance {
  id?: string
  workflowId: string
  workspaceId: string
  status?: string
  currentNode?: string
  input?: Record<string, any> | string
  output?: Record<string, any> | string
  result?: Record<string, any> | string
  cost?: number
  error?: string
  startedAt?: Date
  finishedAt?: Date
  metadata?: Record<string, any> | string
  createdAt?: Date
  updatedAt?: Date
}

export interface WorkflowNode {
  id?: string
  instanceId: string
  nodeId: string
  type: string
  name: string
  config?: Record<string, any> | string
  status?: string
  input?: Record<string, any> | string
  output?: Record<string, any> | string
  error?: string
  startedAt?: Date
  completedAt?: Date
  retryCount?: number
  metadata?: Record<string, any> | string
}

export interface WorkflowEdge {
  id?: string
  instanceId: string
  edgeId: string
  sourceNodeId: string
  targetNodeId: string
  condition?: string
  label?: string
  metadata?: Record<string, any> | string
}

export interface WorkflowCheckpoint {
  id?: string
  instanceId: string
  nodeId: string
  snapshot: Record<string, any> | string
  variables?: Record<string, any> | string
  metadata?: Record<string, any> | string
  createdAt?: Date
}

export interface WorkflowExecution {
  id?: string
  instanceId: string
  nodeId: string
  executionType: string
  executionId: string
  status?: string
  input?: Record<string, any> | string
  output?: Record<string, any> | string
  cost?: number
  latencyMs?: number
  error?: string
  startedAt?: Date
  completedAt?: Date
  metadata?: Record<string, any> | string
}

export interface WorkflowVariable {
  id?: string
  instanceId: string
  scope: string
  name: string
  value: string | any
  nodeId?: string
  metadata?: Record<string, any> | string
}

export interface WorkflowEvent {
  id?: string
  instanceId: string
  type: string
  nodeId?: string
  data?: Record<string, any> | string
  timestamp?: Date
}

export interface WorkflowTemplate {
  id?: string
  workflowId: string
  code: string
  name: string
  description?: string
  category?: string
  template: DagDefinition | string
  defaultVariables?: Record<string, any> | string
  metadata?: Record<string, any> | string
}

// ─── Workflow Context ───

export interface AgentDispatcher {
  dispatch(agentCode: string, input: any, ctx?: any): Promise<any>
  execute(agentCode: string, input: any, ctx?: any): Promise<any>
}

export interface CapabilityResolver {
  resolve(name: string, input: any, ctx?: any): Promise<any>
  validate(contractName: string, input: any): Promise<any>
}

export interface ResourceResolver {
  get(id: string): Promise<any>
  list(filter?: Record<string, any>): Promise<any[]>
}

export interface WorkflowLogger {
  info(msg: string, data?: any): void
  warn(msg: string, data?: any): void
  error(msg: string, data?: any): void
  debug(msg: string, data?: any): void
}

export interface WorkflowExecutionContext {
  traceId: string
  requestId: string
  userId?: string
  tenantId?: string
  permissions?: string[]
}

export interface WorkflowContext {
  instanceId: string
  workflowId: string
  workspaceId: string
  workspace: any
  variables: Record<string, any>
  executionContext: WorkflowExecutionContext
  agentDispatcher: AgentDispatcher
  capabilityResolver: CapabilityResolver
  resourceResolver: ResourceResolver
  logger: WorkflowLogger
  metadata?: Record<string, any>
}

// ─── Execution Result ───

export interface NodeExecutionResult {
  success: boolean
  output?: Record<string, any>
  error?: string
  cost?: number
  latencyMs?: number
  metadata?: Record<string, any>
}

export interface WorkflowExecutionResult {
  instanceId: string
  status: string
  output?: Record<string, any>
  result?: Record<string, any>
  error?: string
  cost?: number
  startedAt?: Date
  finishedAt?: Date
  nodeResults?: NodeExecutionResult[]
  metadata?: Record<string, any>
}
