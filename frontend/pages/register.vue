<template>
  <NuxtLayout>
    <div class="min-h-screen flex items-center justify-center bg-gray-950">
      <div class="max-w-md w-full p-8 space-y-6 bg-gray-900 rounded-xl border border-gray-800">
        <div class="text-center">
          <h1 class="text-2xl font-bold text-white">注册盘古斧 AI OS</h1>
          <p class="text-sm text-gray-400 mt-2">创建你的 Studio 工作空间</p>
        </div>

        <form @submit.prevent="handleRegister" class="space-y-4">
          <div>
            <label class="text-sm text-gray-300">邮箱</label>
            <input v-model="email" type="email" required
              class="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:border-cyan-500 outline-none"
              placeholder="your@email.com" />
          </div>

          <div>
            <label class="text-sm text-gray-300">用户名</label>
            <input v-model="username" type="text" required
              class="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:border-cyan-500 outline-none"
              placeholder="studio_master" />
          </div>

          <div>
            <label class="text-sm text-gray-300">密码</label>
            <input v-model="password" type="password" required
              class="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:border-cyan-500 outline-none"
              placeholder="至少 8 位" />
          </div>

          <!-- Plan 选择 -->
          <div>
            <label class="text-sm text-gray-300 mb-2 block">选择套餐</label>
            <div class="grid grid-cols-2 gap-3">
              <div v-for="p in plans" :key="p.value"
                class="p-3 rounded-lg border cursor-pointer transition-colors text-center"
                :class="selectedPlan === p.value ? 'border-cyan-500 bg-cyan-500/10' : 'border-gray-700 bg-gray-800 hover:border-gray-600'"
                @click="selectedPlan = p.value">
                <div class="text-sm font-bold" :class="p.color">{{ p.label }}</div>
                <div class="text-xs text-gray-400 mt-1">{{ p.price }}</div>
              </div>
            </div>
          </div>

          <button type="submit" :disabled="loading"
            class="w-full py-2.5 bg-cyan-600 hover:bg-cyan-500 disabled:bg-gray-700 text-white rounded-lg font-medium text-sm transition-colors">
            {{ loading ? '注册中...' : '创建工作室 →' }}
          </button>
        </form>

        <!-- QQ/微信授权登录 -->
        <template v-if="qqStatus.enabled">
          <div class="flex items-center gap-3 my-2">
            <span class="flex-1 h-px bg-gray-700"></span>
            <span class="text-xs text-gray-500">其他方式</span>
            <span class="flex-1 h-px bg-gray-700"></span>
          </div>
          <div class="flex justify-center">
            <button type="button"
              class="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-gray-700 bg-gray-800 hover:bg-gray-700 text-white text-sm transition-colors disabled:opacity-50"
              @click="qqLogin" :disabled="qqLoading">
              <span>🐧</span>
              <span>{{ qqLoading ? '跳转中...' : 'QQ 一键注册' }}</span>
            </button>
          </div>
        </template>

        <div v-if="error" class="text-red-400 text-sm text-center">{{ error }}</div>
        <div v-if="success" class="text-green-400 text-sm text-center">{{ success }}</div>

        <p class="text-xs text-gray-500 text-center">
          已有账号？<a href="/login" class="text-cyan-400 hover:underline">登录</a>
        </p>
      </div>
    </div>
  </NuxtLayout>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

const email = ref('')
const username = ref('')
const password = ref('')
const selectedPlan = ref('free')
const loading = ref(false)
const error = ref('')
const success = ref('')

const qqStatus = ref({ enabled: false, appId: '' })
const qqLoading = ref(false)
let oauthTimer: ReturnType<typeof setInterval> | null = null

const plans = [
  { label: '免费', value: 'free', price: '¥0/月', color: 'text-gray-300' },
  { label: 'Pro', value: 'pro', price: '¥99/月', color: 'text-cyan-400' },
  { label: 'Studio', value: 'studio', price: '¥299/月', color: 'text-purple-400' },
  { label: '企业', value: 'enterprise', price: '定制', color: 'text-yellow-400' },
]

// ── QQ OAuth ──
function startOAuth(authUrl: string, onSuccess: (token: string) => void, onError: (err: string) => void) {
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
      onError('登录超时，请重试')
      return
    }
    const token = localStorage.getItem('accessToken')
    if (token) {
      clearInterval(oauthTimer!)
      oauthTimer = null
      qqLoading.value = false
      onSuccess(token)
      return
    }
  }, 500)
}

function qqLogin() {
  if (!qqStatus.value.enabled) return
  qqLoading.value = true
  error.value = ''
  fetch('/api/auth/qq/authorize')
    .then(r => r.json())
    .then(data => {
      const authUrl = data.data?.authUrl || data.authUrl
      if (authUrl) {
        startOAuth(authUrl, (token) => {
          localStorage.setItem('token', token)
          success.value = '注册成功！正在跳转...'
          setTimeout(() => navigateTo('/workbench/console'), 1000)
        })
        qqLoading.value = false
      } else {
        error.value = data.error || 'QQ登录启动失败'
        qqLoading.value = false
      }
    })
    .catch(() => { error.value = 'QQ登录暂时不可用'; qqLoading.value = false })
}

async function handleRegister() {
  loading.value = true
  error.value = ''
  success.value = ''
  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email.value,
        username: username.value,
        password: password.value,
        planLevel: selectedPlan.value,
      })
    })
    const data = await res.json()
    if (data.accessToken) {
      localStorage.setItem('token', data.accessToken)
      success.value = '注册成功！正在跳转...'
      setTimeout(() => navigateTo('/workbench/console'), 1000)
    } else {
      error.value = data.error || '注册失败'
    }
  } catch (e: any) {
    error.value = e.message || '网络错误'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetch('/api/auth/qq/status')
    .then(r => r.json())
    .then(d => { if (d.data) qqStatus.value = d.data })
    .catch(() => {})
})
</script>
