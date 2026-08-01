<!--
  新媒体运营工作台 — 运营总览

  Sprint-MEDIA-UX-01: 产品壳 + 诚实空态
  - AI 员工阵容: 真实 /api/enterprise/agent-profiles?types=media_*
  - 执行记录:   真实 /api/enterprise/outcomes?workspace=media（agent_outcome SSOT）
  - 能力目录:   真实 CapabilityContract（当前为空 → 规划清单仅作设计展示）
  - 禁止 mock：无数据显示空态，不写死任何「成功」状态
-->
<template>
  <MediaWorkspaceShell>
    <!-- ═══ 账号状态横幅 ═══ -->
    <div class="mo-banner" :class="accountConnected ? 'mo-banner--ok' : 'mo-banner--wait'">
      <div class="mo-banner-icon">{{ accountConnected ? '✅' : '⏳' }}</div>
      <div class="mo-banner-body">
        <h3>{{ accountConnected ? '已连接微信公众平台' : '等待微信公众平台资产接入' }}</h3>
        <p v-if="!accountConnected">
          新媒体工作台需要真实企业认证服务号凭证（appid/secret + IP 白名单
          <code class="mo-code">124.223.208.24</code>）后才能连接账号。凭证将加密存入
          ProviderCredential（企业资产，平台不可见明文），微信接入在 Sprint-MEDIA-01 启动。
        </p>
        <p v-else>账号已连接，AI 员工可开始真实发布与数据回流。</p>
      </div>
      <div v-if="!accountConnected" class="mo-banner-action">
        <button class="mo-btn mo-btn--ghost" disabled title="凭证就绪后开放">凭证待交付</button>
      </div>
    </div>

    <!-- ═══ AI 员工阵容 ═══ -->
    <section class="mo-section">
      <div class="mo-section-head">
        <h2 class="mo-section-title">🤖 AI 员工阵容</h2>
        <span class="mo-section-meta">来源：真实 AgentInstance</span>
      </div>
      <MediaAgentRoster :agents="agents" :loading="loading" />
    </section>

    <!-- ═══ 执行记录 ═══ -->
    <section class="mo-section">
      <div class="mo-section-head">
        <h2 class="mo-section-title">⚡ 执行记录</h2>
        <span class="mo-section-meta">来源：agent_outcome（统一结果层）</span>
      </div>
      <div v-if="loadingOutcomes" class="mo-loading">加载中...</div>
      <template v-else-if="outcomes.length > 0">
        <div class="mo-outcome-stats">
          <div class="mo-stat">
            <strong>{{ outcomes.length }}</strong>
            <span>最近结果</span>
          </div>
          <div v-for="g in outcomeByType" :key="g.outcomeType" class="mo-stat">
            <strong>{{ g.count }}</strong>
            <span>{{ g.outcomeType }}</span>
          </div>
          <div class="mo-stat">
            <strong>${{ usage.totalCost.toFixed(4) }}</strong>
            <span>真实成本（usage_logs）</span>
          </div>
        </div>
        <ul class="mo-outcome-list">
          <li v-for="o in outcomes" :key="o.id" class="mo-outcome-item">
            <span class="mo-outcome-type">{{ o.outcomeType }}</span>
            <span class="mo-outcome-time">{{ formatTime(o.createdAt) }}</span>
          </li>
        </ul>
      </template>
      <div v-else class="mo-empty">
        <span class="mo-empty-icon">📭</span>
        <p class="mo-empty-title">暂无执行记录</p>
        <p class="mo-empty-desc">账号接入并产生真实运营动作后，这里展示 AI 员工的实际业务结果（无 mock）。</p>
      </div>
    </section>

    <!-- ═══ 能力目录 ═══ -->
    <section class="mo-section">
      <div class="mo-section-head">
        <h2 class="mo-section-title">🧩 能力目录（media.*）</h2>
        <span class="mo-section-meta">来源：CapabilityContract（当前为空）</span>
      </div>
      <div v-if="capabilities.length > 0" class="mo-cap-grid">
        <div v-for="c in capabilities" :key="c.name" class="mo-cap">
          <span class="mo-cap-name">{{ c.name }}</span>
          <span class="mo-cap-cat">{{ c.category }}</span>
        </div>
      </div>
      <div v-else class="mo-empty">
        <span class="mo-empty-icon">🧩</span>
        <p class="mo-empty-title">能力目录待注册</p>
        <p class="mo-empty-desc">media.* 能力（发布/同步/合规/去重等 18 项）将在 Sprint-MEDIA-02 注册，当前展示为设计清单：</p>
        <details class="mo-details">
          <summary>查看 18 项设计能力清单（规划中，未注册）</summary>
          <ul class="mo-cap-plan-list">
            <li v-for="c in DESIGN_CAPABILITIES" :key="c">{{ c }}</li>
          </ul>
        </details>
      </div>
    </section>

    <!-- ═══ 模块入口 ═══ -->
    <section class="mo-section">
      <div class="mo-section-head">
        <h2 class="mo-section-title">🗂️ 模块入口</h2>
      </div>
      <div class="mo-mod-grid">
        <NuxtLink v-for="m in MODULES" :key="m.path" :to="m.path" class="mo-mod">
          <span class="mo-mod-icon">{{ m.icon }}</span>
          <div>
            <div class="mo-mod-name">{{ m.name }}</div>
            <div class="mo-mod-desc">{{ m.desc }}</div>
          </div>
          <span v-if="m.planned" class="mo-mod-tag">规划中</span>
        </NuxtLink>
      </div>
    </section>
  </MediaWorkspaceShell>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '~/stores/auth'

const authStore = useAuthStore()

const MEDIA_TYPES = 'media_director,media_planner,media_producer,media_cs,media_analyst'

const MODULES = [
  { icon: '🔗', name: '账号管理', desc: '微信公众平台连接与凭证', path: '/workspace/media/accounts', planned: false },
  { icon: '📝', name: '内容中心', desc: '内容发布与数据回流', path: '/workspace/media/content', planned: false },
  { icon: '💬', name: '消息互动', desc: '粉丝私信与互动', path: '/workspace/media/messages', planned: true },
  { icon: '👥', name: '客户管理', desc: '粉丝客户画像', path: '/workspace/media/customers', planned: true },
  { icon: '📊', name: '数据分析', desc: '运营数据复盘', path: '/workspace/media/analytics', planned: true },
  { icon: '🧑‍💼', name: '团队管理', desc: 'AI 员工与权限', path: '/workspace/media/team', planned: true },
]

const DESIGN_CAPABILITIES = [
  'media.publish.dispatch', 'media.publish.schedule', 'media.sync.pull', 'media.sync.push',
  'media.compliance.check', 'media.dedup.check', 'media.content.draft', 'media.content.rewrite',
  'media.asset.upload', 'media.asset.list', 'media.message.reply', 'media.message.triage',
  'media.customer.profile', 'media.customer.segment', 'media.analytics.summary', 'media.analytics.daily',
  'media.report.generate', 'media.account.health',
]

const loading = ref(true)
const agents = ref<any[]>([])
const loadingOutcomes = ref(true)
const outcomes = ref<any[]>([])
const usage = ref({ totalCost: 0, executions: 0 })
const capabilities = ref<any[]>([])

const accountConnected = computed(() => agents.value.some((a) => a.status === 'running'))

const outcomeByType = computed(() => {
  const map = new Map<string, number>()
  outcomes.value.forEach((o) => map.set(o.outcomeType, (map.get(o.outcomeType) || 0) + 1))
  return Array.from(map.entries()).map(([outcomeType, count]) => ({ outcomeType, count }))
})

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleString('zh-CN', { hour12: false })
  } catch {
    return iso
  }
}

onMounted(async () => {
  const token = authStore.token
  const headers: Record<string, string> = {}
  if (token) headers['Authorization'] = `Bearer ${token}`

  // 1. 真实 AI 员工（agent-profiles）
  try {
    const res = await fetch(`/api/enterprise/agent-profiles?types=${MEDIA_TYPES}`, { headers })
    const data = await res.json()
    if (data?.code === 0 && Array.isArray(data?.data)) {
      agents.value = data.data
    } else if (Array.isArray(data?.data?.agents)) {
      agents.value = data.data.agents
    }
  } catch { /* 保持空态 */ }
  loading.value = false

  // 2. 真实执行记录（agent_outcome SSOT）
  try {
    const res = await fetch('/api/enterprise/outcomes?workspace=media&days=30&limit=20', { headers })
    const data = await res.json()
    if (data?.code === 0 && data?.data) {
      outcomes.value = data.data.items || []
      usage.value = data.data.usage || { totalCost: 0, executions: 0 }
    }
  } catch { /* 保持空态 */ }
  loadingOutcomes.value = false

  // 3. 真实能力目录（现有 /api/enterprise/capabilities，前端按 prefix 过滤 media.*）
  try {
    const res = await fetch('/api/enterprise/capabilities', { headers })
    const data = await res.json()
    if (data?.code === 0 && Array.isArray(data?.data)) {
      capabilities.value = data.data.filter((c: any) => String(c?.code || c?.name || '').startsWith('media'))
    }
  } catch { /* 保持空态 */ }
})
</script>

<style scoped>
.mo-banner {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  border-radius: 14px;
  padding: 18px 20px;
  margin-bottom: 20px;
}
.mo-banner--wait {
  background: #fffbea;
  border: 1px solid #fde68a;
}
.mo-banner--ok {
  background: #ecfdf3;
  border: 1px solid #a7f3d0;
}
.mo-banner-icon {
  font-size: 24px;
}
.mo-banner-body h3 {
  margin: 0 0 6px;
  font-size: 15px;
  color: #1a1a2e;
}
.mo-banner-body p {
  margin: 0;
  font-size: 13px;
  color: #6b6b80;
  line-height: 1.7;
}
.mo-code {
  background: #f5f5f8;
  border: 1px solid #e5e5ec;
  border-radius: 4px;
  padding: 1px 6px;
  font-size: 12px;
}
.mo-banner-action {
  margin-left: auto;
}
.mo-btn {
  border: none;
  border-radius: 8px;
  padding: 8px 14px;
  font-size: 13px;
  cursor: pointer;
  font-weight: 600;
}
.mo-btn--ghost {
  background: #f5f5f8;
  color: #9a9aad;
  border: 1px solid #e5e5ec;
}
.mo-section {
  background: #fff;
  border: 1px solid #ececf1;
  border-radius: 14px;
  padding: 20px;
  margin-bottom: 20px;
}
.mo-section-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 16px;
}
.mo-section-title {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  color: #1a1a2e;
}
.mo-section-meta {
  font-size: 11px;
  color: #b0b0c0;
}
.mo-loading {
  color: #9a9aad;
  font-size: 13px;
  padding: 20px 0;
  text-align: center;
}
.mo-outcome-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 14px;
}
.mo-stat {
  background: #f7f8fa;
  border: 1px solid #ececf1;
  border-radius: 10px;
  padding: 10px 16px;
  display: flex;
  flex-direction: column;
}
.mo-stat strong {
  font-size: 16px;
  color: #1a1a2e;
}
.mo-stat span {
  font-size: 11px;
  color: #9a9aad;
}
.mo-outcome-list {
  list-style: none;
  padding: 0;
  margin: 0;
}
.mo-outcome-item {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px dashed #f0f0f5;
  font-size: 13px;
}
.mo-outcome-type {
  color: #2563eb;
  font-family: monospace;
}
.mo-outcome-time {
  color: #b0b0c0;
}
.mo-empty {
  text-align: center;
  padding: 28px 0 18px;
}
.mo-empty-icon {
  font-size: 30px;
}
.mo-empty-title {
  font-weight: 600;
  color: #5a5a70;
  margin: 8px 0 4px;
  font-size: 14px;
}
.mo-empty-desc {
  font-size: 12px;
  color: #9a9aad;
  max-width: 420px;
  margin: 0 auto;
  line-height: 1.6;
}
.mo-details {
  margin-top: 12px;
  text-align: left;
  max-width: 520px;
  margin-left: auto;
  margin-right: auto;
}
.mo-details summary {
  font-size: 12px;
  color: #2563eb;
  cursor: pointer;
}
.mo-cap-plan-list {
  columns: 2;
  font-size: 12px;
  color: #6b6b80;
  text-align: left;
  margin-top: 8px;
  padding-left: 18px;
  line-height: 1.9;
}
.mo-cap-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.mo-cap {
  display: inline-flex;
  gap: 8px;
  align-items: center;
  background: #f7f8fa;
  border: 1px solid #ececf1;
  border-radius: 8px;
  padding: 6px 12px;
  font-size: 12px;
}
.mo-cap-name {
  font-family: monospace;
  color: #1a1a2e;
}
.mo-cap-cat {
  color: #9a9aad;
  font-size: 11px;
}
.mo-mod-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 12px;
}
.mo-mod {
  display: flex;
  align-items: center;
  gap: 12px;
  border: 1px solid #ececf1;
  border-radius: 12px;
  padding: 14px;
  text-decoration: none;
  background: #fff;
  transition: box-shadow 0.15s, border-color 0.15s;
}
.mo-mod:hover {
  border-color: #c7d2fe;
  box-shadow: 0 4px 14px rgba(37, 99, 235, 0.08);
}
.mo-mod-icon {
  font-size: 22px;
}
.mo-mod-name {
  font-size: 14px;
  font-weight: 600;
  color: #1a1a2e;
}
.mo-mod-desc {
  font-size: 12px;
  color: #9a9aad;
  margin-top: 2px;
}
.mo-mod-tag {
  margin-left: auto;
  font-size: 10px;
  background: #f0f0f5;
  color: #9a9aad;
  border-radius: 10px;
  padding: 2px 8px;
}
</style>
