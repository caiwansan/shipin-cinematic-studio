// GEO Workspace Runtime — GEOScanJob lifecycle + BrandSnapshot writer
// 管理扫描任务生命周期，并在完成后写入品牌快照及推进工作流

import { prisma } from '../../utils/index.js'

/**
 * 创建 GEOScanJob 记录，并将项目工作流推进至 DISCOVERING
 */
export async function createScanJob(
  projectId: string,
  userId: string
): Promise<string> {
  // 1. 创建 GEOScanJob 记录
  const job = await prisma.gEOScanJob.create({
    data: {
      projectId,
      status: 'RUNNING',
      startedAt: new Date(),
    },
  })

  // 2. 推进工作流至 DISCOVERING
  await prisma.gEOWorkflowState.upsert({
    where: { projectId },
    create: {
      projectId,
      stage: 'DISCOVERING',
      completedStages: '[]',
      availableActions: '[]',
    },
    update: {
      stage: 'DISCOVERING',
      availableActions: '[]',
    },
  })

  return job.id
}

/**
 * 根据 gEOScanRecord 的 scanId，完成对应的 GEOScanJob
 * - 标记 job 为 COMPLETED
 * - 写入 BrandSnapshot
 * - 推进工作流至 UNDERSTANDING
 */
export async function completeScanJobFromRecord(scanId: string): Promise<void> {
  // 1. 获取扫描记录
  const record = await prisma.gEOScanRecord.findUnique({
    where: { id: scanId },
  })
  if (!record) {
    console.error(`[ScanJob] gEOScanRecord not found: ${scanId}`)
    return
  }

  // 2. 查找项目最新 RUNNING 状态的 GEOScanJob
  const job = await prisma.gEOScanJob.findFirst({
    where: {
      projectId: record.projectId,
      status: 'RUNNING',
    },
    orderBy: { createdAt: 'desc' },
  })
  if (!job) {
    // 没有 GEOScanJob 时静默跳过（兼容旧版流程）
    return
  }

  // 3. 组装扫描结果
  const aiResponses = (record.aiResponses as any[]) || []
  const optimizationItems = (record.optimizationItems as any[]) || []

  const scanResult = {
    visibilityScore: record.visibilityScore || 0,
    accuracyScore: record.accuracyScore || 0,
    consistencyScore: record.consistencyScore || 0,
    recommendationScore: record.recommendationScore || 0,
    overallScore: record.overallScore || 0,
    aiResponses,
    optimizationItems,
  }

  // 4. 标记 job 为 COMPLETED
  await prisma.gEOScanJob.update({
    where: { id: job.id },
    data: {
      status: 'COMPLETED',
      completedAt: new Date(),
      result: scanResult,
    },
  })

  // 5. 写入 BrandSnapshot
  await saveBrandSnapshot(record.projectId, scanResult)

  // 6. 推进工作流至 UNDERSTANDING
  await prisma.gEOWorkflowState.update({
    where: { projectId: record.projectId },
    data: {
      stage: 'UNDERSTANDING',
      completedStages: JSON.stringify(['DISCOVERING']),
      availableActions: JSON.stringify(['VIEW_KNOWLEDGE', 'GENERATE_RECOMMENDATIONS']),
    },
  })
}

/**
 * 根据 gEOScanRecord 的 scanId，标记对应 GEOScanJob 为 FAILED
 */
export async function failScanJobFromRecord(
  scanId: string,
  errorMessage: string
): Promise<void> {
  const record = await prisma.gEOScanRecord.findUnique({
    where: { id: scanId },
  })
  if (!record) {
    console.error(`[ScanJob] gEOScanRecord not found: ${scanId}`)
    return
  }

  const job = await prisma.gEOScanJob.findFirst({
    where: {
      projectId: record.projectId,
      status: 'RUNNING',
    },
    orderBy: { createdAt: 'desc' },
  })
  if (!job) return

  await prisma.gEOScanJob.update({
    where: { id: job.id },
    data: {
      status: 'FAILED',
      completedAt: new Date(),
      result: { error: errorMessage },
    },
  })
}

/**
 * 写入/更新 BrandSnapshot
 * 将扫描结果映射为品牌快照的各维度 JSON
 */
export async function saveBrandSnapshot(
  projectId: string,
  scanResult: {
    visibilityScore: number
    accuracyScore: number
    consistencyScore: number
    recommendationScore: number
    overallScore: number
    aiResponses: any[]
    optimizationItems: any[]
  }
): Promise<void> {
  const aiResponses = scanResult.aiResponses || []
  const optimizationItems = scanResult.optimizationItems || []

  // visibility 维度：各 AI 模型的品牌认知度
  const visibility = {
    score: scanResult.visibilityScore,
    items: aiResponses.map((r: any) => ({
      model: r.model,
      recognizes: r.response?.recognizes ?? false,
      description: r.response?.description || '',
      mentionsKeywords: r.response?.mentionsKeywords || [],
    })),
  }

  // citation 维度：各模型的事实准确性
  const citation = {
    score: scanResult.accuracyScore,
    items: aiResponses.map((r: any) => ({
      model: r.model,
      accuracy: r.response?.accuracy || 'inaccurate',
      facts: r.response?.facts || [],
    })),
  }

  // knowledge 维度：品牌知识覆盖度
  const knowledge = {
    score: scanResult.consistencyScore,
    items: aiResponses.map((r: any) => ({
      model: r.model,
      website: r.response?.website || '',
      factualConsistency: r.response?.accuracy === 'accurate' ? 'high' : r.response?.accuracy === 'partial' ? 'medium' : 'low',
      entityRecognition: r.response?.recognizes ? 'detected' : 'not_detected',
    })),
  }

  // discovery 维度：优化建议和竞品洞察
  const discovery = {
    items: optimizationItems.map((i: any) => ({
      dimension: i.dimension,
      description: i.description,
      suggestion: i.suggestion,
    })),
    recommendationScore: scanResult.recommendationScore,
  }

  await prisma.brandSnapshot.upsert({
    where: { projectId },
    create: {
      projectId,
      visibility,
      citation,
      knowledge,
      discovery,
    },
    update: {
      visibility,
      citation,
      knowledge,
      discovery,
    },
  })
}

// ─── Query Helpers ───

export async function getScanJob(jobId: string) {
  return prisma.gEOScanJob.findUnique({ where: { id: jobId } })
}

export async function getLatestScanJob(projectId: string) {
  return prisma.gEOScanJob.findFirst({
    where: { projectId, status: 'COMPLETED' },
    orderBy: { createdAt: 'desc' },
  })
}

export async function getBrandSnapshot(projectId: string) {
  return prisma.brandSnapshot.findUnique({ where: { projectId } })
}
