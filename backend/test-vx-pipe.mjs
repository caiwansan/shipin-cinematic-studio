// 管线直测：transcribeVoice → DeepSeek 翻译 → edge-tts 合成
import { transcribeVoice, ASR_AVAILABLE } from './src/im/voice-asr.service.js'
import { synthesizeSegments, ttsSupports } from './src/services/tts.service.js'

const AUDIO_URL = 'https://aigc.fushtn.com/uploads/im/18a4fc1b-97c8-44a1-9cd7-3a3abe357e53.webm'
const MID = 'test-vx-001'

async function main() {
  console.log('ASR_AVAILABLE:', ASR_AVAILABLE)
  // 1) ASR
  const text = await transcribeVoice(MID, AUDIO_URL)
  console.log('ASR text:', JSON.stringify(text))
  if (!text || text.includes('未识别')) { console.log('PIPELINE-FAIL-ASR'); return }
  // 2) DeepSeek 翻译（同 im.ts 逻辑）
  const key = process.env.DEEPSEEK_API_KEY || ''
  const res = await fetch(`${process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1'}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: process.env.DEEPSEEK_LLM_MODEL || 'deepseek-v4-flash',
      messages: [
        { role: 'system', content: '你是专业的语音消息翻译引擎。把下面这段中文口语翻译成英语。只输出译文本身，不加解释、不加引号、保留口语化表达。' },
        { role: 'user', content: text },
      ],
      max_tokens: 1000,
      temperature: 0.2,
    }),
  })
  if (!res.ok) { console.log('TRANSLATE-FAIL', res.status); return }
  const j: any = await res.json()
  const translated = (j?.choices?.[0]?.message?.content || '').trim()
  console.log('Translated:', JSON.stringify(translated))
  if (!translated) { console.log('PIPELINE-FAIL-MT'); return }
  // 3) TTS
  console.log('ttsSupports(en):', ttsSupports('en'))
  const segs = await synthesizeSegments(translated, 'en')
  const totalB64 = segs.reduce((s, sg) => s + sg.audioB64.length, 0)
  console.log('TTS segments:', segs.length, 'base64 bytes:', totalB64)
  if (totalB64 > 1000) console.log('PIPELINE-OK ✅')
  else console.log('PIPELINE-FAIL-TTS')
}
main().catch((e) => { console.error('ERR', e); process.exit(1) })
