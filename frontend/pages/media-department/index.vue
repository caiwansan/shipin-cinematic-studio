<template>
  <div class="media-department">
    <!-- 顶部导航栏（复用 KunlunNav） -->
    <KunlunNav :is-logged-in="isLoggedIn" @show-login="goLogin" @show-register="goRegister" />

    <!-- 主内容 -->
    <main class="main-content">
      <!-- 未登录：欢迎引导 -->
      <div v-if="!isLoggedIn" class="welcome-section">
        <div class="welcome-content">
          <h1 class="welcome-title">欢迎使用昆仑镜 AI 新媒体运营部门</h1>
          <p class="welcome-desc">由 Hermes Agent Runtime 驱动的 AI 新媒体运营团队</p>
          <div class="welcome-actions">
            <button class="btn btn-primary" @click="goLogin">登录使用</button>
            <button class="btn btn-outline" @click="goRegister">免费注册</button>
          </div>
        </div>
      </div>

      <!-- 已登录未创建企业：创建引导 -->
      <div v-else-if="!hasOrganization" class="onboard-section">
        <div class="onboard-content">
          <h2 class="onboard-title">🎉 欢迎创建你的 AI 新媒体运营团队</h2>
          <div class="steps-grid">
            <div class="step-card">
              <div class="step-number">①</div>
              <h3>创建企业</h3>
              <p>填写企业名称和行业</p>
              <button class="btn btn-primary btn-sm" @click="goToSettings">立即创建</button>
            </div>
            <div class="step-card">
              <div class="step-number">②</div>
              <h3>购买套餐</h3>
              <p>选择合适的 AI 员工数量</p>
              <button class="btn btn-primary btn-sm" @click="goToSettings">选择套餐</button>
            </div>
            <div class="step-card">
              <div class="step-number">③</div>
              <h3>连接新媒体账号</h3>
              <p>抖音、小红书、视频号等</p>
              <button class="btn btn-primary btn-sm" @click="goToSettings">开始连接</button>
            </div>
            <div class="step-card">
              <div class="step-number">④</div>
              <h3>创建 AI 员工</h3>
              <p>热点分析师、内容创作等</p>
              <button class="btn btn-primary btn-sm" @click="goToWorkspace">开始创建</button>
            </div>
          </div>
        </div>
      </div>

      <!-- 已登录且有企业：运营状态 -->
      <div v-else class="dashboard-section">
        <!-- 第一栏：企业名称 + 套餐 + AI 员工 + 平台 -->
        <div class="status-header">
          <div class="company-info">
            <h2 class="company-name">{{ organizationName || '我的企业' }}</h2>
            <span class="plan-badge">{{ planName || '未开通' }}</span>
          </div>
          <div class="status-quick">
            <div class="quick-item">
              <span class="quick-label">AI 员工</span>
              <span class="quick-value">{{ realAgents.length }}{{ employeeMax ? '/' + employeeMax : '' }}</span>
            </div>
            <div class="quick-item">
              <span class="quick-label">已连接平台</span>
              <span class="quick-value platform-icons">
                <span v-for="p in connectedPlatforms" :key="p" class="platform-icon">{{ platformIcon(p) }}</span>
                <span v-if="connectedPlatforms.length === 0" class="platform-empty">未连接</span>
              </span>
            </div>
          </div>
        </div>

        <!-- 第二栏：AI 员工状态（真实数据） -->
        <div class="ai-team-section">
          <h3 class="section-title">AI 员工状态</h3>
          <div class="team-grid">
            <div
              v-for="agent in realAgents"
              :key="agent.id"
              class="employee-card"
              :class="{ 'employee-working': agent.status === 'active', 'employee-idle': agent.status !== 'active' }"
            >
              <div class="employee-avatar">{{ agentIcon(agent.type) }}</div>
              <div class="employee-info">
                <span class="employee-name">{{ agent.name }}</span>
                <span class="employee-task">{{ agentCapabilities(agent.capabilities) }}</span>
              </div>
              <div class="employee-status-dot" :class="agent.status"></div>
            </div>
            <div v-if="realAgents.length === 0" class="no-agents">
              <p>暂无 AI 员工，请联系管理员分配套餐</p>
            </div>
          </div>
          <div class="section-actions">
            <button class="btn btn-outline btn-sm" @click="goToWorkspace">管理 AI 员工 →</button>
          </div>
        </div>

        <!-- 第三栏：今日运营状态（占位，Phase 2 实现） -->
        <div class="today-ops-section">
          <h3 class="section-title">今日运营状态</h3>
          <div class="ops-placeholder">
            <p>连接新媒体账号后，AI 员工将自动分析热点、生成内容、发布到平台。</p>
            <button class="btn btn-primary btn-sm" @click="goToSettings">连接账号</button>
          </div>
        </div>

        <!-- 第四栏：下一步行动 -->
        <div class="next-steps-section">
          <h3 class="section-title">下一步行动</h3>
          <div class="next-actions">
            <button class="action-card" @click="goToSettings">
              <span class="action-icon">🔗</span>
              <span class="action-label">连接第一个新媒体账号</span>
            </button>
            <button class="action-card" @click="goToWorkspace">
              <span class="action-icon">📡</span>
              <span class="action-label">管理 AI 员工</span>
            </button>
            <button class="action-card" @click="goToWorkspace">
              <span class="action-icon">✍️</span>
              <span class="action-label">创建内容创作 AI</span>
            </button>
            <button class="action-card" @click="goToSettings">
              <span class="action-icon">⚙️</span>
              <span class="action-label">企业账号设置</span>
            </button>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { getAuthToken } from '~/utils/auth/token'
import { ref, computed, onMounted, watch } from 'vue'
import KunlunNav from '~/components/kunlun/business/KunlunNav.vue'
import { KunlunMediaApi } from '~/composables/enterprise/useMediaApi'

// ─── 认证状态（真实 token 判断） ───
const isLoggedIn = ref(false)
const token = ref('')

// ─── 组织信息（从 API 读取） ───
const organizationName = ref('')
const organizationId = ref('')
const planName = ref('')
const employeeMax = ref(0)
const connectedPlatforms = ref<string[]>([])
const hasOrg = ref(false)
const isLoading = ref(true)

// ─── AI 员工实例（真实数据） ───
const realAgents = ref<any[]>([])

// ─── 计算属性 ───
const hasOrganization = computed(() => hasOrg.value)

// ─── 方法 ───
function getToken(): string {
  try {
    return getAuthToken() || ''
  } catch { return '' }
}

function agentIcon(type: string): string {
  const map: Record<string, string> = {
    'hotspot_analyst': '📡',
    'content_creator': '✍️',
    'content_reviewer': '🔍',
    'seo_optimizer': '🔎',
    'data_analyst': '📊',
    'customer_service': '🎧',
    'market_analyst': '📈',
  }
  return map[type] || '🤖'
}

function agentCapabilities(caps: string[]): string {
  const map: Record<string, string> = {
    'read_only': '只读',
    'create_content': '创作',
    'publish_content': '发布',
    'read_trends': '热点',
    'write_posts': '写作',
    'review_posts': '审核',
    'seo_analyze': 'SEO',
  }
  if (!caps || caps.length === 0) return '待命'
  return caps.map((c) => map[c] || c).join(' · ')
}

function platformIcon(platform: string): string {
  const map: Record<string, string> = {
    'douyin': '🎵',
    'xiaohongshu': '📕',
    'wechat': '💬',
    'weibo': '🐦',
    'kuaishou': '⚡',
    'shipinhao': '🎬',
    'toutiao': '📰',
    'baijiahao': '🏷️',
    'haokan': '👀',
    'qiwechat': '🏢',
  }
  return map[platform] || '📱'
}

function goLogin() {
  window.location.href = '/?login=1'
}
function goRegister() {
  window.location.href = '/?register=1'
}

function goToWorkspace() {
  window.location.href = '/media-department/workspace'
}
function goToSettings() {
  window.location.href = '/media-department/settings'
}

// ─── 生命周期 ───
onMounted(() => {
  token.value = getToken()
  isLoggedIn.value = !!token.value
  if (!isLoggedIn.value) {
    isLoading.value = false
    return
  }
  fetchOrganizationInfo().then(() => {
    if (hasOrg.value) {
      fetchRealAgents()
    }
  })
})

async function fetchOrganizationInfo() {
  try {
    // 真实数据：企业初始化状态 + 订阅 SSOT（套餐名/员工额度）
    const [onboard, sub] = await Promise.all([
      KunlunMediaApi.getOnboardingStatus(),
      KunlunMediaApi.getSubscriptionCurrent(),
    ])
    const ob = onboard.data as any
    const sb = sub.data as any
    if (ob && ob.hasOrganization) {
      hasOrg.value = true
      organizationName.value = ob.organizationName || '我的企业'
      organizationId.value = ob.organizationId
      // 套餐名/额度来自 Subscription SSOT，缺失时诚实留空（不写死企业版）
      planName.value = (sb && (sb.planName || sb.name)) || ''
      employeeMax.value = (sb && sb.maxEmployees) || 0
      // 已连接平台：后端媒体账号模块未上线（无真实 API），显示「未连接」不造假
      connectedPlatforms.value = []
      try { localStorage.setItem('organizationId', ob.organizationId) } catch {}
    } else {
      hasOrg.value = false
    }
  } catch (e) {
    console.warn('[MediaDepartment] Fetch failed:', e)
  } finally {
    isLoading.value = false
  }
}

// ─── 获取真实 AI 员工实例 (Kunlun /api/v1) ───
async function fetchRealAgents() {
  if (!organizationId.value) return
  try {
    const result = await KunlunMediaApi.getEmployees()
    if (result.data && Array.isArray(result.data)) {
      realAgents.value = result.data.map((emp: any) => ({
        id: emp.id,
        name: emp.name || 'AI 员工',
        role: emp.role || emp.agentType || '运营',
        type: emp.agentType || emp.type || '',
        status: (emp.runtimeStatus || emp.status || 'inactive').toLowerCase(),
        capabilities: emp.capabilities || [],
        totalTasks: emp.totalTasks || 0,
      }))
    }
  } catch (e) {
    console.warn('[MediaDepartment] Agent fetch failed:', e)
  }
}
</script>

<style scoped>
.media-department {
  min-height: 100vh;
  background: #08131F;
  color: #F8F6F1;
}

.main-content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 100px 24px 60px;
}

/* 紧急停止按钮 */
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
  border-color: rgba(239, 68, 68, 0.5);
}

.emergency-stop-btn.emergency-active {
  background: rgba(239, 68, 68, 0.3);
  border-color: #EF4444;
  animation: pulse-red 2s infinite;
}

.stop-icon {
  font-size: 1rem;
}

@keyframes pulse-red {
  0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
  50% { box-shadow: 0 0 12px 4px rgba(239, 68, 68, 0.2); }
}

/* 欢迎引导 */
.welcome-section {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
}

.welcome-content {
  text-align: center;
  max-width: 600px;
}

.welcome-title {
  font-size: 2.2rem;
  font-weight: 700;
  margin-bottom: 16px;
  background: linear-gradient(135deg, #C9A86C, #E2C88A);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.welcome-desc {
  font-size: 1.1rem;
  color: rgba(248, 246, 241, 0.6);
  margin-bottom: 40px;
}

.welcome-actions {
  display: flex;
  gap: 16px;
  justify-content: center;
}

/* 创建企业引导 */
.onboard-section {
  padding: 40px 0;
}

.onboard-title {
  font-size: 1.6rem;
  font-weight: 600;
  text-align: center;
  margin-bottom: 48px;
}

.steps-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 24px;
}

.step-card {
  background: rgba(248, 246, 241, 0.03);
  border: 1px solid rgba(248, 246, 241, 0.06);
  border-radius: 16px;
  padding: 32px 24px;
  text-align: center;
}

.step-number {
  font-size: 2.5rem;
  font-weight: 700;
  color: #C9A86C;
  margin-bottom: 16px;
}

.step-card h3 {
  font-size: 1.1rem;
  font-weight: 600;
  margin-bottom: 8px;
}

.step-card p {
  font-size: 0.9rem;
  color: rgba(248, 246, 241, 0.5);
  margin-bottom: 20px;
}

/* 运营状态 */
.dashboard-section {
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.status-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24px 32px;
  background: rgba(248, 246, 241, 0.03);
  border: 1px solid rgba(248, 246, 241, 0.06);
  border-radius: 16px;
}

.company-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.company-name {
  font-size: 1.3rem;
  font-weight: 600;
}

.plan-badge {
  font-size: 0.75rem;
  font-weight: 600;
  color: #08131F;
  background: linear-gradient(135deg, #C9A86C, #E2C88A);
  padding: 4px 12px;
  border-radius: 6px;
}

.status-quick {
  display: flex;
  gap: 24px;
}

.quick-item {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
}

.quick-label {
  font-size: 0.75rem;
  color: rgba(248, 246, 241, 0.4);
}

.quick-value {
  font-size: 1rem;
  font-weight: 600;
}

.platform-icons {
  display: flex;
  gap: 6px;
}

.platform-icon {
  font-size: 1.2rem;
}

.platform-empty {
  font-size: 0.8rem;
  color: rgba(248, 246, 241, 0.3);
}

/* AI 员工状态 */
.section-title {
  font-size: 1rem;
  font-weight: 600;
  color: rgba(248, 246, 241, 0.7);
  margin-bottom: 16px;
}

.team-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 12px;
}

.employee-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  background: rgba(248, 246, 241, 0.03);
  border: 1px solid rgba(248, 246, 241, 0.06);
  border-radius: 12px;
  transition: all 0.3s ease;
}

.employee-card:hover {
  background: rgba(248, 246, 241, 0.05);
}

.employee-card.employee-working {
  border-color: rgba(34, 197, 94, 0.2);
}

.employee-avatar {
  font-size: 1.5rem;
  flex-shrink: 0;
}

.employee-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.employee-name {
  font-size: 0.85rem;
  font-weight: 500;
}

.employee-task {
  font-size: 0.72rem;
  color: rgba(248, 246, 241, 0.4);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.employee-status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
  margin-left: auto;
}

.employee-status-dot.working,
.employee-status-dot.active {
  background: #22C55E;
  box-shadow: 0 0 8px rgba(34, 197, 94, 0.4);
}

.employee-status-dot.idle,
.employee-status-dot.paused,
.employee-status-dot.suspended {
  background: rgba(248, 246, 241, 0.2);
}

.employee-status-dot.expired {
  background: #ef4444;
}

.no-agents {
  padding: 20px;
  text-align: center;
  color: #6b7280;
  font-size: 14px;
  grid-column: 1 / -1;
}

.section-actions {
  margin-top: 16px;
  text-align: right;
}

/* 今日运营占位 */
.ops-placeholder {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 32px;
  background: rgba(248, 246, 241, 0.02);
  border: 1px dashed rgba(248, 246, 241, 0.1);
  border-radius: 12px;
}

.ops-placeholder p {
  font-size: 0.9rem;
  color: rgba(248, 246, 241, 0.4);
}

/* 下一步行动 */
.next-actions {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
}

.action-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 18px 20px;
  background: rgba(248, 246, 241, 0.03);
  border: 1px solid rgba(248, 246, 241, 0.06);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.3s ease;
  text-align: left;
  color: #F8F6F1;
  font-size: 0.9rem;
  font-family: inherit;
}

.action-card:hover {
  background: rgba(248, 246, 241, 0.06);
  border-color: rgba(201, 168, 108, 0.3);
}

.action-icon {
  font-size: 1.3rem;
}

.action-label {
  font-weight: 500;
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
  padding: 40px;
  text-align: center;
  max-width: 400px;
}

/* 按钮 */
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

.btn-primary:hover {
  box-shadow: 0 4px 16px rgba(201, 168, 108, 0.3);
}

.btn-outline {
  background: transparent;
  border: 1px solid rgba(248, 246, 241, 0.2);
  color: rgba(248, 246, 241, 0.8);
}

.btn-outline:hover {
  border-color: rgba(248, 246, 241, 0.4);
  color: #F8F6F1;
}

.btn-sm {
  padding: 8px 18px;
  font-size: 0.82rem;
}

/* 响应式 */
@media (max-width: 768px) {
  .main-content {
    padding: 80px 16px 40px;
  }

  .welcome-title {
    font-size: 1.6rem;
  }

  .status-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
  }

  .status-quick {
    width: 100%;
    justify-content: space-between;
  }

  .quick-item {
    align-items: flex-start;
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
}
</style>
