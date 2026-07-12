/**
 * services/legal/legal-rag.service.ts — Legal Knowledge RAG Service
 *
 * Sprint Intelligence: Legal Knowledge Retrieval
 *
 * 职责：
 * 1. Chunk 分割 — 将法律法规文本分割为可检索的片段
 * 2. Embedding — 调用 DashScopeEmbeddingProvider 生成向量
 * 3. 存储 — 存入 PostgreSQL JSONB 字段
 * 4. 检索 — cosine 相似度召回最相关的法律条文
 * 5. 引用 — 构建 AI 可用的法律引用上下文
 *
 * ⭐ 所有 embedding 调用走昆仑镜已有的 EmbeddingProvider interface
 *    DashScopeEmbeddingProvider 挂载到 AI Runtime 下
 */

import { prisma } from '../../utils/index.js'
import { getEmbeddingProvider } from '../../services/semantic/embedding.provider.js'

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

export interface ChunkResult {
  /** 原文 id */
  sourceId: string
  /** 来源表名: legal_knowledge | legal_regulations */
  sourceTable: string
  /** 分段索引（第几段） */
  chunkIndex: number
  /** 分段内容 */
  chunk: string
  /** 标题（用于引用） */
  title: string
  /** 分类 */
  category?: string
  /** 标签 */
  tags?: string
  /** embedding 向量 */
  vector?: number[]
}

export interface RetrievalResult {
  /** 相似度分数 (0~1) */
  score: number
  /** 来源表名 */
  sourceTable: string
  /** 标题 */
  title: string
  /** 内容 */
  content: string
  /** 分类 */
  category?: string
  /** 来源 id */
  sourceId: string
  /** 法律引用格式：例如"《中华人民共和国民法典》第577条" */
  citation: string
}

// ═══════════════════════════════════════════════════════════════
// Chunk 分割
// ═══════════════════════════════════════════════════════════════

/**
 * 智能分割法律文本
 * 按条（第X条）分割，没有条的按段落分割
 */
function smartChunk(text: string, maxLen: number = 512): string[] {
  if (!text) return []

  // 尝试按"第X条"分割
  const articlePattern = /第[一二三四五六七八九十百千万０-９0-9]+条/g
  let match: RegExpExecArray | null
  const articleMatches: { index: number; text: string }[] = []

  // 记录所有"第X条"的位置
  const re = new RegExp(articlePattern)
  while ((match = re.exec(text)) !== null) {
    articleMatches.push({ index: match.index, text: match[0] })
  }

  // 如果有按条分割，按条切
  if (articleMatches.length > 0) {
    const chunks: string[] = []
    for (let i = 0; i < articleMatches.length; i++) {
      const start = articleMatches[i].index
      const end = i + 1 < articleMatches.length ? articleMatches[i + 1].index : text.length
      let chunk = text.slice(start, end).trim()
      // 如果片段过长，按句号再切
      if (chunk.length > maxLen) {
        const sentences = chunk.split(/(?<=[。；！？])/)
        let current = ''
        for (const s of sentences) {
          if ((current + s).length > maxLen && current.length > 0) {
            chunks.push(current.trim())
            current = s
          } else {
            current += s
          }
        }
        if (current.trim()) chunks.push(current.trim())
      } else {
        chunks.push(chunk)
      }
    }
    return chunks.filter(Boolean)
  }

  // 没有"第X条"，按段落分割
  const paragraphs = text.split(/\n\s*\n/).filter(Boolean)
  const chunks: string[] = []
  let current = ''
  for (const p of paragraphs) {
    if ((current + p).length > maxLen && current.length > 0) {
      chunks.push(current.trim())
      current = p
    } else {
      current += '\n' + p
    }
  }
  if (current.trim()) chunks.push(current.trim())

  // 如果段落也不长，就整段
  if (chunks.length === 0) {
    if (text.length > maxLen) {
      // 按句号切
      const sentences = text.split(/(?<=[。；！？])/)
      let current = ''
      for (const s of sentences) {
        if ((current + s).length > maxLen && current.length > 0) {
          chunks.push(current.trim())
          current = s
        } else {
          current += s
        }
      }
      if (current.trim()) chunks.push(current.trim())
    } else {
      chunks.push(text.trim())
    }
  }

  return chunks.filter(Boolean)
}

// ═══════════════════════════════════════════════════════════════
// Cosine Similarity（内存计算）
// ═══════════════════════════════════════════════════════════════

function cosineSimilarity(a: number[], b: number[]): number {
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

// ═══════════════════════════════════════════════════════════════
// LegalRAGService
// ═══════════════════════════════════════════════════════════════

export class LegalRAGService {

  /**
   * 对单条法律知识生成 embedding
   */
  async indexKnowledge(id: string): Promise<void> {
    const item = await prisma.legalKnowledge.findUnique({ where: { id } })
    if (!item || !item.content) return

    const provider = getEmbeddingProvider()
    const chunks = smartChunk(item.content)
    const vectors: number[] = []
    let ch: string[] = []

    for (const chunk of chunks) {
      const vec = await provider.embed(`${item.title || ''}\n${chunk}`)
      if (vec) {
        vectors.push(...vec.vector)
        ch.push(chunk)
      }
    }

    // 存储所有 chunk 的向量平均（简化方案：concat 取平均）
    // 实际更合理的做法：存多个 embedding，检索时用 query embedding 分别比对
    const avgVector = this.averageVectors(chunks.length, vectors, ch.length)

    await prisma.legalKnowledge.update({
      where: { id },
      data: {
        embedding: JSON.parse(JSON.stringify(avgVector)) as any,
        embeddingVersion: (item as any).embeddingVersion + 1 || 1,
        chunkCount: ch.length,
      },
    })
  }

  /**
   * 对单条法律法规生成 embedding
   */
  async indexRegulation(id: string): Promise<void> {
    const item = await prisma.legalRegulation.findUnique({ where: { id } })
    if (!item || !item.content) return

    const provider = getEmbeddingProvider()
    const chunks = smartChunk(item.content)
    const vectors: number[] = []
    let ch: string[] = []

    for (const chunk of chunks) {
      const vec = await provider.embed(`${item.title}\n${chunk}`)
      if (vec) {
        vectors.push(...vec.vector)
        ch.push(chunk)
      }
    }

    const avgVector = this.averageVectors(chunks.length, vectors, ch.length)

    await prisma.legalRegulation.update({
      where: { id },
      data: {
        embedding: JSON.parse(JSON.stringify(avgVector)) as any,
        embeddingVersion: ((item as any).embeddingVersion + 1) || 1,
        chunkCount: ch.length,
      } as any,
    })
  }

  /**
   * 批量重建所有已启用知识的 embedding
   */
  async reindexAll(): Promise<{ knowledge: number; regulation: number }> {
    const knowledgeItems = await prisma.legalKnowledge.findMany({ where: { enabled: true } })
    const regulationItems = await prisma.legalRegulation.findMany({ where: { enabled: true } })

    let kCount = 0
    for (const item of knowledgeItems) {
      try {
        await this.indexKnowledge(item.id)
        kCount++
      } catch (err: any) {
        console.error(`[LegalRAG] indexKnowledge ${item.id} 失败: ${err.message}`)
      }
    }

    let rCount = 0
    for (const item of regulationItems) {
      try {
        await this.indexRegulation(item.id)
        rCount++
      } catch (err: any) {
        console.error(`[LegalRAG] indexRegulation ${item.id} 失败: ${err.message}`)
      }
    }

    return { knowledge: kCount, regulation: rCount }
  }

  /**
   * 检索与查询最相关的法律知识
   */
  async retrieve(query: string, topK: number = 5): Promise<RetrievalResult[]> {
    const provider = getEmbeddingProvider()

    // 1. 生成 query embedding
    const queryVec = await provider.embed(query)
    if (!queryVec) {
      // No embedding available, fall back to keyword search
      return this.keywordSearch(query, topK)
    }

    // 2. 从 DB 加载所有已索引的知识
    const [knowledgeItems, regulationItems] = await Promise.all([
      prisma.legalKnowledge.findMany({
        where: { enabled: true, embeddingVersion: { gt: 0 }, embedding: { not: null } },
        select: { id: true, title: true, content: true, category: true, embedding: true },
      }),
      prisma.legalRegulation.findMany({
        where: { enabled: true, embeddingVersion: { gt: 0 }, embedding: { not: null } },
        select: { id: true, title: true, content: true, category: true, embedding: true, issuedBy: true },
      }),
    ])

    // 3. 计算 cosine similarity
    const results: RetrievalResult[] = []

    for (const item of knowledgeItems) {
      const itemVec = (item.embedding as any) as number[] | null
      if (!itemVec) continue
      const score = cosineSimilarity(queryVec.vector, itemVec)
      results.push({
        score,
        sourceTable: 'legal_knowledge',
        title: item.title,
        content: item.content?.slice(0, 500) || '',
        category: item.category || undefined,
        sourceId: item.id,
        citation: `《${item.title}》`,
      })
    }

    for (const item of regulationItems) {
      const itemVec = (item.embedding as any) as number[] | null
      if (!itemVec) continue
      const score = cosineSimilarity(queryVec.vector, itemVec)
      results.push({
        score,
        sourceTable: 'legal_regulations',
        title: item.title,
        content: item.content?.slice(0, 500) || '',
        category: item.category || undefined,
        sourceId: item.id,
        citation: `《${item.title}》`,
      })
    }

    // 4. 按相似度排序取 topK
    results.sort((a, b) => b.score - a.score)
    const top = results.slice(0, topK)

    // 5. 如果 embedding 检索结果不够，补充 keyword search
    if (top.length < topK) {
      const keywordResults = await this.keywordSearch(query, topK - top.length)
      const existingIds = new Set(top.map(r => r.sourceId))
      for (const kr of keywordResults) {
        if (!existingIds.has(kr.sourceId)) {
          top.push(kr)
        }
      }
    }

    return top
  }

  /**
   * 关键词搜索（embedding 不可用时的 fallback）
   * 对中文进行细粒度切词，提高召回率
   */
  private async keywordSearch(query: string, topK: number = 5): Promise<RetrievalResult[]> {
    // 中文分词：按常见分隔符分割
    const tokens = query.split(/[\s,，、。.；;：:！!？?()（）【】\[\]{}"'""''"\n\r\t]+/).filter(k => k.length > 0)
    const keywordSet = new Set<string>()

    for (const token of tokens) {
      if (token.length >= 2 && token.length <= 5) {
        keywordSet.add(token)
      } else if (token.length > 5) {
        // 对超过5个字的长词，拆2-4字的重要词
        for (let i = 0; i < token.length - 1; i++) {
          for (const len of [2, 3, 4]) {
            if (i + len <= token.length) {
              keywordSet.add(token.slice(i, i + len))
            }
          }
        }
      }
    }

    // 限制最多 8 个关键词，避免 OR 过多
    const uniqueKeywords = [...keywordSet].filter(k => k.length >= 2).slice(0, 8)
    if (uniqueKeywords.length === 0) return []

    if (uniqueKeywords.length === 0) return []

    const [knowledgeItems, regulationItems] = await Promise.all([
      prisma.legalKnowledge.findMany({
        where: { enabled: true, OR: uniqueKeywords.map(k => ({ content: { contains: k } })) },
        take: topK,
      }),
      prisma.legalRegulation.findMany({
        where: { enabled: true, OR: uniqueKeywords.map(k => ({ content: { contains: k } })) },
        take: topK,
      }),
    ])

    const results: RetrievalResult[] = [
      ...knowledgeItems.map(item => ({
        score: 0.5,
        sourceTable: 'legal_knowledge' as const,
        title: item.title,
        content: item.content?.slice(0, 500) || '',
        category: item.category || undefined,
        sourceId: item.id,
        citation: `《${item.title}》`,
      })),
      ...regulationItems.map(item => ({
        score: 0.5,
        sourceTable: 'legal_regulations' as const,
        title: item.title,
        content: item.content?.slice(0, 500) || '',
        category: item.category || undefined,
        sourceId: item.id,
        citation: `《${item.title}》`,
      })),
    ]

    return results.slice(0, topK)
  }

  /**
   * 构建 RAG 上下文字符串（供 LegalAgent 注入到 system prompt）
   */
  async buildRagContext(query: string, topK: number = 3): Promise<string> {
    const results = await this.retrieve(query, topK)
    if (results.length === 0) return ''

    const parts = results.map((r, i) => {
      return `[法律依据 ${i + 1}] ${r.citation}
分类：${r.category || '通用'}
引用内容：${r.content.slice(0, 300)}`
    })

    return `\n## 相关法律依据\n${parts.join('\n\n')}\n`
  }

  /**
   * 平均向量（多个 chunk 平均成一个代表向量）
   */
  private averageVectors(totalChunks: number, flatVectors: number[], actualChunks: number): number[] | null {
    if (actualChunks === 0 || flatVectors.length === 0) return null

    // 第一个 chunk 的向量长度
    const dim = totalChunks > 0 ? Math.round(flatVectors.length / actualChunks) : 0
    if (dim === 0) return null

    const avg = new Array(dim).fill(0)
    for (let i = 0; i < actualChunks; i++) {
      const offset = i * dim
      for (let j = 0; j < dim; j++) {
        avg[j] += flatVectors[offset + j] || 0
      }
    }
    for (let j = 0; j < dim; j++) {
      avg[j] /= actualChunks
    }
    return avg
  }
}

export const legalRAG = new LegalRAGService()
