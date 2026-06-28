/**
 * constitution-compiler.ts — Story Constitution 编译器 (v2 Dual-Lane)
 *
 * 架构升级：从"单 LLM 做所有事"到"Dual-Lane Runtime"
 *
 * 之前的问题：
 *   DeepSeek 做 100% 的工作 → latency variance = 12s ~ 90s
 *
 * 现在：
 *   Lane A (Fast Skeleton)：小 prompt + 快速模型 → 1-5s 返回结构化骨架
 *   Lane B (Deep Enrichment)：DeepSeek 深度语义丰富 → 10-20s
 *   Fallback Cache：上次成功的 Constitution → 0ms
 *
 * 核心原则：
 *   - DeepSeek = authoritative semantic generator
 *   - Skeleton = structural continuity keeper
 *   - Cache = continuity survives even without LLM
 *
 * 产出 immutable StoryConstitution，下游 agent 只读消费。
 */

import { narrativeGateway, type GatewayRequest } from '../runtime/narrative-gateway.js'
import { llmNormalizer, type NormalizeResult } from './norm/llm-normalizer.js'
import { schemaValidator } from './norm/schema-validator.js'
import { semanticRepairEngine, type RepairResult } from './norm/semantic-repair.js'
import { defaultFallbackPolicy, type FallbackRecord } from './norm/fallback-policy.js'
import { constitutionCache } from './runtime/constitution-cache.js'
import { cacheGovernor } from './runtime/cache-governor.js'
import { constitutionMergeEngine } from './runtime/constitution-merge.js'
import { driftScorer } from './runtime/drift-scorer.js'
import { skeletonCompiler, extractSkeleton, type SkeletonCompileResult } from './runtime/skeleton-compiler.js'
import type { StoryConstitution, StoryConstitutionFields } from './schema/story-constitution.js'
import { createDefaultConstitution } from './schema/story-constitution.js'

// ============================================================
// Types
// ============================================================

export interface ConstitutionCompileResult {
  /** 最终的宪法（始终有效） */
  constitution: StoryConstitution

  /** 归一化结果 */
  normalization: NormalizeResult

  /** 语义修复结果 */
  repair: RepairResult

  /** 降级记录 */
  fallbacks: FallbackRecord[]

  /** 编译总耗时 */
  totalLatencyMs: number

  /** 编译是否成功（degraded 不等于 failed） */
  success: boolean

  /** Flow: "full_enrichment" | "skeleton_only" | "cache_hit" | "degraded_default" */
  compileMode: 'full_enrichment' | 'skeleton_only' | 'cache_hit' | 'degraded_default'

  /** 骨架阶段耗时 */
  skeletonLatencyMs?: number

  /** 丰富阶段耗时 */
  enrichLatencyMs?: number

  /** LLM 原始输出（供调试） */
  rawLLMOutput?: string
}

// ============================================================
// Enrichment System Prompt (Full constitution)
// ============================================================

const ENRICH_SYSTEM_PROMPT = `你是 Story Constitution Compiler。基于剧本和已有结构骨架，生成完整的导演宪法 JSON。

你已经拿到剧本的结构骨架（coreTheme, emotions, characters等），
现在需要：
1. 填充视觉教义（色彩、灯光、运镜、构图）
2. 填充节奏教义（beatMap、pacing curve、hook density）
3. 丰富情绪弧线（segments 至少3个）
4. 完善角色法则（visualLock细节、emotionToVisual）
5. 完整世界物理

只输出 JSON，不做解释。

Schema:
{
  "coreTheme": "一句话核心主题",

  "emotionalTrajectory": {
    "dominantEmotion": "主导情绪",
    "arcType": "linear|wave|inverted_u|u_shape|crescendo|diminuendo|complex",
    "segments": [{ "id": "seg_001", "name": "开场", "primaryEmotion": "情绪", "intensity": 1-10, "direction": "rising|falling|plateau|spike|drop|peak", "durationRatio": 0-1, "emotionTags": [""] }],
    "peakIntensity": 最高强度,
    "resolutionTone": "结局基调"
  },

  "visualDoctrine": {
    "colorDoctrine": { "primaryPalette": ["#hex"], "accentPalette": ["#hex"], "colorSymbolism": {}, "temperatureBias": "warm|cool|neutral|contrast_driven" },
    "lightingDoctrine": { "baseApproach": "natural|high_key|low_key|noir|chiaroscuro|dramatic|soft_diffused|hard_edged|mixed", "keySceneExceptions": [] },
    "cameraDoctrine": { "defaultLensBias": "50mm", "preferredMotions": ["轨道推进"], "motionIntensityRange": [1, 5] },
    "compositionDoctrine": { "defaultComposition": "rule_of_thirds", "depthBias": "shallow|medium|deep|mixed", "compositionDiscipline": "strict|moderate|loose" }
  },

  "pacingDoctrine": {
    "structureType": "three_act|five_act|episodic|non_linear|circular|kyo_genshi",
    "hookDensity": "sparse|moderate|dense|intense",
    "beatMap": [{ "beatNumber": 1, "name": "节拍名", "phase": "setup|tension|escalation|climax|release", "intensity": 1-10, "duration": 秒数, "allowsHooks": true }],
    "climaxPlacement": 0.0-1.0,
    "pacingCurve": "crescendo|wave|staccato|sustained|erratic|roller_coaster"
  },

  "cinematicIdentity": {
    "primaryInfluences": ["风格影响"],
    "signatureElements": [{ "name": "签名元素", "description": "描述", "mandatory": true }],
    "eraTags": ["年代标签"],
    "visualConsistencyLevel": "standard|strict|creative"
  },

  "characterLaws": [{
    "characterId": "char_001", "name": "角色名", "role": "protagonist|antagonist|supporting|minor|extra",
    "visualLock": { "faceFeatures": "", "bodyType": "", "height": "", "hairStyle": "", "hairColor": "", "eyeFeatures": "", "skinTone": "", "distinguishingFeatures": [], "visualSignature": "", "consistentKeywords": [] },
    "bodyLanguageProfile": "",
    "voiceProfile": { "style": "", "pitch": "low|medium|high", "speed": "slow|normal|fast" },
    "emotionToVisual": [{ "emotion": "情绪", "expressionDescription": "描述", "bodyLanguage": "描述", "intensity": 1-10 }],
    "forbiddenDescriptors": []
  }],

  "worldPhysics": {
    "environmentType": "realistic|fantasy|sci_fi|post_apocalyptic|historical|surreal|abstract",
    "timePeriod": "",
    "physicsAnomalies": [{ "name": "异常名", "description": "描述", "visualImpact": "影响", "triggerScenes": [] }],
    "scale": "intimate|human|epic|cosmic"
  },

  "toneBoundaries": [{ "dimension": "humor", "min": 0, "max": 5 }, { "dimension": "violence", "min": 0, "max": 10 }, { "dimension": "romance", "min": 0, "max": 10 }, { "dimension": "horror", "min": 0, "max": 10 }],
  "forbiddenStyles": [],
  "source": { "type": "user_input", "originalLength": 0, "language": "zh-CN" },
  "confidence": 0.95,
  "degraded": false
}`

// ============================================================
// Constitution Compiler (Dual-Lane)
// ============================================================

export class ConstitutionCompiler {
  async compile(params: {
    script: string
    projectId: string
    userId?: string
    traceId?: string
  }): Promise<ConstitutionCompileResult> {
    const t0 = Date.now()
    const traceId = params.traceId || `constitution-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const fallbacks: FallbackRecord[] = []

    // ===== Step 0: Check Cache =====
    const cached = constitutionCache.get(params.projectId)
    if (cached && cached.confidence >= 0.85) {
      // 缓存命中：完整 constitution 可立即返回
      const cacheLatency = Date.now() - t0
      return {
        constitution: cached.constitution,
        normalization: {
          constitution: cached.constitution,
          validation: { valid: true, data: cached.constitution as unknown as StoryConstitutionFields, errors: [], warnings: [], fixesApplied: 0 },
          fixes: [],
          fullyFromLLM: cached.fullyFromLLM,
          confidence: cached.confidence,
        },
        repair: { constitution: cached.constitution, actions: [] },
        fallbacks: [],
        totalLatencyMs: cacheLatency,
        success: true,
        compileMode: 'cache_hit',
        enrichLatencyMs: 0,
      }
    }

    // ===== Step 1: Skeleton Phase (Fast) =====
    console.log(`[constitution-compiler] Starting skeleton compile for project ${params.projectId}...`)
    const skeletonResult = await skeletonCompiler.compile({
      script: params.script,
      projectId: params.projectId,
    })
    console.log(`[constitution-compiler] Skeleton result: success=${skeletonResult.success}, latency=${skeletonResult.latencyMs}ms, hasCoreTheme=${Object.keys(skeletonResult.skeleton).includes('coreTheme')}`)

    const skeletonLatency = skeletonResult.latencyMs

    if (!skeletonResult.success) {
      // Skeleton 失败 → fallback 到缓存（即使低置信度）或默认
      fallbacks.push({
        level: 'major',
        stage: 'skeleton',
        field: 'constitution',
        reason: `Skeleton 编译失败: ${skeletonResult.error || 'unknown'}`,
        recovered: false,
      })

      // 尝试任何缓存
      if (cached) {
        return {
          constitution: cached.constitution,
          normalization: {
            constitution: cached.constitution,
            validation: { valid: true, data: cached.constitution as unknown as StoryConstitutionFields, errors: [], warnings: [], fixesApplied: 0 },
            fixes: [],
            fullyFromLLM: cached.fullyFromLLM,
            confidence: cached.confidence,
          },
          repair: { constitution: cached.constitution, actions: [] },
          fallbacks,
          totalLatencyMs: Date.now() - t0,
          success: true,
          compileMode: 'cache_hit',
          skeletonLatencyMs: skeletonLatency,
          enrichLatencyMs: 0,
        }
      }

      // 无缓存 → degraded default
      const defaultConstitution = defaultFallbackPolicy.createFallbackConstitution(
        params.projectId, traceId, fallbacks, skeletonResult.skeleton as Partial<StoryConstitution>,
      )
      const repairResult = semanticRepairEngine.repair(defaultConstitution.constitution)
      return {
        constitution: repairResult.constitution,
        normalization: {
          constitution: defaultConstitution.constitution,
          validation: { valid: false, data: defaultConstitution.constitution as unknown as StoryConstitutionFields, errors: [], warnings: [], fixesApplied: 0 },
          fixes: [],
          fullyFromLLM: false,
          confidence: 0,
        },
        repair: repairResult,
        fallbacks: defaultConstitution.records,
        totalLatencyMs: Date.now() - t0,
        success: true,
        compileMode: 'degraded_default',
        skeletonLatencyMs: skeletonLatency,
        enrichLatencyMs: 0,
      }
    }

    // ===== Step 2: Enrichment Phase (DeepSeek) — 超时容错 =====
    const enrichT0 = Date.now()
    let enrichConstitution: StoryConstitution | null = null
    let enrichLatency = 0
    let enrichRaw = ''
    let enrichDegraded = false

    try {
      const skeletonJson = JSON.stringify(skeletonResult.skeleton, null, 2)

      // 将骨架作为 enrichment 的上下文
      const enrichUserMessage = `【剧本】
${params.script.slice(0, 8000)}

【已有结构骨架】
${skeletonJson}

【项目ID】
${params.projectId}

请基于骨架和剧本，生成完整的导演宪法 JSON。`

      const gatewayRequest: GatewayRequest = {
        systemPrompt: ENRICH_SYSTEM_PROMPT,
        userMessage: enrichUserMessage,
        userId: params.userId || 'constitution-compiler',
        projectId: params.projectId,
        timeoutTier: 'batch',
        temperature: 0.1,
      }

      // 用 Promise.race 实现 enrichment timeout（>45s → 放弃）
      const enrichPromise = narrativeGateway.execute(gatewayRequest)
      const timeoutMs = 45000
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Enrichment timeout (>${timeoutMs}ms)`)), timeoutMs),
      )

      const gatewayResponse = await Promise.race([enrichPromise, timeoutPromise])
      enrichRaw = (gatewayResponse as { content: string }).content
      enrichLatency = Date.now() - enrichT0

      if ((gatewayResponse as { degraded?: boolean }).degraded) {
        enrichDegraded = true
        fallbacks.push({
          level: 'minor',
          stage: 'enrichment',
          field: 'constitution',
          reason: 'Enrichment 降级为异步',
          recovered: false,
        })
      }

      // ===== Step 3: Normalize =====
      const normalization = llmNormalizer.normalize(enrichRaw, params.projectId, traceId)

      if (!normalization.fullyFromLLM) {
        fallbacks.push({
          level: 'minor',
          stage: 'normalization',
          field: 'constitution',
          reason: `归一化层进行了 ${normalization.fixes.length} 次修复`,
          recovered: true,
        })
      }

      // ===== Step 4: Semantic Repair =====
      const repair = semanticRepairEngine.repair(normalization.constitution)
      if (repair.actions.length > 0) {
        fallbacks.push({
          level: 'minor',
          stage: 'semantic_repair',
          field: 'constitution',
          reason: `语义修复层执行了 ${repair.actions.length} 次修复`,
          recovered: true,
        })
      }

      enrichConstitution = repair.constitution

      // ===== Step 5: Merge Arbitration =====
      // skeleton = source of truth (structure), enrichment = augmentation
      const mergeResult = constitutionMergeEngine.merge(skeletonResult.skeleton, enrichConstitution)
      const merged = mergeResult.constitution

      // ===== Step 6: Drift Scoring =====
      const drift = driftScorer.score(skeletonResult.skeleton, merged)

      if (drift.verdict !== 'STABLE') {
        fallbacks.push({
          level: drift.verdict === 'UNSTABLE' ? 'major' : 'minor',
          stage: 'drift_detector',
          field: 'constitution',
          reason: `语义漂移 ${drift.overall.toFixed(2)}: ${drift.dimensions.map(d => `${d.name}=${d.score}`).join(', ')}`,
          recovered: drift.verdict === 'MODERATE',
        })
      }

      // ===== Step 7: Cache with Governance =====
      constitutionCache.set(params.projectId, merged, {
        confidence: normalization.confidence,
        fullyFromLLM: normalization.fullyFromLLM,
        enrichLatencyMs: enrichLatency,
      })
      cacheGovernor.resetFallbackCounter(params.projectId)

      const totalLatency = Date.now() - t0
      return {
        constitution: merged,
        normalization,
        repair,
        fallbacks,
        totalLatencyMs: totalLatency,
        success: true,
        compileMode: 'full_enrichment',
        skeletonLatencyMs: skeletonLatency,
        enrichLatencyMs: enrichLatency,
        rawLLMOutput: enrichRaw,
      }
    } catch (err) {
      // Enrichment 失败/超时：fallback to skeleton + cache
      enrichLatency = Date.now() - enrichT0
      cacheGovernor.recordFallback(params.projectId)
      fallbacks.push({
        level: 'major',
        stage: 'enrichment',
        field: 'constitution',
        reason: `Enrichment 失败: ${(err as Error).message}`,
        recovered: false,
      })

      // 如果有缓存，用 governor 检查有效性
      if (cached && cacheGovernor.assess(cached).valid) {
        return {
          constitution: cached.constitution,
          normalization: {
            constitution: cached.constitution,
            validation: { valid: true, data: cached.constitution as unknown as StoryConstitutionFields, errors: [], warnings: [], fixesApplied: 0 },
            fixes: [],
            fullyFromLLM: cached.fullyFromLLM,
            confidence: cached.confidence,
          },
          repair: { constitution: cached.constitution, actions: [] },
          fallbacks,
          totalLatencyMs: Date.now() - t0,
          success: true,
          compileMode: 'cache_hit',
          skeletonLatencyMs: skeletonLatency,
          enrichLatencyMs: enrichLatency,
        }
      }

      // 无缓存 → 用 skeleton 结果 + 合并默认值
      const partialConstitution = mergeSkeletonIntoDefault(
        skeletonResult.skeleton,
        params.projectId,
        traceId,
      )
      const repairResult = semanticRepairEngine.repair(partialConstitution)
      constitutionCache.set(params.projectId, repairResult.constitution, {
        confidence: 0.4,
        fullyFromLLM: false,
        enrichLatencyMs: enrichLatency,
      })

      return {
        constitution: repairResult.constitution,
        normalization: {
          constitution: partialConstitution,
          validation: { valid: true, data: partialConstitution as unknown as StoryConstitutionFields, errors: [], warnings: [], fixesApplied: 0 },
          fixes: [],
          fullyFromLLM: false,
          confidence: 0.4,
        },
        repair: repairResult,
        fallbacks,
        totalLatencyMs: Date.now() - t0,
        success: true,
        compileMode: 'skeleton_only',
        skeletonLatencyMs: skeletonLatency,
        enrichLatencyMs: enrichLatency,
      }
    }
  }
}

// ============================================================
// Helpers
// ============================================================

/**
 * 将 Skeleton 提取的字段合并到默认 Constitution 中
 */
function mergeSkeletonIntoDefault(
  skeleton: Record<string, unknown>,
  projectId: string,
  traceId: string,
): StoryConstitution {
  const base = createDefaultConstitution(projectId, traceId, {
    reason: 'Enrichment failed; merged from skeleton',
  })

  const merged = { ...base } as Record<string, unknown>

  // 合并骨架字段
  const skeletonKeys = [
    'coreTheme', 'emotionalTrajectory', 'cinematicIdentity',
    'characterLaws', 'worldPhysics', 'toneBoundaries',
  ]

  for (const key of skeletonKeys) {
    if (skeleton[key] !== undefined && skeleton[key] !== null) {
      merged[key] = skeleton[key]
    }
  }

  merged.confidence = 0.4
  merged.degraded = true

  return merged as unknown as StoryConstitution
}

/** 全局单例 */
export const constitutionCompiler = new ConstitutionCompiler()

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "director-api",
  "mode": "OBSERVE"
};

