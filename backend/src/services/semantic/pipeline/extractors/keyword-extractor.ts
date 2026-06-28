// ============================================================
// Keyword Extractor — Rule-based keyword extraction
// Simple TF-based extraction with stop word filtering
// ============================================================

import type { ContentChunk, ExtractionResult } from '../../types.js'

const STOP_WORDS_ZH = new Set([
  '的', '了', '在', '是', '我', '有', '和', '就', '不', '人', '都', '一',
  '一个', '上', '也', '很', '到', '说', '要', '去', '你', '会', '着',
  '没有', '看', '好', '自己', '这', '他', '她', '它', '们', '那', '些',
  '来', '出', '下', '过', '为', '与', '而', '但', '或', '被', '把', '对',
  '吗', '吧', '啊', '呢', '啦', '呀', '么', '得', '能', '所', '从', '以',
  '之', '其', '中', '如', '将', '后', '前', '时', '年', '月', '日',
])

const STOP_WORDS_EN = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
  'this', 'that', 'these', 'those', 'it', 'its', 'we', 'our', 'you',
  'your', 'they', 'their', 'not', 'no', 'can', 'will', 'would', 'could',
  'should', 'may', 'have', 'has', 'had', 'do', 'does', 'did', 'about',
  'get', 'got', 'use', 'used', 'using', 'make', 'made', 'making',
  'also', 'just', 'very', 'much', 'more', 'most', 'some', 'any',
  'each', 'every', 'both', 'all', 'few', 'such', 'than', 'then',
  'now', 'here', 'there', 'when', 'where', 'why', 'how', 'what',
  'which', 'who', 'whom', 'whose', 'because', 'while', 'after',
  'before', 'during', 'through', 'above', 'below', 'between',
  'into', 'onto', 'upon', 'within', 'without', 'along', 'among',
  'around', 'about', 'against', 'across', 'behind', 'beyond',
  'down', 'off', 'over', 'under', 'up', 'out', 'via',
])

const STOP_WORDS = new Set([...STOP_WORDS_EN, ...STOP_WORDS_ZH])

function isChinese(text: string): boolean {
  return /[\u4e00-\u9fff]/.test(text)
}

interface WordEntry {
  word: string
  count: number
}

function extractWords(text: string): WordEntry[] {
  const counts = new Map<string, number>()

  // Chinese: extract 2-4 character segments
  const chineseChars = text.match(/[\u4e00-\u9fff]{2,6}/g) || []
  for (const seg of chineseChars) {
    if (STOP_WORDS.has(seg)) continue
    counts.set(seg, (counts.get(seg) || 0) + 1)

    // Also try sub-segments for longer phrases
    if (seg.length >= 4) {
      for (let i = 0; i <= seg.length - 2; i += 2) {
        const sub = seg.substring(i, i + 2)
        if (!STOP_WORDS.has(sub)) {
          counts.set(sub, (counts.get(sub) || 0) + 1)
        }
      }
    }
  }

  // English: extract alphanumeric words
  const englishWords = text.toLowerCase().match(/[a-z]{3,}/g) || []
  for (const word of englishWords) {
    if (STOP_WORDS.has(word)) continue
    if (/^\d+$/.test(word)) continue
    counts.set(word, (counts.get(word) || 0) + 1)
  }

  return Array.from(counts.entries())
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count)
}

export const keywordExtractor = {
  name: 'keyword-extractor',
  priority: 80,

  async extract(chunks: ContentChunk[], context?: Record<string, unknown>): Promise<Partial<ExtractionResult>> {
    // Combine all text
    const combinedText = chunks.map(c => c.text).join('\n')
    const maxKeywords = (context?.maxKeywords as number) || 30

    const words = extractWords(combinedText)

    // Calculate relative frequency for confidence
    const maxCount = words.length > 0 ? words[0].count : 1
    const keywords = words.slice(0, maxKeywords).map(({ word, count }) => ({
      keyword: word,
      confidence: Math.min(0.3 + (count / maxCount) * 0.7, 1.0),
    }))

    return { keywords }
  },
}
