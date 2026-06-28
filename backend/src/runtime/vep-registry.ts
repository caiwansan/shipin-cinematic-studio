/**
 * VEP — Evidence Registry
 *
 * 统一格式 + 版本管理 + 可追溯 + 可缓存。
 * Evidence Registry 是 B1.3 和 B1.4 之间的桥梁。
 */

import type { EvidencePackage, EvidenceRegistryEntry } from './vep-types.js'

/**
 * 简单的内存 Evidence Registry
 * 后续可替换为持久化存储
 */
export class EvidenceRegistry {
  private entries = new Map<string, EvidenceRegistryEntry>()

  /** 注册一个新的 Evidence Package */
  register(pkg: EvidencePackage, expectedCirId?: string, providerName?: string): string {
    const entry: EvidenceRegistryEntry = {
      evidenceId: pkg.videoId,
      package: pkg,
      expectedCirId,
      cachedAt: new Date().toISOString(),
      providerName: providerName || 'unknown',
    }
    this.entries.set(entry.evidenceId, entry)
    return entry.evidenceId
  }

  /** 按 ID 获取 */
  get(evidenceId: string): EvidencePackage | undefined {
    return this.entries.get(evidenceId)?.package
  }

  /** 获取完整条目 */
  getEntry(evidenceId: string): EvidenceRegistryEntry | undefined {
    return this.entries.get(evidenceId)
  }

  /** 按 CIR 源查询 */
  findBySourceCir(cirId: string): EvidenceRegistryEntry[] {
    return [...this.entries.values()].filter(e => e.expectedCirId === cirId)
  }

  /** 最近 N 条 */
  recent(n: number): EvidenceRegistryEntry[] {
    return [...this.entries.values()]
      .sort((a, b) => b.cachedAt.localeCompare(a.cachedAt))
      .slice(0, n)
  }

  /** 清除缓存 */
  clear(): void {
    this.entries.clear()
  }

  /** 总数 */
  get size(): number {
    return this.entries.size
  }
}

/** 全局单例 */
export const evidenceRegistry = new EvidenceRegistry()
