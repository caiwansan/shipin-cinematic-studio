/**
 * CKB — Repository 实现
 *
 * 五个 Repository 基于内存 + Map 存储。
 * 后续可扩展为持久化（Prisma / SQLite）。
 */

import type { CkbRepository, DirectorPattern, ProviderProfile, PatchPattern, GoldenCase, FailureEntry } from './ckb-types.js'

// ─── 通用内存 Repository ─────────────────

export class MemoryRepository<T extends { version?: string; createdAt?: string; lastUpdated?: string }> implements CkbRepository<T> {
  protected store = new Map<string, T>()
  protected idCounter = 0

  insert(entry: T): string {
    const id = `${this.constructor.name}_${++this.idCounter}`
    ;(entry as any)._id = id
    this.store.set(id, entry)
    return id
  }

  get(id: string): T | undefined {
    return this.store.get(id)
  }

  search(query: Partial<T>): T[] {
    const keys = Object.keys(query) as (keyof T)[]
    return [...this.store.values()].filter(entry => {
      return keys.every(k => {
        const qv = query[k]
        const ev = entry[k]
        if (qv === undefined || qv === null) return true
        if (Array.isArray(qv) && Array.isArray(ev)) {
          return (qv as any[]).some(v => (ev as any[]).includes(v))
        }
        if (typeof qv === 'string' && typeof ev === 'string') {
          return ev.toLowerCase().includes(qv.toLowerCase())
        }
        return ev === qv
      })
    })
  }

  update(id: string, entry: Partial<T>): boolean {
    const existing = this.store.get(id)
    if (!existing) return false
    this.store.set(id, { ...existing, ...entry, _id: id })
    return true
  }

  count(): number {
    return this.store.size
  }
}

// ─── 前五个 Repository ───────────────────

export class DirectorPatternRepository extends MemoryRepository<DirectorPattern> {
  findBySceneType(sceneType: string, provider?: string): DirectorPattern[] {
    return [...this.store.values()].filter(p => {
      if (!p.sceneType.toLowerCase().includes(sceneType.toLowerCase())) return false
      if (provider && p.provider !== provider) return false
      return true
    }).sort((a, b) => b.evaluation.overallScore - a.evaluation.overallScore)
  }

  findBestForScene(sceneType: string, provider: string): DirectorPattern | undefined {
    return this.findBySceneType(sceneType, provider)[0]
  }
}

export class ProviderProfileRepository extends MemoryRepository<ProviderProfile> {
  findByCapability(capability: string): ProviderProfile[] {
    return [...this.store.values()].filter(p =>
      p.capabilities.some(c => c.capability === capability),
    )
  }

  findBestForCapability(capability: string): ProviderProfile | undefined {
    return this.findByCapability(capability)
      .map(p => ({
        profile: p,
        cap: p.capabilities.find(c => c.capability === capability)!,
      }))
      .filter(x => x.cap.supportLevel !== 'none')
      .sort((a, b) => b.cap.historicalSuccessRate - a.cap.historicalSuccessRate)[0]?.profile
  }
}

export class OptimizationKnowledgeRepository extends MemoryRepository<PatchPattern> {
  findByCapability(capability: string): PatchPattern[] {
    return [...this.store.values()]
      .filter(p => p.targetCapability === capability)
      .sort((a, b) => b.successRate - a.successRate)
  }

  findBestPatch(capability: string, sceneType?: string): PatchPattern | undefined {
    return this.findByCapability(capability).find(p => {
      if (sceneType) return p.applicableScenes.includes(sceneType)
      return true
    })
  }
}

export class BenchmarkCorpusRepository extends MemoryRepository<GoldenCase> {
  findByStoryType(storyType: string): GoldenCase[] {
    return [...this.store.values()].filter(c =>
      c.storyType.toLowerCase().includes(storyType.toLowerCase()),
    )
  }
}

export class FailureAtlasRepository extends MemoryRepository<FailureEntry> {
  findByFailureType(failureType: string): FailureEntry[] {
    return [...this.store.values()].filter(f =>
      f.failureType.toLowerCase().includes(failureType.toLowerCase()),
    )
  }

  findByCondition(condition: string): FailureEntry[] {
    return [...this.store.values()].filter(f =>
      f.conditions.some(c => c.toLowerCase().includes(condition.toLowerCase())),
    )
  }

  findSolutions(failureType: string, capability: string, provider: string): string[] {
    const entries = [...this.store.values()].filter(f =>
      f.failureType === failureType &&
      f.capability === capability &&
      f.provider === provider,
    )
    if (entries.length === 0) return []
    // 合并所有已知解决方案
    return [...new Set(entries.flatMap(e => e.solutions))]
  }
}
