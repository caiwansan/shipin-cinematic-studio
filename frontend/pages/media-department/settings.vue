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
      <div class="sub-nav">
        <NuxtLink to="/media-department" class="sub-nav-back">← 返回首页</NuxtLink>
        <h1 class="sub-nav-title">企业设置</h1>
      </div>

      <div v-if="!isLoggedIn" class="empty-state">
        <p>请先登录</p>
        <button class="btn btn-primary" @click="showLogin = true">登录</button>
      </div>

      <div v-else class="settings-page">
        <!-- 企业信息 -->
        <div class="settings-section">
          <h2 class="section-subtitle">企业信息</h2>
          <div class="settings-form">
            <div class="form-row">
              <label>企业名称</label>
              <input v-model="orgInfo.name" class="form-input" placeholder="输入企业名称" />
            </div>
            <div class="form-row">
              <label>所属行业</label>
              <select v-model="orgInfo.industry" class="form-input">
                <option value="">请选择</option>
                <option value="ecommerce">电商</option>
                <option value="education">教育</option>
                <option value="food">餐饮</option>
                <option value="travel">旅游</option>
                <option value="beauty">美妆</option>
                <option value="tech">科技</option>
                <option value="other">其他</option>
              </select>
            </div>
            <div class="form-row">
              <label>当前套餐</label>
              <span class="plan-display">{{ planName }}</span>
            </div>
            <button class="btn btn-primary btn-sm" @click="saveOrgInfo">保存</button>
          </div>
        </div>

        <!-- 平台账号授权 -->
        <div class="settings-section">
          <h2 class="section-subtitle">平台账号授权</h2>
          <p class="section-desc">连接你的新媒体平台账号，AI 员工将自动分析数据、生成内容。</p>
          <div class="platforms-grid">
            <div
              v-for="p in platforms"
              :key="p.id"
              class="platform-card"
              :class="{ 'platform-connected': p.status === 'active', 'platform-expired': p.status === 'expired' }"
            >
              <span class="platform-icon">{{ p.icon }}</span>
              <span class="platform-name">{{ p.name }}</span>
              <span v-if="p.status === 'active'" class="platform-status-dot active"></span>
              <span v-else-if="p.status === 'expired'" class="platform-status-dot expired"></span>
              <button
                v-if="p.status === 'active'"
                class="btn btn-sm btn-outline"
                @click="disconnectPlatform(p)"
              >
                已连接
              </button>
              <button
                v-else
                class="btn btn-sm btn-primary"
                :disabled="connectingPlatform === p.id"
                @click="openConnectModal(p)"
              >
                {{ connectingPlatform === p.id ? '连接中...' : '连接' }}
              </button>
            </div>
          </div>
        </div>

        <!-- 平台授权连接弹窗 -->
        <div v-if="showConnectModal" class="modal-overlay" @click.self="cancelConnect">
          <div class="modal-content connect-modal">
            <div class="connect-header">
              <h3>连接 {{ connectingPlatfrm?.name }} 账号</h3>
              <button class="btn-close" @click="cancelConnect">×</button>
            </div>

            <div class="connect-body">
              <!-- 等待登录状态 -->
              <div v-if="connectStatus === 'waiting_login'" class="connect-waiting">
                <div class="connect-spinner"></div>
                <p>打开浏览器中...</p>
                <p class="connect-sub">弹窗将显示登录页，请完成登录</p>
              </div>

              <!-- 登录页截图 -->
              <div v-if="_connectScreenshot" class="connect-screenshot">
                <img :src="_connectScreenshot" alt="登录页截图" />
                <p class="connect-sub">完成登录后系统将自动检测</p>
              </div>

              <!-- 连接成功 -->
              <div v-if="connectStatus === 'login_completed'" class="connect-success">
                <span class="success-icon">✅</span>
                <p>登录成功！正在保存账号...</p>
              </div>

              <!-- 已绑定 -->
              <div v-if="connectStatus === 'active'" class="connect-done">
                <span class="success-icon">🎉</span>
                <p>账号绑定成功！</p>
                <p class="connect-sub">AI 员工现在可以管理你的 {{ connectingPlatfrm?.name }} 账号</p>
              </div>

              <!-- 出错 -->
              <div v-if="connectStatus === 'error'" class="connect-error">
                <span class="error-icon">❌</span>
                <p>{{ connectErrorMessage }}</p>
                <button class="btn btn-primary btn-sm" @click="retryConnect">重试</button>
              </div>
            </div>

            <div class="connect-footer">
              <button class="btn btn-outline btn-sm" @click="cancelConnect">取消</button>
              <button
                v-if="connectStatus === 'waiting_login' || connectStatus === 'login_completed'"
                class="btn btn-primary btn-sm"
                @click="confirmConnect"
              >
                确认绑定
              </button>
            </div>
          </div>
        </div>

        <!-- 升级套餐 -->
        <div class="settings-section">
          <h2 class="section-subtitle">套餐升级</h2>
          <p class="section-desc">当前套餐：{{ planName }} | 管理面板可修改套餐参数</p>
          <div class="plans-grid">
            <div
              v-for="plan in plans"
              :key="plan.id"
              class="plan-card"
              :class="{ 'plan-active': planName === plan.displayName }"
            >
              <h3>{{ plan.displayName }}</h3>
              <p class="plan-price">¥{{ (plan.priceMonthly / 100).toFixed(0) }}<span>/月</span></p>
              <ul class="plan-features">
                <li>{{ plan.maxEmployers }} 个 AI 员工</li>
                <li>{{ plan.maxChannels }} 个平台账号</li>
                <li v-for="f in plan.features" :key="f">{{ f }}</li>
              </ul>
              <button
                v-if="planName === plan.displayName"
                class="btn btn-sm btn-outline"
                disabled
              >
                当前套餐
              </button>
              <button
                v-else
                class="btn btn-sm btn-primary"
                @click="upgradePlan(plan)"
              >
                升级
              </button>
            </div>
          </div>
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
import { getAuthToken } from '~/utils/auth/token'
import { ref, computed, onMounted } from 'vue'
import KunlunNav from '~/components/kunlun/business/KunlunNav.vue'
import { KunlunMediaApi } from '~/composables/enterprise/useMediaApi'

const isLoggedIn = ref(false)
const showLogin = ref(false)
const showRegister = ref(false)
const emergencyStopped = ref(false)
const planName = ref('基础版')

const orgInfo = ref({
  name: '',
  industry: '',
})

// Plans from API (database-driven)
const plans = ref<any[]>([])

const hasOrganization = computed(() => !!orgInfo.value.name)

const platforms = ref([
  { id: 'xiaohongshu', name: '小红书', icon: '📕', status: 'none', loginUrl: 'https://creator.xiaohongshu.com/login' },
  { id: 'douyin', name: '抖音', icon: '🎵', status: 'coming_soon', loginUrl: 'https://creator.douyin.com/' },
  { id: 'shipinhao', name: '视频号', icon: '🎬', status: 'coming_soon', loginUrl: '' },
  { id: 'weibo', name: '微博', icon: '🐦', status: 'coming_soon', loginUrl: 'https://weibo.com/login.php' },
  { id: 'kuaishou', name: '快手', icon: '⚡', status: 'coming_soon', loginUrl: '' },
  { id: 'gongzhonghao', name: '公众号', icon: '💬', status: 'coming_soon', loginUrl: '' },
  { id: 'toutiao', name: '今日头条', icon: '📰', status: 'coming_soon', loginUrl: '' },
  { id: 'baijiahao', name: '百家号', icon: '🏷️', status: 'coming_soon', loginUrl: '' },
  { id: 'haokan', name: '好看视频', icon: '👀', status: 'coming_soon', loginUrl: '' },
  { id: 'qiwechat', name: '企业微信', icon: '🏢', status: 'coming_soon', loginUrl: '' },
])

// Platform connection modal state
const showConnectModal = ref(false)
const connectingPlatform = ref<string | null>(null)
const connectingPlatfrm = ref<any>(null)
const connectSessionId = ref('')
const connectStatus = ref<'waiting_login' | 'login_completed' | 'active' | 'error'>('waiting_login')
const _connectScreenshot = ref('')
const connectErrorMessage = ref('')
let _connectPollTimer: any = null

const BASE_URL = 'https://aigc.fushtn.com'

function getToken(): string {
  try { return getAuthToken() || '' } catch { return '' }
}

/** BETA-06.9.6: 统一 Auth Header — 不再手动传递 organizationId */
function getAuthHeaders(): Record<string, string> {
  const token = getToken()
  return token ? { Authorization: `Bearer ${token}` } : { Authorization: 'Bearer demo-token' }
}

function toggleEmergencyStop() {
  emergencyStopped.value = !emergencyStopped.value
}

function saveOrgInfo() {
  if (!orgInfo.value.name) {
    alert('请输入企业名称')
    return
  }
  alert(`企业「${orgInfo.value.name}」创建成功！（Phase 1 演示）`)
}

async function openConnectModal(p: any) {
  if (p.status === 'coming_soon') {
    alert(`${p.name} 平台即将在 Phase 3 支持`)
    return
  }

  connectingPlatform.value = p.id
  connectingPlatfrm.value = p
  showConnectModal.value = true
  connectStatus.value = 'waiting_login'
  _connectScreenshot.value = ''
  connectErrorMessage.value = ''

  try {
    const resp = await fetch(`${BASE_URL}/api/enterprise/media-department/media/accounts/connect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({
        platform: p.id,
      }),
    })
    const data = await resp.json()
    if (data.code === 0) {
      connectSessionId.value = data.data.sessionId
      // Start polling for status
      _connectPollTimer = setInterval(async () => {
        await pollConnectStatus()
      }, 3000)
    } else {
      connectStatus.value = 'error'
      connectErrorMessage.value = data.message || '创建连接失败'
    }
  } catch (err: any) {
    connectStatus.value = 'error'
    connectErrorMessage.value = err.message || '网络错误'
  }
}

async function pollConnectStatus() {
  if (!connectSessionId.value) return

  try {
    const resp = await fetch(`${BASE_URL}/api/enterprise/media-department/media/accounts/connect/${connectSessionId.value}/status`)
    const data = await resp.json()
    if (data.code === 0) {
      if (data.data.screenshot) {
        _connectScreenshot.value = `data:image/png;base64,${data.data.screenshot}`
      }
      if (data.data.status === 'login_completed' && connectStatus.value !== 'active') {
        connectStatus.value = 'login_completed'
        // Auto-confirm after 2 seconds
        setTimeout(() => confirmConnect(), 2000)
      }
    }
  } catch (err) {
    // Silently retry on next poll
  }
}

async function confirmConnect() {
  if (_connectPollTimer) {
    clearInterval(_connectPollTimer)
    _connectPollTimer = null
  }

  try {
    const resp = await fetch(`${BASE_URL}/api/enterprise/media-department/media/accounts/connect/${connectSessionId.value}/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({
        platform: connectingPlatform.value,
        accountName: `${connectingPlatform.value}_creator`,
      }),
    })
    const data = await resp.json()
    if (data.code === 0) {
      connectStatus.value = 'active'
      // Update platform status in list
      const p = platforms.value.find((x: any) => x.id === connectingPlatform.value)
      if (p) p.status = 'active'
    } else {
      connectStatus.value = 'error'
      connectErrorMessage.value = data.message || '绑定失败'
    }
  } catch (err: any) {
    connectStatus.value = 'error'
    connectErrorMessage.value = err.message || '网络错误'
  }
}

async function cancelConnect() {
  if (_connectPollTimer) {
    clearInterval(_connectPollTimer)
    _connectPollTimer = null
  }
  if (connectSessionId.value) {
    await fetch(`${BASE_URL}/api/enterprise/media-department/media/accounts/connect/${connectSessionId.value}/cancel`, { method: 'POST' })
  }
  showConnectModal.value = false
  connectSessionId.value = ''
  connectingPlatform.value = null
  connectingPlatfrm.value = null
}

async function retryConnect() {
  if (connectingPlatfrm.value) {
    await openConnectModal(connectingPlatfrm.value)
  }
}

async function disconnectPlatform(p: any) {
  if (confirm(`确认断开与 ${p.name} 的连接吗？AI 员工将无法继续操作该账号。`)) {
    // Phase 2: call API to disconnect
    p.status = 'none'
    alert(`${p.name} 已断开`)
  }
}

async function loadPlatformStatus() {
  try {
    const resp = await fetch(`${BASE_URL}/api/enterprise/media-department/media/accounts/health?platform=xiaohongshu`, { headers: getAuthHeaders() })
    const data = await resp.json()
    if (data.code === 0 && data.data.hasAccount) {
      const p = platforms.value.find((x: any) => x.id === 'xiaohongshu')
      if (p) p.status = data.data.accountStatus || 'none'
    }
  } catch (err) {
    // Ignore health check errors
  }
}

async function loadPlans() {
  try {
    const resp = await fetch(`${BASE_URL}/api/plans`)
    const data = await resp.json()
    if (data.code === 0 && data.data) {
      plans.value = data.data
    }
  } catch (err) {
    console.warn('[Settings] Failed to load plans:', err)
  }
}

function upgradePlan(plan: any) {
  alert(`升级到「${plan.displayName}」需要支付 ¥${(plan.priceMonthly / 100).toFixed(0)}/月`)
}

onMounted(() => {
  const token = getToken()
  if (token) {
    isLoggedIn.value = true
  }
  loadPlatformStatus()
  loadPlans()
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

.section-desc {
  font-size: 0.85rem;
  color: rgba(248, 246, 241, 0.4);
  margin-bottom: 16px;
}

.settings-section {
  margin-bottom: 40px;
  padding: 24px;
  background: rgba(248, 246, 241, 0.02);
  border: 1px solid rgba(248, 246, 241, 0.06);
  border-radius: 16px;
}

.form-row {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
}

.form-row label {
  font-size: 0.85rem;
  color: rgba(248, 246, 241, 0.6);
  width: 80px;
  flex-shrink: 0;
}

.form-input {
  flex: 1;
  padding: 10px 14px;
  background: rgba(248, 246, 241, 0.05);
  border: 1px solid rgba(248, 246, 241, 0.1);
  border-radius: 8px;
  color: #F8F6F1;
  font-size: 0.9rem;
  font-family: inherit;
}

.form-input:focus {
  outline: none;
  border-color: #C9A86C;
}

.plan-display {
  font-size: 0.9rem;
  color: #C9A86C;
  font-weight: 600;
}

.platforms-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 12px;
}

.platform-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  background: rgba(248, 246, 241, 0.03);
  border: 1px solid rgba(248, 246, 241, 0.06);
  border-radius: 10px;
}

.platform-icon {
  font-size: 1.2rem;
}

.platform-name {
  font-size: 0.85rem;
  flex: 1;
}

.plans-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}

.plan-card {
  padding: 24px;
  background: rgba(248, 246, 241, 0.03);
  border: 1px solid rgba(248, 246, 241, 0.06);
  border-radius: 12px;
  text-align: center;
}

.plan-card.plan-active {
  border-color: #C9A86C;
}

.plan-card h3 {
  font-size: 1.1rem;
  margin: 0 0 8px;
}

.plan-price {
  font-size: 1.3rem;
  font-weight: 700;
  color: #C9A86C;
  margin: 0 0 16px;
}

.plan-features {
  list-style: none;
  padding: 0;
  margin: 0 0 20px;
  text-align: left;
}

.plan-features li {
  font-size: 0.82rem;
  color: rgba(248, 246, 241, 0.6);
  padding: 4px 0;
}

.plan-features li::before {
  content: '✓ ';
  color: #22C55E;
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
  padding: 6px 14px;
  font-size: 0.78rem;
}

.platform-status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.platform-status-dot.active {
  background: #22C55E;
  box-shadow: 0 0 6px rgba(34, 197, 94, 0.4);
}

.platform-status-dot.expired {
  background: #EF4444;
}

.platform-connected {
  border-color: rgba(34, 197, 94, 0.3);
  background: rgba(34, 197, 94, 0.05);
}

.platform-expired {
  border-color: rgba(239, 68, 68, 0.2);
}

/* Connect modal */
.connect-modal {
  max-width: 500px;
  width: 90%;
  padding: 0;
  overflow: hidden;
}

.connect-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid rgba(248, 246, 241, 0.06);
}

.connect-header h3 {
  margin: 0;
  font-size: 1.1rem;
}

.btn-close {
  background: none;
  border: none;
  color: rgba(248, 246, 241, 0.5);
  font-size: 1.5rem;
  cursor: pointer;
  padding: 0;
  line-height: 1;
}

.btn-close:hover {
  color: #F8F6F1;
}

.connect-body {
  padding: 24px;
  min-height: 200px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
}

.connect-waiting,
.connect-success,
.connect-done,
.connect-error {
  text-align: center;
}

.connect-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(248, 246, 241, 0.1);
  border-top-color: #C9A86C;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: 0 auto 12px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.connect-sub {
  font-size: 0.8rem;
  color: rgba(248, 246, 241, 0.4);
  margin: 0;
}

.connect-screenshot img {
  max-width: 100%;
  border-radius: 8px;
  border: 1px solid rgba(248, 246, 241, 0.1);
}

.success-icon,
.error-icon {
  font-size: 2rem;
}

.connect-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 24px;
  border-top: 1px solid rgba(248, 246, 241, 0.06);
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

  .form-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }

  .form-row label {
    width: auto;
  }

  .connect-modal {
    width: 95%;
  }
}
</style>
