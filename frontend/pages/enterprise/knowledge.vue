<template>
  <div class="min-h-screen bg-[#060A18] text-white">
    <!-- 顶部导航 -->
    <div class="border-b border-[#1A2240] bg-[#0A0F1E] px-6 py-3 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <NuxtLink to="/enterprise" class="text-gray-400 hover:text-white transition">← 企业数字部门</NuxtLink>
        <span class="text-gray-600">/</span>
        <h1 class="text-lg font-semibold">🧠 企业大脑</h1>
      </div>
      <button
        @click="showCreateModal = true"
        class="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
      >
        ＋ 上传知识
      </button>
    </div>

    <div class="max-w-6xl mx-auto p-6 space-y-6">
      <!-- 统计 -->
      <div class="grid grid-cols-4 gap-4">
        <div class="bg-[#0D1328] border border-[#1A2240] rounded-xl p-4">
          <div class="text-gray-400 text-xs mb-1">知识总数</div>
          <div class="text-2xl font-bold">{{ stats.total || 0 }}</div>
        </div>
        <div class="bg-[#0D1328] border border-[#1A2240] rounded-xl p-4">
          <div class="text-gray-400 text-xs mb-1">知识类型</div>
          <div class="text-2xl font-bold text-purple-400">{{ typeCount }}</div>
        </div>
        <div class="bg-[#0D1328] border border-[#1A2240] rounded-xl p-4">
          <div class="text-gray-400 text-xs mb-1">总字数</div>
          <div class="text-2xl font-bold text-cyan-400">{{ formatChars(stats.totalChars || 0) }}</div>
        </div>
        <div class="bg-[#0D1328] border border-[#1A2240] rounded-xl p-4">
          <div class="text-gray-400 text-xs mb-1">活跃条目</div>
          <div class="text-2xl font-bold text-green-400">{{ stats.activeCount || 0 }}</div>
        </div>
      </div>

      <!-- 类型筛选 -->
      <div class="flex items-center gap-2 flex-wrap">
        <button
          @click="filterType = ''"
          :class="filterType === '' ? 'bg-blue-600 text-white' : 'bg-[#0D1328] text-gray-400 border border-[#1A2240]'"
          class="px-3 py-1.5 rounded-lg text-xs font-medium transition"
        >
          全部
        </button>
        <button
          v-for="t in knowledgeTypes"
          :key="t.value"
          @click="filterType = t.value"
          :class="filterType === t.value ? 'bg-blue-600 text-white' : 'bg-[#0D1328] text-gray-400 border border-[#1A2240]'"
          class="px-3 py-1.5 rounded-lg text-xs font-medium transition"
        >
          {{ t.label }}{{ stats.byType?.[t.value] ? ` ${stats.byType[t.value]}` : '' }}
        </button>
      </div>

      <!-- 搜索 -->
      <input
        v-model="searchQuery"
        @input="debounceSearch"
        type="text"
        placeholder="搜索知识内容..."
        class="w-full bg-[#0D1328] border border-[#1A2240] rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
      />

      <!-- 知识列表 -->
      <div class="space-y-3">
        <div
          v-for="item in items"
          :key="item.id"
          class="bg-[#0D1328] border border-[#1A2240] rounded-xl p-5 hover:border-[#2A3560] transition"
        >
          <div class="flex items-center justify-between mb-2">
            <div class="flex items-center gap-2">
              <span class="text-xs bg-purple-500/10 text-purple-300 px-2 py-0.5 rounded">
                {{ typeLabels[item.type] || item.type }}
              </span>
              <h3 class="text-sm font-semibold text-white">{{ item.title }}</h3>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-xs text-gray-500">{{ item.charCount }}字</span>
              <button @click="archiveItem(item.id)" class="text-xs text-gray-500 hover:text-red-400 transition">归档</button>
            </div>
          </div>
          <p class="text-xs text-gray-400 line-clamp-2">{{ item.content }}</p>
          <div class="mt-2 text-[10px] text-gray-600">
            创建于 {{ formatTime(item.createdAt) }} | Agent范围: {{ item.agentAccessScope?.length || 0 }}个角色
          </div>
        </div>
      </div>

      <!-- 空状态 -->
      <div v-if="items.length === 0" class="text-center py-12 text-gray-500">
        <div class="text-4xl mb-3">📚</div>
        <div class="text-sm">暂无知识资产，上传第一条企业知识吧</div>
        <div class="text-xs mt-1 text-gray-600">支持：公司介绍/产品资料/客户案例/销售话术/FAQ/行业资料</div>
      </div>
    </div>

    <!-- 创建知识弹窗 -->
    <div v-if="showCreateModal" class="fixed inset-0 bg-black/60 flex items-center justify-center z-50" @click.self="showCreateModal = false">
      <div class="bg-[#0D1328] border border-[#1A2240] rounded-2xl p-6 w-full max-w-lg space-y-4">
        <h2 class="text-lg font-semibold">上传企业知识</h2>
        
        <div>
          <label class="text-xs text-gray-400 mb-1 block">知识类型</label>
          <select v-model="newItem.type" class="w-full bg-[#060A18] border border-[#1A2240] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500">
            <option v-for="t in knowledgeTypes" :key="t.value" :value="t.value">{{ t.label }}</option>
          </select>
        </div>
        
        <div>
          <label class="text-xs text-gray-400 mb-1 block">标题</label>
          <input v-model="newItem.title" type="text" class="w-full bg-[#060A18] border border-[#1A2240] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500" placeholder="例如：公司介绍" />
        </div>
        
        <div>
          <label class="text-xs text-gray-400 mb-1 block">内容 (Markdown)</label>
          <textarea v-model="newItem.content" rows="6" class="w-full bg-[#060A18] border border-[#1A2240] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 resize-none" placeholder="输入知识内容..."></textarea>
        </div>
        
        <div>
          <label class="text-xs text-gray-400 mb-1 block">Agent 访问范围</label>
          <div class="flex flex-wrap gap-2">
            <label v-for="agent in agentOptions" :key="agent.value" class="flex items-center gap-1 text-xs text-gray-300 cursor-pointer">
              <input type="checkbox" :value="agent.value" v-model="newItem.scope" class="rounded" />
              {{ agent.label }}
            </label>
          </div>
        </div>
        
        <div class="flex justify-end gap-3 pt-2">
          <button @click="showCreateModal = false" class="text-gray-400 hover:text-white text-sm px-4 py-2">取消</button>
          <button @click="createItem" :disabled="!newItem.title || !newItem.content || creating" class="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition">
            {{ creating ? '创建中...' : '确认上传' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
const showCreateModal = ref(false)
const creating = ref(false)
const items = ref([])
const stats = ref({})
const filterType = ref('')
const searchQuery = ref('')
let searchTimer = null

const knowledgeTypes = [
  { value: 'intro', label: '🏢 公司介绍' },
  { value: 'product', label: '📦 产品资料' },
  { value: 'case', label: '🏆 客户案例' },
  { value: 'script', label: '💬 销售话术' },
  { value: 'faq', label: '❓ FAQ' },
  { value: 'industry', label: '📊 行业资料' }
]

const typeLabels = Object.fromEntries(knowledgeTypes.map(t => [t.value, t.label]))

const agentOptions = [
  { value: 'growth_director', label: '增长总监' },
  { value: 'market_analyst', label: '市场分析师' },
  { value: 'content_manager', label: '内容经理' },
  { value: 'customer_ops', label: '客户运营' },
  { value: 'sales_assistant', label: '销售助理' }
]

const newItem = ref({
  type: 'intro',
  title: '',
  content: '',
  scope: []
})

const typeCount = computed(() => Object.keys(stats.value.byType || {}).length)

function debounceSearch() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => loadList(), 300)
}

async function loadList() {
  try {
    const params = new URLSearchParams()
    if (filterType.value) params.set('type', filterType.value)
    if (searchQuery.value) params.set('search', searchQuery.value)
    const res = await fetch(`/api/enterprise/knowledge?${params}`)
    const json = await res.json()
    if (json.code === 0) items.value = json.data.items
  } catch (e) { console.error(e) }
}

async function loadStats() {
  try {
    const res = await fetch('/api/enterprise/knowledge/stats')
    const json = await res.json()
    if (json.code === 0) stats.value = json.data
  } catch (e) { console.error(e) }
}

async function createItem() {
  creating.value = true
  try {
    const res = await fetch('/api/enterprise/knowledge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: newItem.value.type,
        title: newItem.value.title,
        content: newItem.value.content,
        agentAccessScope: newItem.value.scope
      })
    })
    const json = await res.json()
    if (json.code === 0) {
      showCreateModal.value = false
      newItem.value = { type: 'intro', title: '', content: '', scope: [] }
      await loadList()
      await loadStats()
    }
  } catch (e) { alert('创建失败: ' + e.message) }
  finally { creating.value = false }
}

async function archiveItem(id) {
  if (!confirm('确认归档该知识条目?')) return
  try {
    const res = await fetch(`/api/enterprise/knowledge/${id}`, { method: 'DELETE' })
    const json = await res.json()
    if (json.code === 0) {
      await loadList()
      await loadStats()
    }
  } catch (e) { console.error(e) }
}

function formatTime(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  const now = new Date()
  const diff = (now - d) / (1000 * 60 * 60 * 24)
  if (diff < 1) return '今天'
  if (diff < 7) return `${Math.floor(diff)}天前`
  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}

function formatChars(n) {
  if (n >= 10000) return (n / 10000).toFixed(1) + '万'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k'
  return String(n)
}

watch(filterType, () => loadList())

onMounted(() => {
  loadList()
  loadStats()
})
</script>
