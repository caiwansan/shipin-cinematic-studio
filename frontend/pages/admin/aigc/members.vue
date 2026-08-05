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
      <div class="bg-[#0D1328]/60 border border-[#1A2240] rounded-xl overflow-x-auto">
        <table class="w-full text-xs">
          <thead>
            <tr class="border-b border-[#1A2240] text-gray-500">
              <th class="text-left px-4 py-3 font-medium">ID</th>
              <th class="text-left px-4 py-3 font-medium">用户名</th>
              <th class="text-left px-4 py-3 font-medium">邮箱</th>
              <th class="text-left px-4 py-3 font-medium">手机</th>
              <th class="text-left px-4 py-3 font-medium">💎 钻石</th>
              <th class="text-left px-4 py-3 font-medium">VIP</th>
              <th class="text-left px-4 py-3 font-medium">代理</th>
              <th class="text-left px-4 py-3 font-medium">状态</th>
              <th class="text-left px-4 py-3 font-medium">注册时间</th>
              <th class="text-left px-4 py-3 font-medium sticky right-0 bg-[#0D1328] shadow-[-8px_0_8px_-8px_rgba(0,0,0,0.5)]">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="u in pagedUsers" :key="u.id || u._id" class="group border-b border-[#1A2240]/50 last:border-0 hover:bg-white/[0.02]">
              <td class="px-4 py-3 text-gray-500">{{ (u.id || u._id || '').substring(0, 8) }}...</td>
              <td class="px-4 py-3 text-white/80">{{ u.username || u.name || '—' }}</td>
              <td class="px-4 py-3 text-gray-400">{{ u.email || '—' }}</td>
              <td class="px-4 py-3 text-gray-400">{{ u.phone || '—' }}</td>
              <td class="px-4 py-3">
                <span class="text-amber-400/90 font-medium">{{ u.membership?.credits ?? 0 }}</span>
              </td>
              <td class="px-4 py-3">
                <span v-if="u.memberTier" class="px-2 py-0.5 rounded-full text-[10px]" :class="tierBadgeClass(u.memberTier)">
                  {{ tierLabel(u.memberTier) }}
                </span>
                <span v-else class="text-gray-600">普通</span>
              </td>
              <td class="px-4 py-3 text-gray-500 text-[10px]">{{ u.marketAgentId ? u.marketAgentId.substring(0,6) + '...' : '—' }}</td>
              <td class="px-4 py-3">
                <span class="px-2 py-0.5 rounded-full text-[10px]"
                  :class="(u.status === 'active' || u.status === 'online') ? 'bg-green-500/10 text-green-400' : 'bg-gray-500/10 text-gray-400'">
                  {{ u.status || 'offline' }}
                </span>
              </td>
              <td class="px-4 py-3 text-gray-500">{{ formatDate(u.createdAt || u.registerTime) }}</td>
              <td class="px-4 py-3 sticky right-0 bg-[#0D1328] group-hover:bg-[#131A33]">
                <div class="flex gap-1.5">
                  <button @click="openEdit(u)" title="调整该用户 VIP 等级 / 绑定市场代理"
                    class="px-2.5 py-1 rounded-md bg-blue-500/10 border border-blue-500/30 text-blue-400 hover:bg-blue-500/20 hover:text-blue-300 text-[11px] font-medium whitespace-nowrap">调整 VIP</button>
                  <button @click="openCredits(u)" title="给该会员增加或扣减钻石（审计留痕）"
                    class="px-2.5 py-1 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 hover:text-amber-300 text-[11px] font-medium whitespace-nowrap">💎 增减钻石</button>
                </div>
              </td>
            </tr>
            <tr v-if="pagedUsers.length === 0">
              <td colspan="10" class="px-4 py-12 text-center text-gray-600">
                {{ searchQuery ? '没有匹配的用户' : '暂无用户数据' }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="flex items-center justify-between text-[10px] text-gray-600">
        <span>共 {{ users.length }} 位用户，每页 30 条</span>
        <div v-if="totalPages > 1" class="flex items-center gap-1.5">
          <button @click="page--" :disabled="page <= 1"
            class="px-2 py-1 rounded-md border border-[#1A2240] text-gray-400 hover:text-white/70 disabled:opacity-40 disabled:cursor-not-allowed">上一页</button>
          <span class="px-2 text-gray-500">{{ page }} / {{ totalPages }}</span>
          <button @click="page++" :disabled="page >= totalPages"
            class="px-2 py-1 rounded-md border border-[#1A2240] text-gray-400 hover:text-white/70 disabled:opacity-40 disabled:cursor-not-allowed">下一页</button>
        </div>
      </div>
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
              <option value="basic">基础版（29元/月）</option>
              <option value="pro">本地版（199元）</option>
              <option value="enterprise">年卡（299元/年）</option>
            </select>
            <div class="text-xs text-gray-400 mt-3 mb-1">市场代理</div>
            <select v-model="editMarketAgent" class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/70 outline-none focus:border-blue-500/50">
              <option value="">无代理</option>
              <option v-for="a in marketAgents" :key="a.id" :value="a.id">{{ a.name }}（{{ a.contactPerson }}）</option>
            </select>
            <div v-if="editError" class="text-red-400 text-[11px]">{{ editError }}</div>
            <div class="flex gap-2 justify-end pt-2">
              <button @click="editUser = null" class="px-4 py-1.5 text-[11px] text-gray-400 hover:text-white/70 border border-[#1A2240] rounded-lg">取消</button>
              <button @click="saveTier" :disabled="saving" class="px-4 py-1.5 text-[11px] bg-blue-600 hover:bg-blue-500 text-white rounded-lg disabled:opacity-50">
                {{ saving ? '保存中...' : '保存' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- 增减钻石弹窗 -->
    <Transition name="modal-fade">
      <div v-if="creditsUser" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60" @click.self="creditsUser = null">
        <div class="bg-[#0D1328] border border-[#1A2240] rounded-2xl p-6 w-[380px] shadow-2xl">
          <h3 class="text-sm text-white/80 font-medium mb-4">💎 增减钻石</h3>
          <div class="space-y-3">
            <div class="text-xs text-gray-400">
              用户：<span class="text-white/70">{{ creditsUser.username || creditsUser.email }}</span>
              <span class="ml-2">当前：<span class="text-amber-400 font-medium">{{ creditsUser.membership?.credits ?? 0 }} 钻</span></span>
            </div>
            <div>
              <div class="text-xs text-gray-400 mb-1">数量（正数=增加，负数=扣减）</div>
              <input v-model.number="creditsAmount" type="number" placeholder="例如 500 或 -100"
                class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/70 outline-none focus:border-amber-500/50" />
            </div>
            <div>
              <div class="text-xs text-gray-400 mb-1">操作原因 <span class="text-red-400">*</span>（必填，审计留痕）</div>
              <input v-model="creditsRemark" type="text" placeholder="例如：补发历史订单钻石 / 违规扣回"
                class="w-full bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-2 text-xs text-white/70 outline-none focus:border-amber-500/50" />
            </div>
            <div v-if="creditsError" class="text-red-400 text-[11px]">{{ creditsError }}</div>
            <div class="flex gap-2 justify-end pt-2">
              <button @click="creditsUser = null" class="px-4 py-1.5 text-[11px] text-gray-400 hover:text-white/70 border border-[#1A2240] rounded-lg">取消</button>
              <button @click="saveCredits" :disabled="creditsSaving" class="px-4 py-1.5 text-[11px] bg-amber-600 hover:bg-amber-500 text-white rounded-lg disabled:opacity-50">
                {{ creditsSaving ? '提交中...' : '确认调整' }}
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
definePageMeta({ layout: 'admin-aigc' })
import { ref, computed, onMounted, watch } from 'vue'

const loading = ref(true)
const error = ref('')
const users = ref<any[]>([])
const searchQuery = ref('')

const editUser = ref<any>(null)
const editNewTier = ref('')
const editMarketAgent = ref('')
const editError = ref('')
const saving = ref(false)
const marketAgents = ref<any[]>([])

// ── 增减钻石 ──
const creditsUser = ref<any>(null)
const creditsAmount = ref<number | null>(null)
const creditsRemark = ref('')
const creditsError = ref('')
const creditsSaving = ref(false)

function openCredits(u: any) {
  creditsUser.value = u
  creditsAmount.value = null
  creditsRemark.value = ''
  creditsError.value = ''
}

async function saveCredits() {
  if (!creditsUser.value) return
  const amount = creditsAmount.value
  if (!amount || !Number.isInteger(amount) || amount === 0) {
    creditsError.value = '数量必须是非零整数'
    return
  }
  const remark = creditsRemark.value.trim()
  if (!remark) {
    creditsError.value = '操作原因必填（审计要求）'
    return
  }
  creditsSaving.value = true
  creditsError.value = ''
  try {
    const token = getToken()
    const res = await fetch('/api/admin/members/' + (creditsUser.value.id || creditsUser.value._id) + '/credits', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ amount, remark }),
    })
    const d = await res.json().catch(() => ({}))
    if (res.ok) {
      const newCredits = d.data?.credits
      if (creditsUser.value.membership) creditsUser.value.membership.credits = newCredits
      else creditsUser.value.membership = { credits: newCredits }
      creditsUser.value = null
    } else {
      creditsError.value = d.error || '调整失败'
    }
  } catch (e: any) {
    creditsError.value = e.message || '网络错误'
  }
  creditsSaving.value = false
}

const filteredUsers = computed(() => {
  if (!searchQuery.value) return users.value
  const q = searchQuery.value.toLowerCase()
  return users.value.filter((u: any) =>
    (u.username || u.name || '').toLowerCase().includes(q) ||
    (u.email || '').toLowerCase().includes(q)
  )
})

// ── 分页：每页 30 条 ──
const PAGE_SIZE = 30
const page = ref(1)
const totalPages = computed(() => Math.max(1, Math.ceil(filteredUsers.value.length / PAGE_SIZE)))
const pagedUsers = computed(() => {
  const start = (page.value - 1) * PAGE_SIZE
  return filteredUsers.value.slice(start, start + PAGE_SIZE)
})

watch(searchQuery, () => { page.value = 1 })

import { getTierLabel, getTierColorClass, MEMBERSHIP_COLORS } from '~/constants/membership'

function tierLabel(tier: string | undefined | null): string {
  return getTierLabel(tier)
}

function tierBadgeClass(tier: string): string {
  const color = tier ? MEMBERSHIP_COLORS[tier] || 'gray' : 'gray'
  const colorMap: Record<string, string> = {
    gray: 'bg-gray-500/10 text-gray-400',
    blue: 'bg-blue-500/10 text-blue-400',
    purple: 'bg-purple-500/10 text-purple-400',
    green: 'bg-green-500/10 text-green-400',
    amber: 'bg-amber-500/10 text-amber-400',
    rose: 'bg-rose-500/10 text-rose-400',
    yellow: 'bg-yellow-500/10 text-yellow-400',
  }
  return colorMap[color] || colorMap.gray
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
    } else {
      const d = await res.json().catch(() => ({}))
      editError.value = d.error || '保存失败'
    }
  } catch (e: any) {
    editError.value = e.message || '网络错误'
  }
  saving.value = false
}

async function fetchData() {
  loading.value = true
  error.value = ''
  try {
    const token = getToken()
    const res = await fetch('/api/admin/members', {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    })
    if (res.ok) {
      const d = await res.json()
      users.value = Array.isArray(d) ? d : (d.data || d.users || [])
    } else {
      error.value = '获取会员列表失败'
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