/**
 * agent-runtime/brain/agent-brain.service.ts
 * Agent Brain — 推理能力
 *
 * 职责：组合 Identity + System Prompt + Goal + Context
 * 不负责：Tool / Workflow / Memory Retrieval
 */

import type { RuntimeContext } from '../types/agent-runtime.types.js';

export interface BrainRequest {
  input: string;
  systemPrompt?: string;
  context?: Record<string, any>;
}

export interface BrainResult {
  output: string;
  tokensUsed: number;
  provider: string;
  model: string;
  durationMs: number;
}

export interface AgentBrainConfig {
  agentId: string;
  organizationId: string;
  systemPrompt: string;
  goal?: string;
  provider: string;
  model: string;
}

export interface IAgentBrain {
  reason(request: BrainRequest, context: RuntimeContext): Promise<BrainResult>;
}
