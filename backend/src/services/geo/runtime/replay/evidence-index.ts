export interface EvidenceEntry {
  evidenceId: string;
  replayId: string;
  snapshotVersion: string;
  type: string;           // e.g. 'direct_mention', 'contextual_reference'
  source: string;         // provider name
  text: string;
  confidence: number;
  url?: string;
  accessedAt: string;
}

export interface EvidenceQuery {
  source?: string;
  type?: string;
  minConfidence?: number;
  snapshotVersion?: string;
  limit?: number;
}

class EvidenceIndex {
  private entries: Map<string, EvidenceEntry> = new Map();

  // 从 replay 中提取证据
  indexFromReplay(replayId: string, snapshotVersion: string, replay: { result: { evidence: { type: string; source: string; text: string; url?: string; accessedAt: string; confidence?: number }[] } }): void {
    for (const ev of replay.result.evidence) {
      const entry: EvidenceEntry = {
        evidenceId: `ev_${replayId}_${this.entries.size + 1}`,
        replayId,
        snapshotVersion,
        type: ev.type,
        source: ev.source,
        text: ev.text,
        confidence: (ev as any).confidence ?? 0.5,
        url: ev.url,
        accessedAt: ev.accessedAt,
      };
      this.entries.set(entry.evidenceId, entry);
    }
  }

  // 查询
  query(q: EvidenceQuery): EvidenceEntry[] {
    let results = Array.from(this.entries.values());
    if (q.source) results = results.filter(e => e.source === q.source);
    if (q.type) results = results.filter(e => e.type === q.type);
    if (q.minConfidence !== undefined) results = results.filter(e => e.confidence >= q.minConfidence!);
    if (q.snapshotVersion) results = results.filter(e => e.snapshotVersion === q.snapshotVersion);
    const limit = q.limit ?? 100;
    return results.slice(0, limit);
  }

  // 按 replay 获取
  getByReplay(replayId: string): EvidenceEntry[] {
    return Array.from(this.entries.values()).filter(e => e.replayId === replayId);
  }

  // 按 snapshot 获取
  getBySnapshot(snapshotVersion: string): EvidenceEntry[] {
    return Array.from(this.entries.values()).filter(e => e.snapshotVersion === snapshotVersion);
  }

  // 总数
  count(): number {
    return this.entries.size;
  }

  // 导出
  export(format: 'json' = 'json'): EvidenceEntry[] {
    return Array.from(this.entries.values());
  }

  clear(): void {
    this.entries.clear();
  }
}

export const evidenceIndex = new EvidenceIndex();
