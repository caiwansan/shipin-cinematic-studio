// ============================================================
// Frontend Workflow Store (KMKI-PLAT-011)
// Pinia store for workflow state management
// ============================================================

import { defineStore } from 'pinia'
import type {
  WorkflowDefinition,
  WorkflowInstance,
  WorkflowNode,
  WorkflowEdge,
  WorkflowEvent,
  InstanceDetail,
} from '../types/index.js'
import { workflowService } from '../services/workflow.service.js'

interface WorkflowStoreState {
  // Definitions
  definitions: WorkflowDefinition[]
  currentDefinition: WorkflowDefinition | null
  definitionsLoading: boolean

  // Instances
  instances: WorkflowInstance[]
  currentInstance: WorkflowInstance | null
  currentInstanceDetail: InstanceDetail | null
  instancesLoading: boolean

  // Node tracking for studio
  selectedNode: WorkflowNode | null
  selectedEdge: WorkflowEdge | null

  // Execution monitor
  instanceEvents: WorkflowEvent[]
  eventPollingInterval: number | null

  // UI
  error: string | null
}

export const useWorkflowStore = defineStore('workflow', {
  state: (): WorkflowStoreState => ({
    definitions: [],
    currentDefinition: null,
    definitionsLoading: false,
    instances: [],
    currentInstance: null,
    currentInstanceDetail: null,
    instancesLoading: false,
    selectedNode: null,
    selectedEdge: null,
    instanceEvents: [],
    eventPollingInterval: null,
    error: null,
  }),

  getters: {
    activeDefinitions: (state) => state.definitions.filter(d => d.status === 'active'),
    runningInstances: (state) => state.instances.filter(i => i.status === 'running'),
    lastEvent: (state) => state.instanceEvents[0] || null,
  },

  actions: {
    // ─── Definitions ───

    async fetchDefinitions(filter?: { status?: string; category?: string }) {
      this.definitionsLoading = true
      try {
        this.definitions = await workflowService.listDefinitions(filter)
      } catch (err: any) {
        this.error = err.message
      } finally {
        this.definitionsLoading = false
      }
    },

    async fetchDefinition(idOrCode: string) {
      try {
        this.currentDefinition = await workflowService.getDefinition(idOrCode)
      } catch (err: any) {
        this.error = err.message
      }
    },

    async createDefinition(data: WorkflowDefinition) {
      try {
        const def = await workflowService.createDefinition(data)
        this.definitions.push(def)
        return def
      } catch (err: any) {
        this.error = err.message
        throw err
      }
    },

    async updateDefinition(id: string, data: Partial<WorkflowDefinition>) {
      try {
        const def = await workflowService.updateDefinition(id, data)
        const idx = this.definitions.findIndex(d => d.id === id)
        if (idx >= 0) this.definitions[idx] = def
        if (this.currentDefinition?.id === id) this.currentDefinition = def
        return def
      } catch (err: any) {
        this.error = err.message
        throw err
      }
    },

    async deleteDefinition(id: string) {
      try {
        await workflowService.deleteDefinition(id)
        this.definitions = this.definitions.filter(d => d.id !== id)
        if (this.currentDefinition?.id === id) this.currentDefinition = null
      } catch (err: any) {
        this.error = err.message
        throw err
      }
    },

    // ─── Instances ───

    async fetchInstances(filter?: { workflowId?: string; workspaceId?: string; status?: string }) {
      this.instancesLoading = true
      try {
        this.instances = await workflowService.listInstances(filter)
      } catch (err: any) {
        this.error = err.message
      } finally {
        this.instancesLoading = false
      }
    },

    async fetchInstance(id: string) {
      try {
        this.currentInstance = await workflowService.getInstance(id)
      } catch (err: any) {
        this.error = err.message
      }
    },

    async fetchInstanceDetail(id: string) {
      try {
        this.currentInstanceDetail = await workflowService.describeInstance(id)
        this.instanceEvents = this.currentInstanceDetail?.events || []
      } catch (err: any) {
        this.error = err.message
      }
    },

    async createInstance(workflowCode: string, workspaceId: string, input?: Record<string, any>) {
      try {
        const instance = await workflowService.createInstance(workflowCode, workspaceId, input)
        this.instances.unshift(instance)
        return instance
      } catch (err: any) {
        this.error = err.message
        throw err
      }
    },

    // ─── Execution ───

    async executeInstance(instanceId: string) {
      try {
        this.currentInstance = await workflowService.execute(instanceId)
        // Start event polling
        this.startEventPolling(instanceId)
      } catch (err: any) {
        this.error = err.message
        throw err
      }
    },

    async pauseInstance(instanceId: string) {
      try {
        this.currentInstance = await workflowService.pause(instanceId)
        this.stopEventPolling()
      } catch (err: any) {
        this.error = err.message
        throw err
      }
    },

    async resumeInstance(instanceId: string) {
      try {
        this.currentInstance = await workflowService.resume(instanceId)
        this.startEventPolling(instanceId)
      } catch (err: any) {
        this.error = err.message
        throw err
      }
    },

    async cancelInstance(instanceId: string) {
      try {
        this.currentInstance = await workflowService.cancel(instanceId)
        this.stopEventPolling()
      } catch (err: any) {
        this.error = err.message
        throw err
      }
    },

    async replayInstance(instanceId: string, options?: { fromNode?: string; failedOnly?: boolean }) {
      try {
        this.currentInstance = await workflowService.replay(instanceId, options)
        this.startEventPolling(instanceId)
      } catch (err: any) {
        this.error = err.message
        throw err
      }
    },

    // ─── Human Response ───

    async submitHumanResponse(instanceId: string, nodeType: string, action: string, data?: Record<string, any>) {
      try {
        await workflowService.submitHumanResponse(instanceId, nodeType, action, data)
        // Refresh instance detail after response
        await this.fetchInstanceDetail(instanceId)
      } catch (err: any) {
        this.error = err.message
        throw err
      }
    },

    // ─── Event Polling ───

    startEventPolling(instanceId: string) {
      this.stopEventPolling()
      this.eventPollingInterval = setInterval(async () => {
        try {
          await this.fetchInstanceDetail(instanceId)
        } catch {
          // Silently handle polling errors
        }
      }, 3000) as unknown as number
    },

    stopEventPolling() {
      if (this.eventPollingInterval) {
        clearInterval(this.eventPollingInterval)
        this.eventPollingInterval = null
      }
    },

    // ─── UI State ───

    selectNode(node: WorkflowNode | null) {
      this.selectedNode = node
      this.selectedEdge = null
    },

    selectEdge(edge: WorkflowEdge | null) {
      this.selectedEdge = edge
      this.selectedNode = null
    },

    clearSelection() {
      this.selectedNode = null
      this.selectedEdge = null
    },

    clearError() {
      this.error = null
    },
  },
})
