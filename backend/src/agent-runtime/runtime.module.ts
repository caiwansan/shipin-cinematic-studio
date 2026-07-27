/**
 * agent-runtime/runtime.module.ts
 * Agent Runtime Module — 模块组装
 */

import type { PrismaClient } from '@prisma/client';
import { AgentLifecycleService } from './lifecycle/agent-lifecycle.service.js';
import { AgentOrchestrator } from './orchestrator/agent-orchestrator.service.js';
import { RuntimeContextService } from './context/runtime-context.service.js';
import { AgentBrainService } from './brain/agent-brain.service.js';
import { WorkflowEngineService } from './execution/workflow-engine.service.js';
import { WorkflowDefinitionService } from './workflow/workflow-definition.service.js';
import { IAgentLifecycle } from './interfaces/lifecycle.interface.js';
import { IRuntimeContextService } from './interfaces/runtime-context.interface.js';
import { IAgentBrain } from './brain/agent-brain.interface.js';

export interface AgentRuntimeModule {
  orchestrator: AgentOrchestrator;
  lifecycle: IAgentLifecycle;
  contextService: IRuntimeContextService;
  brain: IAgentBrain;
  workflowEngine: WorkflowEngineService;
  workflowDefinition: WorkflowDefinitionService;
}

/**
 * 工厂函数：创建 Agent Runtime Module
 */
export function createAgentRuntimeModule(prisma: PrismaClient): AgentRuntimeModule {
  const contextService = new RuntimeContextService(prisma);
  const lifecycle = new AgentLifecycleService(prisma);
  const brain = new AgentBrainService(prisma);
  const orchestrator = new AgentOrchestrator(lifecycle, contextService, brain, prisma);
  const workflowEngine = new WorkflowEngineService(prisma, brain);
  const workflowDefinition = new WorkflowDefinitionService(prisma);

  return {
    orchestrator,
    lifecycle,
    contextService,
    brain,
    workflowEngine,
    workflowDefinition,
  };
}
