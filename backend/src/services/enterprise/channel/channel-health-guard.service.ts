/**
 * channel-health-guard.service.ts — 渠道健康守卫（Channel Health Guard）
 * SPRINT-MEDIA-AI-EMPLOYEE-REALITY-01 Task01
 *
 * 掌柜定义：不是防止任务失败，它保护的是「企业账号资产健康」。
 * 思想来源：MatrixFlow FailureCoordinator（30 分钟窗口失败计数熔断），
 * 但语义升级为账号生命周期管理：
 *
 *   AI Employee Task → Channel Health Guard → 执行
 *
 * 状态机：
 *   HEALTHY ──(普通失败 1-2 次)──→ DEGRADED ──(≥3 次 或 致命信号)──→ NEEDS_ATTENTION
 *   DEGRADED ──(执行成功)──→ HEALTHY
 *   NEEDS_ATTENTION ──(owner/supervisor recover)──→ HEALTHY
 *
 * 致命信号（一次即 NEEDS_ATTENTION，不等 3 次）：
 *   验证码 / 安全验证 / 风控 / 封禁 / 登录失效 / 平台错误
 *
 * 触发 NEEDS_ATTENTION 时：自动暂停该账号所有 AgentChannelBinding（status=paused）
 * → AI 员工对该账号的一切操作（读指标/分析）被权限层拒绝，账号进入保护
 *
 * 纪律：
 * - 失败不重试，先保护（账号是资产，不是消耗品）
 * - 恢复必须人工（owner 确认），不自动解除
 * - 状态持久化（重启不丢）；窗口 30 分钟滑动
 */
import { prisma } from '../../../utils/index.js'

export type ChannelHealthLevel = 'HEALTHY' | 'DEGRADED' | 'NEEDS_ATTENTION'

export const CHANNEL_HEALTH_LEVELS: ChannelHealthLevel[] = ['HEALTHY', 'DEGRADED', 'NEEDS_ATTENTION']

/** 失败统计窗口：30 分钟（与 MatrixFlow FailureCoordinator 一致） */
export const FAILURE_WINDOW_MS = 30 * 60 * 1000
/** 普通失败触发 NEEDS_ATTENTION 的阈值 */
export const NORMAL_FAILURE_THRESHOLD = 3
/** 进入 DEGRADED 的失败次数 */
export const DEGRADED_THRESHOLD = 1

/** 致命信号：一次失败即触发 NEEDS_ATTENTION（账号健康红线，不等阈值）
 *  验证码/安全验证/风控/封禁/平台错误 → 危险信号，立即保护
 *  登录失效类（需重新扫码/重新验证）不算致命：常态失效，走连接状态机降级（EXPIRED/NEEDS_REAUTH），
 *  避免死锁（失效→暂停→扫码恢复后仍需人工解绑）；连续 3 次仍无法读取 → 普通阈值熔断 */
export const FATAL_SIGNAL_PATTERNS: RegExp[] = [
  /验证码/i,
  /安全验证/i,
  /风控/i,
  /封禁/i,
  /限制登录/i,
  /平台错误/i,
  /验证失败/i,
  /账号异常/i,
  /操作频繁/i,
]

/** 重新授权类信号（单独分类：不致命，但值得标记） */
export const REAUTH_SIGNAL_PATTERNS: RegExp[] = [
  /登录状态已失效/i,
  /需要重新扫码/i,
  /需要重新验证/i,
  /重新登录/i,
]

export interface HealthGuardFailureInput {
  channelAccountId: string
  tenantId: string
  organizationId?: string | null
  /** 失败原因（错误信息，用于信号分类与展示） */
  error: string
  /** 显式信号（可选；如探针已判定 securityCheck/loginPage） */
  signal?: string
  /** 触发方（agentId / system） */
  by?: string
}

export interface HealthGuardStateView {
  channelAccountId: string
  state: ChannelHealthLevel
  failureCount: number
  windowStartedAt: string
  lastFailureAt: string | null
  lastError: string | null
  lastSignal: string | null
  pausedAt: string | null
  pausedBy: string | null
  pauseReason: string | null
  recoveredAt: string | null
  updatedAt: string
  /** NEEDS_ATTENTION 时被暂停的绑定数 */
  pausedBindingCount?: number
}

/** 健康守卫拦截（任务执行被拒） */
export class ChannelHealthError extends Error {
  readonly state: ChannelHealthLevel
  readonly pauseReason: string | null
  constructor(message: string, state: ChannelHealthLevel, pauseReason: string | null) {
    super(message)
    this.name = 'ChannelHealthError'
    this.state = state
    this.pauseReason = pauseReason
  }
}

function classifySignal(error: string): string | null {
  for (const pattern of FATAL_SIGNAL_PATTERNS) {
    const m = error.match(pattern)
    if (m) return m[0]
  }
  return null
}

function mapState(row: any): HealthGuardStateView {
  const iso = (d: any) => (d ? (d instanceof Date ? d.toISOString() : String(d)) : null)
  return {
    channelAccountId: row.channelAccountId,
    state: row.state as ChannelHealthLevel,
    failureCount: row.failureCount ?? 0,
    windowStartedAt: iso(row.windowStartedAt) ?? new Date().toISOString(),
    lastFailureAt: iso(row.lastFailureAt),
    lastError: row.lastError ?? null,
    lastSignal: row.lastSignal ?? null,
    pausedAt: iso(row.pausedAt),
    pausedBy: row.pausedBy ?? null,
    pauseReason: row.pauseReason ?? null,
    recoveredAt: iso(row.recoveredAt),
    updatedAt: iso(row.updatedAt) ?? new Date().toISOString(),
  }
}

export class ChannelHealthGuardService {
  /**
   * 读取健康状态（无记录 → 默认 HEALTHY 视图，不建行）
   */
  async getState(channelAccountId: string): Promise<HealthGuardStateView> {
    const row = await prisma.channelHealthState.findUnique({
      where: { channelAccountId },
    }).catch(() => null)
    if (!row) {
      return {
        channelAccountId,
        state: 'HEALTHY',
        failureCount: 0,
        windowStartedAt: new Date().toISOString(),
        lastFailureAt: null,
        lastError: null,
        lastSignal: null,
        pausedAt: null,
        pausedBy: null,
        pauseReason: null,
        recoveredAt: null,
        updatedAt: new Date().toISOString(),
      }
    }
    // 惰性窗口重置：若窗口已过期且非 NEEDS_ATTENTION，视作健康（不写库，展示层判定）
    const windowStarted = new Date(row.windowStartedAt).getTime()
    if (row.state !== 'NEEDS_ATTENTION' && Date.now() - windowStarted > FAILURE_WINDOW_MS) {
      return { ...mapState(row), state: 'HEALTHY', failureCount: 0 }
    }
    return mapState(row)
  }

  /**
   * 执行前守卫：NEEDS_ATTENTION → 拒绝执行（ChannelHealthError）
   * 返回当前状态视图（DEGRADED 放行但上层可感知）
   */
  async assertHealthy(channelAccountId: string, action = 'execute'): Promise<HealthGuardStateView> {
    const state = await this.getState(channelAccountId)
    if (state.state === 'NEEDS_ATTENTION') {
      throw new ChannelHealthError(
        `账号健康守卫拦截 ${action}：账号处于 NEEDS_ATTENTION（${state.pauseReason || state.lastError || '需要人工确认'}），已暂停任务保护账号资产`,
        'NEEDS_ATTENTION',
        state.pauseReason || state.lastError || null,
      )
    }
    return state
  }

  /**
   * 失败上报（任务执行失败时调用）：
   * - 窗口过期 → 重置窗口计数
   * - 致命信号（验证码/安全验证/风控/封禁/登录失效）→ 一次即 NEEDS_ATTENTION
   * - 普通失败 ≥3 次 → NEEDS_ATTENTION；否则 DEGRADED
   * - 触发 NEEDS_ATTENTION → 自动暂停所有 active AgentChannelBinding
   */
  async recordFailure(input: HealthGuardFailureInput): Promise<{ state: HealthGuardStateView; pausedBindingIds: string[]; triggered: boolean }> {
    const { channelAccountId, tenantId, organizationId, error, signal, by } = input
    const now = new Date()

    let row = await prisma.channelHealthState.findUnique({ where: { channelAccountId } }).catch(() => null)
    if (!row) {
      row = await prisma.channelHealthState.create({
        data: {
          tenantId,
          organizationId: organizationId || null,
          channelAccountId,
          state: 'HEALTHY',
          failureCount: 0,
          windowStartedAt: now,
        },
      }).catch(() => null)
    }
    if (!row) return { state: await this.getState(channelAccountId), pausedBindingIds: [], triggered: false }

    // 窗口滑动重置（仅非 NEEDS_ATTENTION；NEEDS_ATTENTION 保持直到人工恢复）
    let failureCount = row.failureCount ?? 0
    let windowStartedAt = row.windowStartedAt
    if (row.state !== 'NEEDS_ATTENTION' && now.getTime() - new Date(row.windowStartedAt).getTime() > FAILURE_WINDOW_MS) {
      failureCount = 0
      windowStartedAt = now
    }

    const fatalSignal = signal || classifySignal(error)
    failureCount += 1

    let nextState: ChannelHealthLevel
    if (fatalSignal) {
      nextState = 'NEEDS_ATTENTION' // 致命信号：一次即触发
    } else if (failureCount >= NORMAL_FAILURE_THRESHOLD) {
      nextState = 'NEEDS_ATTENTION'
    } else if (failureCount >= DEGRADED_THRESHOLD) {
      nextState = 'DEGRADED'
    } else {
      nextState = 'HEALTHY'
    }

    const triggered = nextState === 'NEEDS_ATTENTION' && row.state !== 'NEEDS_ATTENTION'
    const pauseReason = fatalSignal
      ? `致命信号「${fatalSignal}」：${error.slice(0, 120)}`
      : `30 分钟内失败 ${failureCount}/${NORMAL_FAILURE_THRESHOLD} 次：${error.slice(0, 120)}`

    let pausedBindingIds: string[] = []
    if (triggered) {
      // 暂停所有 active 绑定 → AI 员工对该账号的一切操作被权限层拒绝
      const bindings = await prisma.agentChannelBinding.findMany({
        where: { channelAccountId, status: 'active' },
        select: { id: true },
      })
      pausedBindingIds = bindings.map(b => b.id)
      if (pausedBindingIds.length > 0) {
        await prisma.agentChannelBinding.updateMany({
          where: { id: { in: pausedBindingIds } },
          data: { status: 'paused' },
        })
      }
    }

    const updated = await prisma.channelHealthState.update({
      where: { id: row.id },
      data: {
        state: nextState,
        failureCount,
        windowStartedAt,
        lastFailureAt: now,
        lastError: error.slice(0, 500),
        lastSignal: fatalSignal || row.lastSignal,
        pausedAt: triggered ? now : row.pausedAt,
        pausedBy: triggered ? (by || 'system') : row.pausedBy,
        pauseReason: triggered ? pauseReason : row.pauseReason,
        recoveredAt: null,
      },
    })

    console.log(`[ChannelHealthGuard] ${channelAccountId} → ${nextState} (failures=${failureCount}${fatalSignal ? `, signal=${fatalSignal}` : ''})${triggered ? `, pausedBindings=${pausedBindingIds.length}` : ''}`)

    return { state: mapState(updated), pausedBindingIds, triggered }
  }

  /**
   * 成功上报：清窗口计数，DEGRADED → HEALTHY（NEEDS_ATTENTION 不自动恢复，必须人工）
   */
  async recordSuccess(channelAccountId: string): Promise<HealthGuardStateView> {
    const row = await prisma.channelHealthState.findUnique({ where: { channelAccountId } }).catch(() => null)
    if (!row) return this.getState(channelAccountId)

    if (row.state === 'NEEDS_ATTENTION') {
      return mapState(row) // 人工恢复前保持保护
    }

    const updated = await prisma.channelHealthState.update({
      where: { id: row.id },
      data: {
        state: 'HEALTHY',
        failureCount: 0,
        windowStartedAt: new Date(),
        recoveredAt: new Date(),
      },
    })
    return mapState(updated)
  }

  /**
   * 人工恢复（owner/supervisor 确认后）：
   * 清计数 → HEALTHY + 恢复所有被暂停的绑定（status=active）
   */
  async recover(channelAccountId: string, opts: { by?: string; reason?: string } = {}): Promise<{ state: HealthGuardStateView; restoredBindingCount: number }> {
    const row = await prisma.channelHealthState.findUnique({ where: { channelAccountId } }).catch(() => null)
    if (!row) {
      return { state: await this.getState(channelAccountId), restoredBindingCount: 0 }
    }

    const restored = await prisma.agentChannelBinding.updateMany({
      where: { channelAccountId, status: 'paused' },
      data: { status: 'active' },
    })

    const updated = await prisma.channelHealthState.update({
      where: { id: row.id },
      data: {
        state: 'HEALTHY',
        failureCount: 0,
        windowStartedAt: new Date(),
        lastError: null,
        lastSignal: null,
        pausedAt: null,
        pausedBy: null,
        pauseReason: null,
        recoveredAt: new Date(),
      },
    })

    console.log(`[ChannelHealthGuard] ${channelAccountId} 人工恢复 (by=${opts.by || 'owner'}, reason=${opts.reason || '-'}, restoredBindings=${restored.count})`)

    return { state: mapState(updated), restoredBindingCount: restored.count }
  }

  /** 所有需要关注的账号（owner-view：NEEDS_ATTENTION + DEGRADED） */
  async listAttention(tenantId?: string): Promise<HealthGuardStateView[]> {
    const rows = await prisma.channelHealthState.findMany({
      where: {
        state: { in: ['NEEDS_ATTENTION', 'DEGRADED'] },
        ...(tenantId ? { tenantId } : {}),
      },
      orderBy: { updatedAt: 'desc' },
    }).catch(() => [])
    return rows.map(mapState)
  }
}

export const channelHealthGuardService = new ChannelHealthGuardService()
