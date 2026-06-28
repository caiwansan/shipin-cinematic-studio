import { prisma } from '../../utils/index.js'

let sensitiveWords: string[] = []
let lastLoadedAt = 0
const CACHE_TTL = 60000 // 1 minute

async function loadSensitiveWords(): Promise<string[]> {
  const now = Date.now()
  if (sensitiveWords.length > 0 && now - lastLoadedAt < CACHE_TTL) {
    return sensitiveWords
  }
  try {
    const records = await prisma.communitySensitiveWord.findMany({
      select: { word: true },
    })
    sensitiveWords = records.map(r => r.word.toLowerCase())
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
  for (const word of words) {
    if (lower.includes(word)) {
      return word
    }
  }
  return null
}

/**
 * Replace sensitive words with *** in the content.
 */
export async function filterSensitiveWords(content: string): Promise<string> {
  const words = await loadSensitiveWords()
  if (words.length === 0) return content

  let result = content
  for (const word of words) {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(escaped, 'gi')
    result = result.replace(regex, '***')
  }
  return result
}
