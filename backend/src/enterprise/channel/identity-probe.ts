/**
 * ChannelIdentityProbe — 渠道运行身份系统（Channel Runtime Identity System）
 * SPRINT-MEDIA-CHANNEL-01 Task03.2 Reality Identity Layer
 *
 * ── 掌柜蓝图：不要「恢复登录」，要「维持登录」──
 * 每个渠道账号 = 独立数字员工工作环境（Persistent Chrome Profile），
 * 系统不猜登录状态，而是通过 ChannelIdentityProbe 主动探测账号身份。
 *
 * ── 为什么需要这个抽象 ──
 * 之前 detectLoginState 是抖音 adapter 的私有方法，只有 boolean。
 * 升级为平台统一接口：authenticated / accountId / accountName / avatar / permissions / expiresAt
 * 小红书 / 视频号 / B站 / 微博 全部实现同一接口，上层零改动。
 *
 * ── 设计原则 ──
 * - 探针只回答「这个环境里是谁、登录了吗、有什么权限」，不写 DB、不操作业务
 * - 每个平台一个 Probe 实现，注册进 identityProbeRegistry
 * - 多信号判定（页面特征 + Cookie + 身份接口），避免单点误判
 */

/** 账号身份探针结果（平台无关，上层唯一依赖） */
export interface ChannelIdentity {
  /** 是否已认证（多信号综合判定） */
  authenticated: boolean
  /** 平台账号 ID（如抖音 sec_uid / 小红书 userId） */
  accountId?: string
  /** 平台账号昵称 */
  accountName?: string
  /** 头像 URL（base64 或 https） */
  avatar?: string
  /** 账号类型（个人号/企业号/蓝V 等，平台定义） */
  accountType?: string
  /** 已授权能力（read:metrics / read:comments / analyze ...） */
  permissions: string[]
  /** 登录态有效期（ISO；未实现为 undefined） */
  expiresAt?: string
  /** 探测时间（ISO） */
  checkedAt: string
  /** 信号明细（调试/健康面板展示） */
  signals?: { page: boolean; cookie: boolean; identity: boolean }
}

/** 平台身份探针接口 — 小红书/视频号/B站/微博 全部实现此接口 */
export interface ChannelIdentityProbe {
  readonly platform: string
  /** 探测指定浏览器会话的账号身份 */
  probe(sessionId: string): Promise<ChannelIdentity>
}

/** 探针注册表（上层通过 registry.get(platform) 获取，零分支） */
class IdentityProbeRegistry {
  private probes = new Map<string, ChannelIdentityProbe>()

  register(probe: ChannelIdentityProbe): void {
    this.probes.set(probe.platform, probe)
  }

  get(platform: string): ChannelIdentityProbe | undefined {
    return this.probes.get(platform)
  }

  has(platform: string): boolean {
    return this.probes.has(platform)
  }

  list(): string[] {
    return Array.from(this.probes.keys())
  }
}

export const identityProbeRegistry = new IdentityProbeRegistry()
