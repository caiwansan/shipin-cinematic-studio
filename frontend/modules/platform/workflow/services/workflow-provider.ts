// ============================================================
// Frontend Workflow Provider (KMKI-PLAT-011)
// Vue provide/inject provider for Workflow Runtime
// ============================================================

import { inject, provide, type InjectionKey, type Ref, ref } from 'vue'
import type {
  WorkflowDefinition,
  WorkflowInstance,
  InstanceDetail,
  WorkflowCheckpoint,
  WorkflowEvent,
  WorkflowTemplate,
} from '../types/index.js'
import { workflowService } from './workflow.service.js'
import { workflowClientRuntime } from '../runtime/workflow.runtime.js'

// ─── Injection Key ───

export interface WorkflowProvider {
  definitions: Ref<WorkflowDefinition[]>
  instances: Ref<WorkflowInstance[]>
  loading: Ref<boolean>
  error: Ref<string | null>

  // Definitions
  listDefinitions: (filter?: { status?: string; category?: string }) => Promise<WorkflowDefinition[]>
  getDefinition: (idOrCode: string) => Promise<WorkflowDefinition>
  createDefinition: (data: WorkflowDefinition) => Promise<WorkflowDefinition>
  updateDefinition: (id: string, data: Partial<WorkflowDefinition>) => Promise<WorkflowDefinition>
  deleteDefinition: (id: string) => Promise<void>

  // Instances
  listInstances: (filter?: { workflowId?: string; workspaceId?: string; status?: string }) => Promise<WorkflowInstance[]>
  getInstance: (id: string) => Promise<WorkflowInstance>
  describeInstance: (id: string) => Promise<InstanceDetail>
  createInstance: (workflowCode: string, workspaceId: string, input?: Record<string, any>) => Promise<WorkflowInstance>

  // Execution
  execute: (instanceId: string) => Promise<WorkflowInstance>
  pause: (instanceId: string) => Promise<WorkflowInstance>
  resume: (instanceId: string) => Promise<WorkflowInstance>
  cancel: (instanceId: string) => Promise<WorkflowInstance>
  replay: (instanceId: string, options?: { fromNode?: string; failedOnly?: boolean }) => Promise<WorkflowInstance>

  // Checkpoints
  saveCheckpoint: (instanceId: string, nodeId: string) => Promise<WorkflowCheckpoint>
  listCheckpoints: (instanceId: string) => Promise<WorkflowCheckpoint[]>

  // Human Response
  approve: (instanceId: string, data?: Record<string, any>) => Promise<void>
  reject: (instanceId: string, data?: Record<string, any>) => Promise<void>
  submitHumanResponse: (instanceId: string, nodeType: string, action: string, data?: Record<string, any>) => Promise<void>

  // Templates
  listTemplates: (category?: string) => Promise<WorkflowTemplate[]>
  createTemplate: (data: WorkflowTemplate) => Promise<WorkflowTemplate>

  // Runtime
  runtime: typeof workflowClientRuntime
}

const WORKFLOW_KEY: InjectionKey<WorkflowProvider> = Symbol('workflow')

// ─── Provider Factory ───

export function createWorkflowProvider(): WorkflowProvider {
  const definitions = ref<WorkflowDefinition[]>([])
  const instances = ref<WorkflowInstance[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function listDefinitions(filter?: { status?: string; category?: string }): Promise<WorkflowDefinition[]> {
    loading.value = true
    try {
      const result = await workflowService.listDefinitions(filter)
      definitions.value = result
      return result
    } catch (err: any) {
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  async function getDefinition(idOrCode: string): Promise<WorkflowDefinition> {
    return workflowService.getDefinition(idOrCode)
  }

  async function createDefinition(data: WorkflowDefinition): Promise<WorkflowDefinition> {
    const result = await workflowService.createDefinition(data)
    definitions.value.push(result)
    return result
  }

  async function updateDefinition(id: string, data: Partial<WorkflowDefinition>): Promise<WorkflowDefinition> {
    return workflowService.updateDefinition(id, data)
  }

  async function deleteDefinition(id: string): Promise<void> {
    await workflowService.deleteDefinition(id)
    definitions.value = definitions.value.filter(d => d.id !== id)
  }

  async function listInstances(filter?: { workflowId?: string; workspaceId?: string; status?: string }): Promise<WorkflowInstance[]> {
    loading.value = true
    try {
      const result = await workflowService.listInstances(filter)
      instances.value = result
      return result
    } catch (err: any) {
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  async function getInstance(id: string): Promise<WorkflowInstance> {
    return workflowService.getInstance(id)
  }

  async function describeInstance(id: string): Promise<InstanceDetail> {
    return workflowService.describeInstance(id)
  }

  async function createInstance(workflowCode: string, workspaceId: string, input?: Record<string, any>): Promise<WorkflowInstance> {
    const result = await workflowService.createInstance(workflowCode, workspaceId, input)
    instances.value.unshift(result)
    return result
  }

  async function execute(instanceId: string): Promise<WorkflowInstance> {
    return workflowService.execute(instanceId)
  }

  async function pause(instanceId: string): Promise<WorkflowInstance> {
    return workflowService.pause(instanceId)
  }

  async function resume(instanceId: string): Promise<WorkflowInstance> {
    return workflowService.resume(instanceId)
  }

  async function cancel(instanceId: string): Promise<WorkflowInstance> {
    return workflowService.cancel(instanceId)
  }

  async function replay(instanceId: string, options?: { fromNode?: string; failedOnly?: boolean }): Promise<WorkflowInstance> {
    return workflowService.replay(instanceId, options)
  }

  async function saveCheckpoint(instanceId: string, nodeId: string): Promise<WorkflowCheckpoint> {
    return workflowService.saveCheckpoint(instanceId, nodeId)
  }

  async function listCheckpoints(instanceId: string): Promise<WorkflowCheckpoint[]> {
    return workflowService.listCheckpoints(instanceId)
  }

  async function approve(instanceId: string, data?: Record<string, any>): Promise<void> {
    return workflowService.approve(instanceId, data)
  }

  async function reject(instanceId: string, data?: Record<string, any>): Promise<void> {
    return workflowService.reject(instanceId, data)
  }

  async function submitHumanResponse(instanceId: string, nodeType: string, action: string, data?: Record<string, any>): Promise<void> {
    return workflowService.submitHumanResponse(instanceId, nodeType, action, data)
  }

  async function listTemplates(category?: string): Promise<WorkflowTemplate[]> {
    return workflowService.listTemplates(category)
  }

  async function createTemplate(data: WorkflowTemplate): Promise<WorkflowTemplate> {
    return workflowService.createTemplate(data)
  }

  return {
    definitions,
    instances,
    loading,
    error,
    listDefinitions,
    getDefinition,
    createDefinition,
    updateDefinition,
    deleteDefinition,
    listInstances,
    getInstance,
    describeInstance,
    createInstance,
    execute,
    pause,
    resume,
    cancel,
    replay,
    saveCheckpoint,
    listCheckpoints,
    approve,
    reject,
    submitHumanResponse,
    listTemplates,
    createTemplate,
    runtime: workflowClientRuntime,
  }
}

// ─── Provider & Injector ───

export function provideWorkflow(): WorkflowProvider {
  const provider = createWorkflowProvider()
  provide(WORKFLOW_KEY, provider)
  return provider
}

export function useWorkflow(): WorkflowProvider {
  const provider = inject(WORKFLOW_KEY)
  if (!provider) {
    throw new Error('useWorkflow() must be used within a component that called provideWorkflow()')
  }
  return provider
}
