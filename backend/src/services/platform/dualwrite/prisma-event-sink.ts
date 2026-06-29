// ============================================================
// PrismaEventSink — Stage 3.2.1
// Persists DualWrite watcher events to dual_write_watcher_events
// Lightweight — no external dependencies, fire-and-forget
// ============================================================

import { EventSink } from './dualwrite-manager'
import { PrismaClient } from '@prisma/client'

export class PrismaEventSink implements EventSink {
  private prisma: PrismaClient

  constructor(prisma: PrismaClient) {
    this.prisma = prisma
  }

  async record(event: {
    entity: string
    entityId: string
    operation: string
    status: string
    latencyMs: number
    error?: string
    flags?: string
    diff?: string
  }): Promise<void> {
    try {
      await this.prisma.$executeRawUnsafe(
        `INSERT INTO dual_write_watcher_events (entity, entity_id, operation, status, latency_ms, error, flags, diff)
         VALUES ($1, $2::uuid, $3, $4, $5, $6, $7, $8)`,
        event.entity,
        event.entityId,
        event.operation,
        event.status,
        event.latencyMs,
        event.error || null,
        event.flags || null,
        event.diff || null,
      )
    } catch (err) {
      // Sink failure must NEVER crash the write path
      console.error('[PrismaEventSink] Write failed (non-fatal):', (err as Error).message)
    }
  }
}
