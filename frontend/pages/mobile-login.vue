<template>
  <div class="ml-page">
    <!-- 品牌区 -->
    <div class="ml-brand">
      <div class="ml-logo">🍵</div>
      <div class="ml-name">昆仑茶馆</div>
      <div class="ml-slogan">云端茶馆 · 谈天论道</div>
    </div>

    <!-- 登录卡片 -->
    <div class="ml-card">
      <!-- 登录方式切换 -->
      <div class="ml-tabs">
        <div class="ml-tab" :class="{ active: mode === 'account' }" @click="mode = 'account'">账号登录</div>
        <div class="ml-tab" :class="{ active: mode === 'phone' }" @click="mode = 'phone'">手机号登录</div>
      </div>

      <div class="ml-form">
        <div class="ml-field">
          <label>{{ mode === 'account' ? '邮箱' : '手机号' }}</label>
          <input
            v-model="account"
            class="ml-input"
            :type="mode === 'account' ? 'email' : 'tel'"
            :placeholder="mode === 'account' ? '请输入邮箱' : '请输入手机号'"
            autocomplete="username"
          />
        </div>

        <div class="ml-field">
          <label>密码</label>
          <div class="ml-pwd-wrap">
            <input
              v-model="password"
              class="ml-input ml-pwd"
              :type="showPwd ? 'text' : 'password'"
              placeholder="请输入密码"
              autocomplete="current-password"
              @keyup.enter="doLogin"
            />
            <span class="ml-eye" @click="showPwd = !showPwd">{{ showPwd ? '🙈' : '👁️' }}</span>
          </div>
        </div>

        <div class="ml-row">
          <label class="ml-remember">
            <input type="checkbox" v-model="remember" />
            <span>记住我</span>
          </label>
        </div>

        <div v-if="error" class="ml-error">{{ error }}</div>

        <button class="ml-btn" :disabled="loading" @click="doLogin">
          {{ loading ? '登录中…' : '登 录' }}
        </button>
      </div>

      <!-- 第三方登录 -->
      <div v-if="qqStatus.enabled" class="ml-oauth">
        <div class="ml-divider"><span>其他登录方式</span></div>
        <button class="ml-qq-btn" :disabled="qqLoading" @click="qqLogin">
          <span class="ml-qq-icon">🐧</span>
          <span>{{ qqLoading ? '跳转中…' : 'QQ 登录' }}</span>
        </button>
        <button v-if="hasQqPending" type="button" class="ml-qq-btn ml-qq-btn-alt" :disabled="qqLoading" @click.stop.prevent="qqManualComplete">
          <span>{{ qqLoading ? '登录中…' : '✅ 我在QQ已完成授权，点此登录' }}</span>
        </button>
        <div v-if="hasQqPending" class="ml-qq-hint">在QQ完成授权后，点击上方按钮即可登录（也可稍候自动登录）。</div>
      </div>
    </div>

    <div class="ml-register">
      还没有账号？<span class="ml-register-link" @click="goRegister">立即注册</span>
    </div>

    <div class="ml-footer">
      <span @click="goHome">← 返回手机版首页</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useAuthStore } from '~/stores/auth'
import { safeRedirect } from '~/utils/mobile-detect'

definePageMeta({ middleware: 'auth' })

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const mode = ref<'account' | 'phone'>('account')
const account = ref('')
const password = ref('')
const showPwd = ref(false)
const remember = ref(true)
const loading = ref(false)
const error = ref('')

// ── QQ 登录 ──
const qqStatus = ref({ enabled: false, appId: '' })
const qqLoading = ref(false)
let oauthListener: ((e: MessageEvent) => void) | null = null

// 原生APP：用 Capacitor Browser 插件在外部浏览器打开 QQ 授权，保持 WebView 在你本地壳上
async function openQqBrowser(url: string) {
  try {
    const cap: any = (window as any).Capacitor
    if (cap?.Plugins?.Browser?.open) {
      await cap.Plugins.Browser.open({ url })
      return
    }
  } catch (e) { console.warn('[QQ] Browser.open 失败，回退 window.open', e) }
  window.open(url, '_blank')
}

function startOAuth(authUrl: string, state: string, onSuccess: (token: string, user: any) => void, onError: (err: string) => void) {
  const isNative = !!(window as any).Capacitor?.isNativePlatform?.()
  const isMobileUA = /mobile|android|iphone|ipad/i.test(navigator.userAgent || '')
  const needServerRelay = isNative || isMobileUA
  // 手机/原生APP：用 Capacitor Browser 插件在【系统外部浏览器】打开 QQ 授权
  //   ——用 window.open 会在 WebView 内跳走，离开本地壳 origin(https://localhost)，token 落不到APP → 登录不成功
  //   ——Browser.open 在外部浏览器完成，APP 的 WebView 始终停在壳上；返回后轮询服务端取回 token
  if (needServerRelay) {
    qqActiveState.value = state
    try { localStorage.setItem('kl_qq_state', state) } catch {}
    completeQqLogin(state, onSuccess, onError)   // 服务端中继轮询（一直在壳上跑，APP 后台恢复也继续）
    openQqBrowser(authUrl)
    return
  }
  const w = window.open(authUrl, '_blank', 'width=600,height=700')
  if (!w) { window.location.href = authUrl; return }
  if (oauthListener) window.removeEventListener('message', oauthListener)
  oauthListener = (e: MessageEvent) => {
    if (e.origin !== window.location.origin) return
    if (e.data?.type === 'OAUTH_LOGIN') { onSuccess(e.data.token, e.data.user); window.removeEventListener('message', oauthListener); oauthListener = null }
    else if (e.data?.type === 'OAUTH_ERROR') { onError(e.data.error); window.removeEventListener('message', oauthListener); oauthListener = null }
  }
  window.addEventListener('message', oauthListener)
  const pollClose = setInterval(() => {
    if (w.closed) {
      clearInterval(pollClose)
      if (oauthListener) { window.removeEventListener('message', oauthListener); oauthListener = null }
      // 桌面 Web fallback: popup 关闭后检查 localStorage（同源共享）
      const storedToken = localStorage.getItem('auth_token') || localStorage.getItem('accessToken') || localStorage.getItem('token')
      const storedUser = localStorage.getItem('auth_user')
      if (storedToken && !oauthListener) {
        try {
          const { setToken, setUser } = require('~/utils/token-cache') as typeof import('~/utils/token-cache')
          setToken(storedToken)
          const user = storedUser ? JSON.parse(storedUser) : { username: '用户' }
          setUser(user)
          onSuccess(storedToken, user)
        } catch { qqLoading.value = false }
      } else {
        qqLoading.value = false
      }
    }
  }, 1000)
}

// 服务端中继取回：QQ 授权在浏览器/QQApp 完成后，token 经 /api/auth/qq/desktop-result 取回（结果保留 180s，可重复取）
let qqPollTimer: any = null
let qqPollTimers: any[] = []
const qqActiveState = ref('')
const qqDone = ref(false)
const hasQqPending = computed(() => {
  if (qqDone.value) return false
  if (qqActiveState.value) return true
  try { return !!localStorage.getItem('kl_qq_state') } catch { return false }
})
function stopQqPoll() { (qqPollTimers||[]).forEach(t=>{try{clearInterval(t)}catch{}}); qqPollTimers = []; qqPollTimer = null }
function completeQqLogin(state: string, onSuccess: (token: string, user: any) => void, onError: (err: string) => void) {
  if (qqDone.value) return
  if (qqActiveState.value && qqActiveState.value !== state) { /* 换新登录，先停掉旧的 */ stopQqPoll() }
  if (qqPollTimer && qqActiveState.value === state) return // 同 state 已在轮询，不重复起
  qqActiveState.value = state
  let elapsed = 0
  const poll = async () => {
    elapsed += 1500
    if (qqDone.value) { stopQqPoll(); return }
    if (elapsed > 180000) { stopQqPoll(); qqLoading.value = false; onError('QQ 登录超时，请在QQ完成授权后点下方按钮') ; return }
    try {
      const r = await fetch('/api/auth/qq/desktop-result?state=' + encodeURIComponent(state))
      const j = await r.json()
      const d = j.data || j
      if (d && d.token) {
        qqDone.value = true; stopQqPoll()
        onSuccess(d.token, d.user || { username: 'QQ用户' })
      } else if (d && d.bindToken) {
        qqDone.value = true; stopQqPoll()
        onError('need_bind')
      }
    } catch { /* 网络抖动忽略，继续 */ }
  }
  const iv = setInterval(poll, 1500)
  qqPollTimers.push(iv); qqPollTimer = iv
  poll()
}

// 手动“我已完成授权”按钮：用户从QQ返回后再次确认，主动取token（对APP后台暂停JS最稳）
async function qqManualComplete() {
  // 取当前state：内存或localStorage兜底（页面可能重载过）
  const st = qqActiveState.value || (() => { try { return localStorage.getItem('kl_qq_state') || '' } catch { return '' } })()
  qqActiveState.value = st
  qqLoading.value = true
  error.value = ''
  try {
    if (!st) { qqLoading.value = false; error.value = '未找到QQ登录记录，请重新点QQ登录'; return }
    const r = await fetch('/api/auth/qq/desktop-result?state=' + encodeURIComponent(st))
    const j = await r.json()
    const d = j.data || j
    if (d && d.token) {
      qqDone.value = true; stopQqPoll()
      await doQqLoginSuccess(d.token, d.user || { username: 'QQ用户' })
    } else if (d && d.bindToken) {
      qqDone.value = true; stopQqPoll(); qqLoading.value = false
      error.value = '该QQ需先绑定手机号'
    } else {
      qqLoading.value = false
      error.value = '尚未检测到授权完成，请先在QQ完成授权后再试'
    }
  } catch (e: any) { qqLoading.value = false; error.value = '网络错误：' + ((e && e.message) || '请重试') }
}


async function qqLogin() {
  if (!qqStatus.value.enabled) return
  qqLoading.value = true; error.value = ''
  try {
    // 手机/APP：mobile=1 → QQ 移动端授权（唤起手机QQ），不再跳 PC 浏览器扫码
    const isNative = !!(window as any).Capacitor?.isNativePlatform?.()
    const isMobileUA = /mobile|android|iphone|ipad/i.test(navigator.userAgent || '')
    const q = (isNative || isMobileUA) ? '?mobile=1' : ''
    const r = await fetch('/api/auth/qq/authorize' + q)
    const data = await r.json()
    const authUrl = data.data?.authUrl || data.authUrl
    if (!authUrl) { error.value = data.error || 'QQ 登录启动失败'; qqLoading.value = false; return }
    const oauthState = data.data?.state || data.state || ''
    startOAuth(authUrl, oauthState, (token, user) => { doQqLoginSuccess(token, user) }, (err) => { error.value = err === 'need_bind' ? '该QQ需先绑定手机号' : err; qqLoading.value = false })
  } catch {
    error.value = 'QQ 登录暂时不可用'; qqLoading.value = false
  }
}

// QQ 登录成功后的统一处理：先落 localStorage（最可靠），再同步硬跳转进手机APP
async function doQqLoginSuccess(token: string, user: any) {
  try { window.localStorage?.setItem('auth_token', token) } catch {}
  try { window.localStorage?.setItem('auth_user', JSON.stringify(user || {})) } catch {}
  try { document.cookie = `auth_token=${token}; path=/; max-age=604800; samesite=lax` } catch {}
  // 立即停止轮询并清掉状态，随后【同步】硬跳转（不等任何 await，避免卡“登录中”/重复轮询）
  try { stopQqPoll(); window.localStorage?.removeItem('kl_qq_state') } catch {}
  try {
    const { setToken, setUser } = await import('~/utils/token-cache')
    setToken(token); setUser(user || { username: 'QQ用户' })
  } catch {}
  qqLoading.value = false
  // 重新加载当前 SPA 文档：启动后 native 中间件自动进 /mobile-app 并读 auth_token 免登录
  // 不能用 location.replace('/mobile-app')：那是客户端路由，原生静态包 WebView 硬跳会 404/乱码
  try { window.location.reload() } catch {}
}

function goRegister() {
  router.push('/mobile-register')
}

onMounted(() => {
  fetch('/api/auth/qq/status?mobile=1')
    .then(r => r.json())
    .then(d => { if (d.data) qqStatus.value = d.data })
    .catch(() => {})
  // 从QQ/浏览器返回APP时：若仍有未完成的QQ登录，恢复轮询并在取得token后自动登录
  try {
    const saved = localStorage.getItem('kl_qq_state')
    if (saved && !qqActiveState.value) { qqActiveState.value = saved; completeQqLogin(saved, (t, u) => doQqLoginSuccess(t, u), () => {}) }
  } catch {}
  try {
    const cap: any = (window as any).Capacitor
    if (cap?.App?.addListener) {
      cap.App.addListener('appStateChange', (s: any) => {
        if (s?.isActive && qqActiveState.value && !qqDone.value) qqManualComplete()
      })
    }
    if (cap?.Plugins?.Browser?.addListener) {
      cap.Plugins.Browser.addListener('browserFinished', () => {
        if (qqActiveState.value && !qqDone.value) qqManualComplete()
      })
    }
  } catch {}
})

async function doLogin() {
  const acc = account.value.trim()
  if (!acc) { error.value = '请输入' + (mode.value === 'account' ? '邮箱' : '手机号'); return }
  if (!password.value) { error.value = '请输入密码'; return }
  error.value = ''
  loading.value = true
  try {
    if (mode.value === 'account') {
      await auth.login(acc, password.value)
    } else {
      await auth.loginByPhone(acc, password.value)
    }
    const target = safeRedirect(route.query.redirect, '/mobile-app')
    await router.replace(target)
  } catch (e: any) {
    error.value = e?.message || '登录失败，请检查账号密码'
  } finally {
    loading.value = false
  }
}

function goHome() {
  router.replace('/mobile')
}
</script>

<style scoped>
.ml-page {
  min-height: 100vh;
  background: linear-gradient(160deg, #0b3d2e 0%, #14532d 35%, #166534 70%, #14532d 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px 24px calc(32px + env(safe-area-inset-bottom));
  box-sizing: border-box;
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Helvetica Neue', sans-serif;
}
.ml-brand { text-align: center; margin-bottom: 36px; }
.ml-logo {
  width: 76px; height: 76px;
  margin: 0 auto 14px;
  border-radius: 22px;
  background: linear-gradient(135deg, #fbbf24, #f59e0b);
  display: flex; align-items: center; justify-content: center;
  font-size: 40px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.35);
}
.ml-name { color: #fff; font-size: 26px; font-weight: 700; letter-spacing: 2px; }
.ml-slogan { color: rgba(255,255,255,0.72); font-size: 13px; margin-top: 6px; }

.ml-card {
  width: 100%;
  max-width: 420px;
  background: #fff;
  border-radius: 20px;
  padding: 26px 22px 30px;
  box-shadow: 0 16px 48px rgba(0,0,0,0.3);
  box-sizing: border-box;
}
.ml-tabs {
  display: flex;
  background: #f1f5f3;
  border-radius: 12px;
  padding: 4px;
  margin-bottom: 24px;
}
.ml-tab {
  flex: 1;
  text-align: center;
  padding: 10px 0;
  font-size: 15px;
  font-weight: 600;
  color: #64748b;
  border-radius: 9px;
  cursor: pointer;
  transition: all 0.2s;
}
.ml-tab.active { background: #fff; color: #166534; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }

.ml-field { margin-bottom: 18px; }
.ml-field label { display: block; font-size: 13px; color: #475569; margin-bottom: 8px; font-weight: 500; }
.ml-input {
  width: 100%;
  height: 50px;
  border: 1.5px solid #e2e8f0;
  border-radius: 12px;
  padding: 0 14px;
  font-size: 16px;
  color: #0f172a;
  outline: none;
  background: #f8fafc;
  box-sizing: border-box;
  transition: border-color 0.2s;
}
.ml-input:focus { border-color: #22c55e; background: #fff; }
.ml-pwd-wrap { position: relative; }
.ml-pwd { padding-right: 48px; }
.ml-eye {
  position: absolute; right: 14px; top: 50%; transform: translateY(-50%);
  font-size: 18px; cursor: pointer; user-select: none;
}

.ml-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.ml-remember { display: flex; align-items: center; gap: 6px; font-size: 13px; color: #64748b; cursor: pointer; }
.ml-remember input { accent-color: #16a34a; width: 15px; height: 15px; }

.ml-error {
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #dc2626;
  font-size: 13px;
  border-radius: 10px;
  padding: 10px 12px;
  margin-bottom: 16px;
}

.ml-btn {
  width: 100%;
  height: 52px;
  border: none;
  border-radius: 13px;
  background: linear-gradient(135deg, #16a34a, #15803d);
  color: #fff;
  font-size: 17px;
  font-weight: 700;
  letter-spacing: 6px;
  cursor: pointer;
  box-shadow: 0 8px 20px rgba(22,163,74,0.35);
  transition: transform 0.15s, opacity 0.2s;
}
.ml-btn:active { transform: scale(0.98); }
.ml-btn:disabled { opacity: 0.6; }

/* ── QQ 登录 ── */
.ml-oauth { margin-top: 22px; }
.ml-divider { display: flex; align-items: center; gap: 10px; color: #94a3b8; font-size: 12px; margin-bottom: 14px; }
.ml-divider::before, .ml-divider::after { content: ''; flex: 1; height: 1px; background: #e2e8f0; }
.ml-qq-btn {
  width: 100%; height: 48px;
  border: 1.5px solid #e2e8f0; border-radius: 12px;
  background: #fff; color: #334155;
  font-size: 15px; font-weight: 600;
  display: flex; align-items: center; justify-content: center; gap: 8px;
  cursor: pointer; transition: background 0.2s, border-color 0.2s;
}
.ml-qq-btn:active { background: #f8fafc; }
.ml-qq-btn:disabled { opacity: 0.6; }
.ml-qq-btn-alt { margin-top: 10px; border-color: #4ade80; background: #f0fdf4; color: #15803d; }
.ml-qq-hint { font-size: 12px; color: #64748b; text-align: center; margin-top: 8px; line-height: 1.5; }
.ml-qq-icon { font-size: 18px; }

/* ── 注册入口 ── */
.ml-register {
  margin-top: 22px;
  font-size: 14px;
  color: rgba(255,255,255,0.85);
}
.ml-register-link { color: #fbbf24; font-weight: 600; text-decoration: underline; padding: 4px; cursor: pointer; }

.ml-footer { margin-top: 26px; font-size: 13px; color: rgba(255,255,255,0.75); cursor: pointer; }
.ml-footer span { padding: 8px 12px; }
</style>
