/**
 * services/member/plan-guard.ts — Plan Enforcement Layer（会员执行层）
 *
 * 昆仑镜 VIP 体系唯一真相源。所有业务代码中禁止直接引用：
 *   user.vip / user.plan / user.memberTier / user.memberType
 *
 * 一律通过 planGuard.getLimits(userId) 获取运行时权限。
 *
 * PlanGuard 路径：
 *   MemberPlan (DB) → PlanGuard (Runtime Limits) → 全部业务消费
 */

import { prisma } from '../../utils/index.js'

// ═══════════════════════════════════════════════════════════
// PlanGuard 审计日志
// ═══════════════════════════════════════════════════════════

interface AuditEntry {
  userId: string
  tier: string
  capability: string
  allowed: boolean
  reason: string
  limits: string  // 关键限制值的快照
}

/**
 * 向 InvocationLog 写入 PlanGuard 决策记录
 */
async function auditDecision(entry: AuditEntry) {
  // 仅采样 20% 减少日志写入开销（高并发场景可调低）
  if (Math.random() > 0.2) return

  try {
    await prisma.invocationLog.create({
      data: {
        userId: entry.userId,
        capability: `plan_guard:${entry.capability}`,
        model: 'plan-guard',
        status: entry.allowed ? 'success' : 'denied',
        errorMsg: entry.reason,
        sourcePath: `plan_guard:${entry.capability}`,
        tokenUsage: 0,
      },
    })
  } catch {
    // 审计日志写入失败不影响主流程
  }
}

// ═══════════════════════════════════════════════════════════
// 运行时权限定义 — 不与 DB Schema 耦合
// ═══════════════════════════════════════════════════════════

export interface RuntimeLimits {
  tier: string                      // 'free' | 'pro' | 'director' | 'enterprise'

  // 项目相关
  maxProjects: number               // 最大项目数

  // 视频相关
  maxVideoResolution: string        // '720p' | '1080p' | '4k'
  maxVideoDuration: number          // 秒
  videoGeneration: boolean          // 是否允许生成视频
  concurrentTasks: number           // 最大并发任务数

  // 图片相关
  imageGeneration: boolean          // 是否允许生成图片
  maxImageResolution: string        // '720p' | '1080p' | '4k'

  // 导出
  watermark: boolean                // true=无水印（VIP特权）, false=强制水印
  exportFormats: string[]           // ['mp4', 'gif', 'png']

  // 配额
  dailyQuota: number                // 每日 AI 调用次数
  monthlyCredits: number            // 月度积分额度

  // 高级能力
  onlineApiEnabled: boolean         // 可使用独立在线大模型 API
  localModelEnabled: boolean        // 可使用本地大模型
  apiAccess: boolean                // API 访问权限
}

// ═══════════════════════════════════════════════════════════
// 缺省值（免费用户兜底）
// ═══════════════════════════════════════════════════════════

const FREE_LIMITS: RuntimeLimits = {
  tier: 'free',
  maxProjects: 3,
  maxVideoResolution: '720p',
  maxVideoDuration: 15,
  videoGeneration: true,
  concurrentTasks: 1,
  imageGeneration: true,
  maxImageResolution: '720p',
  watermark: true,        // true = 有水印
  exportFormats: ['mp4'],
  dailyQuota: 5,
  monthlyCredits: 0,
  onlineApiEnabled: false,
  localModelEnabled: false,
  apiAccess: false,
}

// ═══════════════════════════════════════════════════════════
// PlanGuard
// ═══════════════════════════════════════════════════════════

class PlanGuard {
  /**
   * 获取用户运行时权限（唯一入口）
   */
  async getLimits(userId: string): Promise<RuntimeLimits> {
    if (!userId) return { ...FREE_LIMITS }

    // 查会员有效性
    const [membership, user] = await Promise.all([
      prisma.membership.findUnique({ where: { userId } }),
      prisma.user.findUnique({ where: { id: userId }, select: { memberTier: true, memberExpiresAt: true } }),
    ])

    const effectiveTier = this.resolveTier(membership, user)

    // 免费用户→从全局 RouteConfig 读取配额配置，不硬编码
    if (!effectiveTier || effectiveTier === 'free') {
      const configDailyQuota = await this.getFreeConfig('daily_free_ai_quota', 30)
      const configConcurrent = await this.getFreeConfig('free_concurrent_tasks', 1)
      return {
        ...FREE_LIMITS,
        tier: 'free',
        dailyQuota: configDailyQuota,
        concurrentTasks: configConcurrent,
      }
    }

    // 查 MemberPlan 定义
    const plan = await prisma.memberPlan.findUnique({ where: { level: effectiveTier } })
    if (!plan) {
      console.warn(`[PlanGuard] Plan not found for tier=${effectiveTier}, falling back to free`)
      return { ...FREE_LIMITS }
    }

    return this.planToLimits(plan)
  }

  /**
   * 判断用户是否有指定能力 — 带审计日志
   */
  async can(userId: string, capability: string): Promise<boolean> {
    const limits = await this.getLimits(userId)
    const isBoolCap = ['videoGeneration', 'imageGeneration', 'onlineApiEnabled', 'localModelEnabled', 'apiAccess']
    const allowed = isBoolCap.includes(capability) ? !!(limits as any)[capability] : true

    auditDecision({
      userId,
      tier: limits.tier,
      capability,
      allowed,
      reason: allowed ? 'allowed' : 'plan_restricted',
      limits: JSON.stringify({ tier: limits.tier, concurrentTasks: limits.concurrentTasks, dailyQuota: limits.dailyQuota }),
    })

    return allowed
  }

  /**
   * 分辨率等级比较 — 用于 maxResolution 限制
   * 返回值: 实际可用分辨率（字符串）
   */
  clampResolution(userLimit: string, requested: string): string {
    const rank = (res: string): number => {
      if (res.startsWith('4k') || res.startsWith('4K')) return 3
      if (res.startsWith('1080') || res === 'fullhd') return 2
      return 1 // 720p
    }

    return rank(requested) <= rank(userLimit) ? requested : userLimit
  }

  /**
   * 检查并发是否超限
   */
  async checkConcurrent(userId: string): Promise<{ allowed: boolean; current: number; max: number }> {
    const limits = await this.getLimits(userId)
    const runningCount = await prisma.aiVideoSegment.count({
      where: {
        project: { userId },
        videoStatus: { in: ['processing', 'queued', 'pending'] },
      },
    })
    return {
      allowed: runningCount < limits.concurrentTasks,
      current: runningCount,
      max: limits.concurrentTasks,
    }
  }

  // ── 私有方法 ──

  private resolveTier(membership: any, user: any): string | null {
    // 优先级: Membership.tier > User.memberTier
    const tier = membership?.tier || user?.memberTier || 'free'

    // 检查过期
    const expiresAt = membership?.expiresAt || user?.memberExpiresAt
    if (expiresAt && new Date(expiresAt) < new Date()) {
      return 'free' // 已过期
    }

    return tier
  }

  private planToLimits(plan: any): RuntimeLimits {
    return {
      tier: plan.level,
      maxProjects: this.resolveInt(plan.maxProjects, FREE_LIMITS.maxProjects),
      maxVideoResolution: this.clampResInput(plan.maxResolution, FREE_LIMITS.maxVideoResolution),
      maxVideoDuration: this.resolveInt(plan.maxDuration, FREE_LIMITS.maxVideoDuration),
      videoGeneration: true,           // 所有付费用户可视频
      concurrentTasks: this.resolveInt(plan.concurrentTasks, FREE_LIMITS.concurrentTasks),
      imageGeneration: true,           // 所有用户可图片
      maxImageResolution: this.clampResInput(plan.maxResolution, FREE_LIMITS.maxImageResolution),
      watermark: plan.watermark !== true, // DB: watermark=true=有水印; Runtime: watermark=false=没水印
      exportFormats: plan.level === 'enterprise' ? ['mp4', 'gif', 'png', 'mov'] : ['mp4'],
      dailyQuota: this.resolveInt(plan.dailyQuota, FREE_LIMITS.dailyQuota),
      monthlyCredits: this.resolveInt(plan.coins, FREE_LIMITS.monthlyCredits),
      onlineApiEnabled: !!plan.onlineApiEnabled,
      localModelEnabled: !!plan.localModelEnabled,
      apiAccess: !!plan.apiAccess,
    }
  }

  /**
   * 从 RouteConfig 表读取免费用户的全局配置，后台改完即时生效
   */
  private async getFreeConfig(key: string, fallback: number): Promise<number> {
    try {
      const { getRouteConfig } = await import('../../utils/index.js')
      const val = await getRouteConfig('system:global', key, fallback)
      const n = parseInt(val, 10)
      return isNaN(n) ? fallback : n
    } catch {
      return fallback
    }
  }

  private resolveInt(val: any, fallback: number): number {
    const n = parseInt(val, 10)
    return isNaN(n) ? fallback : n
  }

  private clampResInput(val: string, fallback: string): string {
    if (!val) return fallback
    const v = val.toLowerCase()
    if (['720p', '1080p', '4k'].includes(v)) return v
    return fallback
  }
}

export const planGuard = new PlanGuard()
export default planGuard
