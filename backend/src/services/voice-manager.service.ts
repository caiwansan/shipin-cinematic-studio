/**
 * 阿里百炼音色管理服务
 *
 * 支持：
 * - 声音设计（Voice Design）：用文字描述创建全新音色
 * - 声音复刻（Voice Cloning）：上传音频样本复制音色
 * - 音色列表：获取所有已创建的自定义音色
 * - 删除音色
 *
 * API 文档：https://help.aliyun.com/zh/model-studio/voice-cloning-user-guide
 */

import { env } from '../config/env.js'
import { prisma } from '../utils/index.js'
import { getRuntimeContext } from './runtime-context.js'

function getApiKey(): string {
  // BYOK 宪法：仅从 RuntimeContext（ALS）读取，不允许 env/硬编码降级
  const ctxKey = (getRuntimeContext() as any)?.secrets?.aliyunApiKey
  if (ctxKey) return ctxKey
  throw new Error('未配置阿里百炼 API Key（BYOK 宪法禁止从环境变量读取）')
}

const BASE_URL = 'https://dashscope.aliyuncs.com'

/**
 * 获取音色管理 API 端点
 */
function getVoiceEnrollUrl(): string {
  return `${BASE_URL}/api/v1/services/audio/tts/customization`
}

/**
 * 阿里百炼音色管理接口
 */
export const voiceService = {
  /**
   * 声音设计 — 用文字描述创建音色
   * 
   * 文档：https://help.aliyun.com/zh/model-studio/voice-cloning-user-guide
   * 
   * @param description 音色文字描述，如"温暖低沉的中国成年男性声音"
   * @param targetModel 目标语音合成模型（如 cosyvoice-v3.5-plus）
   * @param prefix 音色名称前缀
   * @param customApiKey 可选的自定义 API Key（来自用户配置），不传则从环境变量读
   * @returns 音色 ID
   */
  async designVoice(
    description: string,
    targetModel: string = 'cosyvoice-v3.5-plus',
    prefix: string = 'designed',
    customApiKey?: string,
  ): Promise<{ voiceId: string; voiceName: string; previewAudio?: string }> {
    const apiKey = customApiKey || getApiKey()
    if (!apiKey) throw new Error('ALIYUN_API_KEY 未配置')

    const timestamp = Date.now().toString(36)
    // prefix 只保留英文字母和数字（阿里百炼要求，不含下划线）
    const safePrefix = prefix.replace(/[^a-zA-Z0-9]/g, '').substring(0, 12) || 'v'
    const voiceName = `${safePrefix}_${timestamp}`

    const body = {
      model: 'voice-enrollment',
      input: {
        action: 'create_voice',
        target_model: targetModel,
        prefix: safePrefix,
        voice_prompt: description,
        preview_text: '今天天气真不错，适合出门散步。你最近过得怎么样？',
      },
    }

    console.log(`[VoiceDesign] 创建音色: ${voiceName}, description=${description}, targetModel=${targetModel}`)

    // Phase 2 音色安全：自动重试最多 3 次（阿里百炼偶发限流/资源不足）
    const MAX_RETRIES = 3
    let lastError: Error | null = null

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const res = await fetch(getVoiceEnrollUrl(), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(30000),
        })

        if (!res.ok) {
          const err = await res.text()
          const status = res.status
          // 4xx 类错误（参数问题）不重试，直接抛
          if (status >= 400 && status < 500) {
            throw new Error(`声音设计失败 (${status}): ${err}`)
          }
          // 5xx 重试
          throw new Error(`声音设计失败 (${status}): ${err}`)
        }

        const data = await res.json()
        const voiceId = data?.output?.voice || data?.output?.voice_id
        const previewAudio = data?.output?.preview_audio?.data

        if (!voiceId) {
          throw new Error(`声音设计失败: 阿里未返回 voice_id, response=${JSON.stringify(data)}`)
        }

        console.log(`[VoiceDesign] ✅ 音色创建成功: voiceId=${voiceId}, voiceName=${voiceName}, hasPreview=${!!previewAudio}`)
        return { voiceId, voiceName, previewAudio }
      } catch (e: any) {
        lastError = e
        // 4xx 不重试
        if (e.message.includes('(4') && e.message.includes('):')) {
          throw e
        }
        if (attempt < MAX_RETRIES) {
          const delay = attempt * 1000
          console.log(`[VoiceDesign] ⚠️ 第 ${attempt} 次尝试失败 (${e.message}), ${delay}ms 后重试...`)
          await new Promise(r => setTimeout(r, delay))
        }
      }
    }

    // 所有重试耗尽
    throw lastError || new Error('声音设计失败: 重试耗尽')
  },

  /**
   * 声音复刻 — 上传音频样本复制音色
   * 
   * @param audioUrl 可公网访问的音频文件 URL（WAV/MP3/M4A，10~60秒，≤10MB）
   * @param targetModel 目标语音合成模型
   * @param prefix 音色名称前缀
   * @returns 音色 ID
   */
  async cloneVoice(
    audioUrl: string,
    targetModel: string = 'cosyvoice-v3.5-plus',
    prefix: string = 'cloned',
  ): Promise<{ voiceId: string; voiceName: string }> {
    const apiKey = getApiKey()
    if (!apiKey) throw new Error('ALIYUN_API_KEY 未配置')

    const timestamp = Date.now().toString(36)
    const voiceName = `${prefix}_${timestamp}`

    const body = {
      model: 'voice-enrollment',
      input: {
        action: 'create_voice',
        target_model: targetModel,
        prefix: prefix,
        url: audioUrl,
      },
    }

    console.log(`[VoiceClone] 开始复刻音色: url=${audioUrl.substring(0, 60)}...`)

    const res = await fetch(getVoiceEnrollUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60000),
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`声音复刻失败 (${res.status}): ${err}`)
    }

    const data = await res.json()
    const voiceId = data?.output?.voice_id || data?.output?.voice

    if (!voiceId) {
      throw new Error(`声音复刻失败: 阿里未返回 voice_id, response=${JSON.stringify(data)}`)
    }

    console.log(`[VoiceClone] 音色复刻成功: voiceId=${voiceId}`)
    return { voiceId, voiceName }
  },

  /**
   * 获取声音复刻/设计的音色列表（从阿里）
   * 
   * 注意：阿里 API 目前不直接提供音色查询，这里从本地数据库获取
   */
  async listVoices(): Promise<any[]> {
    return prisma.voicePreset.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        voiceId: true,
        description: true,
        type: true,
        targetModel: true,
        createdAt: true,
      },
    })
  },

  /**
   * 删除已保存的音色记录（本地数据库删除，阿里侧需等待 API 支持）
   */
  async deleteVoice(id: string): Promise<void> {
    await prisma.voicePreset.delete({ where: { id } })
    console.log(`[VoiceManager] 已删除音色记录: ${id}`)
  },

  // ─── 火山引擎音色设计 ───
  /**
   * 火山引擎音色设计 — 用文字描述创建自定义音色（豆包语音）
   * 端点：POST https://ark.cn-beijing.volces.com/api/v3/tts/voice-design
   *
   * 认证方式：
   * - X-Api-Key: <api-key> + X-Api-Resource-Id: seed-tts-2.0（豆包语音直调，推荐）
   * - Authorization: Bearer <ark-api-key>（ARK 标准，需要先发布 endpoint）
   */
  async designVoiceVolc(
    description: string,
    _targetModel: string = 'seed-tts-2.0',
    prefix: string = 'designed',
    apiKey?: string,
  ): Promise<{ voiceId: string; voiceName: string; previewAudio?: string }> {
    if (!apiKey) {
      const ctxKey = (getRuntimeContext() as any)?.secrets?.volcengineApiKey
      if (ctxKey) apiKey = ctxKey
      if (!apiKey) throw new Error('火山引擎 API Key 未配置')
    }

    const timestamp = Date.now().toString(36)
    const safePrefix = prefix.replace(/[^a-zA-Z0-9]/g, '').substring(0, 12) || 'v'
    const voiceName = `${safePrefix}_${timestamp}`

    const body: Record<string, any> = {
      voice_name: voiceName,
      voice_prompt: description,
    }

    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (apiKey.startsWith('Bearer ')) {
      headers['Authorization'] = apiKey
      body['tts_model'] = 'seed-tts-2.0'
    } else {
      headers['X-Api-Key'] = apiKey
      headers['X-Api-Resource-Id'] = 'seed-tts-2.0'
    }

    const BASE = 'https://ark.cn-beijing.volces.com/api/v3/tts/voice-design'
    console.log(`[VoiceDesignVolc] 创建音色: ${voiceName}, desc=${description.slice(0, 80)}`)

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const res = await fetch(BASE, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(30000),
        })
        if (!res.ok) {
          const err = await res.text().catch(() => '(empty)')
          if (res.status >= 400 && res.status < 500 && res.status !== 429) {
            throw new Error(`火山引擎音色设计失败 (${res.status}): ${err.slice(0, 300)}`)
          }
          throw new Error(`火山引擎音色设计失败 (${res.status}): ${err.slice(0, 300)}`)
        }
        const data = await res.json()
        const voiceId = data?.data?.voice_id || data?.voice_id || data?.data?.voice
        const previewAudio = data?.data?.preview_audio?.data || data?.preview_audio
        if (!voiceId) throw new Error(`未返回 voice_id: ${JSON.stringify(data).slice(0, 200)}`)
        console.log(`[VoiceDesignVolc] ✅ 音色: ${voiceName} => voiceId=${voiceId}`)
        return { voiceId, voiceName, previewAudio }
      } catch (e: any) {
        if (e.message.includes('(4') && !e.message.includes('429') && !e.message.includes('(5')) throw e
        if (attempt < 3) await new Promise(r => setTimeout(r, attempt * 1500))
        else throw e
      }
    }
    throw new Error('火山引擎音色设计失败: 重试耗尽')
  },
}
