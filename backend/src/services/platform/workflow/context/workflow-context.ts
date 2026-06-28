// ============================================================
// Workflow Context Factory (KMKI-PLAT-011)
// Builds WorkflowContext from instanceId
// ============================================================

import type { WorkflowContext, WorkflowExecutionContext } from '../types.js'
import { workflowInstanceRepository } from '../repositories/instance.repository.js'
import { workflowDefinitionRepository } from '../repositories/definition.repository.js'
import { workflowVariablesManager } from '../variables/workflow-variables.js'
import { RuntimeError } from '@platform/errors/platform-errors'
import type { PlatformContext } from '@platform/context/platform-context'

export class WorkflowContextFactory {
  async buildContext(instanceId: string, platformCtx?: PlatformContext): Promise<WorkflowContext> {
    const instance = await workflowInstanceRepository.findById(instanceId)
    if (!instance) {
      throw new RuntimeError('Workflow instance not found', { instanceId })
    }

    const definition = await workflowDefinitionRepository.findById(instance.workflowId)
    if (!definition) {
      throw new RuntimeError('Workflow definition not found', { workflowId: instance.workflowId })
    }

    // Get merged variables
    const variables = await workflowVariablesManager.getMergedVariables(instanceId)

    // Build execution context
    const executionContext: WorkflowExecutionContext = {
      traceId: platformCtx?.traceId || `wf-${instanceId}-${Date.now()}`,
      requestId: platformCtx?.requestId || `req-${instanceId}-${Date.now()}`,
      userId: platformCtx?.userId,
      tenantId: platformCtx?.tenantId,
      permissions: platformCtx?.permissions,
    }

    return {
      instanceId,
      workflowId: instance.workflowId,
      workspaceId: instance.workspaceId,
      workspace: { id: instance.workspaceId },
      variables,
      executionContext,
      agentDispatcher: this.createAgentDispatcher(),
      capabilityResolver: this.createCapabilityResolver(),
      resourceResolver: this.createResourceResolver(),
      logger: this.createLogger(instanceId),
      metadata: {
        workflowCode: definition.code,
        workflowName: definition.name,
        workflowVersion: definition.version,
      },
    }
  }

  private createAgentDispatcher() {
    return {
      async dispatch(agentCode: string, input: any, ctx?: any) {
        try {
          const { agentService } = await import('../../agent/agent.service.js')
          return agentService.dispatch({ agentCode, input }, ctx)
        } catch (err: any) {
          throw new RuntimeError(`Failed to dispatch agent ${agentCode}: ${err.message}`)
        }
      },
      async execute(agentCode: string, input: any, ctx?: any) {
        try {
          const { agentService } = await import('../../agent/agent.service.js')
          return agentService.execute(agentCode, input, ctx)
        } catch (err: any) {
          throw new RuntimeError(`Failed to execute agent ${agentCode}: ${err.message}`)
        }
      },
    }
  }

  private createCapabilityResolver() {
    return {
      async resolve(name: string, input: any, ctx?: any) {
        try {
          const { capabilityRuntime } = await import('../../capability/runtime/capability.runtime.js')
          return capabilityRuntime.resolve({ capabilityName: name, input }, ctx)
        } catch (err: any) {
          throw new RuntimeError(`Failed to resolve capability ${name}: ${err.message}`)
        }
      },
      async validate(contractName: string, input: any) {
        try {
          const { capabilityRuntime } = await import('../../capability/runtime/capability.runtime.js')
          return capabilityRuntime.validateContract(contractName, input)
        } catch (err: any) {
          throw new RuntimeError(`Failed to validate capability contract ${contractName}: ${err.message}`)
        }
      },
    }
  }

  private createResourceResolver() {
    return {
      async get(id: string) {
        try {
          const { resourceService } = await import('../../resource/resource.service.js')
          return resourceService.get(id)
        } catch (err: any) {
          throw new RuntimeError(`Failed to get resource ${id}: ${err.message}`)
        }
      },
      async list(filter?: Record<string, any>) {
        try {
          const { resourceService } = await import('../../resource/resource.service.js')
          return resourceService.list(filter)
        } catch (err: any) {
          throw new RuntimeError(`Failed to list resources: ${err.message}`)
        }
      },
    }
  }

  private createLogger(instanceId: string) {
    return {
      info: (msg: string, data?: any) => {
        console.log(`[Workflow:${instanceId}] INFO: ${msg}`, data ? JSON.stringify(data) : '')
      },
      warn: (msg: string, data?: any) => {
        console.warn(`[Workflow:${instanceId}] WARN: ${msg}`, data ? JSON.stringify(data) : '')
      },
      error: (msg: string, data?: any) => {
        console.error(`[Workflow:${instanceId}] ERROR: ${msg}`, data ? JSON.stringify(data) : '')
      },
      debug: (msg: string, data?: any) => {
        console.debug(`[Workflow:${instanceId}] DEBUG: ${msg}`, data ? JSON.stringify(data) : '')
      },
    }
  }
}

export const workflowContextFactory = new WorkflowContextFactory()
