/**
 * interview.repository.ts — 面试数据访问层（UX-03C 扩展）
 *
 * 扩展：加入评估详情字段（strengths, risks, summary, 维度分数）
 * 支持"面试决策中心"产品需求
 */

import { prisma } from '../../utils/index.js'

export interface InterviewListQuery {
  page: number
  pageSize: number
  status?: string
}

export interface InterviewRawData {
  id: string
  candidateName: string
  jobTitle: string
  status: string
  overallScore: number | null
  recommendation: string | null
  technicalScore: number | null
  communicationScore: number | null
  cultureScore: number | null
  strengths: string[] | null
  risks: string[] | null
  summary: string | null
  createdAt: Date
}

export const interviewRepository = {
  async findList(query: InterviewListQuery): Promise<{ list: InterviewRawData[]; total: number }> {
    const { page, pageSize, status } = query
    const skip = (page - 1) * pageSize

    const where: Record<string, unknown> = {}
    if (status) where.status = status

    const [sessions, total] = await Promise.all([
      prisma.interviewSession.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          candidateName: true,
          jobId: true,
          status: true,
          createdAt: true,
          job: { select: { title: true } },
          evaluation: {
            select: {
              overallScore: true,
              recommendation: true,
              technicalScore: true,
              communicationScore: true,
              cultureScore: true,
              strengths: true,
              risks: true,
              summary: true,
            },
          },
        },
      }),
      prisma.interviewSession.count({ where }),
    ])

    const list: InterviewRawData[] = sessions.map((s) => ({
      id: s.id,
      candidateName: s.candidateName,
      jobTitle: s.job?.title || '未知职位',
      status: s.status,
      overallScore: s.evaluation?.overallScore ?? null,
      recommendation: s.evaluation?.recommendation ?? null,
      technicalScore: s.evaluation?.technicalScore ?? null,
      communicationScore: s.evaluation?.communicationScore ?? null,
      cultureScore: s.evaluation?.cultureScore ?? null,
      strengths: s.evaluation?.strengths ?? null,
      risks: s.evaluation?.risks ?? null,
      summary: s.evaluation?.summary ?? null,
      createdAt: s.createdAt,
    }))

    return { list, total }
  },
}
