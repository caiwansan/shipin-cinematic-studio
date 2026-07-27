/**
 * job.repository.ts — JobPosting 数据访问层
 *
 * AR-01 Phase 1: Infrastructure
 * DP-5: Repository 只负责数据访问，不负责业务组装。
 */

import { prisma } from '../../utils/index.js'

export interface JobQueryOptions {
  tenantId?: string
  enterpriseId?: string
  status?: string
  keyword?: string
  skip: number
  take: number
}

export const jobRepository = {
  /**
   * 分页查询岗位列表（支持搜索、筛选）
   */
  async findMany(options: JobQueryOptions) {
    const where: Record<string, unknown> = {}
    if (options.tenantId) where.enterpriseId = options.tenantId
    if (options.enterpriseId) where.enterpriseId = options.enterpriseId
    if (options.status) where.status = options.status
    if (options.keyword) {
      where.OR = [
        { title: { contains: options.keyword, mode: 'insensitive' as any } },
        { description: { contains: options.keyword, mode: 'insensitive' as any } },
        { location: { contains: options.keyword, mode: 'insensitive' as any } },
      ]
    }

    const [rows, total] = await Promise.all([
      prisma.jobPosting.findMany({
        where,
        skip: options.skip,
        take: options.take,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          title: true,
          description: true,
          location: true,
          department: true,
          status: true,
          requiredSkills: true,
          experienceMin: true,
          experienceMax: true,
          salaryMin: true,
          salaryMax: true,
          createdAt: true,
          updatedAt: true,
          enterprise: { select: { id: true, name: true } },
          _count: { select: { candidateMatches: true, pipelineSteps: true, interviewSessions: true } },
        },
      }),
      prisma.jobPosting.count({ where }),
    ])

    return { rows, total }
  },

  /**
   * 获取岗位详情（含关联数据）
   */
  async findById(id: string) {
    return prisma.jobPosting.findUnique({
      where: { id },
      include: {
        enterprise: { select: { id: true, name: true } },
        _count: { select: { candidateMatches: true, pipelineSteps: true, interviewSessions: true } },
      },
    })
  },

  /**
   * 更新岗位状态
   */
  async updateStatus(id: string, status: string) {
    return prisma.jobPosting.update({
      where: { id },
      data: { status },
      select: { id: true, title: true, status: true },
    })
  },

  /**
   * 获取所有企业列表（用于筛选）
   */
  async findEnterprises() {
    const enterprises = await prisma.enterprise.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    })
    return enterprises
  },
}
