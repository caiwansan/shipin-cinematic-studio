// ─── Sprint-09E-02 Task 03.3 Career Confirmation Routes ─────
// 用户确认/修改/拒绝 AI 提取的职业字段

import { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'
import { pendingConfirmations } from '../services/career/career-confirmation.service.js'
import { extractResumeSafeData } from '../services/career/resume-safety-gate.js'

export const careerConfirmationRoutes = async (fastify: FastifyInstance) => {
  // ─── GET /api/career/pending — 查看待确认的字段 ───
  fastify.get('/api/career/pending', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const userId = (request as any).user?.id || (request as any).userId
    const pending = pendingConfirmations.get(userId)

    if (!pending || pending.pendingSuggestions.length === 0) {
      return reply.send({
        hasPending: false,
        confirmed: pending?.confirmedFields || [],
        pending: [],
      })
    }

    return reply.send({
      hasPending: true,
      confirmed: pending.confirmedFields,
      pending: pending.pendingSuggestions.map(f => ({
        field: f.field,
        value: f.value,
        confidence: f.confidence,
        evidence: f.evidence,
      })),
      contextMessage: pending.contextMessage,
    })
  })

  // ─── POST /api/career/confirm — 用户确认特定字段 ───
  fastify.post('/api/career/confirm', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const userId = (request as any).user?.id || (request as any).userId
    const { field } = request.body as { field: string }
    if (!field) {
      return reply.status(400).send({ error: 'field is required' })
    }

    const updated = pendingConfirmations.confirm(userId, field)
    if (!updated) {
      return reply.status(404).send({ error: 'No pending confirmations found' })
    }

    // 当所有字段确认后，同步到 CareerProfile
    if (updated.pendingSuggestions.length === 0) {
      await syncConfirmedToProfile(userId, updated)
      pendingConfirmations.clear(userId)
    }

    return reply.send({
      success: true,
      field: updated.confirmedFields,
      remaining: updated.pendingSuggestions.length,
    })
  })

  // ─── POST /api/career/reject — 用户拒绝特定字段 ───
  fastify.post('/api/career/reject', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const userId = (request as any).user?.id || (request as any).userId
    const { field } = request.body as { field: string }
    if (!field) {
      return reply.status(400).send({ error: 'field is required' })
    }

    const updated = pendingConfirmations.reject(userId, field)
    if (!updated) {
      return reply.status(404).send({ error: 'No pending confirmations found' })
    }

    return reply.send({
      success: true,
      rejected: updated.rejectedFields,
      remaining: updated.pendingSuggestions.length,
    })
  })

  // ─── GET /api/career/resume — 安全简历（只读 Confirmed Facts）───
  fastify.get('/api/career/resume', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const userId = (request as any).user?.id || (request as any).userId
    const safeData = await extractResumeSafeData(userId)

    if (!safeData) {
      return reply.status(404).send({ error: 'Profile not found', message: '请先与求职顾问对话，建立职业档案' })
    }

    return reply.send({
      success: true,
      resume: safeData,
      source: 'confirmed_facts_only',
      note: '本简历只包含用户确认过的职业事实，不含 AI 推断',
    })
  })

  // ─── PATCH /api/career/profile — 用户手动编辑字段 ───
  fastify.patch('/api/career/profile', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const userId = (request as any).user?.id || (request as any).userId
    const { field, value } = request.body as { field: string; value: unknown }
    if (!field || value === undefined) {
      return reply.status(400).send({ error: 'field and value are required' })
    }

    // 允许编辑的字段白名单
    const editableFields = [
      'fullName', 'headline', 'bio', 'city',
      'careerDirection', 'industry', 'yearsExperience', 'currentLevel',
    ]
    if (!editableFields.includes(field)) {
      return reply.status(400).send({ error: `字段 ${field} 不可编辑` })
    }

    // 写入 CareerProfile
    await prisma.careerProfile.upsert({
      where: { userId },
      create: { userId, candidateId: require('crypto').randomUUID(), fullName: '用户', [field]: value },
      update: { [field]: value, lastActiveAt: new Date() },
    } as any)

    // 同步清除待确认中该字段
    pendingConfirmations.confirm(userId, field)

    return reply.send({ success: true, field, value })
  })
}

/**
 * 用户确认所有 suggest 字段后，同步写入 CareerProfile
 */
async function syncConfirmedToProfile(
  userId: string,
  pending: import('../../services/career/career-confirmation.service.js').PendingConfirmation
): Promise<void> {
  const confirmedFields = pending.fields.filter(f =>
    pending.confirmedFields.includes(f.field)
  )

  if (confirmedFields.length === 0) return

  const updateData: Record<string, unknown> = {}
  for (const f of confirmedFields) {
    switch (f.field) {
      case 'fullName': updateData.fullName = String(f.value); break
      case 'headline': updateData.headline = String(f.value); break
      case 'bio': updateData.bio = String(f.value); break
      case 'city': updateData.city = String(f.value); break
      case 'careerDirection': updateData.careerDirection = String(f.value); break
      case 'industry': updateData.industry = String(f.value); break
      case 'yearsExperience': updateData.yearsExperience = Number(f.value); break
      case 'currentLevel': updateData.currentLevel = String(f.value); break
    }
  }

  if (Object.keys(updateData).length === 0) return

  await prisma.careerProfile.upsert({
    where: { userId },
    create: {
      userId,
      candidateId: require('crypto').randomUUID(),
      fullName: '用户',
      ...updateData,
      lastActiveAt: new Date(),
    },
    update: {
      ...updateData,
      lastActiveAt: new Date(),
    },
  } as any)
}
