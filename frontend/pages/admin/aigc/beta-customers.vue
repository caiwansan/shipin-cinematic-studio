<!-- /admin/beta-customers.vue — Beta 客户追踪页 -->
<template>
  <div class="beta-customers">
    <h1>Beta 客户追踪</h1>
    <p class="subtitle">追踪首批 Beta 企业的使用情况和价值实现</p>

    <!-- Stats -->
    <div class="stats-row">
      <div class="stat-card">
        <span class="stat-value">{{ stats.totalBeta }}</span>
        <span class="stat-label">Beta 企业</span>
      </div>
      <div class="stat-card">
        <span class="stat-value">{{ stats.activeBeta }}</span>
        <span class="stat-label">活跃企业</span>
      </div>
      <div class="stat-card">
        <span class="stat-value">{{ stats.avgTTFV }}</span>
        <span class="stat-label">平均 TTFV</span>
      </div>
      <div class="stat-card">
        <span class="stat-value">{{ stats.retentionRate }}%</span>
        <span class="stat-label">7日留存</span>
      </div>
    </div>

    <!-- Beta Customer Table -->
    <div class="table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>企业名称</th>
            <th>负责人</th>
            <th>套餐</th>
            <th>创建时间</th>
            <th>活跃员工</th>
            <th>首次价值</th>
            <th>状态</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="customer in betaCustomers" :key="customer.id">
            <td>
              <div class="org-name">{{ customer.name }}</div>
              <div class="org-industry">{{ customer.industry }}</div>
            </td>
            <td>{{ customer.owner }}</td>
            <td>
              <span class="plan-badge">{{ customer.plan }}</span>
            </td>
            <td>{{ formatDate(customer.createdAt) }}</td>
            <td>
              <span class="employee-count" :class="{ active: customer.activeEmployees > 0 }">
                {{ customer.activeEmployees }}
              </span>
            </td>
            <td>
              <span v-if="customer.firstValueAt" class="ttfv-value">
                {{ formatDuration(customer.firstValueAt) }}
              </span>
              <span v-else class="pending">进行中</span>
            </td>
            <td>
              <span class="status-badge" :class="customer.status">
                {{ statusLabel(customer.status) }}
              </span>
            </td>
            <td>
              <button class="action-btn" @click="handleViewDetail(customer.id)">详情</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Empty State -->
    <div v-if="betaCustomers.length === 0" class="empty-state">
      <p>暂无 Beta 企业数据</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getAdminToken } from '~/utils/token-cache'

definePageMeta({ layout: 'admin-aigc' })

const stats = ref({
  totalBeta: 0,
  activeBeta: 0,
  avgTTFV: '-',
  retentionRate: 0,
})

const betaCustomers = ref<any[]>([])

onMounted(async () => {
  await loadBetaCustomers()
})

async function loadBetaCustomers() {
  try {
    const token = getAdminToken()
    const res = await fetch('/api/admin/enterprises?status=beta&pageSize=50', {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    })
    const data = await res.json()
    if (data.code === 0) {
      betaCustomers.value = data.data.list.map((org: any) => ({
        id: org.id,
        name: org.name,
        industry: org.industry || '未设置',
        owner: '负责人',
        plan: org.plan,
        createdAt: org.createdAt,
        activeEmployees: org.aiEmployeeCount,
        firstValueAt: org.lastActiveAt,
        status: org.planStatus === 'active' ? 'active' : 'inactive',
      }))

      // Calculate stats
      stats.value.totalBeta = data.data.pagination.total
      stats.value.activeBeta = betaCustomers.value.filter((c: any) => c.status === 'active').length
    }
  } catch (e) {
    console.error('Failed to load beta customers:', e)
  }
}

function formatDate(date: string): string {
  if (!date) return '-'
  return new Date(date).toLocaleDateString('zh-CN')
}

function formatDuration(date: string): string {
  if (!date) return '-'
  const diff = Date.now() - new Date(date).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 60) return `${minutes} 分钟`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} 小时`
  return `${Math.floor(hours / 24)} 天`
}

function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    active: '活跃',
    inactive: '不活跃',
    expired: '已过期',
  }
  return labels[status] || status
}

function handleViewDetail(id: string) {
  window.location.href = `/admin/aigc/enterprises/${id}`
}
</script>

<style scoped>
.beta-customers {
  padding: 24px;
  color: #e0e0e0;
}

h1 {
  font-size: 24px;
  font-weight: bold;
  margin-bottom: 4px;
}

.subtitle {
  color: #9ca3af;
  margin-bottom: 24px;
}

.stats-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 24px;
}

.stat-card {
  background: #1f2937;
  border: 1px solid #374151;
  border-radius: 12px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.stat-value {
  font-size: 28px;
  font-weight: bold;
  color: #60a5fa;
}

.stat-label {
  font-size: 13px;
  color: #9ca3af;
}

.table-container {
  background: #1f2937;
  border: 1px solid #374151;
  border-radius: 12px;
  overflow: hidden;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
}

.data-table th {
  text-align: left;
  padding: 12px 16px;
  font-size: 13px;
  color: #9ca3af;
  border-bottom: 1px solid #374151;
}

.data-table td {
  padding: 12px 16px;
  border-bottom: 1px solid #374151;
  font-size: 14px;
}

.data-table tr:last-child td {
  border-bottom: none;
}

.org-name {
  font-weight: 500;
}

.org-industry {
  font-size: 12px;
  color: #6b7280;
}

.plan-badge {
  padding: 2px 8px;
  background: rgba(96, 165, 250, 0.1);
  border-radius: 4px;
  font-size: 12px;
  color: #60a5fa;
}

.employee-count {
  color: #6b7280;
}

.employee-count.active {
  color: #22c55e;
  font-weight: bold;
}

.ttfv-value {
  color: #86efac;
}

.pending {
  color: #f59e0b;
}

.status-badge {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
}

.status-badge.active {
  background: rgba(34, 197, 94, 0.1);
  color: #86efac;
}

.status-badge.inactive {
  background: rgba(107, 114, 128, 0.1);
  color: #9ca3af;
}

.status-badge.expired {
  background: rgba(239, 68, 68, 0.1);
  color: #f87171;
}

.action-btn {
  padding: 4px 12px;
  background: transparent;
  border: 1px solid #4b5563;
  border-radius: 4px;
  color: #d1d5db;
  font-size: 12px;
  cursor: pointer;
}

.action-btn:hover {
  border-color: #60a5fa;
  color: #60a5fa;
}

.empty-state {
  text-align: center;
  padding: 40px;
  color: #6b7280;
}
</style>
