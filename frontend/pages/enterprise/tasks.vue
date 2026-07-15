<template>
  <div class="min-h-screen bg-[#060A18] text-white">
    <!-- 顶部导航条 -->
    <div class="border-b border-[#1A2240] bg-[#0A0F1E] px-6 py-3 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <NuxtLink to="/enterprise" class="text-gray-400 hover:text-white transition">← 企业数字部门</NuxtLink>
        <span class="text-gray-600">/</span>
        <h1 class="text-lg font-semibold">📋 任务中心</h1>
      </div>
      <button
        @click="showCreateModal = true"
        class="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
      >
        ＋ 新建任务
      </button>
    </div>

    <div class="max-w-6xl mx-auto p-6 space-y-6">
      <!-- 今日概览 -->
      <div class="grid grid-cols-4 gap-4">
        <div class="bg-[#0D1328] border border-[#1A2240] rounded-xl p-4">
          <div class="text-gray-400 text-xs mb-1">今日任务</div>
          <div class="text-2xl font-bold">{{ stats.todayCount || 0 }}</div>
        </div>
        <div class="bg-[#0D1328] border border-[#1A2240] rounded-xl p-4">
          <div class="text-gray-400 text-xs mb-1">进行中</div>
          <div class="text-2xl font-bold text-blue-400">{{ stats.running || 0 }}</div>
        </div>
        <div class="bg-[#0D1328] border border-[#1A2240] rounded-xl p-4">
          <div class="text-gray-400 text-xs mb-1">今日机会</div>
          <div class="text-2xl font-bold text-green-400">{{ stats.completed || 0 }}</div>
        </div>
        <div class="bg-[#0D1328] border border-[#1A2240] rounded-xl p-4">
          <div class="text-gray-400 text-xs mb-1">今日成本</div>
          <div class="text-2xl font-bold text-yellow-400">¥{{ (stats.todayCost || 0).toFixed(1) }}</div>
        </div>
      </div>

      <!-- 创建任务区域（简化版，直接内嵌在首页） -->
      <div class="bg-[#0D1328] border border-[#1A2240] rounded-xl p-6">
        <h2 class="text-base font-semibold mb-4">🚀 给 AI 部门下任务</h2>
        <div class="flex gap-3">
          <input
            v-model="newTaskContent"
            type="text"
            placeholder="例如：帮我寻找华东地区新能源物流客户"
            class="flex-1 bg-[#060A18] border border-[#1A2240] rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
            @keyup.enter="createCommand"
          />
          <button
            @click="createCommand"
            :disabled="!newTaskContent.trim() || creating"
            class="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg font-medium transition"
          >
            {{ creating ? '创建中...' : '开始执行' }}
          </button>
        </div>
        
        <!-- 创建成功后的执行计划 -->
        <div v-if="lastPlan" class="mt-6 border border-green-500/30 bg-green-500/5 rounded-lg p-4">
          <div class="flex items-center gap-2 text-green-400 text-sm font-medium mb-3">
            <span>✓ 执行计划已生成</span>
            <span class="text-gray-500">|</span>
            <span class="text-gray-400">AI自动分配了 {{ lastPlan.assignedAgents?.length || 0 }} 位员工</span>
          </div>
          <div class="flex flex-wrap gap-2">
            <div
              v-for="(agent, idx) in lastPlan.assignedAgents"
              :key="idx"
              class="bg-[#060A18] border border-[#1A2240] rounded-lg px-3 py-2 text-xs"
            >
              <span class="text-gray-300">{{ agentNames[agent.agentType] || agent.agentType }}</span>
              <span class="text-gray-500 ml-2">P{{ agent.priority }}</span>
            </div>
          </div>
          <div class="mt-3 text-xs text-gray-400">
            指令类型: <span class="text-blue-400">{{ commandTypes[lastPlan.commandType] || '自定义' }}</span>
            <span v-if="lastPlan.industry" class="ml-3">行业: <span class="text-blue-400">{{ lastPlan.industry }}</span></span>
            <span v-if="lastPlan.region" class="ml-3">区域: <span class="text-blue-400">{{ lastPlan.region }}</span></span>
            <span class="ml-3">预计产出: <span class="text-blue-400">{{ lastPlan.expectedOutput }}</span></span>
          </div>
        </div>
      </div>

      <!-- 进行中任务 -->
      <div v-if="runningCommands.length > 0" class="space-y-3">
        <h2 class="text-sm font-semibold text-gray-400 uppercase tracking-wider">进行中</h2>
        <div
          v-for="cmd in runningCommands"
          :key="cmd.id"
          class="bg-[#0D1328] border border-blue-500/20 rounded-xl p-4"
        >
          <div class="flex items-center justify-between mb-2">
            <span class="text-sm text-white">{{ cmd.content }}</span>
            <span class="text-xs bg-blue-500/10 text-blue-400 px-2 py-1 rounded">RUNNING</span>
          </div>
          <div class="flex items-center gap-2 text-xs text-gray-400">
            <span>参与员工: {{ cmd.agentCount }}位</span>
            <span class="text-gray-600">·</span>
            <span>{{ formatTime(cmd.createdAt) }}</span>
          </div>
        </div>
      </div>

      <!-- 历史任务 -->
      <div v-if="historyCommands.length > 0" class="space-y-3">
        <h2 class="text-sm font-semibold text-gray-400 uppercase tracking-wider">历史任务</h2>
        <div
          v-for="cmd in historyCommands"
          :key="cmd.id"
          class="bg-[#0D1328] border border-[#1A2240] rounded-xl p-4"
        >
          <div class="flex items-center justify-between mb-1">
            <span class="text-sm text-gray-300">{{ cmd.content }}</span>
            <span class="text-xs text-green-400 bg-green-500/10 px-2 py-1 rounded">COMPLETED</span>
          </div>
          <div class="text-xs text-gray-500">{{ formatTime(cmd.createdAt) }}</div>
        </div>
      </div>

      <!-- 空状态 -->
      <div v-if="runningCommands.length === 0 && historyCommands.length === 0" class="text-center py-12 text-gray-500">
        <div class="text-4xl mb-3">📋</div>
        <div class="text-sm">暂无历史任务，给AI部门下达第一个指令吧</div>
      </div>
    </div>
  </div>
</template>

<script setup>
const newTaskContent = ref('')
const creating = ref(false)
const showCreateModal = ref(false)
const lastPlan = ref(null)
const allCommands = ref([])
const stats = ref({})

const agentNames = {
  growth_director: '🧠 AI增长总监',
  market_analyst: '📊 AI市场分析师',
  content_manager: '✍ AI内容经理',
  customer_ops: '🤝 AI客户运营',
  sales_assistant: '💼 AI销售助理'
}

const commandTypes = {
  growth: '获客增长',
  research: '市场研究',
  content: '内容营销',
  customer: '客户运营',
  sales: '销售跟进',
  analysis: '数据分析',
  custom: '自定义'
}

// 计算属性
const runningCommands = computed(() => 
  allCommands.value.filter(c => c.status === 'RUNNING' || c.status === 'PLANNING')
)
const historyCommands = computed(() => 
  allCommands.value.filter(c => c.status === 'COMPLETED' || c.status === 'FAILED' || c.status === 'CANCELLED')
)

async function createCommand() {
  if (!newTaskContent.value.trim()) return
  creating.value = true
  
  try {
    const res = await fetch('/api/enterprise/commands', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: newTaskContent.value.trim() })
    })
    const json = await res.json()
    if (json.code === 0) {
      lastPlan.value = json.data.plan
      newTaskContent.value = ''
      await loadCommands()
    }
  } catch (e) {
    alert('创建失败: ' + e.message)
  } finally {
    creating.value = false
  }
}

async function loadCommands() {
  try {
    const res = await fetch('/api/enterprise/commands')
    const json = await res.json()
    if (json.code === 0) {
      allCommands.value = json.data.items || []
    }
  } catch (e) {
    console.error('加载任务失败', e)
  }
}

async function loadStats() {
  try {
    const res = await fetch('/api/enterprise/commands/stats')
    const json = await res.json()
    if (json.code === 0) {
      stats.value = json.data
    }
  } catch (e) {
    console.error('加载统计失败', e)
  }
}

function formatTime(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  return d.toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

onMounted(() => {
  loadCommands()
  loadStats()
})
</script>
