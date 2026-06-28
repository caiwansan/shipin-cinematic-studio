// ═══════════════════════════════════════════════════════════════
// services/music/registry.ts — 音乐生成提供商注册器
// ═══════════════════════════════════════════════════════════════

import type { MusicProvider, MusicGenerationRequest, MusicGenerationResult } from './types.js'
import { MurekaProvider } from './mureka.provider.js'
import { SunoProvider } from './suno.provider.js'
import { Music15Provider } from './music15.provider.js'

// 歌词生成（使用DeepSeek）
import { env } from '../../config/env.js'

class MusicProviderRegistry {
  private providers = new Map<string, MusicProvider>()

  constructor() {
    this.register(new MurekaProvider())
    this.register(new SunoProvider())
    this.register(new Music15Provider())
  }

  register(provider: MusicProvider) {
    this.providers.set(provider.name, provider)
  }

  get(name: string): MusicProvider | undefined {
    return this.providers.get(name)
  }

  list(): MusicProvider[] {
    return Array.from(this.providers.values())
  }

  /** 列出所有可用提供商及其模型 */
  listWithModels() {
    return this.list().map(p => ({
      id: p.name,
      name: p.displayName,
      models: p.models,
      supportsAudio: p.supportsAudio,
    }))
  }
}

export const musicRegistry = new MusicProviderRegistry()

/**
 * 生成歌曲（通过指定提供商+模型，或者自动使用 DeepSeek 生成歌词）
 * 如果指定了provider则调用对应API生成音频
 * 否则仅用 DeepSeek 生成歌词
 */
export async function generateSong(request: MusicGenerationRequest & { provider?: string }): Promise<MusicGenerationResult> {
  // 1. 如果指定了提供商 → 调用对应音乐生成API
  if (request.provider) {
    const provider = musicRegistry.get(request.provider)
    if (provider && provider.supportsAudio) {
      // 如果没提供歌词，先用 DeepSeek 生成
      if (!request.lyrics) {
        const lyricResult = await generateLyricsOnly(request.style, request.theme, request.mood || '')
        if (lyricResult) {
          request.lyrics = lyricResult.lyrics
          request.title = request.title || lyricResult.title
        }
      }
      return provider.generate(request)
    }
  }

  // 2. 没有指定提供商 → 仅生成歌词
  const lyricResult = await generateLyricsOnly(request.style, request.theme, request.mood || '')
  if (!lyricResult) {
    return {
      success: false,
      title: request.title || '未命名',
      lyrics: '',
      sections: [],
      audioUrl: null,
      status: 'failed',
      error: '歌词生成失败（DeepSeek不可用）',
      provider: 'deepseek',
      model: 'deepseek-chat',
    }
  }

  return {
    success: true,
    title: lyricResult.title,
    lyrics: lyricResult.lyrics,
    sections: lyricResult.sections,
    audioUrl: null,
    status: 'completed',
    message: '歌词已生成！如需要配乐请选择 Mureka/Suno/Music 1.5',
    provider: 'deepseek',
    model: 'deepseek-chat',
  }
}

// 用 DeepSeek 生成歌词
async function generateLyricsOnly(style: string, theme: string, mood: string): Promise<{ title: string; lyrics: string; sections: Array<{ type: string; lines: string[] }> } | null> {
  const apiKey = env.DEEPSEEK_API_KEY
  if (!apiKey) return null

  const moodPrompt = mood ? `情绪：${mood}。` : ''

  const prompt = `请为一首${style}歌曲创作完整的歌词。

歌曲主题：${theme}
${moodPrompt}

要求：
1. 第一行写歌曲标题（不要用书名号）
2. 必须包含：【主歌×2】【副歌×2】【桥段】【尾奏】
3. 语言优美，有画面感，符合${style}风格特点
4. 长度约200-400字
5. 只输出歌词，不要额外说明`

  try {
    const resp = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 2048,
        temperature: 0.8,
      }),
    })

    if (!resp.ok) return null
    const data = await resp.json() as any
    const content: string = data.choices?.[0]?.message?.content || ''
    if (!content.trim()) return null

    const lines = content.trim().split('\n').filter(l => l.trim())
    const title = lines[0]?.replace(/^[#《》「」\s]+/, '').replace(/[#《》「」\s]+$/, '') || '未命名歌曲'
    const lyricContent = lines.slice(1).join('\n').trim()

    return {
      title,
      lyrics: lyricContent,
      sections: parseSections(lyricContent),
    }
  } catch (e) {
    console.error('[Music] DeepSeek lyric generation failed:', (e as Error).message)
    return null
  }
}

function parseSections(raw: string): Array<{ type: string; lines: string[] }> {
  const sections: Array<{ type: string; lines: string[] }> = []
  let currentType = 'verse'
  let currentLines: string[] = []

  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) {
      if (currentLines.length > 0) {
        sections.push({ type: currentType, lines: [...currentLines] })
        currentLines = []
      }
      continue
    }
    const sectionMatch = trimmed.match(/^[【［\[]\s*(.*?)\s*[】］\]](.*)?$/)
    if (sectionMatch) {
      if (currentLines.length > 0) {
        sections.push({ type: currentType, lines: [...currentLines] })
        currentLines = []
      }
      currentType = sectionMatch[1].trim()
      if (sectionMatch[2]?.trim()) {
        currentLines.push(sectionMatch[2].trim())
      }
    } else {
      currentLines.push(trimmed)
    }
  }

  if (currentLines.length > 0) {
    sections.push({ type: currentType, lines: currentLines })
  }

  return sections
}
