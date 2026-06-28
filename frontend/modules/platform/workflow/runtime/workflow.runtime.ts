// ============================================================
// Frontend Workflow Runtime (KMKI-PLAT-011)
// Client-side runtime for real-time monitoring
// ============================================================

import type { WorkflowInstance, WorkflowEvent, InstanceDetail } from '../types/index.js'
import { workflowService } from '../services/workflow.service.js'

export type WorkflowEventListener = (event: WorkflowEvent) => void

export class WorkflowClientRuntime {
  private eventListeners: Map<string, Set<WorkflowEventListener>> = new Map()
  private pollingTimer: ReturnType<typeof setInterval> | null = null
  private currentInstanceId: string | null = null

  // ─── Subscribe to events ───

  on(eventType: string, listener: WorkflowEventListener): () => void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, new Set())
    }
    this.eventListeners.get(eventType)!.add(listener)
    return () => {
      this.eventListeners.get(eventType)?.delete(listener)
    }
  }

  // ─── Start monitoring an instance ───

  async monitor(instanceId: string, pollingIntervalMs = 3000): Promise<void> {
    this.stop()
    this.currentInstanceId = instanceId

    // Initial fetch
    await this.pollInstance(instanceId)

    // Start polling
    this.pollingTimer = setInterval(async () => {
      await this.pollInstance(instanceId)
    }, pollingIntervalMs)
  }

  // ─── Stop monitoring ───

  stop(): void {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer)
      this.pollingTimer = null
    }
    this.currentInstanceId = null
  }

  // ─── Execute actions ───

  async execute(instanceId: string): Promise<WorkflowInstance> {
    const result = await workflowService.execute(instanceId)
    await this.monitor(instanceId)
    return result
  }

  async pause(instanceId: string): Promise<WorkflowInstance> {
    this.stop()
    return workflowService.pause(instanceId)
  }

  async resume(instanceId: string): Promise<WorkflowInstance> {
    const result = await workflowService.resume(instanceId)
    await this.monitor(instanceId)
    return result
  }

  async cancel(instanceId: string): Promise<WorkflowInstance> {
    this.stop()
    return workflowService.cancel(instanceId)
  }

  async replay(instanceId: string, options?: { fromNode?: string; failedOnly?: boolean }): Promise<WorkflowInstance> {
    await this.monitor(instanceId)
    return workflowService.replay(instanceId, options)
  }

  // ─── Private ───

  private async pollInstance(instanceId: string): Promise<void> {
    try {
      const detail = await workflowService.describeInstance(instanceId)
      const newEvents = detail.events || []

      // Find and emit new events
      for (const event of newEvents) {
        this.emit(event.type, event)

        // Also emit to specific event type listeners
        const typeListeners = this.eventListeners.get(event.type)
        if (typeListeners) {
          for (const listener of typeListeners) {
            listener(event)
          }
        }
      }

      // Emit to 'all' listeners
      const allListeners = this.eventListeners.get('*')
      if (allListeners) {
        for (const event of newEvents) {
          for (const listener of allListeners) {
            listener(event)
          }
        }
      }

      // Check if instance completed
      if (detail.instance && ['completed', 'failed', 'cancelled'].includes(detail.instance.status || '')) {
        this.emit('workflowFinished', {
          instanceId,
          type: 'workflowFinished',
          data: { status: detail.instance.status },
          timestamp: new Date().toISOString(),
        })
        this.stop()
      }
    } catch {
      // Silently handle polling errors
    }
  }

  private emit(type: string, event: WorkflowEvent): void {
    const listeners = this.eventListeners.get(type) || this.eventListeners.get('*')
    if (listeners) {
      for (const listener of listeners) {
        try { listener(event) } catch {}
      }
    }
  }
}

export const workflowClientRuntime = new WorkflowClientRuntime()
