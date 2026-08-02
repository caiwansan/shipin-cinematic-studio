/**
 * platform-registry.ts — Channel Platform Registry（平台注册唯一 SSOT）
 * SPRINT-MEDIA-LOGIN-REALITY-HARDENING-02 Task04
 *
 * ── 掌柜蓝图：平台注册体系唯一 SSOT ──
 * 以前：meta 配置 8 平台 vs runtime 注册部分平台 → 前端以为「可以连接」，后台没有 adapter → 必炸。
 * 现在：本 Registry 是唯一真相源，输出「平台能力清单」：
 *   - 平台名称 / 登录方式 / 扫码后行为 / 探针策略 / Adapter 就绪 / Probe 就绪 / Metrics 能力 / 状态
 *   - 前端禁止自己判断 xiaohongshu=true、kuaishou=true，全部从 GET /api/enterprise/channels/registry 拉取
 *   - 新增平台 = meta 加配置 + 注册 adapter + markAdapterReady，前端零改动自动点亮
 *
 * 纪律：
 *   - 禁止 if(platform==="xxx") 分支——平台差异 100% 在 ChannelPlatformDefinition 配置
 *   - connectable = adapterReady && probeReady && loginMethods 非空（真实可连才点亮）
 *   - 未就绪平台如实报告 status，禁止冒充
 */
import { CHANNEL_META, type ChannelPlatformDefinition, type LoginMethod } from './adapters/browser-channel.meta.js'

export interface PlatformCapability {
  platform: string
  displayName: string
  /** 前端可连接（adapter + probe 双就绪 + 有登录方式） */
  connectable: boolean
  loginMethods: LoginMethod[]
  /** 扫码后页面行为（Login Capability Model v2） */
  postScanBehavior: 'redirect' | 'stay_page' | 'manual_confirm' | undefined
  /** 身份探针策略 */
  identityStrategy: { pageProbe: boolean; cookieProbe: boolean; networkCapture: boolean; allowReload: boolean } | undefined
  adapterReady: boolean
  probeReady: boolean
  metricsSupported: boolean
  /** ready=可连接 / config_only=仅配置未注册 / frozen=冻结不开放 */
  status: 'ready' | 'config_only' | 'frozen'
  loginUrl: string
  workspaceUrl: string
}

/** 冻结平台（掌柜冻结清单：不开放连接） */
const FROZEN_PLATFORMS = new Set<string>(['wechat_mp', 'weibo', 'toutiao', 'baijiahao'])

class ChannelPlatformRegistry {
  /** adapter 注册状态（channelService.registerAdapter 后由 markAdapterReady 标记） */
  private adapterReady = new Map<string, boolean>()
  /** probe 注册状态（identityProbeRegistry.register 后标记） */
  private probeReady = new Map<string, boolean>()

  /** 标记 adapter 就绪（幂等） */
  markAdapterReady(platform: string) {
    this.adapterReady.set(platform, true)
  }

  /** 标记 probe 就绪（幂等） */
  markProbeReady(platform: string) {
    this.probeReady.set(platform, true)
  }

  /** 所有已知平台（meta 配置全集） */
  allPlatforms(): string[] {
    return Object.keys(CHANNEL_META)
  }

  /** 平台定义（无则 undefined） */
  resolveMeta(platform: string): ChannelPlatformDefinition | undefined {
    return CHANNEL_META[platform]
  }

  /** 单平台能力 */
  getCapability(platform: string): PlatformCapability | undefined {
    const meta = CHANNEL_META[platform]
    if (!meta) return undefined
    const aReady = !!this.adapterReady.get(platform)
    const pReady = !!this.probeReady.get(platform)
    const frozen = FROZEN_PLATFORMS.has(platform)
    const connectable = aReady && pReady && meta.loginMethods.length > 0 && !frozen
    return {
      platform,
      displayName: meta.displayName,
      connectable,
      loginMethods: meta.loginMethods,
      postScanBehavior: meta.postScanBehavior,
      identityStrategy: meta.identityStrategy,
      adapterReady: aReady,
      probeReady: pReady,
      metricsSupported: !!meta.metricsExtraction,
      status: frozen ? 'frozen' : aReady && pReady ? 'ready' : 'config_only',
      loginUrl: meta.loginUrl,
      workspaceUrl: meta.workspaceUrl,
    }
  }

  /** 全部平台能力（前端渠道中心唯一数据源） */
  getCapabilities(): PlatformCapability[] {
    return this.allPlatforms().map(p => this.getCapability(p)!).sort((a, b) => {
      const rank = (x: PlatformCapability) => (x.status === 'ready' ? 0 : x.status === 'config_only' ? 1 : 2)
      return rank(a) - rank(b)
    })
  }

  /** 可连接平台列表（connectable 派生，禁止硬编码） */
  getConnectablePlatforms(): string[] {
    return this.allPlatforms().filter(p => this.getCapability(p)?.connectable)
  }
}

export const channelPlatformRegistry = new ChannelPlatformRegistry()
