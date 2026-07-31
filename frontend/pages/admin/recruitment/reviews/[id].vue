<!-- ⛔ DEPRECATED · 已退出后台导航（SPRINT-ADMIN-IA-RECRUITMENT-CLEANUP-01）· 页面保留仅供 URL 直链/归档，业务数据归企业招聘工作台，运营数据归数据罗盘 -->
<!-- Admin: Human Review 审核详情 -->
<!-- 位置：/admin/recruitment/reviews/[id].vue -->
<!-- 职责：审核详情 + 决策动作（Approve / Reject / Need Info）（P5-ADMIN-04） -->
<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-3">
        <button @click="navigateTo('/admin/recruitment/reviews')" class="text-gray-500 hover:text-white text-sm cursor-pointer bg-transparent border-none">← 返回</button>
        <div>
          <h1 class="text-lg font-semibold text-white/90">审核详情</h1>
          <p class="text-xs text-gray-500 mt-0.5">{{ review?.candidateName || '—' }} · {{ review?.jobPostingTitle || review?.jobTitle || '—' }}</p>
        </div>
      </div>
      <span v-if="review" :class="statusClass(review.status)" class="px-3 py-1 rounded-full text-xs font-medium">{{ statusLabel(review.status) }}</span>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center py-16 text-gray-500 text-sm">
      <div class="animate-spin w-5 h-5 border-2 border-gray-600 border-t-blue-400 rounded-full mr-2"></div>
      加载中...
    </div>

    <!-- Error -->
    <div v-else-if="error" class="bg-red-900/20 border border-red-800/30 rounded-xl p-4 text-red-400 text-xs">
      ⚠️ {{ error }} <button @click="fetchData" class="ml-2 underline cursor-pointer">重试</button>
    </div>

    <template v-else-if="review">
      <!-- Decision Actions (仅 pending 状态显示) -->
      <div v-if="review.status === 'pending'" class="bg-[#0D1328]/60 border border-[#1A2240] rounded-xl p-4">
        <div class="text-xs text-gray-400 mb-3">审核决策</div>
        <div class="flex items-center gap-3">
          <button @click="submitDecision('approved')" :disabled="decisionLoading" class="px-4 py-2 rounded-lg text-xs font-medium bg-green-600/20 text-green-400 hover:bg-green-600/30 disabled:opacity-40 cursor-pointer border-none transition">
            ✅ 通过
          </button>
          <button @click="submitDecision('rejected')" :disabled="decisionLoading" class="px-4 py-2 rounded-lg text-xs font-medium bg-red-600/20 text-red-400 hover:bg-red-600/30 disabled:opacity-40 cursor-pointer border-none transition">
            ❌ 拒绝
          </button>
          <button @click="submitDecision('need_info')" :disabled="decisionLoading" class="px-4 py-2 rounded-lg text-xs font-medium bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 disabled:opacity-40 cursor-pointer border-none transition">
            ℹ️ 需补充信息
          </button>
          <div class="flex-1"></div>
          <div v-if="review.priority >= 3" class="text-yellow-400 text-[10px]">⚠️ 高优先级 P{{ review.priority }}</div>
        </div>
        <!-- Decision Note -->
        <div class="mt-3">
          <textarea
            v-model="decisionNote"
            placeholder="审核备注（可选）..."
            rows="2"
            class="w-full bg-[#0D1328] border border-[#1A2240] rounded-lg text-xs text-gray-300 px-3 py-2 resize-none focus:outline-none focus:border-blue-500/40"
          ></textarea>
        </div>
      </div>

      <!-- Already Decided -->
      <div v-else class="bg-[#0D1328]/40 border border-[#1A2240] rounded-xl p-4">
        <div class="text-xs text-gray-500 mb-2">审核结果</div>
        <div class="flex items-center gap-3 text-xs">
          <span :class="review.decision === 'approved' ? 'text-green-400' : review.decision === 'rejected' ? 'text-red-400' : 'text-blue-400'" class="font-medium">
            {{ review.decision === 'approved' ? '✅ 已通过' : review.decision === 'rejected' ? '❌ 已拒绝' : 'ℹ️ 需补充信息' }}
          </span>
          <span class="text-gray-600">·</span>
          <span class="text-gray-500">{{ formatTime(review.reviewedAt) }}</span>
        </div>
        <div v-if="review.reviewNote" class="mt-2 text-xs text-gray-400 bg-[#0D1328] rounded-lg p-3 border border-[#1A2240]">
          📝 {{ review.reviewNote }}
        </div>
      </div>

      <!-- Score Cards -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div class="bg-[#0D1328]/60 border border-[#1A2240] rounded-xl p-3 text-center">
          <div class="text-lg font-bold" :class="scoreClass(review.matchScore)">{{ review.matchScore ?? '—' }}</div>
          <div class="text-[10px] text-gray-500">匹配分</div>
        </div>
        <div class="bg-[#0D1328]/60 border border-[#1A2240] rounded-xl p-3 text-center">
          <div class="text-lg font-bold" :class="scoreClass(review.overallScore)">{{ review.overallScore ?? '—' }}</div>
          <div class="text-[10px] text-gray-500">综合分</div>
        </div>
        <div class="bg-[#0D1328]/60 border border-[#1A2240] rounded-xl p-3 text-center">
          <div class="text-lg font-bold text-white/90">P{{ review.priority }}</div>
          <div class="text-[10px] text-gray-500">优先级</div>
        </div>
        <div class="bg-[#0D1328]/60 border border-[#1A2240] rounded-xl p-3 text-center">
          <div class="text-lg font-bold text-white/90">{{ review.conversationStage || '—' }}</div>
          <div class="text-[10px] text-gray-500">招聘阶段</div>
        </div>
      </div>

      <!-- AI Recommendation -->
      <div class="bg-[#0D1328]/40 border border-[#1A2240] rounded-xl p-4">
        <div class="text-xs text-gray-500 mb-2">🤖 AI 推荐</div>
        <div class="text-sm text-gray-300">{{ review.aiRecommendation || '—' }}</div>
        <div v-if="review.briefSummary" class="mt-3 pt-3 border-t border-[#1A2240]">
          <div class="text-xs text-gray-500 mb-1">候选人摘要</div>
          <div class="text-xs text-gray-400">{{ review.briefSummary }}</div>
        </div>
      </div>

      <!-- Candidate Brief -->
      <div v-if="review.conversation?.latestBrief" class="bg-[#0D1328]/40 border border-[#1A2240] rounded-xl p-4">
        <div class="text-xs text-gray-500 mb-3">📊 Candidate Brief</div>
        <div class="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
          <div>
            <span class="text-gray-500">姓名：</span>
            <span class="text-gray-300">{{ review.conversation.latestBrief.candidateName || '—' }}</span>
          </div>
          <div>
            <span class="text-gray-500">经验：</span>
            <span class="text-gray-300">{{ review.conversation.latestBrief.experienceYears ? review.conversation.latestBrief.experienceYears + ' 年' : '—' }}</span>
          </div>
          <div>
            <span class="text-gray-500">学历：</span>
            <span class="text-gray-300">{{ review.conversation.latestBrief.education || '—' }}</span>
          </div>
          <div>
            <span class="text-gray-500">城市：</span>
            <span class="text-gray-300">{{ review.conversation.latestBrief.city || '—' }}</span>
          </div>
          <div>
            <span class="text-gray-500">薪资：</span>
            <span class="text-gray-300">{{ salaryRange(review.conversation.latestBrief) }}</span>
          </div>
          <div>
            <span class="text-gray-500">版本：</span>
            <span class="text-gray-300">v{{ review.conversation.latestBrief.version }}</span>
          </div>
        </div>
        <!-- Skills -->
        <div v-if="review.conversation.latestBrief.skills?.length" class="mt-3 pt-3 border-t border-[#1A2240]">
          <div class="text-[10px] text-gray-500 mb-1.5">技能</div>
          <div class="flex flex-wrap gap-1">
            <span v-for="s in review.conversation.latestBrief.skills" :key="s" class="px-2 py-0.5 rounded-full bg-blue-600/10 text-blue-400 text-[10px]">{{ s }}</span>
          </div>
        </div>
        <!-- Strengths & Risks -->
        <div class="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-[#1A2240]">
          <div v-if="review.conversation.latestBrief.strengths?.length">
            <div class="text-[10px] text-green-500 mb-1">✅ 优势</div>
            <div v-for="s in review.conversation.latestBrief.strengths" :key="s" class="text-[10px] text-gray-400">· {{ s }}</div>
          </div>
          <div v-if="review.conversation.latestBrief.risks?.length">
            <div class="text-[10px] text-red-500 mb-1">⚠️ 风险</div>
            <div v-for="r in review.conversation.latestBrief.risks" :key="r" class="text-[10px] text-gray-400">· {{ r }}</div>
          </div>
        </div>
        <!-- AI Summary -->
        <div v-if="review.conversation.latestBrief.aiSummary" class="mt-3 pt-3 border-t border-[#1A2240]">
          <div class="text-[10px] text-gray-500 mb-1">AI 总结</div>
          <div class="text-xs text-gray-400">{{ review.conversation.latestBrief.aiSummary }}</div>
        </div>
      </div>

      <!-- Pipeline Events -->
      <div v-if="review.conversation?.pipeline?.events?.length" class="bg-[#0D1328]/40 border border-[#1A2240] rounded-xl p-4">
        <div class="text-xs text-gray-500 mb-3">📝 Pipeline 事件流</div>
        <div class="space-y-2">
          <div v-for="evt in review.conversation.pipeline.events" :key="evt.id" class="flex items-start gap-3 text-xs">
            <div class="text-gray-600 whitespace-nowrap min-w-[100px]">{{ formatTime(evt.createdAt) }}</div>
            <div class="flex-1">
              <span class="text-gray-300 font-medium">{{ evt.type }}</span>
              <span v-if="evt.fromStage && evt.toStage" class="text-gray-500 ml-2">{{ evt.fromStage }} → {{ evt.toStage }}</span>
            </div>
            <div class="text-gray-600">{{ evt.actor }}</div>
          </div>
        </div>
      </div>

      <!-- Conversation Context -->
      <div class="bg-[#0D1328]/40 border border-[#1A2240] rounded-xl p-4">
        <div class="text-xs text-gray-500 mb-3">🔗 会话上下文</div>
        <div class="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
          <div>
            <span class="text-gray-500">会话 ID：</span>
            <span class="text-gray-300 font-mono text-[10px]">{{ review.conversationId?.slice(0, 8) || '—' }}</span>
          </div>
          <div>
            <span class="text-gray-500">会话状态：</span>
            <span class="text-gray-300">{{ review.conversationStatus || '—' }}</span>
          </div>
          <div>
            <span class="text-gray-500">提交时间：</span>
            <span class="text-gray-300">{{ formatTime(review.submittedAt) }}</span>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admin-aigc' })
import { getAuthToken } from '~/utils/auth/token'
const route = useRoute()
const loading = ref(false)
const error = ref('')
const review = ref<any>(null)
const decisionLoading = ref(false)
const decisionNote = ref('')

const reviewId = computed(() => route.params.id as string)

async function fetchData() {
  loading.value = true
  error.value = ''
  try {
    const res = await fetch(`/api/admin/recruitment/reviews/${reviewId.value}`, {
      headers: { 'Authorization': `Bearer ${getAuthToken() || ''}` },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    review.value = await res.json()
  } catch (e: any) {
    error.value = e.message || '加载失败'
  } finally {
    loading.value = false
  }
}

async function submitDecision(decision: string) {
  decisionLoading.value = true
  try {
    const res = await fetch(`/api/admin/recruitment/reviews/${reviewId.value}/decision`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAuthToken() || ''}`,
      },
      body: JSON.stringify({ decision, note: decisionNote.value || undefined }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || `HTTP ${res.status}`)
    }
    // 刷新数据
    await fetchData()
  } catch (e: any) {
    error.value = e.message || '提交失败'
  } finally {
    decisionLoading.value = false
  }
}

function statusLabel(status: string): string {
  const map: Record<string, string> = { pending: '待审核', approved: '已通过', rejected: '已拒绝', need_info: '需补充' }
  return map[status] || status
}

function statusClass(status: string): string {
  const map: Record<string, string> = {
    pending: 'bg-yellow-500/10 text-yellow-400',
    approved: 'bg-green-500/10 text-green-400',
    rejected: 'bg-red-500/10 text-red-400',
    need_info: 'bg-blue-500/10 text-blue-400',
  }
  return map[status] || 'bg-gray-500/10 text-gray-400'
}

function scoreClass(score: number | null): string {
  if (score == null) return 'text-gray-600'
  if (score >= 70) return 'text-green-400'
  if (score >= 50) return 'text-yellow-400'
  return 'text-red-400'
}

function salaryRange(brief: any): string {
  if (brief.salaryMin && brief.salaryMax) return `${brief.salaryMin}-${brief.salaryMax}K`
  if (brief.salaryMin) return `${brief.salaryMin}K+`
  if (brief.salaryMax) return `≤${brief.salaryMax}K`
  return '—'
}

function formatTime(t: string): string {
  if (!t) return '—'
  const d = new Date(t)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`
  return d.toLocaleDateString('zh-CN')
}

onMounted(fetchData)
</script>
