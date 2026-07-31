<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h2 class="text-sm text-white/70 font-medium">会员管理</h2>
      <div class="flex gap-2">
        <input v-model="searchQuery" type="text" placeholder="搜索用户名或邮箱..."
          class="bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-1.5 text-xs text-white/60 outline-none focus:border-blue-500/50 w-52" />
      </div>
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
              <th class="text-left px-4 py-3 font-medium">邮箱</th>
              <th class="text-left px-4 py-3 font-medium">手机</th>
              <th class="text-left px-4 py-3 font-medium">VIP</th>
              <th class="text-left px-4 py-3 font-medium">推荐人</th>
              <th class="text-left px-4 py-3 font-medium">钱包余额</th>
              <th class="text-left px-4 py-3 font-medium">状态</th>
              <th class="text-left px-4 py-3 font-medium">注册时间</th>
              <th class="text-left px-4 py-3 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="u in filteredUsers" :key="u.id || u._id" class="border-b border-[#1A2240]/50 last:border-0 hover:bg-white/[0.02]">
              <td class="px-4 py-3 text-gray-500">{{ (u.id || u._id || '').substring(0, 8) }}...</td>
              <td class="px-4 py-3 text-white/80">{{ u.username || u.name || '—' }}</td>
              <td class="px-4 py-3 text-gray-400">{{ u.email || '—' }}</td>
              <td class="px-4 py-3 text-gray-400">{{ u.phone || '—' }}</td>
              <td class="px-4 py-3">
                <span v-if="u.memberTier" class="px-2 py-0.5 rounded-full text-[10px]" :class="tierBadgeClass(u.memberTier)">
                  {{ tierLabel(u.memberTier) }}
                </span>
                <span v-else class="text-gray-600">普通</span>
              </td>
              <td class="px-4 py-3 text-gray-500 text-[10px]">{{ u.marketAgentId ? u.marketAgentId.substring(0,6) + '...' : '—' }}</td>
              <td class="px-4 py-3 text-gray-500 text-[10px]">{{ u.walletBalance ? '¥' + Number(u.walletBalance).toFixed(2) : '¥0.00' }}</td>
              <td class="px-4 py-3">
                <span class="px-2 py-0.5 rounded-full text-[10px]"
                  :class="(u.status === 'active' || u.status === 'online') ? 'bg-green-500/10 text-green-400' : 'bg-gray-500/10 text-gray-400'">
                  {{ u.status || 'offline' }}
                </span>
              </td>
              <td class="px-4 py-3 text-gray-500">{{ formatDate(u.createdAt || u.registerTime) }}</td>
              <td class="px-4 py-3">
                <button @click="openEdit(u)" class="text-blue-400 hover:text-blue-300 text-[11px]">调整</button>
              </td>
            </tr>
            <tr v-if="filteredUsers.length === 0">
              <td colspan="8" class="px-4 py-12 text-center text-gray-600">
                {{ searchQuery ? '没有匹配的用户' : '暂无用户数据' }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="text-[10px] text-gray-600">共 {{ users.length }} 位用户</div>
    </template>

    <!-- 调整 VIP 弹窗 -->
    <Transition name="modal-fade">
      <div v-if="editUser" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60" @click.self="editUser = null">
        <div class="bg-[#0D1328] border border-[#1A2240] rounded-2xl p-6 w-[360px] shadow-2xl">
          <h3 class="text-sm text-white/80 font-medium mb-4">调整会员等级</h3>
          <div class="space-y-3">
            <div class="text-xs text-gray-400">
              用户：<span class="text-white/70">{{ editUser.username || editUser.email }}</span>
            </div>
            <div class="text-xs text-gray-400">
              当前等级：<span class="text-white/70">{{ tierLabel(editUser.memberTier) || '普通用户' }}</span>
            </div>
            <select v-model="editNewTier" class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/70 outline-none focus:border-blue-500/50">
              <option value="free">普通用户（免费 / 体验版）</option>
              <option v-for="mp in planOptions" :key="mp.level" :value="mp.level">{{ mp.name }}</option>
            </select>
            <div class="text-xs text-gray-400 mt-3 mb-1">市场代理</div>
            <select v-model="editMarketAgent" class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/70 outline-none focus:border-blue-500/50">
              <option value="">无代理</option>
              <option v-for="a in marketAgents" :key="a.id" :value="a.id">{{ a.name }}（{{ a.contactPerson }}）</option>
            </select>

            <!-- 修改密码 -->
            <div class="border-t border-[#1A2240] pt-3 mt-3">
              <div class="text-xs text-gray-400 mb-2">修改密码</div>
              <div class="flex gap-2">
                <input v-model="newPassword" type="password" placeholder="输入新密码" maxlength="32"
                  class="flex-1 bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/70 outline-none focus:border-blue-500/50" />
                <button @click="savePassword" :disabled="changingPwd || !newPassword"
                  class="px-3 py-2 text-[11px] bg-amber-600 hover:bg-amber-500 text-white rounded-lg disabled:opacity-50 whitespace-nowrap">
                  {{ changingPwd ? '修改中...' : '修改密码' }}
                </button>
              </div>
              <div v-if="pwdError" class="text-red-400 text-[11px] mt-1">{{ pwdError }}</div>
              <div v-if="pwdSuccess" class="text-green-400 text-[11px] mt-1">{{ pwdSuccess }}</div>
            </div>

            <div v-if="editError" class="text-red-400 text-[11px]">{{ editError }}</div>
            <div class="flex gap-2 justify-end pt-2">
              <button @click="editUser = null; newPassword = ''; pwdError = ''; pwdSuccess = ''" class="px-4 py-1.5 text-[11px] text-gray-400 hover:text-white/70 border border-[#1A2240] rounded-lg">取消</button>
              <button @click="saveTier" :disabled="saving" class="px-4 py-1.5 text-[11px] bg-blue-600 hover:bg-blue-500 text-white rounded-lg disabled:opacity-50">
                {{ saving ? '保存中...' : '保存' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { getToken, setToken, clearAuth } from '~/utils/token-cache'
import { getTierLabel, getTierColorClass } from '~/constants/membership'
definePageMeta({ layout: 'admin-aigc' })
import { ref, computed, onMounted } from 'vue'

const loading = ref(true)
const error = ref('')
const users = ref<any[]>([])
const searchQuery = ref('')
const planOptions = ref<any[]>([])

const editUser = ref<any>(null)
const editNewTier = ref('')
const editMarketAgent = ref('')
const editError = ref('')
const saving = ref(false)
const marketAgents = ref<any[]>([])
const newPassword = ref('')
const changingPwd = ref(false)
const pwdError = ref('')
const pwdSuccess = ref('')

const filteredUsers = computed(() => {
  if (!searchQuery.value) return users.value
  const q = searchQuery.value.toLowerCase()
  return users.value.filter((u: any) =>
    (u.username || u.name || '').toLowerCase().includes(q) ||
    (u.email || '').toLowerCase().includes(q)
  )
})

function tierLabel(tier: string | undefined | null): string {
  if (!tier) return ''
  return getTierLabel(tier)
}

function tierBadgeClass(tier: string): string {
  const c = getTierColorClass(tier)
  const classMap: Record<string, string> = {
    green: 'bg-green-500/10 text-green-400',
    blue: 'bg-blue-500/10 text-blue-400',
    purple: 'bg-purple-500/10 text-purple-400',
    gray: 'bg-gray-500/10 text-gray-400',
    yellow: 'bg-yellow-500/10 text-yellow-400',
    amber: 'bg-amber-500/10 text-amber-400',
    rose: 'bg-rose-500/10 text-rose-400',
  }
  return classMap[c] || 'bg-blue-500/10 text-blue-400'
}

function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return '—'
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString('zh-CN')
  } catch {
    return dateStr
  }
}

function openEdit(u: any) {
  editUser.value = u
  editNewTier.value = u.memberTier || ''
  editMarketAgent.value = u.marketAgentId || ''
  editError.value = ''
  // 加载市场代理列表
  fetchMarketAgents()
}

async function fetchMarketAgents() {
  try {
    const token = getToken()
    const res = await fetch('/api/admin/market-agents', {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    })
    if (res.ok) {
      const d = await res.json()
      marketAgents.value = d.data || []
    }
  } catch {}
}

async function saveTier() {
  if (!editUser.value) return
  saving.value = true
  editError.value = ''
  try {
    const token = getToken()
    const res = await fetch('/api/admin/members/' + (editUser.value.id || editUser.value._id), {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        tier: editNewTier.value,
        marketAgentId: editMarketAgent.value || null,
      }),
    })
    if (res.ok) {
      editUser.value.memberTier = editNewTier.value
      editUser.value = null
      newPassword.value = ''
      pwdError.value = ''
      pwdSuccess.value = ''
    } else {
      const d = await res.json().catch(() => ({}))
      editError.value = d.error || '保存失败'
    }
  } catch (e: any) {
    editError.value = e.message || '网络错误'
  }
  saving.value = false
}

async function savePassword() {
  if (!editUser.value || !newPassword.value) return
  if (newPassword.value.length < 6) { pwdError.value = '密码至少 6 位'; return }
  if (newPassword.value.length > 32) { pwdError.value = '密码不超过 32 位'; return }
  changingPwd.value = true
  pwdError.value = ''
  pwdSuccess.value = ''
  try {
    const token = getToken()
    const res = await fetch('/api/admin/members/' + (editUser.value.id || editUser.value._id), {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ password: newPassword.value }),
    })
    if (res.ok) {
      pwdSuccess.value = '✅ 密码修改成功'
      newPassword.value = ''
    } else {
      const d = await res.json().catch(() => ({}))
      pwdError.value = d.error || '修改失败'
    }
  } catch (e: any) {
    pwdError.value = e.message || '网络错误'
  }
  changingPwd.value = false
}

async function fetchData() {
  loading.value = true
  error.value = ''
  try {
    const token = getToken()
    const [usersRes, plansRes] = await Promise.all([
      fetch('/api/admin/members', {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      }),
      fetch('/api/member/plans'),
    ])
    if (usersRes.ok) {
      const d = await usersRes.json()
      users.value = Array.isArray(d) ? d : (d.data || d.users || [])
    } else {
      error.value = '获取会员列表失败'
    }
    if (plansRes.ok) {
      const d = await plansRes.json()
      const raw = Array.isArray(d) ? d : (d.data || d.plans || [])
      planOptions.value = Array.isArray(raw) ? raw.filter((p: any) => p.enabled !== false) : []
    }
  } catch (e: any) {
    error.value = e.message || '网络错误'
  }
  loading.value = false
}

onMounted(fetchData)
</script>

<style scoped>
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.2s ease;
}
.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}
</style>