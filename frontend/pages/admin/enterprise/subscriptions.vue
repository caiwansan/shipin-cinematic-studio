<template>
  <div class="space-y-6">
    <!-- 页面标题 -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-xl font-bold text-white">订阅管理</h1>
        <p class="text-sm text-gray-400 mt-1">管理 AI新媒体运营部门订阅生命周期</p>
      </div>
      <div class="flex items-center gap-2">
        <span class="px-2 py-1 bg-green-500/10 text-green-400 text-xs rounded">
          MRR: ¥{{ stats.mrr?.toFixed(0) || 0 }}
        </span>
        <span class="px-2 py-1 bg-blue-500/10 text-blue-400 text-xs rounded">
          ARR: ¥{{ stats.arr?.toFixed(0) || 0 }}
        </span>
      </div>
    </div>

    <!-- 统计卡片 -->
    <div class="grid grid-cols-5 gap-3">
      <div class="bg-[#0D1328]/60 border border-[#1A2240] rounded-xl p-4">
        <div class="text-2xl font-bold text-white">{{ stats.total || 0 }}</div>
        <div class="text-xs text-gray-400 mt-1">总订阅</div>
      </div>
      <div class="bg-[#0D1328]/60 border border-[#1A2240] rounded-xl p-4">
        <div class="text-2xl font-bold text-green-400">{{ stats.active || 0 }}</div>
        <div class="text-xs text-gray-400 mt-1">活跃</div>
      </div>
      <div class="bg-[#0D1328]/60 border border-[#1A2240] rounded-xl p-4">
        <div class="text-2xl font-bold text-yellow-400">{{ stats.paused || 0 }}</div>
        <div class="text-xs text-gray-400 mt-1">已暂停</div>
      </div>
      <div class="bg-[#0D1328]/60 border border-[#1A2240] rounded-xl p-4">
        <div class="text-2xl font-bold text-red-400">{{ stats.cancelled || 0 }}</div>
        <div class="text-xs text-gray-400 mt-1">已取消</div>
      </div>
      <div class="bg-[#0D1328]/60 border border-[#1A2240] rounded-xl p-4">
        <div class="text-2xl font-bold text-gray-400">{{ stats.expired || 0 }}</div>
        <div class="text-xs text-gray-400 mt-1">已过期</div>
      </div>
    </div>

    <!-- 筛选 -->
    <div class="flex items-center gap-3">
      <select
        v-model="statusFilter"
        class="bg-[#0D1328] border border-[#1A2240] text-white text-xs rounded-lg px-3 py-2"
      >
        <option value="">全部状态</option>
        <option value="active">活跃</option>
        <option value="paused">已暂停</option>
        <option value="cancelled">已取消</option>
        <option value="expired">已过期</option>
      </select>
      <input
        v-model="searchQuery"
        type="text"
        placeholder="搜索企业名称..."
        class="bg-[#0D1328] border border-[#1A2240] text-white text-xs rounded-lg px-3 py-2 w-64"
      />
      <button
        @click="fetchSubscriptions"
        class="px-3 py-2 bg-blue-600/20 text-blue-400 rounded-lg text-xs hover:bg-blue-600/30 transition"
      >
        刷新
      </button>
    </div>

    <!-- 订阅列表 -->
    <div v-if="loading" class="flex items-center justify-center py-16 text-gray-500 text-sm">加载中...</div>

    <div v-else-if="error" class="bg-red-900/20 border border-red-800/30 rounded-xl p-4 text-red-400 text-xs">
      {{ error }}
      <button @click="fetchSubscriptions" class="ml-2 underline">重试</button>
    </div>

    <div v-else class="bg-[#0D1328]/60 border border-[#1A2240] rounded-xl overflow-hidden">
      <table class="w-full text-xs">
        <thead>
          <tr class="border-b border-[#1A2240] text-gray-500">
            <th class="text-left px-4 py-3 font-medium">企业</th>
            <th class="text-left px-4 py-3 font-medium">套餐</th>
            <th class="text-left px-4 py-3 font-medium">周期</th>
            <th class="text-left px-4 py-3 font-medium">金额</th>
            <th class="text-left px-4 py-3 font-medium">状态</th>
            <th class="text-left px-4 py-3 font-medium">到期时间</th>
            <th class="text-left px-4 py-3 font-medium">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="sub in subscriptions"
            :key="sub.id"
            class="border-b border-[#1A2240]/50 last:border-0 hover:bg-white/[0.02]"
          >
            <td class="px-4 py-3 text-white">{{ sub.organization?.name || sub.organizationId }}</td>
            <td class="px-4 py-3 text-gray-300">{{ sub.snapshotName || '-' }}</td>
            <td class="px-4 py-3 text-gray-300">{{ sub.snapshotCycle === 'yearly' ? '年度' : '月度' }}</td>
            <td class="px-4 py-3 text-gray-300">¥{{ ((sub.snapshotPrice || 0) / 100).toFixed(0) }}</td>
            <td class="px-4 py-3">
              <span
                class="px-2 py-0.5 rounded text-xs"
                :class="statusClass(sub.status)"
              >
                {{ statusLabel(sub.status) }}
              </span>
            </td>
            <td class="px-4 py-3 text-gray-400">{{ formatDate(sub.expireAt) }}</td>
            <td class="px-4 py-3">
              <div class="flex gap-1">
                <button
                  v-if="sub.status === 'active'"
                  @click="handlePause(sub)"
                  class="px-2 py-1 bg-yellow-600/20 text-yellow-400 rounded text-xs hover:bg-yellow-600/30"
                >
                  暂停
                </button>
                <button
                  v-if="sub.status === 'paused'"
                  @click="handleResume(sub)"
                  class="px-2 py-1 bg-green-600/20 text-green-400 rounded text-xs hover:bg-green-600/30"
                >
                  恢复
                </button>
                <button
                  v-if="sub.status !== 'cancelled'"
                  @click="handleCancel(sub)"
                  class="px-2 py-1 bg-red-600/20 text-red-400 rounded text-xs hover:bg-red-600/30"
                >
                  取消
                </button>
                <button
                  @click="openChangePlan(sub)"
                  class="px-2 py-1 bg-blue-600/20 text-blue-400 rounded text-xs hover:bg-blue-600/30"
                >
                  变更套餐
                </button>
                <button
                  @click="openExtend(sub)"
                  class="px-2 py-1 bg-purple-600/20 text-purple-400 rounded text-xs hover:bg-purple-600/30"
                >
                  延期
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- 空状态 -->
      <div v-if="subscriptions.length === 0" class="py-16 text-center text-gray-500 text-sm">
        暂无订阅数据
      </div>
    </div>

    <!-- 变更套餐弹窗 -->
    <div v-if="showPlanModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div class="bg-[#0D1328] border border-[#1A2240] rounded-xl p-6 w-96">
        <h3 class="text-white font-bold mb-4">变更套餐</h3>
        <div class="space-y-3">
          <div>
            <label class="text-xs text-gray-400">目标套餐</label>
            <select
              v-model="planForm.planId"
              class="w-full mt-1 bg-[#1A2240] border border-[#2A3250] text-white text-xs rounded px-3 py-2"
            >
              <option v-for="plan in availablePlans" :key="plan.id" :value="plan.id">
                {{ plan.displayName }} - ¥{{ (plan.price / 100).toFixed(0) }}/月
              </option>
            </select>
          </div>
          <div>
            <label class="text-xs text-gray-400">原因</label>
            <input
              v-model="planForm.reason"
              type="text"
              placeholder="变更原因（审计用）"
              class="w-full mt-1 bg-[#1A2240] border border-[#2A3250] text-white text-xs rounded px-3 py-2"
            />
          </div>
        </div>
        <div class="flex justify-end gap-2 mt-6">
          <button @click="showPlanModal = false" class="px-4 py-2 text-gray-400 text-xs">取消</button>
          <button @click="handleChangePlan" class="px-4 py-2 bg-blue-600 text-white text-xs rounded">确认变更</button>
        </div>
      </div>
    </div>

    <!-- 延期弹窗 -->
    <div v-if="showExtendModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div class="bg-[#0D1328] border border-[#1A2240] rounded-xl p-6 w-96">
        <h3 class="text-white font-bold mb-4">延长订阅有效期</h3>
        <div class="space-y-3">
          <div>
            <label class="text-xs text-gray-400">延长天数</label>
            <input
              v-model.number="extendForm.days"
              type="number"
              min="1"
              class="w-full mt-1 bg-[#1A2240] border border-[#2A3250] text-white text-xs rounded px-3 py-2"
            />
          </div>
          <div>
            <label class="text-xs text-gray-400">原因</label>
            <input
              v-model="extendForm.reason"
              type="text"
              placeholder="延期原因（审计用）"
              class="w-full mt-1 bg-[#1A2240] border border-[#2A3250] text-white text-xs rounded px-3 py-2"
            />
          </div>
        </div>
        <div class="flex justify-end gap-2 mt-6">
          <button @click="showExtendModal = false" class="px-4 py-2 text-gray-400 text-xs">取消</button>
          <button @click="handleExtend" class="px-4 py-2 bg-purple-600 text-white text-xs rounded">确认延期</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { getAdminToken } from '~/utils/token-cache'

definePageMeta({ layout: 'admin-aigc' })

const loading = ref(false)
const error = ref('')
const subscriptions = ref<any[]>([])
const stats = ref<any>({})
const statusFilter = ref('')
const searchQuery = ref('')

// 弹窗控制
const showPlanModal = ref(false)
const showExtendModal = ref(false)
const currentSub = ref<any>(null)
const availablePlans = ref<any[]>([])

const planForm = reactive({
  planId: '',
  reason: '',
})

const extendForm = reactive({
  days: 30,
  reason: '',
})

const statusClass = (status: string) => {
  const map: any = {
    active: 'bg-green-500/10 text-green-400',
    paused: 'bg-yellow-500/10 text-yellow-400',
    cancelled: 'bg-red-500/10 text-red-400',
    expired: 'bg-gray-500/10 text-gray-400',
    pending: 'bg-blue-500/10 text-blue-400',
  }
  return map[status] || 'bg-gray-500/10 text-gray-400'
}

const statusLabel = (status: string) => {
  const map: any = {
    active: '活跃',
    paused: '已暂停',
    cancelled: '已取消',
    expired: '已过期',
    pending: '待支付',
  }
  return map[status] || status
}

const formatDate = (date: string | null) => {
  if (!date) return '-'
  return new Date(date).toLocaleDateString('zh-CN')
}

const fetchSubscriptions = async () => {
  loading.value = true
  error.value = ''
  try {
    const token = getAdminToken()
    const params = new URLSearchParams()
    if (statusFilter.value) params.set('status', statusFilter.value)
    params.set('page', '1')
    params.set('limit', '50')

    const res = await fetch(`/api/admin/enterprise/subscriptions?${params}`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    })
    const data = await res.json()
    if (data.success) {
      subscriptions.value = data.data || []
    } else {
      error.value = data.message || '加载失败'
    }
  } catch (err: any) {
    error.value = err.message || '网络错误'
  } finally {
    loading.value = false
  }
}

const fetchStats = async () => {
  try {
    const token = getAdminToken()
    const res = await fetch('/api/admin/enterprise/subscription-stats', {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    })
    const data = await res.json()
    if (data.success) stats.value = data.data
  } catch {
    // 静默
  }
}

const fetchPlans = async () => {
  try {
    const token = getAdminToken()
    const res = await fetch('/api/admin/enterprise/plans', {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    })
    const data = await res.json()
    if (data.success) availablePlans.value = data.data || []
  } catch {
    // 静默
  }
}

const adminOp = async (action: string, sub: any, body: any) => {
  const token = getAdminToken()
  const res = await fetch(`/api/admin/enterprise/subscriptions/${sub.id}/${action}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return res.json()
}

const handlePause = async (sub: any) => {
  if (!confirm(`确定暂停「${sub.organization?.name}」的订阅？`)) return
  const res = await adminOp('pause', sub, { reason: '管理员操作' })
  if (res.success) fetchSubscriptions()
  else alert(res.message || '操作失败')
}

const handleResume = async (sub: any) => {
  if (!confirm(`确定恢复「${sub.organization?.name}」的订阅？`)) return
  const res = await adminOp('resume', sub, { reason: '管理员操作' })
  if (res.success) fetchSubscriptions()
  else alert(res.message || '操作失败')
}

const handleCancel = async (sub: any) => {
  if (!confirm(`⚠️ 取消「${sub.organization?.name}」的订阅？此操作不可撤销。`)) return
  const res = await adminOp('cancel', sub, { reason: '管理员取消' })
  if (res.success) fetchSubscriptions()
  else alert(res.message || '操作失败')
}

const openChangePlan = (sub: any) => {
  currentSub.value = sub
  planForm.planId = ''
  planForm.reason = ''
  showPlanModal.value = true
}

const handleChangePlan = async () => {
  if (!planForm.planId) return alert('请选择目标套餐')
  const res = await adminOp('change-plan', currentSub.value, {
    planId: planForm.planId,
    reason: planForm.reason,
  })
  if (res.success) {
    showPlanModal.value = false
    fetchSubscriptions()
  } else {
    alert(res.message || '变更失败')
  }
}

const openExtend = (sub: any) => {
  currentSub.value = sub
  extendForm.days = 30
  extendForm.reason = ''
  showExtendModal.value = true
}

const handleExtend = async () => {
  if (!extendForm.days || extendForm.days <= 0) return alert('请输入有效的延长天数')
  const token = getAdminToken()
  const res = await fetch(`/api/admin/enterprise/subscriptions/${currentSub.value.id}/extend`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ days: extendForm.days, reason: extendForm.reason }),
  }).then((r) => r.json())
  if (res.success) {
    showExtendModal.value = false
    fetchSubscriptions()
  } else {
    alert(res.message || '延期失败')
  }
}

// 监听筛选
watch([statusFilter], () => {
  fetchSubscriptions()
})

onMounted(() => {
  fetchSubscriptions()
  fetchStats()
  fetchPlans()
})
</script>
