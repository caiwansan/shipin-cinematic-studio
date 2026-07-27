/**
 * conversation.repository.ts — RecruitmentConversation 数据访问层
 *
 * AR-01 Phase 3: Relationship Domain
 * DP-5: Repository 只负责数据访问，不负责业务组装。
 *
 * ⚠️ RecruitmentConversation.candidateId 是手动关联（无 @relation），
 *    因此 Candidate 信息需要二次查询。Repository 负责执行查询，
 *    Mapper 负责组装 DTO。
 *
 * 数据路径（已验证）：
 *   Conversation.candidateId → JobCandidate.id（手动，无 @relation）
 *   JobCandidate.profileJson.name → Candidate Name 快照
 *   JobCandidate.userId → User.id（有 @relation）
 *   User.email → Candidate Email
 *
 * 注意：candidateId 可能为 null（现有数据确实为 null），
 *       Mapper 必须正确处理 null → DTO 字段返回 null。
 */

import { prisma } from '../../utils/index.js'

export interface ConversationQueryOptions {
  workspaceId?: string
  enterpriseId?: string
  status?: string
  keyword?: string
  sortBy?: string
  skip: number
  take: number
}

export interface ConversationRow {
  id: string
  workspaceId: string
  enterpriseId: string
  jobPostingId: string | null
  candidateId: string | null
  recruiterAgentId: string
  status: string
  stage: string
  matchScore: number | null
  createdAt: Date
  updatedAt: Date
  jobPosting: { title: string } | null
  /** 手动关联结果 */
  candidateName: string | null
  candidateEmail: string | null
}

export const conversationRepository = {
  /**
   * 分页查询对话列表
   *
   * 三次查询：
   *   1. RecruitmentConversation.findMany() — 对话列表
   *   2. JobCandidate.findMany() — 通过 candidateId 批量获取
   *   3. User.findMany() — 通过 userId 批量获取 email
   *
   * Repository 执行所有查询 + 内存组装。Mapper 只做字段映射。
   */
  async findMany(options: ConversationQueryOptions): Promise<{ rows: ConversationRow[], total: number }> {
    const where: Record<string, unknown> = {}
    if (options.workspaceId) where.workspaceId = options.workspaceId
    if (options.enterpriseId) where.enterpriseId = options.enterpriseId
    if (options.status) where.status = options.status

    const [conversations, total] = await Promise.all([
      prisma.recruitmentConversation.findMany({
        where,
        skip: options.skip,
        take: options.take,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          workspaceId: true,
          enterpriseId: true,
          jobPostingId: true,
          candidateId: true,
          recruiterAgentId: true,
          status: true,
          stage: true,
          matchScore: true,
          createdAt: true,
          updatedAt: true,
          jobPosting: { select: { title: true } },
        },
      }),
      prisma.recruitmentConversation.count({ where }),
    ])

    // 手动关联 Step 1: candidateId → JobCandidate
    const candidateIds = conversations
      .map(c => c.candidateId)
      .filter((id): id is string => id != null)

    const candidates = candidateIds.length > 0
      ? await prisma.jobCandidate.findMany({
          where: { id: { in: candidateIds } },
          select: { id: true, userId: true, profileJson: true },
        })
      : []

    const candidateMap = new Map(candidates.map(c => [c.id, c]))

    // 手动关联 Step 2: userId → User.email
    const userIds = candidates
      .map(c => c.userId)
      .filter((id): id is string => id != null)

    const users = userIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, email: true },
        })
      : []

    const userMap = new Map(users.map(u => [u.id, u]))

    // 内存组装：Conversation + Candidate + User → ConversationRow
    const rows: ConversationRow[] = conversations.map(conv => {
      const candidate = conv.candidateId ? candidateMap.get(conv.candidateId) : undefined
      const user = candidate?.userId ? userMap.get(candidate.userId) : undefined

      // Candidate Name: profileJson.name 快照（DP-1: Candidate Identity 的 name 来源）
      const profileName = candidate?.profileJson != null && typeof candidate.profileJson === 'object'
        ? (candidate.profileJson as Record<string, unknown>).name as string | undefined ?? null
        : null

      // Candidate Email: 从 User.email 获取（JobCandidate.userId → User @relation）
      const userEmail = user?.email ?? null

      return {
        id: conv.id,
        workspaceId: conv.workspaceId,
        enterpriseId: conv.enterpriseId,
        jobPostingId: conv.jobPostingId,
        candidateId: conv.candidateId,
        recruiterAgentId: conv.recruiterAgentId,
        status: conv.status,
        stage: conv.stage,
        matchScore: conv.matchScore,
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt,
        jobPosting: conv.jobPosting,
        candidateName: profileName,
        candidateEmail: userEmail,
      }
    })

    return { rows, total }
  },
}
