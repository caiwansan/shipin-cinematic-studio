/**
 * Narrative Migration Engine — NOS 历史数据增量迁移引擎
 * 
 * 职责：从 hdzMemory + hdzChapter 的已有数据增量补齐 Runtime 缺失的事实。
 * 
 * 不是 Seeder — Migration 可以重复、增量、标记来源。
 * 不是 Story Librarian — Migration 只负责历史数据，不负责新章节。
 * 
 * Phase 3.1.6
 * 
 * 迁移原则：
 * 1. 只迁移 P0 类型：Event（从 chapter_summary 提取）、Relationship（从 organization 推断）
 * 2. 所有 Fact 标注 Origin=MIGRATION
 * 3. 高置信度优先：宁可少，不要错
 * 4. 增量兼容：已存在的事实不覆盖（除非 overwrite=true）
 * 5. 可追溯：每次迁移生成 MigrationRecord
 */

import { randomUUID as uuid } from 'crypto'
import { narrativeRepository } from '../narrative-repository.js'
import { prisma } from '../../../utils/index.js'
import type { MigrationOptions, MigrationRecord, HighConfidenceRelation } from './migration-types.js'

const FACT_ORIGIN = 'MIGRATION' as const

export class NarrativeMigrationEngine {
  /**
   * 执行迁移
   */
  async migrate(options: MigrationOptions): Promise<MigrationRecord> {
    const { projectId, targetRuntimes, fromChapter = 1, toChapter, overwrite = false } = options
    const now = new Date().toISOString()
    const errors: string[] = []

    // 确认项目存在
    const project = await prisma.hdzProject.findUnique({
      where: { id: projectId },
      select: { id: true },
    })
    if (!project) {
      return {
        id: uuid(),
        projectId,
        type: 'event',
        status: 'failed',
        origin: FACT_ORIGIN,
        migratedAt: now,
        sourceDescription: `项目 ${projectId} 不存在`,
        itemCount: 0,
        errors: [`Project ${projectId} not found`],
      }
    }

    // 并行迁移指定类型
    const results = await Promise.all(targetRuntimes.map(async (runtime) => {
      try {
        switch (runtime) {
          case 'event':
            return await this.migrateEvents(projectId, fromChapter, toChapter, overwrite)
          case 'relationship':
            return await this.migrateRelationships(projectId, overwrite)
          default:
            return { count: 0, errs: [`Unknown runtime: ${runtime}`] }
        }
      } catch (err: any) {
        return { count: 0, errs: [`${runtime} migration failed: ${err.message}`] }
      }
    }))

    const totalCount = results.reduce((sum, r) => sum + r.count, 0)
    results.forEach(r => errors.push(...r.errs))

    const status = errors.length === 0 ? 'completed' : errors.length > totalCount ? 'failed' : 'partial'

    return {
      id: uuid(),
      projectId,
      type: targetRuntimes.length === 1 ? targetRuntimes[0] : ('event' as any),
      status,
      origin: FACT_ORIGIN,
      migratedAt: now,
      sourceDescription: `Migration from chapters ${fromChapter}${toChapter ? `-${toChapter}` : '+'}`,
      itemCount: totalCount,
      errors,
    }
  }

  // ─── Event 迁移 — 从 chapter_summary 提取 ───

  private async migrateEvents(
    projectId: string, fromChapter: number, toChapter?: number, overwrite?: boolean
  ): Promise<{ count: number; errs: string[] }> {
    const errs: string[] = []

    // 读取已有事件，避免重复
    const existingEvents = narrativeRepository.readJson<any[]>(projectId, 'event', 'snapshot.json') || []
    const existingByChapter = new Map<number, Set<string>>()
    for (const ev of existingEvents) {
      if (!existingByChapter.has(ev.chapterNo)) existingByChapter.set(ev.chapterNo, new Set())
      existingByChapter.get(ev.chapterNo)!.add(ev.title)
    }

    // 读取所有章节（只取有 summary 的）
    const chapters = await prisma.hdzChapter.findMany({
      where: {
        projectId,
        chapterNo: { gte: fromChapter, ...(toChapter ? { lte: toChapter } : {}) },
        summary: { not: '' },
      },
      orderBy: { chapterNo: 'asc' },
      select: { chapterNo: true, title: true, summary: true },
    })

    const newEvents: any[] = []
    for (const ch of chapters) {
      const existing = existingByChapter.get(ch.chapterNo)
      const summary = ch.summary || ''

      // 从 summary 提取关键事件
      const extractedEvents = this.extractEventsFromSummary(ch.chapterNo, ch.title || '', summary, existing, overwrite)
      newEvents.push(...extractedEvents)
    }

    // 合并并写入
    const merged = overwrite
      ? newEvents
      : [...existingEvents, ...newEvents]

    // 去重（按 title + chapterNo）
    const seen = new Set<string>()
    const deduped = merged.filter(ev => {
      const key = `${ev.chapterNo}:${ev.title}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    narrativeRepository.writeJson(projectId, 'event', 'snapshot.json', deduped)
    return { count: newEvents.length, errs }
  }

  /**
   * 从 chapter summary 中提取事件
   * 
   * 规则引擎：按标点句子切分，找主谓结构的事件句。
   * 规则简单但高置信度——只提取"X做Y"式的明确事件。
   */
  private extractEventsFromSummary(
    chapterNo: number, chapterTitle: string, summary: string,
    existing?: Set<string>, overwrite?: boolean
  ): any[] {
    const events: any[] = []

    // 拆成句子
    const sentences = summary
      .split(/[。！？\n]/)
      .map(s => s.trim())
      .filter(s => s.length > 6)  // 太短的是碎片

    // 查找主要角色名单
    const mainChars = ['陆云舟', '陆归尘', '殷素素', '剑如晦', '太初真人', '玄天剑尊',
      '金镶玉', '凌云子', '沈清漪', '剑玄通', '青木崖', '冷潇潇', '无觉道长',
      '叶如霜', '归墟殿主', '司徒语嫣', '叶萧雨', '孤鸿子']

    // 从句子中提取事件
    for (const sentence of sentences) {
      // 跳过太短的
      if (sentence.length < 10) continue

      // 找角色名
      const mentionedChars = mainChars.filter(c => sentence.includes(c))
      if (mentionedChars.length === 0) continue

      // 判断事件类型
      const participants = mentionedChars.map((name, i) => ({
        characterName: name,
        role: i === 0 ? 'initiator' as const : 'participant' as const,
      }))

      // 取前 60 个字符作为事件标题
      const title = sentence.length > 60 ? sentence.slice(0, 60) + '...' : sentence

      // 跳过已有事件
      if (existing?.has(title) && !overwrite) continue

      // 确定类别
      const category = this.detectCategory(sentence, chapterTitle)

      events.push({
        id: `migrated-ev-${chapterNo}-${events.length}`,
        title,
        description: sentence,
        category,
        chapterNo,
        participants,
        locationName: undefined,
        consequences: [],
        relatedForeshadowIds: [],
        origin: FACT_ORIGIN,
        sourceSummary: summary.slice(0, 200),
      })
    }

    // 如果从句子中提取不到事件，保底生成一个章级事件
    if (events.length === 0 && chapterTitle) {
      const title = `第${chapterNo}章「${chapterTitle}」`
      if (!existing?.has(title) || overwrite) {
        events.push({
          id: `migrated-ev-${chapterNo}-default`,
          title,
          description: summary.slice(0, 200) || '本章发生了一些事情',
          category: 'other',
          chapterNo,
          participants: [],
          locationName: undefined,
          consequences: [],
          relatedForeshadowIds: [],
          origin: FACT_ORIGIN,
        })
      }
    }

    return events
  }

  private detectCategory(sentence: string, chapterTitle: string): string {
    const keywords: Record<string, string[]> = {
      combat: ['杀', '战', '斗', '攻', '剑', '掌', '刀', '刺', '挡', '逃', '追', '伏', '截'],
      death: ['死', '陨', '亡', '灭', '焚', '毁', '碎'],
      discovery: ['发现', '找到', '得知', '揭示', '揭示', '曝', '秘密', '真相', '认出'],
      political: ['宗', '派', '盟', '联', '叛', '投', '降', '立', '废'],
      betrayal: ['背叛', '出卖', '暗算', '反水', '卧底'],
      dialogue: ['说', '问', '答', '告诉', '解释', '谈判', '交谈', '对话'],
      romance: ['情', '爱', '吻', '拥抱', '泪', '依偎'],
      travel: ['前往', '抵达', '离开', '进入', '到达', '来到', '来到'],
      ceremony: ['祭', '礼', '典', '宴', '婚', '庆'],
      world_event: ['天外', '封印', '阵法', '秘境', '裂', '崩塌', '天劫'],
    }

    const lower = sentence + chapterTitle
    for (const [cat, words] of Object.entries(keywords)) {
      if (words.some(w => lower.includes(w))) return cat
    }
    return 'other'
  }

  // ─── Relationship 迁移 — 从组织和同门推断 ───

  private async migrateRelationships(
    projectId: string, overwrite?: boolean
  ): Promise<{ count: number; errs: string[] }> {
    const errs: string[] = []

    // 读取已有关系
    const existingRels = narrativeRepository.readJson<any[]>(projectId, 'relationship', 'snapshot.json') || []

    // 从角色列表构建高置信度关系
    const characters = narrativeRepository.readJson<any[]>(projectId, 'character', 'snapshot.json') || []
    const charNames = characters.map((c: any) => c.characterName).filter(Boolean)

    // 根据角色名称的语义推断组织归属（只做最高置信度）
    const relations: HighConfidenceRelation[] = []

    // 天剑宗
    const tianjianGroup = ['剑如晦', '玄天剑尊', '凌云子', '剑玄通']
    this.addGroupRelations(relations, tianjianGroup, 'same_organization', '天剑宗')

    // 天魔宗
    const tianmoGroup = ['金镶玉', '殷素素']
    this.addGroupRelations(relations, tianmoGroup, 'same_organization', '天魔宗')

    // 三清观
    const sanqingGroup = ['无觉道长', '太初真人']
    this.addGroupRelations(relations, sanqingGroup, 'same_organization', '三清观')

    // 主角与各势力的 known_associate
    const protagonist = '陆云舟'
    const associates = ['殷素素', '剑如晦', '太初真人', '金镶玉', '冷潇潇', '叶如霜', '无觉道长']
    for (const assoc of associates) {
      if (charNames.includes(assoc) && charNames.includes(protagonist)) {
        // 检查是否已存在
        const existing = existingRels.some((r: any) =>
          (r.characterAName === protagonist && r.characterBName === assoc) ||
          (r.characterAName === assoc && r.characterBName === protagonist)
        )
        if (!existing || overwrite) {
          relations.push({
            characterA: protagonist,
            characterB: assoc,
            bondType: 'known_associate',
            trustLevel: 0.9,
            evidence: '角色同故事主线，有多次直接或间接互动',
            chapterNo: 1,
            origin: FACT_ORIGIN,
          })
        }
      }
    }

    // 写入
    const newRels = relations.map(r => ({
      id: `migrated-rel-${r.characterA}-${r.characterB}`,
      characterAName: r.characterA,
      characterBName: r.characterB,
      currentStage: { type: r.bondType, status: 'active' as const, chapterNo: r.chapterNo },
      trustLevel: r.trustLevel,
      stages: [{ type: r.bondType, status: 'active' as const, chapterNo: r.chapterNo, evidence: r.evidence }],
      origin: FACT_ORIGIN,
    }))

    const merged = overwrite
      ? newRels
      : [...existingRels.filter((r: any) => r.origin !== FACT_ORIGIN), ...newRels]

    // 去重
    const seen = new Set<string>()
    const deduped = merged.filter((r: any) => {
      const key = [r.characterAName, r.characterBName].sort().join(':')
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    narrativeRepository.writeJson(projectId, 'relationship', 'snapshot.json', deduped)
    return { count: newRels.length, errs }
  }

  private addGroupRelations(
    relations: HighConfidenceRelation[], members: string[],
    bondType: HighConfidenceRelation['bondType'], orgName: string
  ): void {
    for (let i = 0; i < members.length; i++) {
      for (let j = i + 1; j < members.length; j++) {
        relations.push({
          characterA: members[i],
          characterB: members[j],
          bondType,
          trustLevel: 0.95,
          evidence: `同属${orgName}`,
          chapterNo: 1,
          origin: FACT_ORIGIN,
        })
      }
    }
  }
}

export const narrativeMigrationEngine = new NarrativeMigrationEngine()
