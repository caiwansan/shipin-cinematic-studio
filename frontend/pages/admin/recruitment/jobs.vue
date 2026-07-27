<!-- Admin: 岗位池管理 -->
<!-- 位置：/admin/recruitment/jobs.vue -->
<!-- 职责：全平台岗位列表 — 搜索/筛选/详情/状态操作 -->
<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-lg font-semibold text-white/90">📋 岗位池</h1>
        <p class="text-xs text-gray-500 mt-1">平台岗位池 · 各企业岗位状态与 AI 匹配覆盖率</p>
      </div>
      <div class="flex items-center gap-2">
        <button @click="fetchData" class="px-3 py-1.5 bg-blue-600/20 text-blue-400 rounded-lg text-xs hover:bg-blue-600/30 transition cursor-pointer border-none">
          🔄 刷新
        </button>
      </div>
    </div>

    <!-- Search & Filters -->
    <div class="flex items-center gap-3 flex-wrap">
      <div class="relative flex-1 min-w-[200px]">
        <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs">🔍</span>
        <input
          v-model="searchKey"
          @keyup.enter="page = 1; fetchData()"
          placeholder="搜索岗位名称、部门、地点..."
          class="w-full bg-[#0D1328] border border-[#1A2240] rounded-lg text-xs text-gray-300 pl-8 pr-3 py-2 focus:outline-none focus:border-blue-500/40"
        />
      </div>
      <select v-model="filterStatus" @change="page = 1; fetchData()" class="bg-[#0D1328] border border-[#1A2240] rounded-lg text-xs text-gray-400 px-3 py-2">
        <option value="">全部状态</option>
        <option value="published">已发布</option>
        <option value="draft">草稿</option>
        <option value="paused">已暂停</option>
        <option value="closed">已关闭</option>
      </select>
      <select v-model="filterEnterprise" @change="page = 1; fetchData()" class="bg-[#0D1328] border border-[#1A2240] rounded-lg text-xs text-gray-400 px-3 py-2">
        <option value="">全部企业</option>
        <option v-for="ent in enterprises" :key="ent.id" :value="ent.id">{{ ent.name }}</option>
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
      <!-- Table -->
      <div class="overflow-x-auto rounded-xl border border-[#1A2240]">
        <table class="w-full text-xs border-collapse">
          <thead>
            <tr class="bg-[#0D1328]">
              <th class="text-left py-3 px-4 text-gray-500 font-medium">岗位名称</th>
              <th class="text-left py-3 px-4 text-gray-500 font-medium">所属企业</th>
              <th class="text-left py-3 px-4 text-gray-500 font-medium">部门</th>
              <th class="text-left py-3 px-4 text-gray-500 font-medium">地点</th>
              <th class="text-center py-3 px-4 text-gray-500 font-medium">状态</th>
              <th class="text-center py-3 px-4 text-gray-500 font-medium">候选人</th>
              <th class="text-center py-3 px-4 text-gray-500 font-medium">匹配率</th>
              <th class="text-left py-3 px-4 text-gray-500 font-medium">创建时间</th>
              <th class="text-center py-3 px-4 text-gray-500 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="list.length === 0">
              <td colspan="9" class="py-12 text-center text-gray-600">
                <div class="text-2xl mb-2">📋</div>
                暂无岗位数据
              </td>
            </tr>
            <tr v-for="job in list" :key="job.id" class="border-t border-[#1A2240]/50 hover:bg-white/[0.02] transition">
              <td class="py-3 px-4">
                <div class="text-white/80 font-medium">{{ job.title }}</div>
                <div v-if="job.requiredSkills?.length" class="text-gray-600 text-[10px] mt-0.5">
                  {{ job.requiredSkills.slice(0, 3).join(', ') }}
                </div>
              </td>
              <td class="py-3 px-4 text-gray-400">{{ job.enterprise?.name || '—' }}</td>
              <td class="py-3 px-4 text-gray-400">{{ job.department || '—' }}</td>
              <td class="py-3 px-4 text-gray-400">{{ job.location || '—' }}</td>
              <td class="py-3 px-4 text-center">
                <span class="px-2 py-0.5 rounded-full text-[10px] font-medium" :class="statusClass(job.status)">{{ statusLabel(job.status) }}</span>
              </td>
              <td class="py-3 px-4 text-center text-gray-400">{{ job._count?.candidates || 0 }}</td>
              <td class="py-3 px-4 text-center">
                <span :class="matchRateClass(job.matchRate)">{{ job.matchRate || 0 }}%</span>
              </td>
              <td class="py-3 px-4 text-gray-500">{{ formatTime(job.createdAt) }}</td>
              <td class="py-3 px-4 text-center">
                <div class="flex items-center justify-center gap-1">
                  <button @click="openDetail(job)" class="px-2 py-1 rounded text-[10px] bg-blue-600/10 text-blue-400 hover:bg-blue-600/20 cursor-pointer border-none" title="查看详情">详情</button>
                  <button v-if="job.status === 'published'" @click="updateStatus(job, 'paused')" class="px-2 py-1 rounded text-[10px] bg-yellow-600/10 text-yellow-400 hover:bg-yellow-600/20 cursor-pointer border-none" title="暂停">暂停</button>
                  <button v-if="job.status === 'paused'" @click="updateStatus(job, 'published')" class="px-2 py-1 rounded text-[10px] bg-green-600/10 text-green-400 hover:bg-green-600/20 cursor-pointer border-none" title="恢复">恢复</button>
                  <button v-if="job.status !== 'closed'" @click="updateStatus(job, 'closed')" class="px-2 py-1 rounded text-[10px] bg-red-600/10 text-red-400 hover:bg-red-600/20 cursor-pointer border-none" title="关闭">关闭</button>
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
      <div v-if="detailJob" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" @click.self="detailJob = null">
        <div class="bg-[#0D1328] border border-[#1A2240] rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-y-auto p-6 mx-4">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-base font-semibold text-white/90">岗位详情</h2>
            <button @click="detailJob = null" class="text-gray-500 hover:text-white text-lg cursor-pointer bg-transparent border-none">✕</button>
          </div>
          <template v-if="detailJob">
            <div class="space-y-4 text-xs">
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <div class="text-gray-500 mb-1">岗位名称</div>
                  <div class="text-white/80 font-medium">{{ detailJob.title }}</div>
                </div>
                <div>
                  <div class="text-gray-500 mb-1">所属企业</div>
                  <div class="text-white/80">{{ detailJob.enterprise?.name || '—' }}</div>
                </div>
                <div>
                  <div class="text-gray-500 mb-1">部门</div>
                  <div class="text-white/80">{{ detailJob.department || '—' }}</div>
                </div>
                <div>
                  <div class="text-gray-500 mb-1">工作地点</div>
                  <div class="text-white/80">{{ detailJob.location || '—' }}</div>
                </div>
                <div>
                  <div class="text-gray-500 mb-1">状态</div>
                  <span class="px-2 py-0.5 rounded-full text-[10px] font-medium" :class="statusClass(detailJob.status)">{{ statusLabel(detailJob.status) }}</span>
                </div>
                <div>
                  <div class="text-gray-500 mb-1">匹配率</div>
                  <div :class="matchRateClass(detailJob.matchRate)">{{ detailJob.matchRate || 0 }}%</div>
                </div>
              </div>
              <div v-if="detailJob.description">
                <div class="text-gray-500 mb-1">岗位描述</div>
                <div class="text-white/70 leading-relaxed bg-black/20 rounded-lg p-3">{{ detailJob.description }}</div>
              </div>
              <div v-if="detailJob.requiredSkills?.length">
                <div class="text-gray-500 mb-1">技能要求</div>
                <div class="flex flex-wrap gap-1">
                  <span v-for="s in detailJob.requiredSkills" :key="s" class="px-2 py-0.5 rounded-full bg-blue-600/10 text-blue-400 text-[10px]">{{ s }}</span>
                </div>
              </div>
              <div class="grid grid-cols-3 gap-4">
                <div>
                  <div class="text-gray-500 mb-1">候选人</div>
                  <div class="text-white/80 font-medium">{{ detailJob._count?.candidates || 0 }}</div>
                </div>
                <div>
                  <div class="text-gray-500 mb-1">面试数</div>
                  <div class="text-white/80 font-medium">{{ detailJob._count?.interviews || 0 }}</div>
                </div>
                <div>
                  <div class="text-gray-500 mb-1">创建时间</div>
                  <div class="text-white/80">{{ formatTime(detailJob.createdAt) }}</div>
                </div>
              </div>
            </div>
          </template>
          <div class="flex justify-end gap-2 mt-6">
            <button v-if="detailJob?.status === 'published'" @click="updateStatus(detailJob, 'paused'); detailJob = null" class="px-4 py-2 rounded-lg text-xs bg-yellow-600/10 text-yellow-400 hover:bg-yellow-600/20 cursor-pointer border-none">暂停招聘</button>
            <button v-if="detailJob?.status === 'paused'" @click="updateStatus(detailJob, 'published'); detailJob = null" class="px-4 py-2 rounded-lg text-xs bg-green-600/10 text-green-400 hover:bg-green-600/20 cursor-pointer border-none">恢复招聘</button>
            <button @click="detailJob = null" class="px-4 py-2 rounded-lg text-xs bg-white/5 text-gray-400 hover:bg-white/10 cursor-pointer border-none">关闭</button>
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
const filterEnterprise = ref('')
const searchKey = ref('')
const enterprises = ref<Array<{ id: string; name: string }>>([])
const detailJob = ref<any>(null)

function statusLabel(status: string) {
  const map: Record<string, string> = { published: '已发布', draft: '草稿', paused: '已暂停', closed: '已关闭' }
  return map[status] || status
}

function statusClass(status: string) {
  const map: Record<string, string> = {
    published: 'bg-green-500/10 text-green-400',
    draft: 'bg-gray-500/10 text-gray-400',
    paused: 'bg-yellow-500/10 text-yellow-400',
    closed: 'bg-red-500/10 text-red-400',
  }
  return map[status] || 'bg-gray-500/10 text-gray-400'
}

function matchRateClass(rate: number) {
  if (rate >= 70) return 'text-green-400'
  if (rate >= 40) return 'text-yellow-400'
  return 'text-red-400'
}

function formatTime(t: string) {
  return new Date(t).toLocaleDateString('zh-CN')
}

async function fetchEnterprises() {
  try {
    const token = window.localStorage?.getItem('auth_token') || ''
    const res = await fetch('/api/admin/recruitment/enterprises?pageSize=100', {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) {
      const json = await res.json()
      enterprises.value = json.list || []
    }
  } catch { /* ignore */ }
}

async function fetchData() {
  loading.value = true
  error.value = ''
  try {
    const token = window.localStorage?.getItem('auth_token') || ''
    const params = new URLSearchParams({ page: String(page.value), pageSize: String(pageSize) })
    if (filterStatus.value) params.set('status', filterStatus.value)
    if (filterEnterprise.value) params.set('enterpriseId', filterEnterprise.value)
    if (searchKey.value) params.set('keyword', searchKey.value)
    const res = await fetch(`/api/admin/recruitment/jobs?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json()
    list.value = json.list
    total.value = json.total
    totalPages.value = Math.ceil(json.total / pageSize)
  } catch (e: any) {
    error.value = e.message || '加载失败'
  } finally {
    loading.value = false
  }
}

function openDetail(job: any) {
  detailJob.value = job
}

async function updateStatus(job: any, status: string) {
  if (!confirm(`确认将此岗位「${statusLabel(status)}」？`)) return
  try {
    const token = window.localStorage?.getItem('auth_token') || ''
    const res = await fetch(`/api/admin/recruitment/jobs/${job.id}/status`, {
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

onMounted(() => {
  fetchEnterprises()
  fetchData()
})
</script>
