import type { ApiResponse } from '../contracts/api/base.js';
/**
 * backend/src/routes/desktop-runtime.ts — 桌面运行时 API 路由
 *
 * 为「火麒麟AI导演控制台」桌面端提供后端接口支持，包括：
 * - 桌面运行时初始化配置
 * - GPU 检测上报
 * - License Token 获取与验证
 * - 本地资产同步
 *
 * 安全约束：
 * - License Runtime 必须强制启用，不可绕过
 * - 禁止本地绕过会员系统，严格校验 Token
 * - 禁止本地伪造 License，服务端签名校验
 * - 所有接口需认证（authenticate）
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '../utils/index.js'
import * as crypto from 'crypto'

/** JWT payload 中的用户信息 */
interface JwtUser {
  id: string
  email?: string
  role?: string
}

/**
 * 注册桌面运行时路由
 * @param fastify FastifyInstance
 */
export default async function desktopRuntimeRoutes(fastify: FastifyInstance) {
  const prismaClient = prisma

  // ══════════════════════════════════════════════════════════════
  // POST /api/desktop-runtime/init — 初始化桌面运行时
  //
  // 客户端调用此接口获取桌面运行时的初始配置，包括：
  // - 服务端推荐的 GPU 偏好
  // - 平台兼容性信息
  // - License 状态
  //
  // 请求体:
  //   { platform: "windows" | "macos" | "linux" }
  //
  // 响应:
  //   { success: true, data: { runtimeMode, gpuPreference, autoDetect, ... } }
  // ══════════════════════════════════════════════════════════════
  fastify.post('/api/desktop-runtime/init', {
    // 需要认证
    onRequest: [fastify.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = request.user as JwtUser
      const { platform } = request.body as { platform?: string }

      // 校验平台参数
      const validPlatforms = ['windows', 'macos', 'linux']
      const normalizedPlatform = platform?.toLowerCase() || process.platform
      if (!validPlatforms.includes(normalizedPlatform)) {
        return reply.status(400).send({
          success: false,
          error: `无效的平台类型: ${normalizedPlatform}，可选: ${validPlatforms.join(', ')}`,
        })
      }

      // 从数据库获取或创建运行时配置
      let config = await prismaClient.desktopRuntimeConfig.findFirst({
        where: { platform: normalizedPlatform },
        orderBy: { updatedAt: 'desc' },
      })

      if (!config) {
        // 首次运行，创建默认配置
        const gpuPreference = getDefaultGpuPreference(normalizedPlatform)
        config = await prismaClient.desktopRuntimeConfig.create({
          data: {
            platform: normalizedPlatform,
            runtimeMode: 'desktop',
            gpuPreference,
            autoDetect: true,
          },
        })
        console.info(`[DesktopRuntime] 创建默认配置: platform=${normalizedPlatform}, gpu=${gpuPreference}`)
      }

      // 同时查询 License 状态
      const licenseInfo = await prismaClient.licenseCache.findFirst({
        where: {
          userId: user.id,
          isActive: true,
          expiresAt: { gte: new Date() },
        },
        orderBy: { lastVerified: 'desc' },
      })

      return {
        success: true,
        data: {
          runtimeMode: config.runtimeMode,
          gpuPreference: config.gpuPreference,
          autoDetect: config.autoDetect,
          platform: config.platform,
          licenseActive: !!licenseInfo,
          licenseTier: licenseInfo ? extractTier(licenseInfo.licenseToken) : 'free',
          configId: config.id,
        },
      }
    } catch (err: any) {
      console.error('[DesktopRuntime] init 错误:', err)
      return reply.status(500).send({
        success: false,
        error: `初始化失败: ${err.message}`,
      })
    }
  })

  // ══════════════════════════════════════════════════════════════
  // POST /api/desktop-runtime/gpu-detect — GPU 检测上报
  //
  // 桌面端启动时自动检测 GPU 信息并上报到服务端，用于：
  // - 记录用户 GPU 分布统计
  // - 服务端 GPU 调度决策
  // - 驱动版本兼容性追
  //
  // 请求体:
  //   { adapterName, platform, memoryMB, computeUnits, driverVersion? }
  //
  // 响应:
  //   { success: true, data: { gpuId } }
  // ══════════════════════════════════════════════════════════════
  fastify.post('/api/desktop-runtime/gpu-detect', {
    onRequest: [fastify.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const {
        adapterName,
        platform,
        memoryMB,
        computeUnits,
        driverVersion,
        temperature,
        usagePercent,
      } = request.body as {
        adapterName: string
        platform: string
        memoryMB: number
        computeUnits: number
        driverVersion?: string
        temperature?: number
        usagePercent?: number
      }

      // 校验必要字段
      if (!adapterName) {
        return reply.status(400).send({
          success: false,
          error: '缺少必要字段: adapterName',
        })
      }

      if (!platform) {
        return reply.status(400).send({
          success: false,
          error: '缺少必要字段: platform',
        })
      }

      if (typeof memoryMB !== 'number' || memoryMB <= 0) {
        return reply.status(400).send({
          success: false,
          error: 'memoryMB 必须为正整数',
        })
      }

      if (typeof computeUnits !== 'number' || computeUnits <= 0) {
        return reply.status(400).send({
          success: false,
          error: 'computeUnits 必须为正整数',
        })
      }

      // 查找是否已有相同 GPU 记录（按 adapterName + platform 去重）
      const existing = await prismaClient.localGPUNode.findFirst({
        where: { adapterName, platform },
        orderBy: { lastSeen: 'desc' },
      })

      let gpuNode
      if (existing) {
        // 更新已有记录
        gpuNode = await prismaClient.localGPUNode.update({
          where: { id: existing.id },
          data: {
            memoryMB,
            computeUnits,
            driverVersion: driverVersion || existing.driverVersion,
            temperature: temperature ?? existing.temperature,
            usagePercent: usagePercent ?? existing.usagePercent,
            isAvailable: true,
            lastSeen: new Date(),
          },
        })
        console.info(`[DesktopRuntime] GPU 已更新: ${adapterName}, memoryMB=${memoryMB}`)
      } else {
        // 创建新 GPU 记录
        gpuNode = await prismaClient.localGPUNode.create({
          data: {
            adapterName,
            platform,
            memoryMB,
            computeUnits,
            driverVersion,
            temperature,
            usagePercent,
            isAvailable: true,
          },
        })
        console.info(`[DesktopRuntime] GPU 新记录: ${adapterName}, platform=${platform}`)
      }

      return {
        success: true,
        data: {
          gpuId: gpuNode.id,
          isNew: !existing,
        },
      }
    } catch (err: any) {
      console.error('[DesktopRuntime] GPU 检测上报错误:', err)
      return reply.status(500).send({
        success: false,
        error: `GPU 上报失败: ${err.message}`,
      })
    }
  })

  // ══════════════════════════════════════════════════════════════
  // GET /api/desktop-runtime/license — 获取 License Token
  //
  // 桌面端启动时调用此接口获取 License Token，
  // Token 由服务端签名生成，客户端不得自行构造。
  //
  // 响应:
  //   { success: true, data: { token, tier, expiresAt, signature } }
  // ══════════════════════════════════════════════════════════════
  fastify.get('/api/desktop-runtime/license', {
    onRequest: [fastify.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = request.user as JwtUser

      // 查用户会员信息（这里假设有 member 或 user 表）
      let userTier = 'free'
      let membershipExpiresAt: Date | null = null

      try {
        // 尝试从 member 表获取会员等级
        const member = await (prismaClient as any).member?.findUnique({
          where: { userId: user.id },
        })
        if (member) {
          userTier = member.tier || 'free'
          membershipExpiresAt = member.expiresAt || null
        }
      } catch {
        // member 表不存在等情况，使用默认等级
        console.warn('[DesktopRuntime] 无法读取会员信息，默认 free 等级')
      }

      // 如果会员已过期，等级降为 free
      if (membershipExpiresAt && new Date(membershipExpiresAt) < new Date()) {
        userTier = 'free'
      }

      // 生成 License Token（服务端签名，不可伪造）
      const licenseToken = generateLicenseToken(user.id, userTier, membershipExpiresAt)

      // 计算过期时间
      const tokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24小时
      const membershipExpires = membershipExpiresAt || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

      // 缓存到 LicenseCache 表
      await prismaClient.licenseCache.create({
        data: {
          userId: user.id,
          licenseToken,
          isActive: true,
          expiresAt: tokenExpiresAt,
          lastVerified: new Date(),
        },
      })

      // 清理过期缓存
      try {
        await prismaClient.licenseCache.deleteMany({
          where: {
            userId: user.id,
            expiresAt: { lt: new Date() },
          },
        })
      } catch {
        // 清理失败不影响主流程
      }

      console.info(`[DesktopRuntime] License 已颁发: userId=${user.id}, tier=${userTier}`)

      return {
        success: true,
        data: {
          token: licenseToken,
          userId: user.id,
          tier: userTier,
          expiresAt: tokenExpiresAt.toISOString(),
          membershipExpiresAt: membershipExpires.toISOString(),
          issuedAt: new Date().toISOString(),
        },
      }
    } catch (err: any) {
      console.error('[DesktopRuntime] 获取 License 错误:', err)
      return reply.status(500).send({
        success: false,
        error: `获取 License 失败: ${err.message}`,
      })
    }
  })

  // ══════════════════════════════════════════════════════════════
  // POST /api/desktop-runtime/license/verify — 验证 License
  //
  // 验证客户端提交的 License Token 是否有效。
  // 包括：签名验证、过期验证、会员状态验证。
  //
  // 请求体:
  //   { token: "..." }
  //
  // 响应:
  //   { success: true, data: { valid, tier, ... } }
  // ══════════════════════════════════════════════════════════════
  fastify.post('/api/desktop-runtime/license/verify', {
    onRequest: [fastify.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = request.user as JwtUser
      const { token } = request.body as { token?: string }

      if (!token) {
        return reply.status(400).send({
          success: false,
          error: '缺少 token 参数',
          data: { valid: false },
        })
      }

      // ═══ 1. 数据库验证 ═══
      // 从 LicenseCache 查找 token
      const cachedLicense = await prismaClient.licenseCache.findFirst({
        where: {
          licenseToken: token,
          userId: user.id,
          isActive: true,
        },
        orderBy: { lastVerified: 'desc' },
      })

      if (!cachedLicense) {
        return {
          success: false,
          error: 'License Token 不存在或已被吊销',
          data: { valid: false },
        }
      }

      // ═══ 2. 过期验证 ═══
      if (new Date(cachedLicense.expiresAt) < new Date()) {
        // 标记为无效
        await prismaClient.licenseCache.update({
          where: { id: cachedLicense.id },
          data: { isActive: false },
        })

        return {
          success: false,
          error: 'License 已过期',
          data: { valid: false, expired: true },
        }
      }

      // ═══ 3. 签名验证（防伪造） ═══
      const isValidSignature = verifyLicenseToken(token)
      if (!isValidSignature) {
        // ⛔ 签名无效 → 可能是伪造的 License
        console.warn(`[DesktopRuntime] ⛔ 检测到伪造 License Token: userId=${user.id}, token=${token.slice(0, 20)}...`)
        await prismaClient.licenseCache.update({
          where: { id: cachedLicense.id },
          data: { isActive: false },
        })

        return {
          success: false,
          error: 'License Token 签名无效（可能被篡改）',
          data: { valid: false, tampered: true },
        }
      }

      // ═══ 4. 会员状态验证 ═══
      let currentTier = 'free'
      try {
        const member = await (prismaClient as any).member?.findUnique({
          where: { userId: user.id },
        })
        if (member) {
          const memberExpiresAt = new Date(member.expiresAt)
          if (memberExpiresAt >= new Date()) {
            currentTier = member.tier || 'free'
          } else {
            currentTier = 'free' // 会员已过期
          }
        }
      } catch {
        // 默认 free
      }

      // 更新验证时间
      await prismaClient.licenseCache.update({
        where: { id: cachedLicense.id },
        data: { lastVerified: new Date() },
      })

      return {
        success: true,
        data: {
          valid: true,
          userId: user.id,
          tier: currentTier,
          expiresAt: cachedLicense.expiresAt.toISOString(),
          verifiedAt: new Date().toISOString(),
        },
      }
    } catch (err: any) {
      console.error('[DesktopRuntime] License 验证错误:', err)
      return reply.status(500).send({
        success: false,
        error: `验证失败: ${err.message}`,
        data: { valid: false },
      })
    }
  })

  // ══════════════════════════════════════════════════════════════
  // POST /api/desktop-runtime/asset/sync — 资产同步
  //
  // 桌面端本地资产与服务端同步，上报本地资产索引。
  // 用于跨设备资产管理和版本跟踪。
  //
  // 请求体:
  //   {
  //     assets: [{ category, name, localPath, sizeBytes, checksum }],
  //     deletedIds?: string[]
  //   }
  //
  // 响应:
  //   { success: true, data: { synced: number, failed: number } }
  // ══════════════════════════════════════════════════════════════
  fastify.post('/api/desktop-runtime/asset/sync', {
    onRequest: [fastify.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = request.user as JwtUser
      const { assets, deletedIds } = request.body as {
        assets?: Array<{
          category: string
          name: string
          localPath: string
          sizeBytes: number
          checksum?: string
        }>
        deletedIds?: string[]
      }

      if (!assets || !Array.isArray(assets) || assets.length === 0) {
        return reply.status(400).send({
          success: false,
          error: '缺少资产列表',
        })
      }

      // 校验资产分类
      const validCategories = ['image', 'video', 'dag', 'agent', 'workflow']
      for (const asset of assets) {
        if (!validCategories.includes(asset.category)) {
          return reply.status(400).send({
            success: false,
            error: `无效的资产分类: ${asset.category}，可选: ${validCategories.join(', ')}`,
          })
        }
        if (!asset.name || !asset.localPath) {
          return reply.status(400).send({
            success: false,
            error: '每个资产必须有 name 和 localPath',
          })
        }
      }

      let syncedCount = 0
      let failedCount = 0

      // 逐条 upsert 资产索引
      for (const asset of assets) {
        try {
          // 检查是否已存在（按 name + localPath 去重）
          const existing = await prismaClient.localAssetIndex.findFirst({
            where: {
              name: asset.name,
              localPath: asset.localPath,
            },
          })

          if (existing) {
            // 更新已有记录
            await prismaClient.localAssetIndex.update({
              where: { id: existing.id },
              data: {
                category: asset.category,
                sizeBytes: BigInt(asset.sizeBytes),
                checksum: asset.checksum || existing.checksum,
                syncedFromCloud: true,
                lastUsed: new Date(),
              },
            })
          } else {
            // 创建新记录
            await prismaClient.localAssetIndex.create({
              data: {
                category: asset.category,
                name: asset.name,
                localPath: asset.localPath,
                sizeBytes: BigInt(asset.sizeBytes),
                checksum: asset.checksum,
                syncedFromCloud: true,
              },
            })
          }
          syncedCount++
        } catch (assetErr) {
          console.error(`[DesktopRuntime] 资产同步失败: ${asset.name}`, assetErr)
          failedCount++
        }
      }

      // 处理删除请求
      if (deletedIds && Array.isArray(deletedIds) && deletedIds.length > 0) {
        try {
          await prismaClient.localAssetIndex.deleteMany({
            where: {
              id: { in: deletedIds },
              syncedFromCloud: true,
            },
          })
          console.info(`[DesktopRuntime] 已删除 ${deletedIds.length} 个云端已删除资产`)
        } catch (deleteErr) {
          console.error('[DesktopRuntime] 删除资产失败:', deleteErr)
        }
      }

      console.info(`[DesktopRuntime] 资产同步完成: 成功=${syncedCount}, 失败=${failedCount}`)

      return {
        success: true,
        data: {
          synced: syncedCount,
          failed: failedCount,
          total: assets.length,
        },
      }
    } catch (err: any) {
      console.error('[DesktopRuntime] 资产同步错误:', err)
      return reply.status(500).send({
        success: false,
        error: `资产同步失败: ${err.message}`,
      })
    }
  })

  // ══════════════════════════════════════════════════════════════
  // Helper: 根据平台获取默认 GPU 偏好
  // ══════════════════════════════════════════════════════════════
  function getDefaultGpuPreference(platform: string): string | null {
    switch (platform) {
      case 'windows':
        return 'directml'     // Windows 优先 DirectML
      case 'macos':
        return 'metal'        // macOS 只支持 Metal
      case 'linux':
        return 'cuda'         // Linux 优先 CUDA（NVIDIA）
      default:
        return null
    }
  }

  // ══════════════════════════════════════════════════════════════
  // Helper: 生成 License Token（服务端签名）
  //
  // 使用 HMAC-SHA256 对用户信息和时效进行签名，
  // 客户端无法伪造，因为签名密钥仅在服务端持有。
  // ══════════════════════════════════════════════════════════════
  const LICENSE_SECRET = process.env.LICENSE_SECRET || 'huoqilin-license-secret-v1'

  function generateLicenseToken(
    userId: string,
    tier: string,
    expiresAt: Date | null,
  ): string {
    const payload = {
      userId,
      tier,
      issuedAt: new Date().toISOString(),
      expiresAt: expiresAt?.toISOString() || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      nonce: crypto.randomBytes(16).toString('hex'),
    }

    // 序列化 payload
    const payloadStr = JSON.stringify(payload)
    const payloadBase64 = Buffer.from(payloadStr).toString('base64')

    // 生成签名
    const signature = crypto
      .createHmac('sha256', LICENSE_SECRET)
      .update(payloadBase64)
      .digest('hex')

    return `${payloadBase64}.${signature}`
  }

  /**
   * 验证 License Token 签名是否有效
   * @param token 完整 License Token
   * @returns 签名是否有效
   */
  function verifyLicenseToken(token: string): boolean {
    try {
      const parts = token.split('.')
      if (parts.length !== 2) return false

      const [payloadBase64, signature] = parts

      // 重新计算签名
      const expectedSignature = crypto
        .createHmac('sha256', LICENSE_SECRET)
        .update(payloadBase64)
        .digest('hex')

      // 恒定时间比较，防止时序攻击
      if (signature.length !== expectedSignature.length) return false

      return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))
    } catch {
      return false
    }
  }

  /**
   * 从 License Token 中提取会员等级
   * @param token 完整 License Token
   * @returns 会员等级 (free / pro / director / enterprise)
   */
  function extractTier(token: string): string {
    try {
      // 验证签名后再提取
      if (!verifyLicenseToken(token)) return 'free'

      const parts = token.split('.')
      if (parts.length !== 2) return 'free'

      const payloadBase64 = parts[0]
      const payloadStr = Buffer.from(payloadBase64, 'base64').toString('utf-8')
      const payload = JSON.parse(payloadStr)
      return payload.tier || 'free'
    } catch {
      return 'free'
    }
  }
}
