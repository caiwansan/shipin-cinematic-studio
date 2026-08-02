/**
 * channel-metrics.service.ts — 渠道指标统一服务（Channel Metrics Reality）
 * SPRINT-MEDIA-AI-EMPLOYEE-OPERATION-REALITY-01 Task02/03
 *
 * 掌柜蓝图：
 *   Alice (AgentChannelBinding read:metrics)
 *     → BrowserWorkspace（数字电脑）
 *     → PlatformMetricsExtractor（真实提取）
 *     → ChannelMetricSnapshot（持久化历史）
 *
 * 纪律（冻结）：
 * - 数据唯一来源：真实 BrowserWorkspace Runtime → Extractor → Snapshot（不 mock、不注入）
 * - 无数据 → status=unavailable + reason（禁止 0 冒充）
 * - AI 员工只能读取授权账号（AgentChannelBinding active + permissions.read）——G5
 * - 追溯链：ChannelAccount → BrowserWorkspace → Runtime → Platform（snapshot 记录 workspaceId/agentId/source/rawData）
 * - 只读：不发布、不评论、不私信、不点赞
 */
import { prisma } from '../../../../utils/index.js'
import { browserWorkspaceService } from '../../browser-workspace.service.js'
import { channelOperationLogService } from '../../channel-operation-log.service.js'
import { channelHealthGuardService } from '../channel-health-guard.service.js'
import { metricsExtractorRegistry, type MetricExtractionResult } from './platform-metrics-extractor.js'
import './douyin-metrics.extractor.js' // 注册抖音提取器（副作用）

export interface MetricSnapshotView {
  id: string
  channelAccountId: string
  workspaceId: string | null
  agentId: string | null
  platform: string
  status: 'available' | 'unavailable'
  unavailableReason: string | null
  metrics: {
    followerCount: number | null
    likeCount: number | null
    videoCount: number | null
    totalViews: number | null
    recentViews: number | null
    recentFollowerDelta: number | null
    interactionRate: number | null
  }
  source: string | null
  collectedAt: string
  createdAt: string
}

/** 权限检查失败（G5：AI 员工只能读取授权账号） */
export class MetricsPermissionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MetricsPermissionError'
  }
}

function mapSnapshot(row: any): MetricSnapshotView {
  return {
    id: row.id,
    channelAccountId: row.channelAccountId,
    workspaceId: row.workspaceId,
    agentId: row.agentId,
    platform: row.platform,
    status: row.status,
    unavailableReason: row.unavailableReason,
    metrics: {
      followerCount: row.followerCount,
      likeCount: row.likeCount,
      videoCount: row.videoCount,
      totalViews: row.totalViews,
      recentViews: row.recentViews,
      recentFollowerDelta: row.recentFollowerDelta,
      interactionRate: row.interactionRate,
    },
    source: row.source,
    collectedAt: row.collectedAt?.toISOString?.() ?? row.collectedAt,
    createdAt: row.createdAt?.toISOString?.() ?? row.createdAt,
  }
}

export class ChannelMetricsService {
  /**
   * Task03 — AI 员工读取权限断言（G5）
   * 规则：binding 必须存在且 active，且 permissions.read === true；workspace 域必须匹配
   */
  async assertAgentReadPermission(agentInstanceId: string, channelAccountId: string, businessType = 'media'): Promise<{ binding: any; workspace: any }> {
    const binding = await prisma.agentChannelBinding.findUnique({
      where: { agentInstanceId_channelAccountId: { agentInstanceId, channelAccountId } },
    })
    if (!binding) {
      throw new MetricsPermissionError(`AI 员工未绑定该渠道账号（无读取权限）`)
    }
    if (binding.status !== 'active') {
      throw new MetricsPermissionError(`AI 员工与该渠道的绑定已暂停（status=${binding.status}）`)
    }
    const perms = (binding.permissions as any) || {}
    if (perms.read !== true) {
      throw new MetricsPermissionError(`AI 员工无 read:metrics 权限（permissions.read=${perms.read}）`)
    }
    // 数字电脑域检查：media 域 AI 员工只能使用 media 域 workspace
    const workspace = binding.browserWorkspaceId
      ? await prisma.browserWorkspace.findUnique({ where: { id: binding.browserWorkspaceId } })
      : await prisma.browserWorkspace.findUnique({ where: { channelAccountId } }).catch(() => null)
    if (!workspace) {
      throw new MetricsPermissionError(`渠道账号没有可用的数字电脑（BrowserWorkspace 不存在）`)
    }
    if (workspace.businessType !== businessType) {
      throw new MetricsPermissionError(`数字电脑业务域不匹配（${workspace.businessType} ≠ ${businessType}）`)
    }
    return { binding, workspace }
  }

  /**
   * Task02/01 — 真实读取指标并持久化快照（AI 员工视角）
   * 流程：权限断言 → 数字电脑 → 提取器 → Snapshot（available/unavailable 都落库，可追溯）
   */
  async collectForAgent(agentInstanceId: string, channelAccountId: string, opts: { tenantId?: string; organizationId?: string; businessType?: string } = {}): Promise<MetricSnapshotView> {
    const businessType = opts.businessType || 'media'
    // Task01 — Channel Health Guard：NEEDS_ATTENTION 账号拒绝执行（保护账号资产）
    await channelHealthGuardService.assertHealthy(channelAccountId, 'read_metrics')

    const { binding, workspace } = await this.assertAgentReadPermission(agentInstanceId, channelAccountId, businessType)

    const account = await prisma.enterpriseChannelAccount.findUnique({ where: { id: channelAccountId } })
    if (!account) throw new Error(`渠道账号不存在: ${channelAccountId}`)

    const platform = account.channelType
    const extractor = metricsExtractorRegistry.get(platform)
    if (!extractor) {
      throw new Error(`平台 ${platform} 的指标提取器未注册（当前支持: ${metricsExtractorRegistry.list().join(', ') || '无'}）`)
    }

    // 数字电脑会话：与登录链路同一 sessionId（profile 复用，登录态共享）
    const sessionId = await browserWorkspaceService.resolveSessionId(channelAccountId, platform)
    const profilePath = workspace.profilePath
    await browserRuntimeEnsure(sessionId, profilePath)

    // 操作审计（read_metrics）
    const log = await channelOperationLogService.begin({
      tenantId: opts.tenantId || account.tenantId,
      organizationId: opts.organizationId,
      workspaceId: workspace.id,
      channelAccountId,
      agentId: agentInstanceId,
      action: 'read_metrics',
      target: platform === 'douyin' ? 'creator-micro/data/overview' : 'metrics',
    } as any)

    let result: MetricExtractionResult
    try {
      result = await extractor.extract(sessionId, {
        accountId: account.id,
        channelAccountId: account.id,
        channelName: account.channelName,
        externalAccountId: account.externalAccountId,
      })
    } catch (e: any) {
      result = {
        status: 'unavailable',
        unavailableReason: `指标提取异常: ${e.message}`,
        collectedAt: new Date(),
        rawData: { error: String(e.message).slice(0, 300) },
      }
    }

    // Task01 — Channel Health Guard 上报：unavailable（登录失效/页面异常）→ 失败计数；available → 成功恢复
    if (result.status === 'available') {
      await channelHealthGuardService.recordSuccess(channelAccountId)
    } else {
      await channelHealthGuardService.recordFailure({
        channelAccountId,
        tenantId: opts.tenantId || account.tenantId,
        organizationId: opts.organizationId || account.organizationId || null,
        error: result.unavailableReason || '指标提取 unavailable',
        by: agentInstanceId,
      }).catch(() => {})
    }

    // 快照持久化（available / unavailable 都落库 → G3 数据刷新后保持）
    const snapshot = await prisma.channelMetricSnapshot.create({
      data: {
        tenantId: opts.tenantId || account.tenantId,
        organizationId: opts.organizationId || account.organizationId || null,
        channelAccountId,
        workspaceId: workspace.id,
        agentId: agentInstanceId,
        platform,
        followerCount: result.status === 'available' ? result.metrics?.followerCount ?? null : null,
        likeCount: result.status === 'available' ? result.metrics?.likeCount ?? null : null,
        videoCount: result.status === 'available' ? result.metrics?.videoCount ?? null : null,
        totalViews: result.status === 'available' ? result.metrics?.totalViews ?? null : null,
        recentViews: result.status === 'available' ? result.metrics?.recentViews ?? null : null,
        recentFollowerDelta: result.status === 'available' ? result.metrics?.recentFollowerDelta ?? null : null,
        interactionRate: result.status === 'available' ? result.metrics?.interactionRate ?? null : null,
        status: result.status,
        unavailableReason: result.unavailableReason || null,
        source: result.source || null,
        collectedAt: result.collectedAt,
        rawData: (result.rawData || {}) as any,
      },
    })

    await channelOperationLogService.finish(log.id, result.status === 'available' ? 'success' : 'failed', {
      status: result.status,
      reason: result.unavailableReason,
      collectedAt: result.collectedAt.toISOString(),
    } as any)

    return mapSnapshot(snapshot)
  }

  /** 最新快照（owner-view / 前端展示用；无快照返回 null） */
  async latest(channelAccountId: string): Promise<MetricSnapshotView | null> {
    const row = await prisma.channelMetricSnapshot.findFirst({
      where: { channelAccountId },
      orderBy: { collectedAt: 'desc' },
    })
    return row ? mapSnapshot(row) : null
  }

  /** 历史快照（趋势；默认近 7 天） */
  async history(channelAccountId: string, days = 7, limit = 30): Promise<MetricSnapshotView[]> {
    const since = new Date(Date.now() - days * 24 * 3600 * 1000)
    const rows = await prisma.channelMetricSnapshot.findMany({
      where: { channelAccountId, collectedAt: { gte: since } },
      orderBy: { collectedAt: 'asc' },
      take: limit,
    })
    return rows.map(mapSnapshot)
  }

  /**
   * Task05 — AI 运营分析（只读：真实数据 → 分析 → 建议 → 人工确认）
   * - 有真实数据（available 快照 ≥1）→ 调 LLM 生成分析 + 运营建议 + 置信度分级
   * - 无真实数据 → 返回 unavailable（绝不编造结论）
   * - LLM 不可用 → 规则兜底（不阻塞，标注 analysisSource=rules）
   */
  async analyzeForAgent(agentInstanceId: string, channelAccountId: string, opts: { llmUserId?: string } = {}): Promise<any> {
    await this.assertAgentReadPermission(agentInstanceId, channelAccountId)
    // Task03 — 30 天数据窗口（置信度 strong 判定需要 30 天+）
    const snapshots = await this.history(channelAccountId, 30, 60)
    const available = snapshots.filter(s => s.status === 'available' && s.metrics)
    const latestRow = snapshots[snapshots.length - 1] || (await this.latest(channelAccountId))

    if (!latestRow || latestRow.status !== 'available' || !latestRow.metrics || !latestRow.metrics.followerCount) {
      // 无真实数据 → warning + 不编造
      const confidence = computeAnalysisConfidence([], latestRow)
      return {
        status: 'unavailable',
        unavailableReason: latestRow?.unavailableReason || '暂无真实指标数据，无法生成分析（登录后自动采集）',
        collectedAt: latestRow?.collectedAt || null,
        confidence,
        // 绝不编造：无数据 → 无分析
        analysis: null,
        suggestions: [],
        // 只读红线（与 available 分支一致）：不执行任何发布/互动操作
        executeRequired: false,
        note: '仅只读分析，不执行任何发布/互动操作',
      }
    }

    const m = latestRow.metrics
    const confidence = computeAnalysisConfidence(available, latestRow)
    // 环比上一份可用快照（趋势）
    const prev = available.filter(s => s.collectedAt !== latestRow.collectedAt).pop() || null
    const trend = (cur: number | null, prevVal: number | null): string => {
      if (cur == null) return '暂无数据'
      if (prevVal == null) return `${cur.toLocaleString()}（首次采集）`
      if (prevVal === 0) return `${cur.toLocaleString()}`
      const pct = Math.round(((cur - prevVal) / prevVal) * 100)
      return `${cur.toLocaleString()}（${pct >= 0 ? '+' : ''}${pct}% vs 上次）`
    }

    const prompt = `你是「昆仑镜」新媒体运营 AI 分析员工 Alice，为老板生成只读运营分析。基于以下真实采集数据：

平台：抖音
账号：${latestRow.platform}
采集时间：${latestRow.collectedAt}
数据充分度：${confidence.level}（${confidence.reason}）—— 数据不足时务必如实说明，不得夸大结论
粉丝数：${trend(m.followerCount, prev?.metrics?.followerCount ?? null)}
获赞数：${trend(m.likeCount, prev?.metrics?.likeCount ?? null)}
作品数：${trend(m.videoCount, prev?.metrics?.videoCount ?? null)}
近7天播放：${trend(m.recentViews, prev?.metrics?.recentViews ?? null)}
近7天涨粉：${trend(m.recentFollowerDelta, prev?.metrics?.recentFollowerDelta ?? null)}
互动率：${m.interactionRate != null ? m.interactionRate + '%' : '暂无数据'}

要求：
1. 只基于以上数据，不要编造不存在的数据
2. 输出 JSON：{"summary":"一段 80-150 字的人话总结","findings":["发现1","发现2"],"suggestions":["建议1","建议2"]}
3. 发现和建议各 2-3 条，具体可执行（如：增加发布频率/调整发布时间/优化选题方向）
4. 数据不足时如实说明，不夸大`

    let analysis: any
    let analysisSource: 'llm' | 'rules' = 'llm'
    try {
      const { deepseekChat } = await import('../../../hdz/llm.client.js')
      const raw = await deepseekChat(opts.llmUserId || 'default', '你是严谨的运营分析师，只输出 JSON。', prompt, 2048)
      const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim())
      analysis = {
        summary: parsed.summary || '',
        findings: Array.isArray(parsed.findings) ? parsed.findings : [],
        suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
      }
    } catch (e: any) {
      // Task03 — LLM 不可用 → 规则兜底（MatrixFlow ruleBased 思想）：不编造，但给可解释的规则建议
      analysisSource = 'rules'
      analysis = {
        summary: `已采集 ${available.length} 次真实指标（覆盖 ${confidence.dataDays} 天），LLM 分析暂不可用，以下为规则引擎建议（${e.message}）`,
        findings: [],
        suggestions: ruleBasedSuggestions(m),
      }
    }

    return {
      status: 'available',
      collectedAt: latestRow.collectedAt,
      metrics: latestRow.metrics,
      confidence,
      analysis,
      analysisSource,
      // 人工确认前置（Task05 纪律：只读分析，不自动执行）
      executeRequired: false,
      note: '仅只读分析，不执行任何发布/互动操作',
    }
  }
}

/** 核心指标清单（置信度覆盖判定用） */
const CORE_METRICS = ['followerCount', 'likeCount', 'videoCount'] as const

/**
 * Task03 — AI 分析置信度系统（Analysis Confidence）
 * 掌柜蓝图：AI 员工最容易犯的错不是不会分析，而是不知道自己有没有足够数据。
 *   strong : 数据 30 天+ 且 作品 ≥10 且 核心指标完整 → 结论可靠
 *   medium : 数据 7 天+ → 可参考
 *   weak   : 有数据但不足 7 天 → 仅供参考
 *   warning: 无数据 / 数据异常 → 不生成分析
 */
export function computeAnalysisConfidence(available: MetricSnapshotView[], latest: MetricSnapshotView | null): AnalysisConfidence {
  const now = new Date()
  const present = new Set<string>()
  const metrics = latest?.metrics
  for (const key of CORE_METRICS) {
    const v = metrics?.[key]
    if (v != null && v > 0) present.add(key)
  }
  const missing = CORE_METRICS.filter(k => !present.has(k))

  if (!latest || latest.status !== 'available' || available.length === 0) {
    return {
      level: 'warning',
      label: '数据不足',
      reason: latest?.unavailableReason || '暂无真实指标数据，无法生成分析',
      dataDays: 0,
      sampleSize: 0,
      metricsCoverage: { present: [], missing: [...CORE_METRICS] },
    }
  }

  // 数据覆盖天数：最早可用快照 → 最新快照（不足 1 天按 1 天）
  const first = available[0]
  const firstTs = new Date(first.collectedAt).getTime()
  const lastTs = new Date(latest.collectedAt).getTime()
  const dataDays = Math.max(1, Math.ceil((lastTs - firstTs) / 86400000))
  const sampleSize = available.length
  const videoCount = latest.metrics?.videoCount ?? 0

  if (dataDays >= 30 && videoCount >= 10 && missing.length === 0) {
    return {
      level: 'strong',
      label: '高置信',
      reason: `数据覆盖 ${dataDays} 天（${sampleSize} 次采集），作品 ${videoCount} 个，核心指标完整`,
      dataDays,
      sampleSize,
      metricsCoverage: { present: [...present], missing },
    }
  }
  if (dataDays >= 7) {
    return {
      level: 'medium',
      label: '中等置信',
      reason: `数据覆盖 ${dataDays} 天（${sampleSize} 次采集），未达 30 天+10 作品的高置信门槛`,
      dataDays,
      sampleSize,
      metricsCoverage: { present: [...present], missing },
    }
  }
  return {
    level: 'weak',
    label: '低置信',
    reason: `数据覆盖仅 ${dataDays} 天（${sampleSize} 次采集），样本不足，结论仅供参考`,
    dataDays,
    sampleSize,
    metricsCoverage: { present: [...present], missing },
  }
}

/** Task03 — 规则兜底建议（LLM 不可用时不阻塞；可解释、不编造） */
export function ruleBasedSuggestions(m: MetricSnapshotView['metrics']): string[] {
  const tips: string[] = []
  const videoCount = m.videoCount ?? 0
  const followerCount = m.followerCount ?? 0
  const delta = m.recentFollowerDelta
  const rate = m.interactionRate

  if (videoCount < 10) {
    tips.push(`作品数量偏少（${videoCount} 个），建议保持稳定更新频率（每周 3-5 条）以积累数据样本`)
  }
  if (delta != null && delta < 0) {
    tips.push(`近 7 天掉粉 ${Math.abs(delta)}，建议复盘近期选题与发布时间`)
  }
  if (rate != null && rate < 2) {
    tips.push(`互动率 ${rate}% 偏低，建议优化标题/封面引导评论与点赞`)
  }
  if (followerCount < 1000) {
    tips.push(`粉丝基数较小（${followerCount}），建议聚焦垂直内容，先跑通单条爆款`)
  }
  if (tips.length === 0) {
    tips.push('数据表现平稳，建议保持现有发布节奏并持续观察趋势')
  }
  return tips
}

/** Task04 — 规则摘要（owner-view 展示用，零 LLM 成本；完整分析走 /metrics/analyze） */
export function ruleBasedSummary(m: MetricSnapshotView['metrics'], confidence: AnalysisConfidence): string {
  const follower = m.followerCount ?? null
  const video = m.videoCount ?? null
  const delta = m.recentFollowerDelta ?? null
  const rate = m.interactionRate ?? null
  const parts: string[] = []
  if (follower != null) parts.push(`粉丝 ${follower.toLocaleString()}`)
  if (video != null) parts.push(`作品 ${video} 个`)
  if (delta != null) parts.push(`近7天${delta >= 0 ? '涨粉' : '掉粉'} ${Math.abs(delta)}`)
  if (rate != null) parts.push(`互动率 ${rate}%`)
  const base = parts.length ? parts.join(' · ') : '暂无完整指标'
  if (confidence.level === 'weak') return `${base}｜数据样本不足，持续采集后再分析`
  if (confidence.level === 'warning') return `${base}｜数据不可用，无法分析`
  const tips = ruleBasedSuggestions(m)
  return `${base}｜${tips[0]}`
}

export type AnalysisConfidenceLevel = 'strong' | 'medium' | 'weak' | 'warning'

export interface AnalysisConfidence {
  level: AnalysisConfidenceLevel
  label: string
  reason: string
  dataDays: number
  sampleSize: number
  metricsCoverage: { present: string[]; missing: string[] }
}

/** 确保数字电脑浏览器实例就绪（复用持久化 profile，登录态共享） */
async function browserRuntimeEnsure(sessionId: string, profilePath: string): Promise<void> {
  const { browserRuntime } = await import('../../../media/browser-runtime.service.js')
  await browserRuntime.getOrCreatePersistent(sessionId, profilePath, { headless: false })
}

export const channelMetricsService = new ChannelMetricsService()
