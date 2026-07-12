import type { ReplayRecord, ReplaySummary } from './types';
import { replayToSummary } from './recorder';

class ReplayStore {
  private records: Map<string, ReplayRecord> = new Map();

  // 存储
  save(replay: ReplayRecord): void {
    this.records.set(replay.replayId, replay);
  }

  // 查询单条
  get(replayId: string): ReplayRecord | undefined {
    return this.records.get(replayId);
  }

  // 列表（按时间降序）
  list(limit: number = 50, offset: number = 0): ReplaySummary[] {
    return Array.from(this.records.values())
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(offset, offset + limit)
      .map(replayToSummary);
  }

  // 按 Provider 筛选
  listByProvider(provider: string, limit: number = 20): ReplaySummary[] {
    return Array.from(this.records.values())
      .filter(r => r.provider === provider)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit)
      .map(replayToSummary);
  }

  // 按 Snapshot 筛选
  listBySnapshot(snapshotVersion: string, limit: number = 20): ReplaySummary[] {
    return Array.from(this.records.values())
      .filter(r => r.snapshotVersion === snapshotVersion)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit)
      .map(replayToSummary);
  }

  // 总数
  count(): number {
    return this.records.size;
  }

  // 清空
  clear(): void {
    this.records.clear();
  }
}

export const replayStore = new ReplayStore();
