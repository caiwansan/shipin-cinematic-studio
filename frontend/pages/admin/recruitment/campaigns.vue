<!-- ⛔ DEPRECATED · 已退出后台导航（SPRINT-ADMIN-IA-RECRUITMENT-CLEANUP-01）· 页面保留仅供 URL 直链/归档，业务数据归企业招聘工作台，运营数据归数据罗盘 -->
<!-- Admin: Campaign 管理 -->
<!-- 位置：/admin/recruitment/campaigns.vue -->
<!-- 职责：全平台招聘宣传活动 — 搜索/筛选/详情/审批 -->
<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-lg font-semibold text-white/90">📢 Campaign</h1>
        <p class="text-xs text-gray-500 mt-1">全平台招聘宣传 Campaign</p>
      </div>
      <button @click="fetchData" class="px-3 py-1.5 bg-blue-600/20 text-blue-400 rounded-lg text-xs hover:bg-blue-600/30 transition cursor-pointer border-none">🔄 刷新</button>
    </div>

    <!-- Search & Filters -->
    <div class="flex items-center gap-3 flex-wrap">
      <div class="relative flex-1 min-w-[200px]">
        <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs">🔍</span>
        <input
          v-model="searchKey"
          @keyup.enter="page = 1; fetchData()"
          placeholder="搜索 Campaign 标题..."
          class="w-full bg-[#0D1328] border border-[#1A2240] rounded-lg text-xs text-gray-300 pl-8 pr-3 py-2 focus:outline-none focus:border-blue-500/40"
        />
      </div>
      <select v-model="filterStatus" @change="page = 1; fetchData()" class="bg-[#0D1328] border border-[#1A2240] rounded-lg text-xs text-gray-400 px-3 py-2">
        <option value="">全部状态</option>
        <option value="draft">草稿</option>
        <option value="generating">生成中</option>
        <option value="pending_review">待审核</option>
        <option value="approved">已批准</option>
        <option value="publishing">发布中</option>
        <option value="published">已发布</option>
        <option value="paused">已暂停</option>
        <option value="closed">已关闭</option>
      </select>
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
      <!-- Stats -->
      <div class="grid grid-cols-4 gap-3">
        <div class="bg-[#0D1328]/60 border border-[#1A2240] rounded-xl p-3 text-center">
          <div class="text-lg font-bold text-white/90">{{ total }}</div>
          <div class="text-[10px] text-gray-500">总数</div>
        </div>
        <div class="bg-[#0D1328]/60 border border-green-800/30 rounded-xl p-3 text-center">
          <div class="text-lg font-bold text-green-400">{{ statusCounts.published || 0 }}</div>
          <div class="text-[10px] text-gray-500">已发布</div>
        </div>
        <div class="bg-[#0D1328]/60 border border-yellow-800/30 rounded-xl p-3 text-center">
          <div class="text-lg font-bold text-yellow-400">{{ statusCounts.pending_review || 0 }}</div>
          <div class="text-[10px] text-gray-500">待审核</div>
        </div>
        <div class="bg-[#0D1328]/60 border border-blue-800/30 rounded-xl p-3 text-center">
          <div class="text-lg font-bold text-blue-400">{{ statusCounts.generating || 0 }}</div>
          <div class="text-[10px] text-gray-500">生成中</div>
        </div>
      </div>

      <!-- Table -->
      <div class="overflow-x-auto rounded-xl border border-[#1A2240]">
        <table class="w-full text-xs border-collapse">
          <thead>
            <tr class="bg-[#0D1328]">
              <th class="text-left py-3 px-4 text-gray-500 font-medium">标题</th>
              <th class="text-left py-3 px-4 text-gray-500 font-medium">所属企业</th>
              <th class="text-center py-3 px-4 text-gray-500 font-medium">状态</th>
              <th class="text-center py-3 px-4 text-gray-500 font-medium">触达数</th>
              <th class="text-center py-3 px-4 text-gray-500 font-medium">转化数</th>
              <th class="text-left py-3 px-4 text-gray-500 font-medium">创建时间</th>
              <th class="text-left py-3 px-4 text-gray-500 font-medium">更新时间</th>
              <th class="text-center py-3 px-4 text-gray-500 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="list.length === 0">
              <td colspan="8" class="py-12 text-center text-gray-600">
                <div class="text-2xl mb-2">📢</div>
                暂无 Campaign
              </td>
            </tr>
            <tr v-for="c in list" :key="c.id" class="border-t border-[#1A2240]/50 hover:bg-white/[0.02] transition">
              <td class="py-3 px-4">
                <div class="text-white/80 font-medium">{{ c.title }}</div>
                <div v-if="c.description" class="text-gray-600 text-[10px] truncate max-w-[200px]">{{ c.description }}</div>
              </td>
              <td class="py-3 px-4 text-gray-400">{{ c.enterprise?.name || '—' }}</td>
              <td class="py-3 px-4 text-center">
                <span class="px-2 py-0.5 rounded-full text-[10px] font-medium" :class="statusClass(c.status)">{{ statusLabel(c.status) }}</span>
              </td>
              <td class="py-3 px-4 text-center text-gray-400">{{ c.reachCount ?? '—' }}</td>
              <td class="py-3 px-4 text-center text-gray-400">{{ c.conversionCount ?? '—' }}</td>
              <td class="py-3 px-4 text-gray-500">{{ formatTime(c.createdAt) }}</td>
              <td class="py-3 px-4 text-gray-500">{{ formatTime(c.updatedAt) }}</td>
              <td class="py-3 px-4 text-center">
                <div class="flex items-center justify-center gap-1">
                  <button @click="openDetail(c)" class="px-2 py-1 rounded text-[10px] bg-blue-600/10 text-blue-400 hover:bg-blue-600/20 cursor-pointer border-none">详情</button>
                  <button v-if="c.status === 'pending_review'" @click="approveCampaign(c)" class="px-2 py-1 rounded text-[10px] bg-green-600/10 text-green-400 hover:bg-green-600/20 cursor-pointer border-none">审批</button>
                  <button v-if="c.status === 'published'" @click="updateCampaignStatus(c, 'paused')" class="px-2 py-1 rounded text-[10px] bg-yellow-600/10 text-yellow-400 hover:bg-yellow-600/20 cursor-pointer border-none">暂停</button>
                  <button v-if="c.status === 'paused'" @click="updateCampaignStatus(c, 'published')" class="px-2 py-1 rounded text-[10px] bg-green-600/10 text-green-400 hover:bg-green-600/20 cursor-pointer border-none">恢复</button>
                </div>
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

    <!-- Detail Modal -->
    <Teleport to="body">
      <div v-if="detailItem" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" @click.self="detailItem = null">
        <div class="bg-[#0D1328] border border-[#1A2240] rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-y-auto p-6 mx-4">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-base font-semibold text-white/90">Campaign 详情</h2>
            <button @click="detailItem = null" class="text-gray-500 hover:text-white text-lg cursor-pointer bg-transparent border-none">✕</button>
          </div>
          <template v-if="detailItem">
            <div class="space-y-4 text-xs">
              <div class="pb-4 border-b border-[#1A2240]">
                <div class="text-white/90 font-semibold text-sm mb-1">{{ detailItem.title }}</div>
                <div class="text-gray-500">{{ detailItem.enterprise?.name || '—' }}</div>
                <div class="mt-2">
                  <span class="px-2 py-0.5 rounded-full text-[10px] font-medium" :class="statusClass(detailItem.status)">{{ statusLabel(detailItem.status) }}</span>
                </div>
              </div>
              <div class="grid grid-cols-2 gap-4">
                <div><span class="text-gray-500">触达数：</span><span class="text-white/70">{{ detailItem.reachCount ?? '—' }}</span></div>
                <div><span class="text-gray-500">转化数：</span><span class="text-white/70">{{ detailItem.conversionCount ?? '—' }}</span></div>
                <div><span class="text-gray-500">转化率：</span><span class="text-white/70">{{ detailItem.conversionRate ? detailItem.conversionRate + '%' : '—' }}</span></div>
                <div><span class="text-gray-500">预算：</span><span class="text-white/70">{{ detailItem.budget ? '¥' + detailItem.budget : '—' }}</span></div>
                <div><span class="text-gray-500">创建时间：</span><span class="text-white/70">{{ formatTime(detailItem.createdAt) }}</span></div>
                <div><span class="text-gray-500">更新时间：</span><span class="text-white/70">{{ formatTime(detailItem.updatedAt) }}</span></div>
              </div>
              <div v-if="detailItem.description">
                <div class="text-gray-500 mb-1">描述</div>
                <div class="text-white/70 leading-relaxed bg-black/20 rounded-lg p-3">{{ detailItem.description }}</div>
              </div>
              <div v-if="detailItem.content">
                <div class="text-gray-500 mb-1">内容</div>
                <div class="text-white/70 leading-relaxed bg-black/20 rounded-lg p-3 whitespace-pre-wrap">{{ detailItem.content }}</div>
              </div>
            </div>
          </template>
          <div class="flex justify-end gap-2 mt-6">
            <button v-if="detailItem?.status === 'pending_review'" @click="approveCampaign(detailItem); detailItem = null" class="px-4 py-2 rounded-lg text-xs bg-green-600/10 text-green-400 hover:bg-green-600/20 cursor-pointer border-none">审批通过</button>
            <button @click="detailItem = null" class="px-4 py-2 rounded-lg text-xs bg-white/5 text-gray-400 hover:bg-white/10 cursor-pointer border-none">关闭</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admin-aigc' })
import { ref, onMounted } from 'vue'

const loading = ref(false)
const error = ref('')
const list = ref<any[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = 20
const totalPages = ref(0)
const filterStatus = ref('')
const searchKey = ref('')
const detailItem = ref<any>(null)
const statusCounts = ref<Record<string, number>>({})

const statusLabelMap: Record<string, string> = {
  draft: '草稿', generating: '生成中', pending_review: '待审核',
  approved: '已批准', publishing: '发布中', published: '已发布',
  paused: '已暂停', closed: '已关闭',
}

function statusLabel(s: string) { return statusLabelMap[s] || s }
function statusClass(s: string) {
  const map: Record<string, string> = {
    draft: 'bg-gray-500/10 text-gray-400', generating: 'bg-blue-500/10 text-blue-400',
    pending_review: 'bg-yellow-500/10 text-yellow-400', approved: 'bg-green-500/10 text-green-400',
    publishing: 'bg-purple-500/10 text-purple-400', published: 'bg-green-500/10 text-green-400',
    paused: 'bg-yellow-500/10 text-yellow-400', closed: 'bg-red-500/10 text-red-400',
  }
  return map[s] || 'bg-gray-500/10 text-gray-400'
}

function formatTime(t: string) {
  return new Date(t).toLocaleDateString('zh-CN')
}

function openDetail(c: any) {
  detailItem.value = c
}

async function approveCampaign(c: any) {
  if (!confirm(`确认审批通过「${c.title}」？`)) return
  try {
    const token = window.localStorage?.getItem('auth_token') || ''
    const res = await fetch(`/api/admin/recruitment/campaigns/${c.id}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    fetchData()
  } catch (e: any) {
    error.value = '审批失败：' + (e.message || '未知错误')
  }
}

async function updateCampaignStatus(c: any, status: string) {
  if (!confirm(`确认将此 Campaign「${statusLabel(status)}」？`)) return
  try {
    const token = window.localStorage?.getItem('auth_token') || ''
    const res = await fetch(`/api/admin/recruitment/campaigns/${c.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status }),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    fetchData()
  } catch (e: any) {
    error.value = '操作失败：' + (e.message || '未知错误')
  }
}

async function fetchData() {
  loading.value = true
  error.value = ''
  try {
    const token = window.localStorage?.getItem('auth_token') || ''
    const params = new URLSearchParams({ page: String(page.value), pageSize: String(pageSize) })
    if (filterStatus.value) params.set('status', filterStatus.value)
    if (searchKey.value) params.set('keyword', searchKey.value)
    const res = await fetch(`/api/admin/recruitment/campaigns?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json()
    list.value = json.list
    total.value = json.total
    totalPages.value = Math.ceil(json.total / pageSize)
    statusCounts.value = json.statusCounts || {}
  } catch (e: any) {
    error.value = e.message || '加载失败'
  } finally {
    loading.value = false
  }
}

onMounted(() => { fetchData() })
</script>
