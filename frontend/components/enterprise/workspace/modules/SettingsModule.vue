<!-- SettingsModule — 企业设置模块 -->
<!-- P2-Subscription Entry Fix: 增加「套餐与订阅」管理入口，跳转到 /workspace/enterprise/billing -->
<template>
  <div class="settings-module">
    <section class="section">
      <h2 class="section-title">企业资料</h2>
      <div class="setting-grid">
        <div class="setting-item"><span class="setting-label">企业名称</span><span class="setting-value">{{ orgName }}</span></div>
        <div class="setting-item"><span class="setting-label">API 密钥</span><span class="setting-value">{{ apiKey }}</span></div>
      </div>
    </section>

    <!-- 套餐与订阅 — 点击跳转到独立管理页面 -->
    <section class="section billing-section" @click="goToBilling">
      <div class="billing-header">
        <div>
          <h2 class="section-title">📦 套餐与订阅</h2>
          <p class="billing-subtitle">查看当前套餐、AI 员工配额和账单</p>
        </div>
        <span class="billing-arrow">→</span>
      </div>
      <div class="billing-summary" v-if="!billingLoading">
        <div class="billing-stat">
          <span class="billing-stat-label">当前套餐</span>
          <span class="billing-stat-value">{{ planName || '—' }}</span>
        </div>
        <div class="billing-stat">
          <span class="billing-stat-label">状态</span>
          <span :class="['billing-status-badge', subscriptionStatus]">{{ statusLabel }}</span>
        </div>
        <div class="billing-stat">
          <span class="billing-stat-label">AI 员工</span>
          <span class="billing-stat-value">{{ agentCount }} / {{ maxEmployees || '∞' }}</span>
        </div>
      </div>
      <div class="billing-loading" v-else>
        <span class="loading-text">加载中…</span>
      </div>
    </section>

    <!-- SPRINT-IDENTITY-REALITY-FIX-01: AI 模型设置（BYOK）入口 -->
    <section class="section model-section" @click="goToModelSettings">
      <div class="billing-header">
        <div>
          <h2 class="section-title">🤖 AI 模型设置</h2>
          <p class="billing-subtitle">配置企业自己的大模型 Key（BYOK）— 企业提供算力，昆仑镜管理 AI 员工</p>
        </div>
        <span class="billing-arrow">→</span>
      </div>
      <div class="billing-summary" v-if="!modelLoading">
        <div class="billing-stat">
          <span class="billing-stat-label">模型来源</span>
          <span class="billing-stat-value">{{ modelSummary }}</span>
        </div>
        <div class="billing-stat">
          <span class="billing-stat-label">状态</span>
          <span :class="['billing-status-badge', modelStatus]">{{ modelStatusLabel }}</span>
        </div>
        <div class="billing-stat">
          <span class="billing-stat-label">Provider</span>
          <span class="billing-stat-value">{{ modelProvider || '—' }}</span>
        </div>
      </div>
      <div class="billing-loading" v-else><span class="loading-text">加载中…</span></div>
    </section>

    <section class="section">
      <h2 class="section-title">成员管理</h2>
      <EmptyState icon="👥" title="暂无成员数据" description="管理企业成员权限，分配数字员工角色。" helper-text="支持 SSO、SCIM、API Key 管理" />
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import EmptyState from '~/components/enterprise-ui/feedback/EmptyState.vue'

const orgName = ref('—')
const apiKey = ref('—')
const planName = ref('—')
const subscriptionStatus = ref('')
const maxEmployees = ref(0)
const agentCount = ref(0)
const billingLoading = ref(true)
const modelLoading = ref(true)
const modelSummary = ref('等待企业配置模型')
const modelProvider = ref('')
const modelStatus = ref('')
const modelStatusLabel = ref('⚠️ 未配置')

const statusLabel = computed(() => {
  const map: Record<string, string> = {
    active: '✅ 生效中',
    expiring: '⚠️ 即将到期',
    expired: '❌ 已过期',
    canceled: '⏸️ 已取消',
    trialing: '🧪 试用中',
  }
  return map[subscriptionStatus.value] || subscriptionStatus.value || '—'
})

async function loadBillingInfo() {
  try {
    const res = await fetch('/api/enterprise/subscription/current')
    if (!res.ok) return
    const json = await res.json()
    const data = json?.data
    if (!data) return
    planName.value = data.planName || '—'
    subscriptionStatus.value = data.status || ''
    maxEmployees.value = data.maxEmployees || 0
  } catch {
    // 静默失败
  } finally {
    billingLoading.value = false
  }
}

async function loadAgentCount() {
  try {
    const res = await fetch('/api/enterprise/agent-profiles')
    if (!res.ok) return
    const json = await res.json()
    agentCount.value = json?.data?.length || 0
  } catch {
    // 静默
  }
}

function goToBilling() {
  window.location.href = '/workspace/enterprise/billing'
}

function goToModelSettings() {
  window.location.href = '/workspace/enterprise/model-settings'
}

async function loadModelSettings() {
  try {
    const res = await fetch('/api/enterprise/model-config')
    if (!res.ok) return
    const json = await res.json()
    const settings = json?.data?.settings || []
    if (!settings.length) {
      modelSummary.value = '未配置（员工不可运行）'
      modelStatus.value = 'missing'
      modelStatusLabel.value = '⚠️ 未配置'
      return
    }
    const s = settings[0]
    modelSummary.value = s.hasCredential ? `${s.provider}/${s.model}` : 'Key 缺失'
    modelProvider.value = s.provider
    if (s.healthStatus === 'ok') {
      modelStatus.value = 'active'
      modelStatusLabel.value = '✅ 可运行'
    } else if (s.healthStatus === 'failed') {
      modelStatus.value = 'expired'
      modelStatusLabel.value = '🔴 Key 失效'
    } else {
      modelStatus.value = 'trialing'
      modelStatusLabel.value = '🟡 未检测'
    }
  } catch {
    // 静默
  } finally {
    modelLoading.value = false
  }
}

onMounted(() => {
  loadBillingInfo()
  loadAgentCount()
  loadModelSettings()
  /* TODO: 接入 Org Settings API 获取 orgName/apiKey */
})
</script>

<style scoped>
.settings-module { display: flex; flex-direction: column; gap: var(--space-lg); }
.section {
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-xl);
  padding: var(--space-xl);
}
.billing-section { cursor: pointer; transition: all 0.2s; }
.model-section { cursor: pointer; transition: all 0.2s; }
.model-section:hover {
  border-color: var(--color-intelligence);
  transform: translateY(-1px);
  box-shadow: 0 4px 16px rgba(0,0,0,0.25);
}
.billing-section:hover {
  border-color: var(--color-intelligence);
  background: var(--color-bg-hover);
}
.billing-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--space-lg);
}
.billing-subtitle {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  margin-top: var(--space-xs);
}
.billing-arrow {
  font-size: var(--font-size-lg);
  color: var(--color-text-muted);
  transition: transform 0.2s;
}
.billing-section:hover .billing-arrow {
  transform: translateX(4px);
  color: var(--color-intelligence);
}
.section-title { font-size: var(--font-size-lg); font-weight: 600; color: var(--color-text-primary); }
.billing-summary { display: flex; gap: var(--space-xl); }
.billing-stat { display: flex; flex-direction: column; gap: var(--space-xs); }
.billing-stat-label { font-size: var(--font-size-xs); color: var(--color-text-muted); }
.billing-stat-value { font-size: var(--font-size-sm); color: var(--color-text-secondary); font-weight: 500; }
.billing-status-badge {
  display: inline-flex;
  align-items: center;
  font-size: var(--font-size-sm);
  padding: 2px 8px;
  border-radius: var(--radius-md);
}
.billing-status-badge.active { background: rgba(52, 211, 153, 0.12); color: #34d399; }
.billing-status-badge.expiring { background: rgba(251, 191, 36, 0.12); color: #fbbf24; }
.billing-status-badge.expired { background: rgba(239, 68, 68, 0.12); color: #ef4444; }
.billing-loading { padding: var(--space-md) 0; }
.loading-text { font-size: var(--font-size-sm); color: var(--color-text-muted); }
.setting-grid { display: flex; flex-direction: column; gap: var(--space-sm); }
.setting-item { display: flex; justify-content: space-between; padding: var(--space-sm) 0; border-bottom: 1px solid var(--color-border-primary); }
.setting-label { font-size: var(--font-size-sm); color: var(--color-text-muted); }
.setting-value { font-size: var(--font-size-sm); color: var(--color-text-secondary); font-weight: 500; }
</style>
