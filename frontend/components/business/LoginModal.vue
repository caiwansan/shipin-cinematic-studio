<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-card">
      <button class="modal-close" @click="$emit('close')">✕</button>
      <div class="modal-header">
        <span class="logo-icon"><img src="/logo.png" alt="昆仑镜" class="modal-logo-img" /></span>
        <h2>{{ registerMode ? '创建账号' : '登录昆仑镜' }}</h2>
        <p>{{ registerMode ? '开启 AI 影视制作之旅' : '回到你的工作空间' }}</p>
      </div>

      <div class="modal-tabs" v-if="!showResetPwd">
        <button :class="['tab-btn', !registerMode && 'tab-active']" @click="switchToLogin">登录</button>
        <button :class="['tab-btn', registerMode && 'tab-active']" @click="switchToRegister">注册</button>
      </div>

      <!-- 登录方式子标签 -->
      <div v-if="!registerMode && !showResetPwd" class="login-mode-tabs">
        <button :class="['tab-sm', loginMode === 'phone_sms' && 'tab-sm-active']" @click="loginMode = 'phone_sms'">验证码登录</button>
        <button :class="['tab-sm', loginMode === 'phone_pwd' && 'tab-sm-active']" @click="loginMode = 'phone_pwd'">密码登录</button>
      </div>

      <!-- 找回密码表单 -->
      <form v-if="showResetPwd" @submit.prevent="doResetPwd" class="modal-form">
        <div class="modal-header" style="padding:0 0 12px">
          <h2 style="font-size:1.1rem">找回密码</h2>
          <p style="font-size:0.78rem">输入手机号，通过验证码重置密码</p>
        </div>
        <div class="form-group">
          <label>手机号</label>
          <input v-model="resetPwdPhone" type="tel" placeholder="输入手机号" class="form-input" maxlength="11" />
        </div>
        <div class="form-group">
          <label>验证码</label>
          <div class="sms-code-row">
            <input v-model="resetPwdCode" type="text" placeholder="6 位验证码" class="form-input sms-code-input" maxlength="6" />
            <button type="button" class="btn btn-outline btn-sm-code" :disabled="resetPwdCountdown > 0 || resetPwdSending" @click="sendResetPwdCode">
              {{ resetPwdCountdown > 0 ? `${resetPwdCountdown}s` : '获取验证码' }}
            </button>
          </div>
        </div>
        <div class="form-group">
          <label>新密码</label>
          <input v-model="resetPwdPassword" type="password" placeholder="至少 6 位" class="form-input" />
        </div>
        <div class="form-group">
          <label>确认新密码</label>
          <input v-model="resetPwdConfirm" type="password" placeholder="再次输入新密码" class="form-input" />
        </div>
        <p v-if="authError" class="form-error">{{ authError }}</p>
        <p v-if="authSuccess" class="form-success">{{ authSuccess }}</p>
        <button type="submit" class="btn btn-primary btn-full" :disabled="resetPwdLoading">
          {{ resetPwdLoading ? '处理中...' : '确认重置' }}
        </button>
        <button type="button" class="btn btn-ghost btn-full" style="margin-top:8px" @click="cancelResetPwd">返回登录</button>
      </form>

      <!-- 注册表单（仅手机号+验证码） -->
      <form v-else-if="registerMode" @submit.prevent="doRegister" class="modal-form">
        <div class="form-group">
          <label>手机号</label>
          <input v-model="smsPhone" type="tel" placeholder="输入手机号" class="form-input" maxlength="11" />
        </div>
        <div class="form-group">
          <label>验证码</label>
          <div class="sms-code-row">
            <input v-model="smsCode" type="text" placeholder="6 位验证码" class="form-input sms-code-input" maxlength="6" />
            <button type="button" class="btn btn-outline btn-sm-code" :disabled="smsCountdown > 0 || smsLoading" @click="sendSmsCode">
              {{ smsCountdown > 0 ? `${smsCountdown}s` : '获取验证码' }}
            </button>
          </div>
        </div>
        <p v-if="authError" class="form-error">{{ authError }}</p>
        <p v-if="authSuccess" class="form-success">{{ authSuccess }}</p>
        <button type="submit" class="btn btn-primary btn-full" :disabled="authLoading">
          {{ authLoading ? '处理中...' : '注册并进入' }}
        </button>
      </form>

      <!-- 登录表单 -->
      <form v-else @submit.prevent="doAuth" class="modal-form">
        <div class="form-group">
          <label>手机号</label>
          <input v-model="smsPhone" type="tel" placeholder="输入手机号" class="form-input" maxlength="11" />
        </div>
        <div v-if="loginMode === 'phone_sms'" class="form-group">
          <label>验证码</label>
          <div class="sms-code-row">
            <input v-model="smsCode" type="text" placeholder="6 位验证码" class="form-input sms-code-input" maxlength="6" />
            <button type="button" class="btn btn-outline btn-sm-code" :disabled="smsCountdown > 0 || smsLoading" @click="sendSmsCode">
              {{ smsCountdown > 0 ? `${smsCountdown}s` : '获取验证码' }}
            </button>
          </div>
        </div>
        <div v-if="loginMode === 'phone_pwd'" class="form-group">
          <label>密码</label>
          <input v-model="authPassword" type="password" placeholder="输入密码" class="form-input" />
        </div>
        <p v-if="authError" class="form-error">{{ authError }}</p>
        <p v-if="authSuccess" class="form-success">{{ authSuccess }}</p>
        <button type="submit" class="btn btn-primary btn-full" :disabled="authLoading">
          {{ authLoading ? '处理中...' : '登录' }}
        </button>
        <div v-if="loginMode === 'phone_pwd'" class="reset-pwd-link" @click="openResetPwd">忘记密码？</div>
      </form>

      <template v-if="!showResetPwd && (wechatStatus.enabled || qqStatus.enabled)">
        <div class="wechat-divider">
          <span class="divider-line"></span>
          <span class="divider-text">其他</span>
          <span class="divider-line"></span>
        </div>
        <div class="social-login-row">
          <button v-if="wechatStatus.enabled" type="button" class="btn btn-outline btn-full" @click="wechatLogin" :disabled="wechatLoading">
            <span class="social-icon">💬</span>
            <span>{{ wechatLoading ? '跳转中...' : '微信登录' }}</span>
          </button>
          <button v-if="qqStatus.enabled" type="button" class="btn btn-outline btn-full" @click="qqLogin" :disabled="qqLoading">
            <span class="social-icon">🐧</span>
            <span>{{ qqLoading ? '跳转中...' : 'QQ登录' }}</span>
          </button>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { setToken, setUser } from '~/utils/token-cache'

const props = defineProps<{
  registerMode: boolean
}>()

const emit = defineEmits<{
  close: []
  'toggle-mode': []
  'login-success': []
}>()

function switchToLogin() {
  if (props.registerMode) emit('toggle-mode')
}

function switchToRegister() {
  if (!props.registerMode) emit('toggle-mode')
}

// ── 登录状态 ──
const authName = ref('')
const authEmail = ref('')
const authPassword = ref('')
const authLoading = ref(false)
const authError = ref('')
const authSuccess = ref('')

// 短信登录状态
const loginMode = ref<'phone_pwd' | 'phone_sms'>('phone_sms')
const smsPhone = ref('')
const smsCode = ref('')
const smsCountdown = ref(0)
const smsLoading = ref(false)

// 找回密码
const showResetPwd = ref(false)
const resetPwdPhone = ref('')
const resetPwdCode = ref('')
const resetPwdPassword = ref('')
const resetPwdConfirm = ref('')
const resetPwdCountdown = ref(0)
const resetPwdSending = ref(false)
const resetPwdLoading = ref(false)
let smsTimer: ReturnType<typeof setInterval> | null = null
let resetPwdTimer: ReturnType<typeof setInterval> | null = null

const needSmsCode = computed(() => {
  if (props.registerMode) return !!smsPhone.value.trim()
  return loginMode.value === 'phone_sms'
})

// ── OAuth ──
const wechatLoading = ref(false)
const wechatStatus = ref({ enabled: false, appId: '' })
const qqLoading = ref(false)
const qqStatus = ref({ enabled: false, appId: '' })
let oauthTimer: ReturnType<typeof setInterval> | null = null

function startOAuth(authUrl: string, onSuccess: (token: string, user: any) => void, onError: (err: string) => void) {
  const w = window.open(authUrl, '_blank', 'width=600,height=700')
  if (!w) {
    window.location.href = authUrl
    return
  }
  // 轮询检测：QQ/微信回调页会写入 localStorage 后关闭弹窗
  // 注意：回调页是同一个域下的页面（/api/auth/qq/callback 写入 localStorage 是在同域下）
  // 但为了保证跨场景兼容，同时通过页面级轮询兜底（见 index.vue）
  const startTs = Date.now()
  if (oauthTimer) clearInterval(oauthTimer)
  oauthTimer = setInterval(() => {
    // 超时 60 秒
    if (Date.now() - startTs > 60000) {
      clearInterval(oauthTimer!)
      oauthTimer = null
      qqLoading.value = false
      wechatLoading.value = false
      onError('登录超时，请重试')
      return
    }
    const token = localStorage.getItem('accessToken')
    if (token) {
      clearInterval(oauthTimer!)
      oauthTimer = null
      qqLoading.value = false
      wechatLoading.value = false
      onSuccess(token, JSON.parse(localStorage.getItem('auth_user') || '{}'))
      return
    }
    // ⭐ 首次QQ登录：检测 bindToken，弹窗关闭后自动跳绑定手机号页
    const bindToken = localStorage.getItem('qq_bind_token')
    if (bindToken) {
      clearInterval(oauthTimer!)
      oauthTimer = null
      qqLoading.value = false
      wechatLoading.value = false
      // 清理 localStorage 暂存，跳绑定页
      try { localStorage.removeItem('qq_bind_token'); localStorage.removeItem('qq_bind_nick'); } catch {}
      window.location.href = '/user/bind-phone'
      return
    }
  }, 500)
}

function qqLogin() {
  if (!qqStatus.value.enabled) return
  qqLoading.value = true
  authError.value = ''
  fetch('/api/auth/qq/authorize')
    .then(r => r.json())
    .then(data => {
      const authUrl = data.data?.authUrl || data.authUrl
      if (authUrl) {
        startOAuth(authUrl,
          (token, user) => {
            setToken(token)
            setUser(user)
            qqLoading.value = false
            emit('close')
            window.location.reload()
          },
          (err) => { authError.value = err; qqLoading.value = false }
        )
        qqLoading.value = false
      } else {
        authError.value = data.error || 'QQ登录启动失败'; qqLoading.value = false
      }
    })
    .catch(() => { authError.value = 'QQ登录暂时不可用'; qqLoading.value = false })
}

function wechatLogin() {
  if (!wechatStatus.value.enabled) return
  wechatLoading.value = true
  authError.value = ''
  fetch('/api/auth/wechat/authorize')
    .then(r => r.json())
    .then(data => {
      const authUrl = data.data?.authUrl || data.authUrl
      if (authUrl) {
        startOAuth(authUrl,
          (token, user) => {
            setToken(token)
            setUser(user)
            wechatLoading.value = false
            emit('close')
            window.location.reload()
          },
          (err) => { authError.value = err; wechatLoading.value = false }
        )
        wechatLoading.value = false
      } else {
        authError.value = data.error || '微信登录启动失败'; wechatLoading.value = false
      }
    })
    .catch(() => { authError.value = '微信登录暂时不可用'; wechatLoading.value = false })
}

// ── 短信验证码 ──
function sendSmsCode() {
  const phone = smsPhone.value.trim()
  if (!/^1\d{10}$/.test(phone)) {
    authError.value = '手机号格式不正确'
    return
  }
  authError.value = ''
  authSuccess.value = ''
  smsLoading.value = true
  fetch('/api/auth/sms/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone }),
  })
    .then(r => r.json())
    .then(data => {
      if (data.error) { authError.value = data.error; return }
      authSuccess.value = '验证码已发送'
      smsCountdown.value = 60
      if (smsTimer) clearInterval(smsTimer)
      smsTimer = setInterval(() => {
        if (smsCountdown.value > 0) smsCountdown.value--
        else if (smsTimer) { clearInterval(smsTimer); smsTimer = null }
      }, 1000)
    })
    .catch(() => { authError.value = '发送失败，请重试' })
    .finally(() => { smsLoading.value = false })
}

// ── 找回密码 ──
function openResetPwd() {
  authError.value = ''
  authSuccess.value = ''
  showResetPwd.value = true
  resetPwdPhone.value = ''
  resetPwdCode.value = ''
  resetPwdPassword.value = ''
  resetPwdConfirm.value = ''
  resetPwdCountdown.value = 0
}

function cancelResetPwd() {
  showResetPwd.value = false
  authError.value = ''
  authSuccess.value = ''
}

function sendResetPwdCode() {
  const phone = resetPwdPhone.value.trim()
  if (!/^1\d{10}$/.test(phone)) {
    authError.value = '手机号格式不正确'
    return
  }
  authError.value = ''
  authSuccess.value = ''
  resetPwdSending.value = true
  fetch('/api/auth/sms/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone }),
  })
    .then(r => r.json())
    .then(data => {
      if (data.error) { authError.value = data.error; return }
      authSuccess.value = '验证码已发送'
      resetPwdCountdown.value = 60
      if (resetPwdTimer) clearInterval(resetPwdTimer)
      resetPwdTimer = setInterval(() => {
        if (resetPwdCountdown.value > 0) resetPwdCountdown.value--
        else if (resetPwdTimer) { clearInterval(resetPwdTimer); resetPwdTimer = null }
      }, 1000)
    })
    .catch(() => { authError.value = '发送失败，请重试' })
    .finally(() => { resetPwdSending.value = false })
}

async function doResetPwd() {
  authError.value = ''
  authSuccess.value = ''
  const phone = resetPwdPhone.value.trim()
  const code = resetPwdCode.value.trim()
  const pwd = resetPwdPassword.value
  const confirm = resetPwdConfirm.value
  if (!/^1\d{10}$/.test(phone)) { authError.value = '请输入正确的手机号'; return }
  if (!code) { authError.value = '请输入验证码'; return }
  if (pwd.length < 6) { authError.value = '密码至少 6 位'; return }
  if (pwd !== confirm) { authError.value = '两次密码输入不一致'; return }
  resetPwdLoading.value = true
  try {
    const res = await fetch('/api/auth/sms/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, code, password: pwd, confirmPassword: confirm }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || '重置失败')
    authSuccess.value = '密码重置成功！请登录'
    setTimeout(() => {
      showResetPwd.value = false
      authError.value = ''
      authSuccess.value = ''
    }, 2000)
  } catch (e: any) {
    authError.value = e.message || '请求失败'
  } finally {
    resetPwdLoading.value = false
  }
}

// ── 登录/注册 ──
// ── 注册（仅手机号+验证码）──
async function doRegister() {
  authError.value = ''
  authSuccess.value = ''

  const phone = smsPhone.value.trim()
  if (!phone || !/^1\d{10}$/.test(phone)) {
    authError.value = '请输入正确的手机号'; return
  }
  if (!smsCode.value) {
    authError.value = '请输入验证码'; return
  }

  authLoading.value = true
  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, code: smsCode.value }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || '注册失败')
    const token = data.accessToken || data.token
    if (token) {
      setToken(token)
      document.cookie = `auth_token=${token}; path=/; max-age=2592000; samesite=lax`
      if (data.user) {
        setUser(data.user)
      }
      authSuccess.value = '注册成功！'
      setTimeout(() => emit('login-success'), 500)
    }
  } catch (e: any) {
    authError.value = e.message || '请求失败'
  } finally {
    authLoading.value = false
  }
}

// ── 登录 ──
async function doAuth() {
  authError.value = ''
  authSuccess.value = ''

  if (!smsPhone.value || !/^1\d{10}$/.test(smsPhone.value.trim())) {
    authError.value = '请输入正确的手机号'; return
  }
  if (loginMode.value === 'phone_pwd' && !authPassword.value) {
    authError.value = '请输入密码'; return
  }
  if (loginMode.value === 'phone_sms' && !smsCode.value) {
    authError.value = '请输入验证码'; return
  }

  authLoading.value = true
  try {
    let url = '/api/auth/login'
    let body: any = {}
    if (loginMode.value === 'phone_sms') {
      url = '/api/auth/sms/login'
      body = { phone: smsPhone.value.trim(), code: smsCode.value }
    } else {
      body = { phone: smsPhone.value.trim(), password: authPassword.value }
    }
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || '登录失败')
    const token = data.accessToken || data.token
    if (token) {
      setToken(token)
      document.cookie = `auth_token=${token}; path=/; max-age=2592000; samesite=lax`
      if (data.user) {
        setUser(data.user)
      }
      authSuccess.value = '登录成功！'
      setTimeout(() => emit('login-success'), 500)
    }
  } catch (e: any) {
    authError.value = e.message || '请求失败'
  } finally {
    authLoading.value = false
  }
}

// ── OAuth 回调检测 ──
onMounted(() => {
  const urlParams = new URLSearchParams(window.location.search)
  const wechatToken = urlParams.get('wechat_token')
  const wechatUser = urlParams.get('wechat_user') || ''
  const wechatError = urlParams.get('error')
  const qqToken = urlParams.get('qq_token')
  const qqUser = urlParams.get('qq_user') || ''
  const qqError = urlParams.get('error')

  if (wechatToken || qqToken) {
    const token = wechatToken || qqToken
    const username = wechatUser || qqUser
    setToken(token!)
    if (username) {
      setUser({ username })
    }
    if (window.opener) {
      window.opener.postMessage({
        type: 'OAUTH_LOGIN',
        token: token,
        user: { username: username || '用户' }
      }, window.location.origin)
      window.close()
    } else {
      emit('close')
      window.location.reload()
    }
  }
  if (wechatError || qqError) {
    authError.value = wechatError || qqError || ''
    if (window.opener) {
      window.opener.postMessage({ type: 'OAUTH_ERROR', error: authError.value }, window.location.origin)
      window.close()
    }
  }

  // 检查第三方登录配置
  fetch('/api/auth/qq/status')
    .then(r => r.json())
    .then(d => { if (d.data) qqStatus.value = d.data })
    .catch(() => {})
  fetch('/api/auth/wechat/status')
    .then(r => r.json())
    .then(d => { if (d.data) wechatStatus.value = d.data })
    .catch(() => {})
})

onUnmounted(() => {
  if (smsTimer) clearInterval(smsTimer)
  if (resetPwdTimer) clearInterval(resetPwdTimer)
  if (oauthTimer) {
    clearInterval(oauthTimer)
    oauthTimer = null
  }
})
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-card {
  background: #0d0d12;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 20px;
  width: 380px;
  padding: 40px 32px 32px;
  position: relative;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-close {
  position: absolute;
  top: 16px;
  right: 16px;
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.3);
  font-size: 1rem;
  cursor: pointer;
}
.modal-close:hover { color: #fff; }

.modal-header { text-align: center; margin-bottom: 24px; }
.modal-header .logo-icon { display: flex; align-items: center; justify-content: center; margin-bottom: 12px; }
.modal-logo-img { width: 48px; height: 48px; }
.modal-header h2 { font-size: 1.2rem; font-weight: 600; color: #fff; margin: 0 0 6px; }
.modal-header p { font-size: 0.8rem; color: rgba(255, 255, 255, 0.35); margin: 0; }

.modal-tabs {
  display: flex;
  background: rgba(255, 255, 255, 0.02);
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
  color: rgba(255, 255, 255, 0.3);
  transition: all 0.2s;
}
.tab-active {
  background: rgba(249, 115, 22, 0.15);
  color: #f97316;
}

.login-mode-tabs {
  display: flex;
  background: rgba(255, 255, 255, 0.02);
  border-radius: 8px;
  padding: 2px;
  margin-bottom: 16px;
}
.tab-sm {
  flex: 1;
  padding: 6px 4px;
  border: none;
  border-radius: 6px;
  font-size: 0.75rem;
  cursor: pointer;
  background: transparent;
  color: rgba(255, 255, 255, 0.3);
  transition: all 0.2s;
}
.tab-sm-active {
  background: rgba(59, 130, 246, 0.15);
  color: #60a5fa;
}

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

.modal-form .form-group { margin-bottom: 16px; }
.modal-form label { display: block; font-size: 0.75rem; color: rgba(255, 255, 255, 0.4); margin-bottom: 6px; }

.form-input {
  width: 100%;
  box-sizing: border-box;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 10px;
  padding: 10px 14px;
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.7);
  outline: none;
  transition: border-color 0.2s;
}
.form-input:focus { border-color: rgba(249, 115, 22, 0.4); }

.form-error { color: #ef4444; font-size: 0.78rem; margin-bottom: 12px; text-align: center; }
.form-success { color: #22c55e; font-size: 0.78rem; margin-bottom: 12px; text-align: center; }

.wechat-divider {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 16px 0 12px;
}
.divider-line { flex: 1; height: 1px; background: rgba(255, 255, 255, 0.08); }
.divider-text { font-size: 11px; color: rgba(255, 255, 255, 0.3); white-space: nowrap; }

.social-login-row { display: flex; flex-direction: column; gap: 8px; }

.reset-pwd-link {
  text-align: center;
  margin-top: 12px;
  font-size: 0.78rem;
  color: rgba(255, 255, 255, 0.3);
  cursor: pointer;
}
.reset-pwd-link:hover { color: #60a5fa; }

@media (max-width: 768px) {
  .modal-card { width: 90%; margin: 0 16px; }
}
</style>
