/**
 * Visual Constraint Loop — Phase 2 + P5.1: Vision Validator (Hardened)
 *
 * Caption + Rule Parser 双阶段校验
 * - Step 1: 调用户 Vision Model 获取图片描述
 * - Step 2: 确定性 Rule Parser 解析结构化约束
 * - Fallback: Rule Parser 不确定时 → Vision Model JSON 模式
 *
 * P5.1 Hardening:
 *   - 所有异常（timeout / fetch error / provider error / json parse error）
 *     统一返回 degraded 信号，绝不 throw 到主链路
 *   - 新增 ValidationResult 接口作为异常信号
 *   - 原有 validateImageStructure 接口兼容，但选优层注入了 degraded 判断
 *
 * 设计原则：不做语义理解型判断，只做结构化判定。
 * 确定性路径优先，LLM 路径兜底。
 */

import type { ViewValidationResult, ValidationResult } from './types.js'
import { DEGRADED_RESULT } from './types.js'

// ─── Validator 超时（P5.1） ───
const VALIDATOR_TIMEOUT_MS = 15000

// ─── Caption Prompt（最少 token，最快响应） ───
const CAPTION_PROMPT = `Describe this image briefly in 1-2 sentences, answering:
- How many people?
- What body parts visible (head only / head to toe / partial)?
- Is the face visible?
- Is the person facing camera, turned sideways, or shown from behind?
- What is the person wearing?`

// ─── Regex 模式集（确定性解析） ───
const PERSON_COUNT_RE = /(\d+)\s*(person|people|woman|man|figure|character)/i
const BODY_FULL_RE = /(full\s*body|head\s*to\s*toe|entire\s*body|whole\s*body|全身|从头到脚|完整身体)/i
const BODY_HEAD_RE = /(head\s*(and|&)\s*shoulders|headshot|portrait|bust|大头|特写|证件照|只有头部|仅头部)/i
const BODY_PARTIAL_RE = /(half\s*body|partial|torso|upper\s*body|半身|上半身)/i
const FACE_VISIBLE_RE = /(face\s*(is|visible|shown|seen|clearly)|facial\s*features|looking\s*at\s*(viewer|camera)|面向镜头|正脸|面部清晰)/i
const FACE_HIDDEN_RE = /(no\s*face|face\s*(not|hidden|obscured)|back\s*of\s*(head|person)|背影|背面|看不见脸|无面部|后脑勺)/i
const CAMERA_FRONT_RE = /(facing\s*(camera|viewer|forward)|front\s*view|正面|面对镜头|正视)/i
const CAMERA_PROFILE_RE = /(profile|side\s*view|侧面|侧身|90\s*degree|从侧面)/i
const CAMERA_BACK_RE = /(from\s*behind|back\s*view|背面|背影|从背后|后视图)/i
const CAMERA_CLOSEUP_RE = /(close[- ]*up|closeup|extreme\s*close|大头|特写|证件照)/i
const MULTI_PERSON_RE = /(\d+\s*(people|persons|men|women|figures))|(two\s*(person|people|men|women|figures))|(多人|双人|两人|一群人)/i

/**
 * P5.3: 通过 Provider Middleware 执行 vision call
 * 复用已有 Provider Registry + Runtime 链路，不自己 fetch
 * P5.1: 所有异常在本层吸收
 */
async function captionImageSafe(
  imageUrl: string,
  userId: string,
): Promise<{ caption: string; status: ValidationResult }> {
  try {
    // Step 1: 用 Provider Middleware 统一入口执行 vision call
    const { default: providerMiddleware } = await import('../../runtime/provider-middleware.js')

    const result = await withTimeout(
      providerMiddleware.execute({
        // 不传 model 让 middleware 自动从用户配置解析
        // 传 taskType llm（vision 是 llm 的子能力）
        taskType: 'llm',
        userId,
        text: CAPTION_PROMPT,
        imageUrl,
        temperature: 0.1,
        maxTokens: 200,
        mode: 'caption',
        // 从用户配置取 model（不传则 middleware 自动识别）
      }),
      VALIDATOR_TIMEOUT_MS,
      'vision_caption',
    )

    const caption = result?.content || ''
    if (caption) {
      console.log(`[VisionValidator] caption: ${caption.substring(0, 120)}`)
    }
    return { caption, status: { success: true, degraded: false, timeout: false } }
  } catch (err: any) {
    const isTimeout = err?.name === 'AbortError' || err?.message?.includes('abort') || err?.message?.includes('timeout')
    console.warn(`[VisionValidator] caption 异常 (${isTimeout ? 'timeout' : 'error'}): ${err.message}`)
    return {
      caption: '',
      status: {
        success: false,
        degraded: true,
        timeout: isTimeout,
        reason: isTimeout ? 'timeout' : 'provider_error',
      },
    }
  }
}

/**
 * P5.3: 超时包装 — 确保 vision call 不会无限等待
 */
async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`[VisionValidator] ${label} 超时 (${ms}ms)`))
    }, ms)
  })
  try {
    const result = await Promise.race([promise, timeout])
    return result
  } finally {
    if (timer) clearTimeout(timer)
  }
}

/**
 * Step 2: 确定性 Rule Parser
 * 从 caption 文本解析结构化约束值
 * 不调 LLM，纯正则 + 规则匹配
 */
function parseViewFromCaption(caption: string): Partial<ViewValidationResult> {
  const lower = caption.toLowerCase().trim()
  if (!lower) return {}

  // ── 人数检测 ──
  let personCount = 1
  const personMatch = lower.match(PERSON_COUNT_RE)
  if (personMatch) {
    personCount = parseInt(personMatch[1], 10) || 1
  }
  if (/two|双人|两人|一对|2\s*(person|people)/i.test(lower)) {
    personCount = Math.max(personCount, 2)
  }
  const hasExtraPerson = personCount > 1 || MULTI_PERSON_RE.test(lower)

  // ── 身体可见度 ──
  let bodyVisibility: ViewValidationResult['bodyVisibility'] = 'unknown'
  if (BODY_FULL_RE.test(lower)) bodyVisibility = 'full_body'
  else if (BODY_HEAD_RE.test(lower)) bodyVisibility = 'head_shoulders'
  else if (BODY_PARTIAL_RE.test(lower)) bodyVisibility = 'partial'

  // ── 面部可见度 ──
  let faceVisibility: ViewValidationResult['faceVisibility'] = 'unknown'
  if (FACE_VISIBLE_RE.test(lower) && !FACE_HIDDEN_RE.test(lower)) {
    faceVisibility = 'visible'
  } else if (FACE_HIDDEN_RE.test(lower)) {
    faceVisibility = 'hidden'
  } else {
    // 启发式：有 face 关键词但被否定
    if (/face/i.test(lower) && /(no|without|not\s*visible|hidden|obscured)/i.test(lower)) {
      faceVisibility = 'hidden'
    }
  }

  // ── 相机角度 ──
  let cameraAngle: ViewValidationResult['cameraAngle'] = 'unknown'
  if (CAMERA_CLOSEUP_RE.test(lower)) cameraAngle = 'close_up'
  else if (CAMERA_FRONT_RE.test(lower)) cameraAngle = 'front'
  else if (CAMERA_PROFILE_RE.test(lower)) cameraAngle = 'profile'
  else if (CAMERA_BACK_RE.test(lower)) cameraAngle = 'back'
  else if (/three-quarter|3\/4|四分之三|斜侧/i.test(lower)) cameraAngle = 'three_quarter'

  return {
    personCount,
    bodyVisibility,
    faceVisibility,
    cameraAngle,
    hasExtraPerson,
    rawCaption: caption.substring(0, 500),
  }
}

/**
 * P5.1: Safe LLM JSON fallback — 所有异常吸收
 */
async function llmJsonFallbackSafe(
  imageUrl: string,
  userId: string,
  existingCaption: string,
): Promise<Partial<ViewValidationResult> | null> {
  const jsonPrompt = `Based on this caption: "${existingCaption.substring(0, 200)}"

Output ONLY valid JSON (no other text):
{
  "personCount": <number>,
  "bodyVisibility": "full_body" | "head_shoulders" | "partial" | "unknown",
  "faceVisibility": "visible" | "hidden" | "unknown",
  "cameraAngle": "front" | "profile" | "back" | "close_up" | "unknown",
  "hasExtraPerson": true | false
}

Rules:
- bodyVisibility: full_body=head to toe visible; head_shoulders=head+shoulders only
- faceVisibility: hidden=nofacial features visible (back of head counts as hidden)
- cameraAngle: profile=90 degree side view`

  try {
    const { default: providerMiddleware } = await import('../../runtime/provider-middleware.js')

    const result = await withTimeout(
      providerMiddleware.execute({
        taskType: 'llm',
        userId,
        text: jsonPrompt,
        imageUrl,
        temperature: 0.1,
        maxTokens: 150,
      }),
      10000,
      'vision_json_fallback',
    )

    const text = result?.content || ''
    if (!text) return null

    // 提取 JSON（处理 markdown 包裹）
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null

    return JSON.parse(jsonMatch[0]) as Partial<ViewValidationResult>
  } catch {
    return null
  }
}

/**
 * 主入口：validateImageStructure（Phase 2 接口兼容）
 * 返回 view validation 结果，异常时返回缺省值
 * P5.1: 绝不 throw，异常信号通过 ValidationResult 传递
 */
export async function validateImageStructure(
  imageUrl: string,
  userId: string,
): Promise<{ result: ViewValidationResult; validationStatus: ValidationResult }> {
  // Step 1: Safe Caption
  const { caption, status } = await captionImageSafe(imageUrl, userId)

  // 如果 caption 已 degraded，返回缺省 result + degraded 信号
  if (status.degraded) {
    return {
      result: {
        personCount: 1,
        bodyVisibility: 'unknown',
        faceVisibility: 'unknown',
        cameraAngle: 'unknown',
        hasExtraPerson: false,
        rawCaption: '',
      },
      validationStatus: status,
    }
  }

  // Step 2: Rule Parser
  const parsed = parseViewFromCaption(caption)

  const result: ViewValidationResult = {
    personCount: parsed.personCount ?? 1,
    bodyVisibility: parsed.bodyVisibility ?? 'unknown',
    faceVisibility: parsed.faceVisibility ?? 'unknown',
    cameraAngle: parsed.cameraAngle ?? 'unknown',
    hasExtraPerson: parsed.hasExtraPerson ?? false,
    rawCaption: parsed.rawCaption ?? caption.substring(0, 500),
  }

  // 如果关键字段还是 unknown 且有 caption，尝试 LLM JSON fallback（P5.1: safe 版本）
  if (
    caption &&
    (result.bodyVisibility === 'unknown' || result.cameraAngle === 'unknown')
  ) {
    const fallback = await llmJsonFallbackSafe(imageUrl, userId, caption)
    if (fallback) {
      return {
        result: {
          ...result,
          bodyVisibility: fallback.bodyVisibility ?? result.bodyVisibility,
          faceVisibility: fallback.faceVisibility ?? result.faceVisibility,
          cameraAngle: fallback.cameraAngle ?? result.cameraAngle,
          hasExtraPerson: fallback.hasExtraPerson ?? result.hasExtraPerson,
          personCount: fallback.personCount ?? result.personCount,
        },
        validationStatus: { success: true, degraded: false, timeout: false },
      }
    }
  }

  return { result, validationStatus: { success: true, degraded: false, timeout: false } }
}

/**
 * P5.1: 兼容旧接口的包装函数（不破坏已有调用者）
 * 返回只包含 ViewValidationResult，异常信息通过 console.warn 输出
 */
export async function validateImageStructureLegacy(
  imageUrl: string,
  userId: string,
): Promise<ViewValidationResult> {
  const { result } = await validateImageStructure(imageUrl, userId)
  return result
}

/**
 * P5.1: 快速检查 validator 是否可用
 * 主链路在 shadow mode 中调用此函数决定是否跳过
 */
export function isValidationDegraded(status: ValidationResult): boolean {
  return status.degraded
}
