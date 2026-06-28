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
 */
export async function resolveUserLLMConfig(userId: string): Promise<UserLLMConfig | null> {
  // 1. 从 V2 表读取
  const record = await prisma.userModelConfigV2.findUnique({
    where: { userId },
  }) as V2DbRecord | null

  if (!record) {
    console.warn(`[V2_RESOLVER] 用户 ${userId.substring(0, 8)} 无 V2 配置记录`)
    return null
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
