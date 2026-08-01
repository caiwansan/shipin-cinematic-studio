<template>
  <div class="aic">
    <!-- ═══ Hero ═══ -->
    <section class="aic-hero">
      <div class="aic-hero-inner">
        <div class="aic-brand">AI中心</div>
        <h1 class="aic-title">发现全球最佳 AI 模型</h1>
        <p class="aic-sub">价格、能力、性价比，一站比较。</p>
        <div class="aic-search">
          <span class="aic-search-ico">🔍</span>
          <input v-model="keyword" class="aic-search-input" type="text"
                 placeholder="搜索模型名称、厂商、能力…" />
          <button v-if="keyword" class="aic-search-clear" @click="keyword = ''">✕</button>
        </div>
        <div class="aic-stats">
          <div class="aic-stat">
            <div class="aic-stat-num">{{ stats.modelCount }}+</div>
            <div class="aic-stat-label">全球模型</div>
          </div>
          <div class="aic-stat">
            <div class="aic-stat-num">{{ stats.providerCount }}+</div>
            <div class="aic-stat-label">支持厂商</div>
          </div>
          <div class="aic-stat">
            <div class="aic-stat-num">{{ stats.connectedCount }}</div>
            <div class="aic-stat-label">已连接模型</div>
          </div>
        </div>
      </div>
    </section>

    <!-- ═══ 分类导航 ═══ -->
    <nav class="aic-tabs">
      <button v-for="t in tabs" :key="t.key" class="aic-tab" :class="{ on: activeTab === t.key }"
              @click="activeTab = t.key">
        {{ t.label }}<span class="aic-tab-count">{{ typeCount(t.key) }}</span>
      </button>
    </nav>

    <!-- ═══ 价格中心横幅 ═══ -->
    <div class="aic-pricebar">
      <span class="aic-pricebar-dot"></span>
      <span>价格更新时间：<b>{{ priceUpdated }}</b></span>
      <span class="aic-pricebar-sep">·</span>
      <span>来源：<b>官方公开价格</b>（参考价，以官方实时为准）</span>
    </div>

    <!-- ═══ 模型卡片网格 ═══ -->
    <section class="aic-grid">
      <div v-for="p in filtered" :key="p.code" class="aic-card" :class="{ connected: p.connected }"
           @click="openDetail(p.code)">
        <!-- 卡头 -->
        <div class="aic-card-head">
          <div class="aic-logo" :style="logoStyle(p)">{{ brandInitial(p.name) }}</div>
          <div class="aic-card-title">
            <div class="aic-card-name">{{ cardTitle(p) }}
              <span v-if="p.recommendTag" class="aic-tag">{{ p.recommendTag }}</span>
            </div>
            <div class="aic-card-meta">{{ p.country }} · {{ typeLabel(p.modelTypes) }}</div>
          </div>
          <div class="aic-score" :title="'性价比 = 能力综合×60% + 价格优势×40%（纯计算）'">
            <div class="aic-score-val">{{ p.valueScore ?? '—' }}</div>
            <div class="aic-score-stars">{{ stars(p.valueScore) }}</div>
            <div class="aic-score-label">综合性价比</div>
          </div>
        </div>
        <!-- 能力 -->
        <div class="aic-caps">
          <div class="aic-cap" v-for="c in capBars(p)" :key="c.label">
            <span class="aic-cap-label">{{ c.label }}</span>
            <div class="aic-cap-track"><div class="aic-cap-fill" :style="{ width: c.value + '%' }"></div></div>
            <span class="aic-cap-val">{{ c.value }}</span>
          </div>
        </div>
        <!-- 价格 -->
        <div class="aic-price">
          <div class="aic-price-row">
            <span class="aic-price-k">输入</span>
            <span class="aic-price-v">{{ priceText(p, 'input') }}</span>
            <span class="aic-price-k">输出</span>
            <span class="aic-price-v">{{ priceText(p, 'output') }}</span>
            <span v-if="p.contextLength" class="aic-ctx">上下文 {{ ctxText(p.contextLength) }}</span>
          </div>
        </div>
        <!-- 我的状态 -->
        <div class="aic-state">
          <div class="aic-state-left">
            <span class="aic-state-dot" :class="{ on: p.connected }"></span>
            <span>{{ p.connected ? '已连接' : '未连接' }}</span>
          </div>
          <div class="aic-state-right">
            <span class="aic-state-mini">余额：<b>{{ p.balanceText || '—' }}</b></span>
            <span class="aic-state-mini" v-if="p.lastCostText">最近消耗：{{ p.lastCostText }}</span>
          </div>
        </div>
        <!-- 操作 -->
        <div class="aic-actions" @click.stop>
          <a class="aic-btn primary" :href="p.registerUrl" target="_blank" rel="noopener">注册API账号</a>
          <a v-if="p.billingUrl" class="aic-btn" :href="p.billingUrl" target="_blank" rel="noopener">充值</a>
          <button v-if="p.officialBalanceApi" class="aic-btn ghost" @click="openBalance(p)">查询余额</button>
        </div>
      </div>
      <div v-if="!filtered.length" class="aic-empty">没有匹配的模型，换个关键词试试 🔍</div>
    </section>

    <!-- ═══ AI Compare 二维对比 ═══ -->
    <section class="aic-compare-sec">
      <div class="aic-sec-head">
        <h2>AI Compare <span class="aic-sec-sub">能力 × 价格 二维对比</span></h2>
        <p class="aic-sec-desc">横轴价格（左低右高），纵轴能力（下低上高），气泡大小 = 性价比。一目了然谁最划算。</p>
      </div>
      <div class="aic-compare">
        <div class="aic-compare-axis-y">能力高 ▲</div>
        <svg class="aic-compare-svg" :viewBox="`0 0 ${CW} ${CH}`" @click="onCompareClick">
          <!-- 网格 -->
          <g v-for="gy in [0.25, 0.5, 0.75]" :key="'gy' + gy">
            <line :x1="PX" :y1="PY - gy * PH" :x2="PX + PW" :y2="PY - gy * PH" class="grid" />
          </g>
          <g v-for="gx in [0.25, 0.5, 0.75]" :key="'gx' + gx">
            <line :x1="PX + gx * PW" :y1="PY" :x2="PX + gx * PW" :y2="PY - PH" class="grid" />
          </g>
          <!-- 轴标签 -->
          <text :x="PX + PW / 2" :y="CH - 8" class="axis-label" text-anchor="middle">价格低 ────────── 价格高</text>
          <!-- 散点 -->
          <g v-for="(pt, i) in comparePts" :key="pt.code">
            <circle :cx="pt.x" :cy="pt.y" :r="pt.r" class="bubble" :class="pt.hot ? 'hot' : ''"
                    :fill="pt.color" :opacity="pt.hot ? 0.95 : 0.55"
                    @mouseenter="hoverPt = pt.code" @mouseleave="hoverPt = ''" />
            <text v-if="hoverPt === pt.code || pt.hot" :x="pt.x" :y="pt.y - pt.r - 6"
                  class="bubble-label" text-anchor="middle" :class="{ hot: pt.hot }">{{ pt.label }}</text>
          </g>
        </svg>
        <div class="aic-compare-axis-x">▲ 性价比 = 能力×60% + 价格×40%</div>
      </div>
      <div class="aic-compare-legend">
        <span v-for="l in compareLegend" :key="l.name" class="aic-legend-item">
          <span class="aic-legend-dot" :style="{ background: l.color }"></span>{{ l.name }}
        </span>
      </div>
    </section>

    <!-- ═══ 余额查询弹窗（BYOK：实时请求官方接口 → 展示 → 立即释放，不落库） ═══ -->
    <Teleport to="body">
      <div v-if="balance.open" class="aic-modal-mask" @click.self="balance.open = false">
        <div class="aic-modal">
          <div class="aic-modal-head">
            <div class="aic-logo sm" :style="logoStyle(balance.providerObj)">{{ brandInitial(balance.providerObj?.name || '') }}</div>
            <div>
              <div class="aic-modal-title">{{ balance.providerObj?.name }} · 余额查询</div>
              <div class="aic-modal-sub">BYOK：Key 实时请求官方接口，展示后立即释放，绝不落库</div>
            </div>
            <button class="aic-modal-x" @click="balance.open = false">✕</button>
          </div>
          <div class="aic-modal-body">
            <label class="aic-field-label">API Key（官方接口临时使用）</label>
            <input v-model="balance.apiKey" class="aic-input" type="password" placeholder="sk-…"
                   @keyup.enter="queryBalance" />
            <div v-if="balance.error" class="aic-balance-err">{{ balance.error }}</div>
            <div v-if="balance.result" class="aic-balance-ok">
              <div class="aic-balance-big">¥{{ balance.result.balance ?? '—' }}</div>
              <div class="aic-balance-note">{{ balance.result.note || '官方实时余额' }}</div>
            </div>
            <button class="aic-btn primary block" :disabled="balance.loading" @click="queryBalance">
              {{ balance.loading ? '查询中…' : '查询余额' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const keyword = ref('')
const activeTab = ref('all')
const providers = ref<any[]>([])
const stats = ref({ modelCount: 0, providerCount: 0, connectedCount: 0 })
const compareData = ref<any[]>([])
const hoverPt = ref('')

interface DirectoryProvider {
  code: string; name: string; modelName?: string; country: string; category: string
  tags?: string[]; modelTypes?: string[]; description?: string | null
  capabilityScore?: Record<string, number> | null; costScore?: number | null
  pricingInfo?: { inputPrice?: number | null; outputPrice?: number | null; currency?: string } | null
  contextLength?: number | null; priceSource?: string; pricingUpdatedAt?: string | null
  registerUrl?: string; billingUrl?: string; officialBalanceApi?: string
  supportedModels?: string[]; recommendTag?: string; valueScore?: number | null
  connected?: boolean
}

const tabs = [
  { key: 'all', label: '全部' },
  { key: 'language', label: '💬 语言模型' },
  { key: 'image', label: '🎨 图片模型' },
  { key: 'video', label: '🎬 视频模型' },
  { key: 'audio', label: '🎙️ 语音模型' },
  { key: 'multimodal', label: '🌐 多模态模型' },
  { key: 'agent', label: '🤖 Agent模型' },
]

const TYPE_LABEL: Record<string, string> = {
  language: '语言模型', image: '图片模型', video: '视频模型',
  audio: '语音模型', multimodal: '多模态模型', agent: 'Agent模型',
}

function cardTitle(p: DirectoryProvider): string {
  return p.modelName ? `${p.name} ${p.modelName}` : p.name
}

function typeLabel(types: string[] | undefined): string {
  if (!types?.length) return ''
  return types.map((t) => TYPE_LABEL[t] || t).join(' / ')
}

function typeCount(key: string): number {
  if (key === 'all') return providers.value.length
  return providers.value.filter((p) => (p.modelTypes || []).includes(key)).length
}

const filtered = computed(() => {
  let list = providers.value
  if (activeTab.value !== 'all') list = list.filter((p) => (p.modelTypes || []).includes(activeTab.value))
  const kw = keyword.value.trim().toLowerCase()
  if (kw) {
    list = list.filter((p) =>
      (p.name || '').toLowerCase().includes(kw) ||
      (p.modelName || '').toLowerCase().includes(kw) ||
      (p.description || '').toLowerCase().includes(kw) ||
      (p.tags || []).some((t: string) => t.toLowerCase().includes(kw)) ||
      (p.supportedModels || []).some((m: string) => m.toLowerCase().includes(kw))
    )
  }
  return list
})

/** 能力条：语言类显示 中文/推理/代码，视觉类显示 质量/速度/中文 */
function capBars(p: DirectoryProvider): Array<{ label: string; value: number }> {
  const c = p.capabilityScore || {}
  const isVisual = (p.modelTypes || []).some((t) => ['image', 'video', 'audio'].includes(t))
  const keys = isVisual
    ? [['质量', c.quality], ['速度', c.speed], ['中文', c.chinese]] as const
    : [['中文', c.chinese], ['推理', c.reasoning], ['代码', c.coding]] as const
  return keys.map(([label, v]) => ({ label: label as string, value: Number(v) || 0 }))
}

function stars(v: number | null | undefined): string {
  if (v == null) return '☆☆☆☆☆'
  const n = Math.max(1, Math.min(5, Math.round(v / 20)))
  return '★'.repeat(n) + '☆'.repeat(5 - n)
}

function priceText(p: DirectoryProvider, kind: 'input' | 'output'): string {
  const info = p.pricingInfo
  const v = kind === 'input' ? info?.inputPrice : info?.outputPrice
  if (v == null) return '按用量计费'
  return `¥${v} / 百万tokens`
}

function ctxText(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M'
  if (n >= 1000) return Math.round(n / 1000) + 'K'
  return String(n)
}

/** 品牌色（无 logo 时用首字母色块） */
const BRAND_COLORS: Record<string, [string, string]> = {
  deepseek: ['#4d6bfe', '#8ab4ff'], openai: ['#10a37f', '#74f2ce'], zhipu: ['#3859ff', '#93aaff'],
  moonshot: ['#0d0d0d', '#888888'], volcengine: ['#0a7cff', '#8fd0ff'], aliyun: ['#ff6a00', '#ffc38a'],
  baidu: ['#2932e1', '#8a90ff'], tencent: ['#0eaeff', '#8fe0ff'], iflytek: ['#0055ff', '#8ab4ff'],
  google: ['#4285f4', '#a3c6ff'], anthropic: ['#d97757', '#ffb89a'], meta: ['#0668e1', '#8ab4ff'],
  jimeng: ['#8a2be2', '#cba3ff'], midjourney: ['#0b0b0b', '#999999'], dalle: ['#10a37f', '#74f2ce'],
  wanxiang: ['#ff6a00', '#ffc38a'], kling: ['#00d4ff', '#a3ecff'], runway: ['#111111', '#777777'],
  pika: ['#e94e8f', '#ffa3c8'], luma: ['#7c3aed', '#c4a5ff'], elevenlabs: ['#1a1a1a', '#888888'],
}
function logoStyle(p: any) {
  const [a, b] = BRAND_COLORS[p?.code] || ['#555', '#888']
  return { background: `linear-gradient(135deg, ${a}, ${b})` }
}
function brandInitial(name: string): string {
  return (name || '?').trim().charAt(0).toUpperCase()
}

/* ── Compare 二维散点 ── */
const CW = 900, CH = 420, PX = 70, PY = 390, PW = 780, PH = 330
const comparePts = computed(() => {
  const withPrice = compareData.value.filter((d) => d.price != null)
  const maxPrice = Math.max(...withPrice.map((d) => d.price), 1)
  const logMax = Math.log10(maxPrice + 1)
  const colorOf = (types: string[]) => {
    if (types.includes('agent')) return '#a855f7'
    if (types.includes('multimodal')) return '#22d3ee'
    return '#f97316'
  }
  return withPrice.map((d) => ({
    code: d.code, label: d.name,
    x: PX + (Math.log10(d.price + 1) / logMax) * PW,
    y: PY - (d.ability / 100) * PH,
    r: 6 + (d.valueScore / 100) * 10,
    color: colorOf(d.types || []),
    hot: d.code === 'deepseek' || d.code === 'openai' || d.code === 'volcengine',
  }))
})
const compareLegend = [
  { name: '🟠 语言', color: '#f97316' }, { name: '🩵 多模态', color: '#22d3ee' }, { name: '🟣 Agent', color: '#a855f7' },
]
function onCompareClick() { /* 详情在卡片区进入 */ }

/* ── 余额查询（BYOK） ── */
const balance = reactive({
  open: false, provider: '', providerObj: null as any, apiKey: '', loading: false, result: null as any, error: '',
})
function openBalance(p: DirectoryProvider) {
  balance.open = true; balance.provider = p.code; balance.providerObj = p
  balance.apiKey = ''; balance.result = null; balance.error = ''
}
async function queryBalance() {
  if (!balance.apiKey.trim()) { balance.error = '请输入 API Key'; return }
  balance.loading = true; balance.error = ''; balance.result = null
  try {
    const res: any = await $fetch('/api/ai/center/balance-query', {
      method: 'POST',
      body: { provider: balance.provider, apiKey: balance.apiKey.trim() },
    }).catch((e: any) => ({ code: 1, error: e?.data?.error || '查询失败' }))
    if (res.code === 0) balance.result = res.data
    else balance.error = res.error || '查询失败'
  } finally { balance.loading = false }
}

function openDetail(code: string) { router.push(`/ai-center/${code}`) }

const priceUpdated = computed(() => {
  const dates = providers.value.map((p) => p.pricingUpdatedAt).filter(Boolean).map((d) => new Date(d as string))
  if (!dates.length) return '—'
  const max = new Date(Math.max(...dates.map((d) => d.getTime())))
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${max.getFullYear()}-${pad(max.getMonth() + 1)}-${pad(max.getDate())}`
})

onMounted(async () => {
  const [dir, st, cp] = await Promise.all([
    $fetch('/api/ai-provider-directory').catch(() => ({ code: 1, data: [] })),
    $fetch('/api/ai-provider-directory/stats').catch(() => ({ code: 1, data: null })),
    $fetch('/api/ai/center/compare').catch(() => ({ code: 1, data: [] })),
  ])
  if (dir?.code === 0) providers.value = dir.data
  if (st?.code === 0) stats.value = st.data
  if (cp?.code === 0) compareData.value = cp.data
})
</script>

<style scoped>
.aic { max-width: 1240px; margin: 0 auto; padding: 0 24px 80px; color: var(--aic-txt, #1a1a2e); }
.aic :deep(a) { text-decoration: none; }

/* 亮暗自适应变量 */
.aic { --aic-txt: #16161f; --aic-muted: #6b7280; --aic-card: rgba(255,255,255,0.72); --aic-border: rgba(0,0,0,0.08); --aic-glass: rgba(255,255,255,0.6); --aic-bg: #f7f8fb; }
@media (prefers-color-scheme: dark) {
  .aic { --aic-txt: #e8e8f0; --aic-muted: #9098b8; --aic-card: rgba(26,26,36,0.72); --aic-border: rgba(255,255,255,0.08); --aic-glass: rgba(26,26,36,0.55); --aic-bg: #0a0a0f; }
}
.aic { background: var(--aic-bg); border-radius: 24px; }

/* ── Hero ── */
.aic-hero { padding: 72px 24px 40px; text-align: center; position: relative; overflow: hidden; }
.aic-hero::before { content: ''; position: absolute; inset: -40% -20% auto; height: 90%; background: radial-gradient(ellipse at 50% 0%, rgba(249,115,22,0.14), transparent 60%); pointer-events: none; }
.aic-brand { display: inline-block; font-size: 13px; font-weight: 700; letter-spacing: 2px; color: #f97316; background: rgba(249,115,22,0.12); border: 1px solid rgba(249,115,22,0.3); padding: 6px 16px; border-radius: 999px; margin-bottom: 22px; }
.aic-title { font-size: clamp(34px, 5vw, 56px); font-weight: 800; letter-spacing: -1.5px; margin: 0 0 14px; background: linear-gradient(120deg, #f97316, #a855f7 70%); -webkit-background-clip: text; background-clip: text; color: transparent; }
.aic-sub { font-size: 17px; color: var(--aic-muted); margin: 0 0 28px; }
.aic-search { max-width: 520px; margin: 0 auto 40px; display: flex; align-items: center; gap: 10px; background: var(--aic-card); border: 1px solid var(--aic-border); border-radius: 999px; padding: 8px 18px; backdrop-filter: blur(12px); box-shadow: 0 8px 32px rgba(0,0,0,0.08); transition: box-shadow .25s, transform .25s; }
.aic-search:focus-within { box-shadow: 0 8px 40px rgba(249,115,22,0.18); transform: translateY(-1px); }
.aic-search-input { flex: 1; border: none; outline: none; background: transparent; font-size: 15px; color: var(--aic-txt); padding: 6px 0; }
.aic-search-clear { border: none; background: transparent; color: var(--aic-muted); cursor: pointer; font-size: 14px; }
.aic-stats { display: flex; justify-content: center; gap: 20px; flex-wrap: wrap; }
.aic-stat { min-width: 150px; padding: 22px 28px; border-radius: 20px; background: var(--aic-glass); border: 1px solid var(--aic-border); backdrop-filter: blur(14px); transition: transform .25s; }
.aic-stat:hover { transform: translateY(-3px); }
.aic-stat-num { font-size: 34px; font-weight: 800; background: linear-gradient(120deg, #f97316, #f59e0b); -webkit-background-clip: text; background-clip: text; color: transparent; }
.aic-stat-label { font-size: 13px; color: var(--aic-muted); margin-top: 4px; }

/* ── Tabs ── */
.aic-tabs { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; padding: 8px 0 22px; position: sticky; top: 0; z-index: 20; background: var(--aic-bg); border-radius: 24px; }
.aic-tab { border: 1px solid var(--aic-border); background: var(--aic-card); color: var(--aic-muted); padding: 9px 18px; border-radius: 999px; font-size: 14px; cursor: pointer; transition: all .2s; backdrop-filter: blur(8px); }
.aic-tab:hover { transform: translateY(-1px); }
.aic-tab.on { background: linear-gradient(120deg, #f97316, #a855f7); color: #fff; border-color: transparent; box-shadow: 0 6px 20px rgba(249,115,22,0.3); }
.aic-tab-count { font-size: 11px; opacity: .75; margin-left: 5px; }

/* ── 价格中心横幅 ── */
.aic-pricebar { display: flex; justify-content: center; align-items: center; gap: 10px; font-size: 13px; color: var(--aic-muted); padding: 12px 18px; margin: 4px auto 28px; max-width: 640px; border-radius: 14px; background: var(--aic-glass); border: 1px solid var(--aic-border); }
.aic-pricebar-dot { width: 8px; height: 8px; border-radius: 50%; background: #22c55e; box-shadow: 0 0 10px #22c55e; animation: pulse 2s infinite; }
@keyframes pulse { 50% { opacity: .4; } }

/* ── 卡片网格 ── */
.aic-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 20px; }
.aic-card { border-radius: 20px; padding: 22px; background: var(--aic-card); border: 1px solid var(--aic-border); backdrop-filter: blur(14px); cursor: pointer; transition: transform .25s, box-shadow .25s, border-color .25s; animation: rise .5s ease both; }
.aic-card:hover { transform: translateY(-4px); box-shadow: 0 18px 48px rgba(0,0,0,0.12); border-color: rgba(249,115,22,0.4); }
.aic-card.connected { border-color: rgba(34,197,94,0.35); }
.aic-card-head { display: flex; align-items: flex-start; gap: 12px; }
.aic-logo { width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 800; font-size: 18px; flex-shrink: 0; box-shadow: 0 4px 14px rgba(0,0,0,0.2); }
.aic-logo.sm { width: 36px; height: 36px; font-size: 15px; }
.aic-card-title { flex: 1; min-width: 0; }
.aic-card-name { font-size: 17px; font-weight: 700; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.aic-tag { font-size: 10px; font-weight: 600; color: #f97316; background: rgba(249,115,22,0.12); border: 1px solid rgba(249,115,22,0.3); padding: 2px 8px; border-radius: 999px; white-space: nowrap; }
.aic-card-meta { font-size: 12px; color: var(--aic-muted); margin-top: 3px; }
.aic-score { text-align: right; flex-shrink: 0; }
.aic-score-val { font-size: 26px; font-weight: 800; color: #f97316; line-height: 1; }
.aic-score-stars { font-size: 11px; color: #f59e0b; letter-spacing: 1px; margin-top: 3px; }
.aic-score-label { font-size: 10px; color: var(--aic-muted); margin-top: 2px; }

/* 能力条 */
.aic-caps { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin: 16px 0 12px; padding: 14px; border-radius: 14px; background: rgba(0,0,0,0.03); }
@media (prefers-color-scheme: dark) { .aic-caps { background: rgba(255,255,255,0.04); } }
.aic-cap { display: flex; flex-direction: column; gap: 4px; }
.aic-cap-label { font-size: 10px; color: var(--aic-muted); }
.aic-cap-track { height: 5px; border-radius: 999px; background: rgba(0,0,0,0.08); overflow: hidden; }
@media (prefers-color-scheme: dark) { .aic-cap-track { background: rgba(255,255,255,0.1); } }
.aic-cap-fill { height: 100%; border-radius: 999px; background: linear-gradient(90deg, #f97316, #f59e0b); transition: width .8s ease; }
.aic-cap-val { font-size: 11px; font-weight: 700; }

/* 价格 */
.aic-price { padding: 10px 14px; border-radius: 12px; background: rgba(249,115,22,0.06); border: 1px dashed rgba(249,115,22,0.25); }
.aic-price-row { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.aic-price-k { font-size: 11px; color: var(--aic-muted); }
.aic-price-v { font-size: 14px; font-weight: 700; margin-right: 8px; }
.aic-ctx { margin-left: auto; font-size: 11px; color: var(--aic-muted); background: rgba(0,0,0,0.05); padding: 2px 8px; border-radius: 999px; }
@media (prefers-color-scheme: dark) { .aic-ctx { background: rgba(255,255,255,0.08); } }

/* 状态 */
.aic-state { display: flex; justify-content: space-between; align-items: center; margin: 12px 2px; font-size: 12px; }
.aic-state-left { display: flex; align-items: center; gap: 6px; font-weight: 600; }
.aic-state-dot { width: 9px; height: 9px; border-radius: 50%; background: #9ca3af; }
.aic-state-dot.on { background: #22c55e; box-shadow: 0 0 8px #22c55e; }
.aic-state-right { display: flex; gap: 12px; color: var(--aic-muted); }
.aic-state-mini b { color: var(--aic-txt); }

/* 操作 */
.aic-actions { display: flex; gap: 8px; margin-top: 14px; }
.aic-btn { flex: 1; text-align: center; padding: 10px 12px; border-radius: 12px; font-size: 13px; font-weight: 600; border: 1px solid var(--aic-border); background: var(--aic-card); color: var(--aic-txt); cursor: pointer; transition: all .2s; white-space: nowrap; }
.aic-btn:hover { transform: translateY(-1px); }
.aic-btn.primary { background: linear-gradient(120deg, #f97316, #a855f7); color: #fff; border-color: transparent; box-shadow: 0 6px 18px rgba(249,115,22,0.3); }
.aic-btn.ghost { background: transparent; }
.aic-btn.block { width: 100%; }
.aic-empty { grid-column: 1 / -1; text-align: center; padding: 60px; color: var(--aic-muted); }

/* ── Compare ── */
.aic-compare-sec { margin-top: 64px; padding: 36px; border-radius: 24px; background: var(--aic-glass); border: 1px solid var(--aic-border); backdrop-filter: blur(14px); }
.aic-sec-head h2 { margin: 0 0 6px; font-size: 24px; font-weight: 800; }
.aic-sec-sub { font-size: 13px; color: var(--aic-muted); font-weight: 400; }
.aic-sec-desc { margin: 0 0 22px; color: var(--aic-muted); font-size: 13px; }
.aic-compare { display: flex; gap: 10px; align-items: flex-end; }
.aic-compare-axis-y { writing-mode: vertical-rl; font-size: 11px; color: var(--aic-muted); padding: 4px 0; transform: rotate(180deg); }
.aic-compare-svg { width: 100%; max-width: 860px; border-radius: 16px; background: rgba(0,0,0,0.02); }
@media (prefers-color-scheme: dark) { .aic-compare-svg { background: rgba(255,255,255,0.02); } }
.aic-compare-svg .grid { stroke: var(--aic-border); stroke-width: 1; stroke-dasharray: 4 4; }
.aic-compare-svg .axis-label { fill: var(--aic-muted); font-size: 12px; }
.aic-compare-svg .bubble { stroke: rgba(255,255,255,0.7); stroke-width: 1; cursor: pointer; transition: opacity .2s; }
.aic-compare-svg .bubble.hot { stroke-width: 2; }
.aic-compare-svg .bubble-label { fill: var(--aic-txt); font-size: 12px; font-weight: 700; }
.aic-compare-axis-x { text-align: center; font-size: 11px; color: var(--aic-muted); padding-bottom: 4px; }
.aic-compare-legend { display: flex; gap: 18px; justify-content: center; margin-top: 16px; font-size: 12px; color: var(--aic-muted); }
.aic-legend-item { display: flex; align-items: center; gap: 6px; }
.aic-legend-dot { width: 10px; height: 10px; border-radius: 50%; }

/* ── 余额弹窗 ── */
.aic-modal-mask { position: fixed; inset: 0; background: rgba(0,0,0,0.5); backdrop-filter: blur(6px); display: flex; align-items: center; justify-content: center; z-index: 999; }
.aic-modal { width: 420px; max-width: calc(100vw - 40px); border-radius: 20px; padding: 24px; background: var(--aic-card); border: 1px solid var(--aic-border); backdrop-filter: blur(20px); animation: rise .25s ease both; }
.aic-modal-head { display: flex; gap: 12px; align-items: center; }
.aic-modal-title { font-weight: 700; font-size: 16px; }
.aic-modal-sub { font-size: 11px; color: var(--aic-muted); margin-top: 2px; }
.aic-modal-x { margin-left: auto; border: none; background: transparent; color: var(--aic-muted); font-size: 16px; cursor: pointer; }
.aic-modal-body { margin-top: 18px; display: flex; flex-direction: column; gap: 12px; }
.aic-field-label { font-size: 12px; color: var(--aic-muted); }
.aic-input { padding: 11px 14px; border-radius: 12px; border: 1px solid var(--aic-border); background: rgba(0,0,0,0.04); color: var(--aic-txt); font-size: 14px; outline: none; }
@media (prefers-color-scheme: dark) { .aic-input { background: rgba(255,255,255,0.06); } }
.aic-input:focus { border-color: #f97316; }
.aic-balance-err { color: #ef4444; font-size: 12px; }
.aic-balance-ok { text-align: center; padding: 14px; border-radius: 14px; background: rgba(34,197,94,0.1); border: 1px solid rgba(34,197,94,0.3); }
.aic-balance-big { font-size: 30px; font-weight: 800; color: #22c55e; }
.aic-balance-note { font-size: 11px; color: var(--aic-muted); margin-top: 2px; }

@keyframes rise { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
</style>
