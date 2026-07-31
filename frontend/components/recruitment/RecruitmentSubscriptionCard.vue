<!-- Commercial Gate: 套餐权益展示卡片 -->
<!-- 位置：AI 招聘部门首页顶端区域 -->
<!-- 已订阅 → 展示权益；未订阅 → 展示升级入口 -->
<template>
  <div class="rec-sub-card" :class="{ 'rec-sub-card--loading': loading }">
    <!-- 加载中 -->
    <div v-if="loading" class="rec-sub-skeleton">
      <div class="rec-sub-skel-row"></div>
      <div class="rec-sub-skel-row rec-sub-skel--short"></div>
    </div>

    <!-- 已订阅：展示权益 -->
    <div v-else-if="subscription" class="rec-sub-active">
      <div class="rec-sub-header">
        <span class="rec-sub-badge" :class="`rec-sub-badge--${planLevel}`">
          {{ planLabel }}
        </span>
        <div class="rec-sub-meta">
          <span class="rec-sub-price">¥{{ (subscription.price / 100).toFixed(0) }}/月</span>
          <span v-if="subscription.billingCycle" class="rec-sub-cycle">{{ subscription.billingCycle }}</span>
        </div>
      </div>
      <div class="rec-sub-body">
        <div class="rec-sub-stats">
          <div class="rec-sub-stat">
            <span class="rec-sub-stat-val">{{ activeCount }}</span>
            <span class="rec-sub-stat-lbl">已激活 / {{ agentLimit }}</span>
          </div>
          <div class="rec-sub-stat">
            <span class="rec-sub-stat-val">{{ taskCount }}</span>
            <span class="rec-sub-stat-lbl">本月任务</span>
          </div>
          <div class="rec-sub-stat">
            <span class="rec-sub-stat-val">{{ totalCost }}</span>
            <span class="rec-sub-stat-lbl">总成本(¥)</span>
          </div>
        </div>
        <div class="rec-sub-team">
          <span
            v-for="agent in activeAgents"
            :key="agent.id"
            class="rec-sub-agent"
            :title="agent.name"
          >
            {{ agent.name.charAt(0) }}
          </span>
          <span v-if="inactiveSlots > 0" class="rec-sub-agent rec-sub-agent--empty">
            +{{ inactiveSlots }}
          </span>
        </div>
      </div>
      <div class="rec-sub-footer">
        <button class="rec-sub-link" @click="navigateTo('/workspace/enterprise/billing')">
          管理套餐 →
        </button>
      </div>
    </div>

    <!-- 未订阅：展示升级入口 -->
    <div v-else class="rec-sub-upgrade">
      <div class="rec-sub-upgrade-icon">🤖</div>
      <div class="rec-sub-upgrade-body">
        <h4 class="rec-sub-upgrade-title">开始使用 AI 招聘团队</h4>
        <p class="rec-sub-upgrade-desc">订阅套餐即可解锁 AI 招聘员工，提升招聘效率</p>
        <div class="rec-sub-upgrade-features">
          <span class="rec-sub-feature">✓ 招聘顾问 Alice</span>
          <span class="rec-sub-feature">✓ 面试专家 Bob</span>
          <span class="rec-sub-feature">✓ 人才分析师 Carol</span>
        </div>
      </div>
      <button class="rec-sub-upgrade-btn" @click="navigateTo('/workspace/enterprise/billing')">
        升级套餐
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { getAuthToken } from '~/utils/auth/token'

interface SubscriptionDTO {
  planName?: string
  planTier?: string
  price?: number
  billingCycle?: string
  maxEmployees?: number
  status?: string
  expiresAt?: string
}

interface AgentBrief {
  id: string
  name: string
  status: string
}

const loading = ref(true)
const subscription = ref<SubscriptionDTO | null>(null)
const agents = ref<AgentBrief[]>([])

const planLabel = computed(() => {
  if (!subscription.value) return ''
  return subscription.value.planName || subscription.value.planTier || '专业版'
})

const planLevel = computed(() => {
  const tier = (subscription.value?.planTier || subscription.value?.planName || '').toLowerCase()
  if (tier.includes('enterprise') || tier.includes('企业')) return 'enterprise'
  if (tier.includes('pro') || tier.includes('professional') || tier.includes('专业')) return 'pro'
  return 'basic'
})

const activeAgents = computed(() => agents.value.filter(a => a.status === 'active'))
const activeCount = computed(() => activeAgents.value.length)
const agentLimit = computed(() => subscription.value?.maxEmployees || 3)
const inactiveSlots = computed(() => Math.max(0, agentLimit.value - activeCount.value))

const taskCount = ref(0)
const totalCost = ref('0.00')

async function fetchSubscription() {
  try {
    const token = getAuthToken()
    const res = await fetch('/api/enterprise/subscription/current', {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const body = await res.json()
    if ((body?.code === 0 || body?.success) && body?.data) {
      subscription.value = body.data
    }
  } catch {
    // 非订阅用户静默处理
    subscription.value = null
  }
}

async function fetchAgents() {
  try {
    const token = getAuthToken()
    const res = await fetch('/api/enterprise/agent-profiles', {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const body = await res.json()
    if ((body?.code === 0 || body?.success) && Array.isArray(body?.data)) {
      agents.value = body.data.map((a: any) => ({
        id: a.id,
        name: a.name,
        status: a.status,
      }))
    }
  } catch {
    agents.value = []
  }
}

async function fetchTaskStats() {
  try {
    const token = getAuthToken()
    const res = await fetch('/api/enterprise/agent-tasks', {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const body = await res.json()
    if ((body?.code === 0 || body?.success) && Array.isArray(body?.data)) {
      const tasks = body.data as any[]
      taskCount.value = tasks.length
      const total = tasks.reduce((s, t) => s + (parseFloat(t.cost) || 0), 0)
      totalCost.value = total.toFixed(4)
    }
  } catch {
    taskCount.value = 0
  }
}

onMounted(async () => {
  await Promise.all([fetchSubscription(), fetchAgents(), fetchTaskStats()])
  loading.value = false
})
</script>

<style scoped>
.rec-sub-card {
  background: var(--color-bg-elevated, #fff);
  border: 1px solid var(--color-border-primary, #e5e7eb);
  border-radius: 12px;
  overflow: hidden;
  margin: 12px 0;
  transition: box-shadow 0.2s;
}
.rec-sub-card:hover {
  box-shadow: 0 2px 12px rgba(0,0,0,0.08);
}

/* ─── Skeleton ─── */
.rec-sub-skeleton {
  padding: 20px;
}
.rec-sub-skel-row {
  height: 14px;
  background: var(--color-bg-secondary, #f3f4f6);
  border-radius: 6px;
  margin-bottom: 10px;
}
.rec-sub-skel--short {
  width: 60%;
}

/* ─── Active Sub ─── */
.rec-sub-active {
  padding: 16px 20px;
}
.rec-sub-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}
.rec-sub-badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 600;
}
.rec-sub-badge--basic {
  background: #dbeafe;
  color: #1d4ed8;
}
.rec-sub-badge--pro {
  background: #fef3c7;
  color: #b45309;
}
.rec-sub-badge--enterprise {
  background: #ede9fe;
  color: #6d28d9;
}
.rec-sub-meta {
  display: flex;
  align-items: center;
  gap: 8px;
}
.rec-sub-price {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary, #111827);
}
.rec-sub-cycle {
  font-size: 12px;
  color: var(--color-text-secondary, #6b7280);
}
.rec-sub-body {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.rec-sub-stats {
  display: flex;
  gap: 20px;
}
.rec-sub-stat {
  display: flex;
  flex-direction: column;
}
.rec-sub-stat-val {
  font-size: 18px;
  font-weight: 700;
  color: var(--color-text-primary, #111827);
  line-height: 1.2;
}
.rec-sub-stat-lbl {
  font-size: 11px;
  color: var(--color-text-secondary, #6b7280);
}
.rec-sub-team {
  display: flex;
  align-items: center;
  gap: 4px;
}
.rec-sub-agent {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: #fff;
  font-size: 13px;
  font-weight: 600;
}
.rec-sub-agent--empty {
  background: var(--color-bg-secondary, #f3f4f6);
  color: var(--color-text-secondary, #6b7280);
  font-size: 11px;
}
.rec-sub-footer {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--color-border-primary, #e5e7eb);
}
.rec-sub-link {
  background: none;
  border: none;
  color: var(--color-decision, #6366f1);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  padding: 0;
}
.rec-sub-link:hover {
  text-decoration: underline;
}

/* ─── Upgrade ─── */
.rec-sub-upgrade {
  padding: 20px;
  display: flex;
  align-items: center;
  gap: 16px;
  background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
}
.rec-sub-upgrade-icon {
  font-size: 36px;
  flex-shrink: 0;
}
.rec-sub-upgrade-body {
  flex: 1;
}
.rec-sub-upgrade-title {
  margin: 0 0 4px;
  font-size: 15px;
  font-weight: 600;
  color: #111827;
}
.rec-sub-upgrade-desc {
  margin: 0;
  font-size: 12px;
  color: #6b7280;
}
.rec-sub-upgrade-features {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 16px;
  margin-top: 10px;
}
.rec-sub-feature {
  font-size: 12px;
  color: #374151;
}
.rec-sub-upgrade-btn {
  flex-shrink: 0;
  padding: 8px 20px;
  border: none;
  border-radius: 8px;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: opacity 0.2s;
}
.rec-sub-upgrade-btn:hover {
  opacity: 0.9;
}
</style>
