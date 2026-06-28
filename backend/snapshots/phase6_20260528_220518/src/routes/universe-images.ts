/**
 * 作品宇宙图片引用 API（V2 — 支持二创DNA链积分分配）
 *
 * - GET  /api/v1/universe/images — 搜索作品宇宙公开图片（含modifiedBy信息）
 * - POST /api/v1/universe/images/:id/reference — 引用图片（积分分配：10%平台 + 90%按DNA链分配）
 */

import { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'
import { trackLineage } from '../core/asset-economy/lineage-engine/lineage-tracker.js'

const PLATFORM_USER_ID = 'platform'  // 平台账户ID
const PLATFORM_PERCENT = 0.10        // 平台抽成 10%
const REF_COST = 10                  // 每次引用 10 积分

export default async function universeImageRoutes(fastify: FastifyInstance) {
  // ============================================================
  // 1. 搜索作品宇宙公开图片
  // ============================================================
  fastify.get('/api/v1/universe/images', async (request, reply) => {
    const { search, type, page, pageSize } = request.query as any

    const pageNum = Math.max(1, parseInt(page) || 1)
    const size = Math.min(50, Math.max(1, parseInt(pageSize) || 20))
    const skip = (pageNum - 1) * size

    const where: any = {}
    // type 筛选：支持 all/image/video
    if (type && type !== 'all') {
      where.type = type
    } else {
      // 默认展示图片和视频
      where.type = { in: ['image', 'video'] }
    }

    // 排除用户自行上传的本地图片（只展示 AI 生成内容）
    where.NOT = { source: 'user_upload' }

    if (search && search.trim()) {
      where.OR = [
        { title: { contains: search.trim() } },
        { prompt: { contains: search.trim() } },
      ]
    }

    try {
      const [total, items] = await Promise.all([
        prisma.userAsset.count({ where }),
        prisma.userAsset.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: size,
          select: {
            id: true,
            title: true,
            url: true,
            thumbnail: true,
            prompt: true,
            userId: true,
            style: true,
            modifiedBy: true,
            createdAt: true,
            universeScore: true,
          },
        }),
      ])

      const userIds = [...new Set(items.map((i: any) => i.userId))]
      const users = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, username: true },
      })
      const userMap = new Map(users.map((u: any) => [u.id, u]))

      const { getWatermarkedUrl } = await import('../services/watermark.service.js')

      const results = items.map((item: any) => ({
        id: item.id,
        title: item.title,
        url: getWatermarkedUrl(item.url, item.userId),
        thumbnailUrl: getWatermarkedUrl(item.thumbnail || item.url, item.userId),
        prompt: item.prompt,
        style: item.style,
        userId: item.userId,
        modifiedBy: item.modifiedBy,
        author: userMap.get(item.userId) || null,
        universeScore: item.universeScore,
        createdAt: item.createdAt,
      }))

      return reply.send({
        success: true,
        data: results,
        meta: {
          total,
          page: pageNum,
          pageSize: size,
          totalPages: Math.ceil(total / size),
        },
      })
    } catch (err: any) {
      console.error('[UniverseImages] 查询失败:', err)
      return reply.status(500).send({ success: false, error: '查询作品宇宙失败' })
    }
  })

  // ============================================================
  // 2. 引用图片 — 积分分配
  //    总 10 积分：
  //      - 10% (1分) → 平台
  //      - 90% (9分) → 按 DNA 链/创作者链比例分配
  // ============================================================
  fastify.post('/api/v1/universe/images/:id/reference', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { id: userId } = request.user as any
    const { id: assetId } = request.params as any

    try {
      // 查询图片
      const asset = await prisma.userAsset.findUnique({ where: { id: assetId } })
      if (!asset || asset.type !== 'image') {
        return reply.status(404).send({ success: false, error: '图片不存在' })
      }

      // 不能引用自己的图
      if (asset.userId === userId) {
        return reply.status(400).send({ success: false, error: '不能引用自己的作品' })
      }

      // 检查引用者积分
      const user = await prisma.user.findUnique({ where: { id: userId } })
      if (!user || user.coins < REF_COST) {
        return reply.status(400).send({
          success: false,
          error: `积分不足！引用图片需要 ${REF_COST} 积分，当前 ${user?.coins || 0} 积分`,
        })
      }

      // ---- 计算积分分配 ----

      const platformAmount = Math.floor(REF_COST * PLATFORM_PERCENT)  // 平台: 1分
      const creatorPool = REF_COST - platformAmount                     // 创作者池: 9分

      // 收集所有应该收到积分的创作者（从血缘链+第一创作者）
      const recipients: { userId: string; weight: number }[] = []

      // 1. 原图作者（权重 1.0）
      recipients.push({ userId: asset.userId, weight: 1.0 })

      // 2. 查询血缘链中的创作者
      const lineage = await prisma.assetLineage.findUnique({
        where: { assetId },
      })

      if (lineage?.creatorChain) {
        try {
          const chain = JSON.parse(lineage.creatorChain)
          if (Array.isArray(chain)) {
            for (const entry of chain) {
              const existing = recipients.find(r => r.userId === entry.creatorId)
              if (!existing) {
                // 血缘链上的创作者，depth 越高贡献越低（越后续的修改）
                const weight = Math.max(0.1, 1.0 - entry.depth * 0.2)
                recipients.push({ userId: entry.creatorId, weight })
              }
            }
          }
        } catch {
          // 忽略解析错误
        }
      }

      // 3. 解析 modifiedBy 二次修改者
      if (asset.modifiedBy) {
        try {
          const modUsers = JSON.parse(asset.modifiedBy)
          if (Array.isArray(modUsers)) {
            // 查找这些用户的 ID
            const modUserRecords = await prisma.user.findMany({
              where: { username: { in: modUsers } },
              select: { id: true, username: true },
            })
            for (const mu of modUserRecords) {
              if (!recipients.find(r => r.userId === mu.id)) {
                recipients.push({ userId: mu.id, weight: 0.5 })
              }
            }
          }
        } catch {
          // 忽略解析错误
        }
      }

      // 计算各创作者应得积分
      const totalWeight = recipients.reduce((sum, r) => sum + r.weight, 0)
      const splits: { userId: string; amount: number; percentage: number }[] = []
      let allocated = 0

      for (let i = 0; i < recipients.length; i++) {
        const r = recipients[i]
        let amount: number
        if (i === recipients.length - 1) {
          // 最后一人拿剩余（避免浮点数误差）
          amount = creatorPool - allocated
        } else {
          amount = Math.floor((r.weight / totalWeight) * creatorPool)
        }
        splits.push({ userId: r.userId, amount, percentage: amount / REF_COST })
        allocated += amount
      }

      // ---- 执行事务：扣分 + 分配积分 + 记流水 + 记录引用 ----

      await prisma.$transaction(async (tx: any) => {
        // 扣引用者积分
        await tx.user.update({
          where: { id: userId },
          data: { coins: { decrement: REF_COST } },
        })
        await tx.coinLog.create({
          data: {
            userId,
            amount: -REF_COST,
            type: 'consume',
            remark: `引用作品宇宙图片: ${asset.title || asset.prompt?.slice(0, 30) || '未命名'}`,
            relatedId: assetId,
          },
        })

        // 给平台分账
        if (platformAmount > 0) {
          await tx.user.update({
            where: { id: PLATFORM_USER_ID },
            data: { coins: { increment: platformAmount } },
          })
          await tx.coinLog.create({
            data: {
              userId: PLATFORM_USER_ID,
              amount: platformAmount,
              type: 'reward',
              remark: `作品宇宙引用平台抽成: ${asset.title || asset.prompt?.slice(0, 30) || '未命名'}`,
              relatedId: assetId,
            },
          })
        }

        // 给各创作者分账
        for (const split of splits) {
          if (split.amount <= 0) continue
          await tx.user.update({
            where: { id: split.userId },
            data: { coins: { increment: split.amount } },
          })
          await tx.coinLog.create({
            data: {
              userId: split.userId,
              amount: split.amount,
              type: 'reward',
              remark: `作品被引用（DNA分成）: ${asset.title || asset.prompt?.slice(0, 30) || '未命名'} (${(split.percentage * 100).toFixed(0)}%)`,
              relatedId: assetId,
            },
          })
        }

        // 记录引用
        await tx.assetReference.create({
          data: {
            sourceAssetId: assetId,
            targetAssetId: '',  // 引用者后续创建新作品后更新
            userId,
            projectId: '',
            referenceType: 'derivative',
            coinsPaid: REF_COST,
          },
        })
      })

      return reply.send({
        success: true,
        data: {
          imageUrl: asset.url,
          thumbnailUrl: asset.thumbnail || asset.url,
          prompt: asset.prompt,
          title: asset.title,
          cost: REF_COST,
          split: {
            platform: platformAmount,
            creators: splits,
          },
        },
        message: `引用成功！${REF_COST}积分分配：平台${platformAmount}分，${splits.length}位创作者共${creatorPool}分`,
      })
    } catch (err: any) {
      console.error('[UniverseImages] 引用失败:', err)
      return reply.status(500).send({ success: false, error: '引用失败: ' + err.message })
    }
  })
}

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "narrative-gateway",
  "mode": "SYNC"
};

