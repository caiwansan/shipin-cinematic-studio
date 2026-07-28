<template>
  <div class="job-workspace-layout">
    <!-- Sprint-07A.2: AI 职业助理（折叠摘要，~80px） -->
    <div class="career-agent-dashboard">
      <div v-if="careerAgentLoading" class="ca-loading">
        <span>加载中...</span>
      </div>
      <div v-else-if="careerAgentError && !hasCareerAgent" class="ca-error">
        <span>⚠️ {{ careerAgentError }}</span>
        <button @click="loadCareerAgentStatus" class="ca-retry-btn">重试</button>
      </div>
      <!-- 未创建：单行摘要 -->
      <div v-else-if="!hasCareerAgent" class="ca-compact">
        <span class="ca-compact-icon">🤖</span>
        <span class="ca-compact-text">我的AI职业助理</span>
        <span class="ca-compact-source">个人模型</span>
        <button class="ca-create-btn ca-create-btn-sm" @click="handleCreateAgent" :disabled="careerAgentCreating">
          {{ careerAgentCreating ? '创建中...' : '+ 创建' }}
        </button>
        <button class="ca-settings-link" title="配置模型" @click="showModelSettings = true">⚙️ 模型设置</button>
      </div>
      <!-- 已创建：单行摘要 + 展开 -->
      <div v-else class="ca-compact">
        <span class="ca-compact-icon">🤖</span>
        <span class="ca-compact-text">{{ careerAgent?.name || 'AI 职业助理' }}</span>
        <span class="ca-compact-source">个人模型</span>
        <span class="ca-compact-status" :class="careerAgentStatus?.status">{{ getStatusText(careerAgentStatus?.status) }}</span>
        <button class="ca-toggle-btn" @click="caExpanded = !caExpanded">
          {{ caExpanded ? '收起' : '查看' }}
        </button>
        <button class="ca-settings-link" title="配置模型" @click="showModelSettings = true">⚙️</button>
      </div>
      <!-- 展开详情 -->
      <div v-if="caExpanded && hasCareerAgent" class="ca-expanded">
        <div class="ca-expanded-row">
          <span class="ca-section-label">能力</span>
          <div class="ca-tags">
            <span v-for="tool in careerAgentCapabilities" :key="tool" class="ca-tag">✓ {{ tool }}</span>
          </div>
        </div>
        <div class="ca-expanded-row">
          <span class="ca-section-label">快捷任务</span>
          <div class="ca-quick-actions">
            <button class="ca-action-btn" @click="handleExecuteWorkflow('resume_analyze')">📊 分析简历</button>
            <button class="ca-action-btn" @click="handleExecuteWorkflow('job_search')">🔍 推荐岗位</button>
            <button class="ca-action-btn" @click="handleExecuteWorkflow('interview_prepare')">🎯 准备面试</button>
            <button class="ca-action-btn" @click="handleExecuteWorkflow('career_plan')">📋 职业规划</button>
          </div>
        </div>
        <div v-if="careerAgentStatus?.recentTasks?.length" class="ca-recent-tasks">
          <span class="ca-section-label">最近任务</span>
          <div class="ca-task-list">
            <div v-for="task in careerAgentStatus.recentTasks" :key="task.id" class="ca-task-item">
              <span class="ca-task-status" :class="task.status">{{ getTaskStatusText(task.status) }}</span>
              <span class="ca-task-type">{{ task.taskType }}</span>
              <span class="ca-task-date">{{ formatTaskDate(task.startedAt) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 主体：左栏聊天 + 右栏推荐 -->
    <div class="job-workspace-main">
      <!-- 左栏：AI 求职顾问聊天 -->
      <div class="job-workspace-content">
        <div class="job-chat-panel">
          <!-- 聊天头部 -->
          <div class="job-chat-header">
            <div class="chat-title-row">
              <h3>🤖 AI 求职顾问</h3>
              <span class="chat-badge chat-badge-platform">昆仑镜 AI 服务 · 平台提供</span>
            </div>
            <div class="chat-header-right">
              <div class="chat-capabilities">
                <span class="chat-cap">📊 简历分析</span>
                <span class="chat-cap">🎯 职业规划</span>
                <span class="chat-cap">🔍 岗位匹配</span>
                <span class="chat-cap">💡 面试建议</span>
              </div>
              <button class="chat-clear-btn" @click="clearChat" title="开始新对话">新对话</button>
            </div>
          </div>

          <!-- 消息列表 -->
          <div class="job-chat-messages" ref="messagesRef">
            <!-- 对话消息（首条为 Agent 欢迎消息） -->
            <div
              v-for="(msg, index) in messages"
              :key="index"
              class="msg"
              :class="msg.role === 'user' ? 'msg-user' : 'msg-assistant'"
            >
              <div class="msg-avatar">{{ msg.role === 'user' ? '👤' : '🤖' }}</div>
              <div class="msg-content">
                <p v-for="(line, i) in msg.content.split('\n')" :key="i">{{ line || ' ' }}</p>
              </div>
            </div>

            <!-- 加载指示器 -->
            <div v-if="isLoading" class="msg msg-assistant">
              <div class="msg-avatar">🤖</div>
              <div class="msg-content">
                <div class="typing-indicator">
                  <span></span><span></span><span></span>
                </div>
              </div>
            </div>
          </div>

          <!-- 输入区域 -->
          <div class="job-chat-input">
            <input
              v-model="chatInput"
              type="text"
              placeholder="输入你的情况，例如：我本科毕业，会Python..."
              @keyup.enter="handleSendMessage"
              :disabled="isLoading"
            />
            <button class="job-send-btn" @click="handleSendMessage" :disabled="isLoading || !chatInput.trim()">
              {{ isLoading ? '思考中...' : '发送' }}
            </button>
          </div>
        </div>
      </div>

      <!-- 右栏：岗位推荐 -->
      <div class="job-recommend-panel">
        <!-- 推荐标题 -->
        <div class="job-recommend-header">
          <h4>🎯 推荐岗位 <span v-if="recommendations.length > 0" class="badge">{{ recommendations.length }}</span></h4>
        </div>
        <!-- 推荐内容：画像 + 建议 + 岗位 -->
        <div class="job-recommend-scroll">
          <!-- 空状态 -->
          <div v-if="recommendations.length === 0 && !isComplete" class="job-empty-state">
            <span class="job-empty-icon">📋</span>
            <p>完成职业画像后</p>
            <p>推荐岗位将在此显示</p>
          </div>

          <!-- 职业画像卡片 -->
          <div class="job-profile-card job-card-mini" v-if="profileCompleteness > 0">
          <div class="job-profile-header">
            <h4>📊 你的职业画像</h4>
            <span class="job-profile-completeness">{{ profileCompleteness }}%</span>
          </div>
          <div class="job-profile-body">
            <div class="job-profile-field" v-if="profile.name">
              <span class="field-label">姓名</span>
              <span class="field-value">{{ profile.name }}</span>
            </div>
            <div class="job-profile-field" v-if="profile.education">
              <span class="field-label">学历</span>
              <span class="field-value">{{ profile.education }}</span>
            </div>
            <div class="job-profile-field" v-if="profile.skills && profile.skills.length > 0">
              <span class="field-label">技能</span>
              <span class="field-value">
                <span v-for="skill in profile.skills" :key="skill" class="skill-tag">{{ skill }}</span>
              </span>
            </div>
            <div class="job-profile-field" v-if="profile.city">
              <span class="field-label">目标城市</span>
              <span class="field-value">{{ profile.city }}</span>
            </div>
            <div class="job-profile-field" v-if="profile.salaryMin > 0">
              <span class="field-label">期望薪资</span>
              <span class="field-value">{{ profile.salaryMin }}-{{ profile.salaryMax }}K</span>
            </div>
            <div class="job-profile-field" v-if="profile.careerGoal">
              <span class="field-label">职业目标</span>
              <span class="field-value">{{ profile.careerGoal }}</span>
            </div>
          </div>
          <!-- 完成度进度条 -->
          <div class="job-profile-progress">
            <div class="progress-bar">
              <div class="progress-fill" :style="{ width: profileCompleteness + '%' }"></div>
            </div>
          </div>
        </div>

        <!-- Phase 1.5: 职业建议卡片 -->
        <div class="job-profile-card job-advice-card" v-if="careerAdvice">
          <div class="job-profile-header">
            <h4>📋 职业建议</h4>
          </div>
          <div class="job-profile-body">
            <div class="job-profile-field">
              <span class="field-label">职业优势</span>
              <span class="field-value">
                <span v-for="s in careerAdvice.strengths" :key="s" class="skill-tag">{{ s }}</span>
              </span>
            </div>
            <div class="job-profile-field">
              <span class="field-label">建议方向</span>
              <span class="field-value">{{ careerAdvice.suggestedDirection }}</span>
            </div>
            <div class="job-profile-field">
              <span class="field-label">未来3个月</span>
              <span class="field-value">{{ careerAdvice.nextSteps }}</span>
            </div>
          </div>
        </div>

          <!-- 推荐岗位卡片 -->
          <div
            v-for="rec in recommendations"
            :key="rec.jobId"
            class="job-rec-card"
          >
            <div class="rec-header">
              <span class="rec-title">{{ rec.title }}</span>
              <span class="rec-match" :class="getMatchClass(rec.matchScore)">{{ rec.matchScore }}%</span>
            </div>
            <div class="rec-company">
              <span class="rec-company-name">{{ rec.company }}</span>
              <span class="rec-rating">{{ '★'.repeat(rec.companyRating) }}{{ '☆'.repeat(5 - rec.companyRating) }}</span>
            </div>
            <div class="rec-info">
              <span class="rec-salary">{{ rec.salary }}</span>
              <span class="rec-location">{{ rec.location }}</span>
            </div>

            <!-- Phase 1.5: 推荐原因 -->
            <div class="rec-recommend-reason" v-if="rec.recommendReason">
              <span class="reason-text">💡 {{ rec.recommendReason }}</span>
            </div>

            <!-- Phase 1.5: 优势匹配 -->
            <div class="rec-strengths" v-if="rec.strengthMatch && rec.strengthMatch.length > 0">
              <span v-for="s in rec.strengthMatch" :key="s" class="strength-tag">✓ {{ s }}</span>
            </div>

            <!-- 匹配度细分 -->
            <div class="rec-breakdown">
              <div class="breakdown-item">
                <span class="breakdown-label">技能</span>
                <div class="breakdown-bar"><div :style="{ width: rec.matchBreakdown.skills + '%', background: '#4ade80' }"></div></div>
              </div>
              <div class="breakdown-item">
                <span class="breakdown-label">经验</span>
                <div class="breakdown-bar"><div :style="{ width: rec.matchBreakdown.experience + '%', background: '#60a5fa' }"></div></div>
              </div>
              <div class="breakdown-item">
                <span class="breakdown-label">城市</span>
                <div class="breakdown-bar"><div :style="{ width: rec.matchBreakdown.city + '%', background: '#f59e0b' }"></div></div>
              </div>
              <div class="breakdown-item">
                <span class="breakdown-label">薪资</span>
                <div class="breakdown-bar"><div :style="{ width: rec.matchBreakdown.salary + '%', background: '#a78bfa' }"></div></div>
              </div>
            </div>

            <!-- Phase 1.5: 能力差距 -->
            <div class="rec-gaps" v-if="rec.skillGap && rec.skillGap.length > 0">
              <span class="gap-label">需提升：</span>
              <span v-for="gap in rec.skillGap" :key="gap" class="gap-tag">△ {{ gap }}</span>
            </div>

            <!-- Phase 1.5: 成长建议 -->
            <div class="rec-growth" v-if="rec.growthAdvice">
              <span class="growth-text">📈 {{ rec.growthAdvice }}</span>
            </div>

            <!-- 风险提示 -->
            <div class="rec-risks" v-if="rec.risks && rec.risks.length > 0">
              <span v-for="risk in rec.risks" :key="risk" class="reason-tag reason-risk">⚠ {{ risk }}</span>
            </div>

            <!-- Phase 1.6: 行为反馈按钮 -->
            <div class="rec-feedback">
              <button
                class="feedback-btn"
                :class="{ active: rec.feedback === 'favorite' }"
                @click="submitFeedback(rec.jobId, 'favorite')"
                title="收藏"
              >{{ rec.feedback === 'favorite' ? '❤️' : '🤍' }}</button>
              <button
                class="feedback-btn"
                :class="{ active: rec.feedback === 'not_interested' }"
                @click="submitFeedback(rec.jobId, 'not_interested')"
                title="不感兴趣"
              >👎</button>
              <button
                class="feedback-btn"
                :class="{ active: rec.feedback === 'applied' }"
                @click="submitFeedback(rec.jobId, 'applied')"
                title="已申请"
              >📤</button>
              <button
                class="feedback-btn"
                :class="{ active: rec.feedback === 'interviewed' }"
                @click="submitFeedback(rec.jobId, 'interviewed')"
                title="已面试"
              >🎯</button>
            </div>
          </div>
        </div> <!-- end job-recommend-scroll -->
      </div>
    </div>
  </div>

  <!-- Phase 1.6: 职业档案中心 Modal -->
  <div v-if="showProfileCenter" class="profile-center-overlay" @click.self="showProfileCenter = false">
    <div class="profile-center-modal">
      <div class="modal-header">
        <h2>📊 我的职业档案</h2>
        <button class="modal-close" @click="showProfileCenter = false">✕</button>
      </div>

      <div class="modal-body" v-if="profileCenter">
        <!-- 基本信息 -->
        <div class="pc-section">
          <h3>基本信息</h3>
          <div class="pc-grid">
            <div class="pc-item">
              <span class="pc-label">姓名</span>
              <span class="pc-value">{{ profileCenter.profile?.name || '-' }}</span>
            </div>
            <div class="pc-item">
              <span class="pc-label">学历</span>
              <span class="pc-value">{{ profileCenter.profile?.education || '-' }}</span>
            </div>
            <div class="pc-item">
              <span class="pc-label">目标城市</span>
              <span class="pc-value">{{ profileCenter.profile?.city || '-' }}</span>
            </div>
            <div class="pc-item">
              <span class="pc-label">期望薪资</span>
              <span class="pc-value">{{ profileCenter.profile?.salaryMin }}-{{ profileCenter.profile?.salaryMax }}K</span>
            </div>
            <div class="pc-item">
              <span class="pc-label">职业目标</span>
              <span class="pc-value">{{ profileCenter.profile?.careerGoal || '-' }}</span>
            </div>
            <div class="pc-item">
              <span class="pc-label">完成度</span>
              <span class="pc-value">{{ profileCenter.profile?.completeness }}%</span>
            </div>
          </div>
        </div>

        <!-- 技能标签 -->
        <div class="pc-section" v-if="profileCenter.profile?.skills?.length > 0">
          <h3>技能标签</h3>
          <div class="pc-skills">
            <span v-for="skill in profileCenter.profile.skills" :key="skill" class="pc-skill">{{ skill }}</span>
          </div>
        </div>

        <!-- 反馈统计 -->
        <div class="pc-section">
          <h3>求职进度</h3>
          <div class="pc-stats">
            <div class="stat-item">
              <span class="stat-icon">❤️</span>
              <span class="stat-label">收藏</span>
              <span class="stat-value">{{ profileCenter.feedbackStats?.favorite || 0 }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-icon">📤</span>
              <span class="stat-label">已申请</span>
              <span class="stat-value">{{ profileCenter.feedbackStats?.applied || 0 }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-icon">🎯</span>
              <span class="stat-label">已面试</span>
              <span class="stat-value">{{ profileCenter.feedbackStats?.interviewed || 0 }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-icon">👎</span>
              <span class="stat-label">不感兴趣</span>
              <span class="stat-value">{{ profileCenter.feedbackStats?.notInterested || 0 }}</span>
            </div>
          </div>
        </div>

        <!-- 收藏岗位 -->
        <div class="pc-section" v-if="profileCenter.favorites?.length > 0">
          <h3>收藏岗位</h3>
          <div class="pc-favorites">
            <div v-for="fav in profileCenter.favorites" :key="fav.jobId" class="fav-item">
              <div class="fav-info">
                <span class="fav-title">{{ fav.title }}</span>
                <span class="fav-company">{{ fav.company }}</span>
              </div>
              <div class="fav-meta">
                <span class="fav-match">{{ fav.matchScore }}%</span>
                <span class="fav-salary">{{ fav.salary }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="modal-body" v-else>
        <div class="pc-loading">加载中...</div>
      </div>
    </div>
  </div>

  <!-- AI 职业助理模型设置弹窗（复用全局 ModelSettingsModal） -->
  <ModelSettingsModal :visible="showModelSettings" @close="showModelSettings = false" filterCapability="career_agent" />
</template>

<script setup lang="ts">
import { getAuthToken } from '~/utils/auth/token'
/**
 * JobWorkspaceLayout.vue - 昆仑镜 AI 求职招聘工作台布局
 *
 * Sprint-03C: Frontend Reality Integration
 * - Career Agent 状态卡（真实数据）
 * - 职业画像状态
 * - Agent 激活入口
 * - Workflow 状态展示
 */
import { ref, computed, onMounted, nextTick, watch } from 'vue'
import { getPipelineStages } from '~/studio-v2/config/workspace-config'
import { chatWithCareerAgent, getJobRecommendations, submitJobFeedback, getCareerProfileCenter } from '~/studio-v2/api/job/candidate-api'
import { getCareerAgentStatus, activateAndExecuteCareerAgent, type CareerAgentStatus } from '~/studio-v2/api/job/career-agent-api'
import ModelSettingsModal from '~/components/director/ModelSettingsModal.vue'

const activeStageId = ref<string>('job-career')
const caExpanded = ref(false)
const chatInput = ref('')
const isLoading = ref(false)
const messages = ref<Array<{ role: 'user' | 'assistant'; content: string }>>([])
const messagesRef = ref<HTMLElement | null>(null)
const welcomeMessage = ref('你好！我是你的 AI 职业顾问 👋\n\n我会通过几个问题了解你的情况，帮你找到最合适的工作机会。\n\n先告诉我，你希望我怎么称呼你？')

// ─── Sprint-03C: Career Agent 真实状态 ───
const careerAgentStatus = ref<CareerAgentStatus | null>(null)
const careerAgentLoading = ref(false)
const careerAgentCreating = ref(false)
const careerAgentError = ref('')

const careerAgent = computed(() => careerAgentStatus.value?.agent || null)
const hasCareerAgent = computed(() => careerAgentStatus.value?.hasAgent || false)
const careerAgentCapabilities = computed(() => careerAgent.value?.tools || [])

// 聊天历史持久化
function saveChatHistory() {
  try {
    localStorage.setItem('job-chat-history', JSON.stringify(messages.value))
  } catch {}
}

function loadChatHistory(): Array<{ role: 'user' | 'assistant'; content: string }> {
  try {
    const saved = localStorage.getItem('job-chat-history')
    if (saved) return JSON.parse(saved)
  } catch {}
  return []
}

// 清空聊天
function clearChat() {
  messages.value = []
  profile.value = {}
  recommendations.value = []
  careerAdvice.value = null
  isComplete.value = false
  try { localStorage.removeItem('job-chat-history') } catch {}
  // 重新发送欢迎消息
  messages.value.push({ role: 'assistant', content: welcomeMessage.value })
}

// Phase 1.6: 职业档案中心
const showProfileCenter = ref(false)
const showModelSettings = ref(false)
const profileCenter = ref<any>(null)

// 职业画像
const profile = ref<any>({})
const profileCompleteness = computed(() => profile.value.completeness || 0)
const isComplete = ref(false)

// Phase 1.5: 职业建议
const careerAdvice = ref<any>(null)

// 推荐岗位
const recommendations = ref<any[]>([])

const pipelineStages = computed(() =>
  getPipelineStages('JOB')
)

function goToStage(stageKey: string) {
  activeStageId.value = stageKey
}

function getMatchClass(score: number): string {
  if (score >= 80) return 'match-high'
  if (score >= 60) return 'match-medium'
  return 'match-low'
}

// Phase 1.6: 岗位行为反馈
async function submitFeedback(jobId: string, feedback: string) {
  try {
    const userId = getUserId()
    // 乐观更新 UI
    const rec = recommendations.value.find(r => r.jobId === jobId)
    if (rec) {
      // 如果点击相同反馈，取消它
      if (rec.feedback === feedback) {
        rec.feedback = undefined
      } else {
        rec.feedback = feedback
      }
    }
    // 发送到后端
    await submitJobFeedback(userId, jobId, feedback)
  } catch (e) {
    console.error('反馈失败', e)
  }
}

// Phase 1.6: 加载职业档案中心
async function loadProfileCenter() {
  try {
    const userId = getUserId()
    const data = await getCareerProfileCenter(userId)
    profileCenter.value = data
  } catch (e) {
    console.error('加载档案失败', e)
  }
}

// 监听档案中心打开
watch(showProfileCenter, (val) => {
  if (val) loadProfileCenter()
})

async function handleSendMessage() {
  if (!chatInput.value.trim() || isLoading.value) return

  const userMessage = chatInput.value.trim()
  messages.value.push({ role: 'user', content: userMessage })
  chatInput.value = ''
  isLoading.value = true

  await scrollToBottom()

  try {
    const userId = getUserId()
    const result = await chatWithCareerAgent({ message: userMessage, userId })

    messages.value.push({ role: 'assistant', content: result.reply })

    if (result.profile) {
      profile.value = result.profile
    }

    if (result.isComplete) {
      isComplete.value = true
      if (result.recommendations && result.recommendations.length > 0) {
        recommendations.value = result.recommendations
      }
      // Phase 1.5: 职业建议
      if (result.careerAdvice) {
        careerAdvice.value = result.careerAdvice
      }
    }
  } catch (e) {
    messages.value.push({
      role: 'assistant',
      content: '抱歉，网络连接有问题。请稍后再试。',
    })
  } finally {
    isLoading.value = false
    await scrollToBottom()
  }
}

async function scrollToBottom() {
  await nextTick()
  if (messagesRef.value) {
    messagesRef.value.scrollTop = messagesRef.value.scrollHeight
  }
}

function getUserId(): string {
  try {
    const token = getAuthToken()
    if (token) {
      const payload = JSON.parse(atob(token.split('.')[1]))
      return payload.userId || payload.sub || 'anonymous'
    }
  } catch {}
  return 'anonymous'
}

// ─── Sprint-03C: Career Agent 辅助函数 ───
function getStatusText(status?: string): string {
  const map: Record<string, string> = {
    active: '🟢 在线',
    paused: '⏸️ 暂停',
    running: '🔄 执行中',
    error: '❌ 异常',
    not_created: '未创建',
  }
  return map[status || ''] || status || '未知'
}

function getTaskStatusText(status: string): string {
  const map: Record<string, string> = {
    running: '执行中',
    completed: '完成',
    failed: '失败',
  }
  return map[status] || status
}

function formatTaskDate(dateStr?: string): string {
  if (!dateStr) return ''
  try {
    return new Date(dateStr).toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return dateStr
  }
}

// ─── Sprint-03C: Career Agent 方法 ───
async function loadCareerAgentStatus() {
  careerAgentLoading.value = true
  careerAgentError.value = ''
  try {
    const status = await getCareerAgentStatus()
    careerAgentStatus.value = status
  } catch (err: any) {
    careerAgentError.value = err.message || '加载 Career Agent 状态失败'
    careerAgentStatus.value = { hasAgent: false, status: 'error', stats: { totalTasks: 0, completedTasks: 0, failedTasks: 0 }, recentTasks: [], message: err.message }
  } finally {
    careerAgentLoading.value = false
  }
}

async function handleCreateAgent() {
  careerAgentCreating.value = true
  careerAgentError.value = ''
  try {
    const result = await activateAndExecuteCareerAgent({
      goal: '帮助用户进行求职规划、简历分析、岗位匹配',
    })
    // 重新加载状态
    await loadCareerAgentStatus()
    // 添加系统消息
    if (result.execution?.output) {
      messages.value.push({ role: 'assistant', content: `🤖 ${result.message}\n\n${result.execution.output.slice(0, 200)}` })
    } else if (result.execution?.status === 'failed') {
      messages.value.push({ role: 'assistant', content: `🤖 AI 职业助理已创建，但首次任务执行遇到问题。\n\n这通常是因为 LLM API Key 未配置。掌柜正在修复中。` })
    }
  } catch (err: any) {
    careerAgentError.value = err.message || '创建 Career Agent 失败'
  } finally {
    careerAgentCreating.value = false
  }
}

async function handleExecuteWorkflow(workflowType: string) {
  if (!hasCareerAgent.value) {
    await handleCreateAgent()
    return
  }
  messages.value.push({ role: 'assistant', content: `🤖 正在执行任务: ${workflowType}...\n\n（LLM API Key 待配置，任务将创建但可能无法完成。掌柜正在修复中。）` })
}

onMounted(async () => {
  // 加载聊天历史
  const history = loadChatHistory()
  if (history.length > 0) {
    messages.value = history
  } else {
    // Agent First: 加载欢迎消息作为 Agent 首轮问候
    const userId = getUserId()
    try {
      const res = await fetch('/api/job/welcome?userId=' + userId)
      const data = await res.json()
      const welcome = data.welcome || '你好！我是你的 AI 职业顾问 👋\n\n我会通过几个问题了解你的情况，帮你找到最合适的工作机会。\n\n先告诉我，你希望我怎么称呼你？'
      messages.value.push({ role: 'assistant', content: welcome })
      welcomeMessage.value = welcome
    } catch {
      messages.value.push({ role: 'assistant', content: welcomeMessage.value })
    }
  }

  // Sprint-03C: 加载 Career Agent 真实状态
  await loadCareerAgentStatus()

  // 监听消息变化，自动保存到 localStorage
  watch(messages, () => {
    saveChatHistory()
  }, { deep: true })
})
</script>

<style scoped>
.job-workspace-layout {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  background: #0b0f14;
}

.job-workspace-main {
  flex: 1;
  display: flex;
  min-height: 0;
  overflow: hidden;
}

.job-workspace-content {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

/* ─── Sprint-07A.2: Career Agent Dashboard（折叠摘要） ─── */
.career-agent-dashboard {
  flex-shrink: 0;
  background: linear-gradient(135deg, #0d1117 0%, #111827 100%);
  border-bottom: 1px solid rgba(255,255,255,0.06);
  padding: 6px 16px;
}

.ca-loading, .ca-error {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 0;
  color: rgba(255,255,255,0.6);
  font-size: 0.8rem;
}

.ca-error { color: #f59e0b; }

.ca-retry-btn {
  padding: 4px 12px;
  font-size: 0.75rem;
  background: rgba(255,255,255,0.08);
  border: 1px solid rgba(255,255,255,0.15);
  border-radius: 4px;
  color: #fff;
  cursor: pointer;
}

/* 单行摘要 */
.ca-compact {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
}

.ca-compact-source {
  font-size: 0.65rem;
  color: rgba(255,255,255,0.4);
  background: rgba(255,255,255,0.05);
  padding: 2px 6px;
  border-radius: 3px;
  white-space: nowrap;
}

.ca-settings-link {
  font-size: 0.7rem;
  color: rgba(255,255,255,0.5);
  text-decoration: none;
  padding: 2px 6px;
  border-radius: 3px;
  transition: color 0.2s;
  white-space: nowrap;
  background: transparent;
  border: none;
  cursor: pointer;
  font-family: inherit;
}

.ca-settings-link:hover {
  color: #fff;
  background: rgba(255,255,255,0.1);
}

.ca-compact-icon { font-size: 1.2rem; }

.ca-compact-text {
  font-size: 0.85rem;
  font-weight: 600;
  color: rgba(255,255,255,0.85);
}

.ca-compact-status {
  font-size: 0.7rem;
  padding: 2px 8px;
  border-radius: 8px;
  background: rgba(74,222,128,0.1);
  color: #4ade80;
}

.ca-compact-status.paused { background: rgba(245,158,11,0.1); color: #f59e0b; }
.ca-compact-status.error { background: rgba(239,68,68,0.1); color: #ef4444; }
.ca-compact-status.running { background: rgba(96,165,250,0.1); color: #60a5fa; }

.ca-compact-recent {
  font-size: 0.72rem;
  color: rgba(255,255,255,0.4);
  flex: 1;
}

.ca-toggle-btn {
  padding: 4px 12px;
  font-size: 0.72rem;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 5px;
  color: rgba(255,255,255,0.6);
  cursor: pointer;
  transition: all 0.15s;
}

.ca-toggle-btn:hover {
  background: rgba(255,255,255,0.1);
  color: #fff;
}

/* 展开详情 */
.ca-expanded {
  padding: 8px 0;
  border-top: 1px solid rgba(255,255,255,0.04);
  margin-top: 4px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ca-expanded-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.ca-section-label {
  font-size: 0.68rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: rgba(255,255,255,0.3);
  display: block;
  flex-shrink: 0;
  width: 50px;
  padding-top: 4px;
}

.ca-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.ca-tag {
  font-size: 0.7rem;
  padding: 3px 8px;
  background: rgba(74,222,128,0.08);
  color: #4ade80;
  border-radius: 10px;
}

.ca-quick-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.ca-action-btn {
  padding: 6px 12px;
  font-size: 0.75rem;
  background: rgba(201,168,108,0.12);
  border: 1px solid rgba(201,168,108,0.25);
  border-radius: 8px;
  color: rgba(201,168,108,0.9);
  cursor: pointer;
  transition: all 0.15s;
}

.ca-action-btn:hover {
  background: rgba(201,168,108,0.2);
  border-color: rgba(201,168,108,0.4);
}

.ca-recent-tasks {
  border-top: 1px solid rgba(255,255,255,0.04);
  padding-top: 8px;
}

.ca-task-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.ca-task-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 4px 0;
  font-size: 0.75rem;
}

.ca-task-status {
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.68rem;
  background: rgba(255,255,255,0.05);
  color: rgba(255,255,255,0.5);
}

.ca-task-status.completed { color: #4ade80; background: rgba(74,222,128,0.1); }
.ca-task-status.failed { color: #ef4444; background: rgba(239,68,68,0.1); }
.ca-task-status.running { color: #60a5fa; background: rgba(96,165,250,0.1); }

.ca-task-type {
  color: rgba(255,255,255,0.7);
  flex: 1;
}

.ca-task-date {
  color: rgba(255,255,255,0.3);
  font-size: 0.68rem;
}

.ca-create-btn {
  padding: 8px 20px;
  font-size: 0.82rem;
  font-weight: 600;
  background: linear-gradient(135deg, #C9A86C, #E2C88A);
  color: #08131F;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;
}

.ca-create-btn:hover:not(:disabled) {
  box-shadow: 0 4px 12px rgba(201,168,108,0.3);
}

.ca-create-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.ca-create-btn-sm {
  padding: 5px 14px;
  font-size: 0.75rem;
  margin-left: auto;
}

/* 聊天面板 */
.job-chat-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: #0d1117;
  border-right: 1px solid rgba(255,255,255,0.04);
  min-height: 0;
  overflow: hidden;
}

.job-chat-header {
  padding: 16px 20px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
}

.chat-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.job-chat-header h3 {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: rgba(255,255,255,0.9);
}

.chat-badge {
  font-size: 0.65rem;
  padding: 2px 8px;
  border-radius: 10px;
  font-weight: 500;
}

.chat-badge-platform {
  background: rgba(96,165,250,0.12);
  color: #60a5fa;
  border: 1px solid rgba(96,165,250,0.2);
}

.chat-header-right {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 4px;
}

.chat-capabilities {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.chat-cap {
  font-size: 0.68rem;
  padding: 2px 8px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 8px;
  color: rgba(255,255,255,0.5);
}

.chat-clear-btn {
  padding: 4px 12px;
  font-size: 0.75rem;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 5px;
  color: rgba(255,255,255,0.6);
  cursor: pointer;
  transition: all 0.15s;
}

.chat-clear-btn:hover {
  background: rgba(255,255,255,0.1);
  color: #fff;
}

/* 消息列表 */
.job-chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.msg {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}

.msg-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 1rem;
  background: rgba(255,255,255,0.05);
}

.msg-user .msg-avatar {
  background: rgba(201, 168, 108, 0.15);
}

.msg-content {
  flex: 1;
  max-width: 80%;
}

.msg-content p {
  margin: 0 0 6px;
  font-size: 0.88rem;
  line-height: 1.6;
  color: rgba(255,255,255,0.8);
  white-space: pre-wrap;
}

.msg-user .msg-content p {
  background: rgba(201, 168, 108, 0.1);
  padding: 10px 14px;
  border-radius: 12px;
  display: inline-block;
}

/* 打字指示器 */
.typing-indicator {
  display: flex;
  gap: 4px;
  padding: 8px 0;
}

.typing-indicator span {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: rgba(255,255,255,0.3);
  animation: typing 1.4s infinite;
}

.typing-indicator span:nth-child(2) { animation-delay: 0.2s; }
.typing-indicator span:nth-child(3) { animation-delay: 0.4s; }

@keyframes typing {
  0%, 60%, 100% { transform: translateY(0); }
  30% { transform: translateY(-6px); }
}

/* 输入区域 */
.job-chat-input {
  display: flex;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid rgba(255,255,255,0.06);
  flex-shrink: 0;
}

.job-chat-input input {
  flex: 1;
  padding: 10px 14px;
  font-size: 0.85rem;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 8px;
  color: rgba(255,255,255,0.85);
  outline: none;
  transition: border-color 0.15s;
}

.job-chat-input input:focus {
  border-color: rgba(201, 168, 108, 0.4);
}

.job-chat-input input::placeholder {
  color: rgba(255,255,255,0.25);
}

.job-send-btn {
  padding: 10px 20px;
  font-size: 0.85rem;
  font-weight: 600;
  background: linear-gradient(135deg, #C9A86C, #E2C88A);
  color: #08131F;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: box-shadow 0.15s;
  white-space: nowrap;
}

.job-send-btn:hover:not(:disabled) {
  box-shadow: 0 4px 16px rgba(201, 168, 108, 0.25);
}

.job-send-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 推荐面板（底部横向滚动） */
/* 推荐内容纵向滚动 */
.job-recommend-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}

/* 右栏推荐面板 */
.job-recommend-panel {
  width: 380px;
  background: #0d1117;
  border-left: 1px solid rgba(255,255,255,0.04);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  flex-shrink: 0;
}

/* 职业画像卡片 */
.job-profile-card {
  margin: 16px;
  padding: 16px;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 12px;
}

.job-profile-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.job-profile-header h4 {
  margin: 0;
  font-size: 0.85rem;
  font-weight: 600;
  color: rgba(255,255,255,0.85);
}

.job-profile-completeness {
  font-size: 0.75rem;
  font-weight: 600;
  color: #4ade80;
  background: rgba(74, 222, 128, 0.1);
  padding: 2px 8px;
  border-radius: 10px;
}

.job-profile-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.job-profile-field {
  display: flex;
  gap: 8px;
  font-size: 0.78rem;
}

.field-label {
  color: rgba(255,255,255,0.4);
  flex-shrink: 0;
  width: 60px;
}

.field-value {
  color: rgba(255,255,255,0.75);
  flex: 1;
}

.skill-tag {
  display: inline-block;
  font-size: 0.7rem;
  padding: 2px 6px;
  margin: 2px 3px 2px 0;
  background: rgba(201, 168, 108, 0.1);
  color: rgba(201, 168, 108, 0.8);
  border-radius: 4px;
}

.job-profile-progress {
  margin-top: 12px;
}

.progress-bar {
  height: 4px;
  background: rgba(255,255,255,0.06);
  border-radius: 2px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #4ade80, #22c55e);
  border-radius: 2px;
  transition: width 0.5s ease;
}

/* 推荐岗位 */
/* 推荐标题 */
.job-recommend-header {
  padding: 12px 16px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  flex-shrink: 0;
}

.job-recommend-header h4 {
  margin: 0;
  font-size: 0.85rem;
  font-weight: 600;
  color: rgba(255,255,255,0.85);
  display: flex;
  align-items: center;
  gap: 6px;
}

.badge {
  font-size: 0.65rem;
  background: rgba(201, 168, 108, 0.15);
  color: rgba(201, 168, 108, 0.9);
  padding: 1px 6px;
  border-radius: 8px;
}


.job-empty-state {
  text-align: center;
  padding: 30px 10px;
}

.job-empty-icon {
  font-size: 2.5rem;
  display: block;
  margin-bottom: 12px;
}

.job-empty-state p {
  margin: 0;
  font-size: 0.82rem;
  color: rgba(255,255,255,0.35);
}

/* 推荐卡片 */
.job-rec-card {
  min-width: 320px;
  max-width: 360px;
  flex-shrink: 0;
  padding: 14px;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 10px;
  transition: border-color 0.15s;
}

.job-rec-card:hover {
  border-color: rgba(201, 168, 108, 0.2);
}

.rec-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.rec-title {
  font-size: 0.85rem;
  font-weight: 600;
  color: rgba(255,255,255,0.9);
}

.rec-match {
  font-size: 0.75rem;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 8px;
}

.match-high {
  color: #4ade80;
  background: rgba(74, 222, 128, 0.1);
}

.match-medium {
  color: #f59e0b;
  background: rgba(245, 158, 11, 0.1);
}

.match-low {
  color: #ef4444;
  background: rgba(239, 68, 68, 0.1);
}

.rec-company {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.rec-company-name {
  font-size: 0.78rem;
  color: rgba(255,255,255,0.6);
}

.rec-rating {
  font-size: 0.7rem;
  color: #f59e0b;
}

.rec-info {
  display: flex;
  gap: 12px;
  font-size: 0.75rem;
  color: rgba(255,255,255,0.5);
  margin-bottom: 10px;
}

.rec-salary {
  color: #4ade80;
}

/* 匹配度细分 */
.rec-breakdown {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px 12px;
  margin-bottom: 10px;
}

.breakdown-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.breakdown-label {
  font-size: 0.68rem;
  color: rgba(255,255,255,0.35);
  width: 28px;
}

.breakdown-bar {
  flex: 1;
  height: 3px;
  background: rgba(255,255,255,0.06);
  border-radius: 2px;
  overflow: hidden;
}

.breakdown-bar div {
  height: 100%;
  border-radius: 2px;
  transition: width 0.5s ease;
}

/* 推荐理由和风险 */
.rec-reasons, .rec-risks {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 6px;
}

.reason-tag {
  font-size: 0.68rem;
  padding: 2px 6px;
  border-radius: 4px;
}

.reason-positive {
  color: #4ade80;
  background: rgba(74, 222, 128, 0.08);
}

.reason-risk {
  color: #f59e0b;
  background: rgba(245, 158, 11, 0.08);
}

/* ─── Agent First UX: 无欢迎页遮罩 ─── */

/* ─── Phase 1.5: 职业建议卡片 ─── */
.job-advice-card {
  border-color: rgba(201, 168, 108, 0.2) !important;
}

/* ─── Phase 1.5: 推荐卡 V2 ─── */
.rec-recommend-reason {
  margin: 8px 0;
  padding: 8px 10px;
  background: rgba(201, 168, 108, 0.06);
  border-left: 3px solid rgba(201, 168, 108, 0.4);
  border-radius: 6px;
}

.reason-text {
  font-size: 0.75rem;
  color: rgba(201, 168, 108, 0.8);
  line-height: 1.5;
}

.rec-strengths {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin: 6px 0;
}

.strength-tag {
  font-size: 0.68rem;
  padding: 2px 8px;
  background: rgba(74, 222, 128, 0.08);
  color: #4ade80;
  border-radius: 10px;
}

.rec-gaps {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  margin: 6px 0;
}

.gap-label {
  font-size: 0.7rem;
  color: rgba(255, 255, 255, 0.4);
}

.gap-tag {
  font-size: 0.68rem;
  padding: 2px 8px;
  background: rgba(245, 158, 11, 0.08);
  color: #f59e0b;
  border-radius: 10px;
}

.rec-growth {
  margin: 8px 0;
  padding: 8px 10px;
  background: rgba(96, 165, 250, 0.06);
  border-left: 3px solid rgba(96, 165, 250, 0.4);
  border-radius: 6px;
}

.growth-text {
  font-size: 0.75rem;
  color: rgba(96, 165, 250, 0.9);
  line-height: 1.5;
}

.rec-actions {
  display: flex;
  gap: 8px;
  margin-top: 10px;
}

.rec-action-btn {
  flex: 1;
  padding: 8px 12px;
  font-size: 0.78rem;
  font-weight: 600;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;
  border: none;
}

.btn-primary {
  background: linear-gradient(135deg, #C9A86C, #E2C88A);
  color: #08131F;
}

.btn-primary:hover {
  box-shadow: 0 4px 12px rgba(201, 168, 108, 0.3);
}

.btn-secondary {
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.btn-secondary:hover {
  background: rgba(255, 255, 255, 0.1);
}

/* ─── Phase 1.6: 反馈按钮 ─── */
.rec-feedback {
  display: flex;
  gap: 4px;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid rgba(255, 255, 255, 0.04);
}

.feedback-btn {
  width: 32px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.85rem;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s;
}

.feedback-btn:hover {
  background: rgba(255, 255, 255, 0.08);
}

.feedback-btn.active {
  background: rgba(201, 168, 108, 0.15);
  border-color: rgba(201, 168, 108, 0.3);
}

/* ─── Phase 1.6: 档案中心 Modal ─── */
.profile-center-overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(8, 12, 20, 0.9);
  backdrop-filter: blur(6px);
}

.profile-center-modal {
  width: 520px;
  max-width: 90vw;
  max-height: 80vh;
  overflow-y: auto;
  background: linear-gradient(135deg, #0d1117 0%, #161b22 100%);
  border: 1px solid rgba(201, 168, 108, 0.2);
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.modal-header h2 {
  margin: 0;
  font-size: 1.1rem;
  color: #fff;
}

.modal-close {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: rgba(255, 255, 255, 0.6);
  cursor: pointer;
  transition: all 0.15s;
}

.modal-close:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.modal-body {
  padding: 20px 24px;
}

.pc-section {
  margin-bottom: 20px;
}

.pc-section h3 {
  margin: 0 0 10px;
  font-size: 0.85rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.7);
}

.pc-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.pc-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 8px;
}

.pc-label {
  font-size: 0.7rem;
  color: rgba(255, 255, 255, 0.4);
}

.pc-value {
  font-size: 0.82rem;
  color: rgba(255, 255, 255, 0.85);
}

.pc-skills {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.pc-skill {
  padding: 4px 10px;
  background: rgba(201, 168, 108, 0.1);
  color: rgba(201, 168, 108, 0.9);
  border-radius: 12px;
  font-size: 0.75rem;
}

.pc-stats {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr 1fr;
  gap: 8px;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 12px 8px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 10px;
}

.stat-icon {
  font-size: 1.2rem;
}

.stat-label {
  font-size: 0.68rem;
  color: rgba(255, 255, 255, 0.4);
}

.stat-value {
  font-size: 1rem;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.9);
}

.pc-favorites {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.fav-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 8px;
}

.fav-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.fav-title {
  font-size: 0.82rem;
  color: rgba(255, 255, 255, 0.85);
}

.fav-company {
  font-size: 0.7rem;
  color: rgba(255, 255, 255, 0.4);
}

.fav-meta {
  display: flex;
  gap: 10px;
}

.fav-match {
  font-size: 0.78rem;
  font-weight: 600;
  color: #4ade80;
}

.fav-salary {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.5);
}

.pc-loading {
  text-align: center;
  padding: 40px;
  color: rgba(255, 255, 255, 0.4);
}

/* ─── 迷你卡片（画像/建议）─── */
.job-card-mini {
  min-width: 280px;
  max-width: 340px;
  flex-shrink: 0;
  margin: 0;
}

/* ─── 移动端优化 ─── */
@media (max-width: 768px) {
  .job-workspace-main {
    flex-direction: column;
  }

  .job-recommend-panel {
    width: 100%;
    height: 40vh;
    border-left: none;
    border-top: 1px solid rgba(255,255,255,0.04);
  }

  .job-workspace-content {
    flex: 1;
    min-height: 50vh;
  }

  .job-rec-card {
    padding: 10px;
  }

  .rec-breakdown {
    grid-template-columns: 1fr 1fr;
    gap: 3px 8px;
  }
}

@media (max-width: 480px) {
  .job-chat-header h3 {
    font-size: 0.9rem;
  }

  .job-chat-subtitle {
    display: none;
  }

  .rec-actions {
    flex-direction: column;
  }
}
</style>
