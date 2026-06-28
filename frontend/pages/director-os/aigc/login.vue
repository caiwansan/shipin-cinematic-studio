<template>
  <div class="flex items-center justify-center min-h-screen bg-[#060A18]">
    <div class="w-full max-w-sm mx-4">
      <div class="text-center mb-8">
        <div class="text-3xl mb-2">🎬</div>
        <div class="text-lg font-semibold text-white/90">Director OS 管理后台</div>
        <div class="text-xs text-gray-500 mt-1">昆仑镜观测层 v1.2</div>
      </div>
      <div class="bg-[#0D1328] border border-[#1A2240] rounded-2xl p-6">
        <div v-if="loginError" class="text-red-400 text-xs mb-3 text-center">{{ loginError }}</div>
        <input v-model="username" type="text" placeholder="管理员账号"
          class="w-full bg-[#0B1020] border border-[#1A2240] rounded-xl px-4 py-3 text-sm text-white/80 outline-none focus:border-blue-500/50 mb-3"
          @keyup.enter="doLogin" />
        <input v-model="password" type="password" placeholder="管理员密码"
          class="w-full bg-[#0B1020] border border-[#1A2240] rounded-xl px-4 py-3 text-sm text-white/80 outline-none focus:border-blue-500/50 mb-3"
          @keyup.enter="doLogin" />
        <button @click="doLogin" :disabled="loading"
          class="w-full py-3 bg-blue-600 hover:bg-blue-500 rounded-xl text-sm font-medium transition cursor-pointer disabled:opacity-50">
          {{ loading ? '登录中...' : '登 录' }}
        </button>
      </div>
      <div class="text-center mt-4">
        <a href="/director" class="text-[11px] text-gray-600 hover:text-gray-400 no-underline">← 返回 Director</a>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { getToken, setToken, clearAuth } from '~/utils/token-cache'
definePageMeta({ layout: false, middleware: [] })
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const username = ref('')
const password = ref('')
const loading = ref(false)
const loginError = ref('')

/**
 * 🛡️ 验证 admin token 有效性（调用后端 /api/admin/me）
 * 防止用户端 token 混用导致的越权访问
 */
async function verifyAdminToken(token: string): Promise<boolean> {
  try {
    const res = await fetch('/api/admin/me', {
      headers: { Authorization: `Bearer ${token}` }
    })
    return res.ok
  } catch {
    return false
  }
}

async function checkExistingLogin() {
  if (!process.client) return
  // 清理用户端可能残留的 token key（admin 与 用户端必须隔离）
  const userKeys = ['auth_user']
  userKeys.forEach(k => localStorage.removeItem(k))

  const token = getToken()
  if (token) {
    const valid = await verifyAdminToken(token)
    if (valid) {
      router.push('/director-os/aigc/overview')
    } else {
      // ⭐ token 无效/过期/不是 admin 用，清理后留在登录页
      clearAuth()
    }
  }
}

onMounted(checkExistingLogin)

async function doLogin() {
  if (!username.value || !password.value) {
    loginError.value = '请输入账号和密码'
    return
  }
  loading.value = true
  loginError.value = ''
  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username.value, password: password.value })
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(text || '登录失败')
    }
    const data = await res.json()
    if (data.token) {
      // 使用 token-cache 统一写入（内存 + localStorage）
      setToken(data.token)
      localStorage.setItem('admin-aigc-user', username.value)
      router.push('/director-os/aigc/overview')
    } else {
      loginError.value = '登录响应无效'
    }
  } catch (e: any) {
    loginError.value = e.message || '网络错误'
  } finally {
    loading.value = false
  }
}
</script>
