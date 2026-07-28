<!-- UX-03B: 招聘管理中心（Conversation） -->
<!-- 位置：/workspace/enterprise/conversations.vue -->
<!-- 三栏布局：候选人列表 | 沟通记录 | 候选人摘要 -->
<!-- DP-UI-03: Conversation = CRM，不是聊天机器人 -->
<!-- DP-UI-05: 以"今天发生了什么"为组织方式 -->
<!-- EP-01: 所有数字来自真实 API -->

<template>
  <div class="rec-page">
    <!-- 页面标题 -->
    <div class="rec-page-header">
      <div>
        <h1 class="rec-page-title">招聘管理中心</h1>
        <p class="rec-page-subtitle">候选人与招聘团队的沟通进展</p>
      </div>
      <div class="rec-page-actions">
        <button class="rec-refresh-btn" @click="loadData">刷新</button>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="rec-loading">加载中...</div>

    <!-- 三栏布局 -->
    <div v-else class="rec-triple-layout">
      <!-- 左侧：候选人列表 -->
      <div class="rec-candidate-list-panel">
        <div class="rec-panel-header">
          <h2 class="rec-panel-title">沟通记录</h2>
          <span class="rec-badge-count">{{ conversations.length }}</span>
        </div>
        <div class="rec-filter-bar">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="搜索候选人..."
            class="rec-search-input"
          />
        </div>
        <div class="rec-list-items">
          <div
            v-for="item in filteredConversations"
            :key="item.id"
            :class="['rec-list-item', { active: selectedId === item.id }]"
            @click="selectConversation(item)"
          >
            <div class="rec-list-item-main">
              <div class="rec-list-item-name">
                {{ item.candidateName || '未知候选人' }}
              </div>
              <div class="rec-list-item-meta">
                <StatusBadge :status="item.status" />
                <span class="rec-list-item-time">{{ formatDate(item.createdAt) }}</span>
              </div>
            </div>
          </div>
          <div v-if="filteredConversations.length === 0" class="rec-list-empty">
            暂无沟通记录
          </div>
        </div>
      </div>

      <!-- 中间：沟通详情 -->
      <div class="rec-conversation-panel">
        <template v-if="selectedConversation">
          <div class="rec-conversation-header">
            <h2 class="rec-conversation-title">
              {{ selectedConversation.candidateName || '未知候选人' }}
            </h2>
            <div class="rec-conversation-meta">
              <StatusBadge :status="selectedConversation.status" />
            </div>
          </div>

          <div class="rec-conversation-body">
            <!-- 沟通信息卡片 -->
            <div class="rec-info-card">
              <div class="rec-info-row">
                <span class="rec-info-label">沟通状态</span>
                <StatusBadge :status="selectedConversation.status" />
              </div>
              <div class="rec-info-row">
                <span class="rec-info-label">创建时间</span>
                <span class="rec-info-value">{{ formatDate(selectedConversation.createdAt) }}</span>
              </div>
              <div class="rec-info-row">
                <span class="rec-info-label">最后更新</span>
                <span class="rec-info-value">{{ formatDate(selectedConversation.updatedAt) }}</span>
              </div>
            </div>

            <!-- 决策按钮 -->
            <div v-if="selectedConversation.status === 'WAITING_HR_REVIEW'" class="rec-decision-bar">
              <button class="rec-btn rec-btn-success" @click="makeDecision('pass')">✅ 通过</button>
              <button class="rec-btn rec-btn-danger" @click="makeDecision('reject')">❌ 拒绝</button>
            </div>

            <!-- 提示 -->
            <div class="rec-conversation-note">
              📋 详细沟通记录将在后续版本中展示
            </div>
          </div>
        </template>

        <!-- 未选中状态 -->
        <div v-else class="rec-empty-state">
          <div class="rec-empty-icon">💬</div>
          <h3>从左侧选择一位候选人</h3>
          <p>查看沟通记录和摘要</p>
        </div>
      </div>

      <!-- 右侧：候选人摘要 -->
      <div class="rec-summary-panel">
        <template v-if="selectedConversation">
          <div class="rec-summary-header">
            <h3 class="rec-summary-title">候选人摘要</h3>
          </div>
          <div class="rec-summary-body">
            <div class="rec-summary-name">
              {{ selectedConversation.candidateName || '未知候选人' }}
            </div>
            <div v-if="selectedConversation.candidateEmail" class="rec-summary-email">
              {{ selectedConversation.candidateEmail }}
            </div>
            <div class="rec-summary-section">
              <div class="rec-summary-section-title">沟通状态</div>
              <StatusBadge :status="selectedConversation.status" />
            </div>

          </div>
        </template>
        <div v-else class="rec-empty-state small">
          <div class="rec-empty-icon">📋</div>
          <p>选择候选人后显示摘要</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { getAuthToken } from '~/utils/auth/token'
// EP-01: 所有数字来自真实 API
// DP-UI-03: Conversation = CRM，不是聊天机器人
// Schema 现实：RecruitmentConversation 无消息子表，中间面板展示元数据

interface ConversationDTO {
  id: string
  candidateName: string | null
  candidateEmail: string | null
  status: string
  createdAt: string
  updatedAt: string
}

const conversations = ref<ConversationDTO[]>([])
const selectedId = ref<string | null>(null)
const searchQuery = ref('')
const loading = ref(true)

const filteredConversations = computed(() => {
  if (!searchQuery.value) return conversations.value
  const q = searchQuery.value.toLowerCase()
  return conversations.value.filter(
    (c) => c.candidateName?.toLowerCase().includes(q) || c.candidateEmail?.toLowerCase().includes(q)
  )
})

const selectedConversation = computed(() => {
  if (!selectedId.value) return null
  return conversations.value.find((c) => c.id === selectedId.value) || null
})

function formatDate(dateStr: string): string {
  if (!dateStr) return '—'
  try {
    const d = new Date(dateStr)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}/${m}/${day}`
  } catch {
    return dateStr
  }
}

async function loadData() {
  loading.value = true
  try {
    const token = getAuthToken() || ''
    const headers: Record<string, string> = {}
    if (token) headers['Authorization'] = `Bearer ${token}`
    const res = await fetch('/api/admin/recruitment/conversations', { headers })
    if (!res.ok) {
      console.warn('Failed to load conversations:', res.status)
      return
    }
    const json = await res.json()
    conversations.value = json.list || []
    if (conversations.value.length > 0 && !selectedId.value) {
      selectedId.value = conversations.value[0].id
    }
  } catch (e) {
    console.error('Failed to load conversations:', e)
  } finally {
    loading.value = false
  }
}

function selectConversation(item: ConversationDTO) {
  selectedId.value = item.id
}

function makeDecision(decision: 'pass' | 'reject') {
  console.log('Decision:', decision, selectedId.value)
}

let refreshTimer: ReturnType<typeof setInterval> | null = null
onMounted(() => {
  loadData()
  refreshTimer = setInterval(loadData, 60000)
})
onUnmounted(() => {
  if (refreshTimer) clearInterval(refreshTimer)
})
</script>

<style scoped>
@import '~/assets/styles/recruitment-tokens.css';

.rec-triple-layout {
  display: grid;
  grid-template-columns: 280px 1fr 320px;
  gap: 16px;
  height: calc(100vh - 120px);
  min-height: 500px;
}

/* 左侧列表 */
.rec-candidate-list-panel {
  background: #fff;
  border-radius: 8px;
  border: 1px solid #E5E7EB;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.rec-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border-bottom: 1px solid #E5E7EB;
}

.rec-panel-title {
  font-size: 14px;
  font-weight: 600;
  color: #1A1A1A;
  margin: 0;
}

.rec-badge-count {
  background: #F3F4F6;
  color: #6B7280;
  font-size: 12px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 10px;
}

.rec-filter-bar {
  padding: 12px 16px;
  border-bottom: 1px solid #E5E7EB;
}

.rec-search-input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #E5E7EB;
  border-radius: 4px;
  font-size: 13px;
  color: #1A1A1A;
  background: #F9FAFB;
  outline: none;
  transition: border-color 0.15s;
}

.rec-search-input:focus {
  border-color: #2563EB;
  background: #fff;
}

.rec-list-items {
  flex: 1;
  overflow-y: auto;
}

.rec-list-item {
  padding: 12px 16px;
  border-bottom: 1px solid #F3F4F6;
  cursor: pointer;
  transition: background 0.1s;
}

.rec-list-item:hover {
  background: #F9FAFB;
}

.rec-list-item.active {
  background: #EFF6FF;
  border-left: 3px solid #2563EB;
}

.rec-list-item-main {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.rec-list-item-name {
  font-size: 14px;
  font-weight: 500;
  color: #1A1A1A;
  display: flex;
  align-items: center;
  gap: 8px;
}

.rec-list-item-meta {
  display: flex;
  align-items: center;
  gap: 8px;
}

.rec-list-item-time {
  font-size: 12px;
  color: #9CA3AF;
}

.rec-list-empty {
  padding: 32px 16px;
  text-align: center;
  color: #9CA3AF;
  font-size: 13px;
}

/* 中间面板 */
.rec-conversation-panel {
  background: #fff;
  border-radius: 8px;
  border: 1px solid #E5E7EB;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.rec-conversation-header {
  padding: 16px 20px;
  border-bottom: 1px solid #E5E7EB;
}

.rec-conversation-title {
  font-size: 16px;
  font-weight: 600;
  color: #1A1A1A;
  margin: 0 0 8px 0;
}

.rec-conversation-meta {
  display: flex;
  align-items: center;
  gap: 12px;
}

.rec-conversation-body {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
}

.rec-info-card {
  background: #F9FAFB;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
}

.rec-info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid #E5E7EB;
}

.rec-info-row:last-child {
  border-bottom: none;
}

.rec-info-label {
  font-size: 13px;
  color: #6B7280;
}

.rec-info-value {
  font-size: 13px;
  color: #1A1A1A;
  font-weight: 500;
}

.rec-decision-bar {
  display: flex;
  gap: 12px;
  margin-top: 16px;
}

.rec-conversation-note {
  margin-top: 16px;
  padding: 12px 16px;
  background: #FFFBEB;
  border: 1px solid #FDE68A;
  border-radius: 6px;
  font-size: 13px;
  color: #92400E;
  text-align: center;
}

/* 右侧摘要 */
.rec-summary-panel {
  background: #fff;
  border-radius: 8px;
  border: 1px solid #E5E7EB;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.rec-summary-header {
  padding: 16px;
  border-bottom: 1px solid #E5E7EB;
}

.rec-summary-title {
  font-size: 14px;
  font-weight: 600;
  color: #1A1A1A;
  margin: 0;
}

.rec-summary-body {
  flex: 1;
  padding: 16px;
  overflow-y: auto;
}

.rec-summary-name {
  font-size: 18px;
  font-weight: 600;
  color: #1A1A1A;
  margin-bottom: 4px;
}

.rec-summary-email {
  font-size: 13px;
  color: #6B7280;
  margin-bottom: 16px;
}

.rec-summary-section {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #F3F4F6;
}

.rec-summary-section-title {
  font-size: 12px;
  color: #9CA3AF;
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.rec-summary-match {
  display: flex;
  align-items: center;
  gap: 12px;
}

.rec-match-bar {
  flex: 1;
  height: 6px;
  background: #E5E7EB;
  border-radius: 3px;
  overflow: hidden;
}

.rec-match-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #2563EB, #3B82F6);
  border-radius: 3px;
  transition: width 0.3s;
}

/* 通用 */
.rec-match-score {
  font-size: 12px;
  font-weight: 600;
  color: #2563EB;
  background: #EFF6FF;
  padding: 2px 6px;
  border-radius: 4px;
}

.rec-match-score.large {
  font-size: 14px;
  padding: 4px 8px;
}

.rec-btn {
  padding: 8px 16px;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  border: none;
  transition: opacity 0.15s;
}

.rec-btn:hover {
  opacity: 0.85;
}

.rec-btn-success {
  background: #10B981;
  color: #fff;
}

.rec-btn-danger {
  background: #EF4444;
  color: #fff;
}

/* 空状态 */
.rec-empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #9CA3AF;
}

.rec-empty-state.small {
  padding: 32px 16px;
}

.rec-empty-icon {
  font-size: 32px;
  margin-bottom: 12px;
}

.rec-empty-state h3 {
  font-size: 16px;
  font-weight: 500;
  color: #6B7280;
  margin: 0 0 4px 0;
}

.rec-empty-state p {
  font-size: 13px;
  margin: 0;
}

/* 响应式 */
@media (max-width: 1279px) {
  .rec-triple-layout {
    grid-template-columns: 240px 1fr;
  }
  .rec-summary-panel {
    display: none;
  }
}

@media (max-width: 767px) {
  .rec-triple-layout {
    grid-template-columns: 1fr;
  }
  .rec-candidate-list-panel {
    display: none;
  }
}
</style>
