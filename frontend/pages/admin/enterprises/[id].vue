<!-- /admin/enterprises/[id] — 企业详情（运营视角） -->
<template>
  <div class="enterprise-detail">
    <!-- Back button -->
    <button class="back-btn" @click="navigateTo('/admin/enterprises')">
      ← 返回企业列表
    </button>

    <div v-if="loading" class="loading">加载中...</div>

    <template v-else-if="enterprise">
      <!-- Header -->
      <div class="detail-header">
        <div>
          <h1 class="detail-title">{{ enterprise.name }}</h1>
          <p class="detail-meta">
            {{ enterprise.industry || '未设置行业' }} ·
            创建于 {{ formatDate(enterprise.createdAt) }}
          </p>
        </div>
        <div class="plan-info">
          <span class="plan-name">{{ enterprise.plan.name }}</span>
          <span class="plan-status" :class="`status-${enterprise.plan.status}`">
            {{ enterprise.plan.status === 'active' ? '生效中' : enterprise.plan.status === 'expired' ? '已过期' : '未订阅' }}
          </span>
        </div>
      </div>

      <!-- Stats -->
      <div class="detail-stats">
        <div class="detail-stat">
          <span class="ds-value">{{ enterprise.stats.totalAgents }}</span>
          <span class="ds-label">AI 员工</span>
        </div>
        <div class="detail-stat">
          <span class="ds-value">{{ enterprise.stats.totalModels }}</span>
          <span class="ds-label">模型配置</span>
        </div>
        <div class="detail-stat">
          <span class="ds-value">{{ enterprise.stats.totalChannels }}</span>
          <span class="ds-label">渠道</span>
        </div>
        <div class="detail-stat">
          <span class="ds-value">{{ enterprise.stats.totalTasks }}</span>
          <span class="ds-label">累计任务</span>
        </div>
      </div>

      <!-- Risks -->
      <div v-if="enterprise.risks.length > 0" class="risks-section">
        <h3>⚠️ 风险提示</h3>
        <div class="risk-list">
          <div
            v-for="(risk, idx) in enterprise.risks"
            :key="idx"
            class="risk-item"
            :class="`risk-${risk.type}`"
          >
            <span class="risk-icon">
              {{ risk.type === 'urgent' ? '🔴' : risk.type === 'warning' ? '🟡' : '🔵' }}
            </span>
            <span class="risk-msg">{{ risk.message }}</span>
          </div>
        </div>
      </div>

      <!-- AI 员工 -->
      <div class="section">
        <h3>🤖 AI 员工</h3>
        <div v-if="enterprise.agents.length > 0" class="agent-grid">
          <div
            v-for="agent in enterprise.agents"
            :key="agent.id"
            class="agent-card"
          >
            <div class="agent-header">
              <span class="agent-name">{{ agent.name }}</span>
              <span class="agent-status" :class="`status-${agent.status}`">
                {{ agent.status === 'active' ? '运行中' : agent.status === 'paused' ? '已暂停' : '已停止' }}
              </span>
            </div>
            <div class="agent-meta">
              <span>角色: {{ agent.role }}</span>
              <span>模型: {{ agent.model }}</span>
              <span>渠道: {{ agent.channelCount }}</span>
              <span>任务: {{ agent.taskCount }}</span>
            </div>
            <div class="agent-last-active">
              最近活跃: {{ agent.lastActiveAt ? formatTime(agent.lastActiveAt) : '—' }}
            </div>
          </div>
        </div>
        <div v-else class="empty-text">暂无 AI 员工</div>
      </div>

      <!-- 模型 -->
      <div class="section">
        <h3>🧠 模型配置</h3>
        <div v-if="enterprise.models.length > 0" class="model-list">
          <div
            v-for="model in enterprise.models"
            :key="model.id"
            class="model-row"
          >
            <span class="model-provider">{{ model.provider }}</span>
            <span class="model-name">{{ model.model }}</span>
            <span class="model-status" :class="model.enabled ? 'enabled' : 'disabled'">
              {{ model.enabled ? '已启用' : '已禁用' }}
            </span>
          </div>
        </div>
        <div v-else class="empty-text">未配置模型</div>
      </div>

      <!-- 渠道 -->
      <div class="section">
        <h3>📡 渠道</h3>
        <div v-if="enterprise.channels.length > 0" class="channel-list">
          <div
            v-for="ch in enterprise.channels"
            :key="ch.id"
            class="channel-row"
          >
            <span class="channel-name">{{ ch.name }}</span>
            <span class="channel-type">{{ ch.type }}</span>
            <span class="channel-status" :class="`conn-${ch.status}`">
              {{ ch.status === 'CONNECTED' ? '已连接' : '待连接' }}
            </span>
          </div>
        </div>
        <div v-else class="empty-text">未连接渠道</div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admin-aigc' })
import { ref, onMounted } from 'vue'

const route = useRoute()
const loading = ref(true)
const enterprise = ref<any>(null)

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('zh-CN')
}

function formatTime(dateStr: string | null): string {
  if (!dateStr) return '—'
  const diff = Date.now() - new Date(dateStr).getTime()
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`
  return `${Math.floor(diff / 86400000)}天前`
}

async function loadEnterprise() {
  loading.value = true
  try {
    const id = route.params.id
    const res = await fetch(`/api/admin/enterprises/${id}`)
    if (res.ok) {
      const data = await res.json()
      if (data.code === 0) enterprise.value = data.data
    }
  } catch (e) {
    console.error('[EnterpriseDetail] Load failed:', e)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadEnterprise()
})
</script>

<style scoped>
.enterprise-detail {
  padding: var(--space-xl);
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
  max-width: 900px;
  margin: 0 auto;
}

.back-btn {
  align-self: flex-start;
  background: none;
  border: none;
  color: var(--color-intelligence);
  cursor: pointer;
  font-size: var(--font-size-sm);
  padding: 0;
}

.back-btn:hover {
  text-decoration: underline;
}

.loading {
  text-align: center;
  padding: var(--space-2xl);
  color: var(--color-text-muted);
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding-bottom: var(--space-lg);
  border-bottom: 1px solid var(--color-border-primary);
}

.detail-title {
  font-size: var(--font-size-xl);
  font-weight: 700;
  color: var(--color-text-primary);
}

.detail-meta {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  margin-top: var(--space-xs);
}

.plan-info {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: var(--space-xs);
}

.plan-name {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-text-primary);
}

.plan-status {
  padding: 4px 10px;
  border-radius: 99px;
  font-size: var(--font-size-xs);
}

.status-active {
  background: rgba(16, 185, 129, 0.1);
  color: #10b981;
}

.status-expired {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

.status-none {
  background: var(--color-bg-elevated);
  color: var(--color-text-muted);
}

.detail-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-md);
}

.detail-stat {
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-lg);
  padding: var(--space-lg);
  text-align: center;
}

.ds-value {
  display: block;
  font-size: var(--font-size-xl);
  font-weight: 700;
  color: var(--color-intelligence);
}

.ds-label {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.risks-section {
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-lg);
  padding: var(--space-lg);
}

.risks-section h3 {
  font-size: var(--font-size-sm);
  font-weight: 600;
  margin-bottom: var(--space-md);
}

.risk-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.risk-item {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-md);
  border-radius: var(--radius-md);
  background: var(--color-bg-elevated);
}

.risk-msg {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.section {
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-lg);
  padding: var(--space-lg);
}

.section h3 {
  font-size: var(--font-size-sm);
  font-weight: 600;
  margin-bottom: var(--space-md);
}

.agent-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: var(--space-md);
}

.agent-card {
  background: var(--color-bg-elevated);
  border-radius: var(--radius-md);
  padding: var(--space-md);
}

.agent-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-sm);
}

.agent-name {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-text-primary);
}

.agent-status {
  padding: 2px 8px;
  border-radius: 99px;
  font-size: var(--font-size-xs);
}

.status-active {
  background: rgba(16, 185, 129, 0.1);
  color: #10b981;
}

.status-paused {
  background: rgba(245, 158, 11, 0.1);
  color: #f59e0b;
}

.status-stopped {
  background: var(--color-bg-secondary);
  color: var(--color-text-muted);
}

.agent-meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-sm);
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.agent-last-active {
  margin-top: var(--space-sm);
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.model-list,
.channel-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.model-row,
.channel-row {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-sm) 0;
  border-bottom: 1px solid var(--color-border-primary);
}

.model-provider,
.channel-type {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  min-width: 60px;
}

.model-name,
.channel-name {
  flex: 1;
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
}

.model-status,
.channel-status {
  padding: 2px 8px;
  border-radius: 99px;
  font-size: var(--font-size-xs);
}

.enabled,
.conn-CONNECTED {
  background: rgba(16, 185, 129, 0.1);
  color: #10b981;
}

.disabled,
.conn-PENDING {
  background: var(--color-bg-elevated);
  color: var(--color-text-muted);
}

.empty-text {
  text-align: center;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  padding: var(--space-lg);
}
</style>
