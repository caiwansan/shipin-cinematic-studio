// @ts-nocheck
// ============================================================
// 📦 Prompt Memory — 提示词记忆库
//
// 职责：记录每次生成用的 prompt 及执行结果
// 目的：系统逐渐知道什么 prompt 更稳定、更高质量、更低成本
// ============================================================

import { prisma } from '../../utils/index.js'

export interface PromptRecord {
  id?: string
  userId: string
  prompt: string
  optimizedPrompt: string
  provider: string
  modelName: string
  taskType: 'image' | 'video'
  style?: string
  mode?: string
  qualityScore?: number
  consistencyScore?: number
  realismScore?: number
  renderTimeMs: number
  cost: number
  success: boolean
  failureReason?: string
  feedback?: 'approve' | 'reject' | 'neutral'
}

export const promptMemory = {
  /**
   * 记录一次 prompt 执行
   */
  async record(data: PromptRecord) {
    return await prisma.promptMemory.create({ data })
  },

  /**
   * 查询类似 prompt 的历史表现
   */
  async findSimilar(rawPrompt: string, taskType: string, limit: number = 5) {
    // 先用关键词匹配找相似记录
    const keywords = rawPrompt
      .replace(/[^\w\u4e00-\u9fa5\s]/g, '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 10)

    if (keywords.length === 0) return []

    const records = await prisma.promptMemory.findMany({
      where: {
        taskType,
        success: true,
        OR: keywords.map(kw => ({
          prompt: { contains: kw },
        })),
      },
      orderBy: [{ qualityScore: 'desc' }, { createdAt: 'desc' }],
      take: limit,
    })

    return records
  },

  /**
   * 获取某个用户的 best prompt 模板
   */
  async getUserBest(userId: string, taskType: string, style?: string) {
    const where: any = {
      userId,
      taskType,
      success: true,
      qualityScore: { not: null },
    }
    if (style && style !== '无') where.style = style

    return await prisma.promptMemory.findFirst({
      where,
      orderBy: { qualityScore: 'desc' },
    })
  },

  /**
   * 分析某个 provider 的成功率
   */
  async getProviderStats(provider: string, taskType: string) {
    const total = await prisma.promptMemory.count({ where: { provider, taskType } })
    const success = await prisma.promptMemory.count({ where: { provider, taskType, success: true } })
    const avgQuality = await prisma.promptMemory.aggregate({
      where: { provider, taskType, qualityScore: { not: null } },
      _avg: { qualityScore: true },
    })

    return {
      total,
      successRate: total > 0 ? success / total : 0,
      avgQualityScore: avgQuality._avg.qualityScore ?? 0,
    }
  },
}
