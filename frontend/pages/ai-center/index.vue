<template>
  <div class="aic" :class="theme">
    <!-- ═══ 顶部：搜索 + 分类（紧凑，不占屏） ═══ -->
    <header class="aic-head">
      <div class="aic-head-inner">
        <div class="aic-brand">
          <NuxtLink to="/" class="aic-home-btn">← 返回首页</NuxtLink>
          <div class="aic-brand-icon">🧭</div>
          <div>
            <div class="aic-brand-title">AI 模型中心</div>
            <div class="aic-brand-sub">{{ stats.modelCount }}+ AI 模型 · 实时价格 | 能力 | 性价比</div>
          </div>
        </div>
        <div class="aic-search">
          <span class="aic-search-icon">🔍</span>
          <input v-model="q" placeholder="搜索模型 / 厂商，如 DeepSeek、GPT-5.6、Claude…" />
          <button v-if="q" class="aic-search-clear" @click="q = ''">✕</button>
        </div>
        <div class="aic-types">
          <button v-for="t in TYPE_TABS" :key="t.key" class="aic-type" :class="{ on: type === t.key }" @click="type = t.key">
            {{ t.label }}<span class="aic-type-count">{{ typeCount(t.key) }}</span>
          </button>
        </div>
      </div>
    </header>

    <!-- ═══ 第二屏：排行榜 ═══ -->
    <section class="aic-sec" id="boards">
      <div class="aic-sec-title">
        <h2>今日 AI 排名</h2>
        <span class="aic-sec-note">基于已验证价格与公开评测能力分 · 性价比 = 能力 60% + 价格 40%（统一人民币计价，USD×7.2 折算） · {{ verifiedLabel }}</span>
      </div>
      <div class="aic-boards">
        <!-- 综合性价比 -->
        <div class="aic-board">
          <div class="aic-board-head"><span class="aic-board-icon">🏆</span>综合性价比</div>
          <div class="aic-board-body">
            <div v-for="m in boards.value" :key="m.code" class="aic-rank" :class="{ top: m.rank <= 3 }">
              <span class="aic-rank-no" :class="{ gold: m.rank === 1, silver: m.rank === 2, bronze: m.rank === 3 }">{{ m.rank }}</span>
              <span class="aic-rank-name">{{ m.name }}</span>
              <span class="aic-rank-sub">{{ m.providerName }}</span>
              <div class="aic-rank-bar"><i :style="{ width: Math.min(100, m.valueScore) + '%' }"></i></div>
              <span class="aic-rank-score">{{ m.valueScore }}</span>
            </div>
          </div>
        </div>
        <!-- 最强能力（推理） -->
        <div class="aic-board">
          <div class="aic-board-head"><span class="aic-board-icon">🧠</span>最强能力 · 推理</div>
          <div class="aic-board-body">
            <div v-for="m in boards.reasoning" :key="m.code" class="aic-rank" :class="{ top: m.rank <= 3 }">
              <span class="aic-rank-no" :class="{ gold: m.rank === 1, silver: m.rank === 2, bronze: m.rank === 3 }">{{ m.rank }}</span>
              <span class="aic-rank-name">{{ m.name }}</span>
              <span class="aic-rank-sub">{{ m.providerName }}</span>
              <div class="aic-rank-bar"><i :style="{ width: m.reasoning + '%' }"></i></div>
              <span class="aic-rank-score">{{ m.reasoning }}</span>
            </div>
          </div>
        </div>
        <!-- 最低成本 -->
        <div class="aic-board">
          <div class="aic-board-head"><span class="aic-board-icon">💸</span>最低成本 · 输入价</div>
          <div class="aic-board-body">
            <div v-for="m in boards.cheapest" :key="m.code" class="aic-rank" :class="{ top: m.rank <= 3 }">
              <span class="aic-rank-no" :class="{ gold: m.rank === 1, silver: m.rank === 2, bronze: m.rank === 3 }">{{ m.rank }}</span>
              <span class="aic-rank-name">{{ m.name }}</span>
              <span class="aic-rank-sub">{{ m.providerName }}</span>
              <div class="aic-rank-bar cheap"><i :style="{ width: cheapWidth(m.inputPrice) + '%' }"></i></div>
              <span class="aic-rank-score">{{ fmtPrice(m.inputPrice, m.currency) }}</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ═══ 第三屏：模型比较（对比表） ═══ -->
    <section class="aic-sec" id="compare">
      <div class="aic-sec-title">
        <h2>模型对比</h2>
        <span class="aic-sec-note">同维度横评，支持增删对比模型</span>
      </div>
      <div class="aic-cmp">
        <div class="aic-cmp-add">
          <select v-model="pendingAdd" @change="addModel">
            <option value="" disabled>＋ 添加对比模型…</option>
            <option v-for="m in addCandidates" :key="m.code" :value="m.code">{{ m.providerName }} {{ m.name }}</option>
          </select>
        </div>
        <table class="aic-cmp-table">
          <thead>
            <tr>
              <th class="aic-cmp-dim">维度</th>
              <th v-for="m in compare" :key="m.code" class="aic-cmp-col">
                <div class="aic-cmp-head">
                  <div class="aic-cmp-name">{{ m.name }}</div>
                  <div class="aic-cmp-sub">{{ m.providerName }}</div>
                  <button class="aic-cmp-rm" title="移除" @click="removeModel(m.code)">✕</button>
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in compareRows" :key="row.key" :class="{ dimgroup: row.group }">
              <td class="aic-cmp-dim">{{ row.label }}<span v-if="row.unit" class="aic-cmp-unit">{{ row.unit }}</span></td>
              <td v-for="m in row.models" :key="m.code" class="aic-cmp-val">
                <template v-if="row.kind === 'score'">
                  <span class="aic-stars">{{ stars(m.value) }}</span><span class="aic-cmp-num">{{ m.value }}</span>
                </template>
                <template v-else-if="row.kind === 'price'">
                  <span class="aic-cmp-price">{{ fmtPrice(m.value, m.currency) }}</span>
                  <span v-if="m.value != null && row.best != null" class="aic-cmp-best" :class="{ win: m.value === row.best }">{{ m.value === row.best ? '最低' : '' }}</span>
                </template>
                <template v-else>
                  <span v-if="m.value != null">{{ fmtCtx(m.value) }}</span>
                  <span v-else class="aic-cmp-na">—</span>
                </template>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- ═══ 第四屏：模型市场（高密度卡片） ═══ -->
    <section class="aic-sec" id="market">
      <div class="aic-sec-title">
        <h2>模型市场</h2>
        <span class="aic-sec-note">信息密度优先 · 价格已验证才展示数字</span>
      </div>
      <div class="aic-market">
        <div v-for="m in filtered" :key="m.code" class="aic-mcard">
          <div class="aic-mcard-top">
            <span class="aic-mcard-brand" :style="{ background: brandBg(m.providerName) }">{{ brandChar(m.providerName) }}</span>
            <div class="aic-mcard-id">
              <NuxtLink :to="'/ai-center/model/' + m.code" class="aic-mcard-name">{{ m.name }}</NuxtLink>
              <div class="aic-mcard-sub">{{ m.providerName }} · {{ typeLabel(m.modelTypes) }}</div>
            </div>
            <span v-if="m.dataStatus === 'pending'" class="aic-badge pending">待验证</span>
            <span v-else class="aic-badge ok">已验证</span>
          </div>
          <div class="aic-mcard-meta">
            <span v-if="m.contextWindow" class="aic-chip">🪟 {{ fmtCtx(m.contextWindow) }}</span>
            <span v-if="m.maxOutput" class="aic-chip">↗ {{ fmtCtx(m.maxOutput) }} 输出</span>
            <span v-if="m.currency === 'CNY'" class="aic-chip">🇨🇳 人民币计价</span>
            <span v-else class="aic-chip">💱 人民币折算</span>
          </div>
          <div class="aic-mcard-caps">
            <div v-for="d in capDims(m)" :key="d.k" class="aic-cap">
              <span class="aic-cap-label">{{ d.label }}</span>
              <div class="aic-cap-bar"><i :style="{ width: d.v + '%' }"></i></div>
              <span class="aic-cap-val">{{ d.v }}</span>
            </div>
          </div>
          <div class="aic-mcard-price">
            <template v-if="m.inputPrice != null">
              <div class="aic-mcard-p">
                <span class="aic-mcard-pl">输入</span><b>{{ fmtPrice(m.inputPrice, m.currency) }}</b>
                <span v-if="m.inputCacheHit != null" class="aic-mcard-cache">缓存 {{ fmtPrice(m.inputCacheHit, m.currency) }}</span>
              </div>
              <div class="aic-mcard-p"><span class="aic-mcard-pl">输出</span><b>{{ fmtPrice(m.outputPrice, m.currency) }}</b></div>
            </template>
            <div v-else class="aic-mcard-na">价格待验证（订阅制/按量）</div>
          </div>
          <div class="aic-mcard-verify">📚 {{ m.verificationSource || (m.dataStatus === 'verified' ? '官方公开价格' : '价格待验证') }}<template v-if="m.lastVerifiedAt"> · {{ fmtYm(m.lastVerifiedAt) }}</template></div>
          <div v-if="m.effectiveStatus === 'expired'" class="aic-mcard-expired">⚠️ 价格可能过期（{{ m.daysSinceVerified }} 天未验证），请以官方最新价格为准</div>
          <div class="aic-mcard-foot">
            <span class="aic-mcard-value">性价比 <b>{{ valueScoreOf(m) ?? '—' }}</b></span>
            <NuxtLink :to="'/ai-center/model/' + m.code" class="aic-mcard-detail">详情 →</NuxtLink>
          </div>
        </div>
        <div v-if="!filtered.length" class="aic-empty">没有匹配的模型</div>
      </div>
    </section>

    <!-- ═══ 第五屏：价格趋势 ═══ -->
    <section class="aic-sec" id="trend">
      <div class="aic-sec-title">
        <h2>价格趋势</h2>
        <span class="aic-sec-note">当前输入价横向对比（对数轴）· 每次官方验证自动留痕</span>
      </div>
      <div class="aic-trend">
        <div class="aic-trend-chart">
          <div v-for="m in priceSorted" :key="m.code" class="aic-trend-row">
            <span class="aic-trend-name" :title="m.name">{{ m.name }}</span>
            <div class="aic-trend-track">
              <i class="aic-trend-bar" :style="{ width: logWidth(m.inputPrice) + '%', background: brandBg(m.providerName) }"></i>
            </div>
            <span class="aic-trend-price">{{ fmtPrice(m.inputPrice, m.currency) }}</span>
          </div>
        </div>
        <div class="aic-trend-side">
          <div class="aic-trend-side-title">📋 官方价格验证记录</div>
          <div v-for="h in history" :key="h.id" class="aic-hist">
            <div class="aic-hist-row">
              <span class="aic-hist-name">{{ h.modelName }}</span>
              <span class="aic-hist-price">{{ fmtPrice(h.inputPrice, h.currency) }} / {{ fmtPrice(h.outputPrice, h.currency) }}</span>
            </div>
            <div class="aic-hist-meta">✅ {{ h.verifiedBy }} · {{ fmtDate(h.verifiedAt) }}</div>
            <div class="aic-hist-src" :title="h.dataSource">{{ h.dataSource }}</div>
          </div>
        </div>
      </div>
    </section>

    <footer class="aic-foot">
      <div class="aic-foot-note">⚠️ 价格与能力分均来自官方公开信息（厂商定价页 / OpenRouter 官方聚合），由昆仑镜运营团队定期验证留痕，价格以厂商实时页面为准。</div>
      <div class="aic-foot-note">BYOK：本中心不保存任何用户 API Key，余额查询为一次性实时查询，展示后立即释放。</div>
    </footer>
  </div>
</template>

<script setup lang="ts">
// AI-CENTER-06：全球 AI 模型数据库 · 首页 V2
// 布局（掌柜冻结）：搜索+分类 → 排行榜 → 模型比较 → 模型市场 → 价格趋势
useHead({ title: 'AI模型中心 · 全球AI模型价格、能力、性价比对比' })

const q = ref('')
const type = ref('all')
const models = ref<any[]>([])
const boards = ref<{ value: any[]; reasoning: any[]; cheapest: any[] }>({ value: [], reasoning: [], cheapest: [] })
const compare = ref<any[]>([])
const history = ref<any[]>([])
const stats = ref({ modelCount: 0, providerCount: 0, verifiedCount: 0 })
const pendingAdd = ref('')

const TYPE_TABS = [
  { key: 'all', label: '全部' },
  { key: 'language', label: '💬 语言' },
  { key: 'image', label: '🎨 图片' },
  { key: 'video', label: '🎬 视频' },
  { key: 'audio', label: '🎙️ 语音' },
  { key: 'multimodal', label: '🌐 多模态' },
  { key: 'agent', label: '🤖 Agent' },
]
const CAP_DIMS = [
  { k: 'quality', label: '质量' }, { k: 'speed', label: '速度' }, { k: 'cost', label: '价格优势' },
  { k: 'chinese', label: '中文' }, { k: 'coding', label: '代码' }, { k: 'reasoning', label: '推理' },
]

const theme = ref('dark')
onMounted(() => {
  const dark = window.matchMedia('(prefers-color-scheme: dark)').matches
  theme.value = dark ? 'dark' : 'light'
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => { theme.value = e.matches ? 'dark' : 'light' })
  load()
})

const verifiedLabel = computed(() => {
  const d = models.value.filter((m) => m.dataStatus === 'verified').length
  return `${d}/${models.value.length} 个模型价格已验证`
})

async function load() {
  const [m, b, c, h, s] = await Promise.all([
    fetch('/api/ai-provider-directory/models').then((r) => r.json()),
    fetch('/api/ai-provider-directory/leaderboards').then((r) => r.json()),
    fetch('/api/ai-provider-directory/compare').then((r) => r.json()),
    fetch('/api/ai-provider-directory/price-history').then((r) => r.json()),
    fetch('/api/ai-provider-directory/model-stats').then((r) => r.json()),
  ])
  models.value = m.data || []
  boards.value = b.data || { value: [], reasoning: [], cheapest: [] }
  compare.value = (c.data || []).slice(0, 4)
  history.value = (h.data || []).slice(0, 8)
  stats.value = s.data || stats.value
}

const filtered = computed(() => {
  let list = models.value
  if (type.value !== 'all') list = list.filter((m) => (m.modelTypes || []).includes(type.value))
  if (q.value.trim()) {
    const kw = q.value.trim().toLowerCase()
    list = list.filter((m) =>
      m.name.toLowerCase().includes(kw) || m.code.toLowerCase().includes(kw) ||
      (m.providerName || '').toLowerCase().includes(kw) || (m.description || '').toLowerCase().includes(kw)
    )
  }
  return list
})

function typeCount(key: string) {
  if (key === 'all') return models.value.length
  return models.value.filter((m) => (m.modelTypes || []).includes(key)).length
}

// ── 掌柜公式（修正版）：性价比 = 能力评分×60% + 价格评分×40%，币种归一 USD（CNY/7.2），对数归一 ──
const USD_RATE = 7.2
function toUSD(v: number, cur?: string) { return (cur || 'USD') === 'CNY' ? v / USD_RATE : v }
function abilityOf(m: any): number | null {
  const c = m.capabilityScore || {}
  const dims = ['quality', 'speed', 'chinese', 'coding', 'reasoning'].filter((k) => typeof c[k] === 'number')
  if (!dims.length) return null
  return dims.reduce((s, k) => s + c[k], 0) / dims.length
}
const priceScoreMap = computed(() => {
  const map = new Map<string, number>()
  const list = models.value.filter((m) => m.inputPrice != null && m.outputPrice != null)
  const costs = list.map((m) => toUSD(m.inputPrice, m.currency) + toUSD(m.outputPrice, m.currency))
  if (!costs.length) return map
  const min = Math.min(...costs), max = Math.max(...costs)
  for (const m of list) {
    const cost = toUSD(m.inputPrice, m.currency) + toUSD(m.outputPrice, m.currency)
    const ps = max === min ? 100 : 100 * (1 - (Math.log10(cost) - Math.log10(min)) / (Math.log10(max) - Math.log10(min)))
    map.set(m.code, Math.round(Math.max(0, Math.min(100, ps))))
  }
  return map
})
function valueScoreOf(m: any): number | null {
  const ability = abilityOf(m)
  const ps = priceScoreMap.value.get(m.code)
  if (ability == null || ps == null) return null
  return Math.round(ability * 0.6 + ps * 0.4)
}
function fmtYm(d: string): string {
  if (!d) return ''
  const dt = new Date(d)
  if (isNaN(dt.getTime())) return d.slice(0, 7)
  return dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0')
}

const addCandidates = computed(() => {
  const inCmp = new Set(compare.value.map((m) => m.code))
  return models.value.filter((m) => !inCmp.has(m.code) && m.dataStatus === 'verified' && (m.modelTypes || []).includes('language'))
})
function addModel() {
  if (!pendingAdd.value) return
  const m = models.value.find((x) => x.code === pendingAdd.value)
  if (m && compare.value.length < 5) compare.value.push(m)
  pendingAdd.value = ''
}
function removeModel(code: string) {
  compare.value = compare.value.filter((m) => m.code !== code)
  if (compare.value.length < 3) {
    const c = addCandidates.value[0]
    if (c) compare.value.push(c)
  }
}

const compareRows = computed(() => {
  const rows: any[] = []
  const num = (v: any) => (typeof v === 'number' ? v : null)
  const priceBest = (key: string) => {
    const vals = compare.value.map((m) => num(m[key])).filter((v) => v != null) as number[]
    return vals.length ? Math.min(...vals) : null
  }
  const scoreRow = (key: string, label: string) => ({
    key, label, kind: 'score', models: compare.value.map((m) => ({ code: m.code, value: num((m.capabilityScore || {})[key]), currency: m.currency })),
  })
  const priceRow = (key: string, label: string) => {
    const best = priceBest(key)
    return { key, label, unit: '¥/1M tokens', kind: 'price', best, models: compare.value.map((m) => ({ code: m.code, value: num(m[key]), currency: m.currency })) }
  }
  rows.push({ key: 'g1', label: '价格', group: true })
  rows.push(priceRow('inputPrice', '输入'))
  rows.push(priceRow('outputPrice', '输出'))
  rows.push({ key: 'g2', label: '能力', group: true })
  for (const d of CAP_DIMS) rows.push(scoreRow(d.k, d.label))
  rows.push({ key: 'ctx', label: '上下文', kind: 'ctx', models: compare.value.map((m) => ({ code: m.code, value: num(m.contextWindow) })) })
  rows.push({ key: 'value', label: '性价比（能力60%+价格40%）', kind: 'score', models: compare.value.map((m) => ({ code: m.code, value: valueScoreOf(m), currency: m.currency })) })
  return rows
})

const priceSorted = computed(() =>
  models.value.filter((m) => m.inputPrice != null).sort((a: any, b: any) => a.inputPrice - b.inputPrice).slice(0, 12)
)
const logWidth = (v: number) => {
  // 对数轴：0.01 → 1% , 100 → 100%
  const w = (Math.log10(v + 0.01) + 2) / 4 * 100
  return Math.max(2, Math.min(100, Math.round(w)))
}
const cheapWidth = (v: number) => {
  const pct = (0.5 / (v + 0.5)) * 100
  return Math.max(4, Math.min(100, Math.round(pct)))
}
function stars(v: number | null): string {
  if (v == null) return '—'
  const n = Math.round(v / 20)
  return '★'.repeat(Math.max(1, n)) + '☆'.repeat(5 - Math.max(1, n))
}
function capDims(m: any) {
  const cap = m.capabilityScore || {}
  const dims = (m.modelTypes || []).some((t: string) => ['image', 'video', 'audio'].includes(t))
    ? CAP_DIMS.filter((d) => !['coding', 'reasoning'].includes(d.k))
    : CAP_DIMS
  return dims.map((d) => ({ ...d, v: Number(cap[d.k]) || 0 })).filter((d) => d.v > 0)
}
function typeLabel(types: string[]) {
  const map: Record<string, string> = { language: '语言', image: '图片', video: '视频', audio: '语音', multimodal: '多模态', agent: 'Agent' }
  return (types || []).map((t) => map[t] || t).join(' · ') || '模型'
}
function fmtPrice(v: number | null | undefined, cur?: string): string {
  if (v == null) return '—'
  // 掌柜指令：计价单位统一人民币（数据权威保留 USD，展示层按 7.2 折算）
  const c = cur || 'USD'
  const cny = c === 'CNY' ? v : v * USD_RATE
  // 人民币习惯：统一 2 位小数，去尾零（¥36.00 → ¥36，¥0.22 保持）
  const out = cny.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
  return '¥' + out
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
const BRAND_COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#6366f1', '#14b8a6', '#a855f7']
function brandChar(name: string): string { return (name || '?').charAt(0).toUpperCase() }
function brandBg(name: string): string {
  let h = 0
  for (const ch of name || '') h = (h * 31 + ch.charCodeAt(0)) % 997
  return BRAND_COLORS[h % BRAND_COLORS.length]
}
</script>

<style scoped>
.aic { min-height: 100vh; background: #070b14; color: #e5e9f2; transition: background .3s, color .3s; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif; }
.aic.light { background: #f7f8fb; color: #1a2233; }

/* ── 顶部 ── */
.aic-head { position: sticky; top: 0; z-index: 50; background: rgba(7, 11, 20, .86); backdrop-filter: blur(14px); border-bottom: 1px solid rgba(255,255,255,.06); }
.light .aic-head { background: rgba(247,248,251,.9); border-bottom-color: rgba(0,0,0,.08); }
.aic-head-inner { max-width: 1280px; margin: 0 auto; padding: 14px 20px; display: flex; align-items: center; gap: 18px; flex-wrap: wrap; }
.aic-brand { display: flex; align-items: center; gap: 10px; }
.aic-brand { display: flex; align-items: center; gap: 10px; }
.aic-home-btn { flex-shrink: 0; font-size: 12px; color: #93a2c0; border: 1px solid rgba(255,255,255,.14); border-radius: 8px; padding: 6px 10px; text-decoration: none; transition: all .2s; }
.aic-home-btn:hover { color: #fff; border-color: #3b82f6; background: rgba(59,130,246,.15); }
.light .aic-home-btn { color: #5a6478; border-color: #d3d9e4; }
.light .aic-home-btn:hover { color: #1d4ed8; border-color: #3b82f6; background: rgba(59,130,246,.08); }
.aic-brand-icon { font-size: 24px; }
.aic-brand-title { font-size: 17px; font-weight: 700; letter-spacing: .5px; }
.aic-brand-sub { font-size: 11px; color: #7a86a3; margin-top: 1px; }
.light .aic-brand-sub { color: #6b7690; }
.aic-search { flex: 1; min-width: 220px; position: relative; }
.aic-search input { width: 100%; background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.1); border-radius: 10px; padding: 9px 34px 9px 34px; font-size: 13px; color: inherit; outline: none; transition: border .2s; }
.aic-search input:focus { border-color: #3b82f6; }
.light .aic-search input { background: #fff; border-color: #dde2ec; }
.aic-search-icon { position: absolute; left: 11px; top: 50%; transform: translateY(-50%); font-size: 13px; opacity: .6; }
.aic-search-clear { position: absolute; right: 9px; top: 50%; transform: translateY(-50%); background: none; border: none; color: #7a86a3; cursor: pointer; font-size: 12px; }
.aic-types { display: flex; gap: 6px; flex-wrap: wrap; }
.aic-type { background: none; border: 1px solid rgba(255,255,255,.1); color: #a7b0c5; border-radius: 999px; padding: 6px 13px; font-size: 12px; cursor: pointer; transition: all .2s; }
.aic-type:hover { color: #fff; border-color: rgba(255,255,255,.25); }
.aic-type.on { background: #3b82f6; border-color: #3b82f6; color: #fff; font-weight: 600; }
.light .aic-type { border-color: #dde2ec; color: #5a6478; }
.light .aic-type.on { background: #3b82f6; color: #fff; }
.aic-type-count { font-size: 10px; opacity: .65; margin-left: 4px; }

/* ── 区块 ── */
.aic-sec { max-width: 1280px; margin: 0 auto; padding: 26px 20px 6px; }
.aic-sec-title { display: flex; align-items: baseline; gap: 12px; margin-bottom: 14px; }
.aic-sec-title h2 { font-size: 19px; font-weight: 700; margin: 0; }
.aic-sec-note { font-size: 11.5px; color: #7a86a3; }
.light .aic-sec-note { color: #6b7690; }

/* ── 排行榜 ── */
.aic-boards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
@media (max-width: 900px) { .aic-boards { grid-template-columns: 1fr; } }
.aic-board { border: 1px solid rgba(255,255,255,.07); border-radius: 14px; background: rgba(255,255,255,.025); overflow: hidden; }
.light .aic-board { border-color: #e3e7f0; background: #fff; box-shadow: 0 1px 3px rgba(16,24,40,.05); }
.aic-board-head { padding: 11px 14px; font-size: 13px; font-weight: 700; border-bottom: 1px solid rgba(255,255,255,.06); display: flex; align-items: center; gap: 7px; }
.light .aic-board-head { border-bottom-color: #eef1f6; }
.aic-board-body { padding: 6px 10px 10px; }
.aic-rank { display: grid; grid-template-columns: 22px 1fr auto; grid-template-areas: 'no name score' 'no sub score' 'bar bar bar'; align-items: center; gap: 2px 8px; padding: 6px 4px; border-radius: 8px; }
.aic-rank.top { background: rgba(59,130,246,.06); }
.aic-rank-no { grid-area: no; font-size: 13px; font-weight: 800; color: #5a6478; text-align: center; }
.aic-rank-no.gold { color: #f59e0b; } .aic-rank-no.silver { color: #94a3b8; } .aic-rank-no.bronze { color: #d97706; }
.aic-rank-name { grid-area: name; font-size: 12.5px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.aic-rank-sub { grid-area: sub; font-size: 10.5px; color: #7a86a3; }
.aic-rank-score { grid-area: score; font-size: 12.5px; font-weight: 700; color: #3b82f6; }
.aic-rank-bar { grid-area: bar; height: 3px; background: rgba(255,255,255,.07); border-radius: 2px; margin-top: 3px; overflow: hidden; }
.light .aic-rank-bar { background: #eef1f6; }
.aic-rank-bar i { display: block; height: 100%; background: linear-gradient(90deg, #3b82f6, #06b6d4); border-radius: 2px; }
.aic-rank-bar.cheap i { background: linear-gradient(90deg, #10b981, #84cc16); }

/* ── 对比表 ── */
.aic-cmp { border: 1px solid rgba(255,255,255,.07); border-radius: 14px; background: rgba(255,255,255,.025); overflow: hidden; }
.light .aic-cmp { border-color: #e3e7f0; background: #fff; }
.aic-cmp-add { padding: 10px 12px; border-bottom: 1px solid rgba(255,255,255,.06); }
.light .aic-cmp-add { border-bottom-color: #eef1f6; }
.aic-cmp-add select { background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.12); color: inherit; border-radius: 8px; padding: 6px 10px; font-size: 12px; outline: none; }
.light .aic-cmp-add select { background: #fff; border-color: #dde2ec; }
.aic-cmp-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
.aic-cmp-table th, .aic-cmp-table td { padding: 8px 10px; font-size: 12.5px; text-align: center; }
.aic-cmp-table thead th { background: rgba(59,130,246,.05); border-bottom: 1px solid rgba(255,255,255,.06); }
.light .aic-cmp-table thead th { border-bottom-color: #eef1f6; }
.aic-cmp-table tbody tr { border-bottom: 1px solid rgba(255,255,255,.04); }
.light .aic-cmp-table tbody tr { border-bottom-color: #f2f4f9; }
.aic-cmp-dim { text-align: left !important; font-weight: 600; color: #8b94ab; width: 130px; font-size: 12px; }
.aic-cmp-table tr.dimgroup td { background: rgba(255,255,255,.02); color: #5a6478; font-size: 11px; font-weight: 700; letter-spacing: 1px; text-align: left; padding: 6px 10px; }
.light .aic-cmp-table tr.dimgroup td { background: #f8f9fc; }
.aic-cmp-head { position: relative; }
.aic-cmp-name { font-size: 12.5px; font-weight: 700; }
.aic-cmp-sub { font-size: 10.5px; color: #7a86a3; margin-top: 1px; }
.aic-cmp-rm { position: absolute; top: -6px; right: -6px; background: rgba(239,68,68,.12); border: none; color: #ef4444; border-radius: 50%; width: 18px; height: 18px; font-size: 10px; cursor: pointer; line-height: 1; }
.aic-cmp-val { font-size: 12.5px; }
.aic-stars { color: #f59e0b; font-size: 10.5px; letter-spacing: 0; margin-right: 5px; }
.aic-cmp-num { color: #8b94ab; font-size: 11px; }
.aic-cmp-price { font-weight: 700; }
.aic-cmp-best { font-size: 10px; color: #10b981; margin-left: 5px; }
.aic-cmp-unit { display: block; font-size: 10px; color: #5a6478; font-weight: 400; }
.aic-cmp-na { color: #5a6478; }

/* ── 模型市场 ── */
.aic-market { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 12px; }
.aic-mcard { border: 1px solid rgba(255,255,255,.07); border-radius: 12px; background: rgba(255,255,255,.025); padding: 13px; display: flex; flex-direction: column; gap: 9px; transition: border-color .2s, transform .15s; }
.aic-mcard:hover { border-color: rgba(59,130,246,.45); transform: translateY(-1px); }
.light .aic-mcard { border-color: #e3e7f0; background: #fff; box-shadow: 0 1px 3px rgba(16,24,40,.04); }
.aic-mcard-top { display: flex; align-items: center; gap: 9px; }
.aic-mcard-brand { width: 34px; height: 34px; border-radius: 9px; display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 800; font-size: 15px; flex-shrink: 0; }
.aic-mcard-id { flex: 1; min-width: 0; }
.aic-mcard-name { font-size: 13.5px; font-weight: 700; text-decoration: none; color: inherit; }
.aic-mcard-name:hover { color: #3b82f6; }
.aic-mcard-sub { font-size: 11px; color: #7a86a3; margin-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.aic-badge { font-size: 10px; border-radius: 999px; padding: 2px 8px; font-weight: 600; flex-shrink: 0; }
.aic-badge.ok { background: rgba(16,185,129,.12); color: #10b981; }
.aic-badge.pending { background: rgba(245,158,11,.12); color: #f59e0b; }
.aic-mcard-meta { display: flex; gap: 6px; flex-wrap: wrap; }
.aic-chip { font-size: 10.5px; background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.08); border-radius: 6px; padding: 2px 7px; color: #a7b0c5; }
.light .aic-chip { background: #f4f6fa; border-color: #e6eaf2; color: #5a6478; }
.aic-mcard-caps { display: flex; flex-direction: column; gap: 4px; }
.aic-cap { display: grid; grid-template-columns: 52px 1fr 22px; align-items: center; gap: 7px; }
.aic-cap-label { font-size: 10.5px; color: #8b94ab; }
.aic-cap-bar { height: 4px; background: rgba(255,255,255,.07); border-radius: 2px; overflow: hidden; }
.light .aic-cap-bar { background: #eef1f6; }
.aic-cap-bar i { display: block; height: 100%; background: linear-gradient(90deg, #3b82f6, #8b5cf6); border-radius: 2px; }
.aic-cap-val { font-size: 10.5px; color: #a7b0c5; text-align: right; }
.aic-mcard-price { border-top: 1px dashed rgba(255,255,255,.09); padding-top: 8px; display: flex; flex-direction: column; gap: 4px; }
.light .aic-mcard-price { border-top-color: #e8ebf3; }
.aic-mcard-p { display: flex; align-items: center; gap: 7px; font-size: 12px; }
.aic-mcard-pl { font-size: 10.5px; color: #7a86a3; width: 26px; }
.aic-mcard-p b { font-size: 13px; }
.aic-mcard-cache { font-size: 10px; color: #10b981; }
.aic-mcard-na { font-size: 11.5px; color: #f59e0b; padding: 4px 0; }
.aic-mcard-expired { margin-top: 6px; font-size: 10.5px; color: #f97316; background: rgba(249,115,22,.08); border: 1px solid rgba(249,115,22,.25); border-radius: 6px; padding: 4px 8px; }
.aic-mcard-foot { display: flex; justify-content: space-between; align-items: center; border-top: 1px solid rgba(255,255,255,.06); padding-top: 8px; }
.light .aic-mcard-foot { border-top-color: #eef1f6; }
.aic-mcard-value { font-size: 11px; color: #7a86a3; }
.aic-mcard-value b { color: #3b82f6; font-size: 14px; }
.aic-mcard-detail { font-size: 12px; color: #3b82f6; text-decoration: none; font-weight: 600; }
.aic-empty { grid-column: 1 / -1; text-align: center; color: #7a86a3; padding: 40px 0; font-size: 13px; }

/* ── 价格趋势 ── */
.aic-trend { display: grid; grid-template-columns: 1.4fr 1fr; gap: 14px; }
@media (max-width: 900px) { .aic-trend { grid-template-columns: 1fr; } }
.aic-trend-chart, .aic-trend-side { border: 1px solid rgba(255,255,255,.07); border-radius: 14px; background: rgba(255,255,255,.025); padding: 14px; }
.light .aic-trend-chart, .light .aic-trend-side { border-color: #e3e7f0; background: #fff; }
.aic-trend-row { display: grid; grid-template-columns: 130px 1fr 70px; align-items: center; gap: 10px; padding: 4px 0; }
.aic-trend-name { font-size: 11.5px; color: #a7b0c5; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.aic-trend-track { height: 14px; background: rgba(255,255,255,.05); border-radius: 4px; overflow: hidden; }
.light .aic-trend-track { background: #eef1f6; }
.aic-trend-bar { display: block; height: 100%; border-radius: 4px; opacity: .85; transition: width .4s; }
.aic-trend-price { font-size: 11.5px; font-weight: 700; text-align: right; }
.aic-trend-side-title { font-size: 12.5px; font-weight: 700; margin-bottom: 10px; }
.aic-hist { padding: 7px 0; border-bottom: 1px solid rgba(255,255,255,.05); }
.light .aic-hist { border-bottom-color: #eef1f6; }
.aic-hist-row { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.aic-hist-name { font-size: 12px; font-weight: 600; }
.aic-hist-price { font-size: 11.5px; color: #3b82f6; font-weight: 600; white-space: nowrap; }
.aic-hist-meta { font-size: 10.5px; color: #7a86a3; margin-top: 2px; }
.aic-hist-src { font-size: 10px; color: #5a6478; margin-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

/* ── 页脚 ── */
.aic-foot { max-width: 1280px; margin: 30px auto 0; padding: 16px 20px 34px; border-top: 1px solid rgba(255,255,255,.06); }
.light .aic-foot { border-top-color: #e6eaf2; }
.aic-foot-note { font-size: 11px; color: #5a6478; line-height: 1.7; }
</style>
