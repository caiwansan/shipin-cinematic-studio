<template>
  <div class="mr-page">
    <!-- 品牌区 -->
    <div class="mr-brand">
      <div class="mr-logo">🏮</div>
      <div class="mr-name">昆仑镜</div>
      <div class="mr-slogan">AI 员工数字办公空间</div>
    </div>

    <!-- 注册卡片 -->
    <div class="mr-card">
      <div class="mr-title">创建账号 <span class="mr-gift">🎁 注册即送 10 钻石</span></div>

      <div class="mr-form">
        <div class="mr-field">
          <label>手机号</label>
          <input v-model="phone" type="tel" class="mr-input" placeholder="请输入手机号" autocomplete="tel" maxlength="11" />
        </div>

        <div class="mr-field">
          <label>短信验证码</label>
          <div class="mr-code-wrap">
            <input v-model="code" class="mr-input mr-code" placeholder="6 位验证码" maxlength="6" />
            <button class="mr-code-btn" :disabled="sending || countdown > 0" @click="sendSms">
              {{ countdown > 0 ? countdown + 's 后重发' : (sending ? '发送中…' : '获取验证码') }}
            </button>
          </div>
        </div>

        <div class="mr-field">
          <label>用户名（选填）</label>
          <input v-model="username" class="mr-input" placeholder="不填将自动生成" autocomplete="username" />
        </div>

        <div class="mr-field">
          <label>密码</label>
          <div class="mr-pwd-wrap">
            <input
              v-model="password"
              class="mr-input mr-pwd"
              :type="showPwd ? 'text' : 'password'"
              placeholder="至少 8 位"
              autocomplete="new-password"
            />
            <span class="mr-eye" @click="showPwd = !showPwd">{{ showPwd ? '🙈' : '👁️' }}</span>
          </div>
        </div>

        <div class="mr-field">
          <label>确认密码</label>
          <input
            v-model="confirm"
            class="mr-input"
            :type="showPwd ? 'text' : 'password'"
            placeholder="再次输入密码"
            autocomplete="new-password"
            @keyup.enter="doRegister"
          />
        </div>

        <div v-if="info" class="mr-info">{{ info }}</div>
        <div v-if="error" class="mr-error">{{ error }}</div>
        <div v-if="success" class="mr-success">{{ success }}</div>

        <button class="mr-btn" :disabled="loading" @click="doRegister">
          {{ loading ? '注册中…' : '注 册' }}
        </button>
      </div>

      <!-- 第三方注册 -->
      <div v-if="qqStatus.enabled" class="mr-oauth">
        <div class="mr-divider"><span>其他注册方式</span></div>
        <button class="mr-qq-btn" :disabled="qqLoading" @click="qqLogin">
          <span class="mr-qq-icon">🐧</span>
          <span>{{ qqLoading ? '跳转中…' : 'QQ 一键注册' }}</span>
        </button>
      </div>
    </div>

    <div class="mr-login">
      已有账号？<span class="mr-login-link" @click="goLogin">直接登录</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

definePageMeta({ middleware: 'auth' })

const router = useRouter()

const phone = ref('')
const code = ref('')
const username = ref('')
const password = ref('')
const confirm = ref('')
const showPwd = ref(false)
const loading = ref(false)
const sending = ref(false)
const countdown = ref(0)
const info = ref('')
const error = ref('')
const success = ref('')
let smsTimer: ReturnType<typeof setInterval> | null = null

// ── 短信验证码 ──
async function sendSms() {
  const ph = phone.value.trim()
  if (!/^1\d{10}$/.test(ph)) { error.value = '手机号格式不正确'; return }
  error.value = ''; info.value = ''
  sending.value = true
  try {
    const r = await fetch('/api/auth/sms/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: ph }),
    })
    const data = await r.json()
    if (data.error) { error.value = data.error; return }
    info.value = '验证码已发送'
    const mock = data.data?.mock || data.mock
    const debugCode = data.data?.debugCode || data.debugCode
    if (mock && debugCode) {
      info.value = `⚠️ 短信配额已满，验证码: ${debugCode}（仅本次有效）`
    } else if (debugCode) {
      info.value += `（调试码: ${debugCode}）`
    }
    countdown.value = 60
    if (smsTimer) clearInterval(smsTimer)
    smsTimer = setInterval(() => {
      if (countdown.value > 0) countdown.value--
      else if (smsTimer) { clearInterval(smsTimer); smsTimer = null }
    }, 1000)
  } catch {
    error.value = '发送失败，请重试'
  } finally {
    sending.value = false
  }
}

// ── QQ 一键注册 ──
const qqStatus = ref({ enabled: false, appId: '' })
const qqLoading = ref(false)
let oauthListener: ((e: MessageEvent) => void) | null = null

function startOAuth(authUrl: string, onSuccess: (token: string) => void, onError: (err: string) => void) {
  const w = window.open(authUrl, '_blank', 'width=600,height=700')
  if (!w) { window.location.href = authUrl; return }
  if (oauthListener) window.removeEventListener('message', oauthListener)
  oauthListener = (e: MessageEvent) => {
    if (e.origin !== window.location.origin) return
    if (e.data?.type === 'OAUTH_LOGIN') { onSuccess(e.data.token); window.removeEventListener('message', oauthListener); oauthListener = null }
    else if (e.data?.type === 'OAUTH_ERROR') { onError(e.data.error); window.removeEventListener('message', oauthListener); oauthListener = null }
  }
  window.addEventListener('message', oauthListener)
  const pollClose = setInterval(() => {
    if (w.closed) {
      clearInterval(pollClose)
      if (oauthListener) { window.removeEventListener('message', oauthListener); oauthListener = null; qqLoading.value = false }
    }
  }, 1000)
}

async function qqLogin() {
  if (!qqStatus.value.enabled) return
  qqLoading.value = true; error.value = ''
  try {
    const r = await fetch('/api/auth/qq/authorize')
    const data = await r.json()
    const authUrl = data.data?.authUrl || data.authUrl
    if (!authUrl) { error.value = data.error || 'QQ 登录启动失败'; qqLoading.value = false; return }
    startOAuth(authUrl, async (token) => {
      window.localStorage?.setItem('auth_token', token)
      document.cookie = `auth_token=${token}; path=/; max-age=86400; samesite=lax`
      const { setToken, setUser } = await import('~/utils/token-cache')
      setToken(token)
      setUser({ username: token.split('.')[0] || '用户' })
      qqLoading.value = false
      success.value = '注册成功！正在进入…'
      setTimeout(() => router.replace('/mobile-app'), 800)
    }, (err) => { error.value = err; qqLoading.value = false })
  } catch {
    error.value = 'QQ 注册暂时不可用'; qqLoading.value = false
  }
}

// ── 手机号注册 ──
async function doRegister() {
  const ph = phone.value.trim()
  if (!/^1\d{10}$/.test(ph)) { error.value = '请输入正确的手机号'; return }
  if (!code.value.trim()) { error.value = '请输入短信验证码'; return }
  if (password.value.length < 8) { error.value = '密码至少 8 位'; return }
  if (password.value !== confirm.value) { error.value = '两次输入的密码不一致'; return }
  error.value = ''
  loading.value = true
  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: ph,
        code: code.value.trim(),
        username: username.value.trim() || undefined,
        password: password.value,
        refCode: undefined,
      }),
    })
    const data = await res.json()
    const token = data.accessToken || data.token
    if (token) {
      window.localStorage?.setItem('auth_token', token)
      document.cookie = `auth_token=${token}; path=/; max-age=86400; samesite=lax`
      const { setToken, setUser } = await import('~/utils/token-cache')
      setToken(token)
      setUser(data.user || { username: username.value.trim() || ph.slice(-4) })
      success.value = '注册成功！正在进入…'
      setTimeout(() => router.replace('/mobile-app'), 800)
    } else {
      error.value = data.error || '注册失败'
    }
  } catch (e: any) {
    error.value = e?.message || '网络错误'
  } finally {
    loading.value = false
  }
}

function goLogin() {
  router.push('/mobile-login')
}

onMounted(() => {
  fetch('/api/auth/qq/status')
    .then(r => r.json())
    .then(d => { if (d.data) qqStatus.value = d.data })
    .catch(() => {})
})
</script>

<style scoped>
.mr-page {
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
.mr-brand { text-align: center; margin-bottom: 30px; }
.mr-logo {
  width: 68px; height: 68px;
  margin: 0 auto 12px;
  border-radius: 20px;
  background: linear-gradient(135deg, #fbbf24, #f59e0b);
  display: flex; align-items: center; justify-content: center;
  font-size: 36px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.35);
}
.mr-name { color: #fff; font-size: 24px; font-weight: 700; letter-spacing: 2px; }
.mr-slogan { color: rgba(255,255,255,0.72); font-size: 13px; margin-top: 6px; }

.mr-card {
  width: 100%;
  max-width: 420px;
  background: #fff;
  border-radius: 20px;
  padding: 26px 22px 28px;
  box-shadow: 0 16px 48px rgba(0,0,0,0.3);
  box-sizing: border-box;
}
.mr-title { font-size: 20px; font-weight: 700; color: #0f172a; text-align: center; margin-bottom: 22px; }
.mr-gift { font-size: 12px; font-weight: 500; color: #b45309; background: linear-gradient(135deg, #fef3c7, #fde68a); border: 1px solid #fcd34d; border-radius: 999px; padding: 2px 10px; margin-left: 8px; vertical-align: middle; }

.mr-field { margin-bottom: 16px; }
.mr-field label { display: block; font-size: 13px; color: #475569; margin-bottom: 8px; font-weight: 500; }
.mr-input {
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
.mr-input:focus { border-color: #22c55e; background: #fff; }
.mr-code-wrap { position: relative; }
.mr-code { padding-right: 118px; }
.mr-code-btn {
  position: absolute; right: 6px; top: 50%; transform: translateY(-50%);
  height: 38px; padding: 0 14px;
  border: none; border-radius: 9px;
  background: #166534; color: #fff; font-size: 13px; font-weight: 600;
  cursor: pointer;
}
.mr-code-btn:disabled { opacity: 0.55; cursor: default; }
.mr-pwd-wrap { position: relative; }
.mr-pwd { padding-right: 48px; }
.mr-eye {
  position: absolute; right: 14px; top: 50%; transform: translateY(-50%);
  font-size: 18px; cursor: pointer; user-select: none;
}

.mr-info {
  background: #eff6ff; border: 1px solid #bfdbfe; color: #1d4ed8;
  font-size: 13px; border-radius: 10px; padding: 10px 12px; margin-bottom: 14px;
}
.mr-error {
  background: #fef2f2; border: 1px solid #fecaca; color: #dc2626;
  font-size: 13px; border-radius: 10px; padding: 10px 12px; margin-bottom: 14px;
}
.mr-success {
  background: #f0fdf4; border: 1px solid #bbf7d0; color: #15803d;
  font-size: 13px; border-radius: 10px; padding: 10px 12px; margin-bottom: 14px;
}

.mr-btn {
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
.mr-btn:active { transform: scale(0.98); }
.mr-btn:disabled { opacity: 0.6; }

.mr-oauth { margin-top: 20px; }
.mr-divider { display: flex; align-items: center; gap: 10px; color: #94a3b8; font-size: 12px; margin-bottom: 14px; }
.mr-divider::before, .mr-divider::after { content: ''; flex: 1; height: 1px; background: #e2e8f0; }
.mr-qq-btn {
  width: 100%; height: 48px;
  border: 1.5px solid #e2e8f0; border-radius: 12px;
  background: #fff; color: #334155;
  font-size: 15px; font-weight: 600;
  display: flex; align-items: center; justify-content: center; gap: 8px;
  cursor: pointer; transition: background 0.2s;
}
.mr-qq-btn:active { background: #f8fafc; }
.mr-qq-btn:disabled { opacity: 0.6; }
.mr-qq-icon { font-size: 18px; }

.mr-login { margin-top: 22px; font-size: 14px; color: rgba(255,255,255,0.85); }
.mr-login-link { color: #fbbf24; font-weight: 600; text-decoration: underline; padding: 4px; cursor: pointer; }
</style>
