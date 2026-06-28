/**
 * skeleton-compiler.ts — Fast Skeleton Constitution 编译器
 *
 * Dual-Lane Runtime 的"快车道"。
 * 用最小化的 prompt + 任何可用模型快速提取 Constitution 骨架。
 * SLA: 1-5s
 *
 * 产出：
 *   - coreTheme
 *   - emotionalTrajectory (骨架)
 *   - cinematicIdentity (骨架)
 *   - characterLaws (角色列表)
 *   - worldPhysics
 *   - toneBoundaries
 *   - source
 *
 * 不产出（留给 enrichment 做）：
 *   - 详细的 beatMap
 *   - visualDoctrine 细节
 *   - emotionToVisual
 *   - 角色 visualLock 细节
 */

import { defaultFallbackPolicy, type FallbackRecord } from '../norm/fallback-policy.js'
import { semanticRepairEngine } from '../norm/semantic-repair.js'

// ============================================================
// Types
// ============================================================

export interface SkeletonCompileResult {
  /** Skeleton constitution */
  skeleton: Record<string, unknown>

  /** Latency */
  latencyMs: number

  /** LLM raw output (用于 enrichment 阶段上下文) */
  rawLLMOutput: string

  /** 是否成功 */
  success: boolean

  /** 失败原因 */
  error?: string
}

// ============================================================
// Skeleton System Prompt (最小化版本)
// ============================================================

const SKELETON_SYSTEM_PROMPT = `提取剧本的故事结构骨架，仅输出 JSON。

输出 schema:
{
  "coreTheme": "一句话核心主题",
  "emotionalTrajectory": {
    "dominantEmotion": "主导情绪",
    "arcType": "linear|wave|complex",
    "peakIntensity": 1-10,
    "resolutionTone": "结局基调"
  },
  "cinematicIdentity": {
    "primaryInfluences": ["风格影响"],
    "visualConsistencyLevel": "standard|strict|creative"
  },
  "characterLaws": [
    {"characterId":"char_001","name":"","role":"protagonist|antagonist|supporting|minor"}
  ],
  "worldPhysics": {
    "environmentType": "realistic|fantasy|sci_fi|historical|surreal",
    "timePeriod": "",
    "scale": "intimate|human|epic|cosmic"
  },
  "toneBoundaries": [
    {"dimension":"humor","min":0,"max":5},
    {"dimension":"violence","min":0,"max":10},
    {"dimension":"romance","min":0,"max":10},
    {"dimension":"horror","min":0,"max":10}
  ]
}

约束：
- 内容不足时使用合理默认值
- 不允许 null
- 只输出 JSON，不做解释`

// ============================================================
// Skeleton Compiler
// ============================================================

export class SkeletonCompiler {
  private provider: (prompt: string, userMsg: string) => Promise<string>

  constructor(options?: {
    provider?: (prompt: string, userMsg: string) => Promise<string>
  }) {
    this.provider = options?.provider ?? this.defaultProvider
  }

  async compile(params: {
    script: string
    projectId: string
  }): Promise<SkeletonCompileResult> {
    const t0 = Date.now()

    try {
      const userMessage = `【剧本】\n${params.script.slice(0, 6000)}\n\n生成结构骨架 JSON。`
      const rawOutput = await this.provider(SKELETON_SYSTEM_PROMPT, userMessage)
      console.log(`[skeleton-compiler] LLM response (${rawOutput.length} chars): ${rawOutput.slice(0, 100)}`)

      const latency = Date.now() - t0
      const skeleton = extractSkeleton(rawOutput)

      return {
        skeleton,
        latencyMs: latency,
        rawLLMOutput: rawOutput,
        success: skeleton && Object.keys(skeleton).includes('coreTheme'),
      }
    } catch (err) {
      return {
        skeleton: {},
        latencyMs: Date.now() - t0,
        rawLLMOutput: '',
        success: false,
        error: (err as Error).message,
      }
    }
  }

  /**
   * 默认 provider：直接调 DeepSeek（简化版，不在 gateway 中注册）
   */
  private async defaultProvider(systemPrompt: string, userMsg: string): Promise<string> {
    // ⚠️ 已废弃——skeleton-compiler 应从 narrativeGateway 而不是直接读 process.env
    throw new Error('[RuntimeConstitution] skeleton-compiler 禁止直接读 process.env.DEEPSEEK_API_KEY')

    const https = await import('https')
    const apiKey = process.env.DEEPSEEK_API_KEY

    return new Promise((resolve, reject) => {
      const data = JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMsg },
        ],
        max_tokens: 1500,
        temperature: 0.0,
      })

      const req = https.request({
        hostname: 'api.deepseek.com',
        path: '/chat/completions',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        timeout: 15000,
      }, (res) => {
        let body = ''
        res.on('data', c => (body += c))
        res.on('end', () => {
          try {
            const parsed = JSON.parse(body)
            const content = parsed.choices?.[0]?.message?.content || ''
            resolve(content)
          } catch (e) {
            reject(new Error(`Skeleton parse fail: ${(e as Error).message}`))
          }
        })
      })

      req.on('timeout', () => {
        req.destroy()
        reject(new Error('Skeleton timeout (>15s)'))
      })
      req.on('error', reject)
      req.write(data)
      req.end()
    })
  }
}

/** 简单骨架归一化（只提取 JSON + 部分检查） */
export function extractSkeleton(raw: string): Record<string, unknown> {
  try {
    const jsonStr = raw.replace(/^```json?\n?/, '').replace(/\n?```$/, '').trim()
    const parsed = JSON.parse(jsonStr)

    // 只保留骨架需要的字段
    const skeleton: Record<string, unknown> = {}
    const keepFields = [
      'coreTheme', 'emotionalTrajectory', 'cinematicIdentity',
      'characterLaws', 'worldPhysics', 'toneBoundaries',
    ]

    for (const key of keepFields) {
      if (parsed[key] !== undefined && parsed[key] !== null) {
        skeleton[key] = parsed[key]
      }
    }

    return skeleton
  } catch {
    return {}
  }
}

/** 全局单例 */
export const skeletonCompiler = new SkeletonCompiler()
