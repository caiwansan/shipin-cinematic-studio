/**
 * C2 Optimization Engine — AI 优化编排
 *
 * 流程：
 *   1. 构建 AI Prompt（从 card.prompt 和 rawContent）
 *   2. 调用 UnifiedAIGateway.invokeAI()
 *   3. 解析优化结果
 *   4. 创建新 AssetVersion（带链接）
 *   5. 计算 diff
 *   6. 触发 StateMachine transition (draft → optimized)
 */

import { cardRenderEngine } from './card-render.engine.js'
import { unifiedAIGateway } from './unified-ai-gateway.js'
import { assetVersionService } from './asset-version.service.js'
import { AssetStateMachine } from '../runtime/asset-state-machine.js'
import { diffObjects, summarizeDiff } from './asset-diff-schema.js'

export interface OptimizationResult {
  success: boolean
  newVersion: number
  diffSummary: string
  traceId: string
  originalContent: any
  optimizedContent: any
}

export class OptimizationEngine {
  /**
   * 执行单次优化
   */
  async optimize(params: {
    assetRegistryId: string
    userId: string
    projectId: string
    agentType: 'character_agent' | 'scene_agent' | 'storyboard_agent' | 'optimization_agent'
    optimizationTarget?: string  // 优化方向描述
  }): Promise<OptimizationResult> {
    const { assetRegistryId, userId, projectId, agentType, optimizationTarget } = params

    // 1. 获取当前卡片数据
    const card = await cardRenderEngine.renderCard(assetRegistryId)
    if (!card) {
      throw new Error('资产不存在')
    }

    // 2. 构建 AI Prompt
    const prompt = this.buildPrompt(card.rawContent, optimizationTarget, agentType)

    // 3. 调用 AI Gateway
    const result = await unifiedAIGateway.invokeAI({
      userId,
      projectId,
      agentType,
      capability: 'llm',
      input: { messages: [{ role: 'user', content: prompt }] },
      assetRegistryId,
    })

    if (result.status !== 'success' || !result.output?.content) {
      throw new Error(`AI 优化失败: ${result.error || '无输出'}`)
    }

    // 4. 解析优化结果
    const optimizedContent = this.parseOptimizedContent(result.output.content, card.rawContent)

    // 5. 计算 diff
    const diff = diffObjects(
      card.rawContent,
      optimizedContent,
      card.meta.version,
      card.meta.version + 1,
    )

    // 6. 创建新版本
    const newVersion = await assetVersionService.createVersion({
      assetRegistryId,
      content: optimizedContent,
      prompt: { original: card.prompt, optimizationTarget, aiInput: result.input, aiOutput: result.output },
      optimizationType: agentType,
      agent: `ai:${agentType}`,
      diffSummary: summarizeDiff(diff),
    })

    // 7. 状态流转：draft → optimized（如果当前是 draft）
    try {
      await AssetStateMachine.transition({
        assetId: assetRegistryId,
        targetStatus: 'optimized',
        actor: 'agent',
        reason: `AI ${agentType} 优化`,
      })
    } catch {
      // 可能在 draft → optimized 之外的状态，忽略
    }

    return {
      success: true,
      newVersion: newVersion.version,
      diffSummary: summarizeDiff(diff),
      traceId: result.traceId,
      originalContent: card.rawContent,
      optimizedContent,
    }
  }

  private buildPrompt(
    rawContent: any,
    optimizationTarget?: string,
    agentType?: string,
  ): string {
    const target = optimizationTarget || '优化内容质量'
    const typeHint = agentType ? `（角色: ${agentType}）` : ''

    return `你是一个专业的 AI 内容优化助手${typeHint}。

## 当前内容
${JSON.stringify(rawContent, null, 2)}

## 优化目标
${target}

## 要求
- 分析当前内容中的不足
- 在保持原有结构不变的前提下进行优化
- 只返回优化后的完整内容（JSON 格式）
- 不要包含任何解释或说明文字
- 不要改变字段名和基本结构`
  }

  /**
   * 尝试从 AI 输出中提取 JSON
   */
  private parseOptimizedContent(aiOutput: string, fallback: any): any {
    try {
      // 尝试直接解析
      const trimmed = aiOutput.trim()
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        return JSON.parse(trimmed)
      }
      // 尝试提取 ```json 块
      const jsonMatch = trimmed.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/)
      if (jsonMatch) {
        return JSON.parse(jsonMatch[1])
      }
    } catch {
      // 解析失败，回退
    }
    return fallback
  }
}

export const optimizationEngine = new OptimizationEngine()
