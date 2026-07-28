<!-- EmployeeProfilePage.vue — AI 员工主页容器 -->
<!-- 聚合所有 Profile Section，调用 Profile API -->
<template>
  <div class="employee-profile-page">
    <!-- Loading -->
    <div v-if="loading" class="profile-loading">
      <div class="profile-spinner"></div>
      <span>加载员工档案中...</span>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="profile-error">
      <span class="error-icon">⚠️</span>
      <p>{{ error }}</p>
      <button @click="fetchProfile" class="retry-btn">重试</button>
    </div>

    <!-- Profile Content -->
    <template v-else-if="profile">
      <!-- 身份区 -->
      <EmployeeIdentity
        :name="profile.name"
        :avatar-url="profile.avatarUrl"
        :bio="profile.bio"
        :role="profile.role"
        :agent-type="profile.agentType"
        :status="profile.status"
        :runtime-status="profile.runtimeStatus"
        :trust-score="profile.trustScore"
        :consecutive-days="profile.consecutiveWorkDays"
        :total-executions="profile.totalExecutions"
        :human-corrections="profile.humanCorrections"
        :last-active-at="profile.lastActiveAt"
        :working-hours="profile.workingHours"
      />

      <!-- 职责区 -->
      <EmployeeRole
        :role="profile.role"
        :goal="profile.goal"
        :today-target="profile.todayTarget"
        :today-completed="profile.todayCompleted"
        :today-tasks="profile.todayTasks"
      />

      <!-- 技能区 -->
      <EmployeeCapability :capabilities="profile.capabilities" />

      <!-- 知识库区 -->
      <EmployeeKnowledge :knowledge="profile.knowledgeScope" />

      <!-- 工具权限区 -->
      <EmployeeTools
        :tools="profile.tools"
        :permissions="profile.permissions"
      />

      <!-- 贡献趋势 (ER-02-TASK-02) -->
      <ContributionTimeline
        :timeline="profile.contributionTimeline"
      />

      <!-- 历史成果 (ER-02-TASK-02) -->
      <HistoricalOutcomes
        :total="profile.historicalOutcomes.total"
        :outcomes="profile.historicalOutcomes.items"
      />

      <!-- 成长记录 (ER-02-TASK-02) -->
      <GrowthRecord
        :items="profile.growthRecord.items"
      />

      <!-- CEO 指令 (ER-02-TASK-02) -->
      <CEOCommandContext
        :manager-note="profile.ceoCommandContext.managerNote"
        :last-updated="profile.ceoCommandContext.lastUpdated"
      />
    </template>

    <!-- Not Found -->
    <div v-else class="profile-not-found">
      <span class="not-found-icon">🤖</span>
      <p>未找到该 AI 员工</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { getAuthToken } from '~/utils/auth/token'
import { ref, onMounted } from 'vue'
import EmployeeIdentity from './EmployeeIdentity.vue'
import EmployeeRole from './EmployeeRole.vue'
import EmployeeCapability from './EmployeeCapability.vue'
import EmployeeKnowledge from './EmployeeKnowledge.vue'
import EmployeeTools from './EmployeeTools.vue'
import ContributionTimeline from './ContributionTimeline.vue'
import HistoricalOutcomes from './HistoricalOutcomes.vue'
import GrowthRecord from './GrowthRecord.vue'
import CEOCommandContext from './CEOCommandContext.vue'

// ─── Types ───────────────────────────────────────────────
interface TodayTaskItem {
  action: string
  resource: string
  time: string
  status: string
}

interface EmployeeProfile {
  id: string
  name: string
  avatarUrl: string | null
  bio: string | null
  role: string
  agentType: string
  goal: string | null
  personality: string | null
  status: string
  runtimeStatus: string
  lastActiveAt: string | null
  workingHours: string | null
  capabilities: string[]
  knowledgeScope: string[]
  tools: string[]
  permissions: string[]
  trustScore: number
  consecutiveWorkDays: number
  totalExecutions: number
  humanCorrections: number
  todayTarget: number
  todayCompleted: number
  todayTasks: TodayTaskItem[]
  contributionSummary: {
    totalOutcomes: number
    totalRevenue: string | null
    topOutcome: string | null
  }
  managerNote: string | null

  // ER-02-TASK-02: Profile Depth
  contributionTimeline: {
    period: string
    data: { date: string; count: number }[]
    total: number
    peak: { date: string; count: number }
  }
  historicalOutcomes: {
    total: number
    items: {
      id: string
      type: string
      description: string
      createdAt: string
      impactValue: string | null
      impactType: string | null
    }[]
  }
  growthRecord: {
    items: {
      date: string
      event: string
      detail: string
    }[]
  }
  ceoCommandContext: {
    managerNote: string | null
    lastUpdated: string | null
  }
}

// ─── Props ───────────────────────────────────────────────
const props = defineProps<{
  agentId: string
}>()

// ─── State ───────────────────────────────────────────────
const loading = ref(true)
const error = ref<string | null>(null)
const profile = ref<EmployeeProfile | null>(null)

// ─── Data Fetching ───────────────────────────────────────
async function fetchProfile() {
  loading.value = true
  error.value = null

  try {
    const token = getAuthToken() || ''
    const res = await fetch(`/api/enterprise/agent-profiles/${props.agentId}/profile`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })

    if (res.ok) {
      const json = await res.json()
      if (json.code === 0 && json.data) {
        profile.value = json.data
      } else {
        error.value = json.message || '加载失败'
      }
    } else if (res.status === 404) {
      error.value = '未找到该 AI 员工'
    } else {
      error.value = `服务器错误 (${res.status})`
    }
  } catch (e: any) {
    error.value = '网络连接失败'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchProfile()
})
</script>

<style scoped>
.employee-profile-page {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg, 24px);
}

/* Loading */
.profile-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 60px 0;
  color: rgba(255, 255, 255, 0.5);
  font-size: 14px;
}

.profile-spinner {
  width: 24px;
  height: 24px;
  border: 3px solid rgba(255, 255, 255, 0.1);
  border-top-color: #3B82F6;
  border-radius: 50%;
  animation: profile-spin 1s linear infinite;
}

@keyframes profile-spin {
  to { transform: rotate(360deg); }
}

/* Error */
.profile-error,
.profile-not-found {
  text-align: center;
  padding: 60px 20px;
  color: rgba(255, 255, 255, 0.6);
}

.error-icon,
.not-found-icon {
  font-size: 40px;
  display: block;
  margin-bottom: 12px;
}

.profile-error p,
.profile-not-found p {
  font-size: 14px;
  margin-bottom: 16px;
}

.retry-btn {
  padding: 8px 20px;
  background: #3B82F6;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
}

.retry-btn:hover {
  background: #2563EB;
}
</style>
