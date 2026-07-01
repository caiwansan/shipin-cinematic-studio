/**
 * services/hdz/entity-contract-checker.service.ts — Phase X.4 Step 2
 *
 * Entity Contract Checker (只读)
 *
 * 验证 Writer 输出是否遵守 SceneGraph 的 EntityContract：
 * - required_entities 是否都出现了
 * - forbidden_entities 是否被误引用
 * - optional_entities 的覆盖度
 * - 整体 contract compliance score
 *
 * 纯只读，不阻断 Writer，不修改数据。
 * 仅供验证和监控。
 */

import { hdzChapterRepository } from './repositories/hdz-chapter.repository.js'
import { sceneDagRepository } from './repositories/scene-dag.repository.js'
import type { EntityContract } from './scene-compiler.service.js'

// ─── 类型定义 ───

export interface ContractCheckResult {
  projectId: string
  chapterNo: number
  sceneNo: number
  requiredCount: number
  optionalCount: number
  forbiddenCount: number
  /** required 实体中实际出现在正文的比例 */
  requiredRecall: number
  /** required 中哪些缺失了 */
  missingRequired: string[]
  /** optional 实体的覆盖比例 */
  optionalCoverage: number
  /** forbidden 违规引用情况 */
  forbiddenViolations: Array<{ name: string; count: number }>
  /** 综合合规评分 (0-1) */
  complianceScore: number
  /** 是否符合验收标准（score >= 0.65） */
  isAcceptable: boolean
  /** 诊断建议 */
  diagnostics: string[]
}

// ─── Contract Checker ───

class EntityContractChecker {
  /**
   * 检查单章节的 Writer 输出是否遵守 EntityContract
   */
  checkChapter(input: {
    projectId: string
    chapterNo: number
    sceneNo: number
    text: string
    contract: EntityContract
  }): ContractCheckResult {
    const { projectId, chapterNo, sceneNo, text, contract } = input
    const diagnostics: string[] = []

    // 1. required 实体检查
    const missingRequired: string[] = []
    let requiredHit = 0

    for (const name of contract.required) {
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      if (new RegExp(escaped).test(text)) {
        requiredHit++
      } else {
        missingRequired.push(name)
      }
    }

    const requiredRecall = contract.required.length > 0
      ? requiredHit / contract.required.length
      : 1

    if (missingRequired.length > 0) {
      diagnostics.push(
        `required 实体缺失: ${missingRequired.join(', ')} (${missingRequired.length}/${contract.required.length})`,
      )
    }

    // 2. optional 实体检查
    let optionalHit = 0
    for (const name of contract.optional) {
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      if (new RegExp(escaped).test(text)) optionalHit++
    }

    const optionalCoverage = contract.optional.length > 0
      ? optionalHit / contract.optional.length
      : 1

    // 3. forbidden 实体检查
    const forbiddenViolations: Array<{ name: string; count: number }> = []
    for (const name of contract.forbidden) {
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const regex = new RegExp(escaped, 'g')
      const matches = text.match(regex)
      if (matches) {
        forbiddenViolations.push({ name, count: matches.length })
      }
    }

    if (forbiddenViolations.length > 0) {
      diagnostics.push(
        `forbidden 实体违规引用: ${forbiddenViolations.map(v => `${v.name}(x${v.count})`).join(', ')}`,
      )
    }

    // 4. 综合评分
    const penalty = Math.min(forbiddenViolations.length * 0.2, 0.8)
    const rawScore = 0.6 * requiredRecall + 0.3 * optionalCoverage - penalty
    const complianceScore = Math.max(0, Math.min(1, Math.round(rawScore * 1000) / 1000))

    // 5. 诊断
    if (complianceScore >= 0.85) {
      diagnostics.push('✅ 合规评分优秀 — EntityContract 完全遵守')
    } else if (complianceScore >= 0.65) {
      diagnostics.push('⚠️ 合规评分可接受 — 有少量缺失，但不影响整体一致')
    } else {
      diagnostics.push('❌ 合规评分不合格 — EntityContract 未得到遵守，建议检查 Writer prompt')
    }

    return {
      projectId,
      chapterNo,
      sceneNo,
      requiredCount: contract.required.length,
      optionalCount: contract.optional.length,
      forbiddenCount: contract.forbidden.length,
      requiredRecall: Math.round(requiredRecall * 1000) / 1000,
      missingRequired,
      optionalCoverage: Math.round(optionalCoverage * 1000) / 1000,
      forbiddenViolations,
      complianceScore,
      isAcceptable: complianceScore >= 0.65,
      diagnostics,
    }
  }

  /**
   * 批量验证多个章节
   */
  async checkChapters(
    projectId: string,
    chapterRange: [number, number],
  ): Promise<{
    total: number
    acceptable: number
    unacceptable: number
    avgScore: number
    results: ContractCheckResult[]
  }> {
    const chapters = await hdzChapterRepository.findMany({
      where: {
        projectId,
        chapterNo: { gte: chapterRange[0], lte: chapterRange[1] },
        content: { not: null },
      },
      orderBy: { chapterNo: 'asc' },
    }) as any[]

    const results: ContractCheckResult[] = []
    for (const ch of chapters) {
      if (!ch.content) continue

      // 尝试从 SceneDag 获取 EntityContract
      const sceneDags = await sceneDagRepository.findMany({
        where: { projectId, chapterNo: ch.chapterNo },
      }) as any[]

      if (sceneDags.length === 0) {
        // 无 SceneDag 记录 —— 该章节没有经过 SceneCompilerV2
        continue
      }

      for (const sd of sceneDags) {
        const dag = sd.dagJson as any
        const contract = dag?.entityContract as EntityContract | undefined
        if (!contract) continue

        const result = this.checkChapter({
          projectId,
          chapterNo: ch.chapterNo,
          sceneNo: 1,
          text: ch.content,
          contract,
        })
        results.push(result)
      }
    }

    const avgScore = results.length > 0
      ? results.reduce((a, r) => a + r.complianceScore, 0) / results.length
      : 0

    return {
      total: results.length,
      acceptable: results.filter(r => r.isAcceptable).length,
      unacceptable: results.filter(r => !r.isAcceptable).length,
      avgScore: Math.round(avgScore * 1000) / 1000,
      results,
    }
  }
}

export const entityContractChecker = new EntityContractChecker()
