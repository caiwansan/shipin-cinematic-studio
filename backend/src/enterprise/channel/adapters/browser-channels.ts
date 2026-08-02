/**
 * browser-channels.ts — 通用浏览器渠道实例工厂 + 探针注册
 * 2026-08-02 — 抖音范式铺开：快手 / 小红书 / 视频号（首批，扫码登录同构）
 *
 * 每个渠道 = BrowserChannelAdapterBase 子类（仅平台标识差异）+ BrowserChannelProbe 注册。
 * 平台差异（登录 URL/工作台特征/账号提取/关键 cookie）在 browser-channel.meta.ts 配置。
 *
 * 后续新增渠道（微博/头条/百家号/公众号）：
 * 1. browser-channel.meta.ts 加一条配置
 * 2. 本文件 list 加平台名 + probe 注册
 * 3. 前端 accounts.vue 渠道数组标 platform + connectable
 */
import { BrowserChannelAdapterBase, type BrowserChannelDeps } from './browser-channel.adapter.js'
import { BrowserChannelProbe } from './browser-channel.probe.js'
import { identityProbeRegistry } from '../identity-probe.js'
import { CONNECTABLE_PLATFORMS } from './browser-channel.meta.js'

/** 首批浏览器渠道平台列表（meta 已配置 + 探针已注册） */
export const BROWSER_CHANNEL_PLATFORMS = ['kuaishou', 'xiaohongshu', 'channels_wechat']

/** 各平台关键 cookie（登录态核心，探针信号 B 用） */
const KEY_COOKIES: Record<string, string[]> = {
  kuaishou: ['kuaishou.api_st', 'kuaishou.server_st', 'userId'],
  xiaohongshu: ['web_session', 'customerClientId'],
  channels_wechat: ['wxuin', 'wxsid', 'rand_info'],
  wechat_mp: ['slave_sid', 'slave_user', 'data_ticket'],
  weibo: ['SUB', 'SUBP', 'WBPSESS'],
  toutiao: ['sessionid', 'sid_guard', 'uid_tt'],
  baijiahao: ['BDUSS', 'BDUSS_BFESS', 'STOKEN'],
}

class GenericBrowserChannelAdapter extends BrowserChannelAdapterBase {
  constructor(
    readonly platform: string,
    readonly name: string,
    deps: BrowserChannelDeps,
  ) {
    super(deps)
  }
}

/**
 * 创建并注册全部浏览器渠道（幂等，重复调用只注册一次）
 */
export function registerBrowserChannels(deps: BrowserChannelDeps): BrowserChannelAdapterBase[] {
  const adapters: BrowserChannelAdapterBase[] = []
  const registered = new Set<string>()

  for (const platform of BROWSER_CHANNEL_PLATFORMS) {
    if (registered.has(platform)) continue
    registered.add(platform)
    const displayName = platform === 'kuaishou' ? '快手' : platform === 'xiaohongshu' ? '小红书' : '视频号'
    adapters.push(new GenericBrowserChannelAdapter(platform, displayName, deps))
    // 探针注册（模块加载即注册，幂等）
    if (!identityProbeRegistry.has(platform)) {
      identityProbeRegistry.register(new BrowserChannelProbe(platform, KEY_COOKIES[platform] || []))
    }
  }
  return adapters
}
