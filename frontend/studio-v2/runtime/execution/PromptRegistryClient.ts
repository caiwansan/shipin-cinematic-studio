/**
 * PromptRegistryClient.ts — 前端 Prompt Registry 客户端
 *
 * 职责：前端唯一 Prompt 获取入口，通过 API 调用后端 PromptRegistry
 * 宪法：前端禁止持有任何硬编码规则/映射/决策逻辑
 *
 * 使用方式：
 *   const rules = await PromptRegistryClient.getPrompt('director/emotion-analysis', { emotion: '开心' })
 *   const cameras = await PromptRegistryClient.getPrompt('director/camera-suggestion', { emotion: '悲伤' })
 *
 * @phase3-prompt-client
 */

export interface PromptRegistryOptions {
  // 兜底行为：后端不可用时抛错（禁止返回硬编码）
  quiet?: boolean
}

class PromptRegistryClientClass {
  private baseUrl = '/api/ai/prompt-registry'

  /**
   * 获取单条 prompt
   * @param name prompt 名称
   * @param context  注入上下文（可选）
   */
  async getPrompt(name: string, context?: Record<string, any>, options?: PromptRegistryOptions): Promise<string> {
    try {
      const res = await fetch(`${this.baseUrl}/get`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, context }),
      })
      if (!res.ok) {
        const errBody = await res.text()
        throw new Error(`PromptRegistry API 返回 ${res.status}: ${errBody}`)
      }
      const data = await res.json()
      return data.prompt || ''
    } catch (err: any) {
      if (options?.quiet) {
        console.warn(`[PromptRegistryClient] getPrompt("${name}") 失败(quiet):`, err.message)
        return ''
      }
      throw new Error(`[PromptRegistryClient] getPrompt("${name}") 失败: ${err.message}`)
    }
  }

  /**
   * 批量获取 prompts
   */
  async getPromptBatch(names: string[], context?: Record<string, any>): Promise<Record<string, string>> {
    try {
      const res = await fetch(`${this.baseUrl}/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ names, context }),
      })
      if (!res.ok) throw new Error(`PromptRegistry batch API 返回 ${res.status}`)
      const data = await res.json()
      return data.prompts || {}
    } catch (err: any) {
      throw new Error(`[PromptRegistryClient] 批量获取失败: ${err.message}`)
    }
  }

  /**
   * 获取结构化 entry（含 extra 字段）
   */
  async getEntry(name: string, context?: Record<string, any>): Promise<any> {
    try {
      const res = await fetch(`${this.baseUrl}/entry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, context }),
      })
      if (!res.ok) throw new Error(`PromptRegistry entry API 返回 ${res.status}`)
      return await res.json()
    } catch (err: any) {
      throw new Error(`[PromptRegistryClient] getEntry("${name}") 失败: ${err.message}`)
    }
  }
}

export const PromptRegistryClient = new PromptRegistryClientClass()
