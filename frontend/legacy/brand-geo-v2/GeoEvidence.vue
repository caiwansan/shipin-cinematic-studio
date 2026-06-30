<!-- @deprecated — GEO v1.5 Legacy. Use design-system product blocks instead. -->
<script setup lang="ts">
/**
 * GeoEvidence.vue — RC1.1: Verification History + Action Pipeline State
 *
 * Shows:
 *   1. Actions pending/in verification from pipeline
 *   2. Recently verified actions from pipeline
 *   3. Full verification history from API
 *   4. If actionId is provided, scroll/focus to that action
 */

import { ref, watch, computed, nextTick } from 'vue'
import Badge from '~/components/kmki-ui/Badge/index.vue'
import ExplainPanel from '~/components/kmki-ui/ExplainPanel/index.vue'
import { useActionPipeline } from './composables/useActionPipeline'

const props = defineProps<{ projectId: string | null; actionId?: string | null }>()
const emit = defineEmits<{ navigate: [tab: string, actionId?: string] }>()

// ── Single source: pipeline ──
const {
  actions: pipelineActions,
} = useActionPipeline(computed(() => props.projectId))

const pendingActions = computed(() =>
  pipelineActions.value.filter(a => a.status === 'pending_verification' || a.status === 'in_progress')
)
const verifiedActions = computed(() =>
  pipelineActions.value.filter(a => a.status === 'verified')
)

// ── Verification history ──
const evidenceList = ref<any[]>([])
const reVarifying = ref(false)
const verifyResult = ref<string | null>(null)

// Scroll target for actionId
const scrollTargetId = ref<string | null>(null)

watch(() => props.actionId, (id) => {
  if (id) scrollTargetId.value = id
}, { immediate: true })

watch(() => props.projectId, async (id) => {
  if (!id) return
  await fetchEvidence(id)
}, { immediate: true })

async function fetchEvidence(id: string) {
  try {
    const { client } = await import('~/legacy/brand-geo/clients/GEOApiClient')
    const res = await client.get(`/verification/history/${id}`)
    if (res.success) {
      evidenceList.value = res.data || []
    }
  } catch {
    // ignore
  }
}

async function runVerification() {
  if (!props.projectId) return
  reVarifying.value = true
  verifyResult.value = null
  try {
    const { client } = await import('~/legacy/brand-geo/clients/GEOApiClient')
    const res = await client.post('/verification/run', {
      projectId: props.projectId,
      optimizationType: 'bulk',
      triggerSource: 'manual',
    })
    verifyResult.value = res.success ? '✅ 验证任务已提交' : '❌ 提交失败'
    if (res.success) await fetchEvidence(props.projectId)
  } catch {
    verifyResult.value = '❌ 提交失败'
  } finally {
    reVarifying.value = false
  }
}
</script>

<template>
  <div class="space-y-4">
    <div v-if="!projectId" class="text-center text-gray-400 py-12">选择一个项目开始</div>

    <template v-else>
      <!-- ── Highlit action (from navigate) ── -->
      <div v-if="scrollTargetId" class="bg-blue-50 dark:bg-blue-900/10 rounded-lg p-3 border border-blue-300 dark:border-blue-700 mb-3">
        <div class="flex items-center gap-2">
          <span class="text-blue-500">→</span>
          <span class="text-xs font-medium text-blue-700 dark:text-blue-300">关注操作：{{ scrollTargetId }}</span>
          <button class="text-xs text-blue-500 hover:text-blue-600 ml-auto" @click="scrollTargetId = null">
            清除
          </button>
        </div>
      </div>

      <!-- ── Pending verifications from pipeline ── -->
      <div v-if="pendingActions.length > 0">
        <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">正在验证</h3>
        <div v-for="action in pendingActions" :key="action.id"
          class="bg-yellow-50 dark:bg-yellow-900/10 rounded-lg p-3 border border-yellow-200 dark:border-yellow-800 mb-2"
        >
          <div class="flex items-center gap-2">
            <span class="text-yellow-500 animate-pulse">◎</span>
            <span class="text-xs font-medium">{{ action.title }}</span>
            <Badge label="验证中..." color="yellow" size="sm" />
          </div>
          <p v-if="action.signal?.reason" class="text-xs text-gray-500 mt-1 ml-4">{{ action.signal.reason }}</p>
        </div>
      </div>

      <!-- ── Verified actions from pipeline ── -->
      <div v-if="verifiedActions.length > 0">
        <h3 class="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2">最近验证完成</h3>
        <div v-for="action in verifiedActions.slice(0, 3)" :key="action.id"
          class="bg-green-50 dark:bg-green-900/10 rounded-lg p-3 border border-green-200 dark:border-green-800 mb-2"
          :class="{ 'ring-2 ring-blue-400': scrollTargetId === action.id }"
        >
          <div class="flex items-center gap-2">
            <span class="text-green-500">●</span>
            <span class="text-xs font-medium">{{ action.title }}</span>
            <Badge label="已验证" color="green" size="sm" />
          </div>
          <div v-if="action.verificationState" class="mt-1 ml-4">
            <p v-if="action.verificationState.delta !== undefined" class="text-xs text-green-600">
              改善 {{ action.verificationState.delta > 0 ? '+' : '' }}{{ action.verificationState.delta }} 分
            </p>
            <p v-if="action.verificationState.beforeScore !== undefined" class="text-xs text-gray-500">
              {{ action.verificationState.beforeScore }} → {{ action.verificationState.afterScore }}
            </p>
          </div>
        </div>
      </div>

      <!-- ── Full verification history ── -->
      <div>
        <div class="flex items-center justify-between mb-2">
          <span class="text-sm text-gray-500 dark:text-gray-400">全部验证记录</span>
          <button
            class="text-xs px-3 py-1.5 rounded bg-blue-500 hover:bg-blue-600 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            :disabled="reVarifying"
            @click="runVerification"
          >
            {{ reVarifying ? '验证中...' : '重新验证' }}
          </button>
        </div>

        <div v-if="verifyResult" class="text-xs text-center py-1 mb-2" :class="verifyResult.startsWith('✅') ? 'text-green-500' : 'text-red-400'">
          {{ verifyResult }}
        </div>

        <div v-if="evidenceList.length === 0 && pendingActions.length === 0 && verifiedActions.length === 0"
          class="text-center text-gray-400 py-12">
          <p class="text-xs">暂无验证记录，执行优化后自动验证</p>
        </div>

        <div
          v-for="ev in evidenceList"
          :key="ev.id"
          class="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 mb-2"
        >
          <div class="flex items-center justify-between mb-2">
            <span class="text-sm font-medium">Delta: {{ ev.deltaWhenVerified?.toFixed(1) }}</span>
            <Badge
              :label="ev.isImprovement ? 'Improved' : 'No Change'"
              :color="ev.isImprovement ? 'green' : 'gray'"
            />
          </div>
          <ExplainPanel v-if="ev.explainData" :data="ev.explainData" />
        </div>
      </div>
    </template>
  </div>
</template>
