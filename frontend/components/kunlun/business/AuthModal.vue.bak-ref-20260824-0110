<template>
  <div v-if="modelValue">
    <!-- ==================== 登录/注册 Modal ==================== -->
    <div class="modal-overlay" @click.self="close">
      <div class="modal-card">
        <div class="qhp-fret" aria-hidden="true"></div>
        <button class="modal-close" @click="close">✕</button>
        <div class="modal-header">
          <span class="logo-icon"><img src="/logo.png" alt="昆仑镜" class="modal-logo-img" /></span>
          <h2>{{ isRegisterMode ? '创建账号' : '登录昆仑镜' }}</h2>
          <p>{{ isRegisterMode ? '开启 AI 影视制作之旅' : '回到你的工作空间' }}</p>
        </div>
        <div class="modal-tabs" v-if="!showResetPwd">
          <button :class="['tab-btn', !isRegisterMode && 'tab-active']" @click="isRegisterMode = false">登录</button>
          <button :class="['tab-btn', isRegisterMode && 'tab-active']" @click="isRegisterMode = true">注册</button>
        </div>
        <form v-if="showResetPwd" @submit.prevent="doResetPwd" class="modal-form">
          <div class="modal-header" style="padding:0 0 12px">
            <h2 style="font-size:1.1rem">找回密码</h2>
            <p style="font-size:0.78rem">输入手机号，通过验证码重置密码</p>
          </div>
          <div class="form-group">
            <label>手机号</label><input v-model="resetPwdPhone" type="tel" placeholder="输入手机号" class="form-input" maxlength="11" />
          </div>
          <div class="form-group">
            <label>验证码</label>
            <div class="sms-code-row">
              <input v-model="resetPwdCode" type="text" placeholder="6 位验证码" class="form-input sms-code-input" maxlength="6" />
              <button type="button" class="btn btn-outline btn-sm-code" :disabled="resetPwdCountdown > 0 || resetPwdSending" @click="sendResetPwdCode">{{ resetPwdCountdown > 0 ? `${resetPwdCountdown}s` : '获取验证码' }}</button>
            </div>
            <p style="font-size:0.7rem; color:#999; margin:4px 0 0">每日仅能收 20 次短信验证码，请确认手机号正确后再获取</p>
          </div>
          <div class="form-group">
            <label>新密码</label><input v-model="resetPwdPassword" type="password" placeholder="至少 6 位" class="form-input" />
          </div>
          <div class="form-group">
            <label>确认新密码</label><input v-model="resetPwdConfirm" type="password" placeholder="再次输入新密码" class="form-input" />
          </div>
          <p v-if="authError" class="form-error">{{ authError }}</p>
          <p v-if="authSuccess" class="form-success">{{ authSuccess }}</p>
          <button type="submit" class="btn btn-primary btn-full" :disabled="resetPwdLoading">{{ resetPwdLoading ? '处理中...' : '确认重置' }}</button>
          <button type="button" class="btn btn-ghost btn-full" style="margin-top:8px" @click="cancelResetPwd">返回登录</button>
        </form>
        <form v-else @submit.prevent="doAuth" class="modal-form">
          <div v-if="isRegisterMode" class="form-group">
            <label>手机号</label><input v-model="smsPhone" type="tel" placeholder="输入手机号" class="form-input" maxlength="11" />
          </div>
          <div v-if="!isRegisterMode" class="form-group">
            <label>账号/手机号</label><input v-model="smsPhone" type="text" placeholder="输入手机号或账号" class="form-input" />
          </div>
          <div v-if="isRegisterMode" class="form-group">
            <label>密码 <span style="color:#666;font-size:0.65rem">（可选，不设则用验证码登录）</span></label>
            <input v-model="authPassword" type="password" placeholder="留空则不设密码" class="form-input" />
          </div>
          <div v-if="!isRegisterMode" class="form-group">
            <label>密码</label><input v-model="authPassword" type="password" placeholder="至少 6 位" class="form-input" />
          </div>
          <div v-if="needSmsCode" class="form-group">
            <label>验证码</label>
            <div class="sms-code-row">
              <input v-model="smsCode" type="text" placeholder="输入 6 位验证码" class="form-input sms-code-input" maxlength="6" />
              <button type="button" class="btn btn-outline btn-sm-code" :disabled="smsCountdown > 0 || smsLoading" @click="sendSmsCode">{{ smsCountdown > 0 ? `${smsCountdown}s` : '获取验证码' }}</button>
            </div>
            <p style="font-size:0.7rem; color:#999; margin:4px 0 0">每日仅能收 20 次短信验证码，请确认手机号正确后再获取</p>
          </div>
          <!-- 邀请码（从推广链接自动写入，不可见不可编辑） -->
          <div v-if="isRegisterMode && refCode" class="form-group" style="opacity:0.6">
            <label>邀请码</label>
            <input :value="refCode" type="text" disabled class="form-input" style="color:#8b8fa3" />
          </div>
          <!-- 注册时选择所在地区（三级级联，统一数据源 /api/regions） -->
          <div v-if="isRegisterMode" class="form-group">
            <label>所在地区 <span style="color:#e74c3c;font-size:0.65rem">（必选）</span></label>
            <RegionPicker
              v-model:selected-province="selectedProvince"
              v-model:selected-city="selectedCity"
              v-model:selected-district="selectedDistrict"
              @change="onRegionChange"
            />
            <p v-if="regionError" style="font-size:0.7rem;color:#e74c3c;margin-top:4px">{{ regionError }}</p>
          </div>
          <p v-if="authError" class="form-error">{{ authError }}</p>
          <p v-if="authSuccess" class="form-success">{{ authSuccess }}</p>
          <button type="submit" class="btn btn-primary btn-full" :disabled="authLoading">{{ authLoading ? '处理中...' : (isRegisterMode ? '注册并进入' : '登录') }}</button>
          <div v-if="!isRegisterMode" class="reset-pwd-link" @click="openResetPwd">忘记密码？</div>
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

    <!-- ==================== 图形验证码弹窗 ==================== -->
    <div v-if="showCaptcha" class="modal-overlay" @click.self="cancelCaptcha">
      <div class="modal-card" style="max-width:320px">
        <button class="modal-close" @click="cancelCaptcha">✕</button>
        <div class="modal-header">
          <h2 style="font-size:1.1rem">安全验证</h2>
          <p style="font-size:0.78rem">请填写图形验证码后获取短信</p>
        </div>
        <div class="modal-form" style="padding:0 20px 20px;text-align:center">
          <div v-html="captchaSvg" style="display:inline-block;margin-bottom:12px;border-radius:6px;overflow:hidden"></div>
          <div class="form-group">
            <input v-model="captchaInput" type="text" placeholder="输入图形中的验证码" class="form-input" maxlength="4" style="text-align:center;letter-spacing:4px;font-size:1.1rem" @keyup.enter="submitCaptcha" />
          </div>
          <p v-if="captchaError" class="form-error">{{ captchaError }}</p>
          <div style="display:flex;gap:8px">
            <button type="button" class="btn btn-outline btn-full" @click="loadCaptcha">换一张</button>
            <button type="button" class="btn btn-primary btn-full" :disabled="captchaVerifying" @click="submitCaptcha">{{ captchaVerifying ? '验证中...' : '确定' }}</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { getAuthToken, setAuthToken } from '~/utils/auth/token'
import RegionPicker from '~/components/RegionPicker.vue'

// ==================== Props / Emits ====================
const props = withDefaults(defineProps<{
  modelValue: boolean
  initialMode?: 'login' | 'register'
}>(), {
  initialMode: 'login',
})
const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'logged-in'): void
}>()

function close() { emit('update:modelValue', false) }

// ==================== 基础状态 ====================
const isRegisterMode = ref(props.initialMode === 'register')
const authName = ref('')
const authEmail = ref('')
const authPassword = ref('')
const authLoading = ref(false)
const authError = ref('')
const authSuccess = ref('')

// 短信登录状态
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

// 推广链接 ref 参数
const refCode = ref('')

// ── 地区选择（注册时） ──
const selectedProvince = ref('')
const selectedCity = ref('')
const selectedDistrict = ref('')
const regionNameMap = ref<Record<string, string>>({})
const regionError = ref('')

function onRegionChange(data: {
  provinceCode: string; provinceName: string
  cityCode: string; cityName: string
  districtCode: string; districtName: string
} | null) {
  regionError.value = ''
  if (data) {
    regionNameMap.value = {
      [data.provinceCode]: data.provinceName,
      [data.cityCode]: data.cityName,
      [data.districtCode]: data.districtName,
    }
  }
}

const needSmsCode = computed(() => isRegisterMode.value)

// ── 打开时初始化 ──
watch(() => props.modelValue, (open) => {
  if (!open) return
  isRegisterMode.value = props.initialMode === 'register'
  showResetPwd.value = false
  authError.value = ''
  authSuccess.value = ''
  authPassword.value = ''
  smsPhone.value = ''
  smsCode.value = ''
  smsCountdown.value = 0
  if (smsTimer) { clearInterval(smsTimer); smsTimer = null }
  try {
    refCode.value = new URLSearchParams(window.location.search).get('ref') || ''
  } catch { refCode.value = '' }
  // 延迟加载第三方登录状态（不阻塞渲染）
  setTimeout(() => {
    fetch('/api/auth/qq/status')
      .then(r => r.json())
      .then(d => { if (d.data) qqStatus.value = d.data })
      .catch(() => {})
    fetch('/api/auth/wechat/status')
      .then(r => r.json())
      .then(d => { if (d.data) wechatStatus.value = d.data })
      .catch(() => {})
  }, 100)
})

// ── 图形验证码 ──
const showCaptcha = ref(false)
const captchaSvg = ref('')
const captchaToken = ref('')
const captchaInput = ref('')
const captchaError = ref('')
const captchaVerifying = ref(false)
let captchaTarget: 'sms' | 'reset' = 'sms'

async function loadCaptcha() {
  try {
    const res = await fetch('/api/captcha')
    const data = await res.json()
    captchaSvg.value = data.svg
    captchaToken.value = data.token
    captchaInput.value = ''
    captchaError.value = ''
  } catch {
    captchaError.value = '获取验证码失败，请重试'
  }
}

function openCaptcha(target: 'sms' | 'reset') {
  captchaTarget = target
  captchaError.value = ''
  captchaInput.value = ''
  showCaptcha.value = true
  loadCaptcha()
}

function cancelCaptcha() {
  showCaptcha.value = false
}

async function submitCaptcha() {
  if (!captchaInput.value.trim()) {
    captchaError.value = '请输入图形验证码'
    return
  }
  captchaVerifying.value = true
  captchaError.value = ''
  const phone = captchaTarget === 'sms' ? smsPhone.value.trim() : resetPwdPhone.value.trim()
  if (!phone || !/^1\d{10}$/.test(phone)) {
    captchaError.value = '请先输入正确的手机号'
    captchaVerifying.value = false
    return
  }
  showCaptcha.value = false
  if (captchaTarget === 'sms') {
    await sendSmsCodeWithCaptcha(phone, captchaToken.value, captchaInput.value.trim())
  } else {
    await sendResetPwdCodeWithCaptcha(phone, captchaToken.value, captchaInput.value.trim())
  }
  captchaVerifying.value = false
}

function sendSmsCode() {
  const phone = smsPhone.value.trim()
  if (!phone || !/^1\d{10}$/.test(phone)) {
    authError.value = '请输入正确的手机号'
    return
  }
  openCaptcha('sms')
}

async function sendSmsCodeWithCaptcha(phone: string, ctoken: string, ccode: string) {
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
    body: JSON.stringify({ phone, captchaToken: ctoken, captchaCode: ccode }),
  })
    .then(r => r.json())
    .then(data => {
      if (data.error) { authError.value = data.error; return }
      authSuccess.value = '验证码已发送'
      const debugCode = data.data?.debugCode || data.debugCode
      if (debugCode) smsCode.value = debugCode
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
  openCaptcha('reset')
}

async function sendResetPwdCodeWithCaptcha(phone: string, ctoken: string, ccode: string) {
  authError.value = ''
  authSuccess.value = ''
  resetPwdSending.value = true
  fetch('/api/auth/sms/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, captchaToken: ctoken, captchaCode: ccode }),
  })
    .then(r => r.json())
    .then(data => {
      if (data.error) { authError.value = data.error; return }
      authSuccess.value = '验证码已发送'
      const debugCode = data.data?.debugCode || data.debugCode
      if (debugCode) resetPwdCode.value = debugCode
      resetPwdCountdown.value = 60
      const t = setInterval(() => {
        if (resetPwdCountdown.value > 0) resetPwdCountdown.value--
        else clearInterval(t)
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
    setTimeout(() => { showResetPwd.value = false; authError.value = ''; authSuccess.value = '' }, 2000)
  } catch (e: any) {
    authError.value = e.message || '请求失败'
  } finally {
    resetPwdLoading.value = false
  }
}

// ─── OAuth 登录（QQ / 微信） ───
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
  const startTs = Date.now()
  if (oauthTimer) clearInterval(oauthTimer)
  oauthTimer = setInterval(() => {
    if (Date.now() - startTs > 60000) {
      clearInterval(oauthTimer!)
      oauthTimer = null
      qqLoading.value = false
      wechatLoading.value = false
      onError('登录超时，请重试')
      return
    }
    const token = getAuthToken()
    if (token) {
      clearInterval(oauthTimer!)
      oauthTimer = null
      qqLoading.value = false
      wechatLoading.value = false
      onSuccess(token, JSON.parse(localStorage.getItem('auth_user') || '{}'))
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
            setAuthToken(token)
            localStorage.setItem('auth_user', JSON.stringify(user))
            qqLoading.value = false
            close()
            emit('logged-in')
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
            setAuthToken(token)
            localStorage.setItem('auth_user', JSON.stringify(user))
            wechatLoading.value = false
            close()
            emit('logged-in')
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

// ─── 账号登录 / 注册 ───
async function doAuth() {
  authError.value = ''
  authSuccess.value = ''
  if (isRegisterMode.value) {
    if (!smsPhone.value.trim()) { authError.value = '请输入手机号'; return }
    if (!/^1\d{10}$/.test(smsPhone.value.trim())) { authError.value = '手机号格式不正确'; return }
    if (!smsCode.value) { authError.value = '请先获取短信验证码'; return }
    if (!selectedProvince.value || !selectedCity.value || !selectedDistrict.value) {
      authError.value = '请选择完整的所在地区（省/市/区县）'; return
    }
  } else {
    if (!smsPhone.value.trim()) { authError.value = '请输入手机号或账号'; return }
    if (!authPassword.value) { authError.value = '请输入密码'; return }
  }
  authLoading.value = true
  try {
    if (isRegisterMode.value) {
      const body: any = {
        phone: smsPhone.value.trim(),
        code: smsCode.value,
        ...(refCode.value ? { refCode: refCode.value } : {}),
        provinceCode: selectedProvince.value,
        provinceName: regionNameMap.value[selectedProvince.value] || '',
        cityCode: selectedCity.value,
        cityName: regionNameMap.value[selectedCity.value] || '',
        districtCode: selectedDistrict.value,
        districtName: regionNameMap.value[selectedDistrict.value] || '',
        ...(authPassword.value ? { password: authPassword.value } : {}),
      }
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '注册失败')
      const token = data.accessToken || data.token
      if (token) {
        setAuthToken(token)
        document.cookie = `auth_token=${token}; path=/; max-age=86400; samesite=lax`
        if (data.user) localStorage.setItem('auth_user', JSON.stringify(data.user))
        authSuccess.value = '注册成功！'
        close()
        emit('logged-in')
      }
    } else {
      const body: any = { password: authPassword.value }
      body.account = smsPhone.value.trim()
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '登录失败')
      const token = data.accessToken || data.token
      if (token) {
        setAuthToken(token)
        document.cookie = `auth_token=${token}; path=/; max-age=86400; samesite=lax`
        if (data.user) localStorage.setItem('auth_user', JSON.stringify(data.user))
        authSuccess.value = '登录成功！'
        close()
        emit('logged-in')
      }
    }
  } catch (e: any) {
    authError.value = e.message || '请求失败'
  } finally {
    authLoading.value = false
  }
}
</script>

<style scoped>
/* ========================================
   雨过天青 · 青花瓷 主题（掌柜 2026-08-06 中国传统美学）
   白瓷卡面 + 青花钴蓝 + 天青晕染 + 描金点缀
   scoped：不影响其他页面各自的 .modal-overlay
   ======================================== */

/* 变量：供嵌套 RegionPicker（白瓷模式） */
.modal-card {
  --rp-color: #3a4c5e;
  --rp-bg: rgba(255, 255, 255, 0.78);
  --rp-border: rgba(31, 78, 121, 0.22);
  --rp-focus: #6fa8c9;
}

/* RegionPicker 白瓷模式：:deep 后代选择器直接覆盖（特异性高于组件内部规则，
   规避 select 原生控件对 background 简写 + var() 的计算异常） */
.modal-card :deep(.region-select) {
  color: #3a4c5e;
  background: rgba(255, 255, 255, 0.78);
  border: 1px solid rgba(31, 78, 121, 0.22);
}
.modal-card :deep(.region-select:focus) {
  border-color: #6fa8c9;
}
.modal-card :deep(.region-select:disabled) {
  opacity: 0.5;
  cursor: not-allowed;
}
.modal-card :deep(.region-select option) {
  background: #fcfaf5;
  color: #3a4c5e;
}
.modal-card :deep(.region-select option:hover),
.modal-card :deep(.region-select option:checked) {
  background: #dceaf2;
  color: #1f4e79;
}

/* ── 夜幕天青 overlay ── */
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
  background:
    radial-gradient(120% 90% at 50% 0%, rgba(107, 164, 200, 0.22), transparent 55%),
    linear-gradient(165deg, #14283c 0%, #0c1b2c 55%, #0a1626 100%);
  backdrop-filter: blur(10px);
  display: flex;
  align-items: center;
  justify-content: center;
}

/* ── 白瓷卡面 ── */
.modal-card {
  background:
    radial-gradient(130% 50% at 50% -12%, rgba(127, 181, 213, 0.16), transparent 60%),
    linear-gradient(180deg, #fcfaf5 0%, #f5f1e7 100%);
  border: 1px solid rgba(31, 78, 121, 0.22);
  border-radius: 18px;
  width: 384px;
  padding: 30px 32px 30px;
  position: relative;
  color: #2b3a4a;
  box-shadow:
    0 24px 64px rgba(6, 18, 32, 0.5),
    inset 0 1px 0 rgba(255, 255, 255, 0.75),
    inset 0 0 0 1px rgba(201, 160, 99, 0.16);
}

/* ── 青花回纹装饰带 ── */
.qhp-fret {
  width: 148px;
  height: 7px;
  margin: 0 auto 16px;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='7' viewBox='0 0 28 7'%3E%3Cpath d='M0 0h8v7H6V2H0zM12 0h8v7h-2V2h-6zM24 0h4v7h-2V2h-2z' fill='%232e5a88'/%3E%3C/svg%3E");
  background-repeat: repeat-x;
  background-size: 28px 7px;
  opacity: 0.55;
}

.modal-close {
  position: absolute;
  top: 16px;
  right: 16px;
  background: none;
  border: none;
  color: #93a3b0;
  font-size: 1rem;
  cursor: pointer;
  transition: color 0.2s;
}
.modal-close:hover { color: #1f4e79; }

/* ── 头部：青花瓷盘 + 钴蓝标题 ── */
.modal-header { text-align: center; margin-bottom: 22px; }
.modal-header .logo-icon {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 66px;
  height: 66px;
  margin: 0 auto 16px;
  border-radius: 50%;
  background: radial-gradient(circle at 32% 28%, #f4fafc 0%, #dceaf2 45%, #a9c9dc 100%);
  border: 1.5px solid rgba(31, 78, 121, 0.45);
  box-shadow: inset 0 0 0 3px rgba(255, 255, 255, 0.85), 0 6px 16px rgba(31, 78, 121, 0.28);
}
.modal-header .logo-icon::after {
  content: '';
  position: absolute;
  inset: -4px;
  border-radius: 50%;
  border: 1px solid rgba(201, 160, 99, 0.5);
  pointer-events: none;
}
.modal-logo-img { width: 40px; height: 40px; border-radius: 8px; }
.modal-header h2 {
  font-size: 1.22rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  color: #1f4e79;
  margin: 0 0 6px;
}
.modal-header p { font-size: 0.8rem; color: #7e8e9c; margin: 0; }

/* ── 青花晕染 tabs ── */
.modal-tabs {
  display: flex;
  background: rgba(31, 78, 121, 0.05);
  border: 1px solid rgba(31, 78, 121, 0.14);
  border-radius: 10px;
  padding: 3px;
  margin-bottom: 22px;
}
.tab-btn {
  flex: 1;
  padding: 8px;
  border: none;
  border-radius: 8px;
  font-size: 0.82rem;
  cursor: pointer;
  background: transparent;
  color: #6b7c8c;
  transition: all 0.2s;
}
.tab-active {
  background: linear-gradient(180deg, #3571a8, #1f4e79);
  color: #f8f4e9;
  box-shadow: 0 2px 10px rgba(31, 78, 121, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2);
}

/* ── 表单：白瓷凹槽 ── */
.modal-form .form-group { margin-bottom: 16px; }
.modal-form label { display: block; font-size: 0.75rem; color: #4a5c6e; margin-bottom: 6px; }
.form-input {
  width: 100%;
  box-sizing: border-box;
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid rgba(31, 78, 121, 0.2);
  border-radius: 10px;
  padding: 10px 14px;
  font-size: 0.85rem;
  color: #2b3a4a;
  outline: none;
  box-shadow: inset 0 1px 3px rgba(31, 78, 121, 0.06);
  transition: border-color 0.2s, box-shadow 0.2s;
}
.form-input::placeholder { color: #a9b5bf; }
.form-input:focus {
  border-color: #6fa8c9;
  box-shadow: 0 0 0 3px rgba(127, 181, 213, 0.18), inset 0 1px 3px rgba(31, 78, 121, 0.05);
}
.form-error { color: #b03a2e; font-size: 0.78rem; margin-bottom: 12px; text-align: center; }
.form-success { color: #3a6b5a; font-size: 0.78rem; margin-bottom: 12px; text-align: center; }
.sms-code-row { display: flex; gap: 8px; }
.sms-code-input { flex: 1; }
.btn-sm-code { white-space: nowrap; min-width: 100px; height: 40px; font-size: 0.78rem; }

/* ── 按钮 ── */
.btn-full { width: 100%; justify-content: center; padding: 11px; }
.btn-primary {
  background: linear-gradient(180deg, #3a76ae 0%, #23568c 55%, #1a446e 100%);
  border: 1px solid rgba(255, 255, 255, 0.25);
  color: #f8f4e9;
  border-radius: 10px;
  font-weight: 500;
  letter-spacing: 0.05em;
  box-shadow: 0 4px 16px rgba(26, 68, 110, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.25);
  transition: all 0.2s;
}
.btn-primary:hover {
  background: linear-gradient(180deg, #4a85bc 0%, #2a6398 55%, #1f4e79 100%);
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(26, 68, 110, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.3);
}
.btn-primary:disabled { opacity: 0.55; cursor: not-allowed; transform: none; box-shadow: none; }
.btn-outline {
  background: rgba(255, 255, 255, 0.55);
  border: 1px solid rgba(31, 78, 121, 0.3);
  color: #1f4e79;
  border-radius: 10px;
  transition: all 0.2s;
}
.btn-outline:hover {
  background: rgba(31, 78, 121, 0.07);
  border-color: #1f4e79;
}
.btn-ghost { background: transparent; color: #6b7c8c; }
.btn-ghost:hover { color: #1f4e79; }

/* ── 忘记密码 ── */
.reset-pwd-link {
  text-align: center;
  margin-top: 12px;
  font-size: 0.78rem;
  color: #4e7fa8;
  cursor: pointer;
  transition: color 0.2s;
}
.reset-pwd-link:hover { color: #1f4e79; }

/* ── 描金分隔 + 第三方登录 ── */
.wechat-divider {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 18px 0 12px;
}
.divider-line {
  flex: 1;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(201, 160, 99, 0.55), transparent);
}
.divider-text { font-size: 11px; color: #b08d57; white-space: nowrap; letter-spacing: 0.2em; }
.social-login-row { display: flex; flex-direction: column; gap: 8px; }
.social-icon { font-size: 16px; }
</style>
