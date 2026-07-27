<!-- 企业招聘 Pipeline 看板 -->
<!-- 位置：/workspace/recruitment/pipeline -->
<!-- 职责：Kanban 展示 + 阶段推进 + 备注/标签（P5-RECRUITMENT-BETA-01） -->
<template>
  <div class="pipeline-page">
    <!-- Header -->
    <div class="pipeline-header">
      <div class="flex items-center gap-3">
        <button @click="navigateTo('/workspace/recruitment')" class="text-gray-400 hover:text-white text-sm cursor-pointer bg-transparent border-none">← 返回</button>
        <h1 class="text-lg font-semibold text-white/90">招聘 Pipeline</h1>
      </div>
      <div class="flex items-center gap-2 text-xs text-gray-500">
        <span>共 {{ totalCount }} 位候选人</span>
        <button @click="fetchKanban" class="text-blue-400 hover:text-blue-300 cursor-pointer bg-transparent border-none underline">刷新</button>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center py-16 text-gray-500 text-sm">
      <div class="animate-spin w-5 h-5 border-2 border-gray-600 border-t-blue-400 rounded-full mr-2"></div>
      加载中...
    </div>

    <!-- Error -->
    <div v-else-if="error" class="bg-red-900/20 border border-red-800/30 rounded-xl p-4 text-red-400 text-xs mx-4">
      ⚠️ {{ error }} <button @click="fetchKanban" class="ml-2 underline cursor-pointer">重试</button>
    </div>

    <!-- Kanban Board -->
    <div v-else class="kanban-board">
      <div v-for="stage in stages" :key="stage.id" class="kanban-column">
        <!-- Column Header -->
        <div class="kanban-column-header">
          <span class="kanban-column-title">
            <span :class="stage.dotClass" class="w-2 h-2 rounded-full"></span>
            {{ stage.label }}
          </span>
          <span class="kanban-column-count">{{ (columns[stage.id] || []).length }}</span>
        </div>

        <!-- Cards -->
        <div class="kanban-cards">
          <div
            v-for="card in (columns[stage.id] || [])"
            :key="card.id"
            class="kanban-card"
            :class="{ 'kanban-card--auto': card.autoCreated }"
            @click="openCard(card)"
          >
            <div class="kanban-card-name">{{ card.candidateName }}</div>
            <div class="kanban-card-job">{{ card.jobTitle }}</div>
            <div class="kanban-card-meta">
              <span v-if="card.screeningScore != null" :class="scoreClass(card.screeningScore)" class="text-[10px] font-medium">
                {{ card.screeningScore }}分
              </span>
              <span v-if="card.interviewCount > 0" class="text-[10px] text-gray-500">
                {{ card.interviewCount }}场面试
              </span>
            </div>
            <div class="kanban-card-time">{{ formatTime(card.lastActivityAt) }}</div>
          </div>

          <!-- Empty State -->
          <div v-if="!(columns[stage.id] || []).length" class="kanban-empty">
            暂无候选人
          </div>
        </div>
      </div>
    </div>

    <!-- Card Detail Modal -->
    <div v-if="selectedCard" class="modal-overlay" @click.self="selectedCard = null">
      <div class="modal-card">
        <div class="modal-header">
          <div>
            <h2 class="text-base font-semibold text-white/90">{{ selectedCard.candidateName }}</h2>
            <p class="text-xs text-gray-500 mt-0.5">{{ selectedCard.jobTitle }} · 当前阶段：{{ stageLabel(selectedCard.stage) }}</p>
          </div>
          <button @click="selectedCard = null" class="text-gray-500 hover:text-white text-lg cursor-pointer bg-transparent border-none">✕</button>
        </div>

        <div class="modal-body">
          <!-- Stage Progress -->
          <div class="modal-section">
            <div class="text-xs text-gray-500 mb-2">招聘阶段</div>
            <div class="stage-progress">
              <div
                v-for="(s, idx) in stages"
                :key="s.id"
                class="stage-step"
                :class="{ 'stage-step--active': s.id === selectedCard.stage, 'stage-step--done': stageIndex(s.id) < stageIndex(selectedCard.stage) }"
              >
                <div class="stage-step-dot"></div>
                <div class="stage-step-label">{{ s.label }}</div>
                <div v-if="idx < stages.length - 1" class="stage-step-line"></div>
              </div>
            </div>
          </div>

          <!-- Stage Actions -->
          <div class="modal-section">
            <div class="text-xs text-gray-500 mb-2">推进到下一阶段</div>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="next in nextStages(selectedCard.stage)"
                :key="next.id"
                @click="advanceStage(selectedCard, next.id)"
                :disabled="advanceLoading"
                class="px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer border-none transition"
                :class="next.actionClass"
              >
                → {{ next.label }}
              </button>
            </div>
          </div>

          <!-- Recent Events -->
          <div v-if="selectedCard.recentEvents?.length" class="modal-section">
            <div class="text-xs text-gray-500 mb-2">最近事件</div>
            <div class="space-y-1.5">
              <div v-for="evt in selectedCard.recentEvents" :key="evt.id" class="flex items-center gap-2 text-[11px]">
                <span class="text-gray-600 whitespace-nowrap">{{ formatTime(evt.createdAt) }}</span>
                <span class="text-gray-400">{{ evt.type }}</span>
                <span v-if="evt.fromStage && evt.toStage" class="text-gray-600">{{ evt.fromStage }} → {{ evt.toStage }}</span>
              </div>
            </div>
          </div>

          <!-- Notes -->
          <div class="modal-section">
            <div class="text-xs text-gray-500 mb-2">备注</div>
            <div class="flex gap-2">
              <input
                v-model="noteInput"
                placeholder="添加备注..."
                class="flex-1 bg-[#0D1328] border border-[#1A2240] rounded-lg text-xs text-gray-300 px-3 py-2 focus:outline-none focus:border-blue-500/40"
                @keyup.enter="addNote(selectedCard)"
              />
              <button @click="addNote(selectedCard)" :disabled="!noteInput.trim()" class="px-3 py-1.5 rounded-lg text-xs bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 disabled:opacity-40 cursor-pointer border-none">添加</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// P5-RECRUITMENT-BETA-01: 企业招聘 Pipeline 看板
// 数据来源：GET /api/pipeline/kanban
// 推进动作：PATCH /api/pipeline/:id/stage
// 备注：POST /api/pipeline/:id/notes
// 标签：POST /api/pipeline/:id/tags

const loading = ref(false)
const error = ref('')
const columns = ref<Record<string, any[]>>({})
const counts = ref<Record<string, number>>({})
const totalCount = ref(0)
const selectedCard = ref<any>(null)
const advanceLoading = ref(false)
const noteInput = ref('')

const stages = [
  { id: 'discovered', label: '发现候选', dotClass: 'bg-blue-400', actionClass: 'bg-blue-600/20 text-blue-400 hover:bg-blue-600/30' },
  { id: 'screening', label: '筛选中', dotClass: 'bg-yellow-400', actionClass: 'bg-yellow-600/20 text-yellow-400 hover:bg-yellow-600/30' },
  { id: 'interview', label: '面试中', dotClass: 'bg-purple-400', actionClass: 'bg-purple-600/20 text-purple-400 hover:bg-purple-600/30' },
  { id: 'offer', label: 'Offer', dotClass: 'bg-green-400', actionClass: 'bg-green-600/20 text-green-400 hover:bg-green-600/30' },
  { id: 'hired', label: '已录用', dotClass: 'bg-emerald-400', actionClass: 'bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30' },
]

const token = computed(() => localStorage.getItem('token') || '')
const workspaceId = computed(() => localStorage.getItem('workspace_id') || localStorage.getItem('enterprise_id') || '')

async function fetchKanban() {
  loading.value = true
  error.value = ''
  try {
    const wid = workspaceId.value
    if (!wid) {
      error.value = '未找到企业工作区，请先完成企业认证'
      return
    }
    const res = await fetch(`/api/pipeline/kanban?workspaceId=${encodeURIComponent(wid)}`, {
      headers: { 'Authorization': `Bearer ${token.value}` },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    columns.value = data.columns || {}
    counts.value = data.counts || {}
    totalCount.value = data.total || 0
  } catch (e: any) {
    error.value = e.message || '加载失败'
  } finally {
    loading.value = false
  }
}

function openCard(card: any) {
  selectedCard.value = card
}

function stageLabel(id: string): string {
  return stages.find(s => s.id === id)?.label || id
}

function stageIndex(id: string): number {
  return stages.findIndex(s => s.id === id)
}

function nextStages(currentStage: string) {
  const idx = stageIndex(currentStage)
  if (idx < 0 || idx >= stages.length - 1) return []
  // 只显示下一个阶段 + rejected 选项
  const next = [stages[idx + 1]]
  if (currentStage !== 'hired' && currentStage !== 'offer') {
    next.push({ id: 'rejected', label: '拒绝', actionClass: 'bg-red-600/20 text-red-400 hover:bg-red-600/30' })
  }
  return next
}

async function advanceStage(card: any, newStage: string) {
  advanceLoading.value = true
  try {
    const res = await fetch(`/api/pipeline/${card.id}/stage`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token.value}`,
      },
      body: JSON.stringify({ stage: newStage, actor: 'hr' }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || `HTTP ${res.status}`)
    }
    // 更新本地数据
    const oldCol = columns.value[card.stage] || []
    const cardIdx = oldCol.findIndex((c: any) => c.id === card.id)
    if (cardIdx >= 0) {
      const moved = oldCol.splice(cardIdx, 1)[0]
      moved.stage = newStage
      moved.lastActivityAt = new Date().toISOString()
      if (!columns.value[newStage]) columns.value[newStage] = []
      columns.value[newStage].unshift(moved)
    }
    // 更新选中卡片
    selectedCard.value = { ...card, stage: newStage }
  } catch (e: any) {
    error.value = e.message || '推进失败'
  } finally {
    advanceLoading.value = false
  }
}

async function addNote(card: any) {
  if (!noteInput.value.trim()) return
  try {
    const res = await fetch(`/api/pipeline/${card.id}/notes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token.value}`,
      },
      body: JSON.stringify({ content: noteInput.value.trim() }),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    noteInput.value = ''
  } catch (e: any) {
    error.value = e.message || '备注添加失败'
  }
}

function scoreClass(score: number): string {
  if (score >= 70) return 'text-green-400'
  if (score >= 50) return 'text-yellow-400'
  return 'text-red-400'
}

function formatTime(t: string): string {
  if (!t) return '—'
  const d = new Date(t)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`
  if (diff < 604800000) return `${Math.floor(diff / 86400000)} 天前`
  return d.toLocaleDateString('zh-CN')
}

onMounted(fetchKanban)
</script>

<style scoped>
.pipeline-page {
  min-height: 100vh;
  background: #080D1E;
  padding: 1.5rem;
}

.pipeline-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.5rem;
}

/* Kanban Board */
.kanban-board {
  display: flex;
  gap: 1rem;
  overflow-x: auto;
  padding-bottom: 1rem;
  min-height: 400px;
}

.kanban-column {
  flex: 0 0 240px;
  background: #0D1328;
  border: 1px solid #1A2240;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  max-height: calc(100vh - 160px);
}

.kanban-column-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid #1A2240;
}

.kanban-column-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.85);
}

.kanban-column-count {
  font-size: 0.7rem;
  color: rgba(255, 255, 255, 0.4);
  background: rgba(255, 255, 255, 0.05);
  padding: 0.1rem 0.5rem;
  border-radius: 8px;
}

.kanban-cards {
  flex: 1;
  overflow-y: auto;
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.kanban-card {
  background: #111B36;
  border: 1px solid #1E2D50;
  border-radius: 8px;
  padding: 0.75rem;
  cursor: pointer;
  transition: all 0.15s;
}

.kanban-card:hover {
  border-color: #2A3F6E;
  background: #141F3F;
  transform: translateY(-1px);
}

.kanban-card--auto {
  border-left: 2px solid #6366f1;
}

.kanban-card-name {
  font-size: 0.8rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
  margin-bottom: 0.25rem;
}

.kanban-card-job {
  font-size: 0.65rem;
  color: rgba(255, 255, 255, 0.4);
  margin-bottom: 0.5rem;
}

.kanban-card-meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.25rem;
}

.kanban-card-time {
  font-size: 0.6rem;
  color: rgba(255, 255, 255, 0.25);
}

.kanban-empty {
  text-align: center;
  padding: 1.5rem 0;
  font-size: 0.7rem;
  color: rgba(255, 255, 255, 0.2);
}

/* Modal */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
  padding: 1rem;
}

.modal-card {
  background: #111B36;
  border: 1px solid #1E2D50;
  border-radius: 16px;
  width: 100%;
  max-width: 480px;
  max-height: 80vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 1.25rem;
  border-bottom: 1px solid #1E2D50;
}

.modal-body {
  padding: 1.25rem;
}

.modal-section {
  margin-bottom: 1.25rem;
}

.modal-section:last-child {
  margin-bottom: 0;
}

/* Stage Progress */
.stage-progress {
  display: flex;
  align-items: flex-start;
  gap: 0;
}

.stage-step {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
}

.stage-step-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #1E2D50;
  border: 2px solid #2A3F6E;
  z-index: 1;
}

.stage-step--active .stage-step-dot {
  background: #6366f1;
  border-color: #818cf8;
  box-shadow: 0 0 8px rgba(99, 102, 241, 0.4);
}

.stage-step--done .stage-step-dot {
  background: #10b981;
  border-color: #34d399;
}

.stage-step-label {
  font-size: 0.6rem;
  color: rgba(255, 255, 255, 0.4);
  margin-top: 0.35rem;
  text-align: center;
}

.stage-step--active .stage-step-label {
  color: rgba(255, 255, 255, 0.85);
  font-weight: 600;
}

.stage-step--done .stage-step-label {
  color: #34d399;
}

.stage-step-line {
  position: absolute;
  top: 5px;
  left: 50%;
  width: 100%;
  height: 2px;
  background: #1E2D50;
  z-index: 0;
}

.stage-step--done .stage-step-line {
  background: #10b981;
}
</style>
