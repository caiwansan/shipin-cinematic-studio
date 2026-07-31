<template>
  <div class="job-workspace-layout">
    <!-- 主体：左栏求职顾问 + 右栏镜心 + 推荐 -->
    <div class="job-workspace-main">
      <!-- 左栏：🧠 求职顾问聊天 -->
      <div class="job-workspace-content">
        <div class="job-chat-panel">
          <!-- 聊天头部 -->
          <div class="job-chat-header">
            <div class="chat-title-row">
              <h3>🧠 求职顾问</h3>
              <span class="chat-badge chat-badge-platform">公共职业咨询 AI · 所有登录用户可用</span>
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
        <!-- 🪞 镜心 · AI职业伙伴（Agent 摘要卡片）-->
        <div class="mirror-card">
          <div class="mirror-card-header">
            <span class="mirror-icon">🪞</span>
            <span class="mirror-title">镜心 · AI 职业伙伴</span>
            <span class="mirror-badge" v-if="careerAgentStatus?.hasActiveSubscription">已订阅</span>
          </div>
          <p class="mirror-desc">认识自己 · 规划方向 · 发现机会 · 提升竞争力</p>

          <!-- 加载中 -->
          <div v-if="careerAgentLoading" class="mirror-loading">加载中...</div>

          <!-- 未订阅：显示开通引导 -->
          <div v-else-if="showPurchaseCard" class="mirror-purchase">
            <div class="mirror-price">
              <span class="mirror-price-amount">¥9.9</span>
              <span class="mirror-price-cycle">/月</span>
            </div>
            <button class="mirror-purchase-btn" @click="handlePurchase">立即开通</button>
          </div>

          <!-- 已订阅未创建 Agent：显示创建按钮 -->
          <div v-else-if="!hasCareerAgent" class="mirror-create">
            <button class="ca-create-btn" @click="handleCreateAgent" :disabled="careerAgentCreating">
              {{ careerAgentCreating ? '创建中...' : '+ 创建我的镜心助理' }}
            </button>
          </div>

          <!-- Sprint-10 Step 4A: 首次使用 → 先授权，后任务 -->
          <div v-else-if="isFirstRun" class="mirror-firstrun">
            <div v-if="showAuthTaskButton" class="mirror-auth-section">
              <p class="mirror-firstrun-intro">我是你的职业 AI 助理</p>
              <p class="mirror-auth-desc">第一步：授权我持续关注匹配你方向的岗位机会</p>
              <button class="mirror-auth-btn" @click="handleAuthorizeJobWatch" :disabled="authorizingJobWatch">
                {{ authorizingJobWatch ? '授权中...' : '🔍 授权关注岗位机会' }}
              </button>
              <button class="mirror-auth-skip" @click="showAuthTaskButton = false">暂不授权，先聊聊</button>
            </div>
            <div v-else>
              <p class="mirror-firstrun-intro">欢迎回来，我可以帮你：</p>
              <div class="mirror-actions">
                <button class="ca-firstrun-btn" @click="handleFirstRunTask('profile_extraction')">📊 分析我的职业优势</button>
                <button class="ca-firstrun-btn" @click="handleFirstRunTask('resume_optimize')">📝 优化我的简历</button>
                <button class="ca-firstrun-btn" @click="handleFirstRunTask('career_planning')">🎯 规划职业方向</button>
                <button class="ca-firstrun-btn" @click="handleFirstRunTask('interview_coach')">🗣️ 准备面试</button>
              </div>
              <button class="ca-firstrun-start" @click="handleFirstRunTask('profile_extraction')">开始第一次职业分析 →</button>
            </div>
          </div>

          <!-- 已创建：状态 + 快捷操作 -->
          <div v-else class="mirror-active">
            <div class="mirror-status">
              <span class="ca-compact-status" :class="careerAgentStatus?.status">{{ getStatusText(careerAgentStatus?.status) }}</span>
              <span class="mirror-agent-name">{{ careerAgent?.name || '镜心 · AI 职业伙伴' }}</span>
            </div>
            <div class="mirror-model">
              <span class="mirror-label">模型</span>
              <ModelSettingsLauncher capability="llm" />
            </div>
            <div class="mirror-quick">
              <span class="mirror-label">快捷任务</span>
              <div class="mirror-quick-actions">
                <button class="ca-action-btn" @click="handleExecuteWorkflow('resume_analyze')">📊 分析简历</button>
                <button class="ca-action-btn" @click="handleExecuteWorkflow('job_search')">🔍 推荐岗位</button>
                <button class="ca-action-btn" @click="handleExecuteWorkflow('interview_prepare')">🎯 准备面试</button>
                <button class="ca-action-btn" @click="handleExecuteWorkflow('career_plan')">📋 职业规划</button>
              </div>
            </div>
          </div>
        </div>

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
import { getCareerAgentStatus, activateAndExecuteCareerAgent, executeCareerWorkflow, toBackendWorkflowType, type CareerAgentStatus, type CareerWorkflowResult } from '~/studio-v2/api/job/career-agent-api'
import ModelSettingsLauncher from '~/components/ai-model/ModelSettingsLauncher.vue'

const activeStageId = ref<string>('job-career')
const caExpanded = ref(false)
const chatInput = ref('')
const isLoading = ref(false)
const messages = ref<Array<{ role: 'user' | 'assistant'; content: string }>>([])
const messagesRef = ref<HTMLElement | null>(null)
const welcomeMessage = ref('你好！我是求职顾问 🧠\n\n我会通过几个问题了解你的情况，帮你发现最适合的职业机会。\n\n先告诉我，你希望我怎么称呼你？')

// ─── Sprint-03C: Career Agent 真实状态 ───
const careerAgentStatus = ref<CareerAgentStatus | null>(null)
const careerAgentLoading = ref(false)
const careerAgentCreating = ref(false)
const careerAgentError = ref('')

const careerAgent = computed(() => careerAgentStatus.value?.agent || null)
const hasCareerAgent = computed(() => careerAgentStatus.value?.hasAgent || false)
const careerAgentCapabilities = computed(() => careerAgent.value?.tools || [])

// Sprint-09C-2: 首次使用判断
const isFirstRun = computed(() => {
  return hasCareerAgent.value && (careerAgentStatus.value?.stats?.totalTasks || 0) === 0
})

// Sprint-09C-2: 已完成任务价值摘要
const careerTaskSummary = computed(() => {
  const stats = careerAgentStatus.value?.stats
  if (!stats || stats.totalTasks === 0) return null
  const items: Array<{ label: string }> = []
  if (stats.completedTasks > 0) {
    items.push({ label: `完成 ${stats.completedTasks} 个职业分析任务` })
  }
  const tasks = careerAgentStatus.value?.recentTasks || []
  const types = new Set(tasks.filter(t => t.status === 'completed').map(t => t.taskType))
  if (types.has('profile_extraction') || types.has('career_planning') || types.has('profile_analysis')) {
    items.push({ label: '完成职业画像分析' })
  }
  if (types.has('resume_optimize') || types.has('resume_analyze')) {
    items.push({ label: '完成简历分析' })
  }
  if (types.has('interview_coach') || types.has('interview_prepare')) {
    items.push({ label: '完成面试准备指导' })
  }
  if (items.length >= 3) {
    items.push({ label: '发现多个职业发展匹配方向（查看详情）' })
  }
  return items.length > 0 ? items : null
})

// ─── Sprint-09C-1: 购买流程 ───
const showPurchaseCard = ref(false)
const showAuthTaskButton = ref(false)
const authorizingJobWatch = ref(false)
const purchasing = ref(false)
const purchaseError = ref('')
const purchaseOrderNo = ref('')
const selectedMethod = ref('alipay')
const purchaseMethod = ref('')
const purchasePaymentUrl = ref('')
const purchaseQrCode = ref('')

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
    // F1: 支付完成后自动从购买卡片切换到创建状态
    if (status.hasActiveSubscription && !status.hasAgent) {
      showPurchaseCard.value = false
    }
    // Task 01: 未订阅用户自动显示购买引导
    if (!status.hasActiveSubscription && !status.hasAgent) {
      showPurchaseCard.value = true
    }
  } catch (err: any) {
    careerAgentError.value = err.message || '加载 Career Agent 状态失败'
    careerAgentStatus.value = { hasAgent: false, status: 'error', stats: { totalTasks: 0, completedTasks: 0, failedTasks: 0 }, recentTasks: [], message: err.message }
  } finally {
    careerAgentLoading.value = false
  }
}

// Sprint-10 Step 4A Task 02: 基于身份构建欢迎消息（Confirmed Facts Only）
function buildWelcomeMessage(identity: { hasProfile: boolean; name?: string; experience?: string; direction?: string; skills?: string[] }): string {
  if (!identity.hasProfile) {
    return `🪞 你好，我是你的职业 AI 助理。

我已经准备就绪，可以帮你关注职业机会、分析岗位匹配、规划发展方向。

让我们开始吧 — 点击下方按钮授权我为你关注岗位？`
  }
  const lines: string[] = ['🪞 ' + identity.name + '你好，我是你的职业 AI 助理。']
  lines.push('')
  lines.push('我已经了解你的职业背景：')
  if (identity.experience) lines.push('- ' + identity.experience)
  if (identity.direction) lines.push('- ' + identity.direction + ' 方向')
  if (identity.skills && identity.skills.length > 0) {
    lines.push('- 核心能力: ' + identity.skills.slice(0, 4).join(' / '))
  }
  lines.push('')
  lines.push('我可以帮你：')
  lines.push('1. 持续关注匹配你方向的机会')
  lines.push('2. 分析岗位与你的匹配度')
  lines.push('3. 规划成长路线，准备面试')
  lines.push('')
  lines.push('是否授权我开始关注 ' + (identity.direction || '你方向') + ' 的岗位机会？')
  return lines.join('\n')
}

async function handleCreateAgent() {
  careerAgentCreating.value = true
  careerAgentError.value = ''
  showPurchaseCard.value = false
  try {
    const result = await activateAndExecuteCareerAgent({
      goal: '帮助用户进行求职规划、简历分析、岗位匹配',
    })
    // Sprint-10 Step 4A Task 02: 身份感知欢迎消息
    const identity = result.identity || { hasProfile: false }
    const welcomeMsg = buildWelcomeMessage(identity)
    messages.value.push({ role: 'assistant', content: welcomeMsg })

    // 重新加载状态（触发 firstRun state）
    await loadCareerAgentStatus()

    // 标记需要展示授权任务按钮（Task 03）
    showAuthTaskButton.value = true
  } catch (err: any) {
    // Sprint-09C-1: 权益引导 → 购买卡片
    if (err.action === 'purchase_career_agent') {
      showPurchaseCard.value = true
      careerAgentError.value = ''
    } else if (err.code === 'EXECUTION_FAILED' || err.retryable) {
      // Sprint-09C-3-2 Task 02: 平台模型异常 → 友好提示
      const userMsg = err.message || '镜心暂时繁忙，AI模型服务暂时不可用'
      messages.value.push({
        role: 'assistant',
        content: `${userMsg}

[重新分析] 点击发送按钮重新尝试`,
      })
      careerAgentError.value = ''
    } else {
      careerAgentError.value = err.message || '创建 Career Agent 失败'
    }
  } finally {
    careerAgentCreating.value = false
  }
}

// Sprint-10 Step 4A Task 03: 用户授权关注岗位（最小自治任务）
async function handleAuthorizeJobWatch() {
  if (authorizingJobWatch.value) return
  authorizingJobWatch.value = true
  try {
    const { getToken } = await import('~/utils/token-cache')
    const token = getToken()
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }
    // Step 1: 创建任务
    const createRes = await fetch('/api/career/agent/task', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        taskType: 'job_watch',
        instruction: '帮我关注 AI Agent 方向的岗位机会',
      }),
    })
    if (!createRes.ok) throw new Error('创建任务失败')
    const createData = await createRes.json()
    const taskId = createData.data?.taskId
    if (!taskId) throw new Error('未获取到任务 ID')

    // Step 2: 执行任务
    const execRes = await fetch(`/api/career/agent/task/${taskId}/execute`, {
      method: 'POST',
      headers,
    })
    if (!execRes.ok) throw new Error('执行任务失败')
    const execData = await execRes.json()

    // Step 3: 通知用户
    if (execData.data?.status === 'completed') {
      messages.value.push({
        role: 'assistant',
        content: `✅ 已授权关注 AI Agent 方向的岗位机会。

我会持续关注匹配的岗位，下次你回来时可以查看进展。`,
      })
      showAuthTaskButton.value = false
    } else {
      messages.value.push({
        role: 'assistant',
        content: `任务已完成，但结果有待确认。你可以继续向我提问。`,
      })
    }
  } catch (err: any) {
    messages.value.push({
      role: 'assistant',
      content: `授权关注岗位时遇到问题：${err.message}

你可以在聊天中直接告诉我你的方向，我来帮你分析。`,
    })
  } finally {
    authorizingJobWatch.value = false
  }
}
// Sprint-09C-1 Task 01: 发起镜心购买
async function handlePurchase() {
  purchasing.value = true
  purchaseError.value = ''
  try {
    const { getToken } = await import('~/utils/token-cache')
    const token = getToken()
    const res = await fetch('/api/payment/career/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ method: selectedMethod.value }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: '创建订单失败' }))
      throw new Error(err.error || err.message)
    }
    const data = await res.json()
    purchaseOrderNo.value = data.orderNo
    purchaseMethod.value = data.method || ''
    purchasePaymentUrl.value = data.paymentUrl || ''
    purchaseQrCode.value = data.qrCode || ''

    // 支付宝支付：自动打开支付页面
    if (data.method === 'alipay' && data.paymentUrl) {
      window.open(data.paymentUrl, '_blank')
    }
  } catch (err: any) {
    purchaseError.value = err.message || '创建订单失败，请稍后重试'
  } finally {
    purchasing.value = false
  }
}

// Sprint-09C-2.1: 首次引导任务
async function handleFirstRunTask(workflowType: string) {
  // 执行任务（无特殊处理，直接复用 handleExecuteWorkflow）
  await handleExecuteWorkflow(workflowType)
}

async function handleExecuteWorkflow(workflowType: string) {
  if (!hasCareerAgent.value) {
    await handleCreateAgent()
    return
  }

  // 映射前端按钮类型 → 后端 Workflow 类型
  const backendType = toBackendWorkflowType(workflowType)

  // 第一行：加载提示（后面会被替换）
  const loadingIdx = messages.value.length
  messages.value.push({ role: 'assistant', content: `🪞 镜心正在分析你的职业优势...` })
  await scrollToBottom()

  try {
    const result = await executeCareerWorkflow(backendType)

    // 替换加载消息为结果
    if (result.status === 'failed') {
      messages.value[loadingIdx] = {
        role: 'assistant',
        content: `🪞 镜心这次没有完成分析。\n\n服务暂时不可用，请稍后重新尝试。`,
      }
    } else {
      // 组装用户语言展示
      const displayLines: string[] = []
      displayLines.push('🪞 镜心职业分析完成')
      displayLines.push('')

      // 核心发现
      if (result.output?.findings?.length) {
        displayLines.push('我发现：')
        for (const finding of result.output.findings.slice(0, 4)) {
          displayLines.push(`  ${finding.type === 'opportunity' ? '📈' : finding.type === 'warning' ? '⚠️' : '💡'} ${finding.content}`)
        }
        displayLines.push('')
      }

      // 建议行动（取前3条）
      if (result.output?.actions?.length) {
        displayLines.push('下一步可以这样做：')
        for (const action of result.output.actions.slice(0, 3)) {
          displayLines.push(`  • ${action.action} — ${action.target}`)
        }
        displayLines.push('')
      }

      // 执行摘要（steps 简要）
      if (result.steps?.length) {
        const done = result.steps.filter(s => s.result === 'success').length
        const total = result.steps.length
        displayLines.push(`分析覆盖 ${total} 个方向（已完成 ${done}/${total}）`)
      }

      messages.value[loadingIdx] = {
        role: 'assistant',
        content: displayLines.join('\n'),
      }
    }

    // 刷新状态，更新 stats
    await loadCareerAgentStatus()
  } catch (err: any) {
    // Sprint-09C-3-2 风格：友好错误
    messages.value[loadingIdx] = {
      role: 'assistant',
      content: `🪞 镜心这次没有完成分析。\n\n服务暂时不可用，请稍后重新尝试。`,
    }
    await loadCareerAgentStatus()
  }

  await scrollToBottom()
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
      const welcome = data.welcome || '你好！我是镜心，你的 AI 职业伙伴 🪞\n\n我会通过几个问题了解你的情况，帮你发现最适合的职业机会。\n\n先告诉我，你希望我怎么称呼你？'
      messages.value.push({ role: 'assistant', content: welcome })
      welcomeMessage.value = welcome
    } catch {
      messages.value.push({ role: 'assistant', content: welcomeMessage.value })
    }
  }

  // Sprint-03C: 加载 Career Agent 真实状态
  await loadCareerAgentStatus()

  // F1: 监听页面可见性变化 — 用户从支付宝/微信返回后自动检查支付状态
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && showPurchaseCard.value) {
      loadCareerAgentStatus()
    }
  })

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

/* 🪞 镜心 · AI职业伙伴 卡片 */
.mirror-card {
  padding: 16px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  flex-shrink: 0;
}

.mirror-card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.mirror-icon {
  font-size: 1.3rem;
}

.mirror-title {
  font-size: 0.9rem;
  font-weight: 600;
  color: rgba(255,255,255,0.9);
}

.mirror-badge {
  font-size: 0.65rem;
  padding: 2px 8px;
  border-radius: 10px;
  background: rgba(74,222,128,0.15);
  color: #4ade80;
  border: 1px solid rgba(74,222,128,0.25);
  margin-left: auto;
}

.mirror-desc {
  font-size: 0.75rem;
  color: rgba(255,255,255,0.4);
  margin: 0 0 12px;
}

.mirror-loading {
  font-size: 0.78rem;
  color: rgba(255,255,255,0.4);
  padding: 8px 0;
}

.mirror-purchase {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0;
}

.mirror-price-amount {
  font-size: 1.2rem;
  font-weight: 700;
  color: #c9a86c;
}

.mirror-price-cycle {
  font-size: 0.7rem;
  color: rgba(255,255,255,0.4);
}

.mirror-purchase-btn {
  padding: 8px 20px;
  font-size: 0.8rem;
  font-weight: 600;
  background: linear-gradient(135deg, #C9A86C, #E2C88A);
  color: #08131F;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;
}

.mirror-purchase-btn:hover {
  box-shadow: 0 4px 12px rgba(201,168,108,0.3);
}

.mirror-create {
  padding: 8px 0;
}

.mirror-firstrun {
  padding: 4px 0;
}

.mirror-firstrun-intro {
  font-size: 0.8rem;
  color: rgba(255,255,255,0.6);
  margin: 0 0 8px;
}

/* Sprint-10 Step 4A: 授权关注按钮 */
.mirror-auth-section {
  text-align: center;
  padding: 8px 0;
}
.mirror-auth-desc {
  font-size: 0.75rem;
  color: rgba(255,255,255,0.5);
  margin: 0 0 10px;
}
.mirror-auth-btn {
  display: block;
  width: 100%;
  padding: 10px 12px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s;
}
.mirror-auth-btn:hover { opacity: 0.9; transform: translateY(-1px); }
.mirror-auth-btn:disabled { opacity: 0.5; cursor: wait; }
.mirror-auth-skip {
  display: inline-block;
  margin-top: 8px;
  padding: 4px 12px;
  background: transparent;
  color: rgba(255,255,255,0.4);
  border: 1px solid rgba(255,255,255,0.15);
  border-radius: 6px;
  font-size: 0.7rem;
  cursor: pointer;
  transition: color 0.2s;
}
.mirror-auth-skip:hover { color: rgba(255,255,255,0.7); border-color: rgba(255,255,255,0.3); }

.mirror-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
  }

.mirror-active {
  padding: 4px 0;
}

.mirror-status {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.mirror-agent-name {
  font-size: 0.82rem;
  color: rgba(255,255,255,0.8);
}

.mirror-model {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.mirror-label {
  font-size: 0.68rem;
  color: rgba(255,255,255,0.4);
  flex-shrink: 0;
  width: 50px;
}

.mirror-quick {
  padding: 4px 0;
}

.mirror-quick-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 6px;
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

/* ─── Sprint-09C-1: 购买卡片 ─── */
.ca-purchase {
  padding: 8px 0;
}

.ca-purchase-card {
  background: linear-gradient(135deg, #1a1a3e 0%, #0d1117 100%);
  border: 1px solid rgba(139, 92, 246, 0.2);
  border-radius: 8px;
  padding: 12px 16px;
}

.ca-purchase-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.ca-purchase-icon {
  font-size: 1.3rem;
}

.ca-purchase-title {
  font-size: 0.95rem;
  font-weight: 600;
  color: #e2e8f0;
}

.ca-purchase-desc {
  font-size: 0.8rem;
  color: #94a3b8;
  margin-bottom: 8px;
}

.ca-purchase-capabilities {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
  margin-bottom: 10px;
}

.ca-purchase-capabilities span {
  font-size: 0.78rem;
  color: #a5b4fc;
}

.ca-purchase-methods {
  display: flex;
  gap: 6px;
  justify-content: center;
  margin-top: 8px;
  margin-bottom: 8px;
}

.ca-method-btn {
  padding: 4px 14px;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  background: #fff;
  color: #475569;
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 0.15s;
}

.ca-method-btn.active {
  border-color: #6366f1;
  background: #eef2ff;
  color: #6366f1;
  font-weight: 500;
}

.ca-method-btn:hover {
  border-color: #a5b4fc;
}

.ca-purchase-price {
  display: flex;
  align-items: baseline;
  gap: 4px;
  margin-bottom: 4px;
}

.ca-price-amount {
  font-size: 1.5rem;
  font-weight: 700;
  color: #fbbf24;
}

.ca-price-cycle {
  font-size: 0.8rem;
  color: #94a3b8;
}

.ca-purchase-btn {
  width: 100%;
  padding: 8px 16px;
  background: linear-gradient(135deg, #7c3aed, #6366f1);
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s;
}

.ca-purchase-btn:hover:not(:disabled) {
  opacity: 0.9;
}

.ca-purchase-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.ca-purchase-retry {
  margin-top: 6px;
  font-size: 0.78rem;
  color: #6366f1;
  background: none;
  border: none;
  cursor: pointer;
}

.ca-purchase-error {
  margin-top: 6px;
  font-size: 0.78rem;
  color: #ef4444;
}

.ca-purchase-success {
  margin-top: 8px;
  font-size: 0.78rem;
  color: #22c55e;
  line-height: 1.5;
}

.ca-purchase-payment {
  margin-top: 12px;
  text-align: center;
  padding: 12px;
  background: #f8fafc;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
}

.ca-payment-header {
  font-weight: 600;
  font-size: 0.9rem;
  color: #1e293b;
  margin-bottom: 6px;
}

.ca-payment-order {
  font-size: 0.75rem;
  color: #94a3b8;
  margin-bottom: 10px;
}

.ca-payment-btn-alipay {
  display: inline-block;
  padding: 10px 24px;
  background: #1677ff;
  color: #fff;
  border-radius: 6px;
  font-size: 0.9rem;
  text-decoration: none;
  font-weight: 500;
  margin-bottom: 8px;
}

.ca-payment-btn-alipay:hover {
  background: #4096ff;
}

.ca-payment-qrcode {
  width: 160px;
  height: 160px;
  display: block;
  margin: 0 auto 8px;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
}

.ca-payment-hint {
  font-size: 0.75rem;
  color: #94a3b8;
  margin-top: 4px;
}

.ca-check-status-btn {
  display: inline-block;
  margin-top: 4px;
  font-size: 0.78rem;
  color: #6366f1;
  background: none;
  border: none;
  cursor: pointer;
  text-decoration: underline;
}

/* Sprint-09C-2.1: 首次引导卡片 */
.ca-firstrun {
  padding: 12px 16px;
}

.ca-firstrun-card {
  background: linear-gradient(135deg, #1e1b4b 0%, #0f172a 100%);
  border: 1px solid #312e81;
  border-radius: 12px;
  padding: 20px;
  text-align: center;
}

.ca-firstrun-header {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-bottom: 8px;
}

.ca-firstrun-icon {
  font-size: 1.6rem;
}

.ca-firstrun-title {
  font-size: 1.1rem;
  font-weight: 700;
  color: #e0e7ff;
}

.ca-firstrun-intro {
  font-size: 0.9rem;
  color: #a5b4fc;
  margin-bottom: 14px;
}

.ca-firstrun-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
  margin-bottom: 14px;
}

.ca-firstrun-btn {
  padding: 8px 16px;
  background: rgba(99, 102, 241, 0.15);
  border: 1px solid rgba(99, 102, 241, 0.3);
  border-radius: 8px;
  color: #c7d2fe;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}

.ca-firstrun-btn:hover {
  background: rgba(99, 102, 241, 0.3);
  border-color: #6366f1;
  color: #e0e7ff;
}

.ca-firstrun-start {
  display: inline-block;
  padding: 10px 24px;
  background: #6366f1;
  border: none;
  border-radius: 8px;
  color: #fff;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}

.ca-firstrun-start:hover {
  background: #4f46e5;
}

/* Sprint-09C-2.2: 价值卡片 */
.ca-value-card {
  background: rgba(34, 197, 94, 0.06);
  border: 1px solid rgba(34, 197, 94, 0.2);
  border-radius: 8px;
  padding: 12px 14px;
  margin: 8px 12px;
}

.ca-value-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
}

.ca-value-icon {
  font-size: 1rem;
}

.ca-value-title {
  font-size: 0.85rem;
  font-weight: 600;
  color: #86efac;
}

.ca-value-items {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.ca-value-item {
  font-size: 0.82rem;
  color: #bbf7d0;
  display: flex;
  align-items: center;
  gap: 6px;
}

.ca-value-check {
  font-size: 0.78rem;
}

.ca-value-footer {
  display: flex;
  gap: 6px;
  margin-top: 10px;
  flex-wrap: wrap;
}
</style>
