<!-- Admin: 运行监控 -->
<!-- 位置：/admin/recruitment/runtime.vue -->
<!-- 职责：AI 员工实时运行状态监控 — 搜索/筛选/详情/操作 -->
<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-lg font-semibold text-white/90">💓 运行监控</h1>
        <p class="text-xs text-gray-500 mt-1">AI 员工实时运行状态监控</p>
      </div>
      <div class="flex items-center gap-2">
        <label class="flex items-center gap-1.5 text-[10px] text-gray-500 cursor-pointer">
          <input type="checkbox" v-model="autoRefresh" class="w-3 h-3" />
          自动刷新 (10s)
        </label>
        <button @click="fetchData" class="px-3 py-1.5 bg-blue-600/20 text-blue-400 rounded-lg text-xs hover:bg-blue-600/30 transition cursor-pointer border-none" :disabled="loading">
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
          @keyup.enter="fetchData()"
          placeholder="搜索 AI 员工名称..."
          class="w-full bg-[#0D1328] border border-[#1A2240] rounded-lg text-xs text-gray-300 pl-8 pr-3 py-2 focus:outline-none focus:border-blue-500/40"
        />
      </div>
      <select v-model="filterState" @change="fetchData()" class="bg-[#0D1328] border border-[#1A2240] rounded-lg text-xs text-gray-400 px-3 py-2">
        <option value="">全部状态</option>
        <option value="ACTIVE">Running</option>
        <option value="PAUSED">Paused</option>
        <option value="STOPPED">Stopped</option>
        <option value="RECOVERING">Recovering</option>
        <option value="EMERGENCY_STOP">Emergency</option>
      </select>
      <select v-model="filterType" @change="fetchData()" class="bg-[#0D1328] border border-[#1A2240] rounded-lg text-xs text-gray-400 px-3 py-2">
        <option value="">全部类型</option>
        <option value="recruiter">Recruiter</option>
        <option value="marketing">Marketing</option>
        <option value="interview">Interview</option>
        <option value="career_advisor">Career Advisor</option>
        <option value="resume_analyzer">Resume Analyzer</option>
        <option value="talent_hunter">Talent Hunter</option>
      </select>
    </div>

    <!-- Loading -->
    <div v-if="loading && list.length === 0" class="flex items-center justify-center py-16 text-gray-500 text-sm">
      <div class="animate-spin w-5 h-5 border-2 border-gray-600 border-t-blue-400 rounded-full mr-2"></div>
      加载中...
    </div>

    <!-- Error -->
    <div v-else-if="error && list.length === 0" class="bg-red-900/20 border border-red-800/30 rounded-xl p-4 text-red-400 text-xs">
      ⚠️ {{ error }} <button @click="fetchData" class="ml-2 underline cursor-pointer">重试</button>
    </div>

    <template v-else>
      <!-- State Summary -->
      <div class="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div v-for="state in allStates" :key="state" class="bg-[#0D1328]/60 border border-[#1A2240] rounded-xl p-3 text-center" :class="{ 'ring-1 ring-blue-500/30': filterState === state }" @click="filterState = filterState === state ? '' : state; fetchData()">
          <div class="text-lg font-bold" :class="stateTextClass(state)">{{ byState[state] || 0 }}</div>
          <div class="text-[10px] text-gray-500 mt-0.5">{{ stateLabel(state) }}</div>
        </div>
      </div>

      <!-- Agent Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        <div v-for="agent in filteredList" :key="agent.id" class="bg-[#0D1328]/60 border border-[#1A2240] rounded-xl p-4 hover:border-blue-500/20 transition cursor-pointer" @click="openDetail(agent)">
          <div class="flex items-center justify-between mb-2">
            <div class="flex items-center gap-2 min-w-0">
              <div class="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                {{ agent.name?.charAt(0) || '?' }}
              </div>
              <div class="min-w-0">
                <div class="text-sm text-white/80 font-medium truncate">{{ agent.name }}</div>
                <div class="text-[10px] text-gray-500">{{ typeLabel(agent.agentType) }}</div>
              </div>
            </div>
            <span class="px-2 py-0.5 rounded-full text-[10px] font-medium shrink-0" :class="stateClass(agent.lifecycleState)">
              <span class="inline-block w-1.5 h-1.5 rounded-full mr-1" :class="dotClass(agent.lifecycleState)"></span>
              {{ stateLabel(agent.lifecycleState) }}
            </span>
          </div>
          <div class="text-[10px] text-gray-500 space-y-0.5">
            <div>企业：{{ agent.enterprise?.name || '—' }}</div>
            <div>更新：{{ formatTime(agent.updatedAt) }}</div>
            <div v-if="agent.lastRecoveredAt">恢复：{{ formatTime(agent.lastRecoveredAt) }}</div>
          </div>
        </div>
      </div>

      <div v-if="filteredList.length === 0" class="py-12 text-center text-gray-600 text-sm">
        <div class="text-2xl mb-2">💓</div>
        暂无匹配的 AI 员工
      </div>
    </template>

    <!-- Detail Modal -->
    <Teleport to="body">
      <div v-if="detailItem" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" @click.self="detailItem = null">
        <div class="bg-[#0D1328] border border-[#1A2240] rounded-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto p-6 mx-4">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-base font-semibold text-white/90">运行详情</h2>
            <button @click="detailItem = null" class="text-gray-500 hover:text-white text-lg cursor-pointer bg-transparent border-none">✕</button>
          </div>
          <template v-if="detailItem">
            <div class="space-y-4 text-xs">
              <div class="flex items-center gap-4 pb-4 border-b border-[#1A2240]">
                <div class="w-14 h-14 rounded-full bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center text-white text-xl font-bold">
                  {{ detailItem.name?.charAt(0) || '?' }}
                </div>
                <div>
                  <div class="text-white/90 font-semibold text-sm">{{ detailItem.name }}</div>
                  <div class="text-gray-500">{{ typeLabel(detailItem.agentType) }}</div>
                  <div class="mt-1">
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-medium" :class="stateClass(detailItem.lifecycleState)">
                      <span class="inline-block w-1.5 h-1.5 rounded-full mr-1" :class="dotClass(detailItem.lifecycleState)"></span>
                      {{ stateLabel(detailItem.lifecycleState) }}
                    </span>
                  </div>
                </div>
              </div>
              <div class="grid grid-cols-2 gap-4">
                <div><span class="text-gray-500">所属企业：</span><span class="text-white/70">{{ detailItem.enterprise?.name || '—' }}</span></div>
                <div><span class="text-gray-500">最后恢复：</span><span class="text-white/70">{{ detailItem.lastRecoveredAt ? formatTime(detailItem.lastRecoveredAt) : '—' }}</span></div>
                <div><span class="text-gray-500">创建时间：</span><span class="text-white/70">{{ formatTime(detailItem.createdAt) }}</span></div>
                <div><span class="text-gray-500">更新时间：</span><span class="text-white/70">{{ formatTime(detailItem.updatedAt) }}</span></div>
              </div>
              <div v-if="detailItem.description">
                <div class="text-gray-500 mb-1">描述</div>
                <div class="text-white/70 leading-relaxed bg-black/20 rounded-lg p-3">{{ detailItem.description }}</div>
              </div>
              <!-- Metrics -->
              <div v-if="detailItem.metrics">
                <div class="text-gray-500 mb-1">运行指标</div>
                <div class="grid grid-cols-3 gap-2">
                  <div class="bg-black/20 rounded-lg p-2 text-center">
                    <div class="text-sm font-bold text-blue-400">{{ detailItem.metrics.tasksCompleted ?? 0 }}</div>
                    <div class="text-[9px] text-gray-500">完成任务</div>
                  </div>
                  <div class="bg-black/20 rounded-lg p-2 text-center">
                    <div class="text-sm font-bold text-green-400">{{ detailItem.metrics.uptime ?? '0%' }}</div>
                    <div class="text-[9px] text-gray-500">在线率</div>
                  </div>
                  <div class="bg-black/20 rounded-lg p-2 text-center">
                    <div class="text-sm font-bold text-yellow-400">¥{{ detailItem.metrics.totalCost?.toFixed(2) || '0.00' }}</div>
                    <div class="text-[9px] text-gray-500">总成本</div>
                  </div>
                </div>
              </div>
            </div>
          </template>
          <div class="flex justify-end gap-2 mt-6">
            <button v-if="detailItem?.lifecycleState === 'ACTIVE'" @click="updateState(detailItem, 'PAUSED'); detailItem = null" class="px-4 py-2 rounded-lg text-xs bg-yellow-600/10 text-yellow-400 hover:bg-yellow-600/20 cursor-pointer border-none">暂停</button>
            <button v-if="detailItem?.lifecycleState === 'PAUSED'" @click="updateState(detailItem, 'ACTIVE'); detailItem = null" class="px-4 py-2 rounded-lg text-xs bg-green-600/10 text-green-400 hover:bg-green-600/20 cursor-pointer border-none">恢复</button>
            <button v-if="detailItem?.lifecycleState !== 'EMERGENCY_STOP'" @click="updateState(detailItem, 'EMERGENCY_STOP'); detailItem = null" class="px-4 py-2 rounded-lg text-xs bg-red-600/10 text-red-400 hover:bg-red-600/20 cursor-pointer border-none">急停</button>
            <button @click="detailItem = null" class="px-4 py-2 rounded-lg text-xs bg-white/5 text-gray-400 hover:bg-white/10 cursor-pointer border-none">关闭</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admin-aigc' })
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'

const loading = ref(false)
const error = ref('')
const list = ref<any[]>([])
const byState = ref<Record<string, number>>({})
const searchKey = ref('')
const filterState = ref('')
const filterType = ref('')
const detailItem = ref<any>(null)
const autoRefresh = ref(false)

const allStates = ['ACTIVE', 'PAUSED', 'RECOVERING', 'STOPPED', 'EMERGENCY_STOP']

const filteredList = computed(() => {
  let result = list.value
  if (filterState.value) result = result.filter(a => a.lifecycleState === filterState.value)
  if (filterType.value) result = result.filter(a => a.agentType === filterType.value)
  if (searchKey.value) {
    const kw = searchKey.value.toLowerCase()
    result = result.filter(a => a.name?.toLowerCase().includes(kw))
  }
  return result
})

let timer: ReturnType<typeof setInterval> | null = null

watch(autoRefresh, (on) => {
  if (on) {
    timer = setInterval(() => fetchData(), 10000)
  } else if (timer) {
    clearInterval(timer)
    timer = null
  }
})

function stateLabel(s: string) {
  return ({ ACTIVE: 'Running', PAUSED: 'Paused', STOPPED: 'Stopped', RECOVERING: 'Recovering', EMERGENCY_STOP: 'Emergency' } as Record<string, string>)[s] || s
}
function stateClass(s: string) {
  return ({ ACTIVE: 'bg-green-500/10 text-green-400', PAUSED: 'bg-yellow-500/10 text-yellow-400', STOPPED: 'bg-gray-500/10 text-gray-400', RECOVERING: 'bg-blue-500/10 text-blue-400', EMERGENCY_STOP: 'bg-red-500/10 text-red-400' } as Record<string, string>)[s] || 'bg-gray-500/10 text-gray-400'
}
function stateTextClass(s: string) {
  return ({ ACTIVE: 'text-green-400', PAUSED: 'text-yellow-400', STOPPED: 'text-gray-400', RECOVERING: 'text-blue-400', EMERGENCY_STOP: 'text-red-400' } as Record<string, string>)[s] || 'text-gray-400'
}
function dotClass(s: string) {
  return ({ ACTIVE: 'bg-green-400', PAUSED: 'bg-yellow-400', STOPPED: 'bg-gray-400', RECOVERING: 'bg-blue-400 animate-pulse', EMERGENCY_STOP: 'bg-red-400 animate-pulse' } as Record<string, string>)[s] || 'bg-gray-400'
}
function typeLabel(t: string) {
  return ({ recruiter: 'Recruiter', marketing: 'Marketing', interview: 'Interview', career_advisor: 'Career Advisor', resume_analyzer: 'Resume Analyzer', talent_hunter: 'Talent Hunter' } as Record<string, string>)[t] || t
}
function formatTime(t: string) {
  if (!t) return '—'
  const d = new Date(t)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`
  return d.toLocaleDateString('zh-CN')
}

function openDetail(a: any) {
  detailItem.value = a
}

async function updateState(agent: any, state: string) {
  if (!confirm(`确认将「${agent.name}」状态设为「${stateLabel(state)}」？`)) return
  try {
    const token = window.localStorage?.getItem('auth_token') || ''
    const res = await fetch(`/api/admin/recruitment/agents/${agent.id}/state`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ state }),
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
    const params = new URLSearchParams()
    if (filterState.value) params.set('state', filterState.value)
    if (filterType.value) params.set('type', filterType.value)
    const res = await fetch(`/api/admin/recruitment/runtime?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json()
    list.value = json.list
    byState.value = json.byState || {}
  } catch (e: any) {
    error.value = e.message || '加载失败'
  } finally {
    loading.value = false
  }
}

onMounted(() => { fetchData() })
onUnmounted(() => { if (timer) clearInterval(timer) })
</script>
