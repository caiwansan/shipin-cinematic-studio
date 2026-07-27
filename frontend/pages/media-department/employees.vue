<template>
  <div class="media-department">
    <KunlunNav :is-logged-in="isLoggedIn" @show-login="showLogin = true" @show-register="showRegister = true" />
    
    <button
      v-if="isLoggedIn && hasOrganization"
      class="emergency-stop-btn"
      :class="{ 'emergency-active': emergencyActive }"
      @click="toggleEmergencyStop"
    >
      <span class="stop-icon">🛑</span>
      <span class="stop-text">{{ emergencyActive ? '已停止' : '停止全部AI操作' }}</span>
    </button>

    <main class="main-content">
      <div class="sub-nav">
        <NuxtLink to="/media-department" class="sub-nav-back">← 返回首页</NuxtLink>
        <h1 class="sub-nav-title">我的 AI 运营团队</h1>
      </div>

      <div v-if="!isLoggedIn" class="empty-state">
        <p>请先登录</p>
        <button class="btn btn-primary" @click="showLogin = true">登录</button>
      </div>

      <div v-else-if="!hasOrganization" class="empty-state">
        <p>请先创建企业</p>
        <NuxtLink to="/media-department/settings" class="btn btn-primary">创建企业</NuxtLink>
      </div>

      <div v-else class="employees-page">
        <!-- AI 员工状态概览 -->
        <div class="team-overview">
          <div class="overview-item">
            <span class="overview-value">{{ employees.length }}</span>
            <span class="overview-label">AI 员工</span>
          </div>
          <div class="overview-item">
            <span class="overview-value">{{ activeCount }}</span>
            <span class="overview-label">工作中</span>
          </div>
          <div class="overview-item">
            <span class="overview-value">{{ employees.length - activeCount }}</span>
            <span class="overview-label">未配置</span>
          </div>
        </div>

        <!-- AI 员工列表 -->
        <div class="employees-grid">
          <div
            v-for="emp in employees"
            :key="emp.id"
            class="employee-card"
            :class="{
              'employee-active': emp.runtimeStatus === 'active' && !emp.emergencyStop,
              'employee-paused': emp.runtimeStatus === 'paused' || emp.emergencyStop,
              'employee-draft': emp.runtimeStatus === 'draft'
            }"
          >
            <div class="employee-card-header">
              <span class="employee-icon">{{ positionIcon(emp.positionType) }}</span>
              <div class="employee-card-info">
                <span class="employee-name">{{ emp.name }}</span>
                <span class="employee-position">{{ positionLabel(emp.positionType) }}</span>
              </div>
              <span class="employee-status-badge" :class="emp.runtimeStatus">
                {{ statusLabel(emp) }}
              </span>
            </div>
            <div class="employee-card-body">
              <div class="employee-stat">
                <span class="stat-label">累计任务</span>
                <span class="stat-value">{{ emp.totalTasks }}</span>
              </div>
              <div class="employee-stat">
                <span class="stat-label">最后活跃</span>
                <span class="stat-value">{{ formatTime(emp.lastExecutionAt) }}</span>
              </div>
            </div>
            <div class="employee-card-actions">
              <button v-if="emp.runtimeStatus === 'draft'" class="btn btn-sm btn-primary" @click="activateEmployee(emp)">
                激活
              </button>
              <button v-if="emp.runtimeStatus === 'active'" class="btn btn-sm btn-outline" @click="executeTask(emp)">
                执行任务
              </button>
              <button class="btn btn-sm btn-outline" @click="configureEmployee(emp)">配置</button>
            </div>
          </div>

          <!-- 创建 AI 员工卡片 -->
          <div class="employee-card employee-create" @click="showCreateModal = true">
            <div class="create-icon">+</div>
            <span class="create-label">创建 AI 员工</span>
          </div>
        </div>

        <!-- 岗位说明 -->
        <div class="positions-guide">
          <h2 class="section-subtitle">岗位说明</h2>
          <div class="positions-list">
            <div v-for="pos in positionTemplates" :key="pos.id" class="position-item">
              <span class="position-icon">{{ pos.icon }}</span>
              <div class="position-info">
                <span class="position-name">{{ pos.name }}</span>
                <span class="position-desc">{{ pos.desc }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>

    <!-- 创建 AI 员工弹窗 -->
    <div v-if="showCreateModal" class="modal-overlay" @click.self="showCreateModal = false">
      <div class="modal-content modal-large">
        <h2 class="modal-title">创建 AI 员工</h2>
        
        <!-- Step 1: 选择岗位 -->
        <div v-if="createStep === 1" class="create-step">
          <h3>Step 1: 选择岗位</h3>
          <div class="position-select-grid">
            <div
              v-for="pos in positionTemplates"
              :key="pos.id"
              class="position-select-card"
              :class="{ 'position-selected': createForm.positionType === pos.id }"
              @click="createForm.positionType = pos.id; createForm.role = pos.defaultRole"
            >
              <span class="position-icon">{{ pos.icon }}</span>
              <span class="position-name">{{ pos.name }}</span>
              <span class="position-desc">{{ pos.desc }}</span>
            </div>
          </div>
        </div>

        <!-- Step 2: 配置身份 -->
        <div v-if="createStep === 2" class="create-step">
          <h3>Step 2: 配置身份</h3>
          <div class="form-group">
            <label>名称</label>
            <input v-model="createForm.name" class="form-input" placeholder="例如：小红书运营小李" />
          </div>
          <div class="form-group">
            <label>职责描述</label>
            <textarea v-model="createForm.goal" class="form-input" rows="3" placeholder="描述这个 AI 员工的工作目标和职责"></textarea>
          </div>
        </div>

        <!-- Step 3: 配置知识 -->
        <div v-if="createStep === 3" class="create-step">
          <h3>Step 3: 配置知识</h3>
          <div class="form-group">
            <label>企业介绍</label>
            <textarea v-model="createForm.knowledgeText" class="form-input" rows="4" placeholder="输入企业介绍、产品信息、品牌定位、禁止事项"></textarea>
          </div>
          <p class="form-hint">知识将作为 AI 员工的工作参考，确保输出内容符合企业要求。</p>
        </div>

        <!-- Step 4: 配置模型 -->
        <div v-if="createStep === 4" class="create-step">
          <h3>Step 4: 配置大模型</h3>
          <div class="form-group">
            <label>选择模型</label>
            <select v-model="createForm.modelProvider" class="form-input">
              <option value="deepseek">DeepSeek</option>
              <option value="openai">OpenAI</option>
              <option value="claude">Claude</option>
              <option value="volcengine">火山引擎</option>
              <option value="aliyun">通义千问</option>
              <option value="other">其他兼容模型</option>
            </select>
          </div>
          <div class="form-group">
            <label>API Key</label>
            <input v-model="createForm.apiKey" class="form-input" type="password" placeholder="输入你的 API Key" />
          </div>
          <div class="form-group">
            <label>Model</label>
            <input v-model="createForm.modelName" class="form-input" placeholder="例如：deepseek-v4-flash" />
          </div>
          <p class="form-hint">API Key 仅用于你的 AI 员工调用，昆仑镜不存储明文 Key。</p>
        </div>

        <!-- Step 5: 确认创建 -->
        <div v-if="createStep === 5" class="create-step">
          <h3>Step 5: 确认创建</h3>
          <div class="confirm-info">
            <div class="confirm-row"><span>岗位：</span><strong>{{ positionLabel(createForm.positionType) }}</strong></div>
            <div class="confirm-row"><span>名称：</span><strong>{{ createForm.name }}</strong></div>
            <div class="confirm-row"><span>模型：</span><strong>{{ createForm.modelProvider }} / {{ createForm.modelName || '默认' }}</strong></div>
          </div>
          <p class="form-hint">创建后将生成 Hermes Sub Agent，状态为 Draft。需要激活后才能执行任务。</p>
        </div>

        <!-- 底部操作 -->
        <div class="modal-actions">
          <button v-if="createStep > 1" class="btn btn-outline btn-sm" @click="createStep--">上一步</button>
          <button v-if="createStep < 5" class="btn btn-primary btn-sm" @click="createStep++" :disabled="!canProceed">下一步</button>
          <button v-if="createStep === 5" class="btn btn-primary btn-sm" @click="createEmployee" :disabled="creating">
            {{ creating ? '创建中...' : '创建 Hermes Sub Agent' }}
          </button>
          <button class="btn btn-outline btn-sm" @click="closeCreateModal">取消</button>
        </div>
      </div>
    </div>

    <!-- 执行任务弹窗 -->
    <div v-if="showTaskModal" class="modal-overlay" @click.self="showTaskModal = false">
      <div class="modal-content">
        <h2 class="modal-title">执行任务</h2>
        <div class="form-group">
          <label>任务指令</label>
          <textarea v-model="taskInstruction" class="form-input" rows="4" placeholder="告诉 AI 员工要做什么"></textarea>
        </div>
        <div class="modal-actions">
          <button class="btn btn-primary btn-sm" @click="runTask" :disabled="!taskInstruction || taskRunning">
            {{ taskRunning ? '执行中...' : '执行' }}
          </button>
          <button class="btn btn-outline btn-sm" @click="showTaskModal = false">取消</button>
        </div>
        <!-- 任务输出 -->
        <div v-if="taskOutput" class="task-output">
          <h4>执行结果：</h4>
          <pre>{{ taskOutput }}</pre>
          <div v-if="taskStats" class="task-stats">
            <span>Token: {{ taskStats.tokenInput }} + {{ taskStats.tokenOutput }}</span>
            <span>Cost: ¥{{ taskStats.cost.toFixed(6) }}</span>
            <span>Duration: {{ taskStats.durationMs }}ms</span>
          </div>
        </div>
      </div>
    </div>

    <div v-if="showLogin" class="modal-overlay" @click.self="showLogin = false">
      <div class="modal-content">
        <p>登录功能尚未实现，请联系管理员</p>
        <button class="btn btn-outline btn-sm" @click="showLogin = false">关闭</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import KunlunNav from '~/components/kunlun/business/KunlunNav.vue'
import { KunlunMediaApi } from '~/composables/enterprise/useMediaApi'

const isLoggedIn = ref(false)
const showLogin = ref(false)
const showRegister = ref(false)
const hasOrganization = ref(true)
const emergencyActive = ref(false)
const employees = ref<any[]>([])
const showCreateModal = ref(false)
const showTaskModal = ref(false)
const createStep = ref(1)
const creating = ref(false)
const taskInstruction = ref('')
const taskOutput = ref('')
const taskStats = ref<any>(null)
const taskRunning = ref(false)
const selectedEmployee = ref<any>(null)

const createForm = ref({
  positionType: '',
  name: '',
  role: '',
  goal: '',
  knowledgeText: '',
  modelProvider: 'deepseek',
  apiKey: '',
  modelName: '',
})

const positionTemplates = [
  { id: 'director', name: 'AI 运营总监', icon: '👔', desc: '策略制定、内容审核、团队管理', defaultRole: '运营总监' },
  { id: 'hotspot_analyst', name: '热点分析师', icon: '📡', desc: '实时分析各平台热点趋势', defaultRole: '热点分析师' },
  { id: 'content_creator', name: '内容创作 AI', icon: '✍️', desc: '生成图文/视频脚本', defaultRole: '内容创作' },
  { id: 'content_reviewer', name: '内容审核 AI', icon: '🔍', desc: '发布前内容评分审核', defaultRole: '内容审核' },
  { id: 'sales', name: '销售顾问 AI', icon: '💼', desc: '私信/评论转化', defaultRole: '销售顾问' },
  { id: 'support', name: '客服 AI', icon: '🎧', desc: '售后/FAQ/投诉', defaultRole: '客服' },
  { id: 'data_analyst', name: '数据分析 AI', icon: '📊', desc: '同步数据/输出报告', defaultRole: '数据分析' },
]

const activeCount = computed(() =>
  employees.value.filter(e => e.runtimeStatus === 'active' && !e.emergencyStop).length
)

const canProceed = computed(() => {
  if (createStep.value === 1) return !!createForm.value.positionType
  if (createStep.value === 2) return !!createForm.value.name
  return true
})

function getToken(): string {
  try { return localStorage.getItem('accessToken') || '' } catch { return '' }
}

function positionIcon(positionType: string): string {
  return positionTemplates.find(p => p.id === positionType)?.icon || '🤖'
}

function positionLabel(positionType: string): string {
  return positionTemplates.find(p => p.id === positionType)?.name || positionType
}

function statusLabel(emp: any): string {
  if (emp.emergencyStop) return '已停止'
  if (emp.runtimeStatus === 'active') return 'Active'
  if (emp.runtimeStatus === 'paused') return 'Paused'
  return 'Draft'
}

function formatTime(time: string | null): string {
  if (!time) return '从未'
  const d = new Date(time)
  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

async function fetchEmployees() {
  try {
    const result = await KunlunMediaApi.getEmployees()
    if (result.data && Array.isArray(result.data)) {
      employees.value = result.data.map((emp: any) => ({
        id: emp.id,
        name: emp.name || 'AI 员工',
        role: emp.role || emp.type || '新媒体运营',
        status: emp.status || 'active',
        statusText: emp.status === 'active' ? 'Active' : '待命',
        capabilities: emp.capabilities || [],
        valueSummary: emp.valueSummary,
        icon: emp.icon || '🤖',
      }))
    }
  } catch (e) {
    console.warn('[Employees] Fetch failed:', e)
  }
}

async function toggleEmergencyStop() {
  emergencyActive.value = !emergencyActive.value
  console.log('[Emergency] AI 操作已' + (emergencyActive.value ? '停止' : '恢复'))
}

function closeCreateModal() {
  showCreateModal.value = false
  createStep.value = 1
  createForm.value = { positionType: '', name: '', role: '', goal: '', knowledgeText: '', modelProvider: 'deepseek', apiKey: '', modelName: '' }
}

async function createEmployee() {
  const token = getToken()
  if (!token) return
  creating.value = true
  try {
    const res = await fetch('/api/enterprise/media-department/employees', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        name: createForm.value.name,
        role: createForm.value.role,
        positionType: createForm.value.positionType,
        goal: createForm.value.goal,
        knowledge: createForm.value.knowledgeText.split('\n').filter(Boolean),
        memory: [],
      })
    })
    if (res.ok) {
      closeCreateModal()
      fetchEmployees()
    }
  } catch (e) {
    console.warn('[Create] Failed:', e)
  }
  creating.value = false
}

async function activateEmployee(emp: any) {
  const token = getToken()
  if (!token) return
  try {
    const res = await fetch(`/api/enterprise/agent-profiles/${emp.id}/activate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    })
    if (res.ok) {
      fetchEmployees()
    }
  } catch (e) {
    console.warn('[Activate] Failed:', e)
  }
}

function executeTask(emp: any) {
  selectedEmployee.value = emp
  taskInstruction.value = ''
  taskOutput.value = ''
  taskStats.value = null
  showTaskModal.value = true
}

async function runTask() {
  if (!selectedEmployee.value) return
  taskRunning.value = true
  try {
    const result = await KunlunMediaApi.createTask(
      selectedEmployee.value.id,
      'MARKET_SCAN',
      taskInstruction.value
    )
    if (result.data) {
      taskOutput.value = JSON.stringify(result.data, null, 2)
      taskStats.value = { cost: 0, durationMs: 0 }
    } else if (result.error) {
      taskOutput.value = '执行失败: ' + result.error
    }
  } catch (e: any) {
    taskOutput.value = '执行失败: ' + e.message
  }
  taskRunning.value = false
}

async function configureEmployee(emp: any) {
  alert(`配置 ${emp.name} — Phase 2 第二步实现`)
}

onMounted(() => {
  const token = getToken()
  if (token) {
    isLoggedIn.value = true
    fetchEmployees()
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
  max-width: 1000px;
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

/* 概览 */
.team-overview {
  display: flex;
  gap: 24px;
  margin-bottom: 32px;
}

.overview-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px 32px;
  background: rgba(248, 246, 241, 0.03);
  border: 1px solid rgba(248, 246, 241, 0.06);
  border-radius: 12px;
}

.overview-value {
  font-size: 1.8rem;
  font-weight: 700;
  color: #C9A86C;
}

.overview-label {
  font-size: 0.8rem;
  color: rgba(248, 246, 241, 0.5);
}

/* AI 员工网格 */
.employees-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
  margin-bottom: 40px;
}

.employee-card {
  padding: 20px;
  background: rgba(248, 246, 241, 0.03);
  border: 1px solid rgba(248, 246, 241, 0.06);
  border-radius: 14px;
  transition: all 0.3s ease;
}

.employee-card:hover {
  background: rgba(248, 246, 241, 0.05);
}

.employee-card.employee-active {
  border-color: rgba(34, 197, 94, 0.2);
}

.employee-card.employee-paused {
  border-color: rgba(239, 68, 68, 0.2);
}

.employee-card.employee-draft {
  border-color: rgba(248, 246, 241, 0.1);
  border-style: dashed;
}

.employee-card-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.employee-icon {
  font-size: 1.5rem;
  flex-shrink: 0;
}

.employee-card-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
}

.employee-name {
  font-size: 0.95rem;
  font-weight: 600;
}

.employee-position {
  font-size: 0.75rem;
  color: rgba(248, 246, 241, 0.4);
}

.employee-status-badge {
  font-size: 0.68rem;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 6px;
}

.employee-status-badge.active,
.employee-status-badge.Active {
  background: rgba(34, 197, 94, 0.15);
  color: #22C55E;
}

.employee-status-badge.paused,
.employee-status-badge.Paused {
  background: rgba(239, 68, 68, 0.15);
  color: #EF4444;
}

.employee-status-badge.draft,
.employee-status-badge.Draft {
  background: rgba(248, 246, 241, 0.05);
  color: rgba(248, 246, 241, 0.4);
}

.employee-card-body {
  display: flex;
  gap: 24px;
  margin-bottom: 16px;
}

.employee-stat {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.stat-label {
  font-size: 0.7rem;
  color: rgba(248, 246, 241, 0.35);
}

.stat-value {
  font-size: 0.85rem;
  font-weight: 500;
}

.employee-card-actions {
  display: flex;
  gap: 8px;
}

/* 创建卡片 */
.employee-create {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  cursor: pointer;
  border-style: dashed;
  min-height: 160px;
}

.employee-create:hover {
  border-color: #C9A86C;
  background: rgba(201, 168, 108, 0.05);
}

.create-icon {
  font-size: 2.5rem;
  color: rgba(248, 246, 241, 0.3);
}

.create-label {
  font-size: 0.85rem;
  color: rgba(248, 246, 241, 0.4);
}

/* 岗位说明 */
.positions-guide {
  padding: 24px;
  background: rgba(248, 246, 241, 0.02);
  border: 1px solid rgba(248, 246, 241, 0.06);
  border-radius: 16px;
}

.positions-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 12px;
}

.position-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: rgba(248, 246, 241, 0.02);
  border-radius: 10px;
}

.position-icon {
  font-size: 1.3rem;
}

.position-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.position-name {
  font-size: 0.85rem;
  font-weight: 500;
}

.position-desc {
  font-size: 0.72rem;
  color: rgba(248, 246, 241, 0.35);
}

/* 弹窗 */
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
  padding: 32px;
  max-width: 500px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
}

.modal-large {
  max-width: 700px;
}

.modal-title {
  font-size: 1.2rem;
  font-weight: 600;
  margin: 0 0 24px;
}

.create-step h3 {
  font-size: 0.95rem;
  font-weight: 600;
  color: rgba(248, 246, 241, 0.7);
  margin: 0 0 16px;
}

.position-select-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 12px;
}

.position-select-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 16px 12px;
  background: rgba(248, 246, 241, 0.03);
  border: 1px solid rgba(248, 246, 241, 0.06);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.3s ease;
  text-align: center;
}

.position-select-card:hover {
  background: rgba(248, 246, 241, 0.06);
}

.position-select-card.position-selected {
  border-color: #C9A86C;
  background: rgba(201, 168, 108, 0.08);
}

.position-select-card .position-icon {
  font-size: 1.5rem;
}

.position-select-card .position-name {
  font-size: 0.82rem;
  font-weight: 500;
}

.position-select-card .position-desc {
  font-size: 0.68rem;
  color: rgba(248, 246, 241, 0.35);
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  font-size: 0.82rem;
  color: rgba(248, 246, 241, 0.6);
  margin-bottom: 6px;
}

.form-input {
  width: 100%;
  padding: 10px 14px;
  background: rgba(248, 246, 241, 0.05);
  border: 1px solid rgba(248, 246, 241, 0.1);
  border-radius: 8px;
  color: #F8F6F1;
  font-size: 0.9rem;
  font-family: inherit;
  box-sizing: border-box;
}

.form-input:focus {
  outline: none;
  border-color: #C9A86C;
}

textarea.form-input {
  resize: vertical;
}

.form-hint {
  font-size: 0.78rem;
  color: rgba(248, 246, 241, 0.35);
  margin-bottom: 16px;
}

.confirm-info {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 20px;
  background: rgba(248, 246, 241, 0.03);
  border-radius: 12px;
  margin-bottom: 16px;
}

.confirm-row {
  display: flex;
  gap: 8px;
  font-size: 0.9rem;
}

.confirm-row span {
  color: rgba(248, 246, 241, 0.5);
}

.modal-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin-top: 24px;
}

/* 任务输出 */
.task-output {
  margin-top: 24px;
  padding: 16px;
  background: rgba(248, 246, 241, 0.03);
  border-radius: 12px;
}

.task-output h4 {
  font-size: 0.85rem;
  font-weight: 600;
  margin: 0 0 12px;
}

.task-output pre {
  white-space: pre-wrap;
  word-wrap: break-word;
  font-size: 0.82rem;
  color: rgba(248, 246, 241, 0.7);
  max-height: 300px;
  overflow-y: auto;
  margin: 0 0 12px;
}

.task-stats {
  display: flex;
  gap: 16px;
  font-size: 0.75rem;
  color: rgba(248, 246, 241, 0.4);
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

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
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

  .stop-text { display: none; }

  .team-overview {
    flex-wrap: wrap;
    gap: 12px;
  }

  .overview-item {
    flex: 1;
    min-width: 80px;
    padding: 16px;
  }

  .employees-grid {
    grid-template-columns: 1fr;
  }

  .employee-card-body {
    gap: 16px;
  }

  .modal-content {
    padding: 24px;
    margin: 12px;
  }

  .position-select-grid {
    grid-template-columns: 1fr 1fr;
  }
}
</style>
