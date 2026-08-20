// translate.routes.ts — 消息外文翻译（LLM 翻译，复用 im-voice-translate 的 DeepSeek 链路）
import { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'

let keyCache: string | null | undefined
let keyAt = 0
async function getTranslateKey(): Promise<string | null> {
  if (keyCache !== undefined && Date.now() - keyAt < 5 * 60_000) return keyCache
  try {
    // 优先：后台管理配置的翻译 AI（RouteConfig scope=tea key=translate_ai）
    const row = await prisma.routeConfig.findUnique({ where: { scope_key: { scope: 'tea', key: 'translate_ai' } } })
    const v: any = row?.value || {}
    keyCache = String(v.apiKey || '') || process.env.DEEPSEEK_API_KEY || process.env.DEEPSEEK_DEV_API_KEY || null
    if (!keyCache) keyCache = null
  } catch {
    keyCache = null
  }
  keyAt = Date.now()
  return keyCache
}
let cfgCache: any = null
let cfgAt = 0
async function getTranslateConfig(): Promise<{ provider: string; model: string; baseUrl: string }> {
  if (cfgCache && Date.now() - cfgAt < 5 * 60_000) return cfgCache
  const out = { provider: 'deepseek', model: process.env.DEEPSEEK_LLM_MODEL || 'deepseek-v4-flash', baseUrl: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1' }
  try {
    const row = await prisma.routeConfig.findUnique({ where: { scope_key: { scope: 'tea', key: 'translate_ai' } } })
    const v: any = row?.value || {}
    if (v.provider) out.provider = String(v.provider)
    if (v.model) out.model = String(v.model)
    if (v.baseUrl) out.baseUrl = String(v.baseUrl).replace(/\/+$/, '')
  } catch {}
  cfgCache = out
  cfgAt = Date.now()
  return out
}

const LANG_MAP: Record<string, string> = {
  zh: '简体中文', en: '英文', ja: '日文', ko: '韩文', ru: '俄文', fr: '法文', de: '德文',
  es: '西班牙文', ar: '阿拉伯文', pt: '葡萄牙文', it: '意大利文', th: '泰文', vi: '越南文', id: '印尼文',
}

export default async function translateRoutes(fastify: FastifyInstance) {
  // POST /api/v1/translate {text, target} → {translated}
  fastify.post('/api/v1/translate', { preHandler: [fastify.authenticate] }, async (request: any, reply: any) => {
    try {
      const { text, target } = request.body || {}
      if (!text || !target) return reply.code(400).send({ success: false, message: 'text/target 必填' })
      const key = await getTranslateKey()
      if (!key) return reply.code(500).send({ success: false, message: '翻译服务未配置' })
      const langName = LANG_MAP[String(target)] || String(target)
      const cfg = await getTranslateConfig()
      const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: cfg.model,
          messages: [
            { role: 'system', content: '你是一个专业翻译引擎。只输出翻译结果，不要解释、不要引号、不要任何额外文字。' },
            { role: 'user', content: `把下面这段文字翻译成${langName}：\n${String(text).slice(0, 2000)}` },
          ],
          max_tokens: 2048,
          temperature: 0.2,
        }),
      })
      if (!res.ok) return reply.code(502).send({ success: false, message: '翻译服务异常' })
      const j = await res.json()
      const translated = (j?.choices?.[0]?.message?.content || '').trim()
      if (!translated) return reply.code(502).send({ success: false, message: '翻译无结果' })
      return { success: true, data: { translated, target } }
    } catch (e: any) {
      return reply.code(500).send({ success: false, message: e.message })
    }
  })
}
