<template>
  <div class="min-h-screen bg-[#060A18] text-white">
    <!-- 顶部导航 -->
    <div class="border-b border-[#1A2240] bg-[#0A0F1E] px-6 py-3 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <NuxtLink to="/enterprise" class="text-gray-400 hover:text-white transition">← 企业数字部门</NuxtLink>
        <span class="text-gray-600">/</span>
        <h1 class="text-lg font-semibold">✅ 审批中心</h1>
      </div>
      <div class="flex items-center gap-2 text-xs">
        <span class="text-gray-400">修正2: revision_required 状态已支持</span>
      </div>
    </div>

    <div class="max-w-6xl mx-auto p-6 space-y-6">
      <!-- 统计面板 -->
      <div class="grid grid-cols-5 gap-3">
        <div class="bg-[#0D1328] border border-[#1A2240] rounded-xl p-4">
          <div class="text-gray-400 text-xs mb-1">待审批</div>
          <div class="text-2xl font-bold text-yellow-400">{{ stats.pending || 0 }}</div>
        </div>
        <div class="bg-[#0D1328] border border-[#1A2240] rounded-xl p-4">
          <div class="text-gray-400 text-xs mb-1">已批准</div>
          <div class="text-2xl font-bold text-green-400">{{ stats.approved || 0 }}</div>
        </div>
        <div class="bg-[#0D1328] border border-[#1A2240] rounded-xl p-4">
          <div class="text-gray-400 text-xs mb-1">已拒绝</div>
          <div class="text-2xl font-bold text-red-400">{{ stats.rejected || 0 }}</div>
        </div>
        <div class="bg-[#0D1328] border border-[#1A2240] rounded-xl p-4">
          <div class="text-gray-400 text-xs mb-1">需修改</div>
          <div class="text-2xl font-bold text-orange-400">{{ stats.revisionRequired || 0 }}</div>
        </div>
        <div class="bg-[#0D1328] border border-[#1A2240] rounded-xl p-4">
          <div class="text-gray-400 text-xs mb-1">平均评分</div>
          <div class="text-2xl font-bold text-blue-400">{{ stats.avgScore || 0 }}</div>
        </div>
      </div>

      <!-- 类型筛选 -->
      <div class="flex items-center gap-2">
        <button
          v-for="f in filters"
          :key="f.value"
          @click="filterStatus = f.value"
          :class="filterStatus === f.value ? 'bg-blue-600 text-white' : 'bg-[#0D1328] text-gray-400 border border-[#1A2240]'"
          class="px-3 py-1.5 rounded-lg text-xs font-medium transition"
        >
          {{ f.label }}
        </button>
      </div>

      <!-- 审批列表 -->
      <div class="space-y-3">
        <ApprovalCard
          v-for="item in filteredItems"
          :key="item.id"
          :item="item"
          @approve="handleApprove"
          @reject="handleReject"
          @revision="handleRevision"
        />
      </div>

      <!-- 空状态 -->
      <div v-if="filteredItems.length === 0" class="text-center py-12 text-gray-500">
        <div class="text-4xl mb-3">✅</div>
        <div class="text-sm">暂无审批内容</div>
        <div class="text-xs mt-1 text-gray-600">Agent 生成内容后将自动进入审批中心</div>
      </div>
    </div>
  </div>
</template>

<script setup>
const items = ref([])
const stats = ref({})
const filterStatus = ref('')

const filters = [
  { value: '', label: '全部' },
  { value: 'wait_approval', label: '⏳ 待审批' },
  { value: 'ai_review', label: '🔍 AI复核' },
  { value: 'revision_required', label: '📝 需修改' },
  { value: 'approved', label: '✅ 已批准' },
  { value: 'rejected', label: '❌ 已拒绝' }
]

const filteredItems = computed(() => {
  if (!filterStatus.value) return items.value
  return items.value.filter(i => i.status === filterStatus.value)
})

async function loadList() {
  try {
    const res = await fetch('/api/enterprise/approvals')
    const json = await res.json()
    if (json.code === 0) items.value = json.data.items
  } catch (e) { console.error(e) }
}

async function loadStats() {
  try {
    const res = await fetch('/api/enterprise/approvals/stats')
    const json = await res.json()
    if (json.code === 0) stats.value = json.data
  } catch (e) { console.error(e) }
}

async function handleApprove(id) {
  try {
    await fetch(`/api/enterprise/approvals/${id}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note: '批准发布' })
    })
    await loadList()
    await loadStats()
  } catch (e) { console.error(e) }
}

async function handleReject(id) {
  const reason = prompt('请输入拒绝原因:')
  if (!reason) return
  try {
    await fetch(`/api/enterprise/approvals/${id}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason })
    })
    await loadList()
    await loadStats()
  } catch (e) { console.error(e) }
}

async function handleRevision(id) {
  const note = prompt('请输入修改意见:')
  if (!note) return
  try {
    await fetch(`/api/enterprise/approvals/${id}/revision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note })
    })
    await loadList()
    await loadStats()
  } catch (e) { console.error(e) }
}

onMounted(() => {
  loadList()
  loadStats()
})
</script>
