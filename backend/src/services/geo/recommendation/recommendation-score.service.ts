// ============================================================
// Recommendation Score Service v2 — Score Explainability
// Returns per-dimension breakdown with reasons for each point
// ============================================================

import { prisma } from '../../utils/index.js'

// ── Types ──

export interface ScoreDetailItem {
  label: string
  status: 'good' | 'neutral' | 'bad'
  reason: string
  points: number
  maxPoints: number
}

export interface ScoreDimension {
  score: number
  details: ScoreDetailItem[]
}

export interface ScoreExplainability {
  overall: number
  breakdown: {
    visibility: ScoreDimension
    authority: ScoreDimension
    content: ScoreDimension
    website: ScoreDimension
    knowledge: ScoreDimension
  }
}

// For backward compatibility with existing callers
export type ScoreResult = ScoreExplainability

// ── Helpers ──

function makeDetail(
  label: string,
  status: 'good' | 'neutral' | 'bad',
  reason: string,
  points: number,
  maxPoints: number
): ScoreDetailItem {
  return { label, status, reason, points, maxPoints }
}

// ── Virtual overrides type for simulator ──

export interface ScoreVirtualOverrides {
  virtualKnowledge?: number
  virtualClaims?: number
  virtualEvidence?: number
  virtualEntities?: number
  hasWebsiteOverride?: boolean
  hasFAQOverride?: boolean
  hasSchemaOverride?: boolean
}

// ── Main scorer ──

export async function calculateScore(
  projectId: string,
  virtual?: ScoreVirtualOverrides
): Promise<ScoreExplainability> {
  // ── Fetch raw data ──
  const [brandProfiles, knowledgeCount, entities, scans, settings] = await Promise.all([
    prisma.geoBrandProfile.count({ where: { projectId } }),
    prisma.knowledgeObject.count({ where: { projectId } }),
    prisma.gEOEntity.count({ where: { projectId } }),
    prisma.geoScanHistory.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      take: 1,
      select: { id: true, status: true, scanType: true, createdAt: true },
    }),
    prisma.geoBrandSetting.findFirst({ where: { projectId } }),
  ])

  // Claims & evidence via entity chain
  const entityIds = entities > 0
    ? (await prisma.gEOEntity.findMany({ where: { projectId }, select: { id: true } })).map(e => e.id)
    : []

  const claims = entityIds.length > 0
    ? await prisma.gEOClaim.count({ where: { entityId: { in: entityIds } } })
    : 0

  let evidenceCount = 0
  if (claims > 0) {
    const claimIds = (await prisma.gEOClaim.findMany({
      where: { entityId: { in: entityIds } },
      select: { id: true },
    })).map(c => c.id)
    evidenceCount = claimIds.length > 0
      ? await prisma.gEOEvidence.count({ where: { claimId: { in: claimIds } } })
      : 0
  }

  const lastScan = scans.length > 0 ? scans[0] : null
  const lastScanOk = lastScan?.status === 'completed'

  // ── Apply virtual overrides for simulation ──
  const effectiveKnowledgeCount = knowledgeCount + (virtual?.virtualKnowledge || 0)
  const effectiveEntities = entities + (virtual?.virtualEntities || 0)
  const effectiveClaims = claims + (virtual?.virtualClaims || 0)
  const effectiveEvidence = evidenceCount + (virtual?.virtualEvidence || 0)

  // ── Visibility (max ~100) ──
  const visibilityDetails: ScoreDetailItem[] = []

  // Brand created
  if (brandProfiles > 0) {
    visibilityDetails.push(makeDetail('已建立品牌', 'good', '品牌信息已录入', 15, 15))
  } else {
    visibilityDetails.push(makeDetail('已建立品牌', 'bad', '尚未录入品牌信息', 0, 15))
  }

  // Website scan
  if (lastScanOk && lastScan?.scanType === 'website') {
    visibilityDetails.push(makeDetail('官网扫描', 'good', '官网扫描已完成', 20, 20))
  } else if (lastScan && lastScan.scanType === 'website') {
    visibilityDetails.push(makeDetail('官网扫描', 'neutral', '官网扫描进行中', 10, 20))
  } else {
    visibilityDetails.push(makeDetail('官网扫描', 'bad', '尚未扫描官网', 0, 20))
  }

  // Keyword scan
  if (lastScanOk && lastScan?.scanType === 'keyword') {
    visibilityDetails.push(makeDetail('关键词扫描', 'good', '关键词扫描已完成', 20, 20))
  } else if (lastScan) {
    visibilityDetails.push(makeDetail('关键词扫描', 'neutral', '关键词扫描进行中', 10, 20))
  } else {
    visibilityDetails.push(makeDetail('关键词扫描', 'bad', '尚未扫描关键词', 0, 20))
  }

  // Entity presence
  const simEntityCount = effectiveEntities || entities
  const entityDetail = simEntityCount >= 5
    ? makeDetail('关联对象', 'good', `已建立 ${simEntityCount} 个关联对象`, 25, 25)
    : simEntityCount >= 1
    ? makeDetail('关联对象', 'neutral', `已建立 ${simEntityCount} 个关联对象，建议达到 5 个以上`, 15, 25)
    : makeDetail('关联对象', 'bad', '尚未建立关联对象', 0, 25)

  visibilityDetails.push(entityDetail)

  // Brand name set
  if (settings?.brandName) {
    visibilityDetails.push(makeDetail('品牌名称', 'good', '品牌名称已设置', 10, 10))
  } else {
    visibilityDetails.push(makeDetail('品牌名称', 'bad', '尚未设置品牌名称', 0, 10))
  }

  // Description set
  if (settings?.description) {
    visibilityDetails.push(makeDetail('品牌描述', 'good', '品牌描述已填写', 10, 10))
  } else {
    visibilityDetails.push(makeDetail('品牌描述', 'bad', '尚未填写品牌描述', 0, 10))
  }

  const visibilityScore = Math.min(100, visibilityDetails.reduce((s, d) => s + d.points, 0))

  // ── Authority (max ~100) ──
  const authorityDetails: ScoreDetailItem[] = []

  // Entities (5pts each, max 35)
  const entityScore = Math.min(35, effectiveEntities * 5)
  if (effectiveEntities >= 7) {
    authorityDetails.push(makeDetail('实体数量', 'good', `${effectiveEntities} 个实体，基础良好`, entityScore, 35))
  } else if (effectiveEntities >= 1) {
    authorityDetails.push(makeDetail('实体数量', 'neutral', `${effectiveEntities} 个实体，建议达到 7 个以上`, entityScore, 35))
  } else {
    authorityDetails.push(makeDetail('实体数量', 'bad', '暂无实体', 0, 35))
  }

  // Claims (3pts each, max 30)
  const claimScore = Math.min(30, effectiveClaims * 3)
  if (effectiveClaims >= 10) {
    authorityDetails.push(makeDetail('事实声明', 'good', `${effectiveClaims} 条事实声明，可信度良好`, claimScore, 30))
  } else if (effectiveClaims >= 1) {
    authorityDetails.push(makeDetail('事实声明', 'neutral', `${effectiveClaims} 条事实声明，建议达到 10 条以上`, claimScore, 30))
  } else {
    authorityDetails.push(makeDetail('事实声明', 'bad', '暂无事实声明', 0, 30))
  }

  // Evidence (2pts each, max 25)
  const evidenceScore = Math.min(25, effectiveEvidence * 2)
  if (effectiveEvidence >= 12) {
    authorityDetails.push(makeDetail('引用证据', 'good', `${effectiveEvidence} 条引用证据，可信度强`, evidenceScore, 25))
  } else if (effectiveEvidence >= 1) {
    authorityDetails.push(makeDetail('引用证据', 'neutral', `${effectiveEvidence} 条引用证据，建议达到 12 条以上`, evidenceScore, 25))
  } else {
    authorityDetails.push(makeDetail('引用证据', 'bad', '暂无引用证据', 0, 25))
  }

  // Entity relations (2pts each, max 10)
  const relationCount = entityIds.length > 0
    ? await prisma.gEOEntityRelation.count({ where: { projectId } })
    : 0
  const relationScore = Math.min(10, relationCount * 2)
  if (relationCount >= 5) {
    authorityDetails.push(makeDetail('关联关系', 'good', `${relationCount} 条实体关系网络`, relationScore, 10))
  } else if (relationCount >= 1) {
    authorityDetails.push(makeDetail('关联关系', 'neutral', `${relationCount} 条实体关系`, relationScore, 10))
  } else {
    authorityDetails.push(makeDetail('关联关系', 'bad', '暂无实体关系', 0, 10))
  }

  const authorityScore = Math.min(100, authorityDetails.reduce((s, d) => s + d.points, 0))

  // ── Content (max ~100) ──
  const contentDetails: ScoreDetailItem[] = []

  // Brand profiles (25pts each, max 50)
  const bpScore = Math.min(50, brandProfiles * 25)
  if (brandProfiles >= 2) {
    contentDetails.push(makeDetail('品牌资料', 'good', `已完成 ${brandProfiles} 份品牌资料`, bpScore, 50))
  } else if (brandProfiles >= 1) {
    contentDetails.push(makeDetail('品牌资料', 'neutral', `已完成 ${brandProfiles} 份品牌资料，建议补充第二份`, bpScore, 50))
  } else {
    contentDetails.push(makeDetail('品牌资料', 'bad', '尚未创建品牌资料', 0, 50))
  }

  // Brand name bonus
  const nameBonus = settings?.brandName ? 20 : 0
  if (settings?.brandName) {
    contentDetails.push(makeDetail('品牌名称', 'good', '品牌名称为内容质量加20分', nameBonus, 20))
  } else {
    contentDetails.push(makeDetail('品牌名称', 'bad', '缺少品牌名称', 0, 20))
  }

  // Description bonus
  const descBonus = settings?.description ? 15 : 0
  if (settings?.description) {
    contentDetails.push(makeDetail('品牌描述', 'good', '品牌描述提升内容完整度', descBonus, 15))
  } else {
    contentDetails.push(makeDetail('品牌描述', 'bad', '缺少品牌描述', 0, 15))
  }

  // Industry set
  const industryBonus = settings?.industry ? 15 : 0
  if (settings?.industry) {
    contentDetails.push(makeDetail('所属行业', 'good', `行业: ${settings.industry}`, industryBonus, 15))
  } else {
    contentDetails.push(makeDetail('所属行业', 'bad', '未填写所属行业', 0, 15))
  }

  const contentScore = Math.min(100, contentDetails.reduce((s, d) => s + d.points, 0))

  // ── Website (max ~100) ──
  const websiteDetails: ScoreDetailItem[] = []

  const hasWebsite = virtual?.hasWebsiteOverride !== undefined ? virtual.hasWebsiteOverride : !!settings?.website
  const hasFAQ = virtual?.hasFAQOverride !== undefined ? virtual.hasFAQOverride : false
  const hasSchema = virtual?.hasSchemaOverride !== undefined ? virtual.hasSchemaOverride : false

  // Has website URL
  if (hasWebsite) {
    websiteDetails.push(makeDetail('官网链接', 'good', '官网链接已配置', 30, 30))
  } else {
    websiteDetails.push(makeDetail('官网链接', 'bad', '尚未配置官网链接', 0, 30))
  }

  // Website scan
  if (lastScanOk && lastScan?.scanType === 'website' && hasWebsite) {
    websiteDetails.push(makeDetail('官网扫描状态', 'good', '官网扫描完成，信息已提取', 35, 35))
  } else if (hasWebsite) {
    websiteDetails.push(makeDetail('官网扫描状态', 'neutral', '官网扫描进行中', 15, 35))
  } else {
    websiteDetails.push(makeDetail('官网扫描状态', 'bad', '尚未扫描官网', 0, 35))
  }

  // Website content pages / meta
  const webData = settings?.website
    ? await prisma.geoScanHistory.findFirst({
        where: { projectId, scanType: 'website', status: 'completed' },
        select: { result: true },
      })
    : null
  const hasPages = webData?.result && typeof webData.result === 'object' && 'pages' in (webData.result as any) && (webData.result as any).pages > 1
  if (hasPages || (hasWebsite && !settings?.website)) {
    websiteDetails.push(makeDetail('官网内容', 'good', '官网包含多个内容页面', 20, 20))
  } else if (hasWebsite) {
    websiteDetails.push(makeDetail('官网内容', 'neutral', '官网信息待完整提取', 10, 20))
  } else {
    websiteDetails.push(makeDetail('官网内容', 'bad', '无法评估官网内容', 0, 20))
  }

  // Domain authority
  if (hasWebsite) {
    websiteDetails.push(makeDetail('域名信息', 'good', '域名已记录', 15, 15))
  } else {
    websiteDetails.push(makeDetail('域名信息', 'bad', '缺少域名信息', 0, 15))
  }

  const websiteScore = Math.min(100, websiteDetails.reduce((s, d) => s + d.points, 0))

  // ── Knowledge (max ~100) ──
  const knowledgeDetails: ScoreDetailItem[] = []

  // FAQ bonus
  if (hasFAQ) {
    knowledgeDetails.push(makeDetail('FAQ 内容', 'good', 'FAQ 内容已就绪', 10, 0))
  }

  // Schema markup bonus
  if (hasSchema) {
    knowledgeDetails.push(makeDetail('Schema 标记', 'good', '结构化数据标记已就绪', 10, 0))
  }
  const koScore = Math.min(60, effectiveKnowledgeCount * 10)
  if (effectiveKnowledgeCount >= 6) {
    knowledgeDetails.push(makeDetail('知识条目', 'good', `已有 ${effectiveKnowledgeCount} 条知识，内容丰富`, koScore, 60))
  } else if (effectiveKnowledgeCount >= 1) {
    knowledgeDetails.push(makeDetail('知识条目', 'neutral', `已有 ${effectiveKnowledgeCount} 条知识，建议达到 6 条以上`, koScore, 60))
  } else {
    knowledgeDetails.push(makeDetail('知识条目', 'bad', '暂无知识条目', 0, 60))
  }

  // Knowledge topics diversity
  const distinctTopics = knowledgeCount > 0
    ? await prisma.knowledgeObject.findMany({
        where: { projectId },
        select: { topic: true },
        distinct: ['topic'],
      })
    : []
  const topicCount = distinctTopics.length
  const effectiveTopicCount = topicCount + (virtual?.virtualKnowledge && virtual.virtualKnowledge > 0 ? Math.min(virtual.virtualKnowledge, 4) : 0)
  const topicScore = Math.min(20, effectiveTopicCount * 5)
  if (effectiveTopicCount >= 4) {
    knowledgeDetails.push(makeDetail('知识多样性', 'good', `涵盖 ${effectiveTopicCount} 个不同主题`, topicScore, 20))
  } else if (effectiveTopicCount >= 1) {
    knowledgeDetails.push(makeDetail('知识多样性', 'neutral', `涵盖 ${effectiveTopicCount} 个主题，建议覆盖 4 个以上`, topicScore, 20))
  } else {
    knowledgeDetails.push(makeDetail('知识多样性', 'bad', '暂无主题归类', 0, 20))
  }

  // Knowledge quality (if confidence scores exist)
  const highConfidence = knowledgeCount > 0
    ? await prisma.knowledgeObject.findMany({
        where: { projectId, qualityScore: { gte: 0.7 } },
        select: { id: true },
      })
    : []
  const highConfCount = highConfidence.length
  const effectiveHighConfCount = highConfCount + (virtual?.virtualKnowledge ? Math.round(virtual.virtualKnowledge * 0.8) : 0)
  const effectiveKC = effectiveKnowledgeCount
  if (effectiveKC > 0) {
    const qualityRatio = effectiveKC > 0 ? effectiveHighConfCount / effectiveKC : 0
    const qualityPts = Math.min(20, Math.round(qualityRatio * 20))
    if (qualityRatio >= 0.7) {
      knowledgeDetails.push(makeDetail('知识质量', 'good', `高质量知识占比 ${Math.round(qualityRatio * 100)}%`, qualityPts, 20))
    } else if (qualityRatio >= 0.3) {
      knowledgeDetails.push(makeDetail('知识质量', 'neutral', `高质量知识占比 ${Math.round(qualityRatio * 100)}%，建议提升至 70% 以上`, qualityPts, 20))
    } else {
      knowledgeDetails.push(makeDetail('知识质量', 'bad', `高质量知识占比仅 ${Math.round(qualityRatio * 100)}%`, qualityPts, 20))
    }
  } else {
    knowledgeDetails.push(makeDetail('知识质量', 'bad', '暂无知识数据', 0, 20))
  }

  const knowledgeScore = Math.min(100, knowledgeDetails.reduce((s, d) => s + d.points, 0))

  // ── Overall ──
  const overall = Math.round((visibilityScore + authorityScore + contentScore + websiteScore + knowledgeScore) / 5)

  // ── Auto-save snapshot ──
  await saveSnapshot(projectId, { overall, visibility: visibilityScore, authority: authorityScore, content: contentScore, website: websiteScore, knowledge: knowledgeScore })

  return {
    overall,
    breakdown: {
      visibility: { score: visibilityScore, details: visibilityDetails },
      authority: { score: authorityScore, details: authorityDetails },
      content: { score: contentScore, details: contentDetails },
      website: { score: websiteScore, details: websiteDetails },
      knowledge: { score: knowledgeScore, details: knowledgeDetails },
    },
  }
}

/**
 * Save a GeoScoreSnapshot for timeline tracking
 */
async function saveSnapshot(projectId: string, scores: Record<string, number>): Promise<void> {
  try {
    await prisma.gEOScoreSnapshot.create({
      data: {
        projectId,
        snapshot: scores,
        scores: scores,
      },
    })
  } catch {
    // Silently fail — snapshots are non-critical
  }
}

/**
 * Quick score variant for callers that only need the numeric totals (non-breakdown).
 * Used by services that imported the old ScoreResult interface.
 */
export async function calculateScoreSimple(projectId: string): Promise<{
  overall: number
  visibility: number
  authority: number
  content: number
  website: number
  knowledge: number
}> {
  const full = await calculateScore(projectId)
  return {
    overall: full.overall,
    visibility: full.breakdown.visibility.score,
    authority: full.breakdown.authority.score,
    content: full.breakdown.content.score,
    website: full.breakdown.website.score,
    knowledge: full.breakdown.knowledge.score,
  }
}
