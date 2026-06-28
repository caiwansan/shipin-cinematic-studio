/**
 * provider-state.service.ts — Provider State Service v1.2 Final
 *
 * 纯观测层，不做任何决策。
 *
 * 职责：
 *   ✔ 记录成功/失败（双写 cache + DB）
 *   ✔ 暴露可观测数据
 *   ❌ 不决定能否执行
 *   ❌ 不选 provider
 *   ❌ 不做 fallback
 *   ❌ 不计成本
 *
 * 调用方（Adapter Registry）在 execute() 前后调用
 * markSuccess / markFailure，同时通过 onSuccess / onFailure
 * 获取更新后的状态，写入 DB。
 */

import { PrismaClient } from '@prisma/client'
import { ProviderState, createDefaultState, classifyProviderError, ProviderStatus } from './provider-state.js'

export class ProviderStateServiceFinal {
  private cache = new Map<string, { state: ProviderState; ts: number }>()
  private prisma: PrismaClient
  private readonly CACHE_TTL_MS = 30_000 // 30 秒后自动过期，下次 get 重新读 DB

  constructor(prisma: PrismaClient) {
    this.prisma = prisma
  }

  // ── 读 ──

  /** 从 cache 读（热数据） */
  getCached(userId: string, provider: string): ProviderState {
    const key = `${userId}:${provider}`
    const entry = this.cache.get(key)
    if (!entry) return createDefaultState(provider)
    if (Date.now() - entry.ts > this.CACHE_TTL_MS) {
      this.cache.delete(key)
      return createDefaultState(provider)
    }
    return entry.state
  }

  /** 从 DB 读（权威源） */
  async getFromDb(userId: string, provider: string): Promise<ProviderState> {
    try {
      const record = await this.prisma.providerState.findUnique({
        where: { userId_provider: { userId, provider } },
      })
      if (!record) return createDefaultState(provider)
      return {
        provider: record.provider,
        status: record.status as ProviderStatus,
        lastError: record.lastError || undefined,
        lastErrorCode: record.errorCode || undefined,
        lastSuccessAt: record.lastSuccessAt?.getTime() || undefined,
        lastFailAt: record.lastFailAt?.getTime() || undefined,
        keyFingerprint: record.keyFingerprint || undefined,
        enabled: record.enabled,
        consecutiveFailures: record.failureCount,
        circuitOpenedAt: record.circuitOpenedAt?.getTime() || undefined,
      }
    } catch {
      return createDefaultState(provider)
    }
  }

  /** 读（cache → DB fallback，结果回填 cache，30s TTL） */
  async get(userId: string, provider: string): Promise<ProviderState> {
    const key = `${userId}:${provider}`
    const cached = this.cache.get(key)
    if (cached && Date.now() - cached.ts <= this.CACHE_TTL_MS) return cached.state
    const fromDb = await this.getFromDb(userId, provider)
    this.cache.set(key, { state: fromDb, ts: Date.now() })
    return fromDb
  }

  // ── 写（纯记录，不决策） ──

  /** 记录成功（双写 cache + DB） */
  async markSuccess(userId: string, provider: string, apiKey?: string, newCircuitOpenedAt?: number | null): Promise<void> {
    const key = `${userId}:${provider}`
    const cached = this.cache.get(key)
    const state = cached ? cached.state : createDefaultState(provider)

    state.status = 'healthy'
    state.lastSuccessAt = Date.now()
    state.consecutiveFailures = 0
    state.lastError = undefined
    state.lastErrorCode = undefined
    state.circuitOpenedAt = newCircuitOpenedAt ?? undefined
    if (apiKey) {
      state.keyFingerprint = apiKey.length > 8 ? apiKey.substring(0, 8) : apiKey
    }
    this.cache.set(key, { state, ts: Date.now() })

    this.prisma.providerState.upsert({
      where: { userId_provider: { userId, provider } },
      update: {
        status: 'healthy',
        lastSuccessAt: new Date(),
        lastError: null,
        errorCode: null,
        failureCount: 0,
        circuitOpenedAt: newCircuitOpenedAt ? new Date(newCircuitOpenedAt) : null,
        keyFingerprint: state.keyFingerprint,
        updatedAt: new Date(),
      },
      create: {
        userId, provider,
        status: 'healthy',
        lastSuccessAt: new Date(),
        keyFingerprint: state.keyFingerprint,
        enabled: true,
      },
    }).catch((err: any) => console.error(`[ProviderState] DB markSuccess 失败: ${err?.message}`))
  }

  /** 记录失败（双写 cache + DB） */
  async markFailure(
    userId: string,
    provider: string,
    error: any,
    apiKey?: string,
    newFailureCount?: number,
    newCircuitOpenedAt?: number | null,
  ): Promise<void> {
    const key = `${userId}:${provider}`
    const cached = this.cache.get(key)
    const state = cached ? cached.state : createDefaultState(provider)
    const classified = classifyProviderError(error)

    state.status = classified.status
    state.lastError = error?.message || String(error || '')
    state.lastErrorCode = classified.errorCode
    state.lastFailAt = Date.now()
    state.consecutiveFailures = newFailureCount ?? ((state.consecutiveFailures || 0) + 1)
    state.circuitOpenedAt = newCircuitOpenedAt ?? state.circuitOpenedAt
    if (apiKey) {
      state.keyFingerprint = apiKey.length > 8 ? apiKey.substring(0, 8) : apiKey
    }
    this.cache.set(key, { state, ts: Date.now() })

    this.prisma.providerState.upsert({
      where: { userId_provider: { userId, provider } },
      update: {
        status: classified.status,
        lastError: error?.message || String(error || ''),
        errorCode: classified.errorCode,
        lastFailAt: new Date(),
        failureCount: state.consecutiveFailures,
        circuitOpenedAt: state.circuitOpenedAt ? new Date(state.circuitOpenedAt) : null,
        keyFingerprint: state.keyFingerprint,
        enabled: state.enabled,
        updatedAt: new Date(),
      },
      create: {
        userId, provider,
        status: classified.status,
        lastError: error?.message || String(error || ''),
        errorCode: classified.errorCode,
        lastFailAt: new Date(),
        failureCount: state.consecutiveFailures,
        enabled: true,
      },
    }).catch((err: any) => console.error(`[ProviderState] DB markFailure 失败: ${err?.message}`))
  }

  // ── 查询（可观测） ──

  async getAllForUser(userId: string): Promise<Array<{ key: string; state: ProviderState }>> {
    try {
      const records = await this.prisma.providerState.findMany({ where: { userId } })
      return records.map(r => ({
        key: `${r.userId}:${r.provider}`,
        state: {
          provider: r.provider,
          status: r.status as ProviderStatus,
          lastError: r.lastError || undefined,
          lastErrorCode: r.errorCode || undefined,
          lastSuccessAt: r.lastSuccessAt?.getTime() || undefined,
          lastFailAt: r.lastFailAt?.getTime() || undefined,
          keyFingerprint: r.keyFingerprint || undefined,
          enabled: r.enabled,
          consecutiveFailures: r.failureCount,
          circuitOpenedAt: r.circuitOpenedAt?.getTime() || undefined,
        },
      }))
    } catch {
      return []
    }
  }

  getAllCached(): Array<{ key: string; state: ProviderState }> {
    const result: Array<{ key: string; state: ProviderState }> = []
    for (const [key, state] of this.cache.entries()) {
      result.push({ key, state })
    }
    return result
  }

  getSummary(states: Array<{ key: string; state: ProviderState }>) {
    return {
      total: states.length,
      healthy: states.filter(s => s.state.status === 'healthy').length,
      billingFailed: states.filter(s => s.state.status === 'billing_failed').length,
      invalidKey: states.filter(s => s.state.status === 'invalid_key').length,
      degraded: states.filter(s => s.state.status === 'degraded').length,
      down: states.filter(s => s.state.status === 'down').length,
      disabled: states.filter(s => !s.state.enabled).length,
    }
  }

  /** 重置（debug 用） */
  async resetForUser(userId: string): Promise<void> {
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${userId}:`)) {
        this.cache.delete(key)
      }
    }
    try {
      await this.prisma.providerState.deleteMany({ where: { userId } })
    } catch {}
  }

  async resetAll(): Promise<void> {
    this.cache.clear()
    try {
      await this.prisma.providerState.deleteMany()
    } catch {}
  }
}

let _instance: ProviderStateServiceFinal | null = null

export function initProviderStateService(prisma: PrismaClient): ProviderStateServiceFinal {
  _instance = new ProviderStateServiceFinal(prisma)
  return _instance
}

export function getProviderStateService(): ProviderStateServiceFinal {
  if (!_instance) {
    throw new Error('ProviderStateService 未初始化')
  }
  return _instance
}
