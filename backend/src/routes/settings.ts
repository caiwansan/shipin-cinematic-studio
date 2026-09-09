// 设置中心路由 — Settings Routes
// 功能：个人资料、隐私设置、通知设置、安全设置、数据备份

import { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'

export default async function settingsRoutes(fastify: FastifyInstance) {
  // GET /api/settings — 获取所有设置
  fastify.get('/api/settings', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userUid = request.user.id
    const setting = await prisma.$queryRawUnsafe(
      `SELECT * FROM user_setting WHERE user_uid = $1`, userUid
    ) as any[]
    if (!setting.length) return { success: true, data: { profile: {}, privacy: {}, notification: {}, security: {} } }
    let profile: any = {}, privacy: any = {}, notification: any = {}, security: any = {}, backup: any = {}
    try { profile = JSON.parse(setting[0].profile_data || '{}') } catch { }
    try { privacy = JSON.parse(setting[0].privacy_data || '{}') } catch { }
    try { notification = JSON.parse(setting[0].notification_data || '{}') } catch { }
    try { security = JSON.parse(setting[0].security_data || '{}') } catch { }
    try { backup = JSON.parse(setting[0].backup_data || '{}') } catch { }
    return { success: true, data: { profile, privacy, notification, security, backup } }
  })

  // POST /api/settings — 保存设置
  fastify.post('/api/settings', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userUid = request.user.id
    const { profile, privacy, notification, security, backup } = request.body as any
    const existing = await prisma.$queryRawUnsafe(
      `SELECT id FROM user_setting WHERE user_uid = $1`, userUid
    ) as any[]
    if (existing.length) {
      await prisma.$queryRawUnsafe(
        `UPDATE user_setting SET profile_data = COALESCE($1, profile_data), privacy_data = COALESCE($2, privacy_data), notification_data = COALESCE($3, notification_data), security_data = COALESCE($4, security_data), backup_data = COALESCE($5, backup_data), updated_at = NOW() WHERE id = $6`,
        profile ? JSON.stringify(profile) : null,
        privacy ? JSON.stringify(privacy) : null,
        notification ? JSON.stringify(notification) : null,
        security ? JSON.stringify(security) : null,
        backup ? JSON.stringify(backup) : null,
        existing[0].id
      )
    } else {
      await prisma.$queryRawUnsafe(
        `INSERT INTO user_setting (user_uid, profile_data, privacy_data, notification_data, security_data, backup_data) VALUES ($1, $2, $3, $4, $5, $6)`,
        userUid,
        profile ? JSON.stringify(profile) : null,
        privacy ? JSON.stringify(privacy) : null,
        notification ? JSON.stringify(notification) : null,
        security ? JSON.stringify(security) : null,
        backup ? JSON.stringify(backup) : null
      )
    }
    return { success: true }
  })

  // GET /api/settings/profile — 个人资料
  fastify.get('/api/settings/profile', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userUid = request.user.id
    const setting = await prisma.$queryRawUnsafe(
      `SELECT profile_data FROM user_setting WHERE user_uid = $1`, userUid
    ) as any[]
    if (!setting.length) return { success: true, data: {} }
    let profile: any = {}
    try { profile = JSON.parse(setting[0].profile_data || '{}') } catch { }
    return { success: true, data: profile }
  })

  // POST /api/settings/profile — 修改资料（合并更新，不覆盖已有字段）
  fastify.post('/api/settings/profile', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userUid = request.user.id
    const body = request.body as any
    const existing = await prisma.$queryRawUnsafe(
      `SELECT id, profile_data FROM user_setting WHERE user_uid = $1`, userUid
    ) as any[]
    let mergedData = body
    if (existing.length && existing[0].profile_data) {
      try {
        const oldData = JSON.parse(existing[0].profile_data)
        mergedData = { ...oldData, ...body }
      } catch {}
      await prisma.$queryRawUnsafe(
        `UPDATE user_setting SET profile_data = $1, updated_at = NOW() WHERE id = $2`,
        JSON.stringify(mergedData), existing[0].id
      )
    } else if (existing.length) {
      await prisma.$queryRawUnsafe(
        `UPDATE user_setting SET profile_data = $1, updated_at = NOW() WHERE id = $2`,
        JSON.stringify(mergedData), existing[0].id
      )
    } else {
      await prisma.$queryRawUnsafe(
        `INSERT INTO user_setting (user_uid, profile_data) VALUES ($1, $2)`,
        userUid, JSON.stringify(mergedData)
      )
    }
    return { success: true }
  })

  // POST /api/settings/security — 安全设置
  fastify.post('/api/settings/security', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userUid = request.user.id
    const body = request.body as any
    const existing = await prisma.$queryRawUnsafe(
      `SELECT id FROM user_setting WHERE user_uid = $1`, userUid
    ) as any[]
    if (existing.length) {
      await prisma.$queryRawUnsafe(
        `UPDATE user_setting SET security_data = $1, updated_at = NOW() WHERE id = $2`,
        JSON.stringify(body), existing[0].id
      )
    } else {
      await prisma.$queryRawUnsafe(
        `INSERT INTO user_setting (user_uid, security_data) VALUES ($1, $2)`,
        userUid, JSON.stringify(body)
      )
    }
    return { success: true }
  })

  // POST /api/settings/backup — 数据备份
  fastify.post('/api/settings/backup', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userUid = request.user.id
    const body = request.body as any
    const existing = await prisma.$queryRawUnsafe(
      `SELECT id FROM user_setting WHERE user_uid = $1`, userUid
    ) as any[]
    const backupInfo = { ...body, backupAt: new Date().toISOString() }
    if (existing.length) {
      await prisma.$queryRawUnsafe(
        `UPDATE user_setting SET backup_data = $1, updated_at = NOW() WHERE id = $2`,
        JSON.stringify(backupInfo), existing[0].id
      )
    } else {
      await prisma.$queryRawUnsafe(
        `INSERT INTO user_setting (user_uid, backup_data) VALUES ($1, $2)`,
        userUid, JSON.stringify(backupInfo)
      )
    }
    return { success: true, data: { backupAt: backupInfo.backupAt } }
  })
}
