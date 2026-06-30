<!-- @deprecated — GEO v1.5 Legacy. Use design-system product blocks instead. -->
<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import Badge from '~/components/kmki-ui/Badge/index.vue'
import ExplainPanel from '~/components/kmki-ui/ExplainPanel/index.vue'
import { useActionPipeline } from './composables/useActionPipeline'

const props = defineProps<{ projectId: string | null }>()
const emit = defineEmits<{ navigate: [tab: string] }>()

// ── Shared pipeline state (single source of truth) ──
const {
  actions,
  completedCount,
  totalCount,
  executing,
  fetchActions,
  executeAction,
} = useActionPipeline(computed(() => props.projectId))

// Legacy dashboard data
const monitorDashboard = ref<any>(null)
const loading = ref(false)
const error = ref<string | null>(null)

// ── Active in-progress/pending items for panel display ──
const activeItems = computed(() =>
  actions.value.filter(a => a.status === 'in_progress' || a.status === 'pending_verification')
)
const notStartedCount = computed(() =>
  actions.value.filter(a => a.status === 'not_started').length
)

watch(() => props.projectId, async (id) => {
  if (!id) return
  loading.value = true
  error.value = null
  try {
    const { client } = await import('~/legacy/brand-geo/clients/GEOApiClient')
    const dashRes = await client.get(`/monitor/dashboard/${id}`)
    if (dashRes.success) monitorDashboard.value = dashRes.data
  } catch (err: any) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}, { immediate: true })

function statusIcon(status: string): string {
  switch (status) {
    case 'not_started': return '○'
    case 'in_progress': return '◌'
    case 'pending_verification': return '◎'
    case 'verified': return '●'
    default: return '○'
  }
}

function statusColor(status: string): string {
  switch (status) {
    case 'not_started': return 'text-gray-300'
    case 'in_progress': return 'text-blue-500'
    case 'pending_verification': return 'text-yellow-500'
    case 'verified': return 'text-green-500'
    default: return 'text-gray-300'
  }
}
</script>

<template>
  <div class="space-y-4">
    <div v-if="!projectId" class="text-center text-gray-400 py-8 text-xs">
      选择项目查看优化建议
    </div>
    <template v-else>
      <!-- Progress summary -->
      <div v-if="totalCount > 0" class="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
        <div class="flex items-center justify-between text-xs mb-1.5">
          <span class="text-gray-500">优化进度</span>
          <span class="text-gray-400">{{ completedCount }}/{{ totalCount }}</span>
        </div>
        <div class="bg-gray-100 dark:bg-gray-700 rounded-full h-1.5">
          <div
            class="h-full rounded-full bg-blue-500 transition-all"
            :style="{ width: `${totalCount > 0 ? (completedCount / totalCount) * 100 : 0}%` }"
          />
        </div>
        <div v-if="activeItems.length > 0" class="text-xs text-blue-500 mt-1">
          {{ activeItems.length }} 个正在执行
        </div>
      </div>

      <!-- Active executions -->
      <div v-if="activeItems.length > 0">
        <h4 class="text-xs font-medium text-gray-500 mb-2">执行中</h4>
        <div v-for="item in activeItems" :key="item.id"
          class="bg-blue-50 dark:bg-blue-900/10 rounded-lg p-2.5 border border-blue-200 dark:border-blue-800 mb-2"
        >
          <div class="flex items-center gap-1.5">
            <span class="text-blue-500 text-xs animate-pulse">{{ statusIcon(item.status) }}</span>
            <span class="text-xs text-blue-700 dark:text-blue-300">{{ item.title }}</span>
          </div>
        </div>
      </div>

      <!-- Not started actions queue -->
      <div v-if="notStartedCount > 0">
        <h4 class="text-xs font-medium text-gray-500 mb-2">待优化（{{ notStartedCount }}）</h4>
        <div v-for="action in actions.filter(a => a.status === 'not_started').slice(0, 5)" :key="action.id"
          class="flex items-center gap-2 py-2 border-b border-gray-100 dark:border-gray-700 last:border-0 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 -mx-1 px-1 rounded transition-colors"
          @click="emit('navigate', 'insights')"
        >
          <span class="text-xs text-gray-300">{{ statusIcon(action.status) }}</span>
          <span class="text-xs text-gray-600 dark:text-gray-400 flex-1 truncate">{{ action.title }}</span>
          <button
            class="text-xs text-blue-500 hover:text-blue-600 whitespace-nowrap"
            @click.stop="emit('navigate', 'insights')"
          >
            修复
          </button>
        </div>
      </div>

      <!-- Completed -->
      <div v-if="completedCount > 0">
        <h4 class="text-xs font-medium text-gray-500 mb-2">已完成（{{ completedCount }}）</h4>
        <div v-for="action in actions.filter(a => a.status === 'verified')" :key="action.id"
          class="flex items-center gap-2 py-1.5"
        >
          <span class="text-xs text-green-500">{{ statusIcon(action.status) }}</span>
          <span class="text-xs text-gray-400 line-through">{{ action.title }}</span>
        </div>
      </div>

      <!-- Empty state: no actions yet -->
      <div v-if="totalCount === 0 && !loading" class="text-center text-gray-400 py-6 text-xs">
        暂无优化建议
      </div>

      <!-- Loading -->
      <div v-if="loading" class="space-y-2">
        <div v-for="i in 3" :key="i" class="h-8 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
      </div>
    </template>
  </div>
</template>
