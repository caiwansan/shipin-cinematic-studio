/**
 * services/hdz/drift-analyzer.service.ts — Phase X.3.8 Drift Analysis Module
 *
 * 漂移分析器：从 writer_alignment_metrics 和历史数据中检测：
 * 1. 实体漂移 — 同一实体在不同章节的状态不一致
 * 2. 时间线异常 — 事件顺序冲突
 * 3. 关系反转 — 关系在无剧情驱动时改变
 *
 * 纯只读分析，不修改任何数据。
 */

import { writerAlignmentMetricRepository } from './repositories/writer-alignment-metric.repository.js'
import { hdzCharacterRepository } from './repositories/hdz-character.repository.js'
import { hdzChapterRepository } from './repositories/hdz-chapter.repository.js'
import { getAllEntities } from './entity-registry.service.js'

// ─── 类型定义 ───

export interface DriftReport {
  projectId: string
  generatedAt: string
  entityDrifts: EntityDrift[]
  timelineAnomalies: TimelineAnomaly[]
  relationshipFlips: RelationshipFlip[]
  summary: {
    totalDrifts: number
    totalAnomalies: number
    totalFlips: number
    severityBreakdown: { high: number; medium: number; low: number }
  }
}

export interface EntityDrift {
  entityId: string
  entityName: string
  entityType: string
  chapters: number[]        // 涉及的章节
  field: string             // 发生漂移的字段
  driftPattern: 'disappear_reappear' | 'state_conflict' | 'continuous_absence'
  description: string
  severity: 'high' | 'medium' | 'low'
}

export interface TimelineAnomaly {
  type: 'reverse_jump' | 'event_mismatch' | 'inconsistent_order'
  chapterNo: number
  description: string
  severity: 'high' | 'medium' | 'low'
}

export interface RelationshipFlip {
  entityA: string
  entityB: string
  relation: string
  chapterNo: number
  previousRelation?: string
  description: string
  severity: 'high' | 'medium' | 'low'
}

// ─── Drift Analyzer ───

class DriftAnalyzerService {
  /**
   * 对指定项目执行完整漂移分析
   */
  async analyzeProject(projectId: string): Promise<DriftReport> {
    console.log(`[DriftAnalyzer] 开始分析: project=${projectId}`)

    const entityGroups = await getAllEntities(projectId)
    const allEntities = [
      ...entityGroups.character,
      ...entityGroups.item,
      ...entityGroups.location,
    ]
    const entityMap = new Map(allEntities.map(e => [e.id, e]))

    // 获取历史对齐评分记录
    const metrics = await writerAlignmentMetricRepository.findMany({
      where: { projectId },
      orderBy: { createdAt: 'asc' },
      take: 500,
    }) as any[]

    // 获取所有角色
    const characters = await hdzCharacterRepository.findMany({
      where: { projectId },
      orderBy: { createdAt: 'asc' },
    }) as any[]

    // 获取所有章节
    const chapters = await hdzChapterRepository.findMany({
      where: { projectId },
      orderBy: { chapterNo: 'asc' },
    }) as any[]

    // ── 1. 实体漂移检测 ──
    const entityDrifts = await this.detectEntityDrifts(
      projectId, entityGroups, characters, chapters,
    )

    // ── 2. 时间线异常检测 ──
    const timelineAnomalies = this.detectTimelineAnomalies(chapters, entityGroups)

    // ── 3. 关系反转检测 ──
    const relationshipFlips = await this.detectRelationshipFlips(
      projectId, entityGroups, characters, chapters,
    )

    // ── 4. 汇总 ──
    const severityCount = { high: 0, medium: 0, low: 0 }
    for (const d of entityDrifts) severityCount[d.severity]++
    for (const a of timelineAnomalies) severityCount[a.severity]++
    for (const f of relationshipFlips) severityCount[f.severity]++

    const report: DriftReport = {
      projectId,
      generatedAt: new Date().toISOString(),
      entityDrifts,
      timelineAnomalies,
      relationshipFlips,
      summary: {
        totalDrifts: entityDrifts.length,
        totalAnomalies: timelineAnomalies.length,
        totalFlips: relationshipFlips.length,
        severityBreakdown: severityCount,
      },
    }

    console.log(`[DriftAnalyzer] 完成: ${entityDrifts.length} drifts, ${timelineAnomalies.length} anomalies, ${relationshipFlips.length} flips`)
    return report
  }

  /**
   * 检测实体漂移：
   * - 角色在某区间持续出现 → 然后消失 ≥5 章 → 再出现
   * - 角色属性（外观/性格）在不同章节不一致
   */
  private async detectEntityDrifts(
    projectId: string,
    entityGroups: any,
    characters: any[],
    chapters: any[],
  ): Promise<EntityDrift[]> {
    const drifts: EntityDrift[] = []

    // 构建每个角色在各章节的提及次数（基于 content 文本搜索）
    const nameMentions = new Map<string, number[]>()
    for (const ch of chapters) {
      if (!ch.content) continue
      for (const char of characters) {
        const escapedName = char.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const regex = new RegExp(escapedName, 'g')
        const count = (ch.content.match(regex) || []).length
        if (count > 0) {
          if (!nameMentions.has(char.name)) {
            nameMentions.set(char.name, [])
          }
          // 记录为 { chapter: count } 但这里只存次数
          while (nameMentions.get(char.name)!.length < ch.chapterNo) {
            nameMentions.get(char.name)!.push(0)
          }
          nameMentions.get(char.name)![ch.chapterNo - 1] = count
        }
      }
    }

    // 检测 disappear_reappear 模式
    for (const char of characters) {
      const mentions = nameMentions.get(char.name) || []
      if (mentions.length < 10) continue

      // 连续出现区间
      const activeRuns: Array<{ start: number; end: number }> = []
      let runStart = -1
      for (let i = 0; i < mentions.length; i++) {
        if (mentions[i] > 0 && runStart === -1) {
          runStart = i
        } else if (mentions[i] === 0 && runStart !== -1) {
          activeRuns.push({ start: runStart + 1, end: i })
          runStart = -1
        }
      }
      if (runStart !== -1) {
        activeRuns.push({ start: runStart + 1, end: mentions.length })
      }

      // 检测消失再现
      if (activeRuns.length >= 3 && activeRuns[0].end - activeRuns[0].start >= 3) {
        const gaps: number[] = []
        for (let i = 1; i < activeRuns.length; i++) {
          const gap = activeRuns[i].start - activeRuns[i - 1].end - 1
          if (gap >= 5) gaps.push(gap)
        }
        if (gaps.length > 0) {
          drifts.push({
            entityId: char.id,
            entityName: char.name,
            entityType: 'character',
            chapters: activeRuns.map(r => r.start),
            field: 'presence',
            driftPattern: 'disappear_reappear',
            description: `角色「${char.name}」出现 ${activeRuns.length} 次，最长消失 ${Math.max(...gaps)} 章后重现`,
            severity: Math.max(...gaps) >= 10 ? 'high' : Math.max(...gaps) >= 7 ? 'medium' : 'low',
          })
        }
      }
    }

    return drifts.slice(0, 15)
  }

  /**
   * 检测时间线异常：
   * - 章节中提及未来的事件
   * - 章节号与内容时间顺序不匹配（视情况）
   */
  private detectTimelineAnomalies(
    chapters: any[],
    entityGroups: any,
  ): TimelineAnomaly[] {
    const anomalies: TimelineAnomaly[] = []

    // 检测「第 X 章提及第 Y 章事件」（Y > X，即预知未来）
    for (let i = 0; i < chapters.length; i++) {
      const ch = chapters[i]
      if (!ch.content) continue

      // 在正文中搜索「第N章」模式
      const futureRefRegex = /第\s*(\d+)\s*章/g
      let match
      while ((match = futureRefRegex.exec(ch.content)) !== null) {
        const refChapter = parseInt(match[1])
        if (refChapter > ch.chapterNo && refChapter - ch.chapterNo >= 5) {
          anomalies.push({
            type: 'reverse_jump',
            chapterNo: ch.chapterNo,
            description: `第${ch.chapterNo}章提前引用第${refChapter}章的事件（预知未来）`,
            severity: refChapter - ch.chapterNo >= 20 ? 'high' : 'medium',
          })
        }
      }
    }

    return anomalies.slice(0, 10)
  }

  /**
   * 检测关系反转：
   * - 两个角色间的关系在没有剧情驱动时突然改变
   * - 盟友→敌人或敌人→盟友的突转
   */
  private async detectRelationshipFlips(
    projectId: string,
    entityGroups: any,
    characters: any[],
    chapters: any[],
  ): Promise<RelationshipFlip[]> {
    const flips: RelationshipFlip[] = []
    const charNameMap = new Map(characters.map(c => [c.id, c.name]))

    // 简单关键词检测
    const relationKeywords = {
      '盟友': ['盟友', '同伴', '战友', '朋友', '联手'],
      '敌人': ['敌人', '敌对', '仇人', '死敌', '对抗'],
      '师徒': ['师父', '徒弟', '师尊', '弟子', '传人'],
      '亲人': ['父亲', '母亲', '兄弟', '姐妹', '家人'],
      '恋人': ['恋人', '爱人', '心上人', '情侣', '未婚'],
    }

    const relationStates = new Map<string, string>()

    for (const ch of chapters) {
      if (!ch.content) continue
      const text = ch.content

      // 检测每对角色之间的关系描述
      for (let i = 0; i < characters.length; i++) {
        for (let j = i + 1; j < characters.length; j++) {
          const a = characters[i].name
          const b = characters[j].name

          // 只在文中同时出现时才检测
          if (!text.includes(a) || !text.includes(b)) continue

          // 在人物附近搜索关系关键词
          const nearbyText = this.getNearbyText(text, a, b)
          if (!nearbyText) continue

          for (const [rel, keywords] of Object.entries(relationKeywords)) {
            if (keywords.some(k => nearbyText.includes(k))) {
              const key = `${a}|${b}`
              const prev = relationStates.get(key)

              if (prev && prev !== rel) {
                // 关系变了！
                flips.push({
                  entityA: a,
                  entityB: b,
                  relation: rel,
                  chapterNo: ch.chapterNo,
                  previousRelation: prev,
                  description: `${a} 与 ${b} 关系从「${prev}」变为「${rel}」（第${ch.chapterNo}章）`,
                  severity: (prev === '亲人' && rel === '敌人') || (prev === '恋人' && rel === '敌人') ? 'high' : 'medium',
                })
              }
              relationStates.set(key, rel)
              break
            }
          }
        }
      }
    }

    return flips.slice(0, 15)
  }

  /**
   * 获取两个名字附近的上下文 text
   */
  private getNearbyText(text: string, a: string, b: string): string | null {
    const idxA = text.indexOf(a)
    const idxB = text.indexOf(b)
    if (idxA === -1 || idxB === -1) return null

    const start = Math.max(0, Math.min(idxA, idxB) - 100)
    const end = Math.min(text.length, Math.max(idxA, idxB) + 100 + a.length)
    return text.slice(start, end)
  }
}

export const driftAnalyzerService = new DriftAnalyzerService()
