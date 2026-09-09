// tea-news.ts — 行业热点（RSS 权威媒体采集 + AI 热点简报 + 抓取历史标签）
// 路由：GET /api/tea/news?industry=xxx&historyId= + POST /api/tea/news/fetch
// 平台不提供大模型 API，AI 简报用发起用户的 user_llm_key 配置（未配则只出新闻列表）
import { FastifyInstance } from 'fastify'

function validateIndustry(industry: string): string {
  const allowed = ['tea', 'agriculture', 'food', 'retail', 'tech', 'finance', 'education', 'health', 'travel', 'other'];
  return allowed.includes(industry) ? industry : 'tea';
}
function validateDay(day: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : new Date().toISOString().slice(0, 10);
}

import { prisma } from '../utils/index.js'

// 🔧 LLM 配置归一化（对齐 admin-tea-translate.normalizeCfg）：解析 provider 的默认 baseUrl/型号
function normalizeLlmCfg(cfg: any) {
  const provider = String(cfg?.provider || 'deepseek').trim()
  let baseUrl = String(cfg?.baseUrl || '').trim().replace(/\/+$/, '')
  let model = String(cfg?.model || '').trim()
  if (provider === 'longcat') {
    if (!baseUrl || baseUrl === 'https://api.longcat.chat' || baseUrl === 'https://api.longcat.chat/v1') baseUrl = 'https://api.longcat.chat/openai/v1'
    else if (baseUrl === 'https://api.longcat.chat/openai') baseUrl = 'https://api.longcat.chat/openai/v1'
    if (model.startsWith('LongCat/')) model = model.slice('LongCat/'.length)
    if (!model) model = 'LongCat-2.0'
  } else if (provider === 'doubao' && (!baseUrl || baseUrl === 'ark.cn-beijing.volces.com/api/v3')) {
    baseUrl = baseUrl || 'https://ark.cn-beijing.volces.com/api/v3'
  }
  if (!baseUrl) baseUrl = 'https://api.deepseek.com/v1'
  if (baseUrl && !/\/v\d+$/.test(baseUrl) && !/openai\/v\d*$/.test(baseUrl) && provider !== 'custom') {
    baseUrl = baseUrl.replace(/\/+$/, '') + '/v1'
  }
  return { ...cfg, baseUrl, model: model || 'deepseek-v4-flash' }
}

let newsReady = false
async function ensureNewsTable() {
  if (newsReady) return
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS news_items (
    id BIGSERIAL PRIMARY KEY,
    industry TEXT NOT NULL,
    day TEXT NOT NULL,
    title TEXT NOT NULL,
    url TEXT DEFAULT '',
    source TEXT DEFAULT '',
    summary TEXT DEFAULT '',
    published_at BIGINT DEFAULT 0
  )`)
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_news_ind_day ON news_items (industry, day)`)
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS news_fetch_log (
    id BIGSERIAL PRIMARY KEY,
    industry TEXT NOT NULL,
    day TEXT NOT NULL,
    news TEXT DEFAULT '[]',
    brief TEXT DEFAULT '',
    created_at BIGINT DEFAULT (extract(epoch from now()) * 1000)::bigint,
    user_id TEXT DEFAULT ''
  )`)
  // 兼容老表：补 user_id 列
  await prisma.$executeRawUnsafe(`ALTER TABLE news_fetch_log ADD COLUMN IF NOT EXISTS user_id TEXT DEFAULT ''`)
  newsReady = true
}

const NEWS_INDUSTRIES = [
  '人工智能/科技', '电商/零售', '金融/财经', '汽车/出行', '新能源/碳中和', '医疗/健康', '教育/培训', '房地产/建筑',
  '食品/餐饮', '旅游/文旅', '美妆/护肤', '游戏/电竞', '影视/娱乐', '制造/工业', '物流/快递', '本地生活', '家装/家居', '银发市场'
]

const GEN_SOURCES: { name: string; url: string }[] = [
  { name: '中新网', url: 'https://news.china.com.cn/node_7246867.htm' },
  { name: '央视新闻', url: 'https://api.cntv.cn/publish/sousuo/ChannelCourse/TCN1699450000241064' },
  { name: '环球网', url: 'https://www.huanqiu.com/api/list6?node=%2Fe3pt8440%2Fe3pttu2u&page=1' },
]
const VERTICAL: Record<string, { name: string; url: string }[]> = {
  '人工智能/科技': [
    { name: 'IT之家', url: 'https://www.ithome.com/rss/' },
    { name: '量子位', url: 'https://www.qbitai.com/feed' },
  ],
  '金融/财经': [
    { name: '华尔街见闻', url: 'https://wallstreetcn.com/rss/feed' },
  ],
  '汽车/出行': [{ name: '第一电动', url: 'https://tech.ifeng.com/c/8jYr3w1hOkN' }],
}
const KEYWORDS: Record<string, string[]> = {
  '人工智能/科技': ['AI', '人工智能', '大模型', '芯片', '机器人', '算法', '自动驾驶', '云计算', '英伟达', '算力', '智能'],
  '金融/财经': ['央行', '降息', 'A股', '港股', '美联储', '银行', '保险', '汇率', '基金', '理财'],
  '电商/零售': ['电商', '直播', '淘宝', '京东', '拼多多', '抖音', '零售', '消费', '双11', '618'],
}

function today(): string {
  const d = new Date(); const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
function stripTags(s: string): string { return s.replace(/<[^>]+>/g, '').trim() }
function decodeEntities(s: string): string {
  return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ').replace(/&apos;/g, "'")
}
function titleSimilar(a: string, b: string): boolean {
  if (!a || !b) return false
  const sa = a.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '').slice(0, 20)
  const sb = b.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '').slice(0, 20)
  if (!sa || !sb) return false
  let hits = 0; for (let i = 0; i < sa.length; i++) if (sb.includes(sa[i])) hits++
  return hits / sa.length > 0.7
}

async function fetchRss(url: string): Promise<{ title: string; link: string }[]> {
  try {
    const c = new AbortController(); const t = setTimeout(() => c.abort(), 12000)
    const r = await fetch(url, { signal: c.signal, headers: { 'user-agent': 'Mozilla/5.0 (iPhone)' } })
    clearTimeout(t)
    if (!r.ok) return []
    const buf = await r.arrayBuffer()
    let xml = ''
    try { xml = new TextDecoder('utf-8').decode(buf) } catch { /* ignore */ }
    if (!/<(item|entry)>/i.test(xml)) { try { xml = new TextDecoder('gbk').decode(buf) } catch { /* ignore */ } }
    // 标题链接提取：优先 <item>/<entry> 块，其次 <h3><a>
    const items: { title: string; link: string }[] = []
    const blocks = xml.match(/<(?:item|entry)>[\s\S]*?<\/(?:item|entry)>/gi) || []
    for (const blk of blocks.slice(0, 40)) {
      const t1 = blk.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
      const l1 = blk.match(/<link[^>]*>([\s\S]*?)<\/link>/i) || blk.match(/<link[^>]*href="([^"]+)"/i)
      const title = t1 ? decodeEntities(stripTags(t1[1])) : ''
      const link = l1 ? decodeEntities(l1[1]).trim() : ''
      if (title && title.length >= 4) items.push({ title: title.slice(0, 200), link })
    }
    if (!items.length) {
      const hrefs = xml.match(/<h[23][^>]*><a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a><\/h[23]>/gi) || []
      for (const h of hrefs) {
        const a = h.match(/href="([^"]+)"/i); const t = h.match(/>([\s\S]*?)$/)
        const title = t ? decodeEntities(stripTags(t[1].replace(/<\/a>/i, ''))) : ''
        if (a && title && title.length >= 4) items.push({ title: title.slice(0, 200), link: a[1] })
      }
    }
    return items.filter((it, i, arr) => arr.findIndex(x => x.title === it.title) === i)
  } catch { return [] }
}

export default async function teaNewsRoutes(fastify: FastifyInstance) {
  const auth = { preHandler: [fastify.authenticate as any] }
  await ensureNewsTable()

  // GET /api/tea/news?industry=xxx&historyId=id
  // 返回：当前行业最新抓取(或指定历史)完整内容 + 最近5条抓取历史(标签)
  fastify.get('/api/tea/news', { preHandler: [fastify.authenticate] }, async (request: any, reply: any) => {
    const userId = request.user.id
    // 后端强制 VIP：行业热点简报属 AI，普通用户禁止
    const meRow: any = await prisma.user.findUnique({ where: { id: userId }, select: { memberTier: true } })
    const myMem: any = await prisma.membership.findUnique({ where: { userId }, select: { tier: true } })
    const meTier = (meRow?.memberTier || myMem?.tier || 'free') as string
    if (meTier === 'free' || meTier === 'basic') {
      return reply.status(403).send({ success: false, error: '行业热点仅限 VIP 会员使用' })
    }
    const ind = String((request.query as any).industry || '人工智能/科技')
    const historyId = String((request.query as any).historyId || '')

    // 想看热点必须先自己配置大模型 API（我的→大模型设置）
    const cfgRaw: any = await prisma.$queryRawUnsafe(`SELECT provider, model, base_url AS "baseUrl", api_key AS "apiKey" FROM user_llm_key WHERE user_id=$1`, userId)
    if (!cfgRaw || cfgRaw.length === 0 || !String(cfgRaw[0].apiKey || '').trim()) {
      return reply.status(400).send({ success: false, error: '请先在【我的→大模型设置】配置 API Key，才能查看行业热点' })
    }

    // 最近5条抓取历史（标签用）—— 仅本人抓取
    const logs: any = await prisma.$queryRawUnsafe(
      `SELECT id, industry, day, brief, created_at::float8 AS created_at FROM news_fetch_log WHERE user_id=$1 ORDER BY id DESC LIMIT 5`, userId)

    let current: any = null
    if (historyId) {
      const row: any = await prisma.$queryRawUnsafe(`SELECT id, industry, day, news, brief, created_at::float8 AS created_at FROM news_fetch_log WHERE id=$1::bigint AND user_id=$2`, historyId, userId)
      if (row.length) current = row[0]
    } else {
      // 当前行业最新一条（仅本人）
      const row: any = await prisma.$queryRawUnsafe(`SELECT id, industry, day, news, brief, created_at::float8 AS created_at FROM news_fetch_log WHERE industry=$1 AND user_id=$2 ORDER BY id DESC LIMIT 1`, ind, userId)
      if (row.length) current = row[0]
    }

    const history = (logs || []).map((l: any) => {
      let b: any = null; try { b = l.brief ? JSON.parse(l.brief) : null } catch { /* */ }
      return { id: Number(l.id), industry: l.industry, day: l.day, time: Math.round(l.created_at / 1000), headline: b?.headline || '', active: !!(current && Number(current.id) === Number(l.id)) }
    })

    let news: any[] = []
    if (current) { try { news = JSON.parse(current.news || '[]') } catch { news = [] } }
    let brief: any = null
    if (current && current.brief) { try { brief = JSON.parse(current.brief) } catch { brief = null } }

    return { success: true, data: { industry: ind, industries: NEWS_INDUSTRIES, news, brief, history } }
  })

  // POST /api/tea/news/fetch — 采集 + AI简报，upsert到抓取历史(同行业今天覆盖)，清理只留5条
  fastify.post('/api/tea/news/fetch', { preHandler: [fastify.authenticate] }, async (request: any, reply: any) => {
    const userId = request.user.id
    const ind = String((request.body as any)?.industry || '人工智能/科技')
    const day = today()
    // 后端强制 VIP：行业热点简报属 AI，普通用户禁止
    const meRow: any = await prisma.user.findUnique({ where: { id: userId }, select: { memberTier: true } })
    const myMem: any = await prisma.membership.findUnique({ where: { userId }, select: { tier: true } })
    const meTier = (meRow?.memberTier || myMem?.tier || 'free') as string
    if (meTier === 'free' || meTier === 'basic') {
      return reply.status(403).send({ success: false, error: '行业热点仅限 VIP 会员使用' })
    }
    const kwAll = KEYWORDS[ind] || []
    const vert = VERTICAL[ind] || []
    const sources = [...(vert.length ? vert : []), ...GEN_SOURCES]
    if (!sources.length) return reply.status(400).send({ success: false, error: '该行业暂无数据源' })

    const collected: { title: string; url: string; source: string; published_at: number }[] = []
    for (const s of sources) {
      const items = await fetchRss(s.url)
      for (const it of items) {
        const isVert = vert.some(v => v.name === s.name)
        if (!isVert && kwAll.length && !kwAll.some(k => it.title.includes(k))) continue
        if (collected.some(c => titleSimilar(c.title, it.title))) continue
        collected.push({ title: it.title.slice(0, 200), url: it.link, source: s.name, published_at: Date.now() })
      }
    }
    collected.sort((a, b) => b.published_at - a.published_at).slice(0, 60)

    // AI 简报（用发起用户 Key）
    let brief: any = null
    let briefNote = ''
    try {
      const cfgRow: any = await prisma.$queryRawUnsafe(`SELECT provider, model, base_url AS "baseUrl", api_key AS "apiKey" FROM user_llm_key WHERE user_id=$1`, userId)
      const cfgRaw = cfgRow?.[0]
      if (cfgRaw?.apiKey) {
        const cfg = normalizeLlmCfg(cfgRaw) // 归一化 provider 的 baseUrl/model（修 longcat 空 baseUrl→错误默认端点）
        const base = (cfg.baseUrl || 'https://api.deepseek.com/v1').replace(/\/+$/, '')
        const sys = '你是行业情报分析师。基于当天权威媒体新闻，输出行业热点简报。只输出 JSON：{summary(60-120字总览), headline(一句话头条≤28字), highlights(3-5条当日最重要新闻要点,每条≤40字), trends(2-3条行业趋势判断), risks(2-3条风险提示), opportunities(2-3条机会建议)}。全用简体中文，正文禁止 markdown 符号。'
        const input = JSON.stringify({ 行业: ind, 新闻: collected.slice(0, 15).map(n => ({ 来源: n.source, 标题: n.title })) })
        const rr = await fetch(base + '/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bea' + 'rer ' + cfg.apiKey },
          body: JSON.stringify({ model: cfg.model || 'deepseek-v4-flash', messages: [{ role: 'system', content: sys }, { role: 'user', content: '请生成今日行业热点简报：\n' + input }], max_tokens: 2048, temperature: 0.5 }),
          signal: AbortSignal.timeout(120000),
        })
        const j = await rr.json()
        const text = (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || ''
        try { brief = JSON.parse(text.replace(/```json|```/g, '').trim()) } catch { brief = { summary: text.slice(0, 200) } }
      } else { briefNote = '未配置大模型Key，仅出新闻列表' }
    } catch { briefNote = 'AI简报生成失败，已出新闻列表' }

    // 同步当日新闻到 news_items（保留展示数据源）
    for (const c of collected) {
      const dup: any = await prisma.$queryRawUnsafe(`SELECT 1 FROM news_items WHERE industry=$1 AND day=$2 AND title=$3 LIMIT 1`, ind, day, c.title)
      if (dup.length) continue
      await prisma.$executeRawUnsafe(`INSERT INTO news_items (industry, day, title, url, source, published_at) VALUES ($1,$2,$3,$4,$5,$6)`, ind, day, c.title, c.url, c.source, c.published_at)
    }

    // upsert 抓取历史（本人 · 同行业+同日覆盖为最新一次）
    await prisma.$executeRawUnsafe(`DELETE FROM news_fetch_log WHERE industry=$1 AND day=$2 AND user_id=$3`, ind, day, userId)
    const newsJson = JSON.stringify(collected)
    const briefJson = brief ? JSON.stringify(brief) : ''
    await prisma.$executeRawUnsafe(`INSERT INTO news_fetch_log (industry, day, news, brief, created_at, user_id) VALUES ($1,$2,$3,$4,$5,$6)`, ind, day, newsJson, briefJson, Date.now(), userId)

    // 只保留该用户最近5条抓取历史
    await prisma.$executeRawUnsafe(`DELETE FROM news_fetch_log WHERE user_id=$1 AND id NOT IN (SELECT id FROM news_fetch_log WHERE user_id=$1 ORDER BY id DESC LIMIT 5)`, userId)

    return { success: true, data: { industry: ind, day, news: collected, brief, briefNote } }
  })
}
