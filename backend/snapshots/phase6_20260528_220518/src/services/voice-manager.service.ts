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
  const ctxKey = (getRuntimeContext() as any)?.secrets.aliyunApiKey
  if (ctxKey) return ctxKey
  throw new Error('[RuntimeConstitution] voice-manager 必须通过 RuntimeContext 获取 API Key')
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
   * @returns 音色 ID
   */
  async designVoice(
    description: string,
    targetModel: string = 'cosyvoice-v3.5-plus',
    prefix: string = 'designed',
  ): Promise<{ voiceId: string; voiceName: string; previewAudio?: string }> {
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
        voice_prompt: description,
        preview_text: '今天天气真不错，适合出门散步。你最近过得怎么样？',
      },
    }

    console.log(`[VoiceDesign] 创建音色: ${voiceName}, description=${description}, targetModel=${targetModel}`)

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
      throw new Error(`声音设计失败 (${res.status}): ${err}`)
    }

    const data = await res.json()
    const voiceId = data?.output?.voice || data?.output?.voice_id
    const previewAudio = data?.output?.preview_audio?.data

    if (!voiceId) {
      throw new Error(`声音设计失败: 阿里未返回 voice_id, response=${JSON.stringify(data)}`)
    }

    console.log(`[VoiceDesign] 音色创建成功: voiceId=${voiceId}, voiceName=${voiceName}, hasPreview=${!!previewAudio}`)
    return { voiceId, voiceName, previewAudio }
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
}
