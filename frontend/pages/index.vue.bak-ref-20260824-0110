<template>
  <div class="landing-page">
    <!-- 顶部导航（全局骨架，由 Page 层维护） -->
    <KunlunNav
      :is-logged-in="isLoggedIn"
      @show-login="openLogin"
      @show-register="openRegister"
      @logout="doLogout"
    />

    <!-- 昆仑镜 Scene 编排（所有视觉内容由 Scene 组件负责） -->
    <div class="kunlun-scenes">
      <SceneErrorBoundary name="HeroScene" min-height="100vh">
        <HeroScene />
      </SceneErrorBoundary>
      <SceneErrorBoundary name="ChoiceLiberationScene" min-height="60vh">
        <ChoiceLiberationScene />
      </SceneErrorBoundary>
      <SceneErrorBoundary name="WorkbenchUniverseScene" min-height="80vh">
        <WorkbenchUniverseScene />
      </SceneErrorBoundary>
      <SceneErrorBoundary name="WenquxingScene" min-height="60vh">
        <WenquxingScene />
      </SceneErrorBoundary>
      <SceneErrorBoundary name="CreationLawScene" min-height="60vh">
        <CreationLawScene />
      </SceneErrorBoundary>
      <SceneErrorBoundary name="FourStepScene" min-height="60vh">
        <FourStepScene />
      </SceneErrorBoundary>
      <SceneErrorBoundary name="CreatorVoicesScene" min-height="40vh">
        <CreatorVoicesScene />
      </SceneErrorBoundary>
      <SceneErrorBoundary name="EnterpriseGrowthScene" min-height="50vh">
        <EnterpriseGrowthBanner />
      </SceneErrorBoundary>
      <SceneErrorBoundary name="FinalCTAScene" min-height="40vh">
        <FinalCTAScene />
      </SceneErrorBoundary>
    </div>

    <!-- Footer -->
    <KunlunFooter />

    <!-- ==================== 登录/注册 Modal（公共组件 AuthModal，与商城等页面统一） ==================== -->
    <AuthModal v-model="showLogin" :initial-mode="authInitialMode" @logged-in="onAuthLoggedIn" />
  </div>
</template>

<script setup lang="ts">
import { getAuthToken } from '~/utils/auth/token'
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'

// 显式导入组件（Nuxt auto-import 命名规则 <目录><文件> 与模板名不匹配）
import KunlunNav from '~/components/kunlun/business/KunlunNav.vue'
import KunlunFooter from '~/components/kunlun/business/KunlunFooter.vue'
import SceneErrorBoundary from '~/components/kunlun/common/SceneErrorBoundary.vue'
import HeroScene from '~/components/kunlun/scenes/HeroScene.vue'
import ChoiceLiberationScene from '~/components/kunlun/scenes/ChoiceLiberationScene.vue'
import WorkbenchUniverseScene from '~/components/kunlun/scenes/WorkbenchUniverseScene.vue'
import WenquxingScene from '~/components/kunlun/scenes/WenquxingScene.vue'
import CreationLawScene from '~/components/kunlun/scenes/CreationLawScene.vue'
import FourStepScene from '~/components/kunlun/scenes/FourStepScene.vue'
import CreatorVoicesScene from '~/components/kunlun/scenes/CreatorVoicesScene.vue'
import FinalCTAScene from '~/components/kunlun/scenes/FinalCTAScene.vue'
import EnterpriseGrowthBanner from '~/components/kunlun/scenes/EnterpriseGrowthBanner.vue'
import AuthModal from '~/components/kunlun/business/AuthModal.vue'

const router = useRouter()
const showLogin = ref(false)
// 登录弹窗初始模式（登录/注册 tab），由 KunlunNav 事件或 URL 参数驱动
const authInitialMode = ref<'login' | 'register'>('login')
const userDropdownOpen = ref(false)
const isLoggedIn = ref(false)

function openLogin() { authInitialMode.value = 'login'; showLogin.value = true }
function openRegister() { authInitialMode.value = 'register'; showLogin.value = true }

// SPRINT-MEDIA-IDENTITY-ALIGN-01 401-FIX: 登录/注册成功后回跳 redirect query（auth middleware 携带）
function redirectAfterAuth() {
  const p = new URLSearchParams(window.location.search)
  const target = p.get('redirect')
  if (target && target.startsWith('/')) {
    setTimeout(() => { window.location.href = target }, 200)
  } else {
    setTimeout(() => router.push('/'), 200)
  }
}

// AuthModal 登录/注册成功（含 QQ/微信）：恢复登录态后按首页逻辑回跳
function onAuthLoggedIn() {
  isLoggedIn.value = true
  redirectAfterAuth()
}

interface AuthUser {
  memberTier?: string
  email?: string
  username?: string
  coins?: number
  memberExpiresAt?: string
  [key: string]: any
}
const authUser = ref<AuthUser | null>(null)

// VIP 等级配置
const tierConfig: Record<string, { label: string }> = {
  free: { label: '体验版' },
  basic: { label: '基础版' },
  pro: { label: '本地版' },
  enterprise: { label: '年卡' },
}
const tierClass = computed(() => {
  const tier = authUser.value?.memberTier || 'free'
  return tierConfig[tier] ? tier : 'free'
})
const tierLabel = computed(() => tierConfig[tierClass.value]?.label || '体验版')
const avatarChar = computed(() => {
  return (authUser.value?.username || authUser.value?.email || 'U').charAt(0).toUpperCase()
})

function goToStudio() {
  router.push('/studio/v2')
}

function doLogout() {
  // 统一清除所有 token 缓存
  ;['accessToken', 'auth_token', 'auth_user', 'token', 'refreshToken'].forEach(k => {
    try { localStorage.removeItem(k) } catch {}
  })
  ;['auth_token', 'auth_user', 'token', 'accessToken', 'refreshToken'].forEach(k => {
    document.cookie = `${k}=; path=/; max-age=0; samesite=lax`
  })
  try { sessionStorage.clear() } catch {}
  isLoggedIn.value = false
  showLogin.value = false
  window.location.href = '/?logout=1'
}

// ── 全局初始化 ──
onMounted(() => {
  // 🔧 紧急修复：强制 body/html 可滚动（修复某些 CSS 组合锁定滚动的问题）
  document.documentElement.style.overflow = 'auto'
  document.documentElement.style.height = 'auto'
  document.body.style.overflow = 'auto'
  document.body.style.height = 'auto'
  setTimeout(() => {
    const landing = document.querySelector('.landing-page') as HTMLElement
    if (landing) {
      landing.style.minHeight = '100vh'
      landing.style.height = 'auto'
      landing.style.overflowX = 'hidden'
      landing.style.overflowY = 'auto'
    }
  }, 50)
  console.log('[HOME] mounted — scroll fix applied', window.location.pathname)

  // 恢复登录态
  const token = getAuthToken()
  isLoggedIn.value = !!token
  const authUserRaw = localStorage.getItem('auth_user')
  if (authUserRaw) { try { authUser.value = JSON.parse(authUserRaw) } catch {} }

  // URL 参数触发登录弹窗
  const params = new URLSearchParams(window.location.search)
  if (params.get('showLogin') === '1') {
    showLogin.value = true
    authInitialMode.value = params.get('register') === '1' ? 'register' : 'login'
  }

  // ⭐ 只要有 token，就从 /api/auth/me 获取完整用户信息（覆盖可能不完整的 QQ 登录缓存）
  if (token) {
    fetch('/api/auth/me', { headers: { 'Authorization': `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => {
        const userData = d.data?.user || d.user
        if (userData) {
          authUser.value = userData
          localStorage.setItem('auth_user', JSON.stringify(userData))
        }
      })
      .catch(() => {})
  }
})
</script>

<style>
/* ========================================
   昆仑镜首页全局样式
   所有视觉实现已委托至 Scene 组件
   此处仅保留：
   1. 深空背景与全局 CSS 变量
   2. 基础排版
   3. Lenis smooth scroll 样式
   ======================================== */

/* ── Design Token Override ── */
:root {
  --kl-bg-primary: #08131F;
  --kl-bg-secondary: #0E1D31;
  --kl-gold-main: #C9A86C;
  --kl-gold-light: #E2C88A;
  --kl-cyan-main: #00D4FF;
  --kl-cyan-light: #00F0FF;
  --kl-paper-white: #F8F6F1;
  --kl-prism-purple: #A78BFA;
  --kl-prism-pink: #F472B6;
  --kl-prism-green: #34D399;
}

/* ── 深空基底 ── */
.landing-page {
  position: relative;
  min-height: 100vh;
  background: var(--kl-bg-primary, #08131F);
  color: var(--kl-paper-white, #F8F6F1);
  font-family:
    'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei',
    -apple-system, BlinkMacSystemFont, sans-serif;
  overflow-x: hidden;
}

/* ── Lenis smooth scroll ── */
html.lenis {
  scroll-behavior: auto;
}

html.lenis-smooth {
  scroll-behavior: auto;
}

.lenis {
  height: 100%;
}

/* ── 登录弹窗样式 ── */
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
  background: rgba(0,0,0,0.7);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
}
.modal-card {
  background: #0d0d12;
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 20px;
  width: 380px;
  padding: 40px 32px 32px;
  position: relative;
}
.modal-close {
  position: absolute;
  top: 16px;
  right: 16px;
  background: none;
  border: none;
  color: rgba(255,255,255,0.3);
  font-size: 1rem;
  cursor: pointer;
}
.modal-close:hover { color: #fff; }
.modal-header { text-align: center; margin-bottom: 24px; }
.modal-header .logo-icon { display: flex; align-items: center; justify-content: center; margin-bottom: 12px; }
.modal-logo-img { width: 48px; height: 48px; }
.modal-header h2 { font-size: 1.2rem; font-weight: 600; color: #fff; margin: 0 0 6px; }
.modal-header p { font-size: 0.8rem; color: rgba(255,255,255,0.35); margin: 0; }
.modal-tabs {
  display: flex;
  background: rgba(255,255,255,0.02);
  border-radius: 10px;
  padding: 3px;
  margin-bottom: 24px;
}
.tab-btn {
  flex: 1;
  padding: 8px;
  border: none;
  border-radius: 8px;
  font-size: 0.82rem;
  cursor: pointer;
  background: transparent;
  color: rgba(255,255,255,0.3);
  transition: all 0.2s;
}
.tab-active {
  background: rgba(249,115,22,0.15);
  color: #f97316;
}
.modal-form .form-group { margin-bottom: 16px; }
.modal-form label { display: block; font-size: 0.75rem; color: rgba(255,255,255,0.4); margin-bottom: 6px; }
.form-input {
  width: 100%;
  box-sizing: border-box;
  background: rgba(255,255,255,0.02);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 10px;
  padding: 10px 14px;
  font-size: 0.85rem;
  color: rgba(255,255,255,0.7);
  outline: none;
  transition: border-color 0.2s;
}
.form-input:focus { border-color: rgba(249,115,22,0.4); }
.form-error { color: #ef4444; font-size: 0.78rem; margin-bottom: 12px; text-align: center; }
.form-success { color: #22c55e; font-size: 0.78rem; margin-bottom: 12px; text-align: center; }
.sms-code-row {
  display: flex;
  gap: 8px;
}
.sms-code-input { flex: 1; }
.btn-sm-code {
  white-space: nowrap;
  min-width: 100px;
  height: 40px;
  font-size: 0.78rem;
}
.reset-pwd-link {
  text-align: center;
  margin-top: 12px;
  font-size: 0.78rem;
  color: rgba(96,165,250,0.6);
  cursor: pointer;
  transition: color 0.2s;
}
.reset-pwd-link:hover { color: #60a5fa; }
.btn-full { width: 100%; justify-content: center; padding: 11px; }
.btn-ghost { background: transparent; color: rgba(255,255,255,0.5); }
.btn-ghost:hover { color: rgba(255,255,255,0.8); }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; transform: none; box-shadow: none; }
.wechat-divider {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 16px 0 12px;
}
.divider-line { flex: 1; height: 1px; background: rgba(255,255,255,0.08); }
.divider-text { font-size: 11px; color: rgba(255,255,255,0.3); white-space: nowrap; }
.social-login-row { display: flex; flex-direction: column; gap: 8px; }
.social-icon { font-size: 16px; }
</style>

// ===== PATCH: 统一退出登录 =====
function doLogout() {
  // 清除所有 localStorage 中的 token
  ;['accessToken', 'auth_token', 'auth_user', 'token', 'refreshToken'].forEach(k => {
    try { localStorage.removeItem(k) } catch {}
  })
  // 清除所有相关的 cookie
  ;['auth_token', 'auth_user', 'token', 'accessToken', 'refreshToken'].forEach(k => {
    document.cookie = `${k}=; path=/; max-age=0; samesite=lax; domain=.fushtn.com`
    document.cookie = `${k}=; path=/; max-age=0; samesite=lax`
  })
  // 尝试清 sessionStorage
  try { sessionStorage.clear() } catch {}
  isLoggedIn.value = false
  showLogin.value = false
  window.location.href = '/?logout=1'
}
