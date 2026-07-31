<!-- /admin/recruitment/plans.vue — 套餐订阅管理（Sprint-ADMIN-IA-RECRUITMENT-CLEANUP-01 T02） -->
<!-- 职责：商业商品管理。Tab1 套餐 CRUD（EnterprisePlan）+ Tab2 订阅生命周期（EnterpriseSubscription） -->
<!-- 数据源唯一：EnterprisePlan / EnterpriseSubscription / EnterpriseEntitlement。不管理模型/Agent 运行/任务记录 -->
<template>
  <div class="rec-plans-admin">
    <!-- Header -->
    <div class="header-row">
      <div>
        <h1 class="page-title">📦 套餐订阅管理</h1>
        <p class="page-subtitle">招聘 AI 服务商业商品 · 数据源：EnterprisePlan / EnterpriseSubscription</p>
      </div>
      <div class="header-actions">
        <button v-if="activeTab === 'plans'" class="btn-primary" @click="showCreateModal = true">+ 新增套餐</button>
        <button class="btn-refresh" @click="activeTab === 'plans' ? fetchPlans() : (fetchSubscriptions(), fetchStats())">🔄 刷新</button>
      </div>
    </div>

    <!-- Tabs -->
    <div class="tabs-row">
      <button class="tab-btn" :class="{ active: activeTab === 'plans' }" @click="activeTab = 'plans'">📦 套餐管理</button>
      <button class="tab-btn" :class="{ active: activeTab === 'subscriptions' }" @click="activeTab = 'subscriptions'">📋 订阅管理</button>
    </div>

    <!-- ═══════════ Tab 1：套餐管理 ═══════════ -->
    <template v-if="activeTab === 'plans'">
      <div v-if="loading" class="loading-state">
        <div class="spinner"></div>
        <span>加载套餐数据中...</span>
      </div>
      <div v-else-if="error" class="error-state">
        <p>⚠️ {{ error }}</p>
        <button @click="fetchPlans" class="btn-refresh">重试</button>
      </div>
      <div v-else class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th style="width:180px">套餐</th>
              <th>月价</th>
              <th>年价</th>
              <th>AI员工</th>
              <th>渠道</th>
              <th>成员</th>
              <th>存储</th>
              <th>订阅数</th>
              <th>状态</th>
              <th>排序</th>
              <th style="width:200px">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="plan in plans" :key="plan.id" :class="{ disabled: !plan.enabled }">
              <td>
                <div class="plan-name">{{ plan.displayName }}</div>
                <div class="plan-id">{{ plan.name }}</div>
                <div class="plan-desc">{{ plan.description || '-' }}</div>
              </td>
              <td>
                <span class="price">¥{{ (plan.price / 100).toFixed(0) }}/月</span>
                <input v-if="editingId === plan.id" v-model.number="editForm.price" type="number" class="edit-input" placeholder="月价（分）" />
              </td>
              <td>
                <span class="price">¥{{ ((plan.yearlyPrice || 0) / 100).toFixed(0) }}/年</span>
                <input v-if="editingId === plan.id" v-model.number="editForm.yearlyPrice" type="number" class="edit-input" placeholder="年价（分）" />
              </td>
              <td>
                <span v-if="editingId !== plan.id">{{ plan.maxEmployees }}</span>
                <input v-else v-model.number="editForm.maxEmployees" type="number" class="edit-input short" />
              </td>
              <td>
                <span v-if="editingId !== plan.id">{{ plan.maxChannels }}</span>
                <input v-else v-model.number="editForm.maxChannels" type="number" class="edit-input short" />
              </td>
              <td>
                <span v-if="editingId !== plan.id">{{ plan.maxMembers }}</span>
                <input v-else v-model.number="editForm.maxMembers" type="number" class="edit-input short" />
              </td>
              <td>{{ plan.storageLimit }}GB</td>
              <td><span class="badge">{{ plan._count?.subscriptions || 0 }}</span></td>
              <td>
                <span class="status-badge" :class="plan.enabled ? 'active' : 'inactive'">
                  {{ plan.enabled ? '启用' : '停用' }}
                </span>
              </td>
              <td>
                <span v-if="editingId !== plan.id">{{ plan.sortOrder }}</span>
                <input v-else v-model.number="editForm.sortOrder" type="number" class="edit-input short" />
              </td>
              <td class="actions-cell">
                <template v-if="editingId === plan.id">
                  <button class="btn-save" @click="savePlan(plan.id)">保存</button>
                  <button class="btn-cancel" @click="cancelEdit">取消</button>
                </template>
                <template v-else>
                  <button class="btn-edit" @click="startEdit(plan)">编辑</button>
                  <button class="btn-toggle" @click="togglePlan(plan)">{{ plan.enabled ? '停用' : '启用' }}</button>
                  <button class="btn-danger" @click="deletePlan(plan)">删除</button>
                </template>
              </td>
            </tr>
          </tbody>
        </table>
        <div v-if="plans.length === 0" class="empty-state">
          <p>暂无套餐数据</p>
          <p class="empty-hint">点击「新增套餐」创建第一个套餐</p>
        </div>
      </div>
    </template>

    <!-- ═══════════ Tab 2：订阅管理 ═══════════ -->
    <template v-else>
      <!-- Stats -->
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
      <div class="filter-row">
        <select v-model="statusFilter" @change="fetchSubscriptions" class="filter-select">
          <option value="">全部状态</option>
          <option value="active">活跃</option>
          <option value="paused">已暂停</option>
          <option value="cancelled">已取消</option>
          <option value="expired">已过期</option>
        </select>
        <input v-model="searchQuery" type="text" placeholder="搜索企业名称..." class="filter-input" @keyup.enter="fetchSubscriptions" />
      </div>

      <div v-if="loading" class="loading-state">
        <div class="spinner"></div>
        <span>加载订阅数据中...</span>
      </div>
      <div v-else-if="error" class="error-state">
        <p>⚠️ {{ error }}</p>
        <button @click="fetchSubscriptions" class="btn-refresh">重试</button>
      </div>
      <div v-else class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>企业</th>
              <th>套餐</th>
              <th>周期</th>
              <th>金额</th>
              <th>状态</th>
              <th>到期时间</th>
              <th style="width:230px">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="sub in subscriptions" :key="sub.id">
              <td>
                <div class="plan-name">{{ sub.organization?.name || sub.organizationId }}</div>
                <div class="plan-desc">{{ daysLeftText(sub.expireAt) }}</div>
              </td>
              <td class="plan-id">{{ sub.snapshotName || '-' }}</td>
              <td>{{ sub.snapshotCycle === 'yearly' ? '年度' : '月度' }}</td>
              <td>¥{{ ((sub.snapshotPrice || 0) / 100).toFixed(0) }}</td>
              <td>
                <span class="status-badge" :class="statusClass(sub.status)">{{ statusLabel(sub.status) }}</span>
              </td>
              <td>{{ formatDate(sub.expireAt) }}</td>
              <td class="actions-cell">
                <template v-if="sub.status === 'active'">
                  <button class="btn-pause" @click="handlePause(sub)">暂停</button>
                  <button class="btn-plan" @click="openChangePlan(sub)">变更套餐</button>
                </template>
                <template v-else-if="sub.status === 'paused'">
                  <button class="btn-resume" @click="handleResume(sub)">恢复</button>
                  <button class="btn-plan" @click="openChangePlan(sub)">变更套餐</button>
                </template>
                <button v-if="sub.status === 'active' || sub.status === 'paused'" class="btn-cancel-sm" @click="handleCancel(sub)">取消</button>
                <button v-if="sub.status === 'cancelled' || sub.status === 'expired'" class="btn-resume" @click="handleResume(sub)">重新开通</button>
                <button class="btn-edit" @click="viewDetail(sub)">详情</button>
              </td>
            </tr>
          </tbody>
        </table>
        <div v-if="subscriptions.length === 0" class="empty-state">
          <p>暂无订阅数据</p>
        </div>
      </div>
    </template>

    <!-- Create Plan Modal -->
    <div v-if="showCreateModal" class="modal-overlay" @click.self="showCreateModal = false">
      <div class="modal">
        <h3>新增套餐</h3>
        <div class="form-grid">
          <div class="form-group">
            <label>套餐标识 (name)</label>
            <input v-model="createForm.name" placeholder="e.g., trial, professional, enterprise" />
          </div>
          <div class="form-group">
            <label>显示名称</label>
            <input v-model="createForm.displayName" placeholder="e.g., 专业版" />
          </div>
          <div class="form-group full-width">
            <label>描述</label>
            <input v-model="createForm.description" placeholder="套餐说明" />
          </div>
          <div class="form-group">
            <label>月度价格（分）</label>
            <input v-model.number="createForm.price" type="number" placeholder="29900" />
          </div>
          <div class="form-group">
            <label>年度价格（分）</label>
            <input v-model.number="createForm.yearlyPrice" type="number" placeholder="299000" />
          </div>
          <div class="form-group">
            <label>排序</label>
            <input v-model.number="createForm.sortOrder" type="number" placeholder="0" />
          </div>
          <div class="form-group">
            <label>AI 员工上限</label>
            <input v-model.number="createForm.maxEmployees" type="number" placeholder="3" />
          </div>
          <div class="form-group">
            <label>渠道上限</label>
            <input v-model.number="createForm.maxChannels" type="number" placeholder="2" />
          </div>
          <div class="form-group">
            <label>成员上限</label>
            <input v-model.number="createForm.maxMembers" type="number" placeholder="10" />
          </div>
          <div class="form-group">
            <label>存储上限 (GB)</label>
            <input v-model.number="createForm.storageLimit" type="number" placeholder="5" />
          </div>
          <div class="form-group full-width">
            <label>功能特性（逗号分隔）</label>
            <input v-model="createForm.featuresStr" placeholder="AI员工,渠道授权,BYOK" />
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn-save" @click="createPlan">创建</button>
          <button class="btn-cancel" @click="showCreateModal = false">取消</button>
        </div>
      </div>
    </div>

    <!-- Change Plan Modal -->
    <div v-if="showChangePlanModal" class="modal-overlay" @click.self="showChangePlanModal = false">
      <div class="modal">
        <h3>变更套餐 — {{ changePlanTarget?.organization?.name || changePlanTarget?.organizationId }}</h3>
        <p class="change-hint">当前：{{ changePlanTarget?.snapshotName || '-' }}（¥{{ ((changePlanTarget?.snapshotPrice || 0) / 100).toFixed(0) }}）</p>
        <div class="form-group">
          <label>目标套餐</label>
          <select v-model="changePlanId" class="filter-select" style="width:100%">
            <option v-for="p in plans" :key="p.id" :value="p.id">{{ p.displayName }}（¥{{ (p.price / 100).toFixed(0) }}/月）</option>
          </select>
        </div>
        <div class="modal-actions">
          <button class="btn-save" @click="doChangePlan">确认变更</button>
          <button class="btn-cancel" @click="showChangePlanModal = false">取消</button>
        </div>
      </div>
    </div>

    <!-- Subscription Detail Modal -->
    <div v-if="showDetailModal && currentDetail" class="modal-overlay" @click.self="showDetailModal = false">
      <div class="modal">
        <h3>订阅详情</h3>
        <div class="detail-grid">
          <div class="detail-item"><span class="detail-label">企业</span><span class="detail-value">{{ currentDetail.organization?.name || currentDetail.organizationId }}</span></div>
          <div class="detail-item"><span class="detail-label">套餐</span><span class="detail-value">{{ currentDetail.snapshotName || '-' }}</span></div>
          <div class="detail-item"><span class="detail-label">状态</span><span class="detail-value">{{ statusLabel(currentDetail.status) }}</span></div>
          <div class="detail-item"><span class="detail-label">金额</span><span class="detail-value">¥{{ ((currentDetail.snapshotPrice || 0) / 100).toFixed(0) }}</span></div>
          <div class="detail-item"><span class="detail-label">开始</span><span class="detail-value">{{ formatDate(currentDetail.startAt) }}</span></div>
          <div class="detail-item"><span class="detail-label">到期</span><span class="detail-value">{{ formatDate(currentDetail.expireAt) }}</span></div>
          <div class="detail-item"><span class="detail-label">自动续费</span><span class="detail-value">{{ currentDetail.autoRenew ? '是' : '否' }}</span></div>
          <div class="detail-item"><span class="detail-label">AI员工上限</span><span class="detail-value">{{ currentDetail.snapshotMaxEmployees ?? '-' }}</span></div>
        </div>
        <div class="modal-actions">
          <button class="btn-cancel" @click="showDetailModal = false">关闭</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, watch } from 'vue'
import { getAdminToken } from '~/utils/token-cache'

definePageMeta({ layout: 'admin-aigc' })

// Sprint-ADMIN-IA-RECRUITMENT-CLEANUP-01：切换 Tab 时懒加载订阅数据
const activeTab = ref<'plans' | 'subscriptions'>('plans')
watch(activeTab, (t) => {
  if (t === 'subscriptions') {
    if (subscriptions.value.length === 0) {
      fetchSubscriptions()
      fetchStats()
    }
  }
})

// ── Plans ──
const loading = ref(true)
const error = ref('')
const plans = ref<any[]>([])
const showCreateModal = ref(false)
const editingId = ref('')

const editForm = reactive({
  price: 0,
  yearlyPrice: 0,
  maxEmployees: 0,
  maxChannels: 0,
  maxMembers: 0,
  sortOrder: 0,
})

const createForm = reactive({
  name: '',
  displayName: '',
  description: '',
  price: 0,
  yearlyPrice: 0,
  maxEmployees: 3,
  maxChannels: 2,
  maxMembers: 5,
  storageLimit: 5,
  sortOrder: 0,
  featuresStr: '',
})

// ── Subscriptions ──
const subscriptions = ref<any[]>([])
const stats = ref<any>({})
const statusFilter = ref('')
const searchQuery = ref('')
const showDetailModal = ref(false)
const currentDetail = ref<any>(null)
const showChangePlanModal = ref(false)
const changePlanTarget = ref<any>(null)
const changePlanId = ref('')

onMounted(() => fetchPlans())

async function fetchPlans() {
  loading.value = true
  error.value = ''
  try {
    const res = await fetch('/api/admin/recruitment/plans', {
      headers: { Authorization: `Bearer ${getAdminToken()}` },
    })
    const data = await res.json()
    if (data.success) {
      plans.value = data.data
    } else {
      error.value = data.message || '加载失败'
    }
  } catch (e: any) {
    error.value = e.message || '网络错误'
  } finally {
    loading.value = false
  }
}

function startEdit(plan: any) {
  editingId.value = plan.id
  editForm.price = plan.price
  editForm.yearlyPrice = plan.yearlyPrice || 0
  editForm.maxEmployees = plan.maxEmployees
  editForm.maxChannels = plan.maxChannels
  editForm.maxMembers = plan.maxMembers
  editForm.sortOrder = plan.sortOrder
}

function cancelEdit() { editingId.value = '' }

async function savePlan(id: string) {
  try {
    const res = await fetch(`/api/admin/recruitment/plans/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getAdminToken()}` },
      body: JSON.stringify(editForm),
    })
    const data = await res.json()
    if (data.success) {
      editingId.value = ''
      fetchPlans()
    } else {
      alert(data.message || '保存失败')
    }
  } catch (e: any) { alert(e.message) }
}

async function togglePlan(plan: any) {
  try {
    await fetch(`/api/admin/recruitment/plans/${plan.id}/toggle`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${getAdminToken()}` },
    })
    fetchPlans()
  } catch (e: any) { alert(e.message) }
}

async function deletePlan(plan: any) {
  if (!confirm(`⚠️ 确定删除套餐「${plan.displayName || plan.name}」？\n\n无历史订阅的套餐会被永久删除；有历史订阅的套餐需先停用。`)) return
  try {
    const res = await fetch(`/api/admin/recruitment/plans/${plan.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${getAdminToken()}` },
    })
    const data = await res.json()
    if (data.success) {
      fetchPlans()
    } else {
      alert(data.message || '删除失败')
    }
  } catch (e: any) { alert(e.message) }
}

async function createPlan() {
  try {
    const features = createForm.featuresStr.split(',').map((s: string) => s.trim()).filter(Boolean)
    const res = await fetch('/api/admin/recruitment/plans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getAdminToken()}` },
      body: JSON.stringify({ ...createForm, features }),
    })
    const data = await res.json()
    if (data.success) {
      showCreateModal.value = false
      resetCreateForm()
      fetchPlans()
    } else {
      alert(data.message || '创建失败')
    }
  } catch (e: any) { alert(e.message) }
}

function resetCreateForm() {
  Object.assign(createForm, {
    name: '', displayName: '', description: '', price: 0, yearlyPrice: 0,
    maxEmployees: 3, maxChannels: 2, maxMembers: 5, storageLimit: 5, sortOrder: 0, featuresStr: '',
  })
}

// ── Subscription logic ──
async function fetchSubscriptions() {
  loading.value = true
  error.value = ''
  try {
    const token = getAdminToken()
    const params = new URLSearchParams()
    if (statusFilter.value) params.set('status', statusFilter.value)
    if (searchQuery.value) params.set('search', searchQuery.value)
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
  } catch { /* 静默 */ }
}

function statusLabel(status: string): string {
  const map: any = { active: '活跃', paused: '已暂停', cancelled: '已取消', expired: '已过期', pending: '待支付' }
  return map[status] || status
}

function statusClass(status: string): string {
  const map: any = { active: 'active', paused: 'paused', cancelled: 'cancelled', expired: 'expired' }
  return map[status] || 'inactive'
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
  } catch (e: any) { alert(e.message) }
}

async function openChangePlan(sub: any) {
  changePlanTarget.value = sub
  changePlanId.value = sub.planId || ''
  showChangePlanModal.value = true
  if (plans.value.length === 0) await fetchPlans()
}

async function doChangePlan() {
  if (!changePlanId.value) return alert('请选择目标套餐')
  try {
    const res = await fetch(`/api/admin/enterprise/subscriptions/${changePlanTarget.value.id}/change-plan`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getAdminToken()}` },
      body: JSON.stringify({ planId: changePlanId.value, reason: '管理员变更套餐' }),
    })
    const data = await res.json()
    if (data.success) {
      showChangePlanModal.value = false
      fetchSubscriptions()
      fetchStats()
    } else {
      alert(data.message || '变更失败')
    }
  } catch (e: any) { alert(e.message) }
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
  } catch (e: any) { alert(e.message) }
}
</script>

<style scoped>
.rec-plans-admin { padding: 24px; max-width: 1400px; margin: 0 auto; }
.header-row { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; }
.page-title { font-size: 22px; font-weight: 700; color: rgba(255, 255, 255, 0.9); margin: 0; }
.page-subtitle { font-size: 13px; color: rgba(255, 255, 255, 0.4); margin: 4px 0 0; }
.header-actions { display: flex; gap: 8px; }

.tabs-row { display: flex; gap: 8px; margin-bottom: 20px; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 12px; }
.tab-btn {
  padding: 8px 20px; background: transparent; border: 1px solid rgba(255,255,255,0.1);
  border-radius: 8px; color: rgba(255,255,255,0.6); cursor: pointer; font-size: 13px; transition: all 0.2s;
}
.tab-btn.active { background: #3b82f6; color: white; border-color: #3b82f6; }

.btn-primary { padding: 8px 20px; background: #3b82f6; border: none; border-radius: 8px; color: white; cursor: pointer; font-size: 13px; }
.btn-refresh { padding: 8px 16px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; color: rgba(255,255,255,0.7); cursor: pointer; font-size: 13px; }

.loading-state, .error-state, .empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 48px; color: rgba(255,255,255,0.5); font-size: 14px; }
.error-state { color: #ef4444; }
.spinner { width: 24px; height: 24px; border: 2px solid rgba(255,255,255,0.1); border-top-color: #3b82f6; border-radius: 50%; animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

.table-container { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; overflow: hidden; }
.data-table { width: 100%; border-collapse: collapse; }
.data-table th, .data-table td { padding: 12px 14px; text-align: left; border-bottom: 1px solid rgba(255,255,255,0.06); font-size: 13px; }
.data-table th { background: rgba(0,0,0,0.2); color: rgba(255,255,255,0.5); font-weight: 600; }
.data-table tr.disabled { opacity: 0.5; }
.data-table tr:hover { background: rgba(255,255,255,0.02); }

.plan-name { font-weight: 600; color: rgba(255,255,255,0.9); }
.plan-id { font-size: 11px; color: rgba(255,255,255,0.4); font-family: monospace; }
.plan-desc { font-size: 11px; color: rgba(255,255,255,0.4); margin-top: 2px; }
.price { font-weight: 500; color: rgba(255,255,255,0.8); }

.edit-input { width: 80px; padding: 4px 8px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.15); border-radius: 4px; color: #e0e0e0; font-size: 13px; margin-top: 4px; }
.edit-input.short { width: 60px; }

.badge { display: inline-block; padding: 2px 8px; background: rgba(59,130,246,0.1); color: #60a5fa; border-radius: 10px; font-size: 12px; font-weight: 500; }
.status-badge { display: inline-block; padding: 2px 10px; border-radius: 10px; font-size: 11px; font-weight: 500; }
.status-badge.active { background: rgba(34,197,94,0.1); color: #22c55e; }
.status-badge.paused { background: rgba(245,158,11,0.1); color: #f59e0b; }
.status-badge.cancelled { background: rgba(239,68,68,0.1); color: #ef4444; }
.status-badge.expired { background: rgba(148,163,184,0.1); color: #94a3b8; }
.status-badge.inactive { background: rgba(239,68,68,0.1); color: #ef4444; }

.actions-cell { display: flex; gap: 6px; flex-wrap: wrap; }
.actions-cell button { padding: 4px 10px; border: none; border-radius: 6px; cursor: pointer; font-size: 11px; }
.btn-edit { background: rgba(255,255,255,0.1); color: rgba(255,255,255,0.8); }
.btn-toggle { background: rgba(239,68,68,0.15); color: #ef4444; }
.btn-danger { background: rgba(239,68,68,0.18); color: #f87171; border: 1px solid rgba(239,68,68,0.3); }
.btn-save { background: rgba(34,197,94,0.15); color: #22c55e; }
.btn-cancel { background: rgba(255,255,255,0.1); color: rgba(255,255,255,0.6); }
.btn-pause { background: rgba(245,158,11,0.15); color: #f59e0b; }
.btn-resume { background: rgba(34,197,94,0.15); color: #22c55e; }
.btn-cancel-sm { background: rgba(239,68,68,0.15); color: #ef4444; }
.btn-plan { background: rgba(59,130,246,0.15); color: #60a5fa; }

.empty-hint { font-size: 12px; color: rgba(255,255,255,0.3); }

.stats-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; margin-bottom: 16px; }
.stat-card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 16px; }
.stat-value { font-size: 24px; font-weight: 700; color: rgba(255,255,255,0.9); }
.stat-label { font-size: 12px; color: rgba(255,255,255,0.4); margin-top: 2px; }
.text-green { color: #22c55e !important; }
.text-yellow { color: #f59e0b !important; }
.text-red { color: #ef4444 !important; }
.text-gray { color: #94a3b8 !important; }

.filter-row { display: flex; gap: 12px; margin-bottom: 16px; }
.filter-select { padding: 8px 12px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.15); border-radius: 8px; color: #e0e0e0; font-size: 13px; }
.filter-input { padding: 8px 12px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.15); border-radius: 8px; color: #e0e0e0; font-size: 13px; width: 260px; }

.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 100; }
.modal { background: #1a1f35; border-radius: 16px; padding: 32px; width: 600px; border: 1px solid rgba(255,255,255,0.1); max-height: 80vh; overflow-y: auto; }
.modal h3 { margin: 0 0 20px; color: rgba(255,255,255,0.9); }
.change-hint { font-size: 12px; color: rgba(255,255,255,0.5); margin: 0 0 16px; }
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.form-group { display: flex; flex-direction: column; }
.form-group.full-width { grid-column: 1 / -1; }
.form-group label { font-size: 12px; color: rgba(255,255,255,0.5); margin-bottom: 4px; }
.form-group input { padding: 8px 12px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.15); border-radius: 8px; color: #e0e0e0; font-size: 13px; }
.modal-actions { display: flex; gap: 12px; justify-content: flex-end; margin-top: 24px; }
.modal-actions button { padding: 8px 24px; border: none; border-radius: 8px; cursor: pointer; font-size: 13px; }

.detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.detail-item { display: flex; flex-direction: column; gap: 4px; }
.detail-label { font-size: 11px; color: rgba(255,255,255,0.4); }
.detail-value { font-size: 13px; color: rgba(255,255,255,0.85); }
</style>
