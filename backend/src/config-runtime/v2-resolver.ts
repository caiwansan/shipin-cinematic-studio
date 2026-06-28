/**
 * config-runtime/v2-resolver.ts
 *
 * ❗ 唯一用户配置源（V2 ONLY）
 * 仅从 UserModelConfigV2 表读取，不 fallback 到任何其他源
 */

import { getSystemConfig } from './bootstrap'
import { UserLLMConfig, V2DbRecord } from './types'
import { decryptKey } from '../services/crypto.service'
import { prisma } from '../utils'

/**
 * 从 V2 表解析用户 LLM 配置
 * 解密失败直接抛错（不静默跳过）
 *
 * 非 UUID userId 时 Prisma 会抛异常，此时 fallback 到环境变量 DEEPSEEK_API_KEY
 */
export async function resolveUserLLMConfig(userId: string): Promise<UserLLMConfig | null> {
  // ⭐ anonymous/系统标记用户直接走 fallback，跳过 UUID 查询
  if (!userId || userId === 'anonymous' || userId === '__system_anonymous__') {
    return resolveFallbackConfig()
  }

  // 1. 从 V2 表读取（graceful UUID error → fallback）
  let record: V2DbRecord | null = null
  let uuidError = false
  try {
    record = await prisma.userModelConfigV2.findUnique({
      where: { userId },
    }) as V2DbRecord | null
  } catch (err: any) {
    uuidError = true
    console.warn(`[V2_RESOLVER] UUID 查询失败，userId=${userId.substring(0, 8)}, fallback: ${err.message}`)
  }

  if (!record && !uuidError) {
    console.warn(`[V2_RESOLVER] 用户 ${userId.substring(0, 8)} 无 V2 配置记录`)
  }

  // 2. 没有 V2 记录时，尝试使用系统首个可用配置作为 fallback
  if (!record) {
    return resolveFallbackConfig()
  }

  if (!record.llmEnabled) {
    console.warn(`[V2_RESOLVER] 用户 ${userId.substring(0, 8)} LLM 未启用`)
    return null
  }

  if (!record.llmApiKey) {
    console.warn(`[V2_RESOLVER] 用户 ${userId.substring(0, 8)} 未配置 LLM API Key`)
    return null
  }

  // 2. 解密（失败直接抛错）
  let apiKey: string
  try {
    apiKey = decryptKey(record.llmApiKey)
  } catch (err: any) {
    throw new Error(
      `[V2_RESOLVER] ❌ 用户 ${userId.substring(0, 8)} V2 配置解密失败：${err.message}。` +
      '这通常是 CRYPTO_ENCRYPTION_KEY 不一致导致的。'
    )
  }

  return {
    provider: record.llmProvider || 'volcengine',
    model: record.llmModel || 'doubao-seed-1-6-251015',
    apiKey,
    baseUrl: record.baseUrl || undefined,
    source: 'V2_DB',
  }
}

/**
 * 从 V2 表解析用户图片/视频/TTS 配置（供 downstream 使用）
 * 同样只读 V2，不 fallback
 */


/**
 * 公共 fallback：尝试系统首个 V2 配置 → 环境变量
 * 用于 anonymous / 非 UUID 用户
 */
async function resolveFallbackConfig(): Promise<UserLLMConfig | null> {
  try {
    const first = await prisma.$queryRawUnsafe<
      Array<{ uid: string; provider: string; model: string; key: string }>
    >(
      `SELECT "userId" as uid, "llmProvider" as provider, "llmModel" as model, "llmApiKey" as key FROM "UserModelConfigV2" WHERE "llmEnabled" = true AND "llmApiKey" IS NOT NULL ORDER BY CASE "llmProvider" WHEN 'bailian' THEN 0 WHEN 'volcengine' THEN 1 WHEN 'deepseek' THEN 2 ELSE 3 END LIMIT 1`
    )
    if (first?.[0]?.key) {
      const apiKey = decryptKey(first[0].key)
      console.log(`[V2_RESOLVER] ✅ 使用首公共 V2 配置 fallback: provider=${first[0].provider}, model=${first[0].model}`)
      return {
        provider: first[0].provider,
        model: first[0].model,
        apiKey,
        source: 'V2_FALLBACK',
      }
    }
  } catch (fbErr: any) {
    console.warn(`[V2_RESOLVER] fallback 失败: ${fbErr.message}`)
  }
  // 最后尝试环境变量
  const envKey = process.env.DEEPSEEK_API_KEY
  if (envKey) {
    console.log(`[V2_RESOLVER] fallback 到 ENV: DEEPSEEK_API_KEY`)
    return {
      provider: 'deepseek',
      model: process.env.DEEPSEEK_LLM_MODEL || 'deepseek-chat',
      apiKey: envKey,
      source: 'ENV_FALLBACK',
    }
  }
  return null
}

export async function resolveUserImageConfig(userId: string): Promise<{
  provider: string
  model: string
  apiKey: string
} | null> {
  const record = await prisma.userModelConfigV2.findUnique({
    where: { userId },
  }) as V2DbRecord | null

  if (!record || !record.imageEnabled || !record.imageApiKey) return null

  let apiKey: string
  try {
    apiKey = decryptKey(record.imageApiKey)
  } catch {
    throw new Error(`[V2_RESOLVER] ❌ 用户 ${userId.substring(0, 8)} 图片配置解密失败`)
  }

  return {
    provider: record.imageProvider || 'volcengine',
    model: record.imageModel || 'doubao-seedream-4-5-251128',
    apiKey,
  }
}

export async function resolveUserVideoConfig(userId: string): Promise<{
  provider: string
  model: string
  apiKey: string
} | null> {
  const record = await prisma.userModelConfigV2.findUnique({
    where: { userId },
  }) as V2DbRecord | null

  if (!record || !record.videoEnabled || !record.videoApiKey) return null

  let apiKey: string
  try {
    apiKey = decryptKey(record.videoApiKey)
  } catch {
    throw new Error(`[V2_RESOLVER] ❌ 用户 ${userId.substring(0, 8)} 视频配置解密失败`)
  }

  return {
    provider: record.videoProvider || 'volcengine',
    model: record.videoModel || 'doubao-seedance-1-5-pro-251215',
    apiKey,
  }
}
