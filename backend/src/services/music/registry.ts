// services/music/registry.ts — 音乐生成提供商注册器
// 歌词通过 昆仑镜统一 AI 网关 + 用户配置的 LLM 大模型生成
// 音频合成需要用户配置 Suno/天工/Mureka 等音乐合成 API Key

import type { MusicProvider, MusicGenerationRequest, MusicGenerationResult, MusicProviderConfig } from './types.js'
import { MurekaProvider } from './mureka.provider.js'
import { SunoProvider } from './suno.provider.js'
import { Music15Provider } from './music15.provider.js'
import {
  buildLyricsSystemPrompt,
  buildLyricsUserPrompt,
  parseLyricsOutput,
} from './lyrics-agent.js'
import { unifiedAIGateway } from '../unified-ai-gateway.js'
import { prisma } from '../../utils/index.js'
import { decryptKey } from '../crypto.service.js'

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

  /**
   * 创建一个携带用户自定义 API Key 的 provider 实例
   */
  createWithConfig(name: string, config: Partial<MusicProviderConfig>): MusicProvider | null {
    switch (name) {
      case 'mureka': return new MurekaProvider(config)
      case 'suno': return new SunoProvider(config)
      case 'music15': return new Music15Provider(config)
      default: return null
    }
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
 * 生成歌曲
 * 
 * 歌词：通过 unifiedAIGateway（用户配置的 LLM 大模型）生成
 * 音频：由用户选择的音乐合成 Provider（Suno/天工/Mureka）生成
 * 
 * 工作流：
 * 1. 若未提供 lyrics → 歌词 Agent → unifiedAIGateway（走用户 LLM 配置）
 * 2. 若指定了 provider → 调用对应音乐合成 API
 * 3. 无 provider → 仅返回歌词（status: lyrics_ready）
 */
export async function generateSong(
  request: MusicGenerationRequest & {
    provider?: string
    userId?: string
    projectId?: string
  }
): Promise<MusicGenerationResult> {
  // 1. 如果没提供歌词，用专业歌词 Agent 生成
  if (!request.lyrics) {
    const lyricResult = await generateLyricsWithAgent(
      request.style,
      request.theme,
      request.mood || '',
      request.userId || 'system',
      request.projectId || 'music',
    )
    if (lyricResult) {
      request.lyrics = lyricResult.lyrics
      request.title = request.title || lyricResult.title
    }
  }

  // 2. 如果指定了音频提供商 → 调用对应音乐生成 API
  if (request.provider) {
    const provider = musicRegistry.get(request.provider)

    if (provider && provider.supportsAudio) {
      // 从数据库取用户的自定义 API Key（优先于环境变量）
      const userId = request.userId || 'system'
      let userConfig: Partial<MusicProviderConfig> | undefined

      // 只有合法 UUID 才去查数据库
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
        try {
          const v2 = await prisma.userModelConfigV2.findUnique({ where: { userId } })
          if (v2?.musicApiKey) {
            const decrypted = decryptKey(v2.musicApiKey)
            userConfig = {
              apiKey: decrypted,
              baseUrl: v2.baseUrl || undefined,
            }
          }
        } catch {
          // 数据库查询失败，使用环境变量默认值
        }
      }

      // 用用户配置的 API Key 重新构造 provider 实例
      const configuredProvider = userConfig?.apiKey
        ? musicRegistry.createWithConfig(request.provider, userConfig)
        : null
      if (configuredProvider) {
        return configuredProvider.generate(request)
      }

      // 回退：用默认 provider（环境变量中的 Key）
      return provider.generate(request)
    }
  }

  // 3. 没有音频提供商 → 仅返回歌词
  if (!request.lyrics) {
    return {
      success: false,
      title: request.title || '未命名',
      lyrics: '',
      sections: [],
      audioUrl: null,
      status: 'failed',
      error: '歌词生成失败（请检查大模型设置中 LLM 的 API Key 是否有效）',
      provider: 'llm-agent',
      model: 'user-llm',
    }
  }

  return {
    success: true,
    title: request.title || '未命名',
    lyrics: request.lyrics,
    sections: parseSections(request.lyrics),
    audioUrl: null,
    status: 'lyrics_ready',
    message: '歌词已生成！如需配乐，请在大模型设置中配置音乐模型 API Key',
    provider: 'llm-agent',
    model: 'user-llm',
  }
}

/**
 * 调用歌词创作 Agent
 * 
 * 通过昆仑镜 unifiedAIGateway 走用户自己的 LLM 大模型
 * （用户在「大模型设置」中配置的 LLM Provider + API Key + 模型名）
 * 
 * 用户可自由选择：
 * - DeepSeek Chat
 * - 通义千问
 * - 文心一言
 * - 豆包
 * - 等任意国内大模型
 * 
 * 调用链路：
 * 用户 LLM 配置 → unifiedAIGateway → 专业歌词 Prompt → 格律押韵歌词
 */
async function generateLyricsWithAgent(
  style: string,
  theme: string,
  mood: string,
  userId: string,
  projectId: string,
): Promise<{ title: string; lyrics: string; sections: Array<{ type: string; lines: string[] }> } | null> {
  const systemPrompt = buildLyricsSystemPrompt()
  const userPrompt = buildLyricsUserPrompt({ theme, style, mood })

  try {
    // 通过 unifiedAIGateway 调用用户配置的 LLM 大模型
    const envelope = await unifiedAIGateway.invokeAI({
      userId,
      projectId,
      agentType: 'lyrics-composer',
      capability: 'llm',
      input: {
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        maxTokens: 2048,
        temperature: 0.85,
      },
    })

    if (envelope.status !== 'success' || !envelope.output) {
      console.error('[Music] Lyrics generation failed via unifiedAIGateway:', envelope.error)
      return null
    }

    // 解析输出
    const content: string = typeof envelope.output === 'string'
      ? envelope.output
      : (envelope.output as any)?.text || (envelope.output as any)?.content || ''

    if (!content.trim()) return null

    return parseLyricsOutput(content)
  } catch (e) {
    console.error('[Music] Lyrics generation error:', (e as Error).message)
    return null
  }
}

/**
 * 解析歌词段落结构
 */
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
