<template>
  <div class="media-department">
    <KunlunNav :is-logged-in="isLoggedIn" @show-login="showLogin = true" @show-register="showRegister = true" />
    
    <button
      v-if="isLoggedIn && hasOrganization"
      class="emergency-stop-btn"
      :class="{ 'emergency-active': emergencyStopped }"
      @click="toggleEmergencyStop"
    >
      <span class="stop-icon">🛑</span>
      <span class="stop-text">{{ emergencyStopped ? '已停止' : '停止全部AI操作' }}</span>
    </button>

    <main class="main-content">
      <!-- 顶部导航 -->
      <div class="sub-nav">
        <NuxtLink to="/media-department" class="sub-nav-back">← 返回首页</NuxtLink>
        <h1 class="sub-nav-title">AI 工作区</h1>
      </div>

      <!-- 未登录 -->
      <div v-if="!isLoggedIn" class="empty-state">
        <p>请先登录</p>
        <button class="btn btn-primary" @click="showLogin = true">登录</button>
      </div>

      <!-- 未创建企业 -->
      <div v-else-if="!hasOrganization" class="empty-state">
        <p>请先创建企业</p>
        <NuxtLink to="/media-department/settings" class="btn btn-primary">创建企业</NuxtLink>
      </div>

      <!-- 工作区 -->
      <div v-else class="workspace">
        <!-- AI 员工列表 -->
        <div class="workspace-section">
          <h2 class="section-subtitle">AI 员工</h2>
          <div class="employee-list">
            <div v-for="emp in employees" :key="emp.id" class="employee-row">
              <span class="employee-icon">{{ emp.icon }}</span>
              <div class="employee-details">
                <span class="employee-name">{{ emp.name }}</span>
                <span class="employee-role">{{ emp.role }}</span>
              </div>
              <span class="employee-status" :class="emp.status">{{ emp.statusText }}</span>
              <button class="btn btn-sm btn-outline" @click="configureEmployee(emp)">配置</button>
            </div>
          </div>
          <div class="workspace-actions">
            <button class="btn btn-primary btn-sm" @click="createEmployee">+ 创建 AI 员工</button>
          </div>
        </div>

        <!-- 任务下发（Phase 2 实现） -->
        <div class="workspace-section">
          <h2 class="section-subtitle">快速任务</h2>
          <div class="task-shortcuts">
            <button class="task-btn" disabled title="Phase 2 实现">📡 扫描今日热点</button>
            <button class="task-btn" disabled title="Phase 2 实现">✍️ 生成内容</button>
            <button class="task-btn" disabled title="Phase 2 实现">📊 查看报告</button>
            <button class="task-btn" disabled title="Phase 2 实现">💬 回复评论</button>
          </div>
          <p class="phase-note">任务执行功能将在 Phase 2 实现</p>
        </div>
      </div>
    </main>

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
const emergencyStopped = ref(false)
const organizationName = ref('')

const hasOrganization = computed(() => !!organizationName.value)

const employees = ref([
  { id: '1', name: 'AI 运营总监', icon: '👔', role: '策略制定、内容审核', status: 'active', statusText: 'Active' },
  { id: '2', name: '热点分析师', icon: '📡', role: '实时分析各平台热点', status: 'active', statusText: 'Active' },
  { id: '3', name: '内容创作 AI', icon: '✍️', role: '生成图文/视频脚本', status: 'idle', statusText: '待命' },
  { id: '4', name: '销售顾问', icon: '💼', role: '私信/评论回复', status: 'idle', statusText: '待命' },
  { id: '5', name: '客服 AI', icon: '🎧', role: '售后/FAQ/投诉', status: 'idle', statusText: '待命' },
  { id: '6', name: '数据分析', icon: '📊', role: '同步数据/输出报告', status: 'idle', statusText: '待命' },
])

function getToken(): string {
  try { return localStorage.getItem('accessToken') || '' } catch { return '' }
}

function toggleEmergencyStop() {
  emergencyStopped.value = !emergencyStopped.value
}

function configureEmployee(emp: any) {
  alert(`配置 ${emp.name} — Phase 2 实现`)
}

function createEmployee() {
  if (employees.value.length >= 20) {
    alert('当前套餐最多 20 个 AI 员工，请升级套餐')
    return
  }
  alert('创建 AI 员工功能将在 Phase 2 实现')
}

onMounted(() => {
  const token = getToken()
  if (token) {
    isLoggedIn.value = true
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
