/**
 * ai-secretary-ws.ts — AI 秘书实时音频 WebSocket
 * 
 * 浏览器通过 WebSocket 发送音频帧（来自 getUserMedia 的 PCM 数据）
 * 服务端接收后送入 Whisper worker 进行实时转写
 * 
 * 协议（JSON 行）：
 * → { type: 'audio', meetingId, pcm: base64_16k_s16le, lang: 'zh' }
 * ← { type: 'partial', text: '...' }
 * ← { type: 'final', text: '...' }
 * ← { type: 'error', error: '...' }
 */

// @ts-ignore
import { WebSocket } from 'ws'
import { AiSecretary } from './ai-secretary.service.js'

const audioClients = new Map<WebSocket, { uid: string; meetingId: string }>()

export function registerAudioWebSocket(ws: WebSocket, uid: string, meetingId: string) {
  audioClients.set(ws, { uid, meetingId })
  console.log(`[AI秘书WS] 用户 ${uid} 连接会议 ${meetingId} 的音频流`)
}

export function removeAudioWebSocket(ws: WebSocket) {
  audioClients.delete(ws)
}

export async function handleAudioMessage(ws: WebSocket, data: any) {
  const client = audioClients.get(ws)
  if (!client) return

  const { uid, meetingId } = client
  const secretary = AiSecretary.get(meetingId)
  if (!secretary) return

  try {
    switch (data.type) {
      case 'audio': {
        // base64 PCM → Buffer
        const pcm = Buffer.from(data.pcm, 'base64')
        const lang = data.lang || 'zh'
        await secretary.feedAudio(uid, pcm, lang)
        break
      }
      case 'video-audio': {
        // 在线视频的音频转写结果
        if (data.text) {
          await secretary.addExternalTranscript(data.label || '在线视频', data.text, data.lang || 'zh')
        }
        break
      }
      case 'speaker-name': {
        if (data.name) {
          secretary.setSpeakerName(uid, data.name)
        }
        break
      }
      case 'stop': {
        // 用户停止发送音频（关闭麦克风）
        break
      }
    }
  } catch (e) {
    console.warn('[AI秘书WS] 处理音频失败:', (e as Error).message)
  }
}

export function broadcastToMeeting(meetingId: string, msg: any) {
  for (const [ws, client] of audioClients) {
    if (client.meetingId === meetingId && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg))
    }
  }
}

export function getActiveConnections(meetingId: string): number {
  let count = 0
  for (const [, client] of audioClients) {
    if (client.meetingId === meetingId) count++
  }
  return count
}
