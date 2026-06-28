/**
 * shadow-ui-router.ts — Phase 5C: Shadow UI Binding Protocol
 *
 * 在昆仑镜路由上运行，但处于 shadow mode。
 * 特点：
 *   1. 接昆仑镜路由（前端可以调）
 *   2. 只跑 shadow mode（不影响真实用户流）
 *   3. 所有请求被记录但不注入任何 feedback loop
 *   4. Kernel vs UI divergence monitor
 *
 * Shadow Mode Router 是"单向窗口"：
 *   Kernel → Shadow → UI（可见）
 *   UI ----------X--→ Kernel（不可见）
 */

import type { StoryConstitution } from '../schema/story-constitution.js'
import { directorProjection, type DirectorStatus, type ScenePreview, type GenerationResult, type SafeIntentHint } from './director-projection.js'
import { cinematicIntent, type CinematicIntentVector } from './cinematic-intent.js'
import { semanticEnergy } from './semantic-energy.js'

// ============================================================
// Types
// ============================================================

export interface ShadowRequest {
  /** 请求唯一 ID */
  requestId: string
  /** 时间戳 */
  timestamp: number
  /** 来源 */
  source: string
  /** 请求类型 */
  type: 'generate' | 'preview' | 'refine' | 'status'
  /** 请求体（只读副本） */
  payload: Record<string, unknown>
}

export interface ShadowResponse {
  /** 对应的 requestId */
  requestId: string
  /** 时间戳 */
  timestamp: number
  /** 响应延迟（ms） */
  latency: number
  /** 发出的投影数据 */
  projection: GenerationResult
  /** 发出的状态 */
  status: {
    coherenceLevel: string
    coherenceScore: number
    energyLevel: string
    energyScore: number
    intentVersion: number
  }
  /** 被拦截的 mutation（如果请求试图写回 kernel） */
  blockedMutation: boolean
  /** 拦截详情 */
  blockReason?: string
}

export interface ShadowSession {
  /** 项目 ID */
  projectId: string
  /** 当前 intent（kernel 的真实锚点） */
  currentIntent: CinematicIntentVector
  /** 当前 constitution（kernel 的真实状态） */
  currentConstitution: StoryConstitution
  /** 请求历史 */
  requests: ShadowRequest[]
  /** 响应历史 */
  responses: ShadowResponse[]
  /** 创建的 shadow constitution（UI 看到但 kernel 看不到的副本） */
  shadowConstitution: StoryConstitution
}

export interface DivergenceMetric {
  /** 指标名称 */
  name: string
  /** 差异值 0-1（0=无差异，1=完全漂移） */
  divergence: number
  /** 详细说明 */
  detail: string
}

export interface ShadowSummary {
  /** 项目 ID */
  projectId: string
  /** 总请求数 */
  totalRequests: number
  /** 被拦截的 mutation 数 */
  blockedMutations: number
  /** 当前所有 divergence metrics */
  divergences: DivergenceMetric[]
  /** 是否触发警报 */
  alerts: string[]
  /** 是否安全切换到 production mode */
  productionReady: boolean
}

// ============================================================
// Shadow Router
// ============================================================

const MUTATION_TYPES = new Set(['refine', 'override', 'inject', 'force_correct'])
const READ_TYPES = new Set(['generate', 'preview', 'status'])

export class ShadowUIRouter {
  /** 所有活跃的 shadow sessions */
  private sessions: Map<string, ShadowSession> = new Map()
  /** 允许通过 shadow 的 mutation 白名单 */
  private allowedMutations: Set<string> = new Set()

  /**
   * 创建 shadow session
   */
  createSession(
    projectId: string,
    constitution: StoryConstitution,
    intent?: CinematicIntentVector,
  ): ShadowSession {
    const session: ShadowSession = {
      projectId,
      currentIntent: intent || cinematicIntent.buildFromConstitution(projectId, constitution),
      currentConstitution: JSON.parse(JSON.stringify(constitution)),
      requests: [],
      responses: [],
      shadowConstitution: JSON.parse(JSON.stringify(constitution)),
    }

    this.sessions.set(projectId, session)
    return session
  }

  /**
   * 处理前端请求（shadow mode）
   *
   * @returns [projection response, blocked?]
   */
  handleRequest(
    projectId: string,
    type: ShadowRequest['type'],
    payload: Record<string, unknown> = {},
  ): { response: ShadowResponse; session: ShadowSession } {
    const session = this.sessions.get(projectId)
    if (!session) {
      throw new Error(`No shadow session for project: ${projectId}`)
    }

    const request: ShadowRequest = {
      requestId: `${projectId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
      source: 'shadow_ui',
      type,
      payload: JSON.parse(JSON.stringify(payload)),
    }

    session.requests.push(request)

    const startTime = Date.now()
    let blockedMutation = false
    let blockReason: string | undefined

    // Shadow routing logic
    if (MUTATION_TYPES.has(type)) {
      // Mutation 请求 — 在 shadow mode 下被拦截
      blockedMutation = true
      blockReason = `Shadow Mode: mutation type '${type}' blocked to protect kernel. ` +
        `Payload logged for review but not applied to kernel state.`
    }

    // 构建投影响应（从 kernel 的真实 constitution）
    const energy = semanticEnergy.compute(session.currentConstitution)
    const coherence = cinematicIntent.scoreCoherence(session.currentIntent, session.currentConstitution)
    const projection = directorProjection.buildResult(
      projectId,
      session.currentConstitution,
      coherence.level,
      energy,
    )

    const response: ShadowResponse = {
      requestId: request.requestId,
      timestamp: Date.now(),
      latency: Date.now() - startTime,
      projection,
      status: {
        coherenceLevel: coherence.level,
        coherenceScore: coherence.total,
        energyLevel: energy.level,
        energyScore: energy.total,
        intentVersion: session.currentIntent.version,
      },
      blockedMutation,
      blockReason,
    }

    session.responses.push(response)

    return { response, session }
  }

  /**
   * 计算 UI 和 kernel 之间的 divergence
   */
  computeDivergence(projectId: string): DivergenceMetric[] {
    const session = this.sessions.get(projectId)
    if (!session) return []

    const metrics: DivergenceMetric[] = []
    const constitution = session.currentConstitution
    const shadow = session.shadowConstitution

    // 1. Theme divergence
    const themeDiv = this.stringDivergence(
      String(constitution.coreTheme || ''),
      String(shadow.coreTheme || ''),
    )
    metrics.push({
      name: 'theme_drift',
      divergence: themeDiv,
      detail: `kernel="${constitution.coreTheme}" shadow="${shadow.coreTheme}"`,
    })

    // 2. Emotion divergence
    const kernelEmotion = String(constitution.emotionalTrajectory?.dominantEmotion || '')
    const shadowEmotion = String(shadow.emotionalTrajectory?.dominantEmotion || '')
    metrics.push({
      name: 'emotion_drift',
      divergence: this.stringDivergence(kernelEmotion, shadowEmotion),
      detail: `kernel="${kernelEmotion}" shadow="${shadowEmotion}"`,
    })

    // 3. Character count divergence
    const kernelChars = (constitution.characterLaws || []).length
    const shadowChars = (shadow.characterLaws || []).length
    metrics.push({
      name: 'character_count',
      divergence: kernelChars !== shadowChars ? 1 : 0,
      detail: `kernel=${kernelChars} shadow=${shadowChars}`,
    })

    // 4. Scene structure divergence (projection 层是否漂移)
    const kernelProj = directorProjection.buildResult(
      projectId,
      constitution,
      cinematicIntent.scoreCoherence(session.currentIntent, constitution).level,
      semanticEnergy.compute(constitution),
    )
    const shadowProj = directorProjection.buildResult(
      projectId,
      shadow,
      cinematicIntent.scoreCoherence(session.currentIntent, shadow).level,
      semanticEnergy.compute(shadow),
    )

    const sceneDiv = this.sceneDivergence(kernelProj.scenes, shadowProj.scenes)
    metrics.push({
      name: 'scene_structure',
      divergence: sceneDiv,
      detail: `kernel scenes=${kernelProj.scenes.length} shadow scenes=${shadowProj.scenes.length}`,
    })

    return metrics
  }

  /**
   * 生成完整的 shadow session 总结
   */
  summarize(projectId: string): ShadowSummary {
    const session = this.sessions.get(projectId)
    if (!session) {
      return {
        projectId,
        totalRequests: 0,
        blockedMutations: 0,
        divergences: [],
        alerts: [],
        productionReady: false,
      }
    }

    const divergences = this.computeDivergence(projectId)
    const blockedMutations = session.responses.filter(r => r.blockedMutation).length

    const alerts: string[] = []
    let productionReady = true

    for (const d of divergences) {
      if (d.divergence > 0.5) {
        alerts.push(`${d.name}: divergence=${d.divergence.toFixed(2)} — ${d.detail}`)
        productionReady = false
      }
    }

    if (alerts.length === 0 && session.requests.length < 5) {
      alerts.push('Insufficient request history for production readiness assessment')
      productionReady = false
    }

    // 检查是否有 blocked mutations 被尝试
    if (blockedMutations > 0) {
      alerts.push(`${blockedMutations} mutation(s) were blocked — possible UI feedback loop attempts`)
    }

    return {
      projectId,
      totalRequests: session.requests.length,
      blockedMutations,
      divergences,
      alerts,
      productionReady,
    }
  }

  /**
   * 安全销毁 shadow session
   */
  destroySession(projectId: string): void {
    this.sessions.delete(projectId)
  }

  // ============================================================
  // Helpers
  // ============================================================

  private stringDivergence(a: string, b: string): number {
    if (a === b) return 0
    if (!a && !b) return 0
    if (!a || !b) return 1

    const aLC = a.toLowerCase()
    const bLC = b.toLowerCase()

    if (aLC === bLC) return 0
    if (aLC.includes(bLC) || bLC.includes(aLC)) return 0.3

    // Jaccard-like word overlap
    const aWords = new Set(aLC.split(/[\s,，。]+/).filter(Boolean))
    const bWords = new Set(bLC.split(/[\s,，。]+/).filter(Boolean))
    const intersection = new Set([...aWords].filter(w => bWords.has(w)))
    const union = new Set([...aWords, ...bWords])

    return union.size === 0 ? 0 : 1 - (intersection.size / union.size)
  }

  private sceneDivergence(a: ScenePreview[], b: ScenePreview[]): number {
    if (a.length !== b.length) {
      // Scene structure changed — major divergence
      return Math.min(1, Math.abs(a.length - b.length) / Math.max(a.length, b.length, 1))
    }

    // Compare scene titles
    let titleDiff = 0
    for (let i = 0; i < a.length; i++) {
      titleDiff += this.stringDivergence(a[i].title, b[i]?.title || '')
    }

    return titleDiff / a.length
  }
}

/** 全局单例 */
export const shadowUIRouter = new ShadowUIRouter()
