<!-- ⛔ DEPRECATED · 已退出后台导航（SPRINT-ADMIN-IA-RECRUITMENT-CLEANUP-01）· 页面保留仅供 URL 直链/归档，业务数据归企业招聘工作台，运营数据归数据罗盘 -->
<!-- /admin/recruitment/subscriptions.vue — Enterprise Recruitment 订阅管理 -->
<!-- 职责：订阅列表（企业/套餐/金额/周期/状态/AI Employee数量/Usage） -->
<!-- 数据源唯一：EnterpriseSubscription / EnterprisePlan / EnterpriseEntitlement -->
<template>
  <div class="rec-subs-admin">
    <!-- Header -->
    <div class="header-row">
      <div>
        <h1 class="page-title">📋 订阅管理</h1>
        <p class="page-subtitle">Enterprise Recruitment 订阅生命周期 · 数据源：EnterpriseSubscription</p>
      </div>
      <div class="header-actions">
        <button class="btn-refresh" @click="fetchSubscriptions">🔄 刷新</button>
      </div>
    </div>

    <!-- Stats Cards -->
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-value">{{ stats.total || 0 }}</div>
        <div class="stat-label">总订阅</div>
      </div>
      <div class="stat-card">
        <div class="stat-value text-green">{{ stats.active || 0 }}</div>
        <div class="stat-label">活跃</div>
      </div>
      <div class="stat-card">
        <div class="stat-value text-yellow">{{ stats.paused || 0 }}</div>
        <div class="stat-label">已暂停</div>
      </div>
      <div class="stat-card">
        <div class="stat-value text-red">{{ stats.cancelled || 0 }}</div>
        <div class="stat-label">已取消</div>
      </div>
      <div class="stat-card">
        <div class="stat-value text-gray">{{ stats.expired || 0 }}</div>
        <div class="stat-label">已过期</div>
      </div>
    </div>

    <!-- Filters -->
    <div class="filters-row">
      <select v-model="statusFilter" @change="fetchSubscriptions" class="filter-select">
        <option value="">全部状态</option>
        <option value="active">活跃</option>
        <option value="paused">已暂停</option>
        <option value="cancelled">已取消</option>
        <option value="expired">已过期</option>
      </select>
      <input
        v-model="searchQuery"
        @keyup.enter="fetchSubscriptions"
        type="text"
        placeholder="搜索企业名称..."
        class="filter-input"
      />
    </div>

    <!-- Loading -->
    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <span>加载订阅数据中...</span>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="error-state">
      <p>⚠️ {{ error }}</p>
      <button @click="fetchSubscriptions" class="btn-refresh">重试</button>
    </div>

    <!-- Subscriptions Table -->
    <div v-else class="table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>企业</th>
            <th>套餐</th>
            <th>周期</th>
            <th>金额</th>
            <th>状态</th>
            <th>AI员工数</th>
            <th>成员数</th>
            <th>月用量</th>
            <th>到期时间</th>
            <th style="width:220px">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="sub in subscriptions" :key="sub.id">
            <td>
              <div class="org-name">{{ sub.organization?.name || sub.organizationId }}</div>
              <div class="org-id">{{ sub.organizationId }}</div>
            </td>
            <td>
              <div class="plan-name">{{ sub.snapshotName || sub.plan?.displayName || '-' }}</div>
              <div class="plan-id">{{ sub.planId }}</div>
            </td>
            <td>
              <span class="cycle-badge" :class="sub.snapshotCycle">
                {{ sub.snapshotCycle === 'yearly' ? '年度' : '月度' }}
              </span>
            </td>
            <td>
              <span class="price">¥{{ ((sub.snapshotPrice || 0) / 100).toFixed(0) }}</span>
            </td>
            <td>
              <span class="status-badge" :class="sub.status">
                {{ statusLabel(sub.status) }}
              </span>
            </td>
            <td>
              <span class="count-badge">{{ sub._count?.agentInstances || 0 }}</span>
            </td>
            <td>
              <span class="count-badge">{{ sub.organization?._count?.members || 0 }}</span>
            </td>
            <td>
              <span class="usage-value">¥{{ ((sub._count?.usageThisMonth || 0) / 100).toFixed(0) }}</span>
            </td>
            <td>
              <div class="expire-date">{{ formatDate(sub.expireAt) }}</div>
              <div class="days-left" :class="daysLeftClass(sub.expireAt)">
                {{ daysLeftText(sub.expireAt) }}
              </div>
            </td>
            <td class="actions-cell">
              <button v-if="sub.status === 'active'" class="btn-action pause" @click="handlePause(sub)">
                暂停
              </button>
              <button v-if="sub.status === 'paused'" class="btn-action resume" @click="handleResume(sub)">
                恢复
              </button>
              <button v-if="sub.status !== 'cancelled'" class="btn-action cancel" @click="handleCancel(sub)">
                取消
              </button>
              <button class="btn-action detail" @click="viewDetail(sub)">详情</button>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Empty State -->
      <div v-if="subscriptions.length === 0" class="empty-state">
        <p>暂无订阅数据</p>
      </div>
    </div>

    <!-- Detail Modal -->
    <div v-if="showDetailModal" class="modal-overlay" @click.self="showDetailModal = false">
      <div class="modal">
        <h3>订阅详情</h3>
        <div v-if="currentDetail" class="detail-grid">
          <div class="detail-item">
            <label>企业</label>
            <span>{{ currentDetail.organization?.name }}</span>
          </div>
          <div class="detail-item">
            <label>组织ID</label>
            <span class="mono">{{ currentDetail.organizationId }}</span>
          </div>
          <div class="detail-item">
            <label>套餐</label>
            <span>{{ currentDetail.plan?.displayName }}</span>
          </div>
          <div class="detail-item">
            <label>状态</label>
            <span class="status-badge" :class="currentDetail.status">{{ statusLabel(currentDetail.status) }}</span>
          </div>
          <div class="detail-item">
            <label>月价</label>
            <span>¥{{ ((currentDetail.snapshotPrice || 0) / 100).toFixed(0) }}</span>
          </div>
          <div class="detail-item">
            <label>周期</label>
            <span>{{ currentDetail.snapshotCycle === 'yearly' ? '年度' : '月度' }}</span>
          </div>
          <div class="detail-item">
            <label>开始时间</label>
            <span>{{ formatDate(currentDetail.startAt) }}</span>
          </div>
          <div class="detail-item">
            <label>到期时间</label>
            <span>{{ formatDate(currentDetail.expireAt) }}</span>
          </div>
          <div class="detail-item">
            <label>AI员工上限</label>
            <span>{{ currentDetail.snapshotMaxEmployees }}</span>
          </div>
          <div class="detail-item">
            <label>成员上限</label>
            <span>{{ currentDetail.snapshotMaxMembers }}</span>
          </div>
          <div class="detail-item">
            <label>渠道上限</label>
            <span>{{ currentDetail.snapshotMaxChannels }}</span>
          </div>
          <div class="detail-item">
            <label>自动续费</label>
            <span>{{ currentDetail.autoRenew ? '是' : '否' }}</span>
          </div>
          <div class="detail-item full-width" v-if="currentDetail.entitlement">
            <label>Entitlement 状态</label>
            <span>{{ currentDetail.entitlement.status }}</span>
          </div>
          <div class="detail-item full-width" v-if="currentDetail.entitlement">
            <label>Entitlement 额度</label>
            <span>
              Agents: {{ currentDetail.entitlement.maxAgents }},
              Members: {{ currentDetail.entitlement.maxMembers }},
              Storage: {{ currentDetail.entitlement.storageLimit }}GB
            </span>
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn-cancel" @click="showDetailModal = false">关闭</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getAdminToken } from '~/utils/token-cache'

definePageMeta({ layout: 'admin-aigc' })

const loading = ref(true)
const error = ref('')
const subscriptions = ref<any[]>([])
const stats = ref<any>({})
const statusFilter = ref('')
const searchQuery = ref('')
const showDetailModal = ref(false)
const currentDetail = ref<any>(null)

onMounted(() => {
  fetchSubscriptions()
  fetchStats()
})

async function fetchSubscriptions() {
  loading.value = true
  error.value = ''
  try {
    const token = getAdminToken()
    const params = new URLSearchParams()
    if (statusFilter.value) params.set('status', statusFilter.value)
    params.set('page', '1')
    params.set('limit', '50')

    const res = await fetch(`/api/admin/recruitment/subscriptions?${params}`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    })
    const data = await res.json()
    if (data.success) {
      subscriptions.value = data.data || []
    } else {
      error.value = data.message || '加载失败'
    }
  } catch (err: any) {
    error.value = err.message || '网络错误'
  } finally {
    loading.value = false
  }
}

async function fetchStats() {
  try {
    const token = getAdminToken()
    const res = await fetch('/api/admin/recruitment/subscriptions?limit=100', {
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await res.json()
    if (data.success) {
      const all = data.data || []
      stats.value = {
        total: all.length,
        active: all.filter((s: any) => s.status === 'active').length,
        paused: all.filter((s: any) => s.status === 'paused').length,
        cancelled: all.filter((s: any) => s.status === 'cancelled').length,
        expired: all.filter((s: any) => s.status === 'expired').length,
      }
    }
  } catch {
    // 静默
  }
}

function statusLabel(status: string): string {
  const map: any = {
    active: '活跃',
    paused: '已暂停',
    cancelled: '已取消',
    expired: '已过期',
    pending: '待支付',
  }
  return map[status] || status
}

function formatDate(date: string | null): string {
  if (!date) return '-'
  return new Date(date).toLocaleDateString('zh-CN')
}

function daysLeftText(expireAt: string): string {
  if (!expireAt) return ''
  const days = Math.ceil((new Date(expireAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  if (days < 0) return `已过期 ${Math.abs(days)} 天`
  if (days === 0) return '今天到期'
  return `${days} 天后到期`
}

function daysLeftClass(expireAt: string): string {
  if (!expireAt) return ''
  const days = Math.ceil((new Date(expireAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  if (days < 0) return 'expired'
  if (days <= 7) return 'urgent'
  if (days <= 30) return 'warning'
  return 'normal'
}

async function handlePause(sub: any) {
  if (!confirm(`确定暂停「${sub.organization?.name}」的订阅？`)) return
  await updateStatus(sub.id, 'paused')
}

async function handleResume(sub: any) {
  if (!confirm(`确定恢复「${sub.organization?.name}」的订阅？`)) return
  await updateStatus(sub.id, 'active')
}

async function handleCancel(sub: any) {
  if (!confirm(`⚠️ 取消「${sub.organization?.name}」的订阅？此操作不可撤销。`)) return
  await updateStatus(sub.id, 'cancelled')
}

async function updateStatus(id: string, status: string) {
  try {
    const token = getAdminToken()
    const res = await fetch(`/api/admin/recruitment/subscriptions/${id}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, reason: '管理员操作' }),
    })
    const data = await res.json()
    if (data.success) {
      fetchSubscriptions()
      fetchStats()
    } else {
      alert(data.message || '操作失败')
    }
  } catch (e: any) {
    alert(e.message)
  }
}

async function viewDetail(sub: any) {
  try {
    const token = getAdminToken()
    const res = await fetch(`/api/admin/recruitment/subscriptions/${sub.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await res.json()
    if (data.success) {
      currentDetail.value = data.data
      showDetailModal.value = true
    }
  } catch (e: any) {
    alert(e.message)
  }
}
</script>

<style scoped>
.rec-subs-admin {
  padding: 24px;
  max-width: 1400px;
  margin: 0 auto;
}

.header-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 24px;
}

.page-title {
  font-size: 22px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.9);
  margin: 0;
}

.page-subtitle {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.4);
  margin: 4px 0 0;
}

.header-actions { display: flex; gap: 8px; }

.btn-refresh {
  padding: 8px 16px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  font-size: 13px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 12px;
  margin-bottom: 20px;
}

.stat-card {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  padding: 16px;
  text-align: center;
}

.stat-value { font-size: 24px; font-weight: 700; color: rgba(255, 255, 255, 0.9); }
.stat-label { font-size: 12px; color: rgba(255, 255, 255, 0.4); margin-top: 4px; }

.text-green { color: #22c55e !important; }
.text-yellow { color: #eab308 !important; }
.text-red { color: #ef4444 !important; }
.text-gray { color: #9ca3af !important; }

.filters-row {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}

.filter-select, .filter-input {
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: rgba(255, 255, 255, 0.8);
  font-size: 13px;
}

.filter-input { flex: 1; max-width: 300px; }

.loading-state, .error-state, .empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 48px;
  color: rgba(255, 255, 255, 0.5);
  font-size: 14px;
}

.error-state { color: #ef4444; }

.spinner {
  width: 24px;
  height: 24px;
  border: 2px solid rgba(255, 255, 255, 0.1);
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

.table-container {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  overflow: hidden;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
}

.data-table th, .data-table td {
  padding: 12px 14px;
  text-align: left;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  font-size: 13px;
}

.data-table th {
  background: rgba(0, 0, 0, 0.2);
  color: rgba(255, 255, 255, 0.5);
  font-weight: 600;
}

.data-table tr:hover { background: rgba(255, 255, 255, 0.02); }

.org-name { font-weight: 600; color: rgba(255, 255, 255, 0.9); }
.org-id { font-size: 11px; color: rgba(255, 255, 255, 0.3); font-family: monospace; }

.plan-name { font-weight: 500; color: rgba(255, 255, 255, 0.8); }
.plan-id { font-size: 11px; color: rgba(255, 255, 255, 0.3); font-family: monospace; }

.cycle-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 500;
}

.cycle-badge.monthly { background: rgba(59, 130, 246, 0.1); color: #60a5fa; }
.cycle-badge.yearly { background: rgba(168, 85, 247, 0.1); color: #c084fc; }

.price { font-weight: 500; color: rgba(255, 255, 255, 0.8); }

.status-badge {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 500;
}

.status-badge.active { background: rgba(34, 197, 94, 0.1); color: #22c55e; }
.status-badge.paused { background: rgba(234, 179, 8, 0.1); color: #eab308; }
.status-badge.cancelled { background: rgba(239, 68, 68, 0.1); color: #ef4444; }
.status-badge.expired { background: rgba(156, 163, 175, 0.1); color: #9ca3af; }

.count-badge {
  display: inline-block;
  padding: 2px 8px;
  background: rgba(59, 130, 246, 0.1);
  color: #60a5fa;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 500;
}

.usage-value { font-size: 12px; color: rgba(255, 255, 255, 0.6); }

.expire-date { font-size: 12px; color: rgba(255, 255, 255, 0.7); }
.days-left { font-size: 11px; margin-top: 2px; }
.days-left.expired { color: #ef4444; }
.days-left.urgent { color: #ef4444; }
.days-left.warning { color: #eab308; }
.days-left.normal { color: rgba(255, 255, 255, 0.4); }

.actions-cell { display: flex; gap: 6px; flex-wrap: wrap; }

.actions-cell button {
  padding: 4px 10px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 11px;
}

.btn-action.pause { background: rgba(234, 179, 8, 0.15); color: #eab308; }
.btn-action.resume { background: rgba(34, 197, 94, 0.15); color: #22c55e; }
.btn-action.cancel { background: rgba(239, 68, 68, 0.15); color: #ef4444; }
.btn-action.detail { background: rgba(59, 130, 246, 0.15); color: #60a5fa; }

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.modal {
  background: #1a1f35;
  border-radius: 16px;
  padding: 32px;
  width: 500px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  max-height: 80vh;
  overflow-y: auto;
}

.modal h3 { margin: 0 0 20px; color: rgba(255, 255, 255, 0.9); }

.detail-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.detail-item { display: flex; flex-direction: column; }
.detail-item.full-width { grid-column: 1 / -1; }

.detail-item label {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
  margin-bottom: 4px;
}

.detail-item span {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.8);
}

.detail-item span.mono { font-family: monospace; font-size: 11px; }

.modal-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin-top: 24px;
}

.modal-actions button {
  padding: 8px 24px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
}

.btn-cancel { background: rgba(255, 255, 255, 0.1); color: rgba(255, 255, 255, 0.6); }
</style>
