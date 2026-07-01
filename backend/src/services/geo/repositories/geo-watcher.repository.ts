// ============================================================
// GEO Watcher Repository — dual_write_watcher_events queries
// ============================================================

import { prisma } from '../../../utils/index.js'

export const geoWatcherRepository = {
  async findRecent(entityId?: string) {
    let rows: any[]
    if (entityId) {
      rows = await prisma.$queryRawUnsafe(
        `SELECT id, entity, entity_id, operation, status, latency_ms, error, created_at::text
         FROM dual_write_watcher_events
         WHERE entity_id = $1::uuid
         ORDER BY created_at DESC
         LIMIT 50`,
        entityId
      )
    } else {
      rows = await prisma.$queryRawUnsafe(
        `SELECT id::text, entity, entity_id::text, operation, status, latency_ms, error, created_at::text
         FROM dual_write_watcher_events
         ORDER BY created_at DESC
         LIMIT 50`
      )
    }
    return rows
  },

  async getSummary() {
    const counts = await prisma.$queryRawUnsafe<Array<{ status: string; count: bigint }>>(
      `SELECT status, COUNT(*) as count FROM dual_write_watcher_events GROUP BY status`
    )
    const summary: Record<string, number> = {}
    for (const row of counts) {
      summary[row.status] = Number(row.count)
    }
    return summary
  },

  async getDrift() {
    const driftRows = await prisma.$queryRawUnsafe<Array<{ entity: string; entity_id: string; diff: string; created_at: string }>>(
      `SELECT entity, entity_id::text, diff, created_at::text
       FROM dual_write_watcher_events
       WHERE diff IS NOT NULL
       ORDER BY created_at DESC
       LIMIT 20`
    )
    return driftRows
  },
}
