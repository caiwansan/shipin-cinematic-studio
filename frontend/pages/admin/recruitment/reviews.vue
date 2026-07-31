<!-- ⛔ DEPRECATED · 已退出后台导航（SPRINT-ADMIN-IA-RECRUITMENT-CLEANUP-01）· 页面保留仅供 URL 直链/归档，业务数据归企业招聘工作台，运营数据归数据罗盘 -->
<!-- Admin: Human Review 审核队列 -->
<!-- 位置：/admin/recruitment/reviews.vue -->
<!-- 职责：审核队列列表 — 查看待审核候选人 + 状态筛选（P5-ADMIN-04） -->
<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-lg font-semibold text-white/90">📋 审核队列</h1>
        <p class="text-xs text-gray-500 mt-1">Human Review · 候选人审核决策</p>
      </div>
      <button @click="fetchData" class="px-3 py-1.5 bg-blue-600/20 text-blue-400 rounded-lg text-xs hover:bg-blue-600/30 transition cursor-pointer border-none">🔄 刷新</button>
    </div>

    <!-- Status Stats -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
      <div class="bg-[#0D1328]/60 border border-[#1A2240] rounded-xl p-3 text-center cursor-pointer hover:bg-white/[0.02] transition" :class="filterStatus === '' && 'border-blue-500/40'" @click="filterStatus = ''; page = 1; fetchData()">
        <div class="text-lg font-bold text-white/90">{{ total }}</div>
        <div class="text-[10px] text-gray-500">全部</div>
      </div>
      <div class="bg-[#0D1328]/60 border border-yellow-800/30 rounded-xl p-3 text-center cursor-pointer hover:bg-white/[0.02] transition" :class="filterStatus === 'pending' && 'border-yellow-500/40'" @click="filterStatus = 'pending'; page = 1; fetchData()">
        <div class="text-lg font-bold text-yellow-400">{{ statusCounts.pending ?? 0 }}</div>
        <div class="text-[10px] text-gray-500">待审核</div>
      </div>
      <div class="bg-[#0D1328]/60 border border-green-800/30 rounded-xl p-3 text-center cursor-pointer hover:bg-white/[0.02] transition" :class="filterStatus === 'approved' && 'border-green-500/40'" @click="filterStatus = 'approved'; page = 1; fetchData()">
        <div class="text-lg font-bold text-green-400">{{ statusCounts.approved ?? 0 }}</div>
        <div class="text-[10px] text-gray-500">已通过</div>
      </div>
      <div class="bg-[#0D1328]/60 border border-red-800/30 rounded-xl p-3 text-center cursor-pointer hover:bg-white/[0.02] transition" :class="filterStatus === 'rejected' && 'border-red-500/40'" @click="filterStatus = 'rejected'; page = 1; fetchData()">
        <div class="text-lg font-bold text-red-400">{{ statusCounts.rejected ?? 0 }}</div>
        <div class="text-[10px] text-gray-500">已拒绝</div>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center py-16 text-gray-500 text-sm">
      <div class="animate-spin w-5 h-5 border-2 border-gray-600 border-t-blue-400 rounded-full mr-2"></div>
      加载中...
    </div>

    <!-- Error -->
    <div v-else-if="error" class="bg-red-900/20 border border-red-800/30 rounded-xl p-4 text-red-400 text-xs">
      ⚠️ {{ error }} <button @click="fetchData" class="ml-2 underline cursor-pointer">重试</button>
    </div>

    <template v-else>
      <!-- Review Table -->
      <div class="overflow-x-auto rounded-xl border border-[#1A2240]">
        <table class="w-full text-xs border-collapse">
          <thead>
            <tr class="bg-[#0D1328]">
              <th class="text-left py-3 px-4 text-gray-500 font-medium">优先级</th>
              <th class="text-left py-3 px-4 text-gray-500 font-medium">候选人</th>
              <th class="text-left py-3 px-4 text-gray-500 font-medium">关联岗位</th>
              <th class="text-center py-3 px-4 text-gray-500 font-medium">匹配分</th>
              <th class="text-center py-3 px-4 text-gray-500 font-medium">综合分</th>
              <th class="text-left py-3 px-4 text-gray-500 font-medium">AI 推荐</th>
              <th class="text-center py-3 px-4 text-gray-500 font-medium">状态</th>
              <th class="text-left py-3 px-4 text-gray-500 font-medium">提交时间</th>
              <th class="text-center py-3 px-4 text-gray-500 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="list.length === 0">
              <td colspan="9" class="py-12 text-center text-gray-600">
                <div class="text-2xl mb-2">📋</div>
                暂无审核项
              </td>
            </tr>
            <tr v-for="item in list" :key="item.id" class="border-t border-[#1A2240]/50 hover:bg-white/[0.02] transition">
              <td class="py-3 px-4">
                <span v-if="item.priority >= 3" class="text-yellow-400 font-medium">P{{ item.priority }}</span>
                <span v-else class="text-gray-500">P{{ item.priority }}</span>
              </td>
              <td class="py-3 px-4">
                <div class="text-white/80 font-medium">{{ item.candidateName || '—' }}</div>
                <div v-if="item.briefSummary" class="text-gray-600 text-[10px] truncate max-w-[200px]">{{ item.briefSummary }}</div>
              </td>
              <td class="py-3 px-4 text-gray-400">{{ item.jobPostingTitle || item.jobTitle || '—' }}</td>
              <td class="py-3 px-4 text-center">
                <span v-if="item.matchScore != null" :class="scoreClass(item.matchScore)">{{ item.matchScore }}</span>
                <span v-else class="text-gray-600">—</span>
              </td>
              <td class="py-3 px-4 text-center">
                <span v-if="item.overallScore != null" :class="scoreClass(item.overallScore)">{{ item.overallScore }}</span>
                <span v-else class="text-gray-600">—</span>
              </td>
              <td class="py-3 px-4">
                <span class="text-gray-400 text-[10px] truncate max-w-[180px] block">{{ item.aiRecommendation || '—' }}</span>
              </td>
              <td class="py-3 px-4 text-center">
                <span :class="statusClass(item.status)" class="px-2 py-0.5 rounded-full text-[10px] font-medium">{{ statusLabel(item.status) }}</span>
              </td>
              <td class="py-3 px-4 text-gray-500">{{ formatTime(item.submittedAt) }}</td>
              <td class="py-3 px-4 text-center">
                <button
                  v-if="item.status === 'pending'"
                  @click="navigateTo(`/admin/recruitment/reviews/${item.id}`)"
                  class="px-2 py-1 rounded text-[10px] bg-blue-600/10 text-blue-400 hover:bg-blue-600/20 cursor-pointer border-none"
                >审核</button>
                <button
                  v-else
                  @click="navigateTo(`/admin/recruitment/reviews/${item.id}`)"
                  class="px-2 py-1 rounded text-[10px] bg-gray-600/10 text-gray-400 hover:bg-gray-600/20 cursor-pointer border-none"
                >查看</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div v-if="totalPages > 1" class="flex items-center justify-between text-xs text-gray-500">
        <span>共 {{ total }} 条 · 第 {{ page }}/{{ totalPages }} 页</span>
        <div class="flex gap-2">
          <button @click="page--; fetchData()" :disabled="page <= 1" class="px-3 py-1.5 bg-[#0D1328] border border-[#1A2240] rounded-lg disabled:opacity-30 cursor-pointer hover:bg-white/5">上一页</button>
          <button @click="page++; fetchData()" :disabled="page >= totalPages" class="px-3 py-1.5 bg-[#0D1328] border border-[#1A2240] rounded-lg disabled:opacity-30 cursor-pointer hover:bg-white/5">下一页</button>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admin-aigc' })
import { getAuthToken } from '~/utils/auth/token'
const loading = ref(false)
const error = ref('')
const list = ref<any[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const filterStatus = ref('')
const statusCounts = ref<Record<string, number>>({})

const totalPages = computed(() => Math.ceil(total.value / pageSize.value))

async function fetchData() {
  loading.value = true
  error.value = ''
  try {
    const params = new URLSearchParams({
      page: String(page.value),
      pageSize: String(pageSize.value),
    })
    if (filterStatus.value) params.set('status', filterStatus.value)

    const res = await fetch(`/api/admin/recruitment/reviews?${params}`, {
      headers: { 'Authorization': `Bearer ${getAuthToken() || ''}` },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    list.value = data.list || []
    total.value = data.total || 0
    statusCounts.value = data.statusCounts || {}
  } catch (e: any) {
    error.value = e.message || '加载失败'
  } finally {
    loading.value = false
  }
}

function statusLabel(status: string): string {
  const map: Record<string, string> = { pending: '待审核', approved: '已通过', rejected: '已拒绝', need_info: '需补充' }
  return map[status] || status
}

function statusClass(status: string): string {
  const map: Record<string, string> = {
    pending: 'bg-yellow-500/10 text-yellow-400',
    approved: 'bg-green-500/10 text-green-400',
    rejected: 'bg-red-500/10 text-red-400',
    need_info: 'bg-blue-500/10 text-blue-400',
  }
  return map[status] || 'bg-gray-500/10 text-gray-400'
}

function scoreClass(score: number): string {
  if (score >= 70) return 'text-green-400 font-medium'
  if (score >= 50) return 'text-yellow-400 font-medium'
  return 'text-red-400 font-medium'
}

function formatTime(t: string): string {
  if (!t) return '—'
  const d = new Date(t)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`
  return d.toLocaleDateString('zh-CN')
}

onMounted(fetchData)
</script>
