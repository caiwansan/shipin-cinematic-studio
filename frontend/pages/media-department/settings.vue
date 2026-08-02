<template>
  <div class="media-department">
    <KunlunNav :is-logged-in="isLoggedIn" @show-login="goLogin" @show-register="goRegister" />

    <main class="main-content">
      <div class="sub-nav">
        <NuxtLink to="/media-department" class="sub-nav-back">← 返回首页</NuxtLink>
        <h1 class="sub-nav-title">企业设置</h1>
      </div>

      <div v-if="!isLoggedIn" class="empty-state">
        <p>请先登录</p>
        <button class="btn btn-primary" @click="goLogin">登录</button>
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
              <p class="plan-price">¥{{ ((plan.price ?? plan.priceMonthly) / 100).toFixed(0) }}<span>/月</span></p>
              <ul class="plan-features">
                <li>{{ plan.maxEmployees ?? plan.maxEmployers ?? 0 }} 个 AI 员工</li>
                <li>{{ plan.maxChannels ?? 0 }} 个平台账号</li>
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
  </div>
</template>

<script setup lang="ts">
import { getAuthToken } from '~/utils/auth/token'
import { ref, computed, onMounted } from 'vue'
import KunlunNav from '~/components/kunlun/business/KunlunNav.vue'
import { KunlunMediaApi } from '~/composables/enterprise/useMediaApi'

const isLoggedIn = ref(false)
const planName = ref('')

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

// Platform connection modal state（后端 media-platform 未上线，弹窗已移除）
const showConnectModal = ref(false)
const connectingPlatform = ref<string | null>(null)

function getToken(): string {
  try { return getAuthToken() || '' } catch { return '' }
}

/** BETA-06.9.6: 统一 Auth Header — 不再手动传递 organizationId */
function getAuthHeaders(): Record<string, string> {
  const token = getToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

function goLogin() { window.location.href = '/?login=1' }
function goRegister() { window.location.href = '/?register=1' }

async function saveOrgInfo() {
  if (!orgInfo.value.name.trim()) {
    alert('请输入企业名称')
    return
  }
  try {
    const token = getToken()
    const res = await fetch('/api/enterprise', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ name: orgInfo.value.name.trim(), industry: orgInfo.value.industry }),
    })
    const d = await res.json().catch(() => ({}))
    if (res.ok) {
      alert(`企业「${orgInfo.value.name}」创建成功`)
      try {
        if (d.data?.organization?.id) localStorage.setItem('organizationId', d.data.organization.id)
        if (d.data?.tenantId) localStorage.setItem('organizationId', d.data.tenantId)
      } catch {}
      window.location.reload()
    } else {
      alert(`创建失败：${d.error || d.message || `HTTP ${res.status}`}`)
    }
  } catch (e: any) {
    alert(`创建失败：${e.message || '网络错误'}`)
  }
}

async function openConnectModal(p: any) {
  if (p.status === 'coming_soon') {
    alert(`${p.name} 平台即将在 Phase 3 支持`)
    return
  }
  // 平台账号连接后端（media-platform）尚未上线，诚实提示不发起无效请求
  alert(`${p.name} 账号连接功能正在接入中，暂未开放`)
}

async function disconnectPlatform(p: any) {
  // 平台账号断开 API 未上线，诚实提示
  alert('平台账号断开功能正在接入中，暂未开放')
}

async function loadPlatformStatus() {
  // 平台账号后端（media-platform）未上线，不调用无效端点，状态保持初始映射
  return
}

async function loadPlans() {
  try {
    // 套餐列表真实端点：/api/enterprise/subscription/available-plans（DB EnterprisePlan）
    const resp = await fetch('/api/enterprise/subscription/available-plans', {
      headers: getAuthHeaders(),
    })
    const data = await resp.json()
    if (data.success !== false && data.data) {
      plans.value = Array.isArray(data.data) ? data.data : (Array.isArray(data.data.plans) ? data.data.plans : [])
    }
  } catch (err) {
    console.warn('[Settings] Failed to load plans:', err)
  }
}

function upgradePlan(plan: any) {
  alert(`升级到「${plan.displayName}」需要支付 ¥${((plan.price ?? plan.priceMonthly) / 100).toFixed(0)}/月`)
}

onMounted(async () => {
  const token = getToken()
  if (!token) return
  isLoggedIn.value = true
  // 当前套餐来自 Subscription SSOT（不写死）
  try {
    const sub = await KunlunMediaApi.getSubscriptionCurrent()
    const d = sub.data as any
    if (d && (d.planName || d.name)) {
      planName.value = d.planName || d.name
    }
  } catch (e) {
    console.warn('[Settings] Subscription fetch failed:', e)
  }
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
