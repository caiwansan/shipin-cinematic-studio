<!-- /admin/enterprises — 昆仑镜运营控制台：企业总览 -->
<template>
  <div class="admin-enterprises">
    <!-- Top Stats -->
    <div class="stats-banner">
      <div class="stat-card">
        <span class="stat-value">{{ stats.totalEnterprises ?? 0 }}</span>
        <span class="stat-label">企业总数</span>
      </div>
      <div class="stat-card">
        <span class="stat-value">{{ stats.activeAgents ?? 0 }}</span>
        <span class="stat-label">活跃 AI 员工</span>
      </div>
      <div class="stat-card">
        <span class="stat-value">{{ stats.totalAgents ?? 0 }}</span>
        <span class="stat-label">AI 员工总数</span>
      </div>
      <div class="stat-card">
        <span class="stat-value">{{ stats.totalTasks ?? 0 }}</span>
        <span class="stat-label">累计任务</span>
      </div>
      <div class="stat-card">
        <span class="stat-value">{{ stats.totalChannels ?? 0 }}</span>
        <span class="stat-label">渠道总数</span>
      </div>
    </div>

    <!-- Search & Filter -->
    <div class="toolbar">
      <div class="search-box">
        <span class="search-icon">🔍</span>
        <input
          v-model="searchQuery"
          placeholder="搜索企业名称..."
          @keyup.enter="loadEnterprises"
        />
      </div>
      <div class="filter-tabs">
        <button
          v-for="tab in filterTabs"
          :key="tab.value"
          class="filter-tab"
          :class="{ active: currentFilter === tab.value }"
          @click="currentFilter = tab.value; loadEnterprises()"
        >
          {{ tab.label }}
        </button>
      </div>
    </div>

    <!-- Enterprise List -->
    <div class="enterprise-list">
      <div v-if="loading" class="loading-state">
        <span>加载中...</span>
      </div>

      <div v-else-if="enterprises.length === 0" class="empty-state">
        <span class="empty-icon">🏢</span>
        <p>暂无企业数据</p>
      </div>

      <div
        v-for="enterprise in enterprises"
        :key="enterprise.id"
        class="enterprise-row"
        @click="navigateTo(`/admin/aigc/enterprises/${enterprise.id}`)"
      >
        <div class="row-main">
          <div class="enterprise-info">
            <h3 class="enterprise-name">{{ enterprise.name }}</h3>
            <span class="enterprise-industry">{{ enterprise.industry || '未设置行业' }}</span>
          </div>
          <div class="enterprise-plan">
            <span class="plan-badge" :class="`plan-${enterprise.planStatus}`">
              {{ enterprise.plan }}
            </span>
          </div>
        </div>

        <div class="row-stats">
          <div class="mini-stat">
            <span class="mini-value">{{ enterprise.aiEmployeeCount }}</span>
            <span class="mini-label">AI 员工</span>
          </div>
          <div class="mini-stat">
            <span class="mini-value">{{ enterprise.activeModels > 0 ? '✅' : '⚠️' }}</span>
            <span class="mini-label">模型 {{ enterprise.activeModels }}</span>
          </div>
          <div class="mini-stat">
            <span class="mini-value">{{ enterprise.channelCount }}</span>
            <span class="mini-label">渠道</span>
          </div>
          <div class="mini-stat">
            <span class="mini-value">{{ enterprise.totalTasks }}</span>
            <span class="mini-label">任务</span>
          </div>
          <div class="mini-stat">
            <span class="mini-value">{{ enterprise.lastActiveAt ? formatTime(enterprise.lastActiveAt) : '—' }}</span>
            <span class="mini-label">最近活跃</span>
          </div>
        </div>

        <div class="row-risks">
          <span
            v-for="risk in enterprise.risks"
            :key="risk"
            class="risk-badge"
            :class="`risk-${risk}`"
          >
            {{ riskLabels[risk] || risk }}
          </span>
        </div>

        <div class="row-action">
          <span class="action-link">查看详情 →</span>
        </div>
      </div>
    </div>

    <!-- Pagination -->
    <div v-if="pagination.totalPages > 1" class="pagination">
      <button
        :disabled="pagination.page <= 1"
        @click="pagination.page--; loadEnterprises()"
      >
        ←
      </button>
      <span>{{ pagination.page }} / {{ pagination.totalPages }}</span>
      <button
        :disabled="pagination.page >= pagination.totalPages"
        @click="pagination.page++; loadEnterprises()"
      >
        →
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { getToken } from '~/utils/token-cache'

definePageMeta({ layout: 'admin-aigc' })

interface Enterprise {
  id: string
  name: string
  industry: string | null
  createdAt: string
  plan: string
  planStatus: string
  aiEmployeeCount: number
  modelCount: number
  activeModels: number
  channelCount: number
  totalTasks: number
  lastActiveAt: string | null
  risks: string[]
}

const loading = ref(true)
const searchQuery = ref('')
const currentFilter = ref('all')
const enterprises = ref<Enterprise[]>([])
const stats = ref<any>({})
const pagination = reactive({
  page: 1,
  pageSize: 20,
  total: 0,
  totalPages: 0,
})

const filterTabs = [
  { value: 'all', label: '全部' },
  { value: 'active', label: '运行中' },
  { value: 'inactive', label: '待激活' },
  { value: 'no_agent', label: '无员工' },
]

const riskLabels: Record<string, string> = {
  no_agent: '无 AI 员工',
  no_model: '缺模型',
  no_channel: '缺渠道',
  inactive: '近期未活跃',
}

function formatTime(dateStr: string | null): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  const now = Date.now()
  const diff = now - d.getTime()
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`
  return `${Math.floor(diff / 86400000)}天前`
}

async function loadEnterprises() {
  loading.value = true
  try {
    const params = new URLSearchParams({
      page: pagination.page.toString(),
      pageSize: pagination.pageSize.toString(),
    })
    if (searchQuery.value) params.set('search', searchQuery.value)
    if (currentFilter.value !== 'all') params.set('status', currentFilter.value)

    const token = getAdminToken()
    const res = await fetch(`/api/admin/enterprises?${params}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    })
    if (res.ok) {
      const data = await res.json()
      if (data.code === 0) {
        enterprises.value = data.data.list
        Object.assign(pagination, data.data.pagination)
      }
    }
  } catch (e) {
    console.error('[AdminEnterprises] Load failed:', e)
  } finally {
    loading.value = false
  }
}

async function loadStats() {
  try {
    const token = getAdminToken()
    const res = await fetch('/api/admin/enterprises/stats', {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    })
    if (res.ok) {
      const data = await res.json()
      if (data.code === 0) stats.value = data.data
    }
  } catch (e) {
    console.error('[AdminEnterprises] Stats failed:', e)
  }
}

onMounted(() => {
  loadStats()
  loadEnterprises()
})
</script>

<style scoped>
.admin-enterprises {
  padding: var(--space-xl);
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
  max-width: 1200px;
  margin: 0 auto;
}

.stats-banner {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: var(--space-md);
}

.stat-card {
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-lg);
  padding: var(--space-lg);
  text-align: center;
}

.stat-value {
  display: block;
  font-size: var(--font-size-2xl);
  font-weight: 700;
  color: var(--color-intelligence);
}

.stat-label {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-md);
  flex-wrap: wrap;
}

.search-box {
  position: relative;
  flex: 1;
  max-width: 400px;
}

.search-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 14px;
}

.search-box input {
  width: 100%;
  padding: 10px 12px 10px 36px;
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
  outline: none;
}

.search-box input:focus {
  border-color: var(--color-intelligence);
}

.filter-tabs {
  display: flex;
  gap: var(--space-xs);
}

.filter-tab {
  padding: 6px 14px;
  border-radius: 99px;
  font-size: var(--font-size-xs);
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border-primary);
  color: var(--color-text-muted);
  cursor: pointer;
  transition: all 0.2s;
}

.filter-tab.active {
  background: var(--color-intelligence);
  color: #000;
  border-color: var(--color-intelligence);
}

.enterprise-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.enterprise-row {
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-lg);
  padding: var(--space-lg);
  cursor: pointer;
  transition: all 0.2s;
}

.enterprise-row:hover {
  border-color: var(--color-intelligence);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.row-main {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--space-md);
}

.enterprise-name {
  font-size: var(--font-size-md);
  font-weight: 600;
  color: var(--color-text-primary);
}

.enterprise-industry {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.plan-badge {
  padding: 4px 10px;
  border-radius: 99px;
  font-size: var(--font-size-xs);
  font-weight: 500;
}

.plan-active {
  background: rgba(16, 185, 129, 0.1);
  color: #10b981;
}

.plan-expired {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

.plan-none {
  background: var(--color-bg-elevated);
  color: var(--color-text-muted);
}

.row-stats {
  display: flex;
  gap: var(--space-lg);
  margin-bottom: var(--space-sm);
}

.mini-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.mini-value {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-text-primary);
}

.mini-label {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.row-risks {
  display: flex;
  gap: var(--space-xs);
  flex-wrap: wrap;
}

.risk-badge {
  padding: 2px 8px;
  border-radius: 99px;
  font-size: var(--font-size-xs);
}

.risk-no_agent,
.risk-no_model {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

.risk-no_channel,
.risk-inactive {
  background: rgba(245, 158, 11, 0.1);
  color: #f59e0b;
}

.row-action {
  margin-top: var(--space-sm);
  text-align: right;
}

.action-link {
  font-size: var(--font-size-xs);
  color: var(--color-intelligence);
}

.loading-state,
.empty-state {
  text-align: center;
  padding: var(--space-2xl);
  color: var(--color-text-muted);
}

.empty-icon {
  font-size: 48px;
  display: block;
  margin-bottom: var(--space-md);
}

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: var(--space-md);
}

.pagination button {
  padding: 6px 12px;
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-md);
  cursor: pointer;
}

.pagination button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
