<template>
  <MPageShell title="设置" @close="$emit('close')">
    <div class="ms-card">
      <div class="ms-card-title">👤 个人资料</div>
      <div class="ms-row"><span class="ms-k">昵称</span><input v-model="nickname" class="ms-input" maxlength="20" placeholder="输入新昵称" /></div>
      <button class="ms-btn" :disabled="savingProfile" @click="saveProfile">{{ savingProfile ? '保存中…' : '保存昵称' }}</button>
    </div>

    <div class="ms-card">
      <div class="ms-card-title">🔒 修改密码</div>
      <input v-model="oldPwd" type="password" class="ms-input" placeholder="当前密码" />
      <input v-model="newPwd" type="password" class="ms-input" placeholder="新密码（至少 6 位）" />
      <button class="ms-btn" :disabled="changingPwd || !oldPwd || !newPwd || newPwd.length < 6" @click="changePwd">{{ changingPwd ? '提交中…' : '修改密码' }}</button>
      <p v-if="pwdMsg" class="ms-msg" :class="{ ok: pwdMsgOk }">{{ pwdMsg }}</p>
    </div>

    <button class="ms-logout" @click="logout">退出登录</button>
  </MPageShell>
</template>

<script setup lang="ts">
import MPageShell from '~/components/MPageShell.vue'
import { ref, onMounted } from 'vue'
import { mobileAuthFetch, mobileToast } from '~/composables/useMobileApi'

defineEmits<{ (e: 'close'): void }>()
const nickname = ref('')
const savingProfile = ref(false)
const oldPwd = ref('')
const newPwd = ref('')
const changingPwd = ref(false)
const pwdMsg = ref('')
const pwdMsgOk = ref(false)

onMounted(async () => {
  try {
    const r = await mobileAuthFetch('/api/auth/me')
    const j = await r.json()
    const u = j.user || j.data?.user || j
    nickname.value = u?.nickname || ''
  } catch { /* ignore */ }
})

async function saveProfile() {
  if (!nickname.value.trim()) return
  savingProfile.value = true
  try {
    const r = await mobileAuthFetch('/api/user/profile', {
      method: 'PUT',
      body: JSON.stringify({ nickname: nickname.value.trim() }),
    })
    const j = await r.json()
    if (j.success) mobileToast('✅ 昵称已保存')
    else mobileToast('⚠ ' + (j.error || '保存失败'))
  } catch { mobileToast('⚠ 网络错误') } finally { savingProfile.value = false }
}

async function changePwd() {
  changingPwd.value = true
  pwdMsg.value = ''
  try {
    const r = await mobileAuthFetch('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ oldPassword: oldPwd.value, newPassword: newPwd.value }),
    })
    const j = await r.json()
    if (j.success) {
      pwdMsg.value = '✅ 密码已修改'
      pwdMsgOk.value = true
      oldPwd.value = ''
      newPwd.value = ''
    } else {
      pwdMsg.value = '⚠ ' + (j.error || '修改失败')
      pwdMsgOk.value = false
    }
  } catch { pwdMsg.value = '⚠ 网络错误'; pwdMsgOk.value = false } finally { changingPwd.value = false }
}

function logout() {
  try {
    localStorage.removeItem('auth_token')
    localStorage.removeItem('accessToken')
    localStorage.removeItem('auth_user')
    localStorage.removeItem('user')
    document.cookie = 'auth_token=; path=/; max-age=0'
    document.cookie = 'auth_user=; path=/; max-age=0'
  } catch { /* ignore */ }
  mobileToast('已退出登录')
  setTimeout(() => { window.location.href = '/' }, 600)
}
</script>

<style scoped>
.ms-card { background: #fff; border-radius: 12px; margin-top: 12px; padding: 14px; }
.ms-card-title { font-size: 14px; font-weight: 600; margin-bottom: 10px; }
.ms-row { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
.ms-k { font-size: 13px; color: #666; width: 44px; }
.ms-input { flex: 1; padding: 10px 12px; border: 1px solid #e5e5e5; border-radius: 8px; font-size: 14px; outline: none; width: 100%; box-sizing: border-box; margin-top: 8px; }
.ms-btn { width: 100%; margin-top: 10px; padding: 11px; border: none; border-radius: 8px; background: #4f7df9; color: #fff; font-size: 14px; }
.ms-btn:disabled { opacity: .5; }
.ms-msg { font-size: 13px; color: #e5484d; margin-top: 8px; }
.ms-msg.ok { color: #22c55e; }
.ms-logout { width: 100%; margin-top: 16px; padding: 12px; border: none; border-radius: 10px; background: #fff; color: #e5484d; font-size: 15px; font-weight: 600; }
</style>
