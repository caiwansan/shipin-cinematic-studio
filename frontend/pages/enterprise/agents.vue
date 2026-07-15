<template>
  <div class="min-h-screen bg-[#060A18] text-white">
    <!-- 顶部导航 -->
    <div class="border-b border-[#1A2240] bg-[#0A0F1E] px-6 py-3 flex items-center gap-3">
      <NuxtLink to="/enterprise" class="text-gray-400 hover:text-white transition">← 企业数字部门</NuxtLink>
      <span class="text-gray-600">/</span>
      <h1 class="text-lg font-semibold">👥 AI员工中心</h1>
    </div>

    <div class="max-w-6xl mx-auto p-6 space-y-6">
      <!-- 部门概览 -->
      <div class="grid grid-cols-3 gap-4">
        <div class="bg-[#0D1328] border border-[#1A2240] rounded-xl p-4">
          <div class="text-gray-400 text-xs mb-1">AI 员工总数</div>
          <div class="text-2xl font-bold">{{ agents.length }}</div>
        </div>
        <div class="bg-[#0D1328] border border-[#1A2240] rounded-xl p-4">
          <div class="text-gray-400 text-xs mb-1">今日目标总量</div>
          <div class="text-2xl font-bold text-blue-400">{{ totalTarget }}</div>
        </div>
        <div class="bg-[#0D1328] border border-[#1A2240] rounded-xl p-4">
          <div class="text-gray-400 text-xs mb-1">今日完成</div>
          <div class="text-2xl font-bold text-green-400">{{ totalCompleted }}</div>
        </div>
      </div>

      <!-- AI员工卡片列表 -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <AgentCard
          v-for="agent in agents"
          :key="agent.id"
          :agent="agent"
          @toggle="toggleAgent(agent.id)"
          @update-target="updateTarget(agent.id, $event)"
          @update-note="updateNote(agent.id, $event)"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
const agents = ref([])
const totalTarget = computed(() => agents.value.reduce((s, a) => s + (a.dailyTarget || 0), 0))
const totalCompleted = computed(() => agents.value.reduce((s, a) => s + (a.todayCompleted || 0), 0))

async function loadAgents() {
  try {
    const res = await fetch('/api/enterprise/agent-profiles')
    const json = await res.json()
    if (json.code === 0) {
      agents.value = json.data || []
    }
  } catch (e) {
    console.error('加载AI员工失败', e)
  }
}

async function toggleAgent(id) {
  try {
    const res = await fetch(`/api/enterprise/agent-profiles/${id}/toggle`, { method: 'POST' })
    const json = await res.json()
    if (json.code === 0) {
      await loadAgents()
    }
  } catch (e) {
    console.error('切换状态失败', e)
  }
}

async function updateTarget(id, target) {
  try {
    const res = await fetch(`/api/enterprise/agent-profiles/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dailyTarget: target })
    })
    const json = await res.json()
    if (json.code === 0) {
      await loadAgents()
    }
  } catch (e) {
    console.error('更新目标失败', e)
  }
}

async function updateNote(id, note) {
  try {
    const res = await fetch(`/api/enterprise/agent-profiles/${id}/note`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note })
    })
    const json = await res.json()
    if (json.code === 0) {
      await loadAgents()
    }
  } catch (e) {
    console.error('更新备注失败', e)
  }
}

onMounted(() => {
  loadAgents()
})
</script>
