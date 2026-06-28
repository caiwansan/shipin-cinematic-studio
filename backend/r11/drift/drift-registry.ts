/**
 * drift/drift-registry.ts
 *
 * DriftRecord 时间序列存储
 * 纯内存，以 domain 分组的时间序列。
 */

import type { DriftRecord } from "./types";

export class DriftRegistry {
  private records: Map<string, DriftRecord[]> = new Map();

  record(entry: DriftRecord): void {
    const domain = entry.domain;
    const list = this.records.get(domain) || [];
    list.push(entry);
    this.records.set(domain, list);
  }

  getRecords(domain?: string): DriftRecord[] {
    if (domain) return this.records.get(domain) || [];
    // 全部 domains 按时间归并
    const all: DriftRecord[] = [];
    for (const list of this.records.values()) {
      all.push(...list);
    }
    return all.sort((a, b) => a.timestamp - b.timestamp);
  }

  getLatest(domain?: string): DriftRecord | null {
    const records = this.getRecords(domain);
    return records.length > 0 ? records[records.length - 1] : null;
  }

  listDomains(): string[] {
    return Array.from(this.records.keys());
  }

  count(): number {
    let total = 0;
    for (const list of this.records.values()) total += list.length;
    return total;
  }

  clear(): void {
    this.records.clear();
  }
}
