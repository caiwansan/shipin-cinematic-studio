// ============================================================
// Frontend Workflow Types (KMKI-PLAT-011)
// ============================================================

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

export interface WorkflowDefinition {
  id?: string
  code: string
  name: string
  version: string
  description?: string
  trigger?: string
  graph: DagDefinition | string
  variables?: any
  permissions?: any
  status?: string
  category?: string
  metadata?: any
  schemaVersion?: number
  createdAt?: string
  updatedAt?: string
}

export interface WorkflowInstance {
  id?: string
  workflowId: string
  workspaceId: string
  status?: string
  currentNode?: string
  input?: any
  output?: any
  result?: any
  cost?: number
  error?: string
  startedAt?: string
  finishedAt?: string
  metadata?: any
  createdAt?: string
  updatedAt?: string
}

export interface WorkflowNode {
  id?: string
  instanceId: string
  nodeId: string
  type: string
  name: string
  config?: any
  status?: string
  input?: any
  output?: any
  error?: string
  startedAt?: string
  completedAt?: string
  retryCount?: number
  metadata?: any
}

export interface WorkflowEdge {
  id?: string
  instanceId: string
  edgeId: string
  sourceNodeId: string
  targetNodeId: string
  condition?: string
  label?: string
  metadata?: any
}

export interface WorkflowEvent {
  id?: string
  instanceId: string
  type: string
  nodeId?: string
  data?: any
  timestamp?: string
}

export interface WorkflowCheckpoint {
  id?: string
  instanceId: string
  nodeId: string
  snapshot?: any
  variables?: any
  createdAt?: string
}

export interface WorkflowTemplate {
  id?: string
  workflowId: string
  code: string
  name: string
  description?: string
  category?: string
  template?: any
  defaultVariables?: any
}

export interface WorkflowHealth {
  status: string
  definitionCount: number
  activeInstanceCount: number
  runningInstanceCount: number
  failedInstanceCount: number
}

export interface InstanceDetail {
  instance: WorkflowInstance | null
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  events: WorkflowEvent[]
  checkpoints: WorkflowCheckpoint[]
}

export interface HumanResponsePayload {
  nodeType: string
  action: string
  data?: Record<string, any>
}
