<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h2 class="text-sm text-white/70 font-medium">社区管理</h2>
      <div class="flex gap-2">
        <select v-model="statusFilter" class="bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-1.5 text-xs text-white/60 outline-none focus:border-blue-500/50">
          <option value="">全部状态</option>
          <option value="pending">待审核</option>
          <option value="approved">已通过</option>
          <option value="rejected">已驳回</option>
        </select>
        <input v-model="searchQuery" type="text" placeholder="搜索标题..."
          class="bg-[#0B1020] border border-[#1A2240] rounded-lg px-3 py-1.5 text-xs text-white/60 outline-none focus:border-blue-500/50 w-40" />
      </div>
    </div>

    <div v-if="loading" class="flex items-center justify-center py-16 text-gray-500 text-sm">加载中...</div>

    <div v-else-if="error" class="bg-red-900/20 border border-red-800/30 rounded-xl p-4 text-red-400 text-xs">
      {{ error }}
      <button @click="fetchPosts" class="ml-2 underline">重试</button>
    </div>

    <template v-else>
      <!-- Stats -->
      <div class="grid grid-cols-4 gap-3">
        <div class="bg-[#0D1328]/80 border border-[#1A2240] rounded-xl p-3">
          <div class="text-[10px] text-gray-500 mb-1">全部帖子</div>
          <div class="text-base font-semibold">{{ stats.total }}</div>
        </div>
        <div class="bg-[#0D1328]/80 border border-[#1A2240] rounded-xl p-3">
          <div class="text-[10px] text-gray-500 mb-1">待审核</div>
          <div class="text-base font-semibold text-yellow-400">{{ stats.pending }}</div>
        </div>
        <div class="bg-[#0D1328]/80 border border-[#1A2240] rounded-xl p-3">
          <div class="text-[10px] text-gray-500 mb-1">置顶帖</div>
          <div class="text-base font-semibold text-blue-400">{{ stats.pinned }}</div>
        </div>
        <div class="bg-[#0D1328]/80 border border-[#1A2240] rounded-xl p-3">
          <div class="text-[10px] text-gray-500 mb-1">精华帖</div>
          <div class="text-base font-semibold text-purple-400">{{ stats.essence }}</div>
        </div>
      </div>

      <!-- Table -->
      <div class="bg-[#0D1328]/60 border border-[#1A2240] rounded-xl overflow-hidden">
        <table class="w-full text-xs">
          <thead>
            <tr class="border-b border-[#1A2240] text-gray-500">
              <th class="text-left px-3 py-2.5 font-medium w-8">#</th>
              <th class="text-left px-3 py-2.5 font-medium">标题</th>
              <th class="text-left px-3 py-2.5 font-medium w-20">作者</th>
              <th class="text-left px-3 py-2.5 font-medium w-16">状态</th>
              <th class="text-left px-3 py-2.5 font-medium w-14">👁️</th>
              <th class="text-left px-3 py-2.5 font-medium w-14">❤️</th>
              <th class="text-left px-3 py-2.5 font-medium w-14">💬</th>
              <th class="text-left px-3 py-2.5 font-medium w-24">时间</th>
              <th class="text-left px-3 py-2.5 font-medium w-16">标记</th>
              <th class="text-right px-3 py-2.5 font-medium w-36">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(p, i) in posts" :key="p.id" class="border-b border-[#1A2240]/50 last:border-0 hover:bg-white/[0.02]">
              <td class="px-3 py-2.5 text-gray-500">{{ i + 1 + (pagination.page - 1) * pagination.pageSize }}</td>
              <td class="px-3 py-2.5">
                <div class="flex items-center gap-1.5">
                  <span v-if="p.isPinned" class="text-[10px]" title="置顶">📌</span>
                  <span v-if="p.isEssence" class="text-[10px]" title="精华">⭐</span>
                  <span class="text-white/70 truncate max-w-[220px] block" :title="p.title">{{ p.title }}</span>
                </div>
              </td>
              <td class="px-3 py-2.5 text-gray-400">{{ p.user?.username || '—' }}</td>
              <td class="px-3 py-2.5">
                <span class="px-1.5 py-0.5 rounded-full text-[10px]"
                  :class="statusClass(p.status)">
                  {{ statusLabel(p.status) }}
                </span>
              </td>
              <td class="px-3 py-2.5 text-gray-400">{{ p.viewCount }}</td>
              <td class="px-3 py-2.5 text-gray-400">{{ p.likeCount }}</td>
              <td class="px-3 py-2.5 text-gray-400">{{ p.commentCount }}</td>
              <td class="px-3 py-2.5 text-gray-500">{{ formatDate(p.createdAt) }}</td>
              <td class="px-3 py-2.5">
                <div class="flex gap-1">
                  <button v-if="!p.isPinned" @click="togglePin(p)" class="text-[10px] px-1.5 py-0.5 rounded bg-gray-700/30 text-gray-400 hover:text-blue-400 cursor-pointer border-none">📌</button>
                  <button v-else @click="togglePin(p)" class="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 cursor-pointer border-none">📌</button>
                  <button v-if="!p.isEssence" @click="toggleEssence(p)" class="text-[10px] px-1.5 py-0.5 rounded bg-gray-700/30 text-gray-400 hover:text-purple-400 cursor-pointer border-none">⭐</button>
                  <button v-else @click="toggleEssence(p)" class="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 cursor-pointer border-none">⭐</button>
                </div>
              </td>
              <td class="px-3 py-2.5 text-right">
                <div class="flex gap-1 justify-end">
                  <button v-if="p.status === 'pending'" @click="approvePost(p)" class="text-[10px] px-2 py-0.5 rounded bg-green-500/10 text-green-400 hover:bg-green-500/20 cursor-pointer border-none">通过</button>
                  <button v-if="p.status === 'pending'" @click="rejectPost(p)" class="text-[10px] px-2 py-0.5 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20 cursor-pointer border-none">驳回</button>
                  <button @click="deletePost(p)" class="text-[10px] px-2 py-0.5 rounded bg-red-500/5 text-red-500/60 hover:text-red-400 cursor-pointer border-none">删除</button>
                </div>
              </td>
            </tr>
            <tr v-if="posts.length === 0">
              <td colspan="10" class="px-4 py-12 text-center text-gray-600">暂无帖子数据</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div v-if="pagination.totalPages > 1" class="flex items-center justify-center gap-3">
        <button :disabled="pagination.page <= 1" @click="changePage(pagination.page - 1)"
          class="text-xs px-3 py-1 rounded bg-[#0D1328] border border-[#1A2240] text-gray-400 disabled:opacity-30 cursor-pointer">上一页</button>
        <span class="text-xs text-gray-500">{{ pagination.page }} / {{ pagination.totalPages }}</span>
        <button :disabled="pagination.page >= pagination.totalPages" @click="changePage(pagination.page + 1)"
          class="text-xs px-3 py-1 rounded bg-[#0D1328] border border-[#1A2240] text-gray-400 disabled:opacity-30 cursor-pointer">下一页</button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { getToken, setToken, clearAuth } from '~/utils/token-cache'
import { ref, watch, onMounted } from 'vue'
definePageMeta({ layout: 'admin-aigc' })

const posts = ref<any[]>([])
const pagination = ref({ page: 1, pageSize: 20, total: 0, totalPages: 1 })
const loading = ref(true)
const error = ref('')
const statusFilter = ref('')
const searchQuery = ref('')
const currentPage = ref(1)
const stats = ref({ total: 0, pending: 0, pinned: 0, essence: 0 })

async function fetchPosts() {
  loading.value = true; error.value = ''
  try {
    const params = new URLSearchParams()
    params.set('page', String(currentPage.value))
    params.set('pageSize', '20')
    if (statusFilter.value) params.set('status', statusFilter.value)
    if (searchQuery.value) params.set('search', searchQuery.value)

    const res = await fetch(`/api/community/admin/posts?${params.toString()}`, {
      headers: { 'x-admin-token': getToken() },
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || '获取失败')
    posts.value = data.posts || []
    pagination.value = data.pagination || { page: 1, pageSize: 20, total: 0, totalPages: 1 }

    // 统计
    const all = data.posts || []
    stats.value.total = data.pagination?.total || 0
    stats.value.pending = all.filter((p: any) => p.status === 'pending').length + (statusFilter.value === 'pending' ? 0 : 0)
    stats.value.pinned = all.filter((p: any) => p.isPinned).length
    stats.value.essence = all.filter((p: any) => p.isEssence).length
  } catch (err: any) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

async function approvePost(p: any) {
  const res = await fetch(`/api/community/admin/posts/${p.id}/approve`, {
    method: 'PATCH', headers: { 'x-admin-token': getToken() },
  })
  const data = await res.json()
  if (data.success) { p.status = 'approved'; fetchPosts() }
}

async function rejectPost(p: any) {
  const res = await fetch(`/api/community/admin/posts/${p.id}/reject`, {
    method: 'PATCH', headers: { 'x-admin-token': getToken() },
  })
  const data = await res.json()
  if (data.success) { p.status = 'rejected'; fetchPosts() }
}

async function togglePin(p: any) {
  const res = await fetch(`/api/community/admin/posts/${p.id}/pin`, {
    method: 'PATCH', headers: { 'x-admin-token': getToken() },
  })
  const data = await res.json()
  if (data.success) { p.isPinned = data.isPinned; fetchPosts() }
}

async function toggleEssence(p: any) {
  const res = await fetch(`/api/community/admin/posts/${p.id}/essence`, {
    method: 'PATCH', headers: { 'x-admin-token': getToken() },
  })
  const data = await res.json()
  if (data.success) { p.isEssence = data.isEssence; fetchPosts() }
}

async function deletePost(p: any) {
  if (!confirm(`确定删除帖子「${p.title}」？此操作不可恢复！`)) return
  const res = await fetch(`/api/community/admin/posts/${p.id}`, {
    method: 'DELETE', headers: { 'x-admin-token': getToken() },
  })
  const data = await res.json()
  if (data.success) fetchPosts()
}

function statusClass(status: string) {
  if (status === 'approved') return 'bg-green-500/10 text-green-400'
  if (status === 'pending') return 'bg-yellow-500/10 text-yellow-400'
  if (status === 'rejected') return 'bg-red-500/10 text-red-400'
  return 'bg-gray-500/10 text-gray-400'
}
function statusLabel(status: string) {
  if (status === 'approved') return '已通过'
  if (status === 'pending') return '待审核'
  if (status === 'rejected') return '已驳回'
  return status
}

function formatDate(date: string) {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function changePage(p: number) { currentPage.value = p; fetchPosts() }

watch(statusFilter, () => { currentPage.value = 1; fetchPosts() })
watch(searchQuery, () => { currentPage.value = 1; fetchPosts() })

onMounted(() => { fetchPosts() })
</script>
