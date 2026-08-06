// sensitive-engine.ts — 敏感词引擎（DFA/Trie，毫秒级匹配）
// SPRINT-IM-CHA-03 M3：客户端即时替换 + 服务端 webhook 复核共用同一引擎
export interface SensitiveWordEntry {
  word: string
  category: string
  level: number
}

export interface SensitiveHit {
  word: string
  category: string
  level: number
}

class TrieNode {
  children = new Map<string, TrieNode>()
  word: string | null = null
  level = 2
  category = 'other'
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export class SensitiveWordEngine {
  private root = new TrieNode()
  private wordCount = 0

  /** 全量重建（词库变更后调用） */
  build(words: SensitiveWordEntry[]) {
    this.root = new TrieNode()
    this.wordCount = 0
    for (const w of words) {
      const word = (w.word || '').trim()
      if (!word) continue
      let node = this.root
      for (const ch of word) {
        let next = node.children.get(ch)
        if (!next) {
          next = new TrieNode()
          node.children.set(ch, next)
        }
        node = next
      }
      node.word = word
      node.level = w.level || 2
      node.category = w.category || 'other'
      this.wordCount++
    }
  }

  get size() {
    return this.wordCount
  }

  /** 扫描命中（最长匹配优先；同一词只报一次；命中后跳到词尾继续） */
  scan(text: string): SensitiveHit[] {
    const hits: SensitiveHit[] = []
    const seen = new Set<string>()
    if (!text) return hits
    let i = 0
    const n = text.length
    while (i < n) {
      let node = this.root
      let j = i
      let lastHit: SensitiveHit | null = null
      while (j < n) {
        const next = node.children.get(text[j])
        if (!next) break
        node = next
        if (node.word && !seen.has(node.word)) {
          lastHit = { word: node.word, category: node.category, level: node.level }
          seen.add(node.word)
        }
        j++
      }
      if (lastHit) {
        hits.push(lastHit)
        i += lastHit.word.length
      } else {
        i++
      }
    }
    return hits
  }

  /** 替换命中词为等长 *；返回替换后文本 + 命中清单 */
  replace(text: string): { text: string; hits: SensitiveHit[] } {
    const hits = this.scan(text)
    if (!hits.length) return { text, hits }
    let out = text
    for (const h of hits) {
      const re = new RegExp(escapeRe(h.word), 'g')
      out = out.replace(re, (m) => '*'.repeat(m.length))
    }
    return { text: out, hits }
  }
}

// 全局单例（词库变更后 rebuild）
export const sensitiveEngine = new SensitiveWordEngine()

/** 从 DB 加载启用词并重建引擎 */
export async function loadSensitiveWordsIntoEngine(prisma: any) {
  const rows = await prisma.chatSensitiveWord.findMany({ where: { isActive: true } })
  sensitiveEngine.build(rows.map((r: any) => ({ word: r.word, category: r.category, level: r.level })))
  return sensitiveEngine.size
}
