<script setup lang="ts">
/**
 * GeoOverview.vue — Brand Health Report (v1.1 Product Polish)
 * RC1.1: Single Source of Truth — topIssueList/topPick from pipeline, not independent signals.
 *
 * Reading order (frozen):
 *   This Week's Top Pick → Progress → Executive Summary → Overall Score
 *   → Five Dimensions → Top Issues → Recommended Actions → AI Visibility → CTAs
 */

import { ref, watch, computed } from 'vue'
import Badge from '~/components/kmki-ui/Badge/index.vue'
import ExplainPanel from '~/components/kmki-ui/ExplainPanel/index.vue'
import { useActionPipeline } from './composables/useActionPipeline'

const props = defineProps<{ projectId: string | null }>()
const emit = defineEmits<{ navigate: [tab: string] }>()

// ── Types ──
interface ScoreDetailItem {
  label: string
  status: 'good' | 'neutral' | 'bad'
  reason: string
  points: number
  maxPoints: number
}

interface ScoreDimension {
  score: number
  details: ScoreDetailItem[]
}

interface ScoreExplainability {
  overall: number
  breakdown: {
    visibility: ScoreDimension
    authority: ScoreDimension
    content: ScoreDimension
    website: ScoreDimension
    knowledge: ScoreDimension
  }
}

// ── State ──
const loading = ref(true)
const error = ref<string | null>(null)
const scoreData = ref<ScoreExplainability | null>(null)
const indexedRate = ref(0)
const verifiedCount = ref(0)

// ── Single source: action pipeline ──
const {
  actions: pipelineActions,
  completedCount,
  totalCount,
  progressPercent,
} = useActionPipeline(computed(() => props.projectId))

// Active executions for overview display
const activeExecutions = computed(() =>
  pipelineActions.value.filter(a => a.status === 'in_progress' || a.status === 'pending_verification')
)

// ── Helpers ──
function grade(score: number): string {
  if (score >= 80) return 'A'
  if (score >= 60) return 'B'
  if (score >= 40) return 'C'
  return 'D'
}

function gradeColor(g: string): string {
  const map: Record<string, string> = { A: 'green', B: 'blue', C: 'yellow', D: 'red' }
  return map[g] || 'gray'
}

function gradeLabel(g: string): string {
  const map: Record<string, string> = { A: '优秀', B: '良好', C: '待改善', D: '需重点关注' }
  return map[g] || '未知'
}

function statusIcon(s: 'good' | 'neutral' | 'bad'): string {
  return s === 'good' ? '🟢' : s === 'neutral' ? '🟡' : '🔴'
}

function pctClass(pct: number): string {
  if (pct >= 70) return 'bg-green-500'
  if (pct >= 40) return 'bg-yellow-500'
  return 'bg-red-500'
}

const dimensionMeta: Record<string, { label: string; desc: string }> = {
  visibility: { label: 'Brand Presence', desc: 'AI 是否认识你的品牌' },
  authority: { label: 'Authority & Trust', desc: '是否具备可信度' },
  content: { label: 'Content Quality', desc: '内容质量是否足够' },
  website: { label: 'Structured Data', desc: '是否具备机器可理解性' },
  knowledge: { label: 'AI Recommendation Readiness', desc: '是否容易被 AI 推荐' },
}

// Industry benchmarks (estimated, replace with real data later)
const industryBenchmark: Record<string, { avg: number; top: number }> = {
  visibility: { avg: 63, top: 88 },
  authority: { avg: 58, top: 85 },
  content: { avg: 65, top: 90 },
  website: { avg: 55, top: 82 },
  knowledge: { avg: 50, top: 78 },
}

// ── Confidence heuristic (will be replaced by real confidence from engine) ──
const reportConfidence = computed(() => {
  const details = scoreData.value
    ? Object.values(scoreData.value.breakdown).flatMap(d => d.details)
    : []
  const withEvidence = details.filter(d => d.reason && d.reason.length > 10).length
  const total = details.length || 1
  const pct = Math.round((withEvidence / total) * 100)
  return { pct, label: pct >= 70 ? '高' : pct >= 40 ? '中' : '低', color: pct >= 70 ? 'green' : pct >= 40 ? 'yellow' : 'red' }
})

// ── Bar width helper ──
const scaledWidth = (score: number) => `${Math.min(score, 100)}%`

// ── Top Issues from pipeline (single source) ──
const topIssueList = computed(() => {
  return pipelineActions.value
    .filter(a => a.status === 'not_started' || a.status === 'in_progress')
    .map(a => {
      const s = a.signal || {}
      const w = s.weight || 0.5
      const c = s.confidence === 'HIGH' ? 1 : s.confidence === 'MEDIUM' ? 0.7 : 0.4
      const difficulty = w > 0.7 ? 0.6 : w > 0.4 ? 0.8 : 1
      const priorityScore = Math.round(w * 100 * c * difficulty)
      return {
        title: a.title,
        reason: s.reason || '',
        weight: w,
        confidence: s.confidence || 'MEDIUM',
        severity: w >= 0.7 ? 'HIGH' : w >= 0.4 ? 'MED' : 'LOW',
        priorityScore,
        impactLabel: `+${Math.round(w * 15)}~${Math.round(w * 25)}分`,
        effortLabel: w > 0.7 ? '约 30 分钟' : w > 0.4 ? '约 15 分钟' : '约 10 分钟',
        difficultyLabel: w > 0.7 ? '中等' : '低',
        actionId: a.id,
      }
    })
    .sort((a, b) => b.priorityScore - a.priorityScore)
})

// ── Top Pick (first unstarted high-priority action) ──
const topPick = computed(() => {
  const top = topIssueList.value[0]
  if (!top) return null
  return {
    title: top.title,
    reason: top.reason,
    impact: top.impactLabel,
    effort: top.effortLabel,
    difficulty: top.difficultyLabel,
    actionId: top.actionId,
  }
})

// ── Executive Summary ──
const executiveSummary = computed(() => {
  const s = scoreData.value
  if (!s) return ''
  const g = grade(s.overall)
  const weakestDim = [...dimensions.value].sort((a, b) => a.score - b.score)[0]

  let summary = `品牌整体健康度${gradeLabel(g)}（${s.overall}分）。`

  if (g === 'A') {
    summary += ` AI 搜索平台已能够正确识别品牌主体，品牌知识的引用质量稳定。`
  } else if (g === 'B') {
    summary += ` 目前 AI 搜索平台对品牌的认知已建立基础认知，但在${weakestDim.label}维度仍有提升空间。`
  } else if (g === 'C') {
    summary += ` AI 搜索平台对品牌的认知不够完整，特别是在${weakestDim.label}方面存在明显不足。`
  } else {
    summary += ` AI 搜索平台对品牌的认知存在较大缺口，需要系统性的品牌信息建设和权威性提升。`
  }

  if (topPick.value) {
    summary += ` 建议优先处理"${topPick.value.title}"，预计可提升品牌整体评分 ${topPick.value.impact}。`
  }

  return summary
})

// ── Fetch report data (score only, signals come from pipeline) ──
async function fetchReport() {
  if (!props.projectId) return
  loading.value = true
  error.value = null
  try {
    const { client } = await import('~/studio-v2/workspace/brand-geo/clients/GEOApiClient')
    const scoreRes = await client.get(`/recommendation/explain?projectId=${props.projectId}`)
    if (scoreRes.success && scoreRes.data) scoreData.value = scoreRes.data
    const dashRes = await client.get(`/monitor/dashboard/${props.projectId}`)
    if (dashRes.success && dashRes.data) {
      indexedRate.value = dashRes.data.publishingHealth?.indexedPercentage || 0
      verifiedCount.value = dashRes.data.publishingHealth?.verified || 0
    }
  } catch (err: any) {
    error.value = err.message || '加载报告失败'
  } finally {
    loading.value = false
  }
}

watch(() => props.projectId, fetchReport, { immediate: true })

// ── Dimensions ──
const dimensions = computed(() => {
  const bd = scoreData.value?.breakdown
  if (!bd) return []
  return ['visibility', 'authority', 'content', 'website', 'knowledge'].map((key) => {
    const dim = bd[key as keyof typeof bd]
    const meta = dimensionMeta[key] || { label: key, desc: '' }
    const bench = industryBenchmark[key] || { avg: 50, top: 80 }
    return {
      key,
      label: meta.label,
      desc: meta.desc,
      score: dim.score,
      grade: grade(dim.score),
      gradeColor: gradeColor(grade(dim.score)),
      details: dim.details || [],
      barWidth: scaledWidth(dim.score),
      barColor: pctClass(dim.score),
      avg: bench.avg,
      top: bench.top,
    }
  })
})
</script>

<template>
  <div class="space-y-6">
    <!-- Empty state -->
    <div v-if="!projectId" class="text-center text-gray-400 py-16">
      <div class="text-4xl mb-4">📊</div>
      <div class="text-sm font-medium mb-2">选择一个品牌项目</div>
      <p class="text-xs text-gray-500">在左侧面板创建或选择一个品牌，查看 Brand Health Report</p>
    </div>

    <!-- Loading -->
    <div v-else-if="loading" class="space-y-4 animate-pulse">
      <div class="h-24 bg-gray-200 dark:bg-gray-700 rounded-lg" />
      <div class="grid grid-cols-5 gap-3"><div v-for="i in 5" :key="i" class="h-40 bg-gray-200 dark:bg-gray-700 rounded-lg" /></div>
      <div class="h-48 bg-gray-200 dark:bg-gray-700 rounded-lg" />
    </div>

    <!-- Error -->
    <div v-else-if="error" class="text-center text-red-400 py-12">
      <div class="text-2xl mb-3">⚠️</div>
      <p class="text-sm">{{ error }}</p>
    </div>

    <!-- ====== REPORT ====== -->
    <template v-else>
      <!-- ⭐ This Week's Top Pick (from pipeline) -->
      <div v-if="topPick" class="bg-gradient-to-r from-amber-500 to-orange-500 rounded-lg p-5 text-white">
        <div class="flex items-center gap-2 mb-1">
          <span class="text-base">⭐</span>
          <span class="text-xs font-semibold uppercase tracking-wider opacity-80">本周最值得完成</span>
        </div>
        <p class="text-sm font-medium mb-1">{{ topPick.title }}</p>
        <p class="text-xs opacity-90 mb-2">{{ topPick.reason }}</p>
        <div class="flex flex-wrap items-center gap-3 text-xs opacity-80 mb-2">
          <span>预计提升：<strong class="text-white">{{ topPick.impact }}</strong></span>
          <span>预计耗时：<strong class="text-white">{{ topPick.effort }}</strong></span>
          <span>难度：<strong class="text-white">{{ topPick.difficulty }}</strong></span>
        </div>
        <button
          class="text-xs px-4 py-1.5 rounded bg-white text-orange-600 hover:bg-orange-50 font-medium transition-colors"
          @click="emit('navigate', 'insights')"
        >
          立即修复 →
        </button>
      </div>

      <!-- 📊 Brand Improvement Progress (from pipeline) -->
      <div class="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
        <div class="flex items-center justify-between mb-2">
          <h3 class="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">品牌优化进度</h3>
          <span class="text-xs text-gray-400">{{ completedCount }} / {{ totalCount }} 完成</span>
        </div>
        <div class="bg-gray-100 dark:bg-gray-700 rounded-full h-2.5 relative overflow-hidden">
          <div
            class="h-full rounded-full bg-blue-500 transition-all duration-500"
            :style="{ width: `${progressPercent}%` }"
          />
        </div>
        <p class="text-xs text-gray-400 mt-1.5" v-if="activeExecutions.length > 0">
          {{ activeExecutions.length }} 个优化正在执行中...
        </p>
        <p class="text-xs text-gray-400 mt-1.5" v-else-if="totalCount > 0 && completedCount === totalCount">
          所有优化已完成，品牌状态良好
        </p>
        <p class="text-xs text-gray-400 mt-1.5" v-else-if="totalCount === 0">
          暂无待优化项，执行检测后自动生成建议
        </p>
      </div>

      <!-- 📋 Executive Summary -->
      <div class="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg p-5 text-white">
        <h2 class="text-xs font-semibold uppercase tracking-wider opacity-80 mb-2">Executive Summary</h2>
        <p class="text-sm leading-relaxed">{{ executiveSummary }}</p>
      </div>

      <!-- 🏆 Overall Score + Trend + Confidence -->
      <div class="bg-white dark:bg-gray-800 rounded-lg p-5 border border-gray-200 dark:border-gray-700">
        <div class="flex items-start justify-between">
          <div>
            <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300">品牌健康总分</h3>
            <div class="flex items-baseline gap-3 mt-2">
              <span class="text-4xl font-bold">{{ scoreData?.overall || 0 }}</span>
              <Badge
                :label="grade(scoreData?.overall || 0) + ' - ' + gradeLabel(grade(scoreData?.overall || 0))"
                :color="gradeColor(grade(scoreData?.overall || 0))"
              />
              <span class="text-xs text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">趋势：即将开放</span>
            </div>
            <div class="flex items-center gap-2 mt-1.5">
              <span class="text-xs text-gray-400">可信度：</span>
              <Badge :label="`${reportConfidence.pct}% - ${reportConfidence.label}`" :color="reportConfidence.color as 'green' | 'yellow' | 'red'" size="sm" />
            </div>
            <p class="text-xs text-gray-400 mt-1">最近更新时间：{{ scoreData?.overall ? '已更新' : '—' }}</p>
          </div>
          <div class="text-right text-xs text-gray-400">
            <div>AI 收录状态</div>
            <div class="mt-1">
              <Badge :label="indexedRate > 0 ? `已收录 ${indexedRate}%` : '待检测'" :color="indexedRate > 0 ? 'green' : 'gray'" />
            </div>
          </div>
        </div>
        <div class="mt-3">
          <ExplainPanel
            :data="{
              why: '品牌健康总分综合五维加权，反映品牌在主流 AI 搜索中的认知质量',
              evidence: reportConfidence.pct >= 70 ? '各维度均有详细原因和证据支撑' : '部分维度证据较少，建议执行完整检测后重新评估',
              confidence: reportConfidence.pct >= 70 ? 'HIGH' : (reportConfidence.pct >= 40 ? 'MEDIUM' : 'LOW'),
              source: '评分引擎 + 学习引擎',
            }"
          />
        </div>
      </div>

      <!-- 📊 Five Dimensions -->
      <div>
        <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">五维健康评分</h3>
        <div class="space-y-3">
          <div v-for="dim in dimensions" :key="dim.key"
            class="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700"
          >
            <div class="flex items-center justify-between mb-1">
              <div class="flex items-center gap-2">
                <span class="text-sm font-medium">{{ dim.label }}</span>
                <Badge :label="dim.grade" :color="dim.gradeColor" size="sm" />
              </div>
              <span class="text-xs text-gray-400">{{ dim.desc }}</span>
            </div>
            <div class="flex items-center gap-3 mt-2">
              <div class="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-2.5 relative overflow-hidden">
                <div class="h-full rounded-full transition-all duration-500" :class="dim.barColor" :style="{ width: dim.barWidth }" />
              </div>
              <span class="text-sm font-bold min-w-[3ch] text-right">{{ dim.score }}</span>
            </div>
            <div class="flex items-center gap-4 mt-1.5 text-xs text-gray-400">
              <span>行业平均：<strong>{{ dim.avg }}</strong></span>
              <span>优秀品牌：<strong>{{ dim.top }}</strong></span>
              <span v-if="dim.score > dim.avg" class="text-green-500">▲ 高于平均</span>
              <span v-else class="text-red-400">▼ 低于平均</span>
            </div>
            <div class="mt-3 space-y-1.5">
              <div v-for="item in dim.details" :key="item.label" class="text-xs">
                <div class="flex items-center gap-1">
                  <span>{{ statusIcon(item.status) }}</span>
                  <span class="text-gray-600 dark:text-gray-400 font-medium">{{ item.label }}</span>
                  <span class="text-gray-400 ml-1">({{ item.points }}/{{ item.maxPoints }})</span>
                </div>
                <p class="text-gray-400 ml-5">{{ item.reason }}</p>
              </div>
            </div>
            <div v-if="dim.details.some(d => d.status !== 'good')" class="mt-3 pt-2 border-t border-gray-100 dark:border-gray-700">
              <button class="text-xs text-blue-500 hover:text-blue-600" @click="emit('navigate', 'insights')">
                查看优化建议 →
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- ⚠️ Top Issues (from pipeline) -->
      <div class="bg-white dark:bg-gray-800 rounded-lg p-5 border border-gray-200 dark:border-gray-700">
        <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">需要关注的问题</h3>
        <div v-if="topIssueList.length === 0" class="text-center text-gray-400 py-6">
          <p class="text-xs">暂无需要关注的问题，品牌状态良好</p>
        </div>
        <div v-else class="space-y-2">
          <div v-for="(issue, i) in topIssueList" :key="i"
            class="flex items-start gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-900/50"
          >
            <div class="flex flex-col items-center min-w-[3rem]">
              <span class="text-lg font-bold" :class="issue.priorityScore >= 60 ? 'text-red-500' : issue.priorityScore >= 30 ? 'text-yellow-500' : 'text-gray-400'">{{ issue.priorityScore }}</span>
              <span class="text-[10px] text-gray-400">Priority</span>
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-0.5">
                <Badge :label="issue.severity" :color="issue.severity === 'HIGH' ? 'red' : issue.severity === 'MED' ? 'yellow' : 'gray'" size="sm" />
                <span class="text-xs font-medium">{{ issue.title }}</span>
              </div>
              <p class="text-xs text-gray-500">{{ issue.reason }}</p>
              <div class="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-gray-400">
                <span>预计收益：<strong class="text-green-500">{{ issue.impactLabel }}</strong></span>
                <span>预计耗时：<strong>{{ issue.effortLabel }}</strong></span>
                <span>难度：<strong>{{ issue.difficultyLabel }}</strong></span>
              </div>
              <button class="mt-1.5 text-xs px-3 py-1 rounded bg-blue-500 hover:bg-blue-600 text-white transition-colors"
                @click="emit('navigate', 'insights')">
                立即修复 ↗
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- 🎯 Recommended Actions (from pipeline) -->
      <div class="bg-white dark:bg-gray-800 rounded-lg p-5 border border-gray-200 dark:border-gray-700">
        <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">建议行动</h3>
        <div v-if="topIssueList.length === 0" class="text-center text-gray-400 py-6">
          <p class="text-xs">暂无优化建议</p>
        </div>
        <div v-else class="space-y-3">
          <div v-if="topIssueList.filter(i => i.severity === 'HIGH').length">
            <h4 class="text-xs font-medium text-red-500 mb-2">🔴 High Priority</h4>
            <div v-for="(issue, i) in topIssueList.filter(i => i.severity === 'HIGH')" :key="'h-'+i"
              class="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700 last:border-0"
            >
              <div>
                <span class="text-xs font-medium">{{ issue.title }}</span>
                <p class="text-xs text-gray-400 mt-0.5">{{ issue.reason }}</p>
                <div class="flex gap-3 mt-1 text-[10px] text-gray-400">
                  <span>⏱ {{ issue.effortLabel }}</span>
                  <span>📈 {{ issue.impactLabel }}</span>
                  <span>📊 {{ issue.difficultyLabel }}</span>
                </div>
              </div>
              <button class="text-xs px-3 py-1 rounded bg-red-500 hover:bg-red-600 text-white whitespace-nowrap ml-4 transition-colors"
                @click="emit('navigate', 'insights')">
                立即修复 ↗
              </button>
            </div>
          </div>
          <div v-if="topIssueList.filter(i => i.severity === 'MED').length">
            <h4 class="text-xs font-medium text-yellow-500 mb-2">🟡 Medium Priority</h4>
            <div v-for="(issue, i) in topIssueList.filter(i => i.severity === 'MED')" :key="'m-'+i"
              class="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700 last:border-0"
            >
              <div>
                <span class="text-xs font-medium">{{ issue.title }}</span>
                <p class="text-xs text-gray-400 mt-0.5">{{ issue.reason }}</p>
                <div class="flex gap-3 mt-1 text-[10px] text-gray-400">
                  <span>⏱ {{ issue.effortLabel }}</span>
                  <span>📈 {{ issue.impactLabel }}</span>
                </div>
              </div>
              <button class="text-xs px-3 py-1 rounded bg-blue-500 hover:bg-blue-600 text-white whitespace-nowrap ml-4 transition-colors"
                @click="emit('navigate', 'insights')">
                查看 →
              </button>
            </div>
          </div>
          <div v-if="topIssueList.filter(i => i.severity === 'LOW').length">
            <h4 class="text-xs font-medium text-gray-400 mb-2">🟢 Low Priority</h4>
            <div v-for="(issue, i) in topIssueList.filter(i => i.severity === 'LOW')" :key="'l-'+i"
              class="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700 last:border-0"
            >
              <div>
                <span class="text-xs font-medium">{{ issue.title }}</span>
                <p class="text-xs text-gray-400 mt-0.5">{{ issue.reason }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 🤖 AI Visibility Summary -->
      <div class="bg-white dark:bg-gray-800 rounded-lg p-5 border border-gray-200 dark:border-gray-700">
        <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">AI 可见性覆盖率</h3>
        <div class="space-y-2.5">
          <div>
            <div class="flex items-center justify-between text-xs mb-1">
              <span class="font-medium">ChatGPT</span>
              <span class="text-gray-400">{{ indexedRate > 0 ? `${indexedRate}% 覆盖` : '暂未检测' }}</span>
            </div>
            <div class="bg-gray-100 dark:bg-gray-700 rounded-full h-2">
              <div class="h-full rounded-full bg-green-500 transition-all" :style="{ width: `${indexedRate}%` }" />
            </div>
          </div>
          <div>
            <div class="flex items-center justify-between text-xs mb-1">
              <span class="font-medium">Gemini</span>
              <span class="text-gray-400">{{ indexedRate > 0 ? `${indexedRate}% 覆盖` : '暂未检测' }}</span>
            </div>
            <div class="bg-gray-100 dark:bg-gray-700 rounded-full h-2">
              <div class="h-full rounded-full bg-green-500 transition-all" :style="{ width: `${indexedRate}%` }" />
            </div>
          </div>
          <div>
            <div class="flex items-center justify-between text-xs mb-1">
              <span class="font-medium">Claude</span>
              <Badge label="即将开放" color="yellow" size="sm" />
            </div>
            <div class="bg-gray-100 dark:bg-gray-700 rounded-full h-2 opacity-40">
              <div class="h-full rounded-full bg-gray-400" style="width: 5%" />
            </div>
          </div>
          <div>
            <div class="flex items-center justify-between text-xs mb-1">
              <span class="font-medium">Perplexity</span>
              <Badge label="即将开放" color="yellow" size="sm" />
            </div>
            <div class="bg-gray-100 dark:bg-gray-700 rounded-full h-2 opacity-40">
              <div class="h-full rounded-full bg-gray-400" style="width: 5%" />
            </div>
          </div>
        </div>
        <div class="mt-3 text-xs text-gray-400 text-center">
          已发布内容收录率：<strong>{{ indexedRate }}%</strong> · 已验证：<strong>{{ verifiedCount }} 条</strong>
        </div>
      </div>

      <!-- 🚀 Bottom CTAs -->
      <div class="flex items-center justify-center gap-4 py-2">
        <button
          class="text-sm px-6 py-2.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white font-medium transition-colors"
          @click="emit('navigate', 'insights')"
        >
          立即开始优化
        </button>
        <button
          class="text-sm px-6 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-not-allowed"
          disabled
        >
          下载品牌报告 PDF（即将开放）
        </button>
      </div>
    </template>
  </div>
</template>
