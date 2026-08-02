/**
 * platform-metrics-extractor.ts — 平台指标提取器（Platform Metrics Extractor）
 * SPRINT-MEDIA-AI-EMPLOYEE-OPERATION-REALITY-01 Task02
 *
 * 掌柜蓝图：ChannelAccount → Runtime Adapter → Platform Metrics Extractor → ChannelMetricSnapshot
 *
 * 纪律（冻结）：
 * - 无数据必须返回 unavailable + reason，禁止 0 冒充
 * - 提取器只回答「这台数字电脑里，平台当前显示什么」，不写 DB、不操作业务
 * - 每个平台一个 Extractor，注册进 metricsExtractorRegistry，上层零分支
 */

/** 指标提取结果（平台无关，上层唯一依赖） */
export interface MetricExtractionResult {
  /** available = 抓到真实指标；unavailable = 登录失效/页面异常（带 reason） */
  status: 'available' | 'unavailable'
  /** unavailable 时的原因（登录失效/页面结构变化/超时） */
  unavailableReason?: string
  /** 真实指标（可空字段；无数据为 undefined，绝不填 0） */
  metrics?: {
    followerCount?: number
    likeCount?: number
    videoCount?: number
    totalViews?: number
    /** 近7天播放 */
    recentViews?: number
    /** 近7天涨粉 */
    recentFollowerDelta?: number
    /** 互动率（百分比数值，如 3.2 = 3.2%） */
    interactionRate?: number
  }
  /** 数据来源（creator-center / public-profile） */
  source?: string
  /** 追溯：pageUrl / 页面片段 / 提取器版本 */
  rawData?: Record<string, any>
  collectedAt: Date
}

/** 提取器输入：账号上下文（不传凭证，浏览器会话已由上层就绪） */
export interface MetricExtractionContext {
  accountId: string
  channelAccountId: string
  channelName: string
  externalAccountId: string | null
}

/** 平台指标提取器接口 — 小红书/视频号/B站 未来各自实现并注册 */
export interface PlatformMetricsExtractor {
  readonly platform: string
  /** 从指定浏览器会话提取平台指标（会话必须已就绪且指向该账号的数字电脑） */
  extract(sessionId: string, ctx: MetricExtractionContext): Promise<MetricExtractionResult>
}

/** 提取器注册表（上层通过 registry.get(platform) 获取，零分支） */
class MetricsExtractorRegistry {
  private extractors = new Map<string, PlatformMetricsExtractor>()

  register(extractor: PlatformMetricsExtractor): void {
    this.extractors.set(extractor.platform, extractor)
  }

  get(platform: string): PlatformMetricsExtractor | undefined {
    return this.extractors.get(platform)
  }

  has(platform: string): boolean {
    return this.extractors.has(platform)
  }

  list(): string[] {
    return Array.from(this.extractors.keys())
  }
}

export const metricsExtractorRegistry = new MetricsExtractorRegistry()

/** 登录页特征（通用：扫码登录/验证码登录等，用于判定登录失效） */
export const LOGIN_PAGE_MARKERS = ['扫码登录', '扫一扫', '验证码登录', '密码登录', '我是创作者', '我是MCN机构']

/** 从页面文本判定是否登录失效 */
export function detectLoginPage(bodyText: string): boolean {
  return LOGIN_PAGE_MARKERS.some(m => bodyText.includes(m))
}

/** 数字解析：'123.4万' → 1234000；'5678' → 5678；解析失败 → undefined（绝不返回 0） */
export function parseCount(text: string | undefined): number | undefined {
  if (!text) return undefined
  const m = text.trim().match(/^([\d,.]+)\s*(万|w|W|亿)?$/)
  if (!m) return undefined
  const num = parseFloat(m[1].replace(/,/g, ''))
  if (isNaN(num)) return undefined
  const unit = m[2]
  if (unit === '亿') return Math.round(num * 100000000)
  if (unit === '万' || unit === 'w' || unit === 'W') return Math.round(num * 10000)
  return Math.round(num)
}
