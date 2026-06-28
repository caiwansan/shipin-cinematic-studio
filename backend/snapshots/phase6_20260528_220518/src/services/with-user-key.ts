/**
 * services/with-user-key.ts — BYO API Key 注入 + 配额检查
 *
 * ⚠️ 宪法规则（2026-05-23）：用户只能使用自己接入的大模型 API，禁止使用平台大模型。
 *    没有私有 Key 则直接报错，不允许任何 fallback 到平台 Key。
 *
 * 策略：
 *   1. 所有用户：必须有私有 Key 才能调用 AI provider
 *   2. 没有私有 Key 的用户直接抛错，提示配置 API Key
 *   3. VIP 也不例外——VIP 只是解锁使用次数，不代表可以使用平台 Key
 *
 * 加密：aes-256-gcm，运行时短暂解密后使用
 *
 * 配额：checkLLMQuota 已恢复，基于 DailyUsage 表 + memberTier 强制执行
 */

import { FastifyRequest } from 'fastify'
import { prisma } from '../utils/index.js'
import { decryptKey } from '../services/crypto.service.js'
import { getRuntimeContext } from './runtime-context.js'

/**
 * 在 AI provider 调用前注入用户私有 key。
 * 没有私有 key → 直接抛错，禁止使用平台 key。
 */
export async function withUserKey<T>(
  request: FastifyRequest,
  provider: string,
  _envKeyName: string,
  fn: () => Promise<T>
): Promise<T> {
  const userId = (request.user as any)?.id
  if (!userId) {
    throw new Error('请先登录并配置 API Key 才能使用 AI 功能')
  }

  const userKey = await prisma.userApiKey.findFirst({
    where: { userId, provider, isActive: true },
    select: { keyValue: true, baseUrl: true },
  })

  if (!userKey || !userKey.keyValue) {
    throw new Error(
      `你还没有配置「${provider}」的 API Key。请到「大模型设置」中接入你的 API Key 再试`
    )
  }

  let decryptedKey: string
  try {
    decryptedKey = decryptKey(userKey.keyValue)
  } catch {
    throw new Error(`API Key 解密失败，请在「大模型设置」中重新配置 ${provider} 的 API Key`)
  }

  // 合并 secrets 到已有 RuntimeContext
  const ctx = getRuntimeContext()
  if (ctx) {
    const key = `${provider}ApiKey` as string
    (ctx as any).secrets[key] = decryptedKey as any
    if (userKey.baseUrl) {
      const baseUrlKey = `${provider}BaseUrl` as string
      (ctx as any).secrets[baseUrlKey] = userKey.baseUrl as any
    }
    (ctx as any).provider = {
      name: provider,
      apiKey: decryptedKey,
      source: 'BYOK',
    }
  }

  console.log(`[UserKey] ✅ user ${userId.substring(0, 8)} using own ${provider} key`)
  return fn()
}

/**
 * 简化映射
 */
export const userKeyFor = {
  siliconflow: (request: FastifyRequest, fn: () => Promise<any>) =>
    withUserKey(request, 'siliconflow', 'SILICONFLOW_API_KEY', fn),

  deepseek: (request: FastifyRequest, fn: () => Promise<any>) =>
    withUserKey(request, 'deepseek', 'DEEPSEEK_API_KEY', fn),

  openai: (request: FastifyRequest, fn: () => Promise<any>) =>
    withUserKey(request, 'openai', 'OPENAI_API_KEY', fn),

  volcengine: (request: FastifyRequest, fn: () => Promise<any>) =>
    withUserKey(request, 'volcengine', 'VOLCENGINE_API_KEY', fn),

  kling: (request: FastifyRequest, fn: () => Promise<any>) =>
    withUserKey(request, 'kling', 'KLING_API_KEY', fn),

  replicate: (request: FastifyRequest, fn: () => Promise<any>) =>
    withUserKey(request, 'replicate', 'REPLICATE_API_KEY', fn),

  aliyun: (request: FastifyRequest, fn: () => Promise<any>) =>
    withUserKey(request, 'aliyun', 'ALIYUN_API_KEY', fn),
}

/**
 * @deprecated 积分/配额系统已下线。保留空函数以兼容导入。
 */
export async function checkAndConsumeQuota(_request: FastifyRequest): Promise<{
  canProceed: boolean
  remaining: number
  message?: string
}> {
  return { canProceed: true, remaining: -1 }
}

/**
 * checkLLMQuota — 检查用户每日 AI 调用配额（已恢复）
 *
 * 从请求中提取 user ID，查询 DailyUsage 表 + MemberPlan 判定
 * 超限返回 { canProceed: false, message } — 调用方需据此阻断
 */
import { checkDailyQuota } from './usage-quota.service.js'

export async function checkLLMQuota(request: FastifyRequest): Promise<{
  canProceed: boolean
  message?: string
}> {
  try {
    const userId = (request as any).user?.id || (request as any).userId
    if (!userId) return { canProceed: true } // 未认证用户不作限制

    const result = await checkDailyQuota(userId)
    if (!result.canProceed) {
      return {
        canProceed: false,
        message: `今日 AI 调用已达限制 ${result.limit} 次，升级 VIP 可解除限制`,
      }
    }

    return { canProceed: true }
  } catch {
    // 配额系统异常时不阻断用户（防御性降级）
    return { canProceed: true }
  }
}
