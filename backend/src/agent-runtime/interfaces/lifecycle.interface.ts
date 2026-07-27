/**
 * agent-runtime/interfaces/lifecycle.interface.ts
 * Agent Lifecycle 接口
 */

import { AgentStatus, AgentConfig, ValidationResult } from '../types/agent-runtime.types.js';

export interface IAgentLifecycle {
  /**
   * 创建 Agent（状态: draft）
   */
  createAgent(organizationId: string, tenantId: string, config: AgentConfig): Promise<{ id: string; status: AgentStatus }>;

  /**
   * 部署 Agent（状态: draft → active）
   */
  deployAgent(agentId: string): Promise<void>;

  /**
   * 暂停 Agent（状态: active → paused）
   */
  pauseAgent(agentId: string): Promise<void>;

  /**
   * 恢复 Agent（状态: paused → active）
   */
  resumeAgent(agentId: string): Promise<void>;

  /**
   * 归档 Agent（状态: active/paused → archived）
   */
  archiveAgent(agentId: string): Promise<void>;

  /**
   * 获取 Agent 状态
   */
  getStatus(agentId: string): Promise<AgentStatus>;

  /**
   * 列出组织内所有 Agent
   */
  listAgents(organizationId: string): Promise<{ id: string; name: string; status: AgentStatus }[]>;

  /**
   * 验证配置
   */
  validateConfig(config: AgentConfig): ValidationResult;
}
