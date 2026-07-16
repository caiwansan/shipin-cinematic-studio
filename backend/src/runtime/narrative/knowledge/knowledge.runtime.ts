/**
 * Knowledge Runtime — 人物认知差异
 * 
 * SSOT for: 每个角色知道什么、不知道什么
 * 
 * 这是产生戏剧张力（dramatic irony）的核心 Runtime。
 * 例：读者知道皇帝中毒，但林辰不知道 → dramatic irony。
 * 
 * Queryable:
 * - 林辰知道哪些真相？不知道哪些？
 * - 谁不知道苏婉的真实身份？
 * - 这个秘密在第几章揭示的？
 */

import type { KnowledgePiece, KnowledgeCategory, TraceInfo } from '../narrative-types.js'
import { narrativeRepository } from '../narrative-repository.js'
import { randomUUID as uuid } from 'crypto'

const RUNTIME_NAME = 'knowledge'

export class KnowledgeRuntime {
  readonly name = RUNTIME_NAME

  async initialize(projectId: string): Promise<void> {
    const existing = narrativeRepository.readJson<KnowledgePiece[]>(projectId, RUNTIME_NAME, 'knowledge.json')
    if (existing) return
    narrativeRepository.writeJson<KnowledgePiece[]>(projectId, RUNTIME_NAME, 'knowledge.json', [])
    console.log(`[KnowledgeRuntime] initialized for ${projectId}`)
  }

  async getSnapshot(projectId: string): Promise<KnowledgePiece[]> {
    return narrativeRepository.readJson<KnowledgePiece[]>(projectId, RUNTIME_NAME, 'knowledge.json') || []
  }

  /** 新增一条知识/真相 */
  addKnowledge(projectId: string, knowledge: Omit<KnowledgePiece, 'id' | 'projectId' | 'active'>): KnowledgePiece {
    const all = narrativeRepository.readJson<KnowledgePiece[]>(projectId, RUNTIME_NAME, 'knowledge.json') || []
    const piece: KnowledgePiece = {
      ...knowledge,
      id: uuid(),
      projectId,
      active: true,
    }
    all.push(piece)
    narrativeRepository.writeJson(projectId, RUNTIME_NAME, 'knowledge.json', all)
    return piece
  }

  /** 让角色知道某条知识 */
  characterLearns(projectId: string, knowledgeId: string, characterName: string, chapterNo: number): void {
    const all = narrativeRepository.readJson<KnowledgePiece[]>(projectId, RUNTIME_NAME, 'knowledge.json') || []
    const idx = all.findIndex(k => k.id === knowledgeId)
    if (idx === -1) return

    if (!all[idx].knownBy.includes(characterName)) {
      all[idx].knownBy.push(characterName)
    }
    all[idx].unknownBy = all[idx].unknownBy.filter(n => n !== characterName)
    narrativeRepository.writeJson(projectId, RUNTIME_NAME, 'knowledge.json', all)
  }

  /** 明确标记某个角色不知道某条知识 */
  characterRemainsIgnorant(projectId: string, knowledgeId: string, characterName: string): void {
    const all = narrativeRepository.readJson<KnowledgePiece[]>(projectId, RUNTIME_NAME, 'knowledge.json') || []
    const idx = all.findIndex(k => k.id === knowledgeId)
    if (idx === -1) return
    if (!all[idx].unknownBy.includes(characterName)) {
      all[idx].unknownBy.push(characterName)
    }
    narrativeRepository.writeJson(projectId, RUNTIME_NAME, 'knowledge.json', all)
  }

  // ─── 查询方法 ───

  /** 获取角色知道的所有知识 */
  whatDoesXKnow(projectId: string, characterName: string): KnowledgePiece[] {
    const all = narrativeRepository.readJson<KnowledgePiece[]>(projectId, RUNTIME_NAME, 'knowledge.json') || []
    return all.filter(k => k.knownBy.includes(characterName) && k.active)
  }

  /** 获取角色不知道的知识（dramatic irony 素材） */
  whatDoesXNotKnow(projectId: string, characterName: string): KnowledgePiece[] {
    const all = narrativeRepository.readJson<KnowledgePiece[]>(projectId, RUNTIME_NAME, 'knowledge.json') || []
    return all.filter(k =>
      !k.knownBy.includes(characterName) &&
      (k.unknownBy.includes(characterName) || k.unknownBy.length === 0) &&
      k.active
    )
  }

  /** 获取某个分类下的所有知识 */
  getKnowledgeByCategory(projectId: string, category: KnowledgeCategory): KnowledgePiece[] {
    const all = narrativeRepository.readJson<KnowledgePiece[]>(projectId, RUNTIME_NAME, 'knowledge.json') || []
    return all.filter(k => k.category === category && k.active)
  }

  /** 获取两个角色之间的信息差 */
  getKnowledgeGap(projectId: string, characterA: string, characterB: string): {
    aKnowsBDont: KnowledgePiece[]
    bKnowsADont: KnowledgePiece[]
  } {
    const all = narrativeRepository.readJson<KnowledgePiece[]>(projectId, RUNTIME_NAME, 'knowledge.json') || []
    return {
      aKnowsBDont: all.filter(k => k.knownBy.includes(characterA) && !k.knownBy.includes(characterB) && k.active),
      bKnowsADont: all.filter(k => k.knownBy.includes(characterB) && !k.knownBy.includes(characterA) && k.active),
    }
  }

  async resetProject(projectId: string): Promise<void> {
    narrativeRepository.deleteJson(projectId, RUNTIME_NAME, 'knowledge.json')
  }
}
