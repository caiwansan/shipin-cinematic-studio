<!-- /admin/recruitment/plans.vue — Enterprise Recruitment 套餐管理 -->
<!-- 职责：管理 EnterprisePlan 的 CRUD、上架/下架、排序 -->
<!-- 数据源唯一：EnterprisePlan / EnterpriseSubscription / EnterpriseEntitlement -->
<template>
  <div class="rec-plans-admin">
    <!-- Header -->
    <div class="header-row">
      <div>
        <h1 class="page-title">📦 套餐管理</h1>
        <p class="page-subtitle">Enterprise Recruitment 套餐配置 · 数据源：EnterprisePlan</p>
      </div>
      <div class="header-actions">
        <button class="btn-primary" @click="showCreateModal = true">+ 新增套餐</button>
        <button class="btn-refresh" @click="fetchPlans">🔄 刷新</button>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <span>加载套餐数据中...</span>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="error-state">
      <p>⚠️ {{ error }}</p>
      <button @click="fetchPlans" class="btn-refresh">重试</button>
    </div>

    <!-- Plans Table -->
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
              <input
                v-if="editingId === plan.id"
                v-model.number="editForm.price"
                type="number"
                class="edit-input"
                placeholder="月价（分）"
              />
            </td>
            <td>
              <span class="price">¥{{ ((plan.yearlyPrice || 0) / 100).toFixed(0) }}/年</span>
              <input
                v-if="editingId === plan.id"
                v-model.number="editForm.yearlyPrice"
                type="number"
                class="edit-input"
                placeholder="年价（分）"
              />
            </td>
            <td>
              <span v-if="editingId !== plan.id">{{ plan.maxEmployees }}</span>
              <input
                v-else
                v-model.number="editForm.maxEmployees"
                type="number"
                class="edit-input short"
              />
            </td>
            <td>
              <span v-if="editingId !== plan.id">{{ plan.maxChannels }}</span>
              <input
                v-else
                v-model.number="editForm.maxChannels"
                type="number"
                class="edit-input short"
              />
            </td>
            <td>
              <span v-if="editingId !== plan.id">{{ plan.maxMembers }}</span>
              <input
                v-else
                v-model.number="editForm.maxMembers"
                type="number"
                class="edit-input short"
              />
            </td>
            <td>{{ plan.storageLimit }}GB</td>
            <td>
              <span class="badge">{{ plan._count?.subscriptions || 0 }}</span>
            </td>
            <td>
              <span class="status-badge" :class="plan.enabled ? 'active' : 'inactive'">
                {{ plan.enabled ? '启用' : '停用' }}
              </span>
            </td>
            <td>
              <span v-if="editingId !== plan.id">{{ plan.sortOrder }}</span>
              <input
                v-else
                v-model.number="editForm.sortOrder"
                type="number"
                class="edit-input short"
              />
            </td>
            <td class="actions-cell">
              <template v-if="editingId === plan.id">
                <button class="btn-save" @click="savePlan(plan.id)">保存</button>
                <button class="btn-cancel" @click="cancelEdit">取消</button>
              </template>
              <template v-else>
                <button class="btn-edit" @click="startEdit(plan)">编辑</button>
                <button class="btn-toggle" @click="togglePlan(plan)">
                  {{ plan.enabled ? '停用' : '启用' }}
                </button>
              </template>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Empty State -->
      <div v-if="plans.length === 0" class="empty-state">
        <p>暂无套餐数据</p>
        <p class="empty-hint">点击「新增套餐」创建第一个套餐</p>
      </div>
    </div>

    <!-- Create Modal -->
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
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { getAdminToken } from '~/utils/token-cache'

definePageMeta({ layout: 'admin-aigc' })

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

function cancelEdit() {
  editingId.value = ''
}

async function savePlan(id: string) {
  try {
    const res = await fetch(`/api/admin/recruitment/plans/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getAdminToken()}`,
      },
      body: JSON.stringify(editForm),
    })
    const data = await res.json()
    if (data.success) {
      editingId.value = ''
      fetchPlans()
    } else {
      alert(data.message || '保存失败')
    }
  } catch (e: any) {
    alert(e.message)
  }
}

async function togglePlan(plan: any) {
  try {
    await fetch(`/api/admin/recruitment/plans/${plan.id}/toggle`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${getAdminToken()}` },
    })
    fetchPlans()
  } catch (e: any) {
    alert(e.message)
  }
}

async function createPlan() {
  try {
    const features = createForm.featuresStr
      .split(',')
      .map((s: string) => s.trim())
      .filter(Boolean)
    const res = await fetch('/api/admin/recruitment/plans', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getAdminToken()}`,
      },
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
  } catch (e: any) {
    alert(e.message)
  }
}

function resetCreateForm() {
  Object.assign(createForm, {
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
}
</script>

<style scoped>
.rec-plans-admin {
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

.header-actions {
  display: flex;
  gap: 8px;
}

.btn-primary {
  padding: 8px 20px;
  background: #3b82f6;
  border: none;
  border-radius: 8px;
  color: white;
  cursor: pointer;
  font-size: 13px;
}

.btn-refresh {
  padding: 8px 16px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  font-size: 13px;
}

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

.data-table tr.disabled { opacity: 0.5; }
.data-table tr:hover { background: rgba(255, 255, 255, 0.02); }

.plan-name { font-weight: 600; color: rgba(255, 255, 255, 0.9); }
.plan-id { font-size: 11px; color: rgba(255, 255, 255, 0.3); font-family: monospace; }
.plan-desc { font-size: 11px; color: rgba(255, 255, 255, 0.4); margin-top: 2px; }

.price { font-weight: 500; color: rgba(255, 255, 255, 0.8); }

.edit-input {
  width: 80px;
  padding: 4px 8px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 4px;
  color: #e0e0e0;
  font-size: 13px;
  margin-top: 4px;
}

.edit-input.short { width: 60px; }

.badge {
  display: inline-block;
  padding: 2px 8px;
  background: rgba(59, 130, 246, 0.1);
  color: #60a5fa;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 500;
}

.status-badge {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 500;
}

.status-badge.active { background: rgba(34, 197, 94, 0.1); color: #22c55e; }
.status-badge.inactive { background: rgba(239, 68, 68, 0.1); color: #ef4444; }

.actions-cell { display: flex; gap: 6px; }

.actions-cell button {
  padding: 4px 10px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 11px;
}

.btn-edit { background: rgba(255, 255, 255, 0.1); color: rgba(255, 255, 255, 0.8); }
.btn-toggle { background: rgba(239, 68, 68, 0.15); color: #ef4444; }
.btn-save { background: rgba(34, 197, 94, 0.15); color: #22c55e; }
.btn-cancel { background: rgba(255, 255, 255, 0.1); color: rgba(255, 255, 255, 0.6); }

.empty-hint { font-size: 12px; color: rgba(255, 255, 255, 0.3); }

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
  width: 600px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  max-height: 80vh;
  overflow-y: auto;
}

.modal h3 { margin: 0 0 20px; color: rgba(255, 255, 255, 0.9); }

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.form-group { display: flex; flex-direction: column; }
.form-group.full-width { grid-column: 1 / -1; }

.form-group label {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
  margin-bottom: 4px;
}

.form-group input {
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 8px;
  color: #e0e0e0;
  font-size: 13px;
}

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
</style>
