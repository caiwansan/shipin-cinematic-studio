/**
 * BrowserAuthSessionService — SPRINT-MEDIA-BROWSER-WORKSPACE-01 Task 03
 *
 * 用户授权流程状态机（BrowserAuthSession）
 *    INIT → OPEN_BROWSER → WAIT_USER_LOGIN → PLATFORM_VERIFY → AUTH_SUCCESS
 *                                                    ↘ FAILED / EXPIRED
 *
 * 禁止：「扫码成功」即认为成功。
 * 必须：平台确认（creator center loaded + account identity detected + session valid）才 AUTH_SUCCESS。
 *
 * 落地：复用 ChannelVerificationSession 表（channel_verification_session）
 *  - 一条记录 = 一次授权流程
 *  - status 承载状态机：INIT / OPEN_BROWSER / WAIT_USER_LOGIN / PLATFORM_VERIFY / AUTH_SUCCESS / FAILED / EXPIRED
 *  - verifiedIdentity = AUTH_SUCCESS 时账号身份快照（accountName/externalAccountId/avatar）
 *  - metadata.authStage = 子阶段（waiting_scan / scan_confirming / verifying / awaiting_confirmation）
 */
import { prisma } from '../../utils/index.js'

export type AuthStage =
  | 'INIT'
  | 'OPEN_BROWSER'
  | 'WAIT_USER_LOGIN'
  | 'PLATFORM_VERIFY'
  | 'AUTH_SUCCESS'
  | 'FAILED'
  | 'EXPIRED'

export class BrowserAuthSessionService {
  /**
   * 开启一次授权流程（幂等：同一账号未完成的流程复用）
   */
  async begin(channelAccountId: string, opts: { type?: string; metadata?: Record<string, unknown> } = {}): Promise<any> {
    // 复用未完成的流程（INIT/OPEN_BROWSER/WAIT_USER_LOGIN/PLATFORM_VERIFY 均视为进行中）
    const active = await prisma.channelVerificationSession.findFirst({
      where: {
        channelAccountId,
        status: { in: ['INIT', 'OPEN_BROWSER', 'WAIT_USER_LOGIN', 'PLATFORM_VERIFY'] },
      },
      orderBy: { createdAt: 'desc' },
    })
    if (active) return active

    return prisma.channelVerificationSession.create({
      data: {
        channelAccountId,
        verificationType: opts.type || 'app',
        status: 'INIT',
        metadata: { ...(opts.metadata || {}), authStage: 'INIT' } as any,
      },
    })
  }

  /** 状态流转（带合法迁移校验） */
  async transition(id: string, to: AuthStage, extra: Record<string, unknown> = {}): Promise<any> {
    const session = await prisma.channelVerificationSession.findUnique({ where: { id } })
    if (!session) throw new Error(`BrowserAuthSession not found: ${id}`)

    const LEGAL: Record<string, AuthStage[]> = {
      INIT: ['OPEN_BROWSER', 'FAILED', 'EXPIRED'],
      OPEN_BROWSER: ['WAIT_USER_LOGIN', 'FAILED', 'EXPIRED'],
      WAIT_USER_LOGIN: ['PLATFORM_VERIFY', 'AUTH_SUCCESS', 'FAILED', 'EXPIRED'],
      PLATFORM_VERIFY: ['AUTH_SUCCESS', 'FAILED', 'EXPIRED'],
      AUTH_SUCCESS: [],
      FAILED: [],
      EXPIRED: [],
    }
    const allowed = LEGAL[session.status] || []
    if (!allowed.includes(to)) {
      throw new Error(`BrowserAuthSession 状态迁移非法: ${session.status} → ${to}`)
    }

    const data: any = {
      status: to,
      metadata: {
        ...((session.metadata as any) || {}),
        ...(extra.metadata || {}),
        authStage: to,
      },
    }
    if (to === 'AUTH_SUCCESS') data.completedAt = new Date()
    if (extra.verifiedIdentity) data.verifiedIdentity = extra.verifiedIdentity as any
    if (extra.type) data.verificationType = extra.type as string

    return prisma.channelVerificationSession.update({ where: { id }, data })
  }

  /** 快进标记（幂等：直接置状态，无迁移校验——用于恢复/初始化场景） */
  async mark(id: string, status: AuthStage, extra: Record<string, unknown> = {}): Promise<any> {
    const data: any = {
      status,
      metadata: { ...extra, authStage: status },
    }
    if (status === 'AUTH_SUCCESS' && !extra.completedAt) data.completedAt = new Date()
    return prisma.channelVerificationSession.update({ where: { id }, data })
  }

  /** 查询账号最近一次授权流程 */
  async latest(channelAccountId: string): Promise<any | null> {
    return prisma.channelVerificationSession.findFirst({
      where: { channelAccountId },
      orderBy: { createdAt: 'desc' },
    })
  }

  /** 账号是否有过成功授权（长期可信环境已建立） */
  async hasVerified(channelAccountId: string): Promise<boolean> {
    const v = await prisma.channelVerificationSession.findFirst({
      where: { channelAccountId, status: 'AUTH_SUCCESS' },
      orderBy: { completedAt: 'desc' },
    })
    return !!v
  }
}

export const browserAuthSessionService = new BrowserAuthSessionService()
