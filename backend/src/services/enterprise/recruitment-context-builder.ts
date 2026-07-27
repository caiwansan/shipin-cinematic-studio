/**
 * RecruitmentContextBuilder — 构建结构化招聘上下文
 *
 * 职责：从数据库读取真实招聘数据，组装为 LLM 可消费的上下文
 *
 * 架构约束：
 *   - 不直接暴露 Prisma 模型给 Agent
 *   - 输出结构化 JSON，附带数据来源标记
 *   - 按 tenantId/workspaceId 严格隔离
 */

import type { PrismaClient } from '@prisma/client'

export interface RecruitmentContext {
  tenantId: string
  generatedAt: string
  dataSources: string[]
  jobs: JobContext[]
  matches: MatchContext[]
  pipeline: PipelineContext
  interviews: InterviewContext
  reviews: ReviewContext
}

export interface JobContext {
  id: string
  title: string
  status: string
  salary?: string
  location?: string
  createdAt: string
  source: 'JobPosting'
}

export interface MatchContext {
  id: string
  jobTitle: string
  candidateName: string
  score: number
  status: string
  source: 'CandidateMatch'
}

export interface PipelineContext {
  total: number
  byStage: Record<string, number>
  recentActivity: PipelineItem[]
  source: 'RecruitmentPipeline'
}

export interface PipelineItem {
  id: string
  candidateName: string
  jobTitle: string
  stage: string
  lastActivityAt: string
}

export interface InterviewContext {
  total: number
  byStatus: Record<string, number>
  source: 'InterviewSession'
}

export interface ReviewContext {
  pending: number
  items: ReviewItem[]
  source: 'HumanReviewItem'
}

export interface ReviewItem {
  id: string
  candidateName?: string
  jobTitle?: string
  priority: number
  aiRecommendation: string
}

export class RecruitmentContextBuilder {
  constructor(private prisma: PrismaClient) {}

  /**
   * 构建指定租户的招聘上下文
   *
   * @param tenantId 租户 ID（来自 Tenant Guard）
   */
  async build(tenantId: string): Promise<RecruitmentContext> {
    const p = this.prisma as any
    const dataSources: string[] = []

    // ── 0. 解析 tenantId → enterpriseId ───────────────
    // 先尝试直接用 tenantId 作为 enterpriseId
    let enterpriseId = tenantId
    let workspaces = await p.enterpriseJobWorkspace.findMany({
      where: { enterpriseId },
      select: { id: true },
    })

    // 如果没找到 workspace，尝试通过 organizationId 关联
    if (workspaces.length === 0) {
      const profile = await p.enterpriseProfile.findFirst({
        where: { organizationId: tenantId },
        select: { id: true },
      })
      if (profile) {
        enterpriseId = profile.id
        workspaces = await p.enterpriseJobWorkspace.findMany({
          where: { enterpriseId: profile.id },
          select: { id: true },
        })
      }
    }

    const workspaceIds = workspaces.map((w: any) => w.id)

    // 如果该 tenant 没有 workspace，尝试通过 enterprise 关联
    let jobPostings: any[] = []
    if (workspaceIds.length > 0) {
      jobPostings = await p.jobPosting.findMany({
        where: { enterpriseId },
        select: {
          id: true,
          title: true,
          status: true,
          salary: true,
          location: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      })
    }

    const jobs: JobContext[] = jobPostings.map((j: any) => ({
      id: j.id,
      title: j.title,
      status: j.status,
      salary: j.salary || undefined,
      location: j.location || undefined,
      createdAt: j.createdAt?.toISOString() || '',
      source: 'JobPosting' as const,
    }))
    if (jobs.length > 0) dataSources.push(`JobPosting:${jobs.length}`)

    // ── 2. 候选人匹配 ────────────────────────────────────
    const matches = await p.candidateMatch.findMany({
      where: { workspaceId: { in: workspaceIds } },
      select: {
        id: true,
        matchScore: true,
        status: true,
        job: { select: { title: true } },
        candidate: {
          select: {
            id: true,
            profileJson: true,
            user: { select: { username: true, email: true } },
          },
        },
      },
      orderBy: { matchScore: 'desc' },
      take: 50,
    })

    const matchContexts: MatchContext[] = matches.map((m: any) => {
      const profile = m.candidate?.profileJson as any
      const candidateName =
        profile?.name ||
        profile?.fullName ||
        m.candidate?.user?.username ||
        m.candidate?.user?.email ||
        '未知候选人'
      return {
        id: m.id,
        jobTitle: m.job?.title || '未知岗位',
        candidateName,
        score: m.matchScore || 0,
        status: m.status,
        source: 'CandidateMatch' as const,
      }
    })
    if (matchContexts.length > 0) dataSources.push(`CandidateMatch:${matchContexts.length}`)

    // ── 3. Pipeline ──────────────────────────────────────
    const pipelines = await p.recruitmentPipeline.findMany({
      where: { workspaceId: { in: workspaceIds } },
      select: {
        id: true,
        candidateName: true,
        stage: true,
        lastActivityAt: true,
        job: { select: { title: true } },
      },
      orderBy: { lastActivityAt: 'desc' },
      take: 50,
    })

    const byStage: Record<string, number> = {}
    for (const pl of pipelines) {
      byStage[pl.stage] = (byStage[pl.stage] || 0) + 1
    }

    const pipeline: PipelineContext = {
      total: pipelines.length,
      byStage,
      recentActivity: pipelines.slice(0, 10).map((pl: any) => ({
        id: pl.id,
        candidateName: pl.candidateName,
        jobTitle: pl.job?.title || '未知岗位',
        stage: pl.stage,
        lastActivityAt: pl.lastActivityAt?.toISOString() || '',
      })),
      source: 'RecruitmentPipeline',
    }
    if (pipeline.total > 0) dataSources.push(`RecruitmentPipeline:${pipeline.total}`)

    // ── 4. 面试 ──────────────────────────────────────────
    const interviews = await p.interviewSession.findMany({
      where: { workspaceId: { in: workspaceIds } },
      select: { id: true, status: true },
    })

    const byStatus: Record<string, number> = {}
    for (const iv of interviews) {
      byStatus[iv.status] = (byStatus[iv.status] || 0) + 1
    }

    const interviewContext: InterviewContext = {
      total: interviews.length,
      byStatus,
      source: 'InterviewSession',
    }
    if (interviewContext.total > 0) dataSources.push(`InterviewSession:${interviewContext.total}`)

    // ── 5. HR 审核 ───────────────────────────────────────
    const reviewItems = await p.humanReviewItem.findMany({
      where: {
        workspaceId: { in: workspaceIds },
        status: 'pending',
      },
      select: {
        id: true,
        candidateName: true,
        jobTitle: true,
        priority: true,
        aiRecommendation: true,
      },
      orderBy: { priority: 'desc' },
      take: 20,
    })

    const reviews: ReviewContext = {
      pending: reviewItems.length,
      items: reviewItems.map((r: any) => ({
        id: r.id,
        candidateName: r.candidateName || undefined,
        jobTitle: r.jobTitle || undefined,
        priority: r.priority,
        aiRecommendation: r.aiRecommendation,
      })),
      source: 'HumanReviewItem',
    }
    if (reviews.pending > 0) dataSources.push(`HumanReviewItem:${reviews.pending}`)

    return {
      tenantId,
      generatedAt: new Date().toISOString(),
      dataSources,
      jobs,
      matches: matchContexts,
      pipeline,
      interviews: interviewContext,
      reviews,
    }
  }

  /**
   * 根据 tenantId 获取关联的 enterpriseId
   */
  private async getEnterpriseIdByTenant(p: any, tenantId: string): Promise<string> {
    const profile = await p.enterpriseProfile.findFirst({
      where: { tenantId },
      select: { organizationId: true, id: true },
    })
    return profile?.organizationId || profile?.id || tenantId
  }
}
