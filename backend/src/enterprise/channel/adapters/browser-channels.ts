/**
 * browser-channels.ts — 通用浏览器渠道实例工厂 + 探针注册（配置驱动）
 * SPRINT-MEDIA-CHANNEL-ADAPTER-EXPANSION-01 Task01 平台接入标准化
 *
 * 每个渠道 = BrowserChannelAdapterBase 子类（仅平台标识差异）+ BrowserChannelProbe 注册。
 * 平台差异（登录 URL/工作台特征/身份提取/关键 cookie）100% 在 browser-channel.meta.ts 配置。
 *
 * 新增渠道：
 * 1. browser-channel.meta.ts 加一条 ChannelPlatformDefinition（无需写任何平台分支）
 * 2. 本文件 BROWSER_CHANNEL_PLATFORMS 加平台名（probe 自动注册）
 * 3. 前端 accounts.vue 渠道数组标 platform + connectable
 */
import { BrowserChannelAdapterBase, type BrowserChannelDeps } from './browser-channel.adapter.js'
import { BrowserChannelProbe } from './browser-channel.probe.js'
import { identityProbeRegistry } from '../identity-probe.js'
import { CHANNEL_META } from './browser-channel.meta.js'

/** 浏览器渠道平台列表（meta 已配置 + 探针已注册） */
export const BROWSER_CHANNEL_PLATFORMS = ['kuaishou', 'xiaohongshu', 'channels_wechat']

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
    const displayName = CHANNEL_META[platform]?.displayName ?? platform
    adapters.push(new GenericBrowserChannelAdapter(platform, displayName, deps))
    // 探针注册（模块加载即注册，幂等）；cookie 信号从 meta.identityRules.cookies 读取
    if (!identityProbeRegistry.has(platform)) {
      identityProbeRegistry.register(new BrowserChannelProbe(platform))
    }
  }
  return adapters
}
