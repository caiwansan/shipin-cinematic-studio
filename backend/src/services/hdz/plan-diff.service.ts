/**
 * services/hdz/plan-diff.service.ts — 总纲版本治理：确定性 diff + 影响分析
 *
 * 设计原则（掌柜 02-A Task 2）：
 * - 不调 LLM：Git 式确定性 diff，省成本、可复现
 * - diffSummary 人类可读，供修订历史展示
 * - impact 估算受影响章节区间（按卷 chapterRange），支撑回滚风险预判
 */

export interface PlanDiffResult {
  changed: boolean
  diffSummary: string
  impact: {
    affectedChapterRanges: string[]
    affectedVolumeCount: number
    affectedItems: string[]
    severity: 'low' | 'medium' | 'high'
  }
  details: {
    worldDirectionChanged: boolean
    endingDirectionChanged: boolean
    forbiddenRulesAdded: string[]
    forbiddenRulesRemoved: string[]
    volumesChanged: Array<{ volume: number; chapterRange: string; change: string }>
    foreshadowingAdded: number
    foreshadowingRemoved: number
    characterCountChanged: boolean
  }
}

function asArray(v: any): any[] {
  return Array.isArray(v) ? v : []
}

function str(v: any): string {
  if (v == null) return ''
  return typeof v === 'string' ? v : JSON.stringify(v)
}

/** 提取卷的章节区间（支持 "1-30" / "第1卷-第30章" 等） */
function extractRange(rangeStr: string): [number, number] | null {
  const m = String(rangeStr || '').match(/(\d{1,5})\s*[-~至]\s*(\d{1,5})/)
  if (!m) return null
  return [parseInt(m[1], 10), parseInt(m[2], 10)]
}

export function computePlanDiff(before: any, after: any): PlanDiffResult {
  const b = before || {}
  const a = after || {}

  const details: PlanDiffResult['details'] = {
    worldDirectionChanged: str(b.worldDirection) !== str(a.worldDirection) && !!str(a.worldDirection),
    endingDirectionChanged: str(b.endingDirection) !== str(a.endingDirection) && !!str(a.endingDirection),
    forbiddenRulesAdded: [],
    forbiddenRulesRemoved: [],
    volumesChanged: [],
    foreshadowingAdded: 0,
    foreshadowingRemoved: 0,
    characterCountChanged: false,
  }

  // 禁则增删
  const bRules = new Set(asArray(b.forbiddenRules).map(str))
  const aRules = asArray(a.forbiddenRules).map(str)
  details.forbiddenRulesAdded = aRules.filter(r => !bRules.has(r))
  details.forbiddenRulesRemoved = [...bRules].filter(r => !aRules.includes(r))

  // 卷变化
  const bVols = asArray(b.volumes)
  const aVols = asArray(a.volumes)
  const bVolMap = new Map(bVols.map((v: any) => [String(v.volume || v.vol || ''), v]))
  for (const v of aVols) {
    const key = String(v.volume || v.vol || '')
    const bv = bVolMap.get(key)
    if (!bv) {
      details.volumesChanged.push({ volume: v.volume || v.vol, chapterRange: v.chapterRange || '', change: '新增卷' })
      continue
    }
    const changes: string[] = []
    if (str(bv.title) !== str(v.title)) changes.push('卷标题调整')
    if (str(bv.chapterRange) !== str(v.chapterRange)) changes.push('章节区间调整')
    if (str(bv.theme) !== str(v.theme)) changes.push('主题调整')
    if (str(bv.mainConflict) !== str(v.mainConflict)) changes.push('核心冲突调整')
    if (changes.length > 0) {
      details.volumesChanged.push({ volume: v.volume || v.vol, chapterRange: v.chapterRange || '', change: changes.join('+') })
    }
  }

  // 伏笔增删
  const bFores = new Set(asArray(b.foreshadowing).map((f: any) => str(f.event || f)))
  const aFores = asArray(a.foreshadowing).map((f: any) => str(f.event || f))
  details.foreshadowingAdded = aFores.filter(f => !bFores.has(f)).length
  details.foreshadowingRemoved = [...bFores].filter(f => !aFores.includes(f)).length

  // 角色弧线数量变化
  details.characterCountChanged = asArray(b.characters).length !== asArray(a.characters).length

  // ── 影响分析：受影响章节区间 ──
  const affectedRanges: string[] = []
  const affectedItems: string[] = []
  for (const vc of details.volumesChanged) {
    if (vc.chapterRange) affectedRanges.push(vc.chapterRange)
    affectedItems.push(`第${vc.volume}卷${vc.change}`)
  }
  if (details.worldDirectionChanged) {
    affectedRanges.push('全部章节（世界观规则变更）')
    affectedItems.push('世界观规则变更')
  }
  if (details.forbiddenRulesAdded.length > 0) affectedItems.push(`新增禁则 ${details.forbiddenRulesAdded.length} 条`)
  if (details.foreshadowingAdded > 0) affectedItems.push(`新增伏笔 ${details.foreshadowingAdded} 条`)
  if (details.characterCountChanged) affectedItems.push('角色弧线数量变化')

  // 严重度：世界观/禁则变更 = high；仅卷调整 = medium；仅伏笔 = low
  let severity: 'low' | 'medium' | 'high' = 'low'
  if (details.worldDirectionChanged || details.forbiddenRulesAdded.length > 0) severity = 'high'
  else if (details.volumesChanged.length > 0 || details.endingDirectionChanged) severity = 'medium'

  const changed =
    details.worldDirectionChanged || details.endingDirectionChanged ||
    details.forbiddenRulesAdded.length > 0 || details.forbiddenRulesRemoved.length > 0 ||
    details.volumesChanged.length > 0 || details.foreshadowingAdded > 0 ||
    details.foreshadowingRemoved > 0 || details.characterCountChanged

  // ── 人类可读摘要 ──
  const parts: string[] = []
  if (details.worldDirectionChanged) parts.push('世界观规则有调整')
  if (details.forbiddenRulesAdded.length > 0) parts.push(`新增禁则 ${details.forbiddenRulesAdded.length} 条`)
  if (details.forbiddenRulesRemoved.length > 0) parts.push(`移除禁则 ${details.forbiddenRulesRemoved.length} 条`)
  if (details.volumesChanged.length > 0) parts.push(`${details.volumesChanged.length} 个卷有调整`)
  if (details.foreshadowingAdded > 0) parts.push(`新增伏笔 ${details.foreshadowingAdded} 条`)
  if (details.foreshadowingRemoved > 0) parts.push(`移除伏笔 ${details.foreshadowingRemoved} 条`)
  if (details.characterCountChanged) parts.push('角色弧线数量变化')
  const diffSummary = changed
    ? `变更：${parts.join('；') || '内容有调整'}。受影响章节：${affectedRanges.length > 0 ? affectedRanges.join('、') : '无明确区间'}`
    : '无实质内容变更'

  return { changed, diffSummary, impact: { affectedChapterRanges: affectedRanges, affectedVolumeCount: details.volumesChanged.length, affectedItems, severity }, details }
}

/** 估算影响章节数量（用于 rollback 风险提示） */
export function estimateAffectedChapters(impact: PlanDiffResult['impact']): number {
  let total = 0
  for (const r of impact.affectedChapterRanges) {
    if (r === '全部章节（世界观规则变更）') return -1 // 未知/全部
    const rg = extractRange(r)
    if (rg) total += Math.max(0, rg[1] - rg[0] + 1)
  }
  return total
}
