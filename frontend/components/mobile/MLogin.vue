<template>
  <div class="login-page">
    <div class="login-header">
      <span class="login-back" @click="close">&lt; 返回</span>
      <span class="login-title">登录</span>
      <span></span>
    </div>
    <div class="login-body">
      <div class="login-logo">🍵</div>
      <div class="login-subtitle">昆仑茶馆</div>
      <div class="login-tabs">
        <span :class="{ active: mode === 'login' }" @click="mode = 'login'">登录</span>
        <span :class="{ active: mode === 'register' }" @click="mode = 'register'">注册</span>
      </div>
      <input v-model="username" class="login-input" placeholder="用户名 / 手机号" />
      <input v-model="password" type="password" class="login-input" placeholder="密码" />
      <input v-if="mode === 'register'" v-model="inviteCode" class="login-input" placeholder="邀请码 (选填)" />
      <button class="login-btn" @click="submit">{{ mode === 'login' ? '登录' : '注册' }}</button>
      <div v-if="error" class="login-error">{{ error }}</div>
      <div class="login-quick">
        <span class="login-quick-title">快速登录</span>
        <div class="login-quick-btns">
          <span class="login-quick-btn" @click="quickDemo">体验账号</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
const emit = defineEmits(['close'])

const mode = ref('login')
const username = ref('')
const password = ref('')
const inviteCode = ref('')
const error = ref('')

function close() { emit('close') }

async function submit() {
  error.value = ''
  if (!username.value || !password.value) {
    error.value = '请填写完整'
    return
  }
  try {
    const endpoint = mode.value === 'login' ? '/api/auth/login' : '/api/auth/register'
    const body: any = { username: username.value, password: password.value }
    if (inviteCode.value) body.inviteCode = inviteCode.value
    const r = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    const j = await r.json()
    if (j.success || j.token) {
      localStorage.setItem('auth_token', j.token || j.data?.token || '')
      location.reload()
    } else {
      error.value = j.error || '登录失败'
    }
  } catch (e: any) {
    error.value = e.message || '网络错误'
  }
}

async function quickDemo() {
  username.value = 'demo'
  password.value = 'demo123'
  mode.value = 'login'
  await submit()
}
</script>

<style scoped>
.login-page { display: flex; flex-direction: column; height: 100vh; background: #f7f7f7; }
.login-header { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: #fff; border-bottom: 1px solid #e5e5e5; }
.login-back { font-size: 16px; color: #07c160; cursor: pointer; }
.login-title { font-size: 17px; font-weight: 600; }
.login-body { flex: 1; padding: 30px 20px; }
.login-logo { font-size: 60px; text-align: center; margin-bottom: 10px; }
.login-subtitle { font-size: 20px; font-weight: 600; text-align: center; margin-bottom: 30px; color: #333; }
.login-tabs { display: flex; justify-content: center; gap: 30px; margin-bottom: 20px; }
.login-tabs span { font-size: 16px; color: #999; padding-bottom: 6px; cursor: pointer; }
.login-tabs span.active { color: #07c160; border-bottom: 2px solid #07c160; }
.login-input { width: 100%; padding: 14px; margin-bottom: 12px; border: 1px solid #e5e5e5; border-radius: 8px; font-size: 15px; box-sizing: border-box; }
.login-btn { width: 100%; padding: 14px; background: #07c160; color: #fff; border: none; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer; margin-top: 10px; }
.login-error { color: #fa5151; font-size: 14px; text-align: center; margin-top: 10px; }
.login-quick { margin-top: 40px; }
.login-quick-title { font-size: 13px; color: #999; text-align: center; margin-bottom: 10px; }
.login-quick-btns { display: flex; justify-content: center; gap: 10px; }
.login-quick-btn { padding: 8px 20px; background: #fff; border: 1px solid #e5e5e5; border-radius: 20px; font-size: 13px; cursor: pointer; color: #666; }
</style>
