/**
 * douyin-metrics.extractor.ts — 抖音指标提取器
 * SPRINT-MEDIA-AI-EMPLOYEE-OPERATION-REALITY-01 Task02
 *
 * 从抖音创作者中心「数据概览」页提取真实指标：
 * - 核心指标：粉丝数 / 获赞数 / 作品数量（页头三卡）
 * - 近7天表现：播放量 / 涨粉 / 互动率（数据概览趋势区）
 *
 * 纪律：
 * - 登录页特征（扫码登录/验证码登录）→ unavailable + 「登录状态已失效，需重新扫码授权」
 * - 解析不到任何指标 → unavailable + 页面结构变化说明（绝不返回 0）
 * - 不 mock、不注入假数据；只读，不点击发布/评论/私信/点赞
 */
import type { PlatformMetricsExtractor, MetricExtractionResult, MetricExtractionContext } from './platform-metrics-extractor.js'
import { metricsExtractorRegistry, detectLoginPage, parseCount } from './platform-metrics-extractor.js'
import { browserRuntime } from '../../../media/browser-runtime.service.js'

const DATA_OVERVIEW_URL = 'https://creator.douyin.com/creator-micro/data/overview'
/** 工作台已登录特征（与 IdentityProbe 一致，多信号防误判） */
const WORKBENCH_MARKERS = ['内容管理', '发布作品', '创作灵感', '作品管理', '数据概览', '创作者服务']

export class DouyinMetricsExtractor implements PlatformMetricsExtractor {
  readonly platform = 'douyin'

  async extract(sessionId: string, ctx: MetricExtractionContext): Promise<MetricExtractionResult> {
    const collectedAt = new Date()
    let pageUrl = DATA_OVERVIEW_URL

    try {
      // 1. 导航到数据概览页（数字电脑的真实浏览器）
      const nav = await browserRuntime.navigate(sessionId, DATA_OVERVIEW_URL, { headless: false })
      if (!nav.success) {
        return {
          status: 'unavailable',
          unavailableReason: `打开抖音数据概览失败: ${nav.error}`,
          source: 'creator-center',
          rawData: { pageUrl: nav.url, error: nav.error },
          collectedAt,
        }
      }
      pageUrl = nav.url

      // 2. 等待数据面板渲染（登录页跳转/数据加载 3-6s）
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
        const bodyText = await page.locator('body').innerText().catch(() => '')

        // 3a. 登录失效判定（登录页特征）
        if (detectLoginPage(bodyText)) {
          return {
            status: 'unavailable',
            unavailableReason: '登录状态已失效，需重新扫码授权',
            source: 'creator-center',
            rawData: { pageUrl, pageSnippet: bodyText.slice(0, 120).replace(/\n/g, ' ') },
            collectedAt,
          }
        }

        // 3b. 工作台未就绪判定（连工作台菜单都没有 → 页面异常）
        const workbenchHits = WORKBENCH_MARKERS.filter(m => bodyText.includes(m)).length
        if (workbenchHits < 2) {
          return {
            status: 'unavailable',
            unavailableReason: `抖音数据概览页面未就绪（工作台特征缺失 ${workbenchHits}/2），可能页面结构变化或未登录`,
            source: 'creator-center',
            rawData: { pageUrl, pageSnippet: bodyText.slice(0, 150).replace(/\n/g, ' ') },
            collectedAt,
          }
        }

        // 3c. 提取核心指标（页头三卡：粉丝/获赞/作品）
        const parseByLabel = (label: string): number | undefined => {
          // 匹配「粉丝 123.4万」「获赞 5678」「作品 88」等文本模式
          const re = new RegExp(`${label}[\\s\\S]{0,10}?([\\d,.]+)\\s*(万|w|W|亿)?`, 'i')
          const m = bodyText.match(re)
          return m ? parseCount(`${m[1]}${m[2] || ''}`) : undefined
        }
        const followerCount = parseByLabel('粉丝')
        const likeCount = parseByLabel('获赞')
        const videoCount = parseByLabel('作品')

        // 3d. 近7天表现（趋势区：播放量/涨粉/互动率；文本正则 + 候选选择器）
        let recentViews: number | undefined
        let recentFollowerDelta: number | undefined
        let interactionRate: number | undefined

        // 近7天播放（常见文案：「近7天播放量 12.3万」「播放量 12.3万」）
        const viewsRe = bodyText.match(/近7天播放(?:量)?[\s\S]{0,12}?([\d,.]+)\s*(万|w|W|亿)?/i)
          || bodyText.match(/播放量[\s\S]{0,12}?([\d,.]+)\s*(万|w|W|亿)?/i)
        if (viewsRe) recentViews = parseCount(`${viewsRe[1]}${viewsRe[2] || ''}`)

        // 近7天涨粉（「涨粉 123」「粉丝增长 +123」）
        const deltaRe = bodyText.match(/涨粉[\s\S]{0,8}?([+-]?[\d,.]+)\s*(万|w|W)?/i)
          || bodyText.match(/粉丝增长[\s\S]{0,8}?([+-]?[\d,.]+)\s*(万|w|W)?/i)
        if (deltaRe) recentFollowerDelta = parseCount(`${deltaRe[1]}${deltaRe[2] || ''}`)

        // 互动率（「互动率 3.2%」「互动率 3.2」）
        const rateRe = bodyText.match(/互动率[\s\S]{0,8}?([\d.]+)\s*%?/i)
        if (rateRe) {
          const v = parseFloat(rateRe[1])
          if (!isNaN(v)) interactionRate = v
        }

        // 3e. 无任何指标 → 诚实 unavailable（绝不返回 0）
        if (followerCount === undefined && likeCount === undefined && videoCount === undefined
          && recentViews === undefined && recentFollowerDelta === undefined && interactionRate === undefined) {
          return {
            status: 'unavailable',
            unavailableReason: '未能从抖音数据概览解析出任何指标（页面结构可能变化）',
            source: 'creator-center',
            rawData: { pageUrl, pageSnippet: bodyText.slice(0, 150).replace(/\n/g, ' ') },
            collectedAt,
          }
        }

        // 3f. 成功：返回真实指标（只读）
        return {
          status: 'available',
          metrics: {
            followerCount,
            likeCount,
            videoCount,
            recentViews,
            recentFollowerDelta,
            interactionRate,
          },
          source: 'creator-center',
          rawData: { pageUrl, pageSnippet: bodyText.slice(0, 200).replace(/\n/g, ' ') },
          collectedAt,
        }
      })
    } catch (e: any) {
      return {
        status: 'unavailable',
        unavailableReason: `抖音指标提取异常: ${e.message}`,
        source: 'creator-center',
        rawData: { pageUrl, error: String(e.message).slice(0, 200) },
        collectedAt,
      }
    }
  }
}

// 注册抖音提取器
metricsExtractorRegistry.register(new DouyinMetricsExtractor())
