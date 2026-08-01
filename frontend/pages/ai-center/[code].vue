<template>
  <div class="aicd">
    <div v-if="!p && !loading" class="aicd-missing">
      <p>😕 未找到该模型</p>
      <nuxt-link to="/ai-center" class="aicd-back">← 返回 AI中心</nuxt-link>
    </div>

    <template v-else-if="p">
      <div class="aicd-backbar">
        <nuxt-link to="/ai-center" class="aicd-back">← AI中心</nuxt-link>
        <span class="aicd-crumb">{{ p.name }} / {{ p.modelName || p.name }}</span>
      </div>

      <!-- 头部 -->
      <div class="aicd-head" :class="{ connected: p.connected }">
        <div class="aicd-logo" :style="logoStyle">{{ brandInitial(p.name) }}</div>
        <div class="aicd-title">
          <h1>{{ p.modelName ? p.name + ' ' + p.modelName : p.name }}
            <span v-if="p.recommendTag" class="aicd-tag">{{ p.recommendTag }}</span>
          </h1>
          <div class="aicd-meta">{{ p.country }} · {{ typeLabel(p.modelTypes) }}
            <span v-if="p.contextLength" class="aicd-ctx">上下文 {{ ctxText(p.contextLength) }}</span>
          </div>
          <p class="aicd-desc">{{ p.description }}</p>
        </div>
        <div class="aicd-score">
          <div class="aicd-score-val">{{ p.valueScore ?? '—' }}</div>
          <div class="aicd-score-stars">{{ stars(p.valueScore) }}</div>
          <div class="aicd-score-label">综合性价比<br><small>能力×60% + 价格×40%</small></div>
        </div>
      </div>

      <div class="aicd-grid">
        <!-- 能力雷达图 -->
        <div class="aicd-panel">
          <h3>能力雷达图</h3>
          <svg :viewBox="`0 0 260 240`" class="aicd-radar">
            <polygon v-for="lv in [1, 2, 3, 4]" :key="lv" :points="polyPoints(lv * 25)" class="radar-ring" />
            <polygon :points="polyPoints(0)" class="radar-web" />
            <line v-for="(d, i) in radarDims" :key="d" :x1="130" :y1="118" :x2="radarCoord(i, 100).x" :y2="radarCoord(i, 100).y" class="radar-line" />
            <text v-for="(d, i) in radarDims" :key="d" :x="radarCoord(i, 118).x" :y="radarCoord(i, 118).y" class="radar-label" text-anchor="middle">{{ d }}</text>
          </svg>
          <div class="aicd-radar-note">六维能力评分（0-100，运营维护）</div>
        </div>

        <!-- 价格与来源 -->
        <div class="aicd-panel">
          <h3>价格</h3>
          <div class="aicd-price-row">
            <div class="aicd-price-box">
              <div class="aicd-price-k">输入</div>
              <div class="aicd-price-v">{{ priceText(p, 'input') }}</div>
            </div>
            <div class="aicd-price-box">
              <div class="aicd-price-k">输出</div>
              <div class="aicd-price-v">{{ priceText(p, 'output') }}</div>
            </div>
          </div>
          <div class="aicd-src">
            <div class="aicd-src-line">价格更新时间：<b>{{ priceUpdatedAt }}</b></div>
            <div class="aicd-src-line">来源：<b>{{ p.priceSource || '官方公开价格' }}</b></div>
            <div class="aicd-src-line muted">参考价，以官方实时计费为准</div>
          </div>
          <h3 class="aicd-h3-2">支持模型</h3>
          <div class="aicd-models">
            <span v-for="m in p.supportedModels" :key="m" class="aicd-model-chip">{{ m }}</span>
          </div>
        </div>

        <!-- 适合场景 -->
        <div class="aicd-panel">
          <h3>适合场景</h3>
          <ul class="aicd-scenes">
            <li v-for="s in scenes" :key="s">{{ s }}</li>
          </ul>
          <h3 class="aicd-h3-2">我的状态</h3>
          <div class="aicd-state">
            <span class="aicd-state-dot" :class="{ on: p.connected }"></span>
            {{ p.connected ? '🟢 已连接' : '未连接' }}
          </div>
          <div class="aicd-state-note" v-if="p.connected">
            你已在该厂商配置 API Key（BYOK）。余额请点击下方「查询余额」实时获取。
          </div>
          <div class="aicd-state-note" v-else>
            配置 Key 后此处显示「已连接」；Key 仅存于你的模型配置（BYOK），平台不托管。
          </div>
        </div>
      </div>

      <!-- 操作 -->
      <div class="aicd-actions">
        <a class="aicd-btn primary" :href="p.registerUrl" target="_blank" rel="noopener">注册API账号</a>
        <a v-if="p.billingUrl" class="aicd-btn" :href="p.billingUrl" target="_blank" rel="noopener">充值</a>
        <button v-if="p.officialBalanceApi" class="aicd-btn ghost" @click="openBalance">查询余额</button>
        <a v-if="p.documentationUrl" class="aicd-btn ghost" :href="p.documentationUrl" target="_blank" rel="noopener">官方文档</a>
      </div>
    </template>

    <!-- 余额弹窗（BYOK 实时查询即释放） -->
    <Teleport to="body">
      <div v-if="balance.open" class="aicd-mask" @click.self="balance.open = false">
        <div class="aicd-modal">
          <div class="aicd-modal-head">
            <b>{{ p?.name }} · 余额查询</b>
            <button class="aicd-modal-x" @click="balance.open = false">✕</button>
          </div>
          <p class="aicd-modal-sub">BYOK：Key 实时请求官方接口，展示后立即释放，绝不落库。</p>
          <input v-model="balance.apiKey" class="aicd-input" type="password" placeholder="sk-…" @keyup.enter="queryBalance" />
          <div v-if="balance.error" class="aicd-err">{{ balance.error }}</div>
          <div v-if="balance.result" class="aicd-ok">
            <div class="aicd-ok-big">¥{{ balance.result.balance ?? '—' }}</div>
            <div class="aicd-ok-note">{{ balance.result.note || '官方实时余额' }}</div>
          </div>
          <button class="aicd-btn primary block" :disabled="balance.loading" @click="queryBalance">
            {{ balance.loading ? '查询中…' : '查询余额' }}
          </button>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'

const route = useRoute()
const code = String(route.params.code || '')
const p = ref<any>(null)
const loading = ref(true)

const BRAND_COLORS: Record<string, [string, string]> = {
  deepseek: ['#4d6bfe', '#8ab4ff'], openai: ['#10a37f', '#74f2ce'], zhipu: ['#3859ff', '#93aaff'],
  moonshot: ['#0d0d0d', '#888888'], volcengine: ['#0a7cff', '#8fd0ff'], aliyun: ['#ff6a00', '#ffc38a'],
  baidu: ['#2932e1', '#8a90ff'], tencent: ['#0eaeff', '#8fe0ff'], iflytek: ['#0055ff', '#8ab4ff'],
  google: ['#4285f4', '#a3c6ff'], anthropic: ['#d97757', '#ffb89a'], meta: ['#0668e1', '#8ab4ff'],
  jimeng: ['#8a2be2', '#cba3ff'], midjourney: ['#0b0b0b', '#999999'], dalle: ['#10a37f', '#74f2ce'],
  wanxiang: ['#ff6a00', '#ffc38a'], kling: ['#00d4ff', '#a3ecff'], runway: ['#111111', '#777777'],
  pika: ['#e94e8f', '#ffa3c8'], luma: ['#7c3aed', '#c4a5ff'], elevenlabs: ['#1a1a1a', '#888888'],
}
const logoStyle = computed(() => {
  const [a, b] = BRAND_COLORS[p.value?.code] || ['#555', '#888']
  return { background: `linear-gradient(135deg, ${a}, ${b})` }
})
const brandInitial = (n: string) => (n || '?').trim().charAt(0).toUpperCase()

const TYPE_LABEL: Record<string, string> = { language: '语言模型', image: '图片模型', video: '视频模型', audio: '语音模型', multimodal: '多模态模型', agent: 'Agent模型' }
const typeLabel = (ts: string[]) => (ts || []).map((t) => TYPE_LABEL[t] || t).join(' / ')
const ctxText = (n: number) => n >= 1000000 ? (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M' : n >= 1000 ? Math.round(n / 1000) + 'K' : String(n)
const stars = (v: number | null | undefined) => {
  if (v == null) return '☆☆☆☆☆'
  const n = Math.max(1, Math.min(5, Math.round(v / 20)))
  return '★'.repeat(n) + '☆'.repeat(5 - n)
}
const priceText = (pp: any, kind: 'input' | 'output') => {
  const v = kind === 'input' ? pp.pricingInfo?.inputPrice : pp.pricingInfo?.outputPrice
  return v == null ? '按用量计费' : `¥${v} / 百万tokens`
}
const priceUpdatedAt = computed(() => {
  if (!p.value?.pricingUpdatedAt) return '—'
  const d = new Date(p.value.pricingUpdatedAt)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
})

/* 雷达图：六维（视觉类无 coding/reasoning 则降为四维） */
const radarDims = computed(() => {
  const c = p.value?.capabilityScore || {}
  const visual = (p.value?.modelTypes || []).some((t: string) => ['image', 'video', 'audio'].includes(t))
  return visual
    ? ['质量', '速度', '中文', '成本']
    : ['成本', '速度', '质量', '中文', '代码', '推理']
})
const radarVals = computed(() => {
  const c = p.value?.capabilityScore || {}
  const visual = (p.value?.modelTypes || []).some((t: string) => ['image', 'video', 'audio'].includes(t))
  const dims = visual
    ? [['质量', c.quality], ['速度', c.speed], ['中文', c.chinese], ['成本', c.cost]] as const
    : [['成本', c.cost], ['速度', c.speed], ['质量', c.quality], ['中文', c.chinese], ['代码', c.coding], ['推理', c.reasoning]] as const
  return dims.map(([, v]) => Number(v) || 0)
})
function radarCoord(i: number, radius: number) {
  const n = radarDims.value.length
  const angle = (Math.PI * 2 * i) / n - Math.PI / 2
  return { x: 130 + radius * Math.cos(angle), y: 118 + radius * Math.sin(angle) }
}
function polyPoints(radius: number) {
  return radarDims.value.map((_, i) => {
    const c = radarCoord(i, radius)
    return `${c.x},${c.y}`
  }).join(' ')
}

/* 适合场景：基于能力与类型生成（纯本地规则，无 AI） */
const scenes = computed(() => {
  const t = p.value?.modelTypes || []
  const c = p.value?.capabilityScore || {}
  const s: string[] = []
  if (t.includes('language') || t.includes('multimodal')) {
    if ((c.chinese || 0) >= 85) s.push('中文内容创作、客服与办公助手')
    if ((c.coding || 0) >= 85) s.push('代码生成、编程助手与自动化')
    if ((c.reasoning || 0) >= 85) s.push('复杂推理、数据分析与智能体')
    if ((c.cost || 0) >= 85) s.push('高频低成本调用（批量任务）')
  }
  if (t.includes('image')) s.push('图像生成、海报设计与创意素材')
  if (t.includes('video')) s.push('视频生成、短视频创作与广告分镜')
  if (t.includes('audio')) s.push('语音合成、配音与多语言朗读')
  if (t.includes('agent')) s.push('Agent 编排、工具调用与自动化流程')
  if (!s.length) s.push('通用模型能力场景')
  return s.slice(0, 5)
})

const balance = reactive({ open: false, apiKey: '', loading: false, result: null as any, error: '' })
function openBalance() { balance.open = true; balance.apiKey = ''; balance.result = null; balance.error = '' }
async function queryBalance() {
  if (!balance.apiKey.trim()) { balance.error = '请输入 API Key'; return }
  balance.loading = true; balance.error = ''; balance.result = null
  try {
    const res: any = await $fetch('/api/ai/center/balance-query', {
      method: 'POST',
      body: { provider: code, apiKey: balance.apiKey.trim() },
    }).catch((e: any) => ({ code: 1, error: e?.data?.error || '查询失败' }))
    if (res.code === 0) balance.result = res.data
    else balance.error = res.error || '查询失败'
  } finally { balance.loading = false }
}

onMounted(async () => {
  const res: any = await $fetch(`/api/ai-provider-directory/${code}`).catch(() => ({ code: 1, data: null }))
  p.value = res?.code === 0 ? res.data : null
  loading.value = false
})
</script>

<style scoped>
.aicd { max-width: 1080px; margin: 0 auto; padding: 24px 24px 80px; color: var(--aicd-txt, #16161f); --aicd-txt: #16161f; --aicd-muted: #6b7280; --aicd-card: rgba(255,255,255,0.72); --aicd-border: rgba(0,0,0,0.08); }
@media (prefers-color-scheme: dark) {
  .aicd { --aicd-txt: #e8e8f0; --aicd-muted: #9098b8; --aicd-card: rgba(26,26,36,0.72); --aicd-border: rgba(255,255,255,0.08); }
}
.aicd-backbar { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
.aicd-back { color: #f97316; font-weight: 600; font-size: 14px; text-decoration: none; }
.aicd-crumb { color: var(--aicd-muted); font-size: 13px; }
.aicd-head { display: flex; gap: 20px; align-items: flex-start; padding: 30px; border-radius: 22px; background: var(--aicd-card); border: 1px solid var(--aicd-border); backdrop-filter: blur(14px); }
.aicd-head.connected { border-color: rgba(34,197,94,0.35); }
.aicd-logo { width: 60px; height: 60px; border-radius: 16px; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 24px; font-weight: 800; flex-shrink: 0; box-shadow: 0 6px 20px rgba(0,0,0,0.25); }
.aicd-title { flex: 1; }
.aicd-title h1 { margin: 0 0 6px; font-size: 28px; font-weight: 800; display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.aicd-tag { font-size: 11px; font-weight: 600; color: #f97316; background: rgba(249,115,22,0.12); border: 1px solid rgba(249,115,22,0.3); padding: 3px 10px; border-radius: 999px; }
.aicd-meta { font-size: 13px; color: var(--aicd-muted); }
.aicd-ctx { margin-left: 8px; background: rgba(0,0,0,0.05); padding: 2px 8px; border-radius: 999px; }
@media (prefers-color-scheme: dark) { .aicd-ctx { background: rgba(255,255,255,0.08); } }
.aicd-desc { margin: 10px 0 0; font-size: 14px; color: var(--aicd-muted); line-height: 1.6; }
.aicd-score { text-align: right; flex-shrink: 0; }
.aicd-score-val { font-size: 44px; font-weight: 800; color: #f97316; line-height: 1; }
.aicd-score-stars { font-size: 13px; color: #f59e0b; margin-top: 4px; }
.aicd-score-label { font-size: 11px; color: var(--aicd-muted); margin-top: 4px; }
.aicd-score-label small { opacity: .8; }

.aicd-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 18px; margin-top: 18px; }
.aicd-panel { padding: 24px; border-radius: 20px; background: var(--aicd-card); border: 1px solid var(--aicd-border); backdrop-filter: blur(14px); }
.aicd-panel h3 { margin: 0 0 14px; font-size: 15px; font-weight: 700; }
.aicd-h3-2 { margin-top: 22px !important; }
.aicd-radar { width: 100%; max-width: 280px; }
.aicd-radar .radar-ring { fill: none; stroke: var(--aicd-border); stroke-width: 1; }
.aicd-radar .radar-web { fill: rgba(249,115,22,0.12); stroke: #f97316; stroke-width: 1.5; }
.aicd-radar .radar-line { stroke: var(--aicd-border); stroke-width: 1; }
.aicd-radar .radar-label { fill: var(--aicd-muted); font-size: 10px; }
.aicd-radar-note { font-size: 11px; color: var(--aicd-muted); margin-top: 6px; text-align: center; }
.aicd-price-row { display: flex; gap: 12px; }
.aicd-price-box { flex: 1; padding: 14px; border-radius: 14px; background: rgba(249,115,22,0.06); border: 1px dashed rgba(249,115,22,0.25); text-align: center; }
.aicd-price-k { font-size: 11px; color: var(--aicd-muted); }
.aicd-price-v { font-size: 15px; font-weight: 700; margin-top: 4px; }
.aicd-src { margin-top: 14px; padding: 12px 14px; border-radius: 12px; background: rgba(0,0,0,0.03); font-size: 12px; line-height: 1.9; }
@media (prefers-color-scheme: dark) { .aicd-src { background: rgba(255,255,255,0.04); } }
.aicd-src-line.muted { color: var(--aicd-muted); font-size: 11px; }
.aicd-models { display: flex; flex-wrap: wrap; gap: 8px; }
.aicd-model-chip { font-size: 12px; padding: 5px 12px; border-radius: 999px; background: rgba(249,115,22,0.1); border: 1px solid rgba(249,115,22,0.25); color: var(--aicd-txt); }
.aicd-scenes { margin: 0; padding-left: 18px; color: var(--aicd-muted); font-size: 13px; line-height: 2; }
.aicd-state { display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 14px; }
.aicd-state-dot { width: 10px; height: 10px; border-radius: 50%; background: #9ca3af; }
.aicd-state-dot.on { background: #22c55e; box-shadow: 0 0 10px #22c55e; }
.aicd-state-note { font-size: 12px; color: var(--aicd-muted); margin-top: 8px; line-height: 1.7; }
.aicd-actions { display: flex; gap: 10px; margin-top: 22px; flex-wrap: wrap; }
.aicd-btn { padding: 12px 22px; border-radius: 13px; font-size: 14px; font-weight: 600; border: 1px solid var(--aicd-border); background: var(--aicd-card); color: var(--aicd-txt); cursor: pointer; text-decoration: none; transition: all .2s; }
.aicd-btn:hover { transform: translateY(-1px); }
.aicd-btn.primary { background: linear-gradient(120deg, #f97316, #a855f7); color: #fff; border-color: transparent; box-shadow: 0 8px 22px rgba(249,115,22,0.3); }
.aicd-btn.ghost { background: transparent; }
.aicd-btn.block { width: 100%; }
.aicd-missing { text-align: center; padding: 80px 0; color: var(--aicd-muted); }
.aicd-mask { position: fixed; inset: 0; background: rgba(0,0,0,0.5); backdrop-filter: blur(6px); display: flex; align-items: center; justify-content: center; z-index: 999; }
.aicd-modal { width: 400px; max-width: calc(100vw - 40px); padding: 24px; border-radius: 20px; background: var(--aicd-card); border: 1px solid var(--aicd-border); backdrop-filter: blur(20px); display: flex; flex-direction: column; gap: 12px; }
.aicd-modal-head { display: flex; justify-content: space-between; align-items: center; }
.aicd-modal-x { border: none; background: transparent; color: var(--aicd-muted); font-size: 15px; cursor: pointer; }
.aicd-modal-sub { margin: 0; font-size: 11px; color: var(--aicd-muted); }
.aicd-input { padding: 11px 14px; border-radius: 12px; border: 1px solid var(--aicd-border); background: rgba(0,0,0,0.04); color: var(--aicd-txt); font-size: 14px; outline: none; }
@media (prefers-color-scheme: dark) { .aicd-input { background: rgba(255,255,255,0.06); } }
.aicd-err { color: #ef4444; font-size: 12px; }
.aicd-ok { text-align: center; padding: 14px; border-radius: 14px; background: rgba(34,197,94,0.1); border: 1px solid rgba(34,197,94,0.3); }
.aicd-ok-big { font-size: 30px; font-weight: 800; color: #22c55e; }
.aicd-ok-note { font-size: 11px; color: var(--aicd-muted); margin-top: 2px; }
</style>
