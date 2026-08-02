/**
 * browser-metrics.extractor.ts — 通用浏览器渠道指标提取器（配置驱动，零平台分支）
 * SPRINT-MEDIA-LOGIN-REALITY-HARDENING-02 Task05
 *
 * 掌柜蓝图：快手/小红书/视频号等平台 = meta.metricsExtraction 配置（dataUrl + rules），
 * 提取器通用实现——打开 dataUrl → 等渲染 → 按 label 正则解析数字（支持 万/w 单位）。
 *
 * 纪律：
 * - 无数据必须返回 unavailable + reason，禁止 0 冒充
 * - 登录页特征 → unavailable + 「登录状态已失效，需重新扫码授权」
 * - 解析不到任何指标 → unavailable + 页面结构变化说明
 * - 只读，不点击发布/评论/私信/点赞；不 mock
 * - 禁止 if(platform==="xxx") 分支——规则 100% 来自 meta
 */
import type { PlatformMetricsExtractor, MetricExtractionResult, MetricExtractionContext } from './platform-metrics-extractor.js'
import { metricsExtractorRegistry, detectLoginPage, parseCount } from './platform-metrics-extractor.js'
import { browserRuntime } from '../../../media/browser-runtime.service.js'
import { CHANNEL_META } from '../../../../enterprise/channel/adapters/browser-channel.meta.js'

export class BrowserMetricsExtractor implements PlatformMetricsExtractor {
  readonly platform: string

  constructor(platform: string) {
    this.platform = platform
  }

  async extract(sessionId: string, ctx: MetricExtractionContext): Promise<MetricExtractionResult> {
    const collectedAt = new Date()
    const meta = CHANNEL_META[this.platform]
    const cfg = meta?.metricsExtraction
    if (!cfg) {
      // 配置缺失 = 该平台未实现数据读取 → 诚实报未实现（绝不 0 冒充）
      return {
        status: 'unavailable',
        unavailableReason: `平台 ${this.platform} 未配置 metricsExtraction（browser-channel.meta.ts）`,
        source: 'creator-center',
        rawData: { pageUrl: '', reason: 'no config' },
        collectedAt,
      }
    }

    const dataUrl = cfg.dataUrl
    let pageUrl = dataUrl
    try {
      // 1. 导航到数据中心页（数字电脑的真实浏览器）
      const nav = await browserRuntime.navigate(sessionId, dataUrl, { headless: false })
      if (!nav.success) {
        return {
          status: 'unavailable',
          unavailableReason: `打开 ${meta.displayName} 数据中心失败: ${nav.error}`,
          source: 'creator-center',
          rawData: { pageUrl: nav.url, error: nav.error },
          collectedAt,
        }
      }
      pageUrl = nav.url

      // 2. 等待数据面板渲染（SPA 3-6s）
      await new Promise(r => setTimeout(r, 3500 + Math.random() * 1500))

      // 3. 提取页面内容
      return await browserRuntime.withPage(sessionId, async (page) => {
        if (page.isClosed()) {
          return {
            status: 'unavailable',
            unavailableReason: '浏览器页面已关闭，无法读取指标',
            source: 'creator-center',
            rawData: { pageUrl },
            collectedAt,
          }
        }
        const url = page.url()
        let bodyText = await page.locator('body').innerText().catch(() => '')
        if (!bodyText || bodyText.trim().length === 0) {
          bodyText = await page.evaluate(() => document.body ? document.body.textContent || '' : '').catch(() => '') || ''
        }

        // 登录失效判定（与探针同一套信号：登录页 marker 或 URL 登录路径）
        const loginByUrl = /\/login|\/signin|\/passport|\/auth|\/sso|login\.html|login\.php/i.test(url)
        const loginByBody = detectLoginPage(bodyText) || meta.identityRules.loginPageMarkers.some(m => bodyText.includes(m))
        if (loginByUrl || loginByBody) {
          return {
            status: 'unavailable',
            unavailableReason: '登录状态已失效，需重新扫码授权',
            source: 'creator-center',
            rawData: { pageUrl: url, pageText: bodyText.slice(0, 120) },
            collectedAt,
          }
        }

        // LOGIN-REALITY-HARDENING-02 — 数据页判定（防未登录跳转页/游客页误解析空状态文案）：
        // 当前 URL 必须命中平台工作台特征（meta.urlFragments）才允许提取指标。
        // 快手实测：cp.kuaishou.com 未登录自动跳 /profile（游客页含「粉丝/作品/获赞」空状态文案），
        // 若在此页解析会把空状态 0 冒充为真实指标（违反「绝不 0 冒充」）。
        const excludeHit = meta.identityRules.excludeUrlPatterns?.some(re => re.test(url))
        const inWorkspace = meta.identityRules.urlFragments.some(f => url.includes(f))
        if (excludeHit || !inWorkspace) {
          return {
            status: 'unavailable',
            unavailableReason: `未进入 ${meta.displayName} 数据中心页（当前: ${url}），可能未登录或页面跳转，需重新扫码授权`,
            source: 'creator-center',
            rawData: { pageUrl: url, pageText: bodyText.slice(0, 150) },
            collectedAt,
          }
        }

        // 4. 按配置规则解析：label → 字段（如快手「粉丝 12.3万」→ followerCount=123000）
        //    规则：在页面文本中找 label 附近的数字（label 后 30 字符内），parseCount 支持 万/w 单位
        const metrics: MetricExtractionResult['metrics'] = {}
        let hitCount = 0
        for (const rule of cfg.rules) {
          const re = new RegExp(`${rule.label}[^\\d]{0,12}([\\d,.]+\\s*(万|w|W|亿)?)`)
          const m = bodyText.match(re)
          const value = m ? parseCount(m[1]) : undefined
          if (value !== undefined) {
            ;(metrics as any)[rule.field] = value
            hitCount++
          }
        }

        // 5. 最近内容（可选，rawData.recentContent）
        let recentContent: string[] = []
        if (cfg.recentContentSelector) {
          recentContent = await page.$$eval(cfg.recentContentSelector, els =>
            Array.from(new Set(els.slice(0, 5).map(el => (el.textContent || '').trim()).filter(t => t && t.length < 60)))
          ).catch(() => [])
        }

        // 解析到任何指标才算 available；否则 unavailable + 页面结构变化（绝不返回 0）
        if (hitCount === 0) {
          return {
            status: 'unavailable',
            unavailableReason: `数据中心页面结构变化或指标未渲染（解析 ${cfg.rules.length} 条规则均未命中），可尝试重新登录后重试`,
            source: 'creator-center',
            rawData: { pageUrl: url, pageText: bodyText.slice(0, 300), rules: cfg.rules.map(r => r.label) },
            collectedAt,
          }
        }

        return {
          status: 'available',
          metrics,
          source: 'creator-center',
          rawData: { pageUrl: url, recentContent: recentContent.length ? recentContent : undefined, hitRules: cfg.rules.filter((_, i) => hitCount > i).map(r => r.label) },
          collectedAt,
        }
      })
    } catch (e: any) {
      return {
        status: 'unavailable',
        unavailableReason: `指标提取异常: ${e.message}`,
        source: 'creator-center',
        rawData: { pageUrl, error: String(e.message).slice(0, 200) },
        collectedAt,
      }
    }
  }
}

/** 注册通用提取器（快手/小红书/视频号；meta.metricsExtraction 已配置的平台） */
export function registerBrowserMetricsExtractors(): void {
  const targets = ['kuaishou', 'xiaohongshu', 'channels_wechat']
  for (const platform of targets) {
    if (!metricsExtractorRegistry.has(platform)) {
      metricsExtractorRegistry.register(new BrowserMetricsExtractor(platform))
      console.log(`[Metrics] 注册通用指标提取器: ${platform}（配置驱动）`)
    }
  }
}
