<template>
  <div class="aicd" :class="theme">
    <div v-if="m" class="aicd-inner">
      <!-- 面包屑 -->
      <div class="aicd-crumb"><NuxtLink to="/ai-center">← AI模型中心</NuxtLink><span v-if="provider"> / {{ provider.name }}</span></div>

      <div class="aicd-top">
        <div class="aicd-brand" :style="{ background: brandBg(provider?.name || m.name) }">{{ brandChar(provider?.name || m.name) }}</div>
        <div class="aicd-title-wrap">
          <div class="aicd-title">
            <h1>{{ m.name }}</h1>
            <span v-if="m.modelVersion" class="aicd-ver">{{ m.modelVersion }}</span>
            <span class="aicd-badge" :class="m.dataStatus === 'verified' ? 'ok' : 'pending'">{{ m.dataStatus === 'verified' ? '✅ 价格已验证' : '⏳ 价格待验证' }}</span>
          </div>
          <div class="aicd-sub">{{ provider?.name }} · {{ typeLabel(m.modelTypes) }} · {{ provider?.country }}</div>
        </div>
      </div>

      <!-- 核心数据 -->
      <div class="aicd-grid">
        <div class="aicd-card">
          <div class="aicd-card-title">💰 价格 <span class="aicd-unit">（/1M tokens）</span></div>
          <template v-if="m.inputPrice != null">
            <div class="aicd-price-row"><span class="aicd-pl">输入</span><b class="aicd-pv">{{ fmtPrice(m.inputPrice, m.currency) }}</b><span v-if="m.inputCacheHit != null" class="aicd-cache">缓存命中 {{ fmtPrice(m.inputCacheHit, m.currency) }}</span></div>
            <div class="aicd-price-row"><span class="aicd-pl">输出</span><b class="aicd-pv">{{ fmtPrice(m.outputPrice, m.currency) }}</b></div>
            <div class="aicd-verify">
              <div class="aicd-verify-item">🕐 最后验证：<b>{{ fmtDate(m.lastVerifiedAt) }}</b></div>
              <div class="aicd-verify-item">👤 验证人：<b>{{ m.verifiedBy || '—' }}</b></div>
              <div class="aicd-verify-item">📚 数据来源：<b :title="m.dataSource">{{ short(m.dataSource, 46) }}</b></div>
            </div>
          </template>
          <div v-else class="aicd-na">价格待验证（订阅制 / 按量计费），运营验证后展示</div>
          <div v-if="m.contextWindow || m.maxOutput" class="aicd-spec">
            <div v-if="m.contextWindow" class="aicd-spec-item"><span>上下文</span><b>{{ fmtCtx(m.contextWindow) }}</b></div>
            <div v-if="m.maxOutput" class="aicd-spec-item"><span>最大输出</span><b>{{ fmtCtx(m.maxOutput) }}</b></div>
            <div class="aicd-spec-item"><span>计价</span><b>{{ m.currency }} / token</b></div>
          </div>
        </div>

        <div class="aicd-card">
          <div class="aicd-card-title">🧠 能力雷达 <span class="aicd-unit">（{{ m.capabilitySource }}）</span></div>
          <div class="aicd-radar-wrap">
            <svg :viewBox="'0 0 260 240'" class="aicd-radar">
              <polygon v-for="(ring, ri) in 4" :key="ri" :points="polyPoints((ri + 1) / 4)" class="aicd-radar-ring" />
              <line v-for="(d, i) in radarDims" :key="i" :x1="130" :y1="120" :x2="pt(d.angle).x" :y2="pt(d.angle).y" class="aicd-radar-line" />
              <polygon :points="radarPoly" class="aicd-radar-fill" />
              <circle v-for="(d, i) in radarDims" :key="i" :cx="pt(d.angle).x" :cy="pt(d.angle).y" r="2.5" class="aicd-radar-dot" />
              <text v-for="(d, i) in radarDims" :key="i" :x="pt(d.angle, 1.16).x" :y="pt(d.angle, 1.16).y" class="aicd-radar-label" text-anchor="middle" dominant-baseline="middle">{{ d.label }} {{ d.v }}</text>
            </svg>
          </div>
        </div>

        <div class="aicd-card aicd-card-scene">
          <div class="aicd-card-title">🎯 适合场景 <span class="aicd-unit">（本地规则 · 无 AI）</span></div>
          <ul class="aicd-scenes">
            <li v-for="(s, i) in scenes" :key="i">{{ s }}</li>
          </ul>
        </div>
      </div>

      <!-- 能力条 -->
      <div class="aicd-card aicd-card-caps">
        <div class="aicd-card-title">📊 能力维度</div>
        <div class="aicd-caps">
          <div v-for="d in capDims" :key="d.k" class="aicd-cap">
            <span class="aicd-cap-label">{{ d.label }}</span>
            <div class="aicd-cap-bar"><i :style="{ width: d.v + '%' }"></i></div>
            <span class="aicd-cap-val">{{ d.v }}</span>
          </div>
        </div>
      </div>

      <!-- 介绍 -->
      <div v-if="m.description" class="aicd-card aicd-desc">{{ m.description }}</div>

      <!-- 操作 -->
      <div class="aicd-actions">
        <a v-if="registerUrl" :href="registerUrl" target="_blank" rel="noopener" class="aicd-btn primary">注册API账号{{ registerViaAffiliate ? '（推广）' : '' }}</a>
        <a v-if="provider?.billingUrl" :href="provider.billingUrl" target="_blank" rel="noopener" class="aicd-btn">充值</a>
        <a v-if="m.officialApiUrl" :href="m.officialApiUrl" target="_blank" rel="noopener" class="aicd-btn">API 文档</a>
        <a v-if="provider?.officialWebsite" :href="provider.officialWebsite" target="_blank" rel="noopener" class="aicd-btn">官网</a>
      </div>

      <!-- 价格历史 -->
      <div class="aicd-card" v-if="m.priceHistory?.length">
        <div class="aicd-card-title">🕘 价格验证记录 <span class="aicd-unit">（可追溯）</span></div>
        <table class="aicd-hist">
          <thead><tr><th>时间</th><th>输入价</th><th>输出价</th><th>验证人</th><th>来源</th></tr></thead>
          <tbody>
            <tr v-for="h in m.priceHistory" :key="h.id">
              <td>{{ fmtDate(h.verifiedAt) }}</td>
              <td>{{ fmtPrice(h.inputPrice, h.currency) }}</td>
              <td>{{ fmtPrice(h.outputPrice, h.currency) }}</td>
              <td>{{ h.verifiedBy || '—' }}</td>
              <td class="aicd-hist-src" :title="h.dataSource">{{ short(h.dataSource, 34) || (h.note || '—') }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 同厂商其他模型 -->
      <div class="aicd-card" v-if="m.siblings?.length">
        <div class="aicd-card-title">🏢 {{ provider?.name }} 其他模型</div>
        <div class="aicd-siblings">
          <NuxtLink v-for="s in m.siblings" :key="s.code" :to="'/ai-center/model/' + s.code" class="aicd-sib">
            <span class="aicd-sib-name">{{ s.name }}</span>
            <span class="aicd-sib-price">{{ s.inputPrice != null ? fmtPrice(s.inputPrice, s.currency) + ' / ' + fmtPrice(s.outputPrice, s.currency) : '待验证' }}</span>
            <span class="aicd-sib-go">→</span>
          </NuxtLink>
        </div>
      </div>
    </div>

    <div v-else class="aicd-loading">
      <div v-if="error" class="aicd-error">{{ error }}</div>
      <div v-else>加载中…</div>
    </div>
  </div>
</template>

<script setup lang="ts">
// AI-CENTER-06：模型级详情页（价格可追溯：验证时间/验证人/数据来源）
const route = useRoute()
useHead({ title: '模型详情 · AI模型中心' })

const m = ref<any>(null)
const error = ref('')
const theme = ref('dark')
onMounted(() => {
  const dark = window.matchMedia('(prefers-color-scheme: dark)').matches
  theme.value = dark ? 'dark' : 'light'
  load()
})
async function load() {
  try {
    const r = await fetch(`/api/ai-provider-directory/models/${route.params.code}`).then((r) => r.json())
    if (r.code === 0) m.value = r.data
    else error.value = r.error || '模型不存在'
  } catch { error.value = '加载失败' }
}
const provider = computed(() => m.value?.provider || null)

const RADAR_LABELS: Record<string, string> = { quality: '质量', speed: '速度', cost: '价格', chinese: '中文', coding: '代码', reasoning: '推理' }
const radarDims = computed(() => {
  const cap = m.value?.capabilityScore || {}
  const types = m.value?.modelTypes || []
  const keys = (types.some((t: string) => ['image', 'video', 'audio'].includes(t)) ? ['quality', 'speed', 'cost', 'chinese'] : ['quality', 'speed', 'chinese', 'coding', 'reasoning', 'cost'])
  return keys.map((k) => ({ k, label: RADAR_LABELS[k] || k, v: Number(cap[k]) || 0 })).filter((d) => d.v > 0)
})
const pt = (angle: number, scale = 1) => ({ x: 130 + Math.cos(angle) * 88 * scale, y: 120 + Math.sin(angle) * 88 * scale })
const polyPoints = (scale: number) => radarDims.value.map((d, i) => {
  const p = pt((i / radarDims.value.length) * Math.PI * 2 - Math.PI / 2, scale)
  return `${p.x},${p.y}`
}).join(' ')
const radarPoly = computed(() => radarDims.value.map((d, i) => {
  const p = pt((i / radarDims.value.length) * Math.PI * 2 - Math.PI / 2, (d.v / 100) * 0.92)
  return `${p.x},${p.y}`
}).join(' '))

const capDims = computed(() => {
  const cap = m.value?.capabilityScore || {}
  const types = m.value?.modelTypes || []
  const dims = (types.some((t: string) => ['image', 'video', 'audio'].includes(t)) ? ['quality', 'speed', 'cost', 'chinese'] : ['quality', 'speed', 'cost', 'chinese', 'coding', 'reasoning'])
  return dims.map((k) => ({ k, label: RADAR_LABELS[k] || k, v: Number(cap[k]) || 0 })).filter((d) => d.v > 0)
})

const scenes = computed(() => {
  const cap = m.value?.capabilityScore || {}
  const r = Number(cap.reasoning) || 0, c = Number(cap.coding) || 0, ch = Number(cap.chinese) || 0, sp = Number(cap.speed) || 0
  const s: string[] = []
  if (r >= 90) s.push('🧠 深度推理 · 数学 / 逻辑 / 复杂分析')
  if (c >= 90) s.push('💻 代码生成 · 编程助手 / 代码审查')
  if (ch >= 92) s.push('🇨🇳 中文内容创作 · 文案 / 翻译 / 中文理解')
  if (sp >= 92) s.push('⚡ 高并发 API · 客服 / 分类 / 抽取等高频调用')
  if (m.value?.contextWindow && m.value.contextWindow >= 900000) s.push('📜 超长上下文 · 长文档 / 多文件代码库 / 长对话')
  if ((m.value?.modelTypes || []).includes('multimodal')) s.push('🖼️ 多模态输入 · 图片 / 视频理解')
  if ((m.value?.modelTypes || []).includes('image')) s.push('🎨 文生图 · 创意设计 / 海报 / 电商图')
  if ((m.value?.modelTypes || []).includes('video')) s.push('🎬 文生视频 · 短视频 / 广告 / 动态分镜')
  if ((m.value?.modelTypes || []).includes('audio')) s.push('🎙️ 语音合成 · TTS / 配音 / 声音克隆')
  if ((m.value?.modelTypes || []).includes('agent')) s.push('🤖 Agent 任务 · 工具调用 / 多步执行')
  if (!s.length) s.push('📌 通用任务 · 对话 / 摘要 / 内容生成')
  return s.slice(0, 5)
})

const registerUrl = computed(() => m.value?.registerUrl || provider.value?.registerUrl || '')
const registerViaAffiliate = computed(() => m.value?.registerViaAffiliate || false)

function typeLabel(types: string[]) {
  const map: Record<string, string> = { language: '语言', image: '图片', video: '视频', audio: '语音', multimodal: '多模态', agent: 'Agent' }
  return (types || []).map((t) => map[t] || t).join(' · ')
}
function fmtPrice(v: number | null | undefined, cur?: string): string {
  if (v == null) return '—'
  const c = cur || 'USD'
  const s = c === 'CNY' ? '¥' : '$'
  const raw = v >= 10 ? v.toFixed(0) : v >= 1 ? v.toFixed(2) : v >= 0.1 ? v.toFixed(2) : v.toFixed(3)
  const out = raw.includes('.') ? raw.replace(/0+$/, '').replace(/\.$/, '') : raw
  return s + out
}
function fmtCtx(v: number): string {
  if (!v) return '—'
  if (v >= 1000000) return (v / 1000000).toFixed(v % 1000000 === 0 ? 0 : 1) + 'M'
  if (v >= 1000) return Math.round(v / 1000) + 'K'
  return String(v)
}
function fmtDate(d: string): string {
  if (!d) return ''
  const dt = new Date(d)
  if (isNaN(dt.getTime())) return d.slice(0, 10)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`
}
function short(s: string, n: number): string { return s && s.length > n ? s.slice(0, n) + '…' : (s || '') }
const BRAND_COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#6366f1', '#14b8a6', '#a855f7']
function brandChar(name: string): string { return (name || '?').charAt(0).toUpperCase() }
function brandBg(name: string): string {
  let h = 0
  for (const ch of name || '') h = (h * 31 + ch.charCodeAt(0)) % 997
  return BRAND_COLORS[h % BRAND_COLORS.length]
}
</script>

<style scoped>
.aicd { min-height: 100vh; background: #070b14; color: #e5e9f2; padding: 26px 20px 50px; transition: background .3s, color .3s; }
.aicd.light { background: #f7f8fb; color: #1a2233; }
.aicd-inner { max-width: 1080px; margin: 0 auto; }
.aicd-crumb { font-size: 12px; color: #7a86a3; margin-bottom: 18px; }
.aicd-crumb a { color: #3b82f6; text-decoration: none; }
.aicd-top { display: flex; gap: 16px; align-items: center; margin-bottom: 20px; }
.aicd-brand { width: 56px; height: 56px; border-radius: 14px; display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 800; font-size: 24px; }
.aicd-title { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.aicd-title h1 { font-size: 24px; font-weight: 800; margin: 0; }
.aicd-ver { font-size: 11px; color: #8b94ab; border: 1px solid rgba(255,255,255,.12); border-radius: 6px; padding: 2px 8px; }
.light .aicd-ver { border-color: #dde2ec; }
.aicd-badge { font-size: 11px; border-radius: 999px; padding: 3px 10px; font-weight: 600; }
.aicd-badge.ok { background: rgba(16,185,129,.13); color: #10b981; }
.aicd-badge.pending { background: rgba(245,158,11,.13); color: #f59e0b; }
.aicd-sub { font-size: 12.5px; color: #7a86a3; margin-top: 4px; }
.aicd-grid { display: grid; grid-template-columns: 1.2fr 1fr 1fr; gap: 14px; margin-bottom: 14px; }
@media (max-width: 1000px) { .aicd-grid { grid-template-columns: 1fr; } }
.aicd-card { border: 1px solid rgba(255,255,255,.07); border-radius: 14px; background: rgba(255,255,255,.025); padding: 16px; margin-bottom: 14px; }
.light .aicd-card { border-color: #e3e7f0; background: #fff; box-shadow: 0 1px 3px rgba(16,24,40,.04); }
.aicd-card-title { font-size: 13.5px; font-weight: 700; margin-bottom: 12px; }
.aicd-unit { font-size: 10.5px; color: #7a86a3; font-weight: 400; }
.aicd-price-row { display: flex; align-items: center; gap: 10px; padding: 5px 0; }
.aicd-pl { font-size: 11px; color: #7a86a3; width: 30px; }
.aicd-pv { font-size: 20px; font-weight: 800; color: #3b82f6; }
.aicd-cache { font-size: 11px; color: #10b981; }
.aicd-na { font-size: 12.5px; color: #f59e0b; padding: 10px 0; }
.aicd-verify { margin-top: 12px; border-top: 1px dashed rgba(255,255,255,.09); padding-top: 10px; display: flex; flex-direction: column; gap: 5px; }
.light .aicd-verify { border-top-color: #e8ebf3; }
.aicd-verify-item { font-size: 11.5px; color: #8b94ab; }
.aicd-verify-item b { color: #c8d0e0; font-weight: 600; }
.light .aicd-verify-item b { color: #4a5468; }
.aicd-spec { margin-top: 12px; display: flex; gap: 8px; flex-wrap: wrap; }
.aicd-spec-item { font-size: 11px; background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.08); border-radius: 8px; padding: 6px 10px; display: flex; flex-direction: column; gap: 2px; }
.light .aicd-spec-item { background: #f4f6fa; border-color: #e6eaf2; }
.aicd-spec-item span { color: #7a86a3; }
.aicd-spec-item b { font-size: 13px; }
.aicd-radar-wrap { display: flex; justify-content: center; }
.aicd-radar { width: 250px; height: 230px; }
.aicd-radar-ring { fill: none; stroke: rgba(255,255,255,.08); stroke-width: 1; }
.light .aicd-radar-ring { stroke: rgba(16,24,40,.1); }
.aicd-radar-line { stroke: rgba(255,255,255,.07); stroke-width: 1; }
.light .aicd-radar-line { stroke: rgba(16,24,40,.09); }
.aicd-radar-fill { fill: rgba(59,130,246,.16); stroke: #3b82f6; stroke-width: 1.6; }
.aicd-radar-dot { fill: #3b82f6; }
.aicd-radar-label { font-size: 10px; fill: #8b94ab; }
.aicd-scenes { margin: 0; padding-left: 4px; list-style: none; display: flex; flex-direction: column; gap: 8px; }
.aicd-scenes li { font-size: 12px; color: #c8d0e0; line-height: 1.5; }
.light .aicd-scenes li { color: #3d475c; }
.aicd-caps { display: flex; flex-direction: column; gap: 8px; }
.aicd-cap { display: grid; grid-template-columns: 70px 1fr 30px; align-items: center; gap: 10px; }
.aicd-cap-label { font-size: 12px; color: #8b94ab; }
.aicd-cap-bar { height: 7px; background: rgba(255,255,255,.07); border-radius: 4px; overflow: hidden; }
.light .aicd-cap-bar { background: #eef1f6; }
.aicd-cap-bar i { display: block; height: 100%; background: linear-gradient(90deg, #3b82f6, #8b5cf6); border-radius: 4px; }
.aicd-cap-val { font-size: 12px; font-weight: 700; text-align: right; }
.aicd-desc { font-size: 12.5px; color: #a7b0c5; line-height: 1.8; }
.light .aicd-desc { color: #4a5468; }
.aicd-actions { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 14px; }
.aicd-btn { font-size: 12.5px; border: 1px solid rgba(255,255,255,.12); border-radius: 9px; padding: 9px 18px; color: inherit; text-decoration: none; font-weight: 600; transition: all .2s; }
.aicd-btn:hover { border-color: rgba(59,130,246,.5); color: #3b82f6; }
.aicd-btn.primary { background: #3b82f6; border-color: #3b82f6; color: #fff; }
.aicd-btn.primary:hover { background: #2563eb; }
.light .aicd-btn { border-color: #dde2ec; }
.aicd-hist { width: 100%; border-collapse: collapse; font-size: 11.5px; }
.aicd-hist th { text-align: left; color: #7a86a3; font-weight: 600; padding: 6px 8px; border-bottom: 1px solid rgba(255,255,255,.08); }
.aicd-hist td { padding: 6px 8px; border-bottom: 1px solid rgba(255,255,255,.04); }
.light .aicd-hist th { border-bottom-color: #e6eaf2; }
.light .aicd-hist td { border-bottom-color: #f2f4f9; }
.aicd-hist-src { color: #7a86a3; max-width: 180px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.aicd-siblings { display: flex; flex-direction: column; gap: 6px; }
.aicd-sib { display: flex; align-items: center; gap: 10px; padding: 9px 12px; border: 1px solid rgba(255,255,255,.07); border-radius: 9px; text-decoration: none; color: inherit; transition: border-color .2s; }
.aicd-sib:hover { border-color: rgba(59,130,246,.45); }
.light .aicd-sib { border-color: #e6eaf2; }
.aicd-sib-name { font-size: 12.5px; font-weight: 600; flex: 1; }
.aicd-sib-price { font-size: 11.5px; color: #3b82f6; }
.aicd-sib-go { color: #7a86a3; }
.aicd-loading { text-align: center; padding: 80px 0; color: #7a86a3; font-size: 13px; }
.aicd-error { color: #ef4444; }
</style>
