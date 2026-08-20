// admin-tea-translate.routes.ts — 昆仑茶馆翻译 AI 设置（管理员卡片）
import { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'
import { requireAdmin } from '../middleware/require-admin.js'

const SCOPE = 'tea'
const KEY = 'translate_ai'

// 服务商预设规范化：避免手填错误端点/型号
function normalizeCfg(next: any) {
  const provider = String(next.provider || 'deepseek')
  let baseUrl = String(next.baseUrl || '').trim().replace(/\/+$/, '')
  let model = String(next.model || '').trim()
  // LongCat：统一 OpenAI 兼容端点 /openai/v1；型号去掉厂商前缀
  if (provider === 'longcat') {
    if (!baseUrl || baseUrl === 'https://api.longcat.chat' || baseUrl === 'https://api.longcat.chat/v1') baseUrl = 'https://api.longcat.chat/openai/v1'
    else if (baseUrl === 'https://api.longcat.chat/openai') baseUrl = 'https://api.longcat.chat/openai/v1'
    if (model.startsWith('LongCat/')) model = model.slice('LongCat/'.length)
    if (!model) model = 'LongCat-2.0'
  }
  if (provider === 'doubao' && (!baseUrl || baseUrl === 'ark.cn-beijing.volces.com/api/v3')) {
    baseUrl = baseUrl || 'https://ark.cn-beijing.volces.com/api/v3'
  }
  if (baseUrl && !/\/v\d+$/.test(baseUrl) && !/openai\/v\d*$/.test(baseUrl) && provider !== 'custom') {
    baseUrl = baseUrl.replace(/\/+$/, '') + '/v1'
  }
  next.baseUrl = baseUrl
  next.model = model
  return next
}

export default async function adminTeaTranslateRoutes(fastify: FastifyInstance) {
  // 读取配置
  fastify.get('/api/admin/tea-translate', { preHandler: [requireAdmin] }, async () => {
    const row = await prisma.routeConfig.findUnique({ where: { scope_key: { scope: SCOPE, key: KEY } } })
    const v: any = normalizeCfg({ ...(row?.value || {}) })
    return { success: true, data: { provider: v.provider || 'deepseek', model: v.model || 'deepseek-v4-flash', baseUrl: v.baseUrl || '', hasKey: !!v.apiKey, keyMasked: v.apiKey ? String(v.apiKey).slice(0, 4) + '***' : '' } }
  })
  // 保存配置（apiKey 留空表示不修改）
  fastify.put('/api/admin/tea-translate', { preHandler: [requireAdmin] }, async (request: any, reply: any) => {
    const { provider, apiKey, baseUrl, model } = request.body || {}
    const row = await prisma.routeConfig.findUnique({ where: { scope_key: { scope: SCOPE, key: KEY } } })
    const cur: any = row?.value || {}
    const next = normalizeCfg({
      provider: String(provider || cur.provider || 'deepseek'),
      model: String(model || cur.model || 'deepseek-v4-flash'),
      baseUrl: String(baseUrl || cur.baseUrl || ''),
      apiKey: apiKey ? String(apiKey) : (cur.apiKey || ''),
    })
    if (!next.apiKey) return reply.code(400).send({ success: false, message: '请填写 API Key' })
    // 预警：Key 不能是 URL
    if (/^https?:\/\//.test(next.apiKey)) {
      return reply.code(400).send({ success: false, message: '❌ API Key 不能是一个网址。请到「' + next.provider + '」平台「API Keys」页面复制真正的密钥（不是平台地址）' })
    }
    await prisma.routeConfig.upsert({
      where: { scope_key: { scope: SCOPE, key: KEY } },
      update: { value: next, label: '昆仑茶馆翻译 AI', isActive: true },
      create: { scope: SCOPE, key: KEY, value: next, label: '昆仑茶馆翻译 AI', isActive: true },
    })
    return { success: true, data: { provider: next.provider, model: next.model, hasKey: true } }
  })
  // 测试翻译联通性（用当前/新配置真实调用一次）
  fastify.post('/api/admin/tea-translate/test', { preHandler: [requireAdmin] }, async (request: any, reply: any) => {
    const { provider, apiKey, baseUrl, model, text, srcLang, tgtLang } = request.body || {}
    const row = await prisma.routeConfig.findUnique({ where: { scope_key: { scope: SCOPE, key: KEY } } })
    const cur: any = row?.value || {}
    const key = String(apiKey || cur.apiKey || '')
    let base = String(baseUrl || cur.baseUrl || '').replace(/\/+$/, '')
    let mdl = String(model || cur.model || 'deepseek-v4-flash')
    if (/^https?:\/\//.test(key)) {
      return reply.code(400).send({ success: false, message: '❌ API Key 填成网址了！请到 ' + (provider || cur.provider || '模型') + ' 平台「API Keys」页面复制真正的密钥（一串字符，不是网址）' })
    }
    const nx = normalizeCfg({ provider: provider || cur.provider || 'deepseek', model: mdl, baseUrl: base, apiKey: key })
    base = nx.baseUrl
    mdl = nx.model
    const src = srcLang || '英文'
    const tgt = tgtLang || '简体中文'
    if (!key) return reply.code(400).send({ success: false, message: '请先填写 API Key' })
    if (!base) return reply.code(400).send({ success: false, message: '请先填写 API Base URL' })
    try {
      const res = await fetch(`${base}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: mdl,
          messages: [
            { role: 'system', content: `你是专业翻译。把下面这段${src}翻译成${tgt}，只输出译文。` },
            { role: 'user', content: text || 'Hello, how are you? Nice to meet you.' },
          ],
          max_tokens: 200,
          temperature: 0.2,
        }),
      })
      const j = await res.json().catch(() => ({}))
      const translated = (j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content || '').toString().trim()
      return {
        success: res.ok && !!translated,
        data: { translated: translated, status: res.status },
        message: res.ok ? '✅ 翻译服务可用' : ('⚠️ 服务响应异常 (' + res.status + ')'),
      }
    } catch (e: any) {
      return reply.code(500).send({ success: false, message: '❌ 调用失败: ' + (e?.message || '') })
    }
  })
}
