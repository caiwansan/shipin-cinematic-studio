// ============================================================
// Personal Tenant Service
// Phase 1.0 — KMKI-PLAT-TENANT-SVC
// ============================================================
// 每个 User 在注册/回填时自动拥有一个 Personal Tenant
// 不修改 User 模型（User 无固定 tenantId，通过 GovUser 关联）
// ============================================================

import { prisma } from '../../utils/index.js'

export interface PersonalTenantInput {
  userId: string
  userName: string
}

export interface PersonalTenantResult {
  tenantId: string
  membershipId: string
  isNew: boolean
}

/**
 * 确保用户拥有 Personal Tenant
 * - 如果已有，返回现有
 * - 如果没有，创建 Personal Tenant + Membership
 */
export async function ensurePersonalTenant(input: PersonalTenantInput): Promise<PersonalTenantResult> {
  const { userId, userName } = input

  // 1. 检查用户是否已有 GovUser 记录（即已加入 Tenant）
  const existingGovUser = await prisma.govUser.findFirst({
    where: {
      tenant: { type: 'personal' },
      id: userId, // GovUser.id 是否等于 User.id? 需要确认
    },
    include: { tenant: true },
  })

  // 实际设计中 GovUser 和 User 是分离的，应该检查同名或 ownerId
  // 目前 Tenant 无 ownerId 字段，我们通过 GovUser.name = userId 关联
  // 修正：查找 Tenant 名为 "Personal: {userId}" 的记录
  const existingTenant = await prisma.tenant.findFirst({
    where: {
      name: `Personal: ${userId}`,
      type: 'personal',
    },
  })

  if (existingTenant) {
    return {
      tenantId: existingTenant.id,
      membershipId: '', // 已有, 无需重新创建 session
      isNew: false,
    }
  }

  // 2. 创建 Personal Tenant
  const tenant = await prisma.tenant.create({
    data: {
      name: `Personal: ${userId}`,
      type: 'personal',
      status: 'active',
      metadata: JSON.stringify({
        ownerId: userId,
        ownerName: userName,
        schemaVersion: 1,
      }),
    },
  })

  // 3. 创建 GovUser（User → Tenant 关联）
  const govUser = await prisma.govUser.create({
    data: {
      id: userId,  // GovUser.id = User.id (1:1 for personal)
      tenantId: tenant.id,
      name: userName,
      role: 'owner',  // 默认角色: owner
      status: 'active',
      metadata: JSON.stringify({
        type: 'personal_tenant_owner',
        schemaVersion: 1,
      }),
    },
  })

  // 4. 创建默认 Membership (free tier)
  const membership = await prisma.membership.create({
    data: {
      userId: userId,
      tier: 'free',
      credits: 0,
    },
  }).catch(() => null) // 如果 membership 已存在（注册时已创建），忽略

  return {
    tenantId: tenant.id,
    membershipId: membership?.id || '',
    isNew: true,
  }
}

/**
 * 获取用户的 Personal Tenant
 */
export async function getPersonalTenant(userId: string): Promise<{ tenantId: string } | null> {
  const tenant = await prisma.tenant.findFirst({
    where: {
      name: `Personal: ${userId}`,
      type: 'personal',
      status: 'active',
    },
    select: { id: true },
  })
  if (!tenant) return null
  return { tenantId: tenant.id }
}

/**
 * 批量扫描没有 Personal Tenant 的用户并创建
 * 用于历史数据 Backfill
 */
export async function backfillPersonalTenants(batchSize = 100): Promise<{
  total: number
  created: number
  errors: number
}> {
  const users = await prisma.user.findMany({
    where: {
      // 排除已有 Personal Tenant 的用户
      NOT: {
      },
    },
    take: batchSize,
    orderBy: { createdAt: 'asc' },
  })

  // 过滤出已有 tenant 的 user
  const existingTenantUserIds = new Set<string>()
  const existingTenants = await prisma.tenant.findMany({
    where: {
      type: 'personal',
      name: { in: users.map(u => `Personal: ${u.id}`) },
    },
    select: { name: true },
  })
  existingTenants.forEach(t => {
    const uid = t.name.replace('Personal: ', '')
    existingTenantUserIds.add(uid)
  })

  const toCreate = users.filter(u => !existingTenantUserIds.has(u.id))
  let created = 0
  let errors = 0

  for (const user of toCreate) {
    try {
      await ensurePersonalTenant({
        userId: user.id,
        userName: user.username || user.email || user.id.slice(0, 8),
      })
      created++
    } catch (err) {
      console.error(`[PersonalTenant] Backfill failed for user ${user.id}:`, err)
      errors++
    }
  }

  return {
    total: users.length,
    created,
    errors,
  }
}
