// Pipeline Event System v1
// Step-level events for production pipeline observability + retry + agent hooks

export type StepEventType =
  | 'step.generated'
  | 'step.approved'
  | 'step.failed'
  | 'step.skipped'
  | 'step.retrying'
  | 'step.rollback'
  | 'pipeline.completed'
  | 'pipeline.failed'
  | 'render.image_completed'
  | 'render.video_completed'
  | 'render.audio_completed'
  | 'render.failed'
  | 'render.intelligence_decision'

export interface StepEvent {
  id: string
  type: StepEventType
  projectId: string
  pipelineId: string
  stepId?: string
  timestamp: string
  data?: Record<string, any>
  error?: string
  metadata?: {
    durationMs?: number
    cost?: number
    attempt: number
  }
}

export type EventHandler = (event: StepEvent) => void | Promise<void>

export class EventBus {
  private handlers = new Map<StepEventType, EventHandler[]>()
  private history: StepEvent[] = []

  on(type: StepEventType, handler: EventHandler): () => void {
    if (!this.handlers.has(type)) this.handlers.set(type, [])
    this.handlers.get(type)!.push(handler)

    // Return unsubscribe function
    return () => {
      const arr = this.handlers.get(type)
      if (arr) {
        const idx = arr.indexOf(handler)
        if (idx >= 0) arr.splice(idx, 1)
      }
    }
  }

  async emit(event: Omit<StepEvent, 'id' | 'timestamp'>): Promise<StepEvent> {
    const full: StepEvent = {
      ...event,
      id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
    }

    this.history.push(full)
    if (this.history.length > 1000) this.history.shift() // 保持最近 1000 条

    const handlers = this.handlers.get(event.type)
    if (handlers) {
      await Promise.allSettled(handlers.map(h => h(full)))
    }

    return full
  }

  getHistory(projectId?: string, limit = 50): StepEvent[] {
    let events = this.history
    if (projectId) events = events.filter(e => e.projectId === projectId)
    return events.slice(-limit)
  }

  getLastEvent(projectId: string, stepId?: string): StepEvent | undefined {
    const events = this.history
      .filter(e => e.projectId === projectId && (!stepId || e.stepId === stepId))
    return events[events.length - 1]
  }

  // Retry: replay the last attempt with incremented attempt number
  async retryLast(projectId: string, stepId: string): Promise<StepEvent | undefined> {
    const last = this.getLastEvent(projectId, stepId)
    if (!last) return undefined

    const metadata = last.metadata || { attempt: 0 }
    return this.emit({
      type: 'step.retrying',
      projectId,
      pipelineId: last.pipelineId,
      stepId,
      data: last.data,
      metadata: { ...metadata, attempt: metadata.attempt + 1 },
    })
  }
}

export const eventBus = new EventBus()
