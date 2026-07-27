<!-- Admin: 招聘会话管理 -->
<!-- 位置：/admin/recruitment/conversations.vue -->
<!-- 职责：全平台招聘沟通会话 — 搜索/筛选/详情/状态推进 -->
<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-lg font-semibold text-white/90">💬 会话管理</h1>
        <p class="text-xs text-gray-500 mt-1">全平台招聘沟通全流程 · 从发现到录用</p>
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
          placeholder="搜索候选人姓名、邮箱..."
          class="w-full bg-[#0D1328] border border-[#1A2240] rounded-lg text-xs text-gray-300 pl-8 pr-3 py-2 focus:outline-none focus:border-blue-500/40"
        />
      </div>
      <select v-model="filterStatus" @change="page = 1; fetchData()" class="bg-[#0D1328] border border-[#1A2240] rounded-lg text-xs text-gray-400 px-3 py-2">
        <option value="">全部状态</option>
        <option value="DISCOVERED">已发现</option>
        <option value="INVITED">已邀请</option>
        <option value="CHATTING">沟通中</option>
        <option value="AI_EVALUATING">AI 评估中</option>
        <option value="WAITING_HR_REVIEW">等待 HR</option>
        <option value="HR_CONTACTING">HR 联系中</option>
        <option value="INTERVIEW">面试</option>
        <option value="OFFER">Offer</option>
        <option value="HIRED">已录用</option>
        <option value="REJECTED">已拒绝</option>
      </select>
      <select v-model="sortBy" @change="page = 1; fetchData()" class="bg-[#0D1328] border border-[#1A2240] rounded-lg text-xs text-gray-400 px-3 py-2">
        <option value="updatedAt">最近更新</option>
        <option value="createdAt">最新创建</option>
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
      <!-- Pipeline Summary -->
      <div class="grid grid-cols-11 gap-1">
        <div v-for="stage in pipelineStages" :key="stage.value" class="text-center py-2 rounded-lg bg-[#0D1328] border border-[#1A2240]">
          <div class="text-sm font-bold" :class="filterStatus === stage.value ? 'text-blue-400' : 'text-white/70'">{{ pipelineCounts[stage.value] || 0 }}</div>
          <div class="text-[9px] text-gray-500 mt-0.5">{{ stage.label }}</div>
        </div>
      </div>

      <!-- Table -->
      <div class="overflow-x-auto rounded-xl border border-[#1A2240]">
        <table class="w-full text-xs border-collapse">
          <thead>
            <tr class="bg-[#0D1328]">
              <th class="text-left py-3 px-4 text-gray-500 font-medium">候选人</th>
              <th class="text-left py-3 px-4 text-gray-500 font-medium">邮箱</th>
              <th class="text-left py-3 px-4 text-gray-500 font-medium">所属企业</th>
              <th class="text-center py-3 px-4 text-gray-500 font-medium">状态</th>
              <th class="text-center py-3 px-4 text-gray-500 font-medium">消息数</th>
              <th class="text-left py-3 px-4 text-gray-500 font-medium">创建时间</th>
              <th class="text-left py-3 px-4 text-gray-500 font-medium">最近更新</th>
              <th class="text-center py-3 px-4 text-gray-500 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="list.length === 0">
              <td colspan="8" class="py-12 text-center text-gray-600">
                <div class="text-2xl mb-2">💬</div>
                暂无会话
              </td>
            </tr>
            <tr v-for="c in list" :key="c.id" class="border-t border-[#1A2240]/50 hover:bg-white/[0.02] transition">
              <td class="py-3 px-4">
                <div class="text-white/80 font-medium">{{ c.candidateName || '—' }}</div>
              </td>
              <td class="py-3 px-4 text-gray-400">{{ c.candidateEmail || '—' }}</td>
              <td class="py-3 px-4 text-gray-400">{{ c.enterprise?.name || '—' }}</td>
              <td class="py-3 px-4 text-center">
                <span class="px-2 py-0.5 rounded-full text-[10px] font-medium" :class="statusClass(c.status)">{{ statusLabel(c.status) }}</span>
              </td>
              <td class="py-3 px-4 text-center text-gray-400">{{ c._count?.messages || 0 }}</td>
              <td class="py-3 px-4 text-gray-500">{{ formatTime(c.createdAt) }}</td>
              <td class="py-3 px-4 text-gray-500">{{ formatTime(c.updatedAt) }}</td>
              <td class="py-3 px-4 text-center">
                <button @click="openDetail(c)" class="px-2 py-1 rounded text-[10px] bg-blue-600/10 text-blue-400 hover:bg-blue-600/20 cursor-pointer border-none">详情</button>
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
            <h2 class="text-base font-semibold text-white/90">会话详情</h2>
            <button @click="detailItem = null" class="text-gray-500 hover:text-white text-lg cursor-pointer bg-transparent border-none">✕</button>
          </div>
          <template v-if="detailItem">
            <div class="space-y-4 text-xs">
              <div class="flex items-center gap-4 pb-4 border-b border-[#1A2240]">
                <div class="w-12 h-12 rounded-full bg-gradient-to-br from-green-500 to-teal-600 flex items-center justify-center text-white text-lg font-bold">
                  {{ detailItem.candidateName?.charAt(0) || '?' }}
                </div>
                <div>
                  <div class="text-white/90 font-semibold text-sm">{{ detailItem.candidateName || '未知候选人' }}</div>
                  <div class="text-gray-500">{{ detailItem.candidateEmail || '—' }}</div>
                  <div class="mt-1">
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-medium" :class="statusClass(detailItem.status)">{{ statusLabel(detailItem.status) }}</span>
                  </div>
                </div>
              </div>
              <div class="grid grid-cols-2 gap-4">
                <div><span class="text-gray-500">所属企业：</span><span class="text-white/70">{{ detailItem.enterprise?.name || '—' }}</span></div>
                <div><span class="text-gray-500">消息数：</span><span class="text-white/70">{{ detailItem._count?.messages || 0 }}</span></div>
                <div><span class="text-gray-500">创建时间：</span><span class="text-white/70">{{ formatTime(detailItem.createdAt) }}</span></div>
                <div><span class="text-gray-500">最近更新：</span><span class="text-white/70">{{ formatTime(detailItem.updatedAt) }}</span></div>
              </div>
              <!-- Pipeline Progress -->
              <div>
                <div class="text-gray-500 mb-2">Pipeline 进度</div>
                <div class="flex items-center gap-1">
                  <template v-for="(stage, idx) in pipelineStages" :key="stage.value">
                    <div class="flex-1 h-2 rounded-full" :class="getPipelineStageClass(detailItem.status, stage.value)"></div>
                  </template>
                </div>
                <div class="flex justify-between mt-1">
                  <span class="text-[9px] text-gray-600">发现</span>
                  <span class="text-[9px] text-gray-600">录用</span>
                </div>
              </div>
              <!-- Recent Messages -->
              <div v-if="detailItem.messages?.length">
                <div class="text-gray-500 mb-2">最近消息</div>
                <div class="space-y-2 max-h-40 overflow-y-auto">
                  <div v-for="msg in detailItem.messages.slice(-5)" :key="msg.id" class="bg-black/20 rounded-lg p-2">
                    <div class="flex items-center gap-2 mb-1">
                      <span class="text-[10px] font-medium" :class="msg.role === 'assistant' ? 'text-blue-400' : 'text-gray-400'">{{ msg.role === 'assistant' ? 'AI' : '候选人' }}</span>
                      <span class="text-[9px] text-gray-600">{{ formatTime(msg.createdAt) }}</span>
                    </div>
                    <div class="text-white/60 text-[10px] line-clamp-2">{{ msg.content }}</div>
                  </div>
                </div>
              </div>
            </div>
          </template>
          <div class="flex justify-end gap-2 mt-6">
            <button @click="detailItem = null" class="px-4 py-2 rounded-lg text-xs bg-white/5 text-gray-400 hover:bg-white/10 cursor-pointer border-none">关闭</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admin-aigc' })
import { ref, computed, onMounted } from 'vue'

const loading = ref(false)
const error = ref('')
const list = ref<any[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = 20
const totalPages = ref(0)
const filterStatus = ref('')
const sortBy = ref('updatedAt')
const searchKey = ref('')
const detailItem = ref<any>(null)
const pipelineCounts = ref<Record<string, number>>({})

const pipelineStages = [
  { value: 'DISCOVERED', label: '发现' },
  { value: 'INVITED', label: '邀请' },
  { value: 'CHATTING', label: '沟通' },
  { value: 'AI_EVALUATING', label: 'AI评估' },
  { value: 'WAITING_HR_REVIEW', label: '待HR' },
  { value: 'HR_CONTACTING', label: 'HR联系' },
  { value: 'INTERVIEW', label: '面试' },
  { value: 'OFFER', label: 'Offer' },
  { value: 'HIRED', label: '录用' },
  { value: 'REJECTED', label: '拒绝' },
]

const statusLabelMap: Record<string, string> = {
  DISCOVERED: '已发现', INVITED: '已邀请', CHATTING: '沟通中',
  AI_EVALUATING: 'AI评估中', WAITING_HR_REVIEW: '待HR',
  HR_CONTACTING: 'HR联系中', INTERVIEW: '面试', OFFER: 'Offer',
  HIRED: '已录用', REJECTED: '已拒绝',
}

function statusLabel(s: string) { return statusLabelMap[s] || s }
function statusClass(s: string) {
  const map: Record<string, string> = {
    DISCOVERED: 'bg-gray-500/10 text-gray-400', INVITED: 'bg-blue-500/10 text-blue-400',
    CHATTING: 'bg-green-500/10 text-green-400', AI_EVALUATING: 'bg-purple-500/10 text-purple-400',
    WAITING_HR_REVIEW: 'bg-yellow-500/10 text-yellow-400', HR_CONTACTING: 'bg-orange-500/10 text-orange-400',
    INTERVIEW: 'bg-cyan-500/10 text-cyan-400', OFFER: 'bg-emerald-500/10 text-emerald-400',
    HIRED: 'bg-green-500/10 text-green-400', REJECTED: 'bg-red-500/10 text-red-400',
  }
  return map[s] || 'bg-gray-500/10 text-gray-400'
}

function getPipelineStageClass(currentStatus: string, stageValue: string) {
  const stages = pipelineStages.map(s => s.value)
  const currentIdx = stages.indexOf(currentStatus)
  const stageIdx = stages.indexOf(stageValue)
  if (currentStatus === 'REJECTED') return stageValue === 'REJECTED' ? 'bg-red-500' : 'bg-gray-700'
  if (stageIdx <= currentIdx) return 'bg-blue-500'
  return 'bg-gray-700'
}

function formatTime(t: string) {
  return new Date(t).toLocaleDateString('zh-CN')
}

function openDetail(c: any) {
  detailItem.value = c
}

async function fetchData() {
  loading.value = true
  error.value = ''
  try {
    const token = window.localStorage?.getItem('auth_token') || ''
    const params = new URLSearchParams({ page: String(page.value), pageSize: String(pageSize), sortBy: sortBy.value })
    if (filterStatus.value) params.set('status', filterStatus.value)
    if (searchKey.value) params.set('keyword', searchKey.value)
    const res = await fetch(`/api/admin/recruitment/conversations?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json()
    list.value = json.list
    total.value = json.total
    totalPages.value = Math.ceil(json.total / pageSize)
    if (json.pipelineCounts) pipelineCounts.value = json.pipelineCounts
  } catch (e: any) {
    error.value = e.message || '加载失败'
  } finally {
    loading.value = false
  }
}

onMounted(() => { fetchData() })
</script>
