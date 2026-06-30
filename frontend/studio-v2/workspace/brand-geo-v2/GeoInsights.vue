<script setup lang="ts">
/**
 * GeoInsights.vue — P2 Execution Loop
 * Each action now has a shared state (not_started → in_progress → pending_verification → verified)
 * All actions share one state source: useActionPipeline
 */

import { computed } from 'vue'
import Badge from '~/components/kmki-ui/Badge/index.vue'
import { useActionPipeline } from './composables/useActionPipeline'

const props = defineProps<{ projectId: string | null }>()
const emit = defineEmits<{ navigate: [tab: string, actionId?: string] }>()

// ── Shared action pipeline (single source of truth) ──
const {
  actions,
  executing,
  fetchActions,
  executeAction,
} = useActionPipeline(computed(() => props.projectId))

// ── Dropdown state for "Agent Coming Soon" ──
const openDropdownId = ref<string | null>(null)

function toggleDropdown(id: string) {
  openDropdownId.value = openDropdownId.value === id ? null : id
}

function handleExecute(actionId: string, optimizationType?: string) {
  openDropdownId.value = null
  executeAction(actionId, optimizationType)
}

// ── Status display helpers ──
function statusBadge(status: string): { label: string; color: string } {
  switch (status) {
    case 'not_started': return { label: '未开始', color: 'gray' }
    case 'in_progress': return { label: '优化中...', color: 'blue' }
    case 'pending_verification': return { label: '验证中...', color: 'yellow' }
    case 'verified': return { label: '已完成', color: 'green' }
    default: return { label: status, color: 'gray' }
  }
}

function statusIcon(status: string): string {
  switch (status) {
    case 'not_started': return '○'
    case 'in_progress': return '◌'
    case 'pending_verification': return '◎'
    case 'verified': return '●'
    default: return '○'
  }
}
</script>

<template>
  <div class="space-y-3">
    <!-- Empty: no project -->
    <div v-if="!projectId" class="text-center text-gray-400 py-12">选择一个项目查看优化建议</div>

    <!-- Empty: no actions -->
    <div v-else-if="actions.length === 0" class="text-center text-gray-400 py-12">
      <div class="text-3xl mb-3">💡</div>
      <div class="text-sm font-medium mb-1">暂无优化建议</div>
      <p class="text-xs text-gray-500">品牌状态良好，执行检测后自动生成优化建议</p>
    </div>

    <!-- Action list -->
    <div
      v-for="action in actions"
      :key="action.id"
      class="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700"
    >
      <div class="flex items-start gap-3">
        <!-- Status indicator -->
        <div class="mt-0.5 text-lg"
          :class="{
            'text-gray-300': action.status === 'not_started',
            'text-blue-500 animate-pulse': action.status === 'in_progress',
            'text-yellow-500 animate-pulse': action.status === 'pending_verification',
            'text-green-500': action.status === 'verified',
          }"
        >
          {{ statusIcon(action.status) }}
        </div>

        <!-- Content -->
        <div class="flex-1 min-w-0">
          <div class="flex items-center justify-between mb-1">
            <div class="flex items-center gap-2">
              <span class="text-sm font-medium">{{ action.title }}</span>
              <Badge
                :label="statusBadge(action.status).label"
                :color="statusBadge(action.status).color as 'gray' | 'blue' | 'yellow' | 'green'"
                size="sm"
              />
            </div>
          </div>

          <!-- Reason from signal -->
          <p v-if="action.signal?.reason" class="text-xs text-gray-500 mb-2">{{ action.signal.reason }}</p>

          <!-- Weight & confidence -->
          <div v-if="action.signal" class="flex items-center gap-3 text-xs text-gray-400 mb-2">
            <span v-if="action.signal.weight">权重: {{ action.signal.weight?.toFixed(2) }}</span>
            <Badge
              v-if="action.signal.confidence"
              :label="action.signal.confidence"
              :color="action.signal.confidence === 'HIGH' ? 'green' : action.signal.confidence === 'MEDIUM' ? 'yellow' : 'gray'"
              size="sm"
            />
          </div>

          <!-- Verification result (if available) -->
          <div v-if="action.verificationState && action.status === 'verified'" class="text-xs space-y-0.5 mb-2">
            <span v-if="action.verificationState.delta !== undefined" class="text-green-500">
              ✅ 改善 {{ action.verificationState.delta > 0 ? '+' : '' }}{{ action.verificationState.delta }} 分
            </span>
            <span v-if="action.verificationState.beforeScore !== undefined" class="text-gray-400 block">
              {{ action.verificationState.beforeScore }} → {{ action.verificationState.afterScore }}
            </span>
          </div>

          <!-- Action buttons -->
          <div class="flex items-center gap-2 mt-2">
            <!-- Not started: show dropdown with "立即修复" -->
            <div v-if="action.status === 'not_started'" class="relative">
              <button
                class="text-xs px-3 py-1.5 rounded bg-blue-500 hover:bg-blue-600 text-white transition-colors"
                @click="handleExecute(action.id, action.id)"
                :disabled="executing"
              >
                {{ executing ? '提交中...' : '立即修复 ↗' }}
              </button>
              <div class="relative inline-block ml-1">
                <button
                  class="text-xs px-2 py-1.5 rounded bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-500 transition-colors"
                  @click="toggleDropdown(action.id)"
                >
                  ▼
                </button>
                <div v-if="openDropdownId === action.id"
                  class="absolute right-0 top-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10 min-w-[160px]"
                >
                  <button
                    class="block w-full text-left text-xs px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"
                    @click="handleExecute(action.id, action.id)"
                  >
                    🔧 手动修复
                  </button>
                  <button
                    class="block w-full text-left text-xs px-3 py-2 text-gray-400 cursor-not-allowed"
                    disabled
                  >
                    🤖 Agent 自动修复（即将开放）
                  </button>
                </div>
              </div>
            </div>

            <!-- In progress: show loading -->
            <div v-else-if="action.status === 'in_progress'" class="flex items-center gap-2">
              <span class="text-xs text-blue-500 animate-pulse">优化执行中...</span>
            </div>

            <!-- Pending verification: show polling -->
            <div v-else-if="action.status === 'pending_verification'" class="flex items-center gap-2">
              <span class="text-xs text-yellow-500 animate-pulse">验证中...</span>
            </div>

            <!-- Verified: show result + re-run -->
            <div v-else-if="action.status === 'verified'" class="flex items-center gap-2">
              <button
                class="text-xs px-3 py-1.5 rounded bg-green-500 hover:bg-green-600 text-white transition-colors"
                :disabled="executing"
              @click="emit('navigate', 'evidence', action.id)"
              >
                查看结果 →
              </button>
              <button
                class="text-xs px-3 py-1.5 rounded bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-500 transition-colors"
                @click="handleExecute(action.id, action.id)"
              >
                重新执行
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
