// ─── CareerProfile Service ─────────────────────────
// 数据访问层：CareerProfile 的 upsert + derived insights

import { prisma } from '../../utils/index.js'
import crypto from 'crypto'

interface DerivedInsightEntry {
  field: string
  value: unknown
  confidence: number
  evidence: string
  createdAt: Date
}

export class CareerProfileService {
  constructor() {}

  /**
   * 创建或更新 CareerProfile（只写入允许的字段）
   */
  async upsert(userId: string, data: Record<string, unknown>): Promise<void> {
    const safeData = this.sanitizeWriteData(data)

    if (Object.keys(safeData).length === 0) return

    const existing = await prisma.careerProfile.findUnique({
      where: { userId },
    })

    if (existing) {
      await prisma.careerProfile.update({
        where: { id: existing.id },
        data: {
          ...safeData,
          lastActiveAt: new Date(),
        } as any,
      })
    } else {
      await prisma.careerProfile.create({
        data: {
          userId,
          candidateId: crypto.randomUUID(),
          fullName: (safeData.fullName as string) || '用户',
          ...safeData,
          lastActiveAt: new Date(),
        } as any,
      })
    }
  }

  /**
   * 追加 Derived Insights（写入 metadata JSON 或独立表）
   */
  async appendInsights(userId: string, insights: DerivedInsightEntry[]): Promise<void> {
    const existing = await prisma.careerProfile.findUnique({
      where: { userId },
    })

    if (!existing) return

    const insightSummary = insights.map(i =>
      `[${i.field}=${i.value} (${i.confidence}%)]`
    ).join(' ')

    const currentText = existing.headline || existing.bio || ''
    const insightNote = `\n📋AI推断: ${insightSummary}`
    if (!currentText.includes(insightNote)) {
      await prisma.careerProfile.update({
        where: { id: existing.id },
        data: {
          headline: currentText + insightNote,
          lastActiveAt: new Date(),
        },
      })
    }

    console.log(`[CareerProfile] DerivedInsights saved for ${userId}:`, insightSummary)
  }

  /**
   * 只保留 CareerProfile 模型允许的字段
   */
  private sanitizeWriteData(data: Record<string, unknown>): Record<string, unknown> {
    const allowedFields = [
      'fullName', 'headline', 'bio', 'city',
      'careerDirection', 'industry', 'yearsExperience',
      'currentLevel', 'email', 'phone', 'avatarUrl',
    ]
    const result: Record<string, unknown> = {}
    for (const key of Object.keys(data)) {
      if (allowedFields.includes(key)) {
        result[key] = data[key]
      }
    }
    if (data._skills) {
      console.log('[CareerProfile] skills write deferred (needs CandidateSkill table)')
    }
    if (data._workHistory) {
      console.log('[CareerProfile] workHistory write deferred (needs WorkExperience table)')
    }
    if (data._education) {
      console.log('[CareerProfile] education write deferred (needs Education table)')
    }
    return result
  }
}
