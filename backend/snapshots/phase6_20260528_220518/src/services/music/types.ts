// ═══════════════════════════════════════════════════════════════
// services/music/types.ts — 音乐生成通用类型
// ═══════════════════════════════════════════════════════════════

export interface MusicGenerationRequest {
  /** 风格中文名：国风古风/流行/R&B/电子/民谣/摇滚/古典/爵士 */
  style: string
  /** 歌曲主题描述 */
  theme: string
  /** 情绪：欢快/伤感/激昂/宁静 */
  mood?: string
  /** 歌词（可选，有歌词则直接使用，不再生成） */
  lyrics?: string
  /** 歌名（可选） */
  title?: string
  /** 时长（秒）默认60 */
  duration?: number
  /** 是否只生成歌词不生成音频 */
  lyricsOnly?: boolean
}

export interface MusicGenerationResult {
  success: boolean
  /** 歌曲标题 */
  title: string
  /** 完整歌词文本 */
  lyrics: string
  /** 歌词段落解析 */
  sections: Array<{ type: string; lines: string[] }>
  /** 音频URL（生成完成后才有） */
  audioUrl?: string | null
  /** 任务ID（异步任务） */
  taskId?: string
  /** 任务状态 */
  status?: 'pending' | 'processing' | 'completed' | 'failed'
  /** 错误信息 */
  error?: string
  /** 成功消息 */
  message?: string
  /** 提供商标识 */
  provider: string
  /** 所用的模型名 */
  model?: string
}

export interface MusicProvider {
  readonly name: string
  readonly displayName: string
  /** 支持的模型列表 */
  readonly models: string[]
  /** 是否支持真实音频生成 */
  readonly supportsAudio: boolean
  /** 生成歌曲（歌词／音频） */
  generate(request: MusicGenerationRequest): Promise<MusicGenerationResult>
  /** 查询任务状态 */
  getTaskStatus?(taskId: string): Promise<{ status: string; audioUrl?: string }>
}

export interface MusicProviderConfig {
  apiKey: string
  baseUrl: string
}
