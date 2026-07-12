import * as crypto from 'crypto';

export interface EvidenceEntry {
  evidenceId: string;        // hash 去重
  provider: string;
  source: string;
  content: string;
  confidence: number;
  hash: string;              // SHA256(content)
  capturedAt: string;        // 捕获时间 ISO
  snapshotVersion: string;   // 快照版本
  knowledgeVersion: string;  // 知识包版本（可选）
  replayIds: string[];       // 引用此证据的 Replay
}

export interface EvidenceRegistry {
  getAll(): EvidenceEntry[];
  getById(id: string): EvidenceEntry | undefined;
  findBySource(source: string): EvidenceEntry[];
  register(entry: Omit<EvidenceEntry, 'evidenceId' | 'hash'>): EvidenceEntry;
  findByReplay(replayId: string): EvidenceEntry[];
  removeStale(olderThan: Date): number;
}

// 证据去重
export function createEvidenceHash(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex').substring(0, 16);
}

// 内存实现
export const evidenceRegistry: EvidenceRegistry = (() => {
  const store = new Map<string, EvidenceEntry>();

  return {
    getAll: () => Array.from(store.values()),

    getById: (id) => store.get(id),

    findBySource: (source) =>
      Array.from(store.values()).filter(e => e.source.includes(source)),

    register: (entry) => {
      const hash = createEvidenceHash(entry.content);
      // 去重：相同 hash 不重复注册
      const existing = Array.from(store.values()).find(e => e.hash === hash);
      if (existing) {
        // 追加 replayId
        if (!existing.replayIds.includes(entry.replayIds[0])) {
          existing.replayIds.push(entry.replayIds[0]);
        }
        return existing;
      }

      const evidenceEntry: EvidenceEntry = {
        ...entry,
        evidenceId: `ev_${Date.now()}_${hash}`,
        hash,
      };
      store.set(evidenceEntry.evidenceId, evidenceEntry);
      return evidenceEntry;
    },

    findByReplay: (replayId) =>
      Array.from(store.values()).filter(e => e.replayIds.includes(replayId)),

    removeStale: (olderThan) => {
      const before = store.size;
      for (const [id, entry] of store) {
        if (new Date(entry.capturedAt) < olderThan) {
          store.delete(id);
        }
      }
      return before - store.size;
    },
  };
})();
