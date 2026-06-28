// ═══════════════════════════════════════════════════════════════
// services/music/music15.provider.ts — Music 1.5 API 适配器
// ═══════════════════════════════════════════════════════════════
// Music 1.5 API: https://api.music15.ai/v1
// 模型: music-1.5, music-1.5-pro
// 端点: POST /music/generate — 生成音乐
// ═══════════════════════════════════════════════════════════════

import type { MusicProvider, MusicGenerationRequest, MusicGenerationResult, MusicProviderConfig } from './types.js'
import { env } from '../../config/env.js'

export class Music15Provider implements MusicProvider {
  readonly name = 'music15'
  readonly displayName = 'Music 1.5'
  readonly supportsAudio = true
  readonly models = ['music-1.5', 'music-1.5-pro']

  private config: MusicProviderConfig

  constructor(config?: Partial<MusicProviderConfig>) {
    this.config = {
      apiKey: config?.apiKey || env.MUSIC15_API_KEY || '',
      baseUrl: config?.baseUrl || env.MUSIC15_BASE_URL || 'https://api.music15.ai/v1',
    }
  }

  async generate(request: MusicGenerationRequest): Promise<MusicGenerationResult> {
    if (!this.config.apiKey) {
      return this.fallback(request, 'Music 1.5 API Key 未配置')
    }

    if (request.lyricsOnly) {
      return this.fallback(request, 'Music 1.5 不支持仅歌词生成')
    }

    try {
      const payload: Record<string, any> = {
        model: 'music-1.5',
        prompt: request.theme,
        style: request.style,
        title: request.title || '',
        duration: request.duration || 60,
      }
      if (request.lyrics) payload.lyrics = request.lyrics
      if (request.mood) payload.mood = request.mood

      const resp = await fetch(`${this.config.baseUrl}/music/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify(payload),
      })

      if (!resp.ok) {
        const errText = await resp.text().catch(() => '')
        return this.fallback(request, `Music 1.5 API 错误 (${resp.status}): ${errText}`)
      }

      const data = await resp.json() as any
      return {
        success: true,
        title: data.title || request.title || '未命名歌曲',
        lyrics: data.lyrics || '',
        sections: [],
        audioUrl: data.audio_url || data.audioUrl || null,
        taskId: data.task_id || data.id,
        status: 'completed',
        provider: this.name,
        model: 'music-1.5',
      }
    } catch (e: any) {
      return this.fallback(request, `Music 1.5 调用失败: ${e.message}`)
    }
  }

  async getTaskStatus(taskId: string): Promise<{ status: string; audioUrl?: string }> {
    try {
      const resp = await fetch(`${this.config.baseUrl}/music/task/${taskId}`, {
        headers: { 'Authorization': `Bearer ${this.config.apiKey}` },
      })
      if (!resp.ok) return { status: 'unknown' }
      const data = await resp.json() as any
      return {
        status: data.status || 'unknown',
        audioUrl: data.audio_url || data.audioUrl,
      }
    } catch {
      return { status: 'unknown' }
    }
  }

  private fallback(request: MusicGenerationRequest, reason: string): MusicGenerationResult {
    return {
      success: false,
      title: request.title || '未命名',
      lyrics: request.lyrics || '',
      sections: [],
      audioUrl: null,
      status: 'failed',
      error: reason,
      provider: this.name,
      model: 'music-1.5',
    }
  }
}
