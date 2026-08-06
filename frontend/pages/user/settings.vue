<template>
  <div class="settings-page">
    <div class="settings-header">
      <button class="back-btn" @click="router.push('/user/center')">← 会员中心</button>
      <h1>设置中心</h1>
      <p class="settings-sub">账号安全 · 绑定 · 密码管理</p>
    </div>

    <div class="settings-body">
      <!-- 账号信息 -->
      <div class="settings-section">
        <h2 class="section-title">👤 账号信息</h2>
        <div class="settings-card">
          <div class="setting-row">
            <div class="setting-info">
              <div class="setting-label">用户昵称</div>
              <div class="setting-desc">茶馆聊天、群聊等场景展示的名字</div>
            </div>
            <button class="setting-btn" @click="openNickname">修改昵称</button>
          </div>

          <div class="setting-row">
            <div class="setting-info">
              <div class="setting-label">当前昵称</div>
              <div class="setting-desc">{{ currentNickname || '—' }}</div>
            </div>
            <span class="setting-static">{{ userInfo?.username ? `登录账号：${userInfo.username}` : '' }}</span>
          </div>
        </div>
      </div>

      <!-- 账号安全 -->
      <div class="settings-section">
        <h2 class="section-title">🔐 账号安全</h2>
        <div class="settings-card">
          <div class="setting-row">
            <div class="setting-info">
              <div class="setting-label">绑定手机号</div>
              <div class="setting-desc">{{ userInfo?.phone || '未绑定手机号' }}</div>
            </div>
            <button class="setting-btn" @click="bindPhone">
              {{ userInfo?.phone ? '更换' : '绑定' }}
            </button>
          </div>

          <div class="setting-row">
            <div class="setting-info">
              <div class="setting-label">绑定微信</div>
              <div class="setting-desc">{{ wechatBound ? '已绑定' : '未绑定，扫码绑定微信账号' }}</div>
            </div>
            <button class="setting-btn" @click="bindWechat">{{ wechatBound ? '已绑定 ✓' : '扫码绑定' }}</button>
          </div>

          <div class="setting-row">
            <div class="setting-info">
              <div class="setting-label">绑定支付宝</div>
              <div class="setting-desc">{{ alipayBound ? '已绑定' : '未绑定，扫码绑定支付宝账号' }}</div>
            </div>
            <button class="setting-btn" @click="bindAlipay">{{ alipayBound ? '已绑定 ✓' : '扫码绑定' }}</button>
          </div>

          <div class="setting-row">
            <div class="setting-info">
              <div class="setting-label">登录邮箱</div>
              <div class="setting-desc">{{ userInfo?.email || '—' }}</div>
            </div>
            <span class="setting-static">已设置</span>
          </div>
        </div>
      </div>

      <!-- 密码管理 -->
      <div class="settings-section">
        <h2 class="section-title">🔑 密码管理</h2>
        <div class="settings-card">
          <div class="setting-row">
            <div class="setting-info">
              <div class="setting-label">重置登录密码</div>
              <div class="setting-desc">通过邮箱验证码重置登录密码</div>
            </div>
            <button class="setting-btn" @click="showResetPwd = true">重置密码</button>
          </div>

          <div class="setting-row">
            <div class="setting-info">
              <div class="setting-label">支付密码</div>
              <div class="setting-desc">{{ hasPayPwd ? '已设置，用于提现/消费验证' : '未设置，提现前需设置' }}</div>
            </div>
            <button class="setting-btn" @click="showPayPwd = true">{{ hasPayPwd ? '修改' : '设置' }}</button>
          </div>
        </div>
      </div>

      <!-- 绑定弹窗：扫码 -->
      <div v-if="showQr" class="modal-mask" @click.self="showQr = false">
        <div class="modal-box">
          <h3>{{ qrTitle }}</h3>
          <p class="modal-tip">{{ qrTip }}</p>
          <div class="qr-placeholder">
            <span class="qr-icon">{{ qrIcon }}</span>
            <p>{{ qrPlaceholder }}</p>
          </div>
          <button class="modal-close" @click="showQr = false">关闭</button>
        </div>
      </div>

      <!-- 修改昵称弹窗 -->
      <div v-if="showNickname" class="modal-mask" @click.self="showNickname = false">
        <div class="modal-box">
          <h3>修改用户昵称</h3>
          <p class="modal-tip">昵称用于茶馆、群聊等场景展示，最长 30 个字符</p>
          <input v-model="nicknameInput" class="modal-input" placeholder="请输入新昵称" maxlength="30" @keyup.enter="saveNickname" />
          <div class="modal-actions">
            <button class="modal-cancel" @click="showNickname = false">取消</button>
            <button class="modal-confirm" @click="saveNickname" :disabled="nicknameSaving">{{ nicknameSaving ? '保存中...' : '保存' }}</button>
          </div>
          <p v-if="nicknameError" class="modal-error">{{ nicknameError }}</p>
        </div>
      </div>

      <!-- 重置密码弹窗 -->
      <div v-if="showResetPwd" class="modal-mask" @click.self="showResetPwd = false">
        <div class="modal-box">
          <h3>重置登录密码</h3>
          <p class="modal-tip">验证码将发送至 {{ userInfo?.email || '注册邮箱' }}</p>
          <input v-model="resetEmail" class="modal-input" placeholder="邮箱" />
          <div class="modal-row">
            <input v-model="resetCode" class="modal-input" placeholder="邮箱验证码" />
            <button class="setting-btn" @click="sendResetCode" :disabled="codeCountdown > 0">
              {{ codeCountdown > 0 ? `${codeCountdown}s` : '发送验证码' }}
            </button>
          </div>
          <input v-model="newPassword" type="password" class="modal-input" placeholder="新密码（至少 6 位）" />
          <input v-model="confirmPassword" type="password" class="modal-input" placeholder="确认新密码" />
          <div class="modal-actions">
            <button class="modal-cancel" @click="showResetPwd = false">取消</button>
            <button class="modal-confirm" @click="doResetPassword" :disabled="resetLoading">{{ resetLoading ? '提交中...' : '确认重置' }}</button>
          </div>
          <p v-if="resetError" class="modal-error">{{ resetError }}</p>
        </div>
      </div>

      <!-- 支付密码弹窗 -->
      <div v-if="showPayPwd" class="modal-mask" @click.self="showPayPwd = false">
        <div class="modal-box">
          <h3>{{ hasPayPwd ? '修改支付密码' : '设置支付密码' }}</h3>
          <p class="modal-tip">用于提现、红包、礼物等消费操作验证</p>
          <input v-model="payPwd" type="password" class="modal-input" placeholder="6 位数字支付密码" maxlength="6" />
          <input v-model="payPwdConfirm" type="password" class="modal-input" placeholder="确认支付密码" maxlength="6" />
          <div class="modal-actions">
            <button class="modal-cancel" @click="showPayPwd = false">取消</button>
            <button class="modal-confirm" @click="doSetPayPwd" :disabled="payPwdLoading">{{ payPwdLoading ? '提交中...' : '确认' }}</button>
          </div>
          <p v-if="payPwdError" class="modal-error">{{ payPwdError }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const token = () => { try { return window.localStorage?.getItem('auth_token') || '' } catch { return '' } }

const userInfo = ref<any>(null)
const wechatBound = ref(false)
const alipayBound = ref(false)
const hasPayPwd = ref(false)

const showQr = ref(false)
const qrTitle = ref('')
const qrTip = ref('')
const qrIcon = ref('')
const qrPlaceholder = ref('')

const showResetPwd = ref(false)
const resetEmail = ref('')
const resetCode = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const codeCountdown = ref(0)
const resetLoading = ref(false)
const resetError = ref('')
let codeTimer: ReturnType<typeof setInterval> | null = null

const showPayPwd = ref(false)
const payPwd = ref('')
const payPwdConfirm = ref('')
const payPwdLoading = ref(false)
const payPwdError = ref('')

onMounted(async () => {
  try {
    const res = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token()}` } })
    if (res.ok) {
      const data = await res.json()
      const profile = data.data?.user || data.data || data
      userInfo.value = profile
      wechatBound.value = !!profile.wechatOpenId
      alipayBound.value = !!profile.alipayOpenId
      hasPayPwd.value = !!profile.hasPayPassword
      resetEmail.value = profile.email || ''
    }
  } catch (e) {
    console.warn('[Settings] failed to load profile', e)
  }
  try {
    const cached = JSON.parse(localStorage.getItem('auth_user') || '{}')
    if (!userInfo.value) userInfo.value = cached
    if (!resetEmail.value) resetEmail.value = cached.email || ''
  } catch {}
})

function bindPhone() {
  alert('手机号绑定即将上线（短信验证码通道已就绪）')
}

function bindWechat() {
  showQr.value = true
  qrTitle.value = '绑定微信'
  qrTip.value = '使用微信扫一扫，完成账号绑定'
  qrIcon.value = '💚'
  qrPlaceholder.value = '微信扫码绑定（即将上线）'
}

function bindAlipay() {
  showQr.value = true
  qrTitle.value = '绑定支付宝'
  qrTip.value = '使用支付宝扫一扫，完成账号绑定'
  qrIcon.value = '💙'
  qrPlaceholder.value = '支付宝扫码绑定（即将上线）'
}

const showNickname = ref(false)
const nicknameInput = ref('')
const nicknameSaving = ref(false)
const nicknameError = ref('')

const currentNickname = computed(() => userInfo.value?.displayName || userInfo.value?.nickname || userInfo.value?.username || '')

function openNickname() {
  nicknameError.value = ''
  nicknameInput.value = currentNickname.value
  showNickname.value = true
}

async function saveNickname() {
  nicknameError.value = ''
  const name = (nicknameInput.value || '').trim()
  if (!name) { nicknameError.value = '昵称不能为空'; return }
  if (name.length > 30) { nicknameError.value = '昵称不能超过 30 个字符'; return }
  nicknameSaving.value = true
  try {
    const res = await fetch('/api/user/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
      body: JSON.stringify({ displayName: name }),
    })
    const data = await res.json()
    if (!res.ok) {
      nicknameError.value = data.error || '保存失败'
      return
    }
    // 同步本地缓存（auth_user：cookie + localStorage）
    const updated = data.data || {}
    if (userInfo.value) {
      userInfo.value.nickname = updated.nickname || name
      userInfo.value.displayName = updated.displayName || name
      userInfo.value.username = updated.username || userInfo.value.username
    }
    try {
      const cached = JSON.parse(localStorage.getItem('auth_user') || '{}')
      cached.nickname = updated.nickname || name
      cached.displayName = updated.displayName || name
      localStorage.setItem('auth_user', JSON.stringify(cached))
    } catch {}
    try {
      document.cookie = `auth_user=${encodeURIComponent(JSON.stringify({ ...JSON.parse(decodeURIComponent(document.cookie.match(/(?:^|;\s*)auth_user=([^;]+)/)?.[1] || '{}')), nickname: updated.nickname || name, displayName: updated.displayName || name }))}; path=/; max-age=604800`
    } catch {}
    alert('昵称修改成功 ✅')
    showNickname.value = false
  } catch (err: any) {
    nicknameError.value = '保存失败: ' + (err.message || '')
  } finally {
    nicknameSaving.value = false
  }
}

async function sendResetCode() {
  resetError.value = ''
  if (!resetEmail.value || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(resetEmail.value)) {
    resetError.value = '请输入有效邮箱'
    return
  }
  try {
    const res = await fetch('/api/auth/send-reset-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: resetEmail.value }),
    })
    const data = await res.json()
    if (!res.ok) {
      resetError.value = data.error || '验证码发送失败'
      return
    }
    codeCountdown.value = 60
    if (codeTimer) clearInterval(codeTimer)
    codeTimer = setInterval(() => {
      codeCountdown.value--
      if (codeCountdown.value <= 0 && codeTimer) clearInterval(codeTimer)
    }, 1000)
    alert('验证码已发送至邮箱 📧')
  } catch (err: any) {
    resetError.value = '验证码发送失败: ' + (err.message || '')
  }
}

async function doResetPassword() {
  resetError.value = ''
  if (!resetCode.value) { resetError.value = '请输入验证码'; return }
  if (!newPassword.value || newPassword.value.length < 6) { resetError.value = '新密码至少 6 位'; return }
  if (newPassword.value !== confirmPassword.value) { resetError.value = '两次输入的密码不一致'; return }
  resetLoading.value = true
  try {
    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: resetEmail.value, code: resetCode.value, newPassword: newPassword.value }),
    })
    const data = await res.json()
    if (!res.ok) {
      resetError.value = data.error || '重置失败'
      return
    }
    alert('密码重置成功 ✅ 请使用新密码登录')
    showResetPwd.value = false
    resetCode.value = ''
    newPassword.value = ''
    confirmPassword.value = ''
  } catch (err: any) {
    resetError.value = '重置失败: ' + (err.message || '')
  } finally {
    resetLoading.value = false
  }
}

async function doSetPayPwd() {
  payPwdError.value = ''
  if (!/^\d{6}$/.test(payPwd.value)) { payPwdError.value = '支付密码必须是 6 位数字'; return }
  if (payPwd.value !== payPwdConfirm.value) { payPwdError.value = '两次输入的密码不一致'; return }
  payPwdLoading.value = true
  try {
    const res = await fetch('/api/user/pay-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
      body: JSON.stringify({ payPassword: payPwd.value }),
    })
    const data = await res.json()
    if (!res.ok) {
      payPwdError.value = data.error || '设置失败'
      return
    }
    hasPayPwd.value = true
    alert('支付密码设置成功 ✅')
    showPayPwd.value = false
    payPwd.value = ''
    payPwdConfirm.value = ''
  } catch (err: any) {
    payPwdError.value = '设置失败: ' + (err.message || '')
  } finally {
    payPwdLoading.value = false
  }
}
</script>

<style scoped>
.settings-page {
  min-height: 100vh;
  background: #0B1320;
  color: #e0e0e0;
  font-family: system-ui, -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif;
  padding: 24px;
  box-sizing: border-box;
}

.settings-header {
  max-width: 720px;
  margin: 0 auto 24px;
}

.back-btn {
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.6);
  padding: 6px 14px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.8rem;
  margin-bottom: 16px;
  transition: all 0.2s;
}
.back-btn:hover { color: #fff; border-color: rgba(255, 255, 255, 0.25); }

.settings-header h1 {
  font-size: 1.5rem;
  font-weight: 700;
  color: #fff;
  margin: 0 0 6px;
}

.settings-sub { font-size: 0.8rem; color: rgba(255, 255, 255, 0.4); margin: 0; }

.settings-body { max-width: 720px; margin: 0 auto; display: flex; flex-direction: column; gap: 28px; }

.section-title {
  font-size: 0.9rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.55);
  margin: 0 0 12px;
  letter-spacing: 0.5px;
}

.settings-card {
  background: rgba(255, 255, 255, 0.025);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 14px;
  overflow: hidden;
}

.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}
.setting-row:last-child { border-bottom: none; }

.setting-info { min-width: 0; }

.setting-label { font-size: 0.88rem; font-weight: 600; color: #e0e0e0; margin-bottom: 3px; }

.setting-desc { font-size: 0.75rem; color: rgba(255, 255, 255, 0.4); }

.setting-btn {
  flex-shrink: 0;
  background: rgba(249, 115, 22, 0.12);
  border: 1px solid rgba(249, 115, 22, 0.3);
  color: #fb923c;
  padding: 7px 16px;
  border-radius: 8px;
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}
.setting-btn:hover { background: rgba(249, 115, 22, 0.2); }

.setting-static { font-size: 0.78rem; color: rgba(255, 255, 255, 0.3); }

/* 弹窗 */
.modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.modal-box {
  background: #152238;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  padding: 28px;
  width: 100%;
  max-width: 380px;
  box-sizing: border-box;
}

.modal-box h3 { color: #fff; font-size: 1.05rem; margin: 0 0 8px; }
.modal-tip { font-size: 0.78rem; color: rgba(255, 255, 255, 0.45); margin: 0 0 16px; }

.qr-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 28px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px dashed rgba(255, 255, 255, 0.12);
  border-radius: 12px;
  margin-bottom: 16px;
  color: rgba(255, 255, 255, 0.35);
  font-size: 0.8rem;
}
.qr-icon { font-size: 2.6rem; }

.modal-input {
  width: 100%;
  box-sizing: border-box;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 10px 12px;
  color: #fff;
  font-size: 0.85rem;
  margin-bottom: 10px;
  outline: none;
}
.modal-input:focus { border-color: rgba(249, 115, 22, 0.5); }

.modal-row { display: flex; gap: 8px; }
.modal-row .modal-input { flex: 1; }
.modal-row .setting-btn { height: 40px; }

.modal-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 8px; }

.modal-cancel, .modal-confirm {
  padding: 9px 18px;
  border-radius: 8px;
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  border: none;
  transition: all 0.2s;
}
.modal-cancel { background: rgba(255, 255, 255, 0.06); color: rgba(255, 255, 255, 0.7); }
.modal-confirm { background: linear-gradient(135deg, #f97316, #fb923c); color: #fff; }
.modal-confirm:disabled { opacity: 0.5; cursor: not-allowed; }

.modal-close {
  width: 100%;
  padding: 10px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.7);
  border: none;
  cursor: pointer;
  font-size: 0.82rem;
}

.modal-error { color: #f87171; font-size: 0.75rem; margin: 10px 0 0; }
</style>
