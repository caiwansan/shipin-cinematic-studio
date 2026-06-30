<script setup lang="ts">
/**
 * GeoPublish.vue — P3.6 Publishing Workspace
 * Product: Publish Queue → Plans → Preview → Export
 * No direct Adapter exposure. User sees: plans, tasks, content.
 */

import { ref, watch, computed, onMounted } from 'vue'
import Badge from '~/components/kmki-ui/Badge/index.vue'
import ExplainPanel from '~/components/kmki-ui/ExplainPanel/index.vue'

const props = defineProps<{ projectId: string | null }>()
const emit = defineEmits<{ navigate: [tab: string, actionId?: string] }>()

// ── Types (mirrors backend DTO) ──
interface ClaimItem {
  id: string
  title: string
  contentType: string
  content: string
  status: string
  version: string
}

interface PlanItem {
  id: string
  title: string
  status: string
  claimIds: string[]
  targetChannels: string[]
  publishedAt?: string
  createdAt: string
}

interface RecordItem {
  id: string
  planId: string
  claimId: string
  channel: string
  version: string
  artifactHash: string
  artifactUrl?: string
  status: string
  publishedAt?: string
  createdAt: string
}

interface PublishingSummary {
  totalPlans: number
  draftCount: number
  inReviewCount: number
  approvedCount: number
  publishedCount: number
  channelBreakdown: Array<{ channel: string; count: number }>
}

// ── State ──
const loading = ref(true)
const plans = ref<PlanItem[]>([])
const summary = ref<PublishingSummary | null>(null)

// Selected plan for detail view
const selectedPlanId = ref<string | null>(null)
const selectedPlanClaims = ref<ClaimItem[]>([])
const selectedPlanRecords = ref<RecordItem[]>([])

// Preview state (per claimId, per channel)
const previewContent = ref<Record<string, Record<string, string>>>({})

// Export state
const exportMsg = ref('')

// ── Channel display names (user-facing) ──
const channelLabels: Record<string, string> = {
  markdown: 'Markdown 文档',
  html_preview: 'HTML 预览页',
  schema_jsonld: '结构化数据 (Schema.org)',
}

const channelFormats: Record<string, string> = {
  markdown: 'md',
  html_preview: 'html',
  schema_jsonld: 'json',
}

const planStatusBadge = (s: string) => {
  const m: Record<string, { label: string; color: string }> = {
    draft: { label: '草稿', color: 'yellow' },
    in_review: { label: '审核中', color: 'blue' },
    approved: { label: '已批准', color: 'green' },
    published: { label: '已发布', color: 'green' },
    rolled_back: { label: '已回滚', color: 'red' },
  }
  return m[s] || { label: s, color: 'gray' }
}

// ── Fetch ──
async function fetchData() {
  if (!props.projectId) return
  loading.value = true
  try {
    const { client } = await import('~/studio-v2/workspace/brand-geo/clients/GEOApiClient')
    const [plansRes, summaryRes] = await Promise.all([
      client.get(`/publish/plans/${props.projectId}`),
      client.get(`/publish/summary/${props.projectId}`),
    ])
    if (plansRes.success) plans.value = plansRes.data || []
    if (summaryRes.success) summary.value = summaryRes.data
  } catch {
    // API not ready yet — show empty state
  } finally {
    loading.value = false
  }
}

watch(() => props.projectId, fetchData, { immediate: true })

async function selectPlan(planId: string) {
  selectedPlanId.value = planId
  previewContent.value = {}
  try {
    const { client } = await import('~/studio-v2/workspace/brand-geo/clients/GEOApiClient')
    const [planRes, recordsRes] = await Promise.all([
      client.get(`/publish/plan/${planId}`),
      client.get(`/publish/records/plan/${planId}`),
    ])
    if (planRes.success) {
      selectedPlanClaims.value = planRes.data.claims || []
    }
    if (recordsRes.success) {
      selectedPlanRecords.value = recordsRes.data || []
    }
  } catch {
    // ignore
  }
}

async function previewChannel(claimId: string, channel: string) {
  try {
    const { client } = await import('~/studio-v2/workspace/brand-geo/clients/GEOApiClient')
    const res = await client.post(`/publish/preview/${claimId}`, { channel })
    if (res.success) {
      const content = res.data.content || ''
      if (!previewContent.value[claimId]) previewContent.value[claimId] = {}
      previewContent.value[claimId][channel] = content
    }
  } catch {
    // preview unavailable — API route not implemented yet
  }
}

async function exportPlan(planId: string) {
  try {
    const { client } = await import('~/studio-v2/workspace/brand-geo/clients/GEOApiClient')
    const res = await client.post(`/publish/plan/${planId}/export`, {})
    if (res.success) {
      exportMsg.value = `✅ 已导出 ${(res.data.records || []).length} 个文件`
    } else {
      exportMsg.value = '导出失败'
    }
  } catch {
    exportMsg.value = '导出失败'
  }
}

async function publishPlan(planId: string) {
  try {
    const { client } = await import('~/studio-v2/workspace/brand-geo/clients/GEOApiClient')
    const res = await client.post(`/publish/plan/${planId}/publish`, {})
    if (res.success) {
      await fetchData()
      if (selectedPlanId.value === planId) await selectPlan(planId)
    }
  } catch {
    // ignore
  }
}

// ── Create plan from Insights (triggered by navigate) ──
onMounted(() => {
  // If navigated with actionIds from Insights, can pre-select
})
</script>

<template>
  <div class="space-y-4">
    <div v-if="!projectId" class="text-center text-gray-400 py-12">
      <div class="text-4xl mb-3">🚀</div>
      <div class="text-sm font-medium">选择一个项目查看发布</div>
    </div>

    <template v-else-if="loading">
      <div class="animate-pulse space-y-3">
        <div class="h-20 bg-gray-200 dark:bg-gray-700 rounded-lg" />
        <div v-for="i in 3" :key="i" class="h-16 bg-gray-200 dark:bg-gray-700 rounded-lg" />
      </div>
    </template>

    <template v-else>
      <!-- ═══ Summary Bar ═══ -->
      <div class="grid grid-cols-4 gap-3">
        <div class="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700 text-center">
          <div class="text-2xl font-bold text-blue-500">{{ summary?.draftCount || 0 }}</div>
          <div class="text-xs text-gray-400 mt-0.5">草稿</div>
        </div>
        <div class="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700 text-center">
          <div class="text-2xl font-bold text-yellow-500">{{ summary?.inReviewCount || 0 }}</div>
          <div class="text-xs text-gray-400 mt-0.5">审核中</div>
        </div>
        <div class="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700 text-center">
          <div class="text-2xl font-bold text-blue-400">{{ summary?.approvedCount || 0 }}</div>
          <div class="text-xs text-gray-400 mt-0.5">已批准</div>
        </div>
        <div class="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700 text-center">
          <div class="text-2xl font-bold text-green-500">{{ summary?.publishedCount || 0 }}</div>
          <div class="text-xs text-gray-400 mt-0.5">已发布</div>
        </div>
      </div>

      <!-- ═══ Content: Plans list + Preview ═══ -->
      <div class="flex gap-4">
        <!-- Plans list -->
        <div class="flex-1 space-y-2">
          <div class="flex items-center justify-between mb-1">
            <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300">
              发布计划 ({{ plans.length }})
            </h3>
            <button
              class="text-xs px-2.5 py-1 rounded bg-blue-500 hover:bg-blue-600 text-white transition-colors"
              @click="emit('navigate', 'insights')"
            >
              + 新建计划
            </button>
          </div>

          <div v-if="plans.length === 0" class="text-center text-gray-400 py-8 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
            <div class="text-lg mb-2">📋</div>
            <p class="text-xs">暂无发布计划</p>
            <p class="text-[10px] text-gray-500 mt-1">在「洞察」中执行优化后，可以创建发布计划</p>
          </div>

          <div
            v-for="plan in plans"
            :key="plan.id"
            class="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700 cursor-pointer hover:border-blue-300 dark:hover:border-blue-600 transition-colors"
            :class="{ 'ring-2 ring-blue-400': selectedPlanId === plan.id }"
            @click="selectPlan(plan.id)"
          >
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2 min-w-0">
                <span class="text-sm font-medium truncate">{{ plan.title }}</span>
                <Badge :label="planStatusBadge(plan.status).label" :color="planStatusBadge(plan.status).color as any" size="sm" />
              </div>
              <div class="flex items-center gap-2 ml-2">
                <template v-for="ch in plan.targetChannels" :key="ch">
                  <Badge :label="channelLabels[ch] || ch" color="gray" size="sm" />
                </template>
              </div>
            </div>
            <div class="flex items-center gap-3 mt-1 text-xs text-gray-400">
              <span>{{ plan.claimIds.length }} 条内容</span>
              <span v-if="plan.publishedAt">发布于 {{ plan.publishedAt }}</span>
            </div>
          </div>
        </div>

        <!-- Preview pane -->
        <div v-if="selectedPlanId" class="w-96 flex-shrink-0 space-y-3">
          <!-- Selected plan actions -->
          <div class="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
            <h4 class="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase mb-2">操作</h4>
            <div class="flex flex-wrap gap-2">
              <button
                class="text-xs px-3 py-1.5 rounded bg-green-500 hover:bg-green-600 text-white transition-colors"
                @click="publishPlan(selectedPlanId)"
              >
                发布
              </button>
              <button
                class="text-xs px-3 py-1.5 rounded bg-blue-500 hover:bg-blue-600 text-white transition-colors"
                @click="exportPlan(selectedPlanId)"
              >
                导出
              </button>
            </div>
            <p v-if="exportMsg" class="text-xs mt-1" :class="exportMsg.startsWith('✅') ? 'text-green-500' : 'text-red-400'">
              {{ exportMsg }}
            </p>
          </div>

          <!-- Claims in plan -->
          <div v-for="claim in selectedPlanClaims" :key="claim.id"
            class="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700"
          >
            <div class="flex items-center justify-between mb-2">
              <span class="text-xs font-medium">{{ claim.title }}</span>
              <Badge :label="claim.contentType" color="gray" size="sm" />
            </div>

            <!-- Channel preview buttons -->
            <div class="flex flex-wrap gap-1.5 mb-2">
              <button
                v-for="(label, ch) in channelFormats"
                :key="ch"
                class="text-[10px] px-2 py-0.5 rounded border border-gray-200 dark:border-gray-600 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                @click="previewChannel(claim.id, ch)"
              >
                预览 {{ label }}
              </button>
            </div>

            <!-- Traceability info -->
            <div class="flex items-center gap-3 text-[10px] text-gray-400 mb-1.5 pb-1.5 border-b border-gray-100 dark:border-gray-700">
              <span>Source: Verified from Action</span>
              <span>Version: {{ claim.version }}</span>
            </div>

            <!-- Preview content per claim per channel -->
            <div v-if="previewContent[claim.id]?.['markdown']" class="text-xs bg-gray-50 dark:bg-gray-900 rounded p-2 max-h-40 overflow-auto">
              <pre class="whitespace-pre-wrap">{{ previewContent[claim.id]['markdown'].substring(0, 500) }}</pre>
            </div>
            <div v-if="previewContent[claim.id]?.['html_preview']"
              class="text-xs bg-white border border-gray-200 dark:border-gray-700 rounded p-2 max-h-40 overflow-auto"
              v-html="previewContent[claim.id]['html_preview'].substring(0, 3000)"
            />
            <div v-if="previewContent[claim.id]?.['schema_jsonld']" class="text-xs bg-gray-50 dark:bg-gray-900 rounded p-2 max-h-40 overflow-auto font-mono">
              {{ previewContent[claim.id]['schema_jsonld'].substring(0, 500) }}
            </div>

            <!-- Empty preview state -->
            <div v-if="!previewContent[claim.id]" class="text-[10px] text-gray-300 italic">
              点击预览按钮查看内容
            </div>
          </div>

          <!-- Publishing History -->
          <div v-if="selectedPlanRecords.length > 0" class="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
            <h4 class="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase mb-2">发布记录</h4>
            <div v-for="rec in selectedPlanRecords" :key="rec.id" class="flex items-center justify-between py-1.5 border-b border-gray-100 dark:border-gray-700 last:border-0">
              <div class="flex items-center gap-2">
                <span class="text-xs">{{ channelLabels[rec.channel] || rec.channel }}</span>
                <span class="text-[10px] text-gray-400">{{ rec.version }}</span>
              </div>
              <Badge
                :label="rec.status"
                :color="rec.status === 'published' ? 'green' : rec.status === 'failed' ? 'red' : 'yellow'"
                size="sm"
              />
            </div>
          </div>
        </div>

        <!-- No selection -->
        <div v-else class="w-96 flex-shrink-0 flex items-center justify-center text-gray-400 border border-dashed border-gray-200 dark:border-gray-700 rounded-lg">
          <div class="text-center">
            <div class="text-2xl mb-2">📄</div>
            <p class="text-xs">选择一个发布计划查看详情</p>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
