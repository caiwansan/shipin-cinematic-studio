/**
 * runtime/feedback-loop/video-critic.ts
 *
 * 视频评审器 — Video Critic Engine
 *
 * 职责：
 *   对生成视频进行结构化评分。
 *   通过 LLM 以评审员身份分析视频帧 + prompt 对比，
 *   输出 5 维度分数 + 失败原因。
 *
 * 评分维度（固定，不可更改）：
 *   - Camera coherence: 镜头是否稳定合理
 *   - Action continuity: 动作是否连贯
 *   - VFX physicality: 特效是否"物理可信"
 *   - Scene composition: 空间结构是否合理
 *   - Cinematic quality: 是否电影感
 *
 * @runtime feedback-loop
 */

import { narrativeGateway } from '../narrative-gateway.js'

// ============================================================
// Types
// ============================================================

export interface VideoCritique {
  cameraScore: number       // Camera coherence 0-1
  motionScore: number       // Action continuity 0-1
  vfxScore: number          // VFX physicality 0-1
  compositionScore: number  // Scene composition 0-1
  cinematicScore: number    // Cinematic quality 0-1
  overallScore: number      // Weighted average
  failureReasons: string[]  // 扣分原因
}

export interface CriticInput {
  /** 原始的编译后 prompt */
  prompt: string
  /** 视频 URL（用来做视觉分析） */
  videoUrl?: string
  /** 帧序列截图 URL 列表（如果有多帧分析） */
  frameUrls?: string[]
  /** 生成时使用的 VideoPromptSpec（可选，用于深层对比） */
  specJson?: string
  /** 预期的 camera 类型 */
  expectedCamera?: string
  /** 预期的 movement 类型 */
  expectedMovement?: string
}

// ============================================================
// Critic System Prompt
// ============================================================

const CRITIC_SYSTEM_PROMPT = `You are a professional video critic for a cinematic AI system. Your job is to evaluate generated video against the original prompt intent.

## Scoring Dimensions (each 0.0-1.0)

1. **Camera coherence** — Does the camera movement and shot type match the prompt? Is it stable and intentional?
   - 0.0 = completely wrong camera (prompt said "slow push-in" but video is static wide)
   - 0.5 = partially matches (some camera intent visible but not precise)
   - 1.0 = exact match with smooth execution

2. **Action continuity** — Is the action fluid and continuous? Single continuous motion?
   - 0.0 = static/jumpy, no recognizable action
   - 0.5 = some motion visible but not continuous or not matching description
   - 1.0 = fluid continuous action matching the prompt exactly

3. **VFX physicality** — Do visual effects feel physically grounded? Realistic energy, particles, physics?
   - 0.0 = no visible VFX or completely fake/glitchy
   - 0.5 = VFX present but lack physical plausibility
   - 1.0 = physically coherent VFX with weight, momentum, and energy

4. **Scene composition** — Is the spatial structure clear and correct? Proper framing, depth, object placement?
   - 0.0 = chaotic composition, objects misplaced, no spatial logic
   - 0.5 = reasonable structure but some spatial inconsistencies
   - 1.0 = excellent composition with clear depth and spatial relationships

5. **Cinematic quality** — Does it feel like a real film shot? Lighting, color grading, depth of field?
   - 0.0 = flat, game-like, or amateur quality
   - 0.5 = some cinematic qualities present
   - 1.0 = genuinely cinematic with professional lighting and atmosphere

## Output Format

Return ONLY valid JSON with no markdown wrapping:

{
  "cameraScore": 0.0-1.0,
  "motionScore": 0.0-1.0,
  "vfxScore": 0.0-1.0,
  "compositionScore": 0.0-1.0,
  "cinematicScore": 0.0-1.0,
  "failureReasons": ["specific reason 1", "specific reason 2"]
}

## Critical Rules
- BE STRICT. A score of 1.0 means perfect execution.
- failureReasons must be specific and actionable (e.g., "camera did not push in, remained static", "energy effect lacks physical weight")
- If you cannot see the video, base your critique on the frame descriptions and prompt analysis
- Never inflate scores. A mediocre result deserves 0.4-0.6`
// ============================================================
// Critic Execution
// ============================================================

/**
 * Run video critique via LLM
 */
export async function evaluateVideo(input: CriticInput): Promise<VideoCritique> {
  const { prompt, videoUrl, frameUrls, expectedCamera, expectedMovement } = input

  // Build user message for the critic LLM
  const userMessage = buildCriticUserMessage(prompt, videoUrl, frameUrls, expectedCamera, expectedMovement)

  try {
    const result = await narrativeGateway.execute({
      systemPrompt: CRITIC_SYSTEM_PROMPT,
      userMessage,
      userId: 'feedback-loop-critic',
      timeoutTier: 'normal',
      maxTokens: 1024,
      temperature: 0.2,
    })

    const parsed = parseCriticResponse(result.content)
    return parsed
  } catch (err: any) {
    console.error('[VideoCritic] ❌ Critic failed:', err.message)
    // Return default low score on failure
    return {
      cameraScore: 0,
      motionScore: 0,
      vfxScore: 0,
      compositionScore: 0,
      cinematicScore: 0,
      overallScore: 0,
      failureReasons: [`Critic error: ${err.message}`],
    }
  }
}

// ============================================================
// Internal
// ============================================================

function buildCriticUserMessage(
  prompt: string,
  videoUrl?: string,
  frameUrls?: string[],
  expectedCamera?: string,
  expectedMovement?: string,
): string {
  const sections: string[] = []

  sections.push('## Original Prompt')
  sections.push(prompt)

  if (expectedCamera) {
    sections.push(`\n## Expected Camera\n${expectedCamera}`)
  }
  if (expectedMovement) {
    sections.push(`\n## Expected Movement\n${expectedMovement}`)
  }

  if (videoUrl) {
    sections.push(`\n## Video URL\n${videoUrl}`)
  }

  if (frameUrls && frameUrls.length > 0) {
    sections.push('\n## Frame Keyframes')
    frameUrls.forEach((url, i) => {
      sections.push(`[Frame ${i}]: ${url}`)
    })
  }

  sections.push(`
## Evaluation Task
Analyze this video generation result against the original prompt intent.

For each of the 5 dimensions, assign a score 0.0-1.0 and list specific failure reasons.

Remember:
- Camera coherence: check if shot type and movement match
- Action continuity: is the motion fluid and continuous?
- VFX physicality: do effects look physically realistic?
- Scene composition: is spatial layout correct?
- Cinematic quality: does it look like a real film?

Be strict. 1.0 means flawless execution.`)

  return sections.join('\n')
}

/**
 * Parse LLM response into VideoCritique
 */
function parseCriticResponse(raw: string): VideoCritique {
  // Strip markdown code blocks
  let json = raw.trim()
  const codeBlockMatch = json.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
  if (codeBlockMatch) {
    json = codeBlockMatch[1].trim()
  }

  try {
    const parsed = JSON.parse(json)
    const scores: VideoCritique = {
      cameraScore: clampScore(parsed.cameraScore),
      motionScore: clampScore(parsed.motionScore),
      vfxScore: clampScore(parsed.vfxScore),
      compositionScore: clampScore(parsed.compositionScore),
      cinematicScore: clampScore(parsed.cinematicScore),
      overallScore: 0,
      failureReasons: Array.isArray(parsed.failureReasons) ? parsed.failureReasons.map(String) : [],
    }
    // Weighted overall: camera 0.25, motion 0.25, vfx 0.15, composition 0.15, cinematic 0.20
    scores.overallScore = parseFloat((
      scores.cameraScore * 0.25 +
      scores.motionScore * 0.25 +
      scores.vfxScore * 0.15 +
      scores.compositionScore * 0.15 +
      scores.cinematicScore * 0.20
    ).toFixed(3))
    return scores
  } catch {
    // Fallback: try regex extraction
    const camera = extractScore(json, 'cameraScore')
    const motion = extractScore(json, 'motionScore')
    const vfx = extractScore(json, 'vfxScore')
    const composition = extractScore(json, 'compositionScore')
    const cinematic = extractScore(json, 'cinematicScore')

    const reasons: string[] = []
    const reasonMatch = json.match(/"failureReasons"\s*:\s*\[([\s\S]*?)\]/)
    if (reasonMatch) {
      const items = reasonMatch[1].match(/"([^"]+)"/g)
      if (items) items.forEach(i => reasons.push(i.replace(/"/g, '')))
    }

    return {
      cameraScore: camera,
      motionScore: motion,
      vfxScore: vfx,
      compositionScore: composition,
      cinematicScore: cinematic,
      overallScore: (camera * 0.25 + motion * 0.25 + vfx * 0.15 + composition * 0.15 + cinematic * 0.20),
      failureReasons: reasons,
    }
  }
}

function clampScore(val: any): number {
  const n = Number(val)
  if (isNaN(n)) return 0
  return Math.max(0, Math.min(1, n))
}

function extractScore(text: string, key: string): number {
  const match = text.match(new RegExp(`"${key}"\\s*:\\s*([0-9.]+)`))
  return match ? clampScore(match[1]) : 0
}
