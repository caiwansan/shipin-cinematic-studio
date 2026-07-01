// ════════════════════════════════════════════════════════════
// KH5-T004 — Audit Timeline Explorer
// ════════════════════════════════════════════════════════════

import { AuditTimeline, AuditEvent, AuditEventType } from '../review/audit-timeline'

export interface AuditQuery {
  packageId?: string
  type?: string
  since?: string
  until?: string
  limit?: number
}

export class AuditExplorer {
  constructor(private timeline: AuditTimeline) {}

  async query(query: AuditQuery): Promise<AuditEvent[]> {
    let events: AuditEvent[]

    if (query.packageId) {
      events = await this.timeline.getEvents(query.packageId)
    } else {
      events = await this.timeline.getAllEvents(query.limit || 100)
    }

    if (query.type) {
      events = events.filter(e => e.type === query.type)
    }
    if (query.since) {
      events = events.filter(e => e.createdAt >= query.since!)
    }
    if (query.until) {
      events = events.filter(e => e.createdAt <= query.until!)
    }

    return events.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    ).slice(0, query.limit || 100)
  }

  getEventTypes(): AuditEventType[] {
    return [
      'package_created', 'validation_passed', 'validation_failed',
      'version_created', 'review_started', 'comment_added',
      'approved', 'changes_requested',
      'publish_started', 'publish_succeeded', 'publish_failed',
      'retry', 'rollback',
    ]
  }
}
