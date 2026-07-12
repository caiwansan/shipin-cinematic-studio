/**
 * providers/embedding/dashscope-embedding.provider.ts
 *
 * Embedding Provider — 从后台配置读取 provider / model / apiKey / baseURL
 * 支持任意 OpenAI 兼容的 embedding API
 *
 * Provider 优先级：
 * 1. LEGAL_EMBEDDING_API_KEY（后台配置，保存时注入 process.env）
 * 2. ALIYUN_API_KEY / BAILIAN_API_KEY（.env 手动配置）
 * 3. DEEPSEEK_API_KEY（LLM特征向量fallback）
 * 4. 无 key → 关键词搜索fallback
 */

import { setEmbeddingProvider, type EmbeddingProvider, type EmbeddingVector } from '../../services/semantic/embedding.provider.js'

interface EmbedConfig {
  provider: string      // dashscope | openai | deepseek
  model: string
  apiKey: string
  baseURL: string
}

function readConfig(): EmbedConfig | null {
  // Priority 1: 后台配置（最高优先级）
  const legalKey = process.env.LEGAL_EMBEDDING_API_KEY || ''
  if (legalKey) {
    return {
      provider: process.env.LEGAL_EMBEDDING_PROVIDER || 'openai',
      model: process.env.LEGAL_EMBEDDING_MODEL || 'text-embedding-v3',
      apiKey: legalKey,
      baseURL: process.env.LEGAL_EMBEDDING_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    }
  }

  // Priority 2: DashScope / Aliyun
  const aliKey = process.env.ALIYUN_API_KEY || process.env.BAILIAN_API_KEY || ''
  if (aliKey) {
    return {
      provider: 'dashscope',
      model: process.env.LEGAL_EMBEDDING_MODEL || 'text-embedding-v3',
      apiKey: aliKey,
      baseURL: process.env.ALIYUN_BASE_URL || process.env.BAILIAN_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    }
  }

  // Priority 3: DeepSeek（LLM 特征提取 fallback）
  const dsKey = process.env.DEEPSEEK_API_KEY || ''
  if (dsKey) {
    return {
      provider: 'deepseek',
      model: process.env.DEEPSEEK_LLM_MODEL || 'deepseek-chat',
      apiKey: dsKey,
      baseURL: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1',
    }
  }

  return null
}

export class DashScopeEmbeddingProvider implements EmbeddingProvider {
  name = 'legal-embedding'

  async embed(text: string): Promise<EmbeddingVector | null> {
    const cfg = readConfig()
    if (!cfg) return null

    try {
      // DeepSeek / 非 OpenAI 兼容 embedding → 走 LLM 特征提取
      if (cfg.provider === 'deepseek') {
        return await this.callLLMEmbedding(cfg, text)
      }

      // OpenAI 兼容 embedding API（DashScope / OpenAI / 其他）
      return await this.callOpenAICompatEmbedding(cfg, text)
    } catch (err: any) {
      console.error(`[Embedding] 调用失败 (${cfg.provider}/${cfg.model}): ${err.message}`)
      return null
    }
  }

  /**
   * OpenAI 兼容的 /embeddings 接口
   */
  private async callOpenAICompatEmbedding(cfg: EmbedConfig, text: string): Promise<EmbeddingVector | null> {
    const baseURL = cfg.baseURL.replace(/\/+$/, '')
    const response = await fetch(`${baseURL}/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify({
        model: cfg.model,
        input: text.slice(0, 8192),
        dimensions: 1024,
      }),
    })

    if (!response.ok) {
      const err = await response.text().catch(() => 'unknown')
      console.warn(`[Embedding] HTTP ${response.status}: ${err.slice(0, 200)}`)
      return null
    }

    const data: any = await response.json()
    const vector = data?.data?.[0]?.embedding
    if (!vector || !Array.isArray(vector)) return null

    return { vector, model: cfg.model, dimension: vector.length }
  }

  /**
   * LLM 特征提取（无专用 embedding API 时的 fallback）
   * 用 LLM 提取关键词，映射为固定维度的 hash 向量
   */
  private async callLLMEmbedding(cfg: EmbedConfig, text: string): Promise<EmbeddingVector | null> {
    const baseURL = cfg.baseURL.replace(/\/+$/, '')
    const response = await fetch(`${baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify({
        model: cfg.model,
        messages: [
          { role: 'system', content: '你是一个文本特征提取器。请分析下面文本的关键词和主题，输出5-8个关键词或短语，用逗号分隔。只输出关键词，不要解释。' },
          { role: 'user', content: text.slice(0, 4000) },
        ],
        temperature: 0.1,
        max_tokens: 200,
      }),
    })

    if (!response.ok) return null

    const data: any = await response.json()
    const keywords = data?.choices?.[0]?.message?.content || ''
    if (!keywords) return null

    // 关键词 hash → 128 维向量
    const dimension = 128
    const vector = new Array(dimension).fill(0)
    for (let i = 0; i < keywords.length; i++) {
      const h = (keywords.charCodeAt(i) * 31 + i * 7) % dimension
      vector[h] += 1.0 / keywords.length
    }

    return { vector, model: `${cfg.model}@feature-extract`, dimension }
  }

  async embedEntity(entity: any): Promise<EmbeddingVector | null> {
    const text = [entity.title, entity.content, entity.category, entity.tags].filter(Boolean).join('\n')
    return this.embed(text)
  }

  async embedTopic(topic: any): Promise<EmbeddingVector | null> {
    const text = [topic.title, topic.description].filter(Boolean).join('\n')
    return this.embed(text)
  }

  similarity(a: number[], b: number[]): number {
    if (!a?.length || !b?.length || a.length !== b.length) return 0
    let dot = 0, na = 0, nb = 0
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i]
      na += a[i] * a[i]
      nb += b[i] * b[i]
    }
    const mag = Math.sqrt(na) * Math.sqrt(nb)
    return mag === 0 ? 0 : dot / mag
  }
}

export function initLegalEmbedding(): void {
  const provider = new DashScopeEmbeddingProvider()
  setEmbeddingProvider(provider)
  const cfg = readConfig()
  console.log(`[LegalEmbedding] 已注册 (Provider: ${cfg?.provider || 'none'}, Model: ${cfg?.model || '-'})`)
  if (!cfg) {
    console.log(`[LegalEmbedding] 若需启用向量检索，请到后台「系统配置」中配置 Embedding API Key`)
  }
}
