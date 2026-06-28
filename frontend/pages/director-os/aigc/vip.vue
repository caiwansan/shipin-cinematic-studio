<template>
  <div class="page-vip">
    <div class="page-header">
      <h2 class="page-title">👑 VIP 套餐管理</h2>
      <p class="page-subtitle">配置会员套餐的权限开关</p>
    </div>

    <!-- 提示 -->
    <div v-if="error" class="msg msg--err">{{ error }}</div>
    <div v-if="success" class="msg msg--ok">{{ success }}</div>

    <!-- 套餐列表 -->
    <div class="plans-grid">
      <div v-for="plan in plans" :key="plan.id" class="plan-card">
        <div class="plan-top">
          <div class="plan-level-wrap">
            <span class="plan-icon">{{ plan.icon || '🎬' }}</span>
            <span class="plan-name">{{ plan.name }}</span>
            <span class="plan-level-tag"
              :style="{ background: (plan.color || '#818cf8') + '22', color: plan.color || '#818cf8' }"
            >{{ plan.level }}</span>
          </div>
          <div class="plan-actions">
            <button class="btn-icon" title="编辑" @click="editPlan(plan)">✏️</button>
            <button class="btn-icon" title="删除" @click="deletePlan(plan)">🗑️</button>
            <button class="btn-icon" :title="plan.enabled ? '禁用' : '启用'" @click="togglePlan(plan)">
              {{ plan.enabled ? '✅' : '⭕' }}
            </button>
          </div>
        </div>

        <div class="plan-price-row">
          <span class="plan-price">¥{{ plan.price }}</span>
          <span class="plan-period">/ {{ plan.months }} 天</span>
          <span v-if="plan.storageLimit" class="plan-storage-tag">🎁 赠送{{ plan.storageLimit >= 1024 ? (plan.storageLimit/1024).toFixed(0) + 'GB' : plan.storageLimit + 'MB' }}</span>
        </div>

        <!-- 两个权限开关 -->
        <div class="plan-features">
          <div class="feature-row">
            <div class="feature-info">
              <span class="feature-icon">🌐</span>
              <span class="feature-label">独立在线大模型 API</span>
              <span class="feature-desc">用户使用自己的 API Key 调用在线大模型</span>
            </div>
            <span class="feature-toggle" :class="plan.onlineApiEnabled ? 'on' : 'off'">
              {{ plan.onlineApiEnabled ? '已启动' : '已关闭' }}
            </span>
          </div>
          <div class="feature-row">
            <div class="feature-info">
              <span class="feature-icon">💻</span>
              <span class="feature-label">本地大模型</span>
              <span class="feature-desc">用户连接本地部署的大模型服务</span>
            </div>
            <span class="feature-toggle" :class="plan.localModelEnabled ? 'on' : 'off'">
              {{ plan.localModelEnabled ? '已启动' : '已关闭' }}
            </span>
          </div>
          <div class="feature-row">
            <div class="feature-info">
              <span class="feature-icon">🔄</span>
              <span class="feature-label">允许续费</span>
              <span class="feature-desc">用户到期后是否可以续费/二次购买</span>
            </div>
            <span class="feature-toggle" :class="plan.renewable !== false ? 'on' : 'off'">
              {{ plan.renewable !== false ? '允许续费' : '已停止续费' }}
            </span>
          </div>
          <div class="feature-row">
            <div class="feature-info">
              <span class="feature-icon">🆕</span>
              <span class="feature-label">仅限新用户首次</span>
              <span class="feature-desc">仅从未购买过任何 VIP 的用户才能购买</span>
            </div>
            <span class="feature-toggle" :class="plan.firstPurchaseOnly ? 'on' : 'off'">
              {{ plan.firstPurchaseOnly ? '首次专享' : '无限制' }}
            </span>
          </div>
        </div>
      </div>

      <!-- 新增卡片 -->
      <div class="plan-card plan-card--add" @click="showAddDialog">
        <div class="add-icon">+</div>
        <div class="add-text">新增套餐</div>
      </div>
    </div>

    <!-- 编辑/新增对话框 -->
    <Transition name="modal-fade">
      <div v-if="showForm" class="dialog-overlay" @click.self="cancelForm">
        <div class="dialog">
          <h3 class="dialog-title">{{ editingPlan ? '编辑套餐' : '新增套餐' }}</h3>
          <div class="dialog-body">
            <!-- 基本信息 -->
            <div class="field-row">
              <div class="field flex-1">
                <label>标识 (level)</label>
                <input v-model="form.level" class="input" placeholder="free/pro/director" :disabled="!!editingPlan" />
              </div>
              <div class="field flex-1">
                <label>名称</label>
                <input v-model="form.name" class="input" placeholder="如 黄金会员" />
              </div>
            </div>
            <div class="field-row">
              <div class="field flex-1">
                <label>价格 (元)</label>
                <input v-model.number="form.price" type="number" step="0.01" class="input" />
              </div>
              <div class="field flex-1">
                <label>天数</label>
                <input v-model.number="form.months" type="number" step="1" min="1" class="input" placeholder="7 / 30 / 90 / 365" />
              </div>
              <div class="field flex-1">
                <label>日价 (元/天，可选)</label>
                <input v-model.number="form.dayPrice" type="number" step="0.01" class="input" placeholder="如 1.5" />
              </div>
              <div class="field flex-1">
                <label>排序</label>
                <input v-model.number="form.sortOrder" type="number" class="input" />
              </div>
            </div>
            <div class="field-row">
              <div class="field flex-1">
                <label>图标 (emoji)</label>
                <input v-model="form.icon" class="input" placeholder="🎬" />
              </div>
              <div class="field flex-1">
                <label>颜色</label>
                <input v-model="form.color" class="input" placeholder="#818cf8" />
              </div>
            </div>

            <!-- 权限开关 -->
            <div class="section-title">权限配置</div>
            <div class="toggle-group">
              <label class="toggle-row">
                <div class="toggle-info">
                  <span class="toggle-label">🌐 独立在线大模型 API</span>
                  <span class="toggle-desc">允许用户使用自己的 API Key 调用在线大模型</span>
                </div>
                <div class="toggle-switch">
                  <input type="checkbox" v-model="form.onlineApiEnabled" />
                  <span class="toggle-slider"></span>
                </div>
              </label>
              <label class="toggle-row">
                <div class="toggle-info">
                  <span class="toggle-label">💻 本地大模型</span>
                  <span class="toggle-desc">允许用户连接本地部署的大模型服务</span>
                </div>
                <div class="toggle-switch">
                  <input type="checkbox" v-model="form.localModelEnabled" />
                  <span class="toggle-slider"></span>
                </div>
              </label>
              <label class="toggle-row">
                <div class="toggle-info">
                  <span class="toggle-label">🔄 允许续费</span>
                  <span class="toggle-desc">用户到期后是否可以续费/二次购买该套餐</span>
                </div>
                <div class="toggle-switch">
                  <input type="checkbox" v-model="form.renewable" />
                  <span class="toggle-slider"></span>
                </div>
              </label>
              <label class="toggle-row">
                <div class="toggle-info">
                  <span class="toggle-label">🆕 仅限新用户首次购买</span>
                  <span class="toggle-desc">开启后，只有从未购买过任何 VIP 的用户才能购买此套餐</span>
                </div>
                <div class="toggle-switch">
                  <input type="checkbox" v-model="form.firstPurchaseOnly" />
                  <span class="toggle-slider"></span>
                </div>
              </label>
            </div>

            <div class="section-title">其他配置</div>
            <div class="field-row">
              <div class="field flex-1">
                <label>储存空间 (MB)</label>
                <input v-model.number="form.storageLimit" type="number" step="1" class="input" placeholder="如 5120 = 5GB" />
              </div>
              <div class="field flex-1">
                <label>赠送积分</label>
                <input v-model.number="form.coins" type="number" class="input" placeholder="0" />
              </div>
            </div>
            <div class="field-row">
              <div class="field flex-1">
                <label>每日配额</label>
                <input v-model.number="form.dailyQuota" type="number" class="input" placeholder="5" />
              </div>
              <div class="field flex-1">
                <label>并发任务</label>
                <input v-model.number="form.concurrentTasks" type="number" class="input" placeholder="1" />
              </div>
            </div>
            <div class="field">
              <label>说明</label>
              <input v-model="form.description" class="input" placeholder="套餐简介" />
            </div>

            <div v-if="formError" class="err-tip">{{ formError }}</div>
          </div>
          <div class="dialog-actions">
            <button class="btn btn-cancel" @click="cancelForm">取消</button>
            <button class="btn btn-save" :disabled="saving" @click="savePlan">{{ saving ? '保存中…' : '保存' }}</button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { getToken, setToken, clearAuth } from '~/utils/token-cache'
definePageMeta({ layout: 'admin-aigc' })
import { ref, reactive, onMounted } from 'vue'

const plans = ref<any[]>([])
const loading = ref(false)
const error = ref('')
const success = ref('')
const saving = ref(false)
const showForm = ref(false)
const editingPlan = ref<any>(null)
const formError = ref('')

const emptyForm = {
  level: '', name: '', price: 0, months: 1, storageLimit: 500, coins: 0,
  dayPrice: 0, renewable: true, firstPurchaseOnly: false,
  dailyQuota: 5, concurrentTasks: 1,
  onlineApiEnabled: false, localModelEnabled: false,
  description: '', icon: '🎬', color: '#818cf8', sortOrder: 0, enabled: true,
}

const form = reactive({ ...emptyForm })

async function fetchPlans() {
  loading.value = true
  error.value = ''
  try {
    const token = getToken()
    const res = await fetch('/api/admin/member-plans', {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    plans.value = Array.isArray(data) ? data : (data.data || [])
  } catch (e: any) {
    error.value = '获取套餐列表失败: ' + e.message
    plans.value = []
  }
  loading.value = false
}

function showAddDialog() {
  editingPlan.value = null
  Object.assign(form, { ...emptyForm })
  formError.value = ''
  showForm.value = true
}

function editPlan(plan: any) {
  editingPlan.value = plan
  form.level = plan.level || ''
  form.name = plan.name || ''
  form.price = plan.price || 0
  form.months = plan.months || 1
  form.dayPrice = plan.dayPrice || 0
  form.renewable = plan.renewable !== false
  form.firstPurchaseOnly = !!plan.firstPurchaseOnly
  form.storageLimit = plan.storageLimit ?? 500
  form.coins = plan.coins ?? 0
  form.dailyQuota = plan.dailyQuota ?? 5
  form.concurrentTasks = plan.concurrentTasks ?? 1
  form.onlineApiEnabled = !!plan.onlineApiEnabled
  form.localModelEnabled = !!plan.localModelEnabled
  form.description = plan.description || ''
  form.icon = plan.icon || '🎬'
  form.color = plan.color || '#818cf8'
  form.sortOrder = plan.sortOrder || 0
  form.enabled = plan.enabled !== false
  formError.value = ''
  showForm.value = true
}

function cancelForm() {
  showForm.value = false
  editingPlan.value = null
}

async function savePlan() {
  if (!form.name) { formError.value = '请输入套餐名称'; return }
  if (!form.level && !editingPlan.value) { formError.value = '请输入套餐标识'; return }
  saving.value = true
  formError.value = ''
  error.value = ''
  success.value = ''

  try {
    const token = getToken()
    if (!token) { formError.value = '请先登录'; saving.value = false; return }

    const body: Record<string, any> = {
      name: form.name, price: form.price, months: form.months,
      dayPrice: form.dayPrice, renewable: form.renewable,
      firstPurchaseOnly: form.firstPurchaseOnly,
      storageLimit: form.storageLimit, coins: form.coins,
      dailyQuota: form.dailyQuota, concurrentTasks: form.concurrentTasks,
      onlineApiEnabled: form.onlineApiEnabled,
      localModelEnabled: form.localModelEnabled,
      description: form.description,
      icon: form.icon, color: form.color, sortOrder: form.sortOrder,
      enabled: form.enabled,
    }
    if (form.level) body.level = form.level

    const url = editingPlan.value
      ? `/api/admin/member-plans/${editingPlan.value.id}`
      : '/api/admin/member-plans'
    const method = editingPlan.value ? 'PUT' : 'POST'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const msg = await res.json().catch(() => ({}))
      throw new Error(msg.error || `HTTP ${res.status}`)
    }

    success.value = editingPlan.value ? '✅ 套餐已更新' : '✅ 套餐已创建'
    setTimeout(() => { success.value = '' }, 3000)
    cancelForm()
    await fetchPlans()
  } catch (e: any) {
    formError.value = e.message || '保存失败'
  }
  saving.value = false
}

async function deletePlan(plan: any) {
  if (!confirm(`确定删除套餐「${plan.name}」？`)) return
  error.value = ''
  success.value = ''
  try {
    const token = getToken()
    const res = await fetch(`/api/admin/member-plans/${plan.id}`, {
      method: 'DELETE',
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    })
    if (!res.ok) throw new Error('删除失败')
    success.value = `✅ 已删除「${plan.name}」`
    setTimeout(() => { success.value = '' }, 3000)
    await fetchPlans()
  } catch (e: any) {
    error.value = e.message || '删除失败'
  }
}

async function togglePlan(plan: any) {
  try {
    const token = getToken()
    const res = await fetch(`/api/admin/member-plans/${plan.id}/toggle`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    })
    if (!res.ok) throw new Error('切换失败')
    await fetchPlans()
  } catch (e: any) {
    error.value = e.message
  }
}

onMounted(fetchPlans)
</script>

<style scoped>
.page-vip {
  padding: 24px;
  max-width: 960px;
  margin: 0 auto;
}
.page-header {
  margin-bottom: 24px;
}
.page-title {
  font-size: 1.3rem;
  font-weight: 700;
  color: #e4e4e7;
  margin: 0 0 4px;
}
.page-subtitle {
  font-size: 0.78rem;
  color: #71717a;
  margin: 0;
}

.msg { padding: 10px 16px; border-radius: 8px; font-size: 0.82rem; margin-bottom: 16px; }
.msg--err { background: rgba(239,68,68,0.08); color: #ef4444; border: 1px solid rgba(239,68,68,0.15); }
.msg--ok { background: rgba(34,197,94,0.08); color: #22c55e; border: 1px solid rgba(34,197,94,0.15); }

.plans-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 16px;
}

.plan-card {
  background: rgba(255,255,255,0.02);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 14px;
  padding: 18px;
  transition: all 0.2s;
}
.plan-card:hover { border-color: rgba(255,255,255,0.12); }

.plan-card--add {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 200px;
  cursor: pointer;
  border: 1px dashed rgba(255,255,255,0.15);
}
.plan-card--add:hover { border-color: #3b82f6; background: rgba(59,130,246,0.04); }
.add-icon { font-size: 2rem; color: #71717a; margin-bottom: 8px; }
.add-text { font-size: 0.85rem; color: #71717a; }

.plan-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
}
.plan-level-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
}
.plan-icon { font-size: 1.2rem; }
.plan-name { font-size: 0.95rem; font-weight: 700; color: #e4e4e7; }
.plan-level-tag {
  font-size: 0.6rem;
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: 600;
  text-transform: uppercase;
}

.plan-actions {
  display: flex;
  gap: 4px;
}
.btn-icon {
  background: transparent;
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 6px;
  padding: 4px 6px;
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.2s;
  color: #71717a;
}
.btn-icon:hover { border-color: #3b82f6; background: rgba(59,130,246,0.06); }

.plan-price-row {
  margin-bottom: 14px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.plan-price {
  font-size: 1.3rem;
  font-weight: 700;
  color: #e4e4e7;
}
.plan-period {
  font-size: 0.7rem;
  color: #71717a;
  font-weight: 400;
}
.plan-storage-tag {
  font-size: 0.65rem;
  background: rgba(34,197,94,0.1);
  color: #22c55e;
  border: 1px solid rgba(34,197,94,0.2);
  padding: 2px 8px;
  border-radius: 6px;
  font-weight: 600;
}


/* 权限列表 */
.plan-features {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.feature-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: rgba(255,255,255,0.02);
  border: 1px solid rgba(255,255,255,0.05);
  border-radius: 10px;
  padding: 10px 14px;
}
.feature-info {
  display: flex;
  align-items: center;
  gap: 8px;
}
.feature-icon { font-size: 1rem; }
.feature-label {
  font-size: 0.78rem;
  font-weight: 600;
  color: #e4e4e7;
}
.feature-desc {
  font-size: 0.65rem;
  color: #71717a;
  display: none;
}
.feature-row:hover .feature-desc { display: block; }

.feature-toggle {
  font-size: 0.7rem;
  font-weight: 600;
  padding: 3px 10px;
  border-radius: 6px;
  white-space: nowrap;
}
.feature-toggle.on {
  background: rgba(34,197,94,0.1);
  color: #22c55e;
  border: 1px solid rgba(34,197,94,0.2);
}
.feature-toggle.off {
  background: rgba(239,68,68,0.08);
  color: #ef4444;
  border: 1px solid rgba(239,68,68,0.15);
}

/* 对话框 */
.dialog-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
.dialog {
  background: #1a1a2e;
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 16px;
  width: 520px;
  max-width: 92vw;
  max-height: 85vh;
  overflow-y: auto;
  box-shadow: 0 20px 60px rgba(0,0,0,0.5);
}
.dialog-title {
  padding: 20px 24px 0;
  font-size: 1rem;
  font-weight: 700;
  color: #e4e4e7;
  margin: 0 0 12px;
}
.dialog-body { padding: 0 24px 16px; display: flex; flex-direction: column; gap: 12px; }
.dialog-actions {
  padding: 14px 24px;
  border-top: 1px solid rgba(255,255,255,0.06);
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.section-title {
  font-size: 0.7rem;
  font-weight: 600;
  color: #a1a1aa;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  padding: 8px 0 0;
  border-top: 1px solid rgba(255,255,255,0.04);
  margin-top: 4px;
}

.field { display: flex; flex-direction: column; gap: 4px; }
.field label { font-size: 0.68rem; color: #a1a1aa; text-transform: uppercase; letter-spacing: 0.03em; font-weight: 600; }
.field-row { display: flex; gap: 12px; }
.flex-1 { flex: 1; }

.input {
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 0.8rem;
  color: #e4e4e7;
  outline: none;
  width: 100%;
  box-sizing: border-box;
  transition: border-color 0.2s;
}
.input:focus { border-color: #3b82f6; }

/* Toggle 开关组 */
.toggle-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: rgba(255,255,255,0.02);
  border: 1px solid rgba(255,255,255,0.05);
  border-radius: 10px;
  padding: 12px 14px;
  cursor: pointer;
  transition: all 0.2s;
}
.toggle-row:hover { border-color: rgba(59,130,246,0.2); }

.toggle-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.toggle-label { font-size: 0.82rem; font-weight: 600; color: #e4e4e7; }
.toggle-desc { font-size: 0.68rem; color: #71717a; }

.toggle-switch {
  position: relative;
  width: 42px;
  height: 24px;
  display: inline-block;
}
.toggle-switch input { display: none; }
.toggle-slider {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(255,255,255,0.12);
  border-radius: 12px;
  transition: all 0.3s;
}
.toggle-slider::before {
  content: '';
  position: absolute;
  top: 2px; left: 2px;
  width: 20px; height: 20px;
  background: #52525b;
  border-radius: 50%;
  transition: all 0.3s;
}
.toggle-switch input:checked + .toggle-slider { background: rgba(59,130,246,0.4); }
.toggle-switch input:checked + .toggle-slider::before {
  transform: translateX(18px);
  background: #3b82f6;
}

.err-tip { color: #ef4444; font-size: 0.75rem; }

.btn {
  padding: 9px 20px;
  border-radius: 8px;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  border: none;
  transition: all 0.2s;
}
.btn-cancel { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); color: #a1a1aa; }
.btn-cancel:hover { background: rgba(255,255,255,0.08); }
.btn-save { background: linear-gradient(135deg,#3b82f6,#2563eb); color: #fff; }
.btn-save:hover:not(:disabled) { transform: translateY(-1px); }
.btn-save:disabled { opacity: 0.5; cursor: not-allowed; }

.modal-fade-enter-active, .modal-fade-leave-active { transition: opacity 0.2s ease; }
.modal-fade-enter-from, .modal-fade-leave-to { opacity: 0; }
</style>
