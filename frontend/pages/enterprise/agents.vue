<template>
  <div class="min-h-screen bg-[#060A18] text-white">
    <!-- 顶部导航 -->
    <div class="border-b border-[#1A2240] bg-[#0A0F1E] px-6 py-3 flex items-center gap-3">
      <NuxtLink to="/enterprise" class="text-gray-400 hover:text-white transition">← CEO驾驶舱</NuxtLink>
      <span class="text-gray-600">/</span>
      <h1 class="text-lg font-semibold">👥 AI员工中心</h1>
    </div>

    <div class="max-w-6xl mx-auto p-6 space-y-6">
      <!-- 部门概览 -->
      <div class="grid grid-cols-4 gap-4">
        <div class="bg-[#0D1328] border border-[#1A2240] rounded-xl p-4">
          <div class="text-gray-400 text-xs mb-1">AI员工总数</div>
          <div class="text-2xl font-bold">{{ employees.length }}</div>
        </div>
        <div class="bg-[#0D1328] border border-[#1A2240] rounded-xl p-4">
          <div class="text-gray-400 text-xs mb-1">今日在线</div>
          <div class="text-2xl font-bold text-green-400">{{ activeCount }}</div>
        </div>
        <div class="bg-[#0D1328] border border-[#1A2240] rounded-xl p-4">
          <div class="text-gray-400 text-xs mb-1">今日任务完成</div>
          <div class="text-2xl font-bold text-blue-400">{{ totalCompleted }}</div>
        </div>
        <div class="bg-[#0D1328] border border-[#1A2240] rounded-xl p-4">
          <div class="text-gray-400 text-xs mb-1">部门完成率</div>
          <div class="text-2xl font-bold text-cyan-400">{{ completionRate }}%</div>
        </div>
      </div>

      <!-- 部门标语 -->
      <div class="bg-gradient-to-r from-[#0D1328] to-[#1A0D28] border border-[#1A2240] rounded-xl p-4 flex items-center gap-4">
        <span class="text-2xl">💡</span>
        <div>
          <div class="text-sm font-medium text-white">您的AI增长部门</div>
          <div class="text-xs text-gray-400">5位AI员工在岗，负责内容生产、渠道运营、商机发现、销售参谋、市场研究</div>
        </div>
      </div>

      <!-- AI员工卡片列表 -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <EmployeeCard
          v-for="emp in employees"
          :key="emp.id"
          :employee="emp"
          :today-task-list="getEmployeeTasks(emp)"
          @toggle="toggleEmployee(emp.id)"
          @update-note="updateNote(emp.id, $event)"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
const employees = ref([])
const dashboardData = ref(null)

// ─── Derived Department Stats ───────────────────────────────
const activeCount = computed(() => employees.value.filter(e => e.status === 'active').length)
const totalCompleted = computed(() => employees.value.reduce((s, e) => s + (e.todayCompleted || 0), 0))
const totalTarget = computed(() => employees.value.reduce((s, e) => s + (e.dailyTarget || 0), 0))
const completionRate = computed(() => {
  if (totalTarget.value === 0) return 0
  return Math.round((totalCompleted.value / totalTarget.value) * 100)
})

// ─── Today Tasks (from dashboard API) ──────────────────────
function getEmployeeTasks(emp) {
  if (!dashboardData.value?.todayTasks) return []
  return dashboardData.value.todayTasks.filter(t => t.agentName === emp.name)
}

// ─── Data Loading ──────────────────────────────────────────
async function loadDashboard() {
  try {
    const res = await fetch('/api/enterprise/dashboard')
    const json = await res.json()
    if (json.code === 0 || json.data) {
      dashboardData.value = json.data || json
    }
  } catch (e) {
    console.error('Dashboard load failed', e)
  }
}

async function loadEmployees() {
  try {
    const res = await fetch('/api/enterprise/agent-profiles')
    const json = await res.json()
    if (json.code === 0) {
      employees.value = json.data || []
    }
  } catch (e) {
    console.error('加载AI员工失败', e)
  }
}

// ─── Actions ───────────────────────────────────────────────
async function toggleEmployee(id) {
  try {
    const res = await fetch(`/api/enterprise/agent-profiles/${id}/toggle`, { method: 'POST' })
    const json = await res.json()
    if (json.code === 0) {
      await loadEmployees()
    }
  } catch (e) {
    console.error('切换状态失败', e)
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
      await loadEmployees()
    }
  } catch (e) {
    console.error('更新备注失败', e)
  }
}

onMounted(() => {
  loadDashboard()
  loadEmployees()
})
</script>
