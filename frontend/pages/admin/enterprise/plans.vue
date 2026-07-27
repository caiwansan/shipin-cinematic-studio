<!-- /admin/enterprise/plans.vue — AI新媒体运营部门套餐管理 -->
<template>
  <div class="plans-admin">
    <h1>AI新媒体运营部门套餐管理</h1>
    <p class="subtitle">配置 AI新媒体运营部门套餐，支持月度/年度定价</p>

    <!-- Loading -->
    <div v-if="loading" class="loading">加载中...</div>

    <!-- Error -->
    <div v-else-if="error" class="error">{{ error }}</div>

    <!-- Plans Table -->
    <div v-else class="plans-container">
      <div class="actions-bar">
        <button class="btn-primary" @click="showCreateModal">+ 新增套餐</button>
      </div>

      <table class="plans-table">
        <thead>
          <tr>
            <th>套餐</th>
            <th>月价</th>
            <th>年价</th>
            <th>AI 员工</th>
            <th>渠道</th>
            <th>成员</th>
            <th>订阅数</th>
            <th>AI员工</th>
            <th>状态</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="plan in plans" :key="plan.id" :class="{ disabled: !plan.enabled }">
            <td>
              <div class="plan-name">{{ plan.displayName }}</div>
              <div class="plan-desc">{{ plan.description }}</div>
            </td>
            <td>
              <div class="price-display">
                <span class="price-main">¥{{ (plan.price / 100).toFixed(0) }}/月</span>
              </div>
              <input
                v-if="editingId === plan.id"
                v-model.number="editForm.price"
                type="number"
                class="price-input"
                placeholder="月价（分）"
                style="margin-top:4px"
              />
            </td>
            <td>
              <div class="price-display">
                <span class="price-main">¥{{ ((plan.yearlyPrice || 0) / 100).toFixed(0) }}/年</span>
                <span v-if="plan.yearlyPrice && plan.price" class="price-discount">
                  省 {{ Math.round(100 - (plan.yearlyPrice / (plan.price * 12) * 100)) }}%
                </span>
              </div>
              <input
                v-if="editingId === plan.id"
                v-model.number="editForm.yearlyPrice"
                type="number"
                class="price-input"
                placeholder="年价（分）"
                style="margin-top:4px"
              />
            </td>
            <td>
              <input
                v-if="editingId === plan.id"
                v-model.number="editForm.maxEmployees"
                type="number"
                class="limit-input"
              />
              <span v-else>{{ plan.maxEmployees }}</span>
            </td>
            <td>
              <input
                v-if="editingId === plan.id"
                v-model.number="editForm.maxChannels"
                type="number"
                class="limit-input"
              />
              <span v-else>{{ plan.maxChannels }}</span>
            </td>
            <td>
              <input
                v-if="editingId === plan.id"
                v-model.number="editForm.maxMembers"
                type="number"
                class="limit-input"
              />
              <span v-else>{{ plan.maxMembers }}</span>
            </td>
            <td>{{ plan._count?.subscriptions || 0 }}</td>
            <td>
              <div class="agent-count" :title="(plan.agentBundle || []).map((a: any) => a.name).join(', ')">
                <span class="agent-num">{{ (plan.agentBundle || []).length }}</span>
                <span class="agent-label">个AI</span>
              </div>
            </td>
            <td>
              <span class="status-badge" :class="plan.enabled ? 'active' : 'inactive'">
                {{ plan.enabled ? '启用' : '停用' }}
              </span>
            </td>
            <td class="actions">
              <template v-if="editingId === plan.id">
                <button class="btn-save" @click="savePlan(plan.id)">保存</button>
                <button class="btn-cancel" @click="cancelEdit">取消</button>
              </template>
              <template v-else>
                <NuxtLink :to="`/admin/enterprise/plans/${plan.id}`" class="btn-config">AI员工包</NuxtLink>
                <button class="btn-edit" @click="startEdit(plan)">编辑</button>
                <button class="btn-toggle" @click="togglePlan(plan)">
                  {{ plan.enabled ? '停用' : '启用' }}
                </button>
              </template>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Create Modal -->
    <div v-if="showModal" class="modal-overlay" @click.self="showModal = false">
      <div class="modal">
        <h3>新增套餐</h3>
        <div class="form-group">
          <label>套餐标识 (name)</label>
          <input v-model="createForm.name" placeholder="e.g., basic, pro, enterprise" />
        </div>
        <div class="form-group">
          <label>显示名称</label>
          <input v-model="createForm.displayName" placeholder="e.g., 专业版" />
        </div>
        <div class="form-group">
          <label>描述</label>
          <input v-model="createForm.description" placeholder="套餐说明" />
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>月度价格（分）</label>
            <input v-model.number="createForm.price" type="number" placeholder="29900" />
          </div>
          <div class="form-group">
            <label>年度价格（分）</label>
            <input v-model.number="createForm.yearlyPrice" type="number" placeholder="299000" />
          </div>
          <div class="form-group">
            <label>年度折扣</label>
            <div class="discount-display">
              <span v-if="createForm.price && createForm.yearlyPrice" class="discount-badge">
                省 {{ Math.round(100 - (createForm.yearlyPrice / (createForm.price * 12) * 100)) }}%
              </span>
              <span v-else class="discount-placeholder">—</span>
            </div>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>AI 员工上限</label>
            <input v-model.number="createForm.maxEmployees" type="number" />
          </div>
          <div class="form-group">
            <label>渠道上限</label>
            <input v-model.number="createForm.maxChannels" type="number" />
          </div>
          <div class="form-group">
            <label>成员上限</label>
            <input v-model.number="createForm.maxMembers" type="number" />
          </div>
        </div>
        <div class="form-group">
          <label>功能特性（逗号分隔）</label>
          <input v-model="createForm.featuresStr" placeholder="AI员工,渠道授权,BYOK" />
        </div>
        <div class="modal-actions">
          <button class="btn-save" @click="createPlan">创建</button>
          <button class="btn-cancel" @click="showModal = false">取消</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, reactive } from 'vue'
import { getAdminToken } from '~/utils/token-cache'

definePageMeta({ layout: 'admin-aigc' })

const loading = ref(true)
const error = ref('')
const plans = ref<any[]>([])
const showModal = ref(false)
const editingId = ref('')

const editForm = reactive({
  price: 0,
  yearlyPrice: 0,
  maxEmployees: 0,
  maxChannels: 0,
  maxMembers: 0,
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
  featuresStr: '',
})

onMounted(() => loadPlans())

async function loadPlans() {
  try {
    const res = await fetch('/api/admin/enterprise/plans', {
      headers: { Authorization: `Bearer ${getAdminToken()}` },
    })
    const data = await res.json()
    if (data.success) plans.value = data.data
    else error.value = data.message
  } catch (e: any) {
    error.value = e.message
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
}

function cancelEdit() {
  editingId.value = ''
}

async function savePlan(id: string) {
  try {
    const res = await fetch(`/api/admin/enterprise/plans/${id}`, {
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
      loadPlans()
    } else {
      alert(data.message)
    }
  } catch (e: any) {
    alert(e.message)
  }
}

async function togglePlan(plan: any) {
  try {
    await fetch(`/api/admin/enterprise/plans/${plan.id}/toggle`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${getAdminToken()}` },
    })
    loadPlans()
  } catch (e: any) {
    alert(e.message)
  }
}

function showCreateModal() {
  showModal.value = true
  Object.assign(createForm, {
    name: '', displayName: '', description: '', price: 0, yearlyPrice: 0,
    maxEmployees: 3, maxChannels: 2, maxMembers: 5, featuresStr: '',
  })
}

async function createPlan() {
  try {
    const features = createForm.featuresStr.split(',').map((s: string) => s.trim()).filter(Boolean)
    const res = await fetch('/api/admin/enterprise/plans', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getAdminToken()}`,
      },
      body: JSON.stringify({ ...createForm, features }),
    })
    const data = await res.json()
    if (data.success) {
      showModal.value = false
      loadPlans()
    } else {
      alert(data.message)
    }
  } catch (e: any) {
    alert(e.message)
  }
}
</script>

<style scoped>
.plans-admin {
  padding: 24px;
  color: #e0e0e0;
  max-width: 1200px;
  margin: 0 auto;
}

h1 { font-size: 24px; margin-bottom: 4px; }
.subtitle { color: #9ca3af; font-size: 14px; margin-bottom: 24px; }
.loading, .error { padding: 40px; text-align: center; color: #9ca3af; }
.error { color: #ef4444; }

.actions-bar { margin-bottom: 16px; }
.btn-primary {
  padding: 8px 20px;
  background: #3b82f6;
  border: none;
  border-radius: 8px;
  color: white;
  cursor: pointer;
}

.plans-table {
  width: 100%;
  border-collapse: collapse;
  background: #1f2937;
  border-radius: 12px;
  overflow: hidden;
}

.plans-table th, .plans-table td {
  padding: 12px 16px;
  text-align: left;
  border-bottom: 1px solid #374151;
  font-size: 14px;
}

.plans-table th {
  background: #111827;
  color: #9ca3af;
  font-weight: 600;
}

.plans-table tr.disabled { opacity: 0.5; }

.plan-name { font-weight: 600; }
.plan-desc { color: #9ca3af; font-size: 12px; }

.price-input, .limit-input {
  width: 80px;
  padding: 4px 8px;
  background: #374151;
  border: 1px solid #4b5563;
  border-radius: 4px;
  color: #e0e0e0;
  font-size: 14px;
}

.price-display { display: flex; flex-direction: column; }
.price-main { font-weight: 500; }
.price-discount { font-size: 11px; color: #22c55e; font-weight: 600; }
.discount-display { padding: 8px 0; }
.discount-badge { font-size: 12px; color: #22c55e; font-weight: 600; background: rgba(34,197,94,0.1); padding: 4px 8px; border-radius: 4px; }
.discount-placeholder { color: #6b7280; font-size: 12px; }

.actions { display: flex; gap: 8px; }
.actions button, .actions .btn-config {
  padding: 4px 12px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
}
.btn-edit { background: #4b5563; color: #e0e0e0; }
.btn-toggle { background: #dc2626; color: white; }
.btn-save { background: #16a34a; color: white; }
.btn-cancel { background: #6b7280; color: white; }
.btn-config { background: #3b82f6; color: white; text-decoration: none; display: inline-block; }
.agent-count { display: flex; align-items: center; gap: 4px; }
.agent-num { font-weight: 600; color: #60a5fa; }
.agent-label { font-size: 11px; color: #6b7280; }

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.modal {
  background: #1f2937;
  border-radius: 16px;
  padding: 32px;
  width: 500px;
  border: 1px solid #374151;
}

.modal h3 { margin-bottom: 20px; }

.form-group { margin-bottom: 16px; }
.form-group label { display: block; font-size: 14px; color: #9ca3af; margin-bottom: 4px; }
.form-group input {
  width: 100%;
  padding: 8px 12px;
  background: #374151;
  border: 1px solid #4b5563;
  border-radius: 8px;
  color: #e0e0e0;
  font-size: 14px;
}

.form-row { display: flex; gap: 12px; }
.form-row .form-group { flex: 1; }

.modal-actions { display: flex; gap: 12px; justify-content: flex-end; margin-top: 24px; }
.modal-actions button { padding: 8px 24px; border: none; border-radius: 8px; cursor: pointer; }
</style>
