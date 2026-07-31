// ─── Sprint-09E-04 Task 02: CareerActionProgress Service ─────
//
// 所有操作遵循：
//   AI 不自动修改状态（用户确认才 completed）
//   用户反馈 → 状态更新 → 影响下一次规划

import { prisma } from '../../utils/index.js'

export interface ActionProgressCreateInput {
  userId: string
  actionId: string
  actionTitle: string
  phase: string
}

export interface ActionProgressUpdateInput {
  status?: 'pending' | 'doing' | 'completed' | 'rejected'
  evidence?: string
  feedback?: string
  alternativePath?: string
}

/**
 * 创建一组行动进度记录
 */
export async function createActionProgressBatch(
  userId: string,
  actions: ActionProgressCreateInput[],
) {
  const records = actions.map((a) => ({
    userId,
    actionId: a.actionId,
    actionTitle: a.actionTitle,
    phase: a.phase,
  }))

  return await Promise.all(
    records.map((r) =>
      prisma.careerActionProgress.create({ data: r }),
    ),
  )
}

/**
 * 获取用户的行动进度列表
 */
export async function getUserActionProgress(userId: string) {
  return await prisma.careerActionProgress.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' },
  })
}

/**
 * 更新行动进度
 *
 * ⚠️ 规则：
 * - AI 不能自动设置 status=completed（但可以设置 doing 或 pending）
 * - completed 只能由用户确认
 * - rejected 用于用户拒绝某个行动
 */
export async function updateActionProgress(
  id: string,
  userId: string,
  input: ActionProgressUpdateInput,
) {
  // 验证记录属于该用户
  const existing = await prisma.careerActionProgress.findUnique({
    where: { id },
  })
  if (!existing || existing.userId !== userId) {
    throw new Error('ACTION_NOT_FOUND')
  }

  return await prisma.careerActionProgress.update({
    where: { id },
    data: {
      ...(input.status && { status: input.status }),
      ...(input.evidence !== undefined && { evidence: input.evidence }),
      ...(input.feedback !== undefined && { feedback: input.feedback }),
      ...(input.alternativePath !== undefined && {
        alternativePath: input.alternativePath,
      }),
    },
  })
}

/**
 * 根据反馈更新技能和上下文
 *
 * 用户完成某个学习行动后，技能状态应更新
 * 用户拒绝某个方向后，下次规划应调整
 */
export async function processFeedback(
  userId: string,
  actionId: string,
  feedback: string,
  status: 'doing' | 'completed' | 'rejected',
  alternativePath?: string,
) {
  // 1. 更新 action progress
  const records = await prisma.careerActionProgress.findMany({
    where: { userId, actionId },
  })
  if (records.length === 0) {
    throw new Error('ACTION_NOT_FOUND')
  }

  const record = records[0]
  await updateActionProgress(record.id, userId, {
    status,
    feedback,
    alternativePath,
  })

  // 2. 如果是 completed，且有关联技能，更新 CandidateSkill
  if (
    status === 'completed' &&
    record.actionTitle
  ) {
    // 尝试从 action title 提取技能名称（简单启发式）
    const skillMatch = record.actionTitle.match(
      /^(掌握|学习|提升)\s+(.+?)(?:[—\-]|基础)/,
    )
    if (skillMatch) {
      const skillName = skillMatch[2].trim()
      // 检查是否已有该技能
      const existingSkill = await prisma.candidateSkill.findFirst({
        where: { userId, name: skillName },
      })
      if (!existingSkill) {
        await prisma.candidateSkill.create({
          data: {
            userId,
            name: skillName,
            level: 'beginner',
            source: 'career_action_feedback',
            confidence: 0.7,
          },
        })
      } else if (existingSkill.level === 'beginner') {
        // 如果有初级技能，完成行动 → 升级
        await prisma.candidateSkill.update({
          where: { id: existingSkill.id },
          data: { level: 'intermediate', confidence: 0.8 },
        })
      }
    }
  }

  return { feedback, status, alternativePath }
}
