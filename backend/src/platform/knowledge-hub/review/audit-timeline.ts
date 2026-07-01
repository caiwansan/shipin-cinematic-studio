// ════════════════════════════════════════════════════════════
// KH3 — Audit Timeline (Platform Foundation)
// ════════════════════════════════════════════════════════════
// Unified event log. All events via packageId.
// KH5 Monitoring will build on this.
// ════════════════════════════════════════════════════════════

export type AuditEventType =
  | 'package_created'
  | 'validation_passed'
  | 'validation_failed'
  | 'version_created'
  | 'review_started'
  | 'comment_added'
  | 'approved'
  | 'changes_requested'
  | 'publish_started'
  | 'publish_succeeded'
  | 'publish_failed'
  | 'retry'
  | 'rollback'

export interface AuditEvent {
  id: string
  packageId: string
  type: AuditEventType
  actor: string
  payload: Record<string, unknown>
  createdAt: string
}

export class AuditTimeline {
  private events: AuditEvent[] = []

  async record(event: Omit<AuditEvent, 'id' | 'createdAt'>): Promise<AuditEvent> {
    const entry: AuditEvent = {
      ...event,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    }
    this.events.push(entry)
    return entry
  }

  async getEvents(packageId: string): Promise<AuditEvent[]> {
    return this.events
      .filter(e => e.packageId === packageId)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
  }

  async getAllEvents(limit = 100): Promise<AuditEvent[]> {
    return this.events.slice(-limit).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
  }
}
