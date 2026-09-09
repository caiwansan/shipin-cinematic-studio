// tea-llm.ts — 用户自配大模型（平台不提供 API，用户自填 Key）
// 路由：/api/tea/llm/config (GET/POST) + /api/tea/llm/chat (POST)
// 影响：数字分身 / AI秘书 / 好汉热点采集 / 社区AI编写（统一走此 chat）
// 修复: 添加输入验证防止 NoSQL 注入 (2026-09-07)
import { FastifyInstance } from 'fastify'

function validateUserId(uid: string): boolean {
  return /^[a-f0-9-]{36}$/i.test(uid) || uid.length <= 64;
}

// 安全: 清洗输入中的 MongoDB 操作符
function sanitizeInput(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  // 拒绝对象类型（防止 {\$ne: null} 等 NoSQL 注入）
  return '';
}

// 安全: 验证 provider 是否在白名单中
const ALLOWED_PROVIDERS = ['deepseek', 'volcengine', 'openai', 'aliyun', 'longcat', 'siliconflow'];

function validateProvider(provider: unknown): string {
  const sanitized = sanitizeInput(provider);
  if (!sanitized) return 'deepseek';
  if (!ALLOWED_PROVIDERS.includes(sanitized)) return 'deepseek';
  return sanitized;
}

import { prisma } from '../utils/index.js'

const LLM_PROVIDERS: Record<string, { base: string; models: string[] }> = {
  deepseek: { base: 'https://api.deepseek.com/v1', models: ['deepseek-v4-flash', 'deepseek-v4-pro'] },
  volcengine: { base: 'https://ark.cn-beijing.volces.com/api/v3', models: ['doubao-1-5-pro-256k-250115', 'doubao-pro-32k', 'doubao-lite-32k'] },
  openai: { base: 'https://api.openai.com/v1', models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo'] },
  aliyun: { base: 'https://dashscope.aliyuncs.com/compatible-mode/v1', models: ['qwen3-max', 'qwen3-plus', 'qwen3-flash', 'qwen-max', 'qwen-plus', 'qwen-turbo'] },
  longcat: { base: 'https://api.longcat.chat/openai/v1', models: ['LongCat-2.0'] },
  siliconflow: { base: 'https://api.siliconflow.cn/v1', models: ['deepseek-ai/DeepSeek-V3', 'Qwen/Qwen2.5-72B-Instruct', 'Qwen/Qwen2.5-7B-Instruct'] },
}

async function getCfg(userId: string) {
  const r: any = await prisma.$queryRawUnsafe(`SELECT provider, model, base_url AS "baseUrl", api_key AS "apiKey" FROM user_llm_key WHERE user_id=$1`, userId)
  return r.length ? r[0] : null
}
async function setCfg(userId: string, c: any) {
  const ts = new Date()
  await prisma.$queryRawUnsafe(
    `INSERT INTO user_llm_key (user_id, provider, model, base_url, api_key, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (user_id) DO UPDATE SET provider=$2, model=$3, base_url=$4, api_key=$5, updated_at=$6`,
    userId, c.provider, c.model, c.baseUrl || '', c.apiKey, ts)
}

// 清洗 AI 输出中的 markdown 符号（# * - _ ` ~ 等），只留正文（参照 H5 cleanAiText）
function cleanAiText(s: string): string {
  if (!s) return ''
  let t = String(s)
    .replace(/```[a-z]*\n?/gi, '\n')
    .replace(/`([^`\n]+)`/g, '$1')
    .replace(/^#{1,6}[ \t]+/gm, '')
    .replace(/^[>\s]+/gm, '')
    .replace(/^[\s]*[-*+][ \t]+/gm, '• ')
    .replace(/^[\s]*\d+[.、)][ \t]+/gm, '')
    .replace(/\*\*([^*\n]+)\*\*/g, '$1')
    .replace(/__([^_\n]+)__/g, '$1')
    .replace(/\*([^*\n]+)\*/g, '$1')
    .replace(/~~([^~\n]+)~~/g, '$1')
    .replace(/^[\s]*([-*_=]){3,}[\s]*$/gm, '\n')
    .replace(/^[\s]*[*_~`#-]{1,2}[ \t]/gm, '')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return t
}

export default async function teaLLMRoutes(fastify: FastifyInstance) {
  const auth = { preHandler: [fastify.authenticate as any] }

  // GET /api/tea/llm/config — 读配置（Key 掩码）
  fastify.get('/api/tea/llm/config', auth, async (request: any, reply: any) => {
    const userId = request.user.id
    if (!validateUserId(userId)) {
      return reply.code(400).send({ success: false, error: '无效的用户ID' })
    }
    const c = await getCfg(userId)
    return {
      success: true,
      data: {
        provider: c?.provider || '',
        model: c?.model || '',
        baseUrl: c?.baseUrl || '',
        hasKey: !!c?.apiKey,
        keyMasked: c?.apiKey ? String(c.apiKey).slice(0, 4) + '***' : '',
        providers: LLM_PROVIDERS,
      },
    }
  })

  // POST /api/tea/llm/config — 保存配置（带输入验证）
  fastify.post('/api/tea/llm/config', auth, async (request: any, reply: any) => {
    const userId = request.user.id
    if (!validateUserId(userId)) {
      return reply.code(400).send({ success: false, error: '无效的用户ID' })
    }
    const body = (request.body as any) || {}
    const cur = await getCfg(userId)
    
    // 安全: 清洗和验证所有输入字段
    const next = {
      provider: validateProvider(body.provider),
      model: sanitizeInput(body.model) || cur?.model || 'deepseek-v4-flash',
      baseUrl: sanitizeInput(body.baseUrl) || cur?.baseUrl || '',
      apiKey: typeof body.apiKey === 'string' ? body.apiKey : (cur?.apiKey || ''),
    }
    
    if (!next.apiKey) return reply.status(400).send({ success: false, error: '请填写 API Key' })
    await setCfg(userId, next)
    // 同步到 userModelConfigV2（H5 大模型设置读取此表）
    try {
      await prisma.userModelConfigV2.upsert({
        where: { userId },
        update: { llmProvider: next.provider, llmModel: next.model, llmApiKey: next.apiKey, llmBaseUrl: next.baseUrl || '' },
        create: { userId, llmProvider: next.provider, llmModel: next.model, llmApiKey: next.apiKey, llmBaseUrl: next.baseUrl || '' },
      })
    } catch (e) { console.error('[tea-llm/config] sync to userModelConfigV2 failed:', e) }
    return { success: true, data: { message: '已保存' } }
  })

  // POST /api/tea/llm/chat — 用用户配置调大模型（OpenAI 兼容）
  fastify.post('/api/tea/llm/chat', auth, async (request: any, reply: any) => {
    const userId = request.user.id
    if (!validateUserId(userId)) {
      return reply.code(400).send({ success: false, error: '无效的用户ID' })
    }
    // 后端强制 VIP：AI（除平台翻译）仅 VIP 可用，普通用户禁止
    const meRow: any = await prisma.user.findUnique({ where: { id: userId }, select: { memberTier: true } })
    const myMem: any = await prisma.membership.findUnique({ where: { userId }, select: { tier: true } })
    const meTier = (meRow?.memberTier || myMem?.tier || 'free') as string
    const isVip = meTier !== 'free' && meTier !== 'basic'
    if (!isVip) return reply.status(403).send({ success: false, error: 'AI 功能仅限 VIP 会员使用，普通用户不可用' })
    const { messages, temperature } = (request.body as any) || {}
    const cfg = await getCfg(userId)
    if (!cfg?.apiKey) return reply.status(400).send({ success: false, error: '未配置大模型，请先到"我的-大模型设置"配置（平台不提供 API，需自备 Key）' })
    const base = (cfg.baseUrl || LLM_PROVIDERS[cfg.provider]?.base || 'https://api.deepseek.com/v1').replace(/\/+$/, '')
    try {
      const r = await fetch(base + '/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + cfg.apiKey },
        body: JSON.stringify({ model: cfg.model || 'deepseek-v4-flash', messages: Array.isArray(messages) ? messages : [], max_tokens: 2048, temperature: temperature || 0.6 }),
        signal: AbortSignal.timeout(120000),
      })
      if (!r.ok) {
        const errBody = await r.text().catch(() => '')
        console.error('[tea-llm/chat] upstream http', r.status, 'provider=', cfg.provider, 'model=', cfg.model, 'body=', errBody.slice(0, 300))
        return reply.status(502).send({ success: false, error: '大模型调用失败 ' + r.status + (errBody ? '：' + errBody.slice(0, 160) : '') })
      }
      const j = await r.json()
      const text = cleanAiText((j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || '')
      return { success: true, data: { text } }
    } catch (e: any) {
      console.error('[tea-llm/chat] error provider=', cfg.provider, 'model=', cfg.model, (e && e.message) || e)
      return reply.status(502).send({ success: false, error: '大模型调用失败：' + (e && e.message ? e.message : String(e)) })
    }
  })

  // ═══ 供其他功能复用：读出模型配置是否可用（不暴露 Key）═══
  // GET /api/tea/llm/status — 是否已配置（数字分身/AI秘书/热点/社区AI 门禁用）
  fastify.get('/api/tea/llm/status', auth, async (request: any) => {
    const userId = request.user.id
    if (!validateUserId(userId)) {
      return reply.code(400).send({ success: false, error: '无效的用户ID' })
    }
    const c = await getCfg(userId)
    return { success: true, data: { configured: !!c?.apiKey, provider: c?.provider || '', model: c?.model || '' } }
  })
}

