/**
 * agent-runtime/types/agent-runtime.types.ts
 * Agent Runtime Kernel — 核心类型定义
 */

export type AgentStatus = 'draft' | 'active' | 'paused' | 'archived';
export type RuntimeType = 'openclaw' | 'hermes';

export interface AgentConfig {
  name: string;
  role: string;
  agentType: string;
  description?: string;
  goal?: string;
  avatarUrl?: string;
  knowledgeScope?: string[];
  capabilities?: string[];
  escalationRules?: Record<string, any>;
  kpiMetrics?: Record<string, any>;
  isDefault?: boolean;
  metadata?: Record<string, any>;
}

export interface Agent {
  id: string;
  organizationId: string;
  name: string;
  role: string;
  agentType: string;
  description?: string;
  status: AgentStatus;
  runtimeType: RuntimeType;
  createdAt: Date;
  updatedAt: Date;
}

export interface RuntimeContext {
  organizationId: string;
  actorId: string;
  agentId?: string;
  permissionScope: string[];
  requestId: string;
}

export interface TaskRequest {
  task: string;
  context?: Record<string, any>;
}

export interface TaskResult {
  taskId: string;
  status: 'success' | 'failed';
  output?: any;
  error?: string;
  durationMs: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}
