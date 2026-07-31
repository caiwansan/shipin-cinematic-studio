<template>
  <div class="media-department">
    <KunlunNav :is-logged-in="isLoggedIn" @show-login="goLogin" @show-register="goRegister" />

    <main class="main-content">
      <!-- 顶部导航 -->
      <div class="sub-nav">
        <NuxtLink to="/media-department" class="sub-nav-back">← 返回首页</NuxtLink>
        <h1 class="sub-nav-title">AI 工作区</h1>
      </div>

      <!-- 未登录 -->
      <div v-if="!isLoggedIn" class="empty-state">
        <p>请先登录</p>
        <button class="btn btn-primary" @click="goLogin">登录</button>
      </div>

      <!-- 未创建企业 -->
      <div v-else-if="!hasOrganization" class="empty-state">
        <p>请先创建企业</p>
        <NuxtLink to="/media-department/settings" class="btn btn-primary">创建企业</NuxtLink>
      </div>

      <!-- 工作区 -->
      <div v-else class="workspace">
        <!-- AI 员工列表（真实数据：AgentProfile + AgentInstance） -->
        <div class="workspace-section">
          <h2 class="section-subtitle">AI 员工（{{ employees.length }}）</h2>
          <div v-if="loadingAgents" class="loading-tip">加载中…</div>
          <div v-else-if="loadError" class="load-error">
            {{ loadError }}
            <button class="btn btn-sm btn-outline" @click="fetchEmployees">重试</button>
          </div>
          <div v-else class="employee-list">
            <div v-for="emp in employees" :key="emp.id" class="employee-row">
              <span class="employee-icon">{{ agentIcon(emp.type) }}</span>
              <div class="employee-details">
                <span class="employee-name">{{ emp.name }}</span>
                <span class="employee-role">{{ emp.role || emp.type }}</span>
              </div>
              <span class="employee-status" :class="emp.status">{{ statusText(emp.status) }}</span>
              <button
                v-if="emp.status === 'active' || emp.status === 'running'"
                class="btn btn-sm btn-outline"
                :disabled="emp.operating"
                @click="pauseEmployee(emp)"
              >{{ emp.operating ? '处理中…' : '暂停' }}</button>
              <button
                v-else
                class="btn btn-sm btn-outline"
                :disabled="emp.operating"
                @click="resumeEmployee(emp)"
              >{{ emp.operating ? '处理中…' : '恢复' }}</button>
            </div>
            <div v-if="employees.length === 0" class="no-agents">
              <p>暂无 AI 员工，点击下方按钮创建第一个</p>
            </div>
          </div>
          <div class="workspace-actions">
            <button class="btn btn-primary btn-sm" @click="openCreateDialog">+ 创建 AI 员工</button>
          </div>
        </div>
      </div>
    </main>

    <!-- 创建 AI 员工弹窗（真实 API：POST /media-department/employees） -->
    <div v-if="showCreate" class="modal-overlay" @click.self="showCreate = false">
      <div class="modal-content">
        <h3 class="modal-title">创建 AI 员工</h3>
        <div class="form-group">
          <label>名称</label>
          <input v-model="createForm.name" class="form-input" placeholder="如：热点分析师小镜" />
        </div>
        <div class="form-group">
          <label>岗位类型</label>
          <select v-model="createForm.agentType" class="form-input">
            <option v-for="t in agentTypes" :key="t.value" :value="t.value">{{ t.label }}</option>
          </select>
        </div>
        <p v-if="createError" class="create-error">{{ createError }}</p>
        <div class="modal-actions">
          <button class="btn btn-outline btn-sm" @click="showCreate = false">取消</button>
          <button class="btn btn-primary btn-sm" :disabled="creating" @click="doCreate">{{ creating ? '创建中…' : '创建' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { getAuthToken } from '~/utils/auth/token'
import { ref, computed, onMounted } from 'vue'
import KunlunNav from '~/components/kunlun/business/KunlunNav.vue'
import { KunlunMediaApi } from '~/composables/enterprise/useMediaApi'

const isLoggedIn = ref(false)
const organizationName = ref('')
const hasOrganization = computed(() => !!organizationName.value)

// ─── AI 员工（真实数据：/api/enterprise/media-department/employees） ───
const employees = ref<any[]>([])
const loadingAgents = ref(false)
const loadError = ref('')

// ─── 创建弹窗 ───
const showCreate = ref(false)
const creating = ref(false)
const createError = ref('')
const createForm = ref({ name: '', agentType: 'hotspot_analyst' })
const agentTypes = [
  { value: 'hotspot_analyst', label: '热点分析师 📡' },
  { value: 'content_creator', label: '内容创作 AI ✍️' },
  { value: 'content_reviewer', label: '内容审核 🔍' },
  { value: 'data_analyst', label: '数据分析 📊' },
  { value: 'sales', label: '销售顾问 💼' },
  { value: 'support', label: '客服 AI 🎧' },
  { value: 'director', label: 'AI 运营总监 👔' },
]

function getToken(): string {
  try { return getAuthToken() || '' } catch { return '' }
}

function goLogin() { window.location.href = '/?login=1' }
function goRegister() { window.location.href = '/?register=1' }

function agentIcon(type: string): string {
  const map: Record<string, string> = {
    director: '👔', hotspot_analyst: '📡', content_creator: '✍️',
    content_reviewer: '🔍', sales: '💼', support: '🎧', data_analyst: '📊',
  }
  return map[type] || '🤖'
}

function statusText(status: string): string {
  const s = (status || '').toLowerCase()
  if (s === 'active' || s === 'running') return '运行中'
  if (s === 'paused') return '已暂停'
  if (s === 'stopped' || s === 'inactive') return '已停止'
  return '待命'
}

async function fetchEmployees() {
  loadingAgents.value = true
  loadError.value = ''
  try {
    const result = await KunlunMediaApi.getEmployees()
    if (result.error) {
      loadError.value = `加载失败：${result.error}`
      employees.value = []
    } else {
      employees.value = (result.data || []).map((emp: any) => ({
        id: emp.id,
        name: emp.name || 'AI 员工',
        role: emp.role || '',
        type: emp.agentType || '',
        status: (emp.runtimeStatus || emp.status || 'inactive').toLowerCase(),
        operating: false,
      }))
    }
  } catch (e: any) {
    loadError.value = `加载失败：${e.message || '网络错误'}`
  } finally {
    loadingAgents.value = false
  }
}

async function setAgentStatus(emp: any, action: 'pause' | 'resume') {
  emp.operating = true
  try {
    const token = getToken()
    const res = await fetch(`/api/enterprise/agent-profiles/${emp.id}/${action}`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (res.ok) {
      emp.status = action === 'pause' ? 'paused' : 'active'
    } else {
      const d = await res.json().catch(() => ({}))
      alert(`${action === 'pause' ? '暂停' : '恢复'}失败：${d.message || d.error || '请重试'}`)
    }
  } catch (e: any) {
    alert(`${action === 'pause' ? '暂停' : '恢复'}失败：${e.message || '网络错误'}`)
  } finally {
    emp.operating = false
  }
}

function pauseEmployee(emp: any) { setAgentStatus(emp, 'pause') }
function resumeEmployee(emp: any) { setAgentStatus(emp, 'resume') }

function openCreateDialog() {
  createForm.value = { name: '', agentType: 'hotspot_analyst' }
  createError.value = ''
  showCreate.value = true
}

async function doCreate() {
  if (!createForm.value.name.trim()) {
    createError.value = '请填写名称'
    return
  }
  creating.value = true
  createError.value = ''
  try {
    const token = getToken()
    const res = await fetch('/api/enterprise/media-department/employees', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({
        name: createForm.value.name.trim(),
        role: agentTypes.find(t => t.value === createForm.value.agentType)?.label || createForm.value.agentType,
        agentType: createForm.value.agentType,
      }),
    })
    const d = await res.json().catch(() => ({}))
    if (res.ok) {
      showCreate.value = false
      await fetchEmployees()
    } else {
      createError.value = d.message || d.error || `创建失败（HTTP ${res.status}）`
    }
  } catch (e: any) {
    createError.value = `创建失败：${e.message || '网络错误'}`
  } finally {
    creating.value = false
  }
}

onMounted(async () => {
  const token = getToken()
  if (!token) return
  isLoggedIn.value = true
  try {
    const ob = await KunlunMediaApi.getOnboardingStatus()
    const data = ob.data as any
    if (data && data.hasOrganization) {
      organizationName.value = data.organizationName || '我的企业'
      try { localStorage.setItem('organizationId', data.organizationId) } catch {}
      fetchEmployees()
    }
  } catch (e) {
    console.warn('[Workspace] Onboarding fetch failed:', e)
  }
})
</script>

<style scoped>
.media-department {
  min-height: 100vh;
  background: #08131F;
  color: #F8F6F1;
}

.main-content {
  max-width: 900px;
  margin: 0 auto;
  padding: 100px 24px 60px;
}

.emergency-stop-btn {
  position: fixed;
  top: 80px;
  right: 24px;
  z-index: 200;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: rgba(239, 68, 68, 0.15);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 8px;
  color: #EF4444;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.emergency-stop-btn:hover {
  background: rgba(239, 68, 68, 0.25);
}

.emergency-stop-btn.emergency-active {
  background: rgba(239, 68, 68, 0.3);
  border-color: #EF4444;
  animation: pulse-red 2s infinite;
}

@keyframes pulse-red {
  0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
  50% { box-shadow: 0 0 12px 4px rgba(239, 68, 68, 0.2); }
}

.sub-nav {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 32px;
}

.sub-nav-back {
  font-size: 0.85rem;
  color: rgba(248, 246, 241, 0.5);
  text-decoration: none;
}

.sub-nav-back:hover {
  color: #C9A86C;
}

.sub-nav-title {
  font-size: 1.3rem;
  font-weight: 600;
  margin: 0;
}

.empty-state {
  text-align: center;
  padding: 80px 20px;
  color: rgba(248, 246, 241, 0.5);
}

.section-subtitle {
  font-size: 1rem;
  font-weight: 600;
  color: rgba(248, 246, 241, 0.7);
  margin-bottom: 16px;
}

.employee-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.employee-row {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 14px 20px;
  background: rgba(248, 246, 241, 0.03);
  border: 1px solid rgba(248, 246, 241, 0.06);
  border-radius: 12px;
}

.employee-icon {
  font-size: 1.5rem;
  flex-shrink: 0;
}

.employee-details {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
}

.employee-name {
  font-size: 0.9rem;
  font-weight: 500;
}

.employee-role {
  font-size: 0.75rem;
  color: rgba(248, 246, 241, 0.4);
}

.employee-status {
  font-size: 0.75rem;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 6px;
}

.employee-status.active {
  background: rgba(34, 197, 94, 0.15);
  color: #22C55E;
}

.employee-status.idle {
  background: rgba(248, 246, 241, 0.05);
  color: rgba(248, 246, 241, 0.4);
}

.employee-status.paused {
  background: rgba(234, 179, 8, 0.15);
  color: #EAB308;
}

.employee-status.stopped,
.employee-status.inactive {
  background: rgba(239, 68, 68, 0.12);
  color: rgba(239, 68, 68, 0.8);
}

.loading-tip {
  padding: 24px 0;
  color: rgba(248, 246, 241, 0.4);
  font-size: 0.85rem;
}

.load-error {
  padding: 16px;
  background: rgba(239, 68, 68, 0.08);
  border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: 10px;
  color: rgba(239, 68, 68, 0.9);
  font-size: 0.85rem;
  display: flex;
  align-items: center;
  gap: 12px;
}

.no-agents {
  padding: 20px 0;
  color: rgba(248, 246, 241, 0.4);
  font-size: 0.85rem;
}

.modal-title {
  font-size: 1.1rem;
  margin-bottom: 20px;
  color: #F8F6F1;
}

.form-group {
  text-align: left;
  margin-bottom: 14px;
}

.form-group label {
  display: block;
  font-size: 0.8rem;
  color: rgba(248, 246, 241, 0.5);
  margin-bottom: 6px;
}

.form-input {
  width: 100%;
  box-sizing: border-box;
  padding: 10px 12px;
  background: rgba(248, 246, 241, 0.05);
  border: 1px solid rgba(248, 246, 241, 0.12);
  border-radius: 8px;
  color: #F8F6F1;
  font-size: 0.9rem;
  font-family: inherit;
}

.form-input:focus {
  outline: none;
  border-color: rgba(201, 168, 108, 0.5);
}

.create-error {
  margin-top: 10px;
  color: rgba(239, 68, 68, 0.9);
  font-size: 0.8rem;
  text-align: left;
}

.modal-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin-top: 20px;
}

.workspace-actions {
  margin-top: 16px;
}

.task-shortcuts {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
}

.task-btn {
  padding: 16px;
  background: rgba(248, 246, 241, 0.03);
  border: 1px solid rgba(248, 246, 241, 0.06);
  border-radius: 12px;
  color: #F8F6F1;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.3s ease;
  font-family: inherit;
}

.task-btn:hover:not(:disabled) {
  background: rgba(248, 246, 241, 0.06);
  border-color: rgba(201, 168, 108, 0.3);
}

.task-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.phase-note {
  font-size: 0.8rem;
  color: rgba(248, 246, 241, 0.3);
  margin-top: 12px;
}

.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 300;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.6);
}

.modal-content {
  background: #08131F;
  border: 1px solid rgba(248, 246, 241, 0.1);
  border-radius: 16px;
  padding: 40px;
  text-align: center;
  max-width: 400px;
}

.btn {
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 10px 24px;
  font-size: 0.9rem;
  font-family: inherit;
}

.btn-primary {
  background: linear-gradient(135deg, #C9A86C, #E2C88A);
  color: #08131F;
  font-weight: 600;
}

.btn-outline {
  background: transparent;
  border: 1px solid rgba(248, 246, 241, 0.2);
  color: rgba(248, 246, 241, 0.8);
}

.btn-sm {
  padding: 8px 18px;
  font-size: 0.82rem;
}

@media (max-width: 768px) {
  .main-content {
    padding: 80px 16px 40px;
  }

  .emergency-stop-btn {
    top: 70px;
    right: 12px;
    font-size: 0.72rem;
    padding: 6px 12px;
  }

  .stop-text {
    display: none;
  }

  .employee-row {
    flex-wrap: wrap;
    gap: 8px;
  }

  .employee-status {
    margin-left: auto;
  }
}
</style>
