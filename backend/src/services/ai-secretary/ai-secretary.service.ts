/**
 * ai-secretary.service.ts — 昆仑会议 AI 秘书服务
 * 
 * 功能：
 * 1. 实时语音转文字（Whisper）— 采集所有参会者音频
 * 2. 在线视频音频捕获 — 录下视频中播放的声音
 * 3. 发言人归属 — 记录每个人的发言
 * 4. AI 纪要生成 — 使用用户配置的 LLM 生成结构化纪要
 * 
 * 架构：
 * - 每个会议一个 Secretary 实例
 * - 音频通过 WebSocket 实时传输到服务端 Whisper worker 池
 * - Whisper worker 池化（多进程），支持多人同时说话并发转写
 * - 纪要生成使用 UserModelConfigV2 中的用户配置（平台不提供大模型服务）
 */

import { prisma } from '../../utils/index.js'
import { whisperStream } from '../whisper-stream.service.js'

// ── 类型 ──
export interface TranscriptEntry {
  id: string
  meetingId: string
  userUid: string
  speakerName: string
  content: string
  language: string
  confidence: number
  isFinal: boolean
  audioDurationMs: number
  createdAt: Date
  sortOrder: number
}

export interface RecordingEntry {
  id: string
  meetingId: string
  userUid: string
  recordingType: 'mic' | 'screen' | 'video'
  audioUrl?: string
  audioDurationMs: number
  status: 'recording' | 'processing' | 'done' | 'error'
  errorMessage?: string
  createdAt: Date
  endedAt?: Date
}

export interface SpeakerTranscript {
  userUid: string
  speakerName: string
  segments: { text: string; timestamp: number; duration: number }[]
  totalDuration: number
}

// ── AI 秘书实例（每个会议一个）──
class AiSecretaryInstance {
  meetingId: string
  hostUid: string
  private transcripts: TranscriptEntry[] = []
  private recordings: RecordingEntry[] = []
  private sortCounter = 0
  private whisperSessions = new Map<string, { lang: string; buffer: Buffer[] }>()
  private isRecording = false
  private startTime = Date.now()
  private speakerNames = new Map<string, string>()

  constructor(meetingId: string, hostUid: string) {
    this.meetingId = meetingId
    this.hostUid = hostUid
  }

  setSpeakerName(uid: string, name: string) {
    this.speakerNames.set(uid, name)
  }

  getSpeakerName(uid: string): string {
    return this.speakerNames.get(uid) || uid.slice(0, 6)
  }

  async start() {
    this.isRecording = true
    this.startTime = Date.now()
    await prisma.$queryRawUnsafe(
      `UPDATE meeting SET ai_secretary_status = 'recording' WHERE id = $1`,
      this.meetingId
    )
    console.log(`[AI秘书] 会议 ${this.meetingId} 开始录制`)
  }

  async stop() {
    this.isRecording = false
    // 完成所有 Whisper 会话
    for (const [uid, session] of this.whisperSessions) {
      if (session.buffer.length > 0) {
        whisperStream.finalize(`${this.meetingId}-${uid}`, session.lang)
      }
    }
    // 清理所有 whisper 会话
    for (const uid of this.whisperSessions.keys()) {
      whisperStream.resetSession(`${this.meetingId}-${uid}`)
    }
    this.whisperSessions.clear()

    await prisma.$queryRawUnsafe(
      `UPDATE meeting SET ai_secretary_status = 'transcribing' WHERE id = $1`,
      this.meetingId
    )
    console.log(`[AI秘书] 会议 ${this.meetingId} 录制结束，开始整理`)
  }

  /**
   * 处理实时音频帧（来自 WebRTC track）
   */
  async feedAudio(uid: string, pcmData: Buffer, lang = 'zh') {
    if (!this.isRecording) return
    const sessionId = `${this.meetingId}-${uid}`

    if (!this.whisperSessions.has(uid)) {
      this.whisperSessions.set(uid, { lang, buffer: [] })
      whisperStream.initSession(sessionId, lang, {
        onPartial: (_text) => {
          // 中间结果：不保存到 DB，仅缓存
        },
        onFinal: (text) => {
          if (text && text.trim()) {
            this.addTranscript(uid, text.trim(), lang, true).catch(console.error)
          }
        },
        onError: (err) => {
          console.warn(`[AI秘书] Whisper 错误 (${uid}):`, err)
        }
      }).catch(console.error)
    }

    const session = this.whisperSessions.get(uid)!
    session.buffer.push(pcmData)
    whisperStream.feed(sessionId, lang, pcmData)
  }

  /**
   * 添加转写记录
   */
  private async addTranscript(uid: string, content: string, language: string, isFinal: boolean) {
    const sortOrder = ++this.sortCounter
    const speakerName = this.getSpeakerName(uid)

    const entry: TranscriptEntry = {
      id: '',
      meetingId: this.meetingId,
      userUid: uid,
      speakerName,
      content,
      language,
      confidence: 0.85,
      isFinal,
      audioDurationMs: 0,
      createdAt: new Date(),
      sortOrder
    }

    this.transcripts.push(entry)

    try {
      await prisma.$queryRawUnsafe(
        `INSERT INTO meeting_transcript (id, meeting_id, user_uid, speaker_name, content, language, confidence, is_final, sort_order)
         VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8)`,
        this.meetingId, uid, speakerName, content, language, entry.confidence, isFinal, sortOrder
      )
    } catch (e) {
      console.warn('[AI秘书] 转写写入失败:', (e as Error).message)
    }
  }

  /**
   * 添加外部转写（如视频中的音频转写）
   */
  async addExternalTranscript(sourceLabel: string, content: string, language = 'zh') {
    await this.addTranscript(`external-${sourceLabel}`, `[${sourceLabel}] ${content}`, language, true)
  }

  /**
   * 创建录音记录
   */
  async createRecording(uid: string, type: 'mic' | 'screen' | 'video'): Promise<string> {
    const result = await prisma.$queryRawUnsafe(
      `INSERT INTO meeting_recording (meeting_id, user_uid, recording_type, status)
       VALUES ($1, $2, $3, 'recording') RETURNING id`,
      this.meetingId, uid, type
    )
    const id = (result as any)[0].id
    const entry: RecordingEntry = {
      id,
      meetingId: this.meetingId,
      userUid: uid,
      recordingType: type,
      audioDurationMs: 0,
      status: 'recording',
      createdAt: new Date()
    }
    this.recordings.push(entry)
    return id
  }

  /**
   * 完成录音
   */
  async finishRecording(recordingId: string, audioUrl?: string, durationMs = 0) {
    const rec = this.recordings.find(r => r.id === recordingId)
    if (rec) {
      rec.status = 'done'
      rec.audioUrl = audioUrl
      rec.audioDurationMs = durationMs
      rec.endedAt = new Date()
    }
    await prisma.$queryRawUnsafe(
      `UPDATE meeting_recording SET status='done', audio_url=$2, audio_duration_ms=$3, ended_at=NOW() WHERE id=$1`,
      recordingId, audioUrl, durationMs
    )
  }

  /**
   * 获取所有转写（按时间排序）
   */
  getTranscripts(): TranscriptEntry[] {
    return [...this.transcripts].sort((a, b) => a.sortOrder - b.sortOrder)
  }

  /**
   * 获取按发言人分组的转写
   */
  getSpeakerTranscripts(): SpeakerTranscript[] {
    const map = new Map<string, SpeakerTranscript>()
    for (const t of this.transcripts) {
      let sp = map.get(t.userUid)
      if (!sp) {
        sp = {
          userUid: t.userUid,
          speakerName: t.speakerName,
          segments: [],
          totalDuration: 0
        }
        map.set(t.userUid, sp)
      }
      sp.segments.push({
        text: t.content,
        timestamp: t.createdAt.getTime(),
        duration: t.audioDurationMs
      })
      sp.totalDuration += t.audioDurationMs
    }
    return Array.from(map.values())
  }

  /**
   * 生成 AI 纪要（使用用户配置的 LLM）
   */
  async generateMinutes(): Promise<{ summary: string; content: any } | null> {
    const speakerTranscripts = this.getSpeakerTranscripts()
    if (speakerTranscripts.length === 0) {
      console.log('[AI秘书] 无转写内容，跳过纪要生成')
      return null
    }

    await prisma.$queryRawUnsafe(
      `UPDATE meeting SET ai_secretary_status = 'summarizing' WHERE id = $1`,
      this.meetingId
    )

    const transcriptText = this.formatTranscriptForSummary(speakerTranscripts)
    const llmResult = await this.callLlmForSummary(transcriptText)

    if (!llmResult) {
      // LLM 不可用，降级为简单摘要
      const fallback = this.generateSimpleSummary(transcriptText)
      const content = this.parseStructuredMinutes(fallback, speakerTranscripts)
      await this.saveMinutes(fallback, content, 0)
      return { summary: fallback, content }
    }

    const content = this.parseStructuredMinutes(llmResult.text, speakerTranscripts)
    await this.saveMinutes(llmResult.text, content, llmResult.tokens)

    return { summary: llmResult.text, content }
  }

  /**
   * 保存纪要到数据库
   */
  private async saveMinutes(summary: string, content: any, tokens: number) {
    await prisma.$queryRawUnsafe(
      `INSERT INTO meeting_minutes (meeting_id, summary, content, generated_at, model_used, token_count)
       VALUES ($1, $2, $3::jsonb, NOW(), $4, $5)
       ON CONFLICT (meeting_id) DO UPDATE SET
         summary = EXCLUDED.summary,
         content = EXCLUDED.content,
         generated_at = EXCLUDED.generated_at,
         model_used = EXCLUDED.model_used,
         token_count = EXCLUDED.token_count,
         updated_at = NOW()`,
      this.meetingId, summary, JSON.stringify(content), 'user-llm', tokens
    )

    await prisma.$queryRawUnsafe(
      `UPDATE meeting SET summary = $1, ai_secretary_status = 'done' WHERE id = $2`,
      content.summary || summary.slice(0, 200), this.meetingId
    )
  }

  /**
   * 格式化转写文本供 LLM 使用
   */
  private formatTranscriptForSummary(speakers: SpeakerTranscript[]): string {
    const lines: string[] = []
    for (const sp of speakers) {
      lines.push(`## ${sp.speakerName}（${(sp.totalDuration / 1000).toFixed(0)}秒）`)
      for (const seg of sp.segments) {
        const ts = new Date(seg.timestamp)
        const timeStr = `${String(ts.getHours()).padStart(2, '0')}:${String(ts.getMinutes()).padStart(2, '0')}:${String(ts.getSeconds()).padStart(2, '0')}`
        lines.push(`[${timeStr}] ${seg.text}`)
      }
      lines.push('')
    }
    return lines.join('\n')
  }

  /**
   * 调用 LLM 生成纪要（使用用户自己配置的 API Key）
   * 平台不提供大模型服务，全部走用户个人配置
   * @returns { text, tokens } 或 null（LLM 不可用时）
   */
  private async callLlmForSummary(transcriptText: string): Promise<{ text: string; tokens: number } | null> {
    const hostConfig = await prisma.userModelConfigV2.findUnique({
      where: { userId: this.hostUid }
    })

    if (!hostConfig || !hostConfig.llmEnabled || !hostConfig.llmApiKey) {
      console.warn('[AI秘书] 主持人未配置 LLM 或未启用，降级为简单摘要')
      return null
    }

    const provider = hostConfig.llmProvider || 'volcengine'
    const model = hostConfig.llmModel || 'doubao-seed-2-0-plus-260428'
    const apiKey = hostConfig.llmApiKey
    const baseUrl = hostConfig.llmBaseUrl

    const systemPrompt = `你是一个专业的会议纪要助手。请根据以下会议转写文本，生成一份结构化的会议纪要。

要求：
1. 使用中文输出
2. 包含以下部分：
   - 会议摘要（100字以内）
   - 主要议题（列出讨论的各个话题）
   - 重要决定（达成的共识和决定）
   - 待办事项（需要后续跟进的事项，含负责人）
   - 各人发言要点（每个人的核心观点）
3. 保持客观准确，不添加未讨论的内容
4. 使用 Markdown 格式

会议转写文本：`

    try {
      const apiUrl = this.resolveProviderUrl(provider, baseUrl)

      const response = await fetch(`${apiUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: transcriptText }
          ],
          temperature: 0.3,
          max_tokens: 4000
        })
      })

      if (!response.ok) {
        console.warn(`[AI秘书] LLM 调用失败: ${response.status} ${response.statusText}`)
        return null
      }

      const data = await response.json() as any
      const text = data.choices?.[0]?.message?.content
      if (!text) {
        console.warn('[AI秘书] LLM 返回空内容')
        return null
      }

      return { text, tokens: data.usage?.total_tokens || 0 }
    } catch (e) {
      console.warn('[AI秘书] LLM 调用异常:', (e as Error).message)
      return null
    }
  }

  /** 根据 provider 解析 API 地址（支持全 provider + 自定义 baseUrl 覆盖） */
  private resolveProviderUrl(provider: string, customBaseUrl?: string | null): string {
    if (customBaseUrl) return customBaseUrl.replace(/\/$/, '')
    const map: Record<string, string> = {
      openai: 'https://api.openai.com/v1',
      deepseek: 'https://api.deepseek.com/v1',
      moonshot: 'https://api.moonshot.cn/v1',
      qwen: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      volcengine: 'https://ark.cn-beijing.volces.com/api/v3',
      baidu: 'https://qianfan.baidubce.com/v2',
      zhipu: 'https://open.bigmodel.cn/api/paas/v4',
      siliconflow: 'https://api.siliconflow.cn/v1',
      custom: 'https://api.openai.com/v1',
    }
    return map[provider] || map.openai
  }

  /**
   * 简单摘要（LLM 不可用时的降级方案）
   */
  private generateSimpleSummary(transcriptText: string): string {
    const lines = transcriptText.split('\n').filter(l => l.trim() && !l.startsWith('##'))
    const totalLines = lines.length
    const speakers = new Set<string>()
    for (const line of transcriptText.split('\n')) {
      if (line.startsWith('## ')) {
        speakers.add(line.slice(3).split('（')[0])
      }
    }

    return `# 会议纪要

**会议摘要**：本次会议共有 ${speakers.size} 人发言，产生 ${totalLines} 条转写记录。

**发言人**：${Array.from(speakers).join('、')}

**转写记录**：
${lines.slice(0, 50).join('\n')}

---
*注：LLM 未配置，此为原始转写摘要。配置 AI 模型后可生成结构化纪要。*`
  }

  /**
   * 解析结构化纪要
   */
  private parseStructuredMinutes(summary: string, speakers: SpeakerTranscript[]): any {
    const sections = summary.split('\n\n')
    return {
      summary: sections[0]?.slice(0, 500) || summary.slice(0, 500),
      fullText: summary,
      speakers: speakers.map(s => ({
        name: s.speakerName,
        duration: s.totalDuration,
        segmentCount: s.segments.length
      })),
      generatedAt: new Date().toISOString()
    }
  }

  getStats() {
    return {
      isRecording: this.isRecording,
      duration: Date.now() - this.startTime,
      transcriptCount: this.transcripts.length,
      recordingCount: this.recordings.length,
      speakerCount: this.whisperSessions.size
    }
  }
}

// ── 全局管理 ──
const secretaries = new Map<string, AiSecretaryInstance>()

export const AiSecretary = {
  create(meetingId: string, hostUid: string): AiSecretaryInstance {
    const instance = new AiSecretaryInstance(meetingId, hostUid)
    secretaries.set(meetingId, instance)
    return instance
  },

  get(meetingId: string): AiSecretaryInstance | undefined {
    return secretaries.get(meetingId)
  },

  destroy(meetingId: string) {
    const instance = secretaries.get(meetingId)
    if (instance) {
      instance.stop().catch(console.error)
      secretaries.delete(meetingId)
    }
  },

  async isVip(userId: string): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { id: userId as string },
      select: { memberTier: true, memberExpiresAt: true }
    })
    if (!user) return false
    if (user.memberTier === 'vip' || user.memberTier === 'pro') {
      if (user.memberExpiresAt && user.memberExpiresAt < new Date()) {
        return false
      }
      return true
    }
    return false
  },

  getAll(): Map<string, AiSecretaryInstance> {
    return secretaries
  }
}
