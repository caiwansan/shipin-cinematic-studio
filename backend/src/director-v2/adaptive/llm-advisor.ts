/**
 * adaptive/llm-advisor.ts — Phase 6 LLM 建议层（受限）
 *
 * 职责：当确定性规则引擎检测到异常但无法确定最佳修复时，
 *   向 LLM 请求"建议"。LLM 只能输出 suggestion 对象。
 *
 * 宪法：
 *   1. LLM 输出必须是建议格式，不能直接输出 IR mutation
 *   2. LLM 无法直接修改系统状态
 *   3. 建议由 Policy Engine 决定是否采用
 *   4. LLM 调用是可选的（当规则引擎置信度不足时触发）
 *
 * 输入限制：
 *   - 只接收 metrics summary（数字 + 状态标签）
 *   - 不接收完整 IR/Timeline/StoryGraph
 *
 * 输出限制：
 *   - 只能是 { suggestion, target, confidence, reason }
 *   - target 仅限于 'scene' | 'timeline' | 'pacing'
 */

// ─── 类型 ─────────────────────────────────────────────────

export interface SuggestionInput {
  ruleTriggers: string[]
  maxSeverity: number
  currentSceneId: string | null
  currentIntensity: number
  completedScenes: number
  totalScenes: number
  speedFactorAverages: number[]
}

export interface AdvisorSuggestion {
  suggestion: string
  target: 'scene' | 'timeline' | 'pacing'
  confidence: number   // 0-1
  reason: string
}

// ─── 默认 LLM advisor prompt ─────────────────────────────

const ADVISOR_SYSTEM_PROMPT = `You are a narrative advisor for a cinematic runtime system.
Your role is to suggest narrative adjustments when the system detects issues.

RULES:
1. You may ONLY output a JSON object with fields: suggestion, target (scene|timeline|pacing), confidence (0-1), reason
2. Your suggestion must be high-level and descriptive, not structural
3. You MUST NOT suggest modifying IR schema, story structure, or character definitions
4. You MUST NOT suggest using LLM to rewrite scenes
5. If confidence < 0.5, do not make a suggestion

EXAMPLE:
Input: pacing too fast, intensity 0.92
Output: {"suggestion": "insert a slow rest scene to reset tension", "target": "pacing", "confidence": 0.8, "reason": "intensity near peak without relief"}
`

/** 构造 LLM 请求 */
export function buildAdvisorMessage(input: SuggestionInput): { system: string; user: string } {
  const user = `Current runtime state:
- triggers: ${input.ruleTriggers.join(', ')}
- max severity: ${input.maxSeverity.toFixed(2)}
- current scene: ${input.currentSceneId ?? 'none'}
- intensity: ${input.currentIntensity.toFixed(2)}
- progress: ${input.completedScenes}/${input.totalScenes} scenes
- speed factors: [${input.speedFactorAverages.map(v => v.toFixed(2)).join(', ')}]

Suggest a narrative adjustment.`

  return { system: ADVISOR_SYSTEM_PROMPT, user }
}

/**
 * 解析 LLM 回复为结构化建议
 * 若解析失败或格式不符，返回 null（由 Policy Engine 走纯规则路径）
 */
export function parseAdvisorResponse(raw: string): AdvisorSuggestion | null {
  try {
    const parsed = JSON.parse(raw)

    // 验证必填字段
    if (!parsed.suggestion || !parsed.target || parsed.confidence === undefined) {
      return null
    }

    // 验证 target 取值
    if (!['scene', 'timeline', 'pacing'].includes(parsed.target)) {
      return null
    }

    return {
      suggestion: String(parsed.suggestion),
      target: parsed.target as 'scene' | 'timeline' | 'pacing',
      confidence: Math.min(1, Math.max(0, Number(parsed.confidence))),
      reason: String(parsed.reason ?? ''),
    }
  } catch {
    return null
  }
}

export default { buildAdvisorMessage, parseAdvisorResponse }
