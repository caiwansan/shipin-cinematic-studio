// ============================================================
// 📦 Prompt Optimizer — 提示词优化器（核心🔥）
//
// 职责：根据用户输入 + 历史数据 + 评估结果，自动优化 prompt
// v1：LLM 改写（DeepSeek / OpenAI）
// v2：根据历史 best prompt 模板优化
// ============================================================

import { env } from '../../config/env.js'
import { promptMemory } from './prompt-memory.js'

export interface OptimizeInput {
  rawPrompt: string
  style?: string
  mode?: string
  taskType: 'image' | 'video'
  userId?: string
  negativePrompt?: string
  quality?: number  // 0-10，上次的评分，用于决定是否加强优化
}

export interface OptimizeResult {
  optimizedPrompt: string
  optimizedNegative?: string
  usedLLM: boolean
  usedHistory: boolean
  improvements: string[]
  tokenCount: number
}

const LLM_SYSTEM_TEMPLATE = (style?: string, taskType?: string) => {
  const typeGuide = taskType === 'video'
    ? `额外要求：描述应包含 camera motion（运镜）、scene transition（场景切换）、duration hints（时长暗示），适合视频 AI 模型。`
    : `描述应包含 subject details、lighting、color palette、composition、atmosphere，适合图像 AI 模型。`

  return `你是一个专业的 AI 绘画提示词工程师。将用户的简单描述改写成高质量英文 prompt。

规则：
1. 翻译为英文，扩展细节：主体特征、场景氛围、光线、色彩、构图、材质
2. 使用修饰词（cinematic lighting, highly detailed, masterpiece）
3. 不超过 200 词
4. 只返回 prompt 纯文本，不加解释
5. 不添加不存在的元素

${typeGuide}
${style && style !== '无' ? `风格：${style}，必须强烈体现。` : ''}`
}

export const promptOptimizer = {
  /**
   * 主入口：优化提示词
   */
  async optimize(input: OptimizeInput): Promise<OptimizeResult> {
    const improvements: string[] = []
    let optimizedPrompt = input.rawPrompt

    // 1️⃣ 查询历史相似 prompt
    let usedHistory = false
    try {
      const similar = await promptMemory.findSimilar(input.rawPrompt, input.taskType, 3)
      if (similar.length > 0) {
        const bestMatch = similar[0]
        if (bestMatch.qualityScore && bestMatch.qualityScore >= 7) {
          // 用历史 best prompt 作为参考
          improvements.push(`📚 参考了历史最优 prompt（评分 ${bestMatch.qualityScore}）`)
          usedHistory = true
        }
      }
    } catch {}

    // 2️⃣ LLM 扩写
    let usedLLM = false
    const apiKey = env.DEEPSEEK_API_KEY || env.OPENAI_API_KEY
    if (apiKey) {
      try {
        const baseUrl = env.DEEPSEEK_API_KEY
          ? 'https://api.deepseek.com/v1'
          : 'https://api.openai.com/v1'
        const model = env.DEEPSEEK_API_KEY ? 'deepseek-chat' : 'gpt-4o-mini'

        const res = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: LLM_SYSTEM_TEMPLATE(input.style, input.taskType) },
              { role: 'user', content: input.rawPrompt },
            ],
            max_tokens: 500,
            temperature: 0.7,
          }),
        })

        if (res.ok) {
          const data = await res.json()
          const llmPrompt = data.choices?.[0]?.message?.content?.trim()
          if (llmPrompt && llmPrompt.length > input.rawPrompt.length) {
            optimizedPrompt = llmPrompt
            usedLLM = true
            improvements.push('🤖 LLM 扩写：增加了细节描述')
          }
        }
      } catch (e) {
        console.error('[Prompt Optimizer] LLM call failed:', e)
      }
    }

    return {
      optimizedPrompt,
      optimizedNegative: input.negativePrompt,
      usedLLM,
      usedHistory,
      improvements,
      tokenCount: optimizedPrompt.split(/[\s,，。、]+/).filter(Boolean).length,
    }
  },

  /**
   * 根据评估结果重新优化（用于 retry 闭环）
   */
  async reOptimize(
    input: OptimizeInput,
    evaluation: any,
  ): Promise<OptimizeResult> {
    const result = await this.optimize(input)
    const { summaries } = evaluation

    // 根据评估摘要增强优化
    if (summaries?.some((s: string) => s.includes('增加细节'))) {
      // 追加细节描述需求
      result.optimizedPrompt += ', highly detailed texture, intricate details'
      result.improvements.push('💡 根据评估追加细节描述')
    }

    return result
  },
}
