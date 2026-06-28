// ============================================================
// Topic Extractor — Rule-based topic extraction from content
// Detects recurring themes and subjects
// ============================================================

import type { ContentChunk, ExtractionResult } from '../../types.js'

// Common topic-related keywords (Chinese + English)
const TOPIC_SIGNALS = [
  // Technology
  /\b(AI|artificial intelligence|machine learning|deep learning|neural network|computer vision|NLP|robotics)\b/gi,
  /\b(cloud computing|edge computing|quantum computing|blockchain|IoT|5G)\b/gi,
  // Business
  /\b(strategy|innovation|digital transformation|growth|scalability|automation)\b/gi,
  /\b(revenue|ROI|efficiency|optimization|cost reduction|competitive advantage)\b/gi,
  // Industry
  /\b(e-commerce|fintech|healthcare|education|manufacturing|retail|logistics|entertainment)\b/gi,
  // Content
  /\b(tutorial|guide|how.to|best practice|case study|demo|walkthrough)\b/gi,
  // Chinese topics
  /人工智能|机器学习|深度学习|大数据|云计算|区块链|物联网/g,
  /数字化转型|创新|自动化|优化|效率|增长/g,
]

// Extract topic phrases based on term frequency
function extractTopTerms(text: string): Array<{ term: string; count: number }> {
  const termCounts = new Map<string, number>()
  const cleaned = text.toLowerCase()

  // Common stop words
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
    'this', 'that', 'these', 'those', 'it', 'its', 'we', 'our', 'you',
    'your', 'they', 'their', 'not', 'no', 'can', 'will', 'would', 'could',
    'should', 'may', 'have', 'has', 'had', 'do', 'does', 'did', 'about',
    '的', '了', '在', '是', '我', '有', '和', '就', '不', '人', '都', '一',
    '一个', '上', '也', '很', '到', '说', '要', '去', '你', '会', '着',
    '没有', '看', '好', '自己', '这',
  ])

  // Extract 2-3 word phrases and single keywords
  const words = cleaned.split(/[\s,.;:!?()\[\]{}"'"、，。；：！？（）【】""''「」]+/)

  for (let i = 0; i < words.length; i++) {
    const word = words[i].trim()
    if (!word || word.length < 3 || stopWords.has(word)) continue
    if (/^\d+$/.test(word)) continue

    termCounts.set(word, (termCounts.get(word) || 0) + 1)

    // Bigram
    if (i + 1 < words.length) {
      const bigram = `${word} ${words[i + 1]}`
      if (words[i + 1].length >= 3 && !stopWords.has(words[i + 1])) {
        termCounts.set(bigram, (termCounts.get(bigram) || 0) + 1)
      }
    }
  }

  // Sort by frequency
  return Array.from(termCounts.entries())
    .filter(([_, count]) => count >= 2) // At least 2 occurrences
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
    .map(([term, count]) => ({ term, count }))
}

export const topicExtractor = {
  name: 'topic-extractor',
  priority: 90,

  async extract(chunks: ContentChunk[], context?: Record<string, unknown>): Promise<Partial<ExtractionResult>> {
    const allText = chunks.map(c => c.text).join('\n\n')
    const topics: ExtractionResult['topics'] = []
    const seen = new Set<string>()

    // 1. Match topic signal patterns
    for (const pattern of TOPIC_SIGNALS) {
      pattern.lastIndex = 0
      let match: RegExpExecArray | null
      while ((match = pattern.exec(allText)) !== null) {
        const name = match[0].trim()
        const key = name.toLowerCase()
        if (!seen.has(key) && name.length >= 3) {
          seen.add(key)
          topics.push({ name, confidence: 0.6, description: undefined })
        }
      }
    }

    // 2. Extract frequent terms
    const topTerms = extractTopTerms(allText)
    for (const { term, count } of topTerms) {
      const key = term.toLowerCase()
      if (!seen.has(key)) {
        seen.add(key)
        // Boost confidence based on frequency
        const confidence = Math.min(0.3 + (count * 0.05), 0.9)
        topics.push({ name: term.charAt(0).toUpperCase() + term.slice(1), confidence, description: undefined })
      }
    }

    // Limit topics
    const maxTopics = (context?.maxTopics as number) || 15
    return { topics: topics.slice(0, maxTopics) }
  },
}
