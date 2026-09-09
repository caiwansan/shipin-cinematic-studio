// 数字分身路由 — Avatar Routes（参考桌面版完整功能：启用/白名单/社区/时段/话术/学习/测试回复）
import { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'

const LLM_PROVIDERS: Record<string, { base: string }> = {
  deepseek: { base: 'https://api.deepseek.com/v1' },
  volcengine: { base: 'https://ark.cn-beijing.volces.com/api/v3' },
  openai: { base: 'https://api.openai.com/v1' },
  aliyun: { base: 'https://dashscope.aliyuncs.com/compatible-mode/v1' },
  longcat: { base: 'https://api.longcat.chat/openai/v1' },
}

// 用用户自配大模型对话（未配置则报错）
async function callUserLLM(userUid: string, messages: any[], temperature = 0.7): Promise<string> {
  // 后端强制 VIP：数字分身(AI)仅 VIP 可用
  const uRow: any = await prisma.user.findUnique({ where: { id: userUid }, select: { memberTier: true } })
  const mRow: any = await prisma.membership.findUnique({ where: { userId: userUid }, select: { tier: true } })
  const tier = (uRow?.memberTier || mRow?.tier || 'free') as string
  if (tier === 'free' || tier === 'basic') throw new Error('数字分身为 AI 功能，仅限 VIP 会员使用')
  const k: any = await prisma.$queryRawUnsafe(`SELECT provider, model, base_url AS "baseUrl", api_key AS "apiKey" FROM user_llm_key WHERE user_id=$1`, userUid)
  if (!k.length || !k[0].apiKey) throw new Error('未配置大模型，请先到"我的-大模型设置"配置（数字分身回复需自备 API Key）')
  const cfg = k[0]
  const base = (cfg.baseUrl || LLM_PROVIDERS[cfg.provider]?.base || 'https://api.deepseek.com/v1').replace(/\/+$/, '')
  const r = await fetch(base + '/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + cfg.apiKey },
    body: JSON.stringify({ model: cfg.model || 'deepseek-v4-flash', messages, max_tokens: 1024, temperature }),
    signal: AbortSignal.timeout(60000),
  })
  if (!r.ok) {
    const errBody = await r.text().catch(() => '')
    console.error('[avatar/callUserLLM] upstream http', r.status, 'provider=', cfg.provider, 'model=', cfg.model, 'keyhead=', String(cfg.apiKey||'').slice(0,6), 'body=', errBody.slice(0,200))
    throw new Error('大模型调用失败 ' + r.status)
  }
  const j = await r.json()
  return (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || ''
}

// 解析 style_config（兼容旧格式：直接对象 或 {settings,memory}）
function parseProfile(p: any) {
  let style: any = {}
  try { style = JSON.parse(p.style_config || '{}') } catch (e) { style = {} }
  const settings = style.settings || style || {}
  const memory = style.memory || {}
  return {
    id: p.id,
    exists: true,
    name: p.name,
    persona: p.persona || '',
    knowledgeBase: p.knowledge_base || '',
    learningStatus: p.learning_status || 'none',
    settings,
    memory,
  }
}

export default async function avatarRoutes(fastify: FastifyInstance) {
  const auth = { preHandler: [fastify.authenticate as any] }

  // GET /api/avatar/status — 分身状态（含完整设置 + 学习记忆 + 话术存在性）
  fastify.get('/api/avatar/status', auth, async (request: any) => {
    const userUid = request.user.id
    const profile = await prisma.$queryRawUnsafe(`SELECT * FROM avatar_profile WHERE user_uid = $1`, userUid) as any[]
    if (!profile.length) return { success: true, data: { exists: false, learningStatus: 'none', settings: {}, memory: {} } }
    const d = parseProfile(profile[0])
    const scripts = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS c FROM avatar_script WHERE avatar_id = $1`, d.id) as any[]
    return { success: true, data: { ...d, hasTalkbook: !!scripts[0]?.c } }
  })

  // POST /api/avatar/learn — 学习（+样本；更新 name/persona/knowledge）
  fastify.post('/api/avatar/learn', auth, async (request: any, reply: any) => {
    const userUid = request.user.id
    const { name, persona, knowledgeBase, text } = request.body as any
    let profile = await prisma.$queryRawUnsafe(`SELECT * FROM avatar_profile WHERE user_uid = $1`, userUid) as any[]
    let style: any = {}
    let samples = 0
    if (profile.length) { const d = parseProfile(profile[0]); style = d.settings; samples = d.memory.samples || 0 }
    // 学习样本：若带 text 则计入样本数
    if (text) samples += 1
    const styleJSON = JSON.stringify({ settings: style, memory: { samples, profileLen: (persona || '').length } })
    if (profile.length) {
      await prisma.$queryRawUnsafe(`UPDATE avatar_profile SET name=$1, persona=$2, knowledge_base=$3, style_config=$4, learning_status='learning', last_learned_at=NOW() WHERE user_uid=$5`,
        name || profile[0].name || '我的分身', persona || profile[0].persona || '', knowledgeBase || profile[0].knowledge_base || '', styleJSON, userUid)
    } else {
      const pid = crypto.randomUUID ? crypto.randomUUID() : ('av' + Date.now())
      await prisma.$queryRawUnsafe(`INSERT INTO avatar_profile (id, user_uid, name, persona, knowledge_base, style_config, learning_status, last_learned_at) VALUES ($1,$2,$3,$4,$5,$6,'learning',NOW())`,
        pid, userUid, name || '我的分身', persona || '', knowledgeBase || '', styleJSON)
    }
    return { success: true, data: { message: text ? '分身已学习这条样本' : '分身已开始学习', samples } }
  })

  // POST /api/avatar/settings — 保存完整设置（settings 存 style_config + memory）
  fastify.post('/api/avatar/settings', auth, async (request: any, reply: any) => {
    const userUid = request.user.id
    const body = (request.body as any) || {}
    const profile = await prisma.$queryRawUnsafe(`SELECT * FROM avatar_profile WHERE user_uid = $1`, userUid) as any[]
    if (!profile.length) return reply.status(404).send({ success: false, error: '分身不存在，请先创建' })
    const d = parseProfile(profile[0])
    const newSettings = { ...d.settings, ...(body.settings || {}) }
    const name = body.name ?? profile[0].name
    const persona = body.persona ?? profile[0].persona
    const kb = body.knowledgeBase ?? profile[0].knowledge_base
    const styleJSON = JSON.stringify({ settings: newSettings, memory: d.memory })
    await prisma.$queryRawUnsafe(`UPDATE avatar_profile SET name=$1, persona=$2, knowledge_base=$3, style_config=$4 WHERE user_uid=$5`,
      name, persona, kb, styleJSON, userUid)
    return { success: true, data: { message: '分身设置已保存' } }
  })

  // POST /api/avatar/sweep — 清除（含话术）
  fastify.post('/api/avatar/sweep', auth, async (request: any) => {
    const userUid = request.user.id
    await prisma.$queryRawUnsafe(`DELETE FROM avatar_script WHERE avatar_id IN (SELECT id FROM avatar_profile WHERE user_uid=$1)`, userUid)
    await prisma.$queryRawUnsafe(`DELETE FROM avatar_profile WHERE user_uid=$1`, userUid)
    return { success: true, data: { message: '分身数据已清除' } }
  })

  // GET /api/avatar/scripts — 话术列表
  fastify.get('/api/avatar/scripts', auth, async (request: any) => {
    const userUid = request.user.id
    const profile = await prisma.$queryRawUnsafe(`SELECT id FROM avatar_profile WHERE user_uid=$1`, userUid) as any[]
    if (!profile.length) return { success: true, data: { scripts: [] } }
    const s = await prisma.$queryRawUnsafe(`SELECT id, script_type, content, status FROM avatar_script WHERE avatar_id=$1 ORDER BY created_at DESC`, profile[0].id) as any[]
    return { success: true, data: { scripts: s.map((x: any) => ({ id: x.id, type: x.script_type, content: String(x.content || '').slice(0, 2000), status: x.status })) } }
  })

  // POST /api/avatar/scripts — 上传/替换话术文档（.txt，按 ## 场景 分节）
  fastify.post('/api/avatar/scripts', auth, async (request: any, reply: any) => {
    const userUid = request.user.id
    const { content, mode } = (request.body as any) || {}
    if (!content || !String(content).trim()) return reply.status(400).send({ success: false, error: '话术内容不能为空' })
    const profile = await prisma.$queryRawUnsafe(`SELECT id FROM avatar_profile WHERE user_uid=$1`, userUid) as any[]
    if (!profile.length) return reply.status(404).send({ success: false, error: '分身不存在，请先创建' })
    const avId = profile[0].id
    if (mode === 'replace') await prisma.$queryRawUnsafe(`DELETE FROM avatar_script WHERE avatar_id=$1 AND script_type='talkbook'`, avId)
    const sid = Math.random().toString(36).slice(2) + Date.now().toString(36)
    await prisma.$queryRawUnsafe(`INSERT INTO avatar_script (id, avatar_id, script_type, content, status, created_at) VALUES ($1,$2,'talkbook',$3,'active',NOW())`,
      sid, avId, String(content))
    return { success: true, data: { message: '话术已更新', chars: String(content).length } }
  })

  // POST /api/avatar/reply — 测试分身回复（用用户大模型）
  fastify.post('/api/avatar/reply', auth, async (request: any, reply: any) => {
    const userUid = request.user.id
    const { message, peerName } = (request.body as any) || {}
    if (!message) return reply.status(400).send({ success: false, error: 'message 必填' })
    const profile = await prisma.$queryRawUnsafe(`SELECT * FROM avatar_profile WHERE user_uid=$1`, userUid) as any[]
    if (!profile.length) return reply.status(404).send({ success: false, error: '分身不存在，请先创建' })
    const d = parseProfile(profile[0])
    const persona = d.persona || profile[0].persona || ''
    const kb = profile[0].knowledge_base || ''
    // 读话术
    const talk = await prisma.$queryRawUnsafe(`SELECT content FROM avatar_script WHERE avatar_id=$1 AND script_type='talkbook' ORDER BY created_at DESC LIMIT 1`, d.id) as any[]
    const talkbook = talk.length ? String(talk[0].content).slice(0, 3000) : ''
    try {
      const sys = '你是「' + (profile[0].name || '我的分身') + '」，模仿主人的风格与人设替主人社交。' +
        (persona ? '\n主人人设：' + persona.slice(0, 500) : '') +
        (kb ? '\n知识背景：' + kb.slice(0, 500) : '') +
        (talkbook ? '\n话术文档（优先采用）：' + talkbook : '')
      const text = await callUserLLM(userUid, [
        { role: 'system', content: sys },
        { role: 'user', content: (peerName || '对方') + '对你说：' + message },
      ])
      return { success: true, data: { reply: text } }
    } catch (e: any) {
      return reply.status(400).send({ success: false, error: e.message })
    }
  })
}

declare const crypto: any
