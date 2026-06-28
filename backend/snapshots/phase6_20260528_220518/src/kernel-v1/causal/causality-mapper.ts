// causal/causality-mapper.ts — Event ↔ Diff ↔ Entity binding

export interface DiffSnapshot {
  created: Array<{ id: string; type: string }>
  updated: Array<{ id: string; type: string; changedFields: string[] }>
  deleted: Array<{ id: string; type: string }>
}

export interface ImpactResult {
  eventId: string
  summary: {
    entityChanges: DiffSnapshot
    totalImpactScore: number
  }
}

export class CausalityMapper {
  /**
   * 将 event + diff 映射为 impact summary
   */
  static map(event: any, diff: DiffSnapshot): ImpactResult {
    return {
      eventId: event.id,
      summary: {
        entityChanges: diff,
        totalImpactScore: this.score(diff),
      },
    }
  }

  /**
   * 计算影响分数
   * create = 1, update = 0.5, delete = 2
   */
  static score(diff: DiffSnapshot): number {
    return (
      (diff.created?.length ?? 0) * 1 +
      (diff.updated?.length ?? 0) * 0.5 +
      (diff.deleted?.length ?? 0) * 2
    )
  }

  /**
   * 从两个 entity state snapshots 生成 DiffSnapshot
   */
  static diffSnapshots(
    before: Record<string, any>,
    after: Record<string, any>
  ): DiffSnapshot {
    const created: Array<{ id: string; type: string }> = []
    const updated: Array<{ id: string; type: string; changedFields: string[] }> = []
    const deleted: Array<{ id: string; type: string }> = []

    const allIds = new Set([...Object.keys(before), ...Object.keys(after)])

    for (const id of allIds) {
      const be = before[id]
      const ae = after[id]

      if (!be && ae) {
        created.push({ id, type: ae.type })
      } else if (be && !ae) {
        deleted.push({ id, type: be.type })
      } else if (be && ae) {
        const changedFields = Object.keys(be.data || {}).filter(
          k => JSON.stringify(be.data?.[k]) !== JSON.stringify(ae.data?.[k])
        )
        if (changedFields.length > 0) {
          updated.push({ id, type: ae.type, changedFields })
        }
      }
    }

    return { created, updated, deleted }
  }
}
