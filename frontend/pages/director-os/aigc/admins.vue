<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h2 class="text-sm text-white/70 font-medium">管理员设置</h2>
      <button @click="openCreateDialog"
        class="px-3 py-1.5 bg-blue-600/20 text-blue-400 rounded-lg text-xs hover:bg-blue-600/30 transition cursor-pointer border-none">
        + 新增管理员
      </button>
    </div>

    <div v-if="loading" class="flex items-center justify-center py-16 text-gray-500 text-sm">加载中...</div>

    <div v-else-if="error" class="bg-red-900/20 border border-red-800/30 rounded-xl p-4 text-red-400 text-xs">
      {{ error }}
      <button @click="fetchData" class="ml-2 underline">重试</button>
    </div>

    <template v-else>
      <div class="bg-[#0D1328]/60 border border-[#1A2240] rounded-xl overflow-hidden">
        <table class="w-full text-xs">
          <thead>
            <tr class="border-b border-[#1A2240] text-gray-500">
              <th class="text-left px-4 py-3 font-medium">ID</th>
              <th class="text-left px-4 py-3 font-medium">用户名</th>
              <th class="text-left px-4 py-3 font-medium">角色</th>
              <th class="text-left px-4 py-3 font-medium">状态</th>
              <th class="text-left px-4 py-3 font-medium">最后登录</th>
              <th class="text-left px-4 py-3 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="a in admins" :key="a.id || a._id" class="border-b border-[#1A2240]/50 last:border-0 hover:bg-white/[0.02]">
              <td class="px-4 py-3 text-gray-500">{{ a.id || a._id || '—' }}</td>
              <td class="px-4 py-3 text-white/80">{{ a.username || a.name || '—' }}</td>
              <td class="px-4 py-3">
                <span class="px-2 py-0.5 rounded-full text-[10px]"
                  :class="a.role === 'superadmin' ? 'bg-red-500/10 text-red-400' : 'bg-blue-500/10 text-blue-400'">
                  {{ a.role === 'superadmin' ? '超级管理员' : a.role || '管理员' }}
                </span>
              </td>
              <td class="px-4 py-3">
                <span class="px-2 py-0.5 rounded-full text-[10px]"
                  :class="a.status === 'active' ? 'bg-green-500/10 text-green-400' : 'bg-gray-500/10 text-gray-400'">
                  {{ a.status === 'active' ? '正常' : '禁用' }}
                </span>
              </td>
              <td class="px-4 py-3 text-gray-500">{{ formatDate(a.lastLogin) }}</td>
              <td class="px-4 py-3">
                <div class="flex gap-1.5">
                  <button @click="openPasswordDialog(a)"
                    class="px-2.5 py-1 bg-blue-600/20 text-blue-400 rounded-lg text-[10px] hover:bg-blue-600/30 transition cursor-pointer border-none">
                    修改密码
                  </button>
                  <button @click="deleteAdmin(a)"
                    class="px-2.5 py-1 bg-red-600/20 text-red-400 rounded-lg text-[10px] hover:bg-red-600/30 transition cursor-pointer border-none"
                    :disabled="a.username === currentUser">
                    删除
                  </button>
                </div>
              </td>
            </tr>
            <tr v-if="admins.length === 0">
              <td colspan="6" class="px-4 py-12 text-center text-gray-600">暂无管理员</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <!-- Create Admin Dialog -->
    <div v-if="showCreate" class="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div class="bg-[#0D1328] border border-[#1A2240] rounded-2xl p-6 w-full max-w-sm mx-4">
        <div class="text-sm text-white/80 font-medium mb-4">新增管理员</div>
        <div class="space-y-3">
          <div>
            <label class="text-[10px] text-gray-500 block mb-1">用户名</label>
            <input v-model="newAdmin.username" type="text" placeholder="管理员账号"
              class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/70 outline-none focus:border-blue-500/50" />
          </div>
          <div>
            <label class="text-[10px] text-gray-500 block mb-1">密码</label>
            <input v-model="newAdmin.password" type="password" placeholder="设置密码"
              class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/70 outline-none focus:border-blue-500/50" />
          </div>
          <div>
            <label class="text-[10px] text-gray-500 block mb-1">角色</label>
            <select v-model="newAdmin.role"
              class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/70 outline-none focus:border-blue-500/50">
              <option value="admin">管理员</option>
              <option value="superadmin">超级管理员</option>
            </select>
          </div>
        </div>
        <div v-if="createError" class="text-red-400 text-[10px] mt-2">{{ createError }}</div>
        <div class="flex gap-2 mt-4">
          <button @click="doCreateAdmin" :disabled="creating"
            class="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl text-xs font-medium transition cursor-pointer disabled:opacity-50 border-none">
            {{ creating ? '创建中...' : '创建' }}
          </button>
          <button @click="showCreate = false"
            class="px-4 py-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-xs text-gray-400 transition cursor-pointer border-none">
            取消
          </button>
        </div>
      </div>
    </div>

    <!-- Password Change Dialog -->
    <div v-if="showPassword" class="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div class="bg-[#0D1328] border border-[#1A2240] rounded-2xl p-6 w-full max-w-sm mx-4">
        <div class="text-sm text-white/80 font-medium mb-4">
          修改密码 — {{ passwordTarget?.username }}
        </div>
        <div class="space-y-3">
          <div v-if="!isSelfPassword">
            <label class="text-[10px] text-gray-500 block mb-1">新密码</label>
            <input v-model="passwordForm.newPassword" type="password" placeholder="输入新密码"
              class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/70 outline-none focus:border-blue-500/50" />
          </div>
          <div v-else>
            <div class="mb-3">
              <label class="text-[10px] text-gray-500 block mb-1">当前密码</label>
              <input v-model="passwordForm.currentPassword" type="password" placeholder="输入当前密码"
                class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/70 outline-none focus:border-blue-500/50" />
            </div>
            <div>
              <label class="text-[10px] text-gray-500 block mb-1">新密码</label>
              <input v-model="passwordForm.newPassword" type="password" placeholder="输入新密码"
                class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/70 outline-none focus:border-blue-500/50" />
            </div>
          </div>
        </div>
        <div v-if="passwordError" class="text-red-400 text-[10px] mt-2">{{ passwordError }}</div>
        <div v-if="passwordSuccess" class="text-green-400 text-[10px] mt-2">{{ passwordSuccess }}</div>
        <div class="flex gap-2 mt-4">
          <button @click="doChangePassword" :disabled="passwordLoading"
            class="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl text-xs font-medium transition cursor-pointer disabled:opacity-50 border-none">
            {{ passwordLoading ? '提交中...' : '确认修改' }}
          </button>
          <button @click="closePasswordDialog"
            class="px-4 py-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-xs text-gray-400 transition cursor-pointer border-none">
            取消
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { getToken, setToken, clearAuth } from '~/utils/token-cache'
definePageMeta({ layout: 'admin-aigc' })
import { ref, computed, onMounted } from 'vue'

const loading = ref(true)
const error = ref('')
const admins = ref<any[]>([])
const currentUser = ref('')

// Create dialog
const showCreate = ref(false)
const creating = ref(false)
const createError = ref('')
const newAdmin = ref({ username: '', password: '', role: 'admin' })

function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return '—'
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString('zh-CN') + ' ' + d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return dateStr
  }
}

async function fetchData() {
  loading.value = true
  error.value = ''
  currentUser.value = process.client ? (localStorage.getItem('admin-aigc-user') || '') : ''
  try {
    const token = getToken()
    const res = await fetch('/api/admin/admins', {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    })
    if (res.ok) {
      const d = await res.json()
      admins.value = Array.isArray(d) ? d : (Array.isArray(d.data) ? d.data : (Array.isArray(d.admins) ? d.admins : (d.data?.admins || [])))
    } else {
      // Reality Gate: API 失败不返回假数据，显示错误状态
      const d = await res.json().catch(() => ({}))
      error.value = `加载失败（HTTP ${res.status}）：${d.error || d.message || '请检查后端服务'}`
      admins.value = []
    }
  } catch (e: any) {
    error.value = `加载失败：${e.message || '网络错误'}`
    admins.value = []
  }
  loading.value = false
}

function openCreateDialog() {
  newAdmin.value = { username: '', password: '', role: 'admin' }
  createError.value = ''
  showCreate.value = true
}

async function doCreateAdmin() {
  if (!newAdmin.value.username || !newAdmin.value.password) {
    createError.value = '请填写用户名和密码'
    return
  }
  creating.value = true
  createError.value = ''
  try {
    const token = getToken()
    const res = await fetch('/api/admin/admins', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify(newAdmin.value)
    })
    if (res.ok) {
      const d = await res.json()
      admins.value.push(d.data || d || { id: Date.now(), ...newAdmin.value, status: 'active' })
      showCreate.value = false
    } else {
      // Reality Gate: 创建失败不 push 假数据，显示真实错误
      const d = await res.json().catch(() => ({}))
      createError.value = d.error || d.message || `创建失败（HTTP ${res.status}）`
    }
  } catch (e: any) {
    createError.value = `创建失败：${e.message || '网络错误'}`
  }
  creating.value = false
}

async function deleteAdmin(a: any) {
  if (!confirm(`确定删除管理员「${a.username}」？`)) return
  try {
    const token = getToken()
    const res = await fetch(`/api/admin/admins/${a.id || a._id}`, {
      method: 'DELETE',
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    })
    if (res.ok || res.status === 404) {
      admins.value = admins.value.filter((x: any) => x.id !== a.id && x._id !== a._id)
    } else {
      // Reality Gate: 删除失败不假装成功
      const d = await res.json().catch(() => ({}))
      alert(`删除失败：${d.error || d.message || `HTTP ${res.status}`}`)
    }
  } catch (e: any) {
    alert(`删除失败：${e.message || '网络错误'}`)
  }
}

// Password change dialog
const showPassword = ref(false)
const passwordLoading = ref(false)
const passwordError = ref('')
const passwordSuccess = ref('')
const passwordTarget = ref<any>(null)
const passwordForm = ref({ currentPassword: '', newPassword: '' })

const isSelfPassword = computed(() => passwordTarget.value?.username === currentUser.value)

function openPasswordDialog(a: any) {
  passwordTarget.value = a
  passwordForm.value = { currentPassword: '', newPassword: '' }
  passwordError.value = ''
  passwordSuccess.value = ''
  showPassword.value = true
}

function closePasswordDialog() {
  showPassword.value = false
  passwordTarget.value = null
}

async function doChangePassword() {
  if (!passwordForm.value.newPassword) {
    passwordError.value = '请输入新密码'
    return
  }
  if (isSelfPassword.value && !passwordForm.value.currentPassword) {
    passwordError.value = '修改自己的密码需要输入当前密码'
    return
  }
  passwordLoading.value = true
  passwordError.value = ''
  passwordSuccess.value = ''
  try {
    const token = getToken()
    const target = passwordTarget.value
    if (isSelfPassword.value) {
      // 修改自己：用 /api/admin/password
      const res = await fetch('/api/admin/password', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          currentPassword: passwordForm.value.currentPassword,
          newPassword: passwordForm.value.newPassword
        })
      })
      if (res.ok) {
        passwordSuccess.value = '密码修改成功'
        setTimeout(closePasswordDialog, 1500)
      } else {
        const d = await res.json().catch(() => ({}))
        passwordError.value = d.error || '密码修改失败'
      }
    } else {
      // 超级管理员修改他人：用 /api/admin/admins/:id
      const res = await fetch(`/api/admin/admins/${target.id || target._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ password: passwordForm.value.newPassword })
      })
      if (res.ok) {
        passwordSuccess.value = '密码修改成功'
        setTimeout(closePasswordDialog, 1500)
      } else {
        const d = await res.json().catch(() => ({}))
        passwordError.value = d.error || '密码修改失败'
      }
    }
  } catch {
    passwordError.value = '网络错误，请重试'
  }
  passwordLoading.value = false
}

onMounted(fetchData)
</script>
