<template>
  <div class="capability-dashboard">
    <div class="dashboard-header">
      <h1>能力平台仪表盘</h1>
      <p class="subtitle">Capability Platform — 契约层运行状态</p>
    </div>

    <!-- Health Status -->
    <div class="health-bar">
      <div :class="['health-indicator', health?.initialized ? 'online' : 'offline']">
        {{ health?.initialized ? '🟢 Runtime 在线' : '🔴 Runtime 离线' }}
      </div>
      <div class="health-stats" v-if="health">
        <span>注册能力数: {{ health.registeredCount }}</span>
        <span>最后更新: {{ formatDate(health.timestamp) }}</span>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <p>加载中...</p>
    </div>

    <template v-else>
      <!-- Stats Overview -->
      <div class="stats-grid" v-if="stats">
        <div class="stat-card total">
          <div class="stat-value">{{ stats.totalContracts }}</div>
          <div class="stat-label">注册能力总数</div>
        </div>
        <div class="stat-card active">
          <div class="stat-value">{{ stats.activeContracts }}</div>
          <div class="stat-label">活跃能力</div>
        </div>
        <div class="stat-card deprecated">
          <div class="stat-value">{{ stats.deprecatedContracts }}</div>
          <div class="stat-label">已废弃能力</div>
        </div>
        <div class="stat-card categories">
          <div class="stat-value">{{ stats.categoriesCount }}</div>
          <div class="stat-label">分类数</div>
        </div>
      </div>

      <!-- Categories Distribution -->
      <section class="dashboard-section">
        <h2>分类分布</h2>
        <div v-if="stats?.categories.length" class="category-chart">
          <div
            v-for="cat in stats.categories"
            :key="cat.category"
            class="category-bar-row"
          >
            <span class="category-name">{{ cat.category }}</span>
            <div class="bar-container">
              <div
                class="bar"
                :style="{ width: getBarWidth(cat.count), background: getCategoryColor(cat.category) }"
              ></div>
            </div>
            <span class="category-count">{{ cat.count }}</span>
          </div>
        </div>
        <p v-else class="no-data">暂无数据</p>
      </section>

      <!-- Versions Overview -->
      <section class="dashboard-section">
        <h2>版本概览</h2>
        <div class="version-list">
          <div v-for="contract in contracts" :key="contract.id" class="version-item">
            <span class="version-name">{{ contract.displayName }}</span>
            <span class="version-badge">v{{ contract.version }}</span>
            <span :class="['version-status', contract.status]">
              {{ statusLabel(contract.status) }}
            </span>
          </div>
        </div>
      </section>

      <!-- Deprecated List -->
      <section class="dashboard-section" v-if="deprecatedContracts.length > 0">
        <h2>已废弃能力</h2>
        <div class="deprecated-list">
          <div v-for="contract in deprecatedContracts" :key="contract.id" class="deprecated-item">
            <span class="deprecated-name">{{ contract.displayName }}</span>
            <span class="deprecated-version">v{{ contract.version }}</span>
            <span class="deprecated-date">废弃于: {{ formatDate(contract.updatedAt) }}</span>
          </div>
        </div>
      </section>
    </template>

    <button class="refresh-btn" @click="refresh">🔄 刷新</button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { capabilityService } from '../services/capability.service'
import type { CapabilityContract, CapabilityStats, CapabilityHealth } from '../types/index'

const contracts = ref<CapabilityContract[]>([])
const stats = ref<CapabilityStats | null>(null)
const health = ref<CapabilityHealth | null>(null)
const loading = ref(false)

const deprecatedContracts = computed(() =>
  contracts.value.filter(c => c.status === 'deprecated')
)

onMounted(async () => {
  await refresh()
})

async function refresh() {
  loading.value = true
  try {
    const [contractResult, statsResult, healthResult] = await Promise.all([
      capabilityService.listContracts({ limit: 200 }),
      capabilityService.getStats(),
      capabilityService.getHealth(),
    ])
    contracts.value = contractResult.items
    stats.value = statsResult
    health.value = healthResult
  } catch (err) {
    console.error('[CapabilityDashboard]', err)
  } finally {
    loading.value = false
  }
}

function getBarWidth(count: number): string {
  if (!stats.value || stats.value.totalContracts === 0) return '0%'
  const maxCount = Math.max(...stats.value.categories.map(c => c.count))
  return `${(count / maxCount) * 100}%`
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

function statusLabel(status: string): string {
  const labels: Record<string, string> = { active: '活跃', deprecated: '已废弃', removed: '已移除' }
  return labels[status] || status
}

function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    Generation: '#6366f1', Analysis: '#8b5cf6', Extraction: '#a855f7',
    Transformation: '#d946ef', Publishing: '#ec4899', Reasoning: '#f43f5e',
    Search: '#f97316', Translation: '#eab308', Vision: '#22c55e',
    Audio: '#14b8a6', Video: '#06b6d4', Workflow: '#0ea5e9',
    Knowledge: '#3b82f6', Utility: '#64748b',
  }
  return colors[category] || '#64748b'
}
</script>

<style scoped>
.capability-dashboard {
  padding: 24px;
  max-width: 1000px;
  margin: 0 auto;
}

.dashboard-header h1 {
  margin: 0;
  font-size: 1.8rem;
  color: #f1f5f9;
}

.subtitle {
  color: #94a3b8;
  margin: 4px 0 24px;
}

/* Health Bar */
.health-bar {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 16px;
  background: #1e293b;
  border-radius: 8px;
  border: 1px solid #334155;
  margin-bottom: 24px;
}

.health-indicator {
  font-weight: 600;
  font-size: 0.9rem;
}

.health-indicator.online { color: #86efac; }
.health-indicator.offline { color: #fca5a5; }

.health-stats {
  display: flex;
  gap: 16px;
  color: #94a3b8;
  font-size: 0.8rem;
}

/* Stats Grid */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 32px;
}

.stat-card {
  background: #1e293b;
  border-radius: 10px;
  padding: 20px;
  text-align: center;
  border: 1px solid #334155;
}

.stat-value {
  font-size: 2rem;
  font-weight: 700;
  color: #f1f5f9;
}

.stat-label {
  font-size: 0.85rem;
  color: #94a3b8;
  margin-top: 4px;
}

.stat-card.total { border-left: 3px solid #6366f1; }
.stat-card.active { border-left: 3px solid #22c55e; }
.stat-card.deprecated { border-left: 3px solid #f97316; }
.stat-card.categories { border-left: 3px solid #0ea5e9; }

/* Sections */
.dashboard-section {
  background: #1e293b;
  border-radius: 10px;
  padding: 20px;
  border: 1px solid #334155;
  margin-bottom: 24px;
}

.dashboard-section h2 {
  margin: 0 0 16px;
  font-size: 1.1rem;
  color: #e2e8f0;
}

/* Category Chart */
.category-bar-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}

.category-name {
  width: 120px;
  font-size: 0.85rem;
  color: #94a3b8;
  text-align: right;
}

.bar-container {
  flex: 1;
  height: 20px;
  background: #0f172a;
  border-radius: 4px;
  overflow: hidden;
}

.bar {
  height: 100%;
  border-radius: 4px;
  transition: width 0.3s ease;
  min-width: 4px;
}

.category-count {
  width: 40px;
  font-size: 0.85rem;
  color: #e2e8f0;
  text-align: right;
}

/* Version List */
.version-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px solid #1e293b;
}

.version-item:last-child { border-bottom: none; }

.version-name { flex: 1; color: #e2e8f0; font-size: 0.9rem; }

.version-badge {
  font-family: monospace;
  font-size: 0.8rem;
  color: #6366f1;
  background: #1e1b4b;
  padding: 2px 8px;
  border-radius: 4px;
}

.version-status {
  font-size: 0.8rem;
  padding: 2px 8px;
  border-radius: 4px;
}

.version-status.active { color: #86efac; background: #166534; }
.version-status.deprecated { color: #fdba74; background: #9a3412; }
.version-status.removed { color: #fca5a5; background: #7f1d1d; }

/* Deprecated List */
.deprecated-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid #1e293b;
}

.deprecated-item:last-child { border-bottom: none; }
.deprecated-name { flex: 1; color: #fdba74; }
.deprecated-version { color: #64748b; font-family: monospace; }
.deprecated-date { color: #64748b; font-size: 0.8rem; }

/* Loading */
.loading-state {
  text-align: center;
  padding: 48px;
  color: #94a3b8;
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #334155;
  border-top-color: #6366f1;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: 0 auto 12px;
}

@keyframes spin { to { transform: rotate(360deg); } }

.no-data { color: #64748b; text-align: center; }

.refresh-btn {
  display: block;
  margin: 24px auto 0;
  padding: 10px 24px;
  background: #6366f1;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.9rem;
}

.refresh-btn:hover { background: #5558e6; }
</style>
