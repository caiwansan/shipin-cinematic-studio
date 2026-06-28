import { prisma } from '../../utils/index.js'

interface SensitiveWordEntry {
  word: string
  replaceWith: string | null
}

let sensitiveWords: SensitiveWordEntry[] = []
let lastLoadedAt = 0
const CACHE_TTL = 120000 // 2 minutes

async function loadSensitiveWords(): Promise<SensitiveWordEntry[]> {
  const now = Date.now()
  if (sensitiveWords.length > 0 && now - lastLoadedAt < CACHE_TTL) {
    return sensitiveWords
  }
  try {
    const records = await prisma.communitySensitiveWord.findMany({
      select: { word: true, replaceWith: true },
    })
    sensitiveWords = records.map(r => ({ word: r.word.toLowerCase(), replaceWith: r.replaceWith }))
    lastLoadedAt = now
  } catch {
    // If table doesn't exist yet, return empty
    sensitiveWords = []
  }
  return sensitiveWords
}

/**
 * Check if content contains any sensitive word.
 * Returns the first matched word, or null if clean.
 */
export async function containsSensitiveWord(content: string): Promise<string | null> {
  const words = await loadSensitiveWords()
  if (words.length === 0) return null

  const lower = content.toLowerCase()
  for (const entry of words) {
    if (lower.includes(entry.word)) {
      return entry.word
    }
  }
  return null
}

/**
 * Replace sensitive words in the content.
 * Uses replaceWith if available, otherwise '***'.
 */
export async function filterSensitiveWords(content: string): Promise<string> {
  const words = await loadSensitiveWords()
  if (words.length === 0) return content

  let result = content
  for (const entry of words) {
    const escaped = entry.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(escaped, 'gi')
    const replacement = entry.replaceWith || '***'
    result = result.replace(regex, replacement)
  }
  return result
}

/**
 * Force reload sensitive words cache.
 */
export async function refreshSensitiveWords(): Promise<void> {
  sensitiveWords = []
  lastLoadedAt = 0
  await loadSensitiveWords()
}
