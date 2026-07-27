<!-- Admin: 面试管理 -->
<!-- 位置：/admin/recruitment/interviews.vue -->
<!-- 职责：全平台面试列表 — 搜索/筛选/详情/评分 -->
<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-lg font-semibold text-white/90">🎤 面试管理</h1>
        <p class="text-xs text-gray-500 mt-1">全平台 AI 面试 · 状态与评分总览</p>
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
          placeholder="搜索候选人、岗位..."
          class="w-full bg-[#0D1328] border border-[#1A2240] rounded-lg text-xs text-gray-300 pl-8 pr-3 py-2 focus:outline-none focus:border-blue-500/40"
        />
      </div>
      <select v-model="filterStatus" @change="page = 1; fetchData()" class="bg-[#0D1328] border border-[#1A2240] rounded-lg text-xs text-gray-400 px-3 py-2">
        <option value="">全部状态</option>
        <option value="preparing">准备中</option>
        <option value="question_ready">题目就绪</option>
        <option value="in_progress">进行中</option>
        <option value="evaluating">评估中</option>
        <option value="completed">已完成</option>
        <option value="decision_made">已决策</option>
      </select>
      <select v-model="filterScore" @change="page = 1; fetchData()" class="bg-[#0D1328] border border-[#1A2240] rounded-lg text-xs text-gray-400 px-3 py-2">
        <option value="">全部评分</option>
        <option value="excellent">优秀 (≥80)</option>
        <option value="pass">合格 (60-79)</option>
        <option value="fail">不合格 (&lt;60)</option>
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
              <th class="text-left py-3 px-4 text-gray-500 font-medium">候选人</th>
              <th class="text-left py-3 px-4 text-gray-500 font-medium">应聘岗位</th>
              <th class="text-center py-3 px-4 text-gray-500 font-medium">状态</th>
              <th class="text-center py-3 px-4 text-gray-500 font-medium">总分</th>
              <th class="text-center py-3 px-4 text-gray-500 font-medium">题目数</th>
              <th class="text-left py-3 px-4 text-gray-500 font-medium">面试时间</th>
              <th class="text-left py-3 px-4 text-gray-500 font-medium">更新时间</th>
              <th class="text-center py-3 px-4 text-gray-500 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="list.length === 0">
              <td colspan="8" class="py-12 text-center text-gray-600">
                <div class="text-2xl mb-2">🎤</div>
                暂无面试记录
              </td>
            </tr>
            <tr v-for="i in list" :key="i.id" class="border-t border-[#1A2240]/50 hover:bg-white/[0.02] transition">
              <td class="py-3 px-4">
                <div class="text-white/80 font-medium">{{ i.candidate?.name || '—' }}</div>
                <div v-if="i.candidate?.city" class="text-gray-600 text-[10px]">{{ i.candidate.city }}</div>
              </td>
              <td class="py-3 px-4 text-gray-400">{{ i.job?.title || '—' }}</td>
              <td class="py-3 px-4 text-center">
                <span class="px-2 py-0.5 rounded-full text-[10px] font-medium" :class="statusClass(i.status)">{{ statusLabel(i.status) }}</span>
              </td>
              <td class="py-3 px-4 text-center">
                <div class="flex items-center justify-center gap-1">
                  <div class="w-8 h-1.5 rounded-full bg-gray-700 overflow-hidden">
                    <div class="h-full rounded-full" :class="scoreBarClass(i.totalScore)" :style="{ width: (i.totalScore || 0) + '%' }"></div>
                  </div>
                  <span :class="scoreTextClass(i.totalScore)" class="font-medium">{{ i.totalScore != null ? i.totalScore : '—' }}</span>
                </div>
              </td>
              <td class="py-3 px-4 text-center text-gray-400">{{ i._count?.questions || 0 }}</td>
              <td class="py-3 px-4 text-gray-500">{{ i.scheduledAt ? formatTime(i.scheduledAt) : '—' }}</td>
              <td class="py-3 px-4 text-gray-500">{{ formatTime(i.updatedAt) }}</td>
              <td class="py-3 px-4 text-center">
                <button @click="openDetail(i)" class="px-2 py-1 rounded text-[10px] bg-blue-600/10 text-blue-400 hover:bg-blue-600/20 cursor-pointer border-none">详情</button>
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
            <h2 class="text-base font-semibold text-white/90">面试详情</h2>
            <button @click="detailItem = null" class="text-gray-500 hover:text-white text-lg cursor-pointer bg-transparent border-none">✕</button>
          </div>
          <template v-if="detailItem">
            <div class="space-y-4 text-xs">
              <div class="flex items-center gap-4 pb-4 border-b border-[#1A2240]">
                <div class="w-14 h-14 rounded-full bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center text-white text-xl font-bold">
                  {{ detailItem.candidate?.name?.charAt(0) || '?' }}
                </div>
                <div>
                  <div class="text-white/90 font-semibold text-sm">{{ detailItem.candidate?.name || '未知候选人' }}</div>
                  <div class="text-gray-500">应聘：{{ detailItem.job?.title || '未知岗位' }}</div>
                  <div class="mt-1">
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-medium" :class="statusClass(detailItem.status)">{{ statusLabel(detailItem.status) }}</span>
                  </div>
                </div>
                <div class="ml-auto text-right">
                  <div class="text-2xl font-bold" :class="scoreTextClass(detailItem.totalScore)">{{ detailItem.totalScore ?? '—' }}</div>
                  <div class="text-gray-500 text-[10px]">总分</div>
                </div>
              </div>
              <div class="grid grid-cols-3 gap-4">
                <div><span class="text-gray-500">题目数：</span><span class="text-white/70">{{ detailItem._count?.questions || 0 }}</span></div>
                <div><span class="text-gray-500">面试时间：</span><span class="text-white/70">{{ detailItem.scheduledAt ? formatTime(detailItem.scheduledAt) : '—' }}</span></div>
                <div><span class="text-gray-500">创建时间：</span><span class="text-white/70">{{ formatTime(detailItem.createdAt) }}</span></div>
              </div>
              <!-- Evaluations -->
              <div v-if="detailItem.evaluations?.length">
                <div class="text-gray-500 mb-2">评估维度</div>
                <div class="space-y-2">
                  <div v-for="ev in detailItem.evaluations" :key="ev.id" class="flex items-center justify-between bg-black/20 rounded-lg p-3">
                    <div>
                      <div class="text-white/70 font-medium">{{ ev.dimension || '综合评估' }}</div>
                      <div v-if="ev.feedback" class="text-gray-500 text-[10px] mt-0.5">{{ ev.feedback }}</div>
                    </div>
                    <div class="text-lg font-bold" :class="scoreTextClass(ev.score)">{{ ev.score ?? '—' }}</div>
                  </div>
                </div>
              </div>
              <div v-if="detailItem.decision">
                <div class="text-gray-500 mb-1">最终决策</div>
                <div class="bg-black/20 rounded-lg p-3">
                  <span class="px-2 py-1 rounded-full text-[10px] font-medium" :class="detailItem.decision === 'pass' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'">
                    {{ detailItem.decision === 'pass' ? '✅ 通过' : '❌ 不通过' }}
                  </span>
                  <span v-if="detailItem.decisionNote" class="text-white/60 ml-2">{{ detailItem.decisionNote }}</span>
                </div>
              </div>
            </div>
          </template>
          <div class="flex justify-end mt-6">
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
const filterScore = ref('')
const searchKey = ref('')
const detailItem = ref<any>(null)

function statusLabel(s: string) {
  return ({ preparing: '准备中', question_ready: '题目就绪', in_progress: '进行中', evaluating: '评估中', completed: '已完成', decision_made: '已决策' } as Record<string, string>)[s] || s
}
function statusClass(s: string) {
  return ({ preparing: 'bg-gray-500/10 text-gray-400', question_ready: 'bg-blue-500/10 text-blue-400', in_progress: 'bg-green-500/10 text-green-400', evaluating: 'bg-purple-500/10 text-purple-400', completed: 'bg-cyan-500/10 text-cyan-400', decision_made: 'bg-emerald-500/10 text-emerald-400' } as Record<string, string>)[s] || 'bg-gray-500/10 text-gray-400'
}
function scoreTextClass(score: number | null) {
  if (score == null) return 'text-gray-400'
  if (score >= 80) return 'text-green-400'
  if (score >= 60) return 'text-yellow-400'
  return 'text-red-400'
}
function scoreBarClass(score: number | null) {
  if (score == null) return 'bg-gray-600'
  if (score >= 80) return 'bg-green-500'
  if (score >= 60) return 'bg-yellow-500'
  return 'bg-red-500'
}
function formatTime(t: string) {
  return new Date(t).toLocaleDateString('zh-CN')
}

function openDetail(i: any) {
  detailItem.value = i
}

async function fetchData() {
  loading.value = true
  error.value = ''
  try {
    const token = window.localStorage?.getItem('auth_token') || ''
    const params = new URLSearchParams({ page: String(page.value), pageSize: String(pageSize) })
    if (filterStatus.value) params.set('status', filterStatus.value)
    if (filterScore.value) params.set('score', filterScore.value)
    if (searchKey.value) params.set('keyword', searchKey.value)
    const res = await fetch(`/api/admin/recruitment/interviews?${params}`, {
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

onMounted(() => { fetchData() })
</script>
