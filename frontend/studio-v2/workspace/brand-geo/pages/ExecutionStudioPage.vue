<template>
  <div class="exec-studio">
    <div class="exec-studio__header">
      <h3>🎬 Execution Studio</h3>
      <button class="exec-studio__refresh-btn" :disabled="loading" @click="refresh">
        {{ loading ? '刷新中...' : '🔄 刷新' }}
      </button>
    </div>

    <div v-if="error" class="exec-studio__error">⚠️ {{ error }}</div>
    <div v-if="!projectId" class="exec-studio__empty">
      <span class="exec-studio__empty-icon">📁</span>
      <span>请先选择一个项目</span>
    </div>

    <template v-if="projectId && !loading">
      <!-- Two-column layout: Timeline + Output -->
      <div class="exec-studio__layout">
        <div class="exec-studio__timeline-col">
          <WorkflowTimeline
            :project-id="projectId"
            @execute="handleExecute"
          />
        </div>
        <div class="exec-studio__output-col">
          <ExecutionOutputPanel
            :watcher-enabled="canWatch"
            :recent-watcher-events="recentWatcherEvents"
            :watcher-summary="watcherSummary"
            :execution-summary="executionSummary"
            :project-info="projectInfo"
          />
        </div>
      </div>

      <!-- Mini state inspector  -->
      <div class="exec-studio__mini-inspector">
        <details>
          <summary>🧠 Execution State Debug</summary>
          <div class="exec-studio__debug-grid">
            <div v-for="ctx in allStates" :key="ctx.capabilityId" class="exec-studio__debug-item">
              <code>{{ ctx.capabilityId }}</code>
              <span class="exec-studio__debug-state"
                :style="{ color: stateColor(ctx.state) }">
                {{ ctx.state }}
              </span>
              <span v-if="ctx.duration" class="exec-studio__debug-ms">{{ ctx.duration }}ms</span>
            </div>
          </div>
        </details>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount } from 'vue'
import { useGeoHydrate } from '~/studio-v2/workspace/brand-geo/composables/useGeoHydrate'
import { PermissionService, getCurrentUserTier } from '~/utils/geoCapability'
import type { CapabilityId } from '~/utils/geoCapability'
import { ExecutionStateManager, ExecutionStateDisplay } from '~/utils/executionStateManager'
import WorkflowTimeline from '../components/WorkflowTimeline.vue'
import ExecutionOutputPanel from '../components/ExecutionOutputPanel.vue'

const props = defineProps<{ projectId: string | null }>()

const userTier = computed(() => getCurrentUserTier())
const canWatch = computed(() => PermissionService.hasCapability(userTier.value, 'geo.execution.watch'))

const {
  loading,
  error,
  projectInfo,
  executionSummary,
  recentWatcherEvents,
  watcherSummary,
  discoverEntities,
  buildKnowledgeGraph,
  evaluateQuality,
  refresh,
  init,
  destroy,
} = useGeoHydrate(() => props.projectId)

const stateMgr = ExecutionStateManager.getInstance()

const allStates = computed(() => {
  if (!props.projectId) return []
  return stateMgr.getAllStates(props.projectId)
})

// 处理 WorkflowTimeline 触发的执行
async function handleExecute(capabilityId: CapabilityId) {
  if (!props.projectId) return

  stateMgr.start(props.projectId, capabilityId)

  try {
    let result: any
    if (capabilityId === 'geo.execution.discover') {
      result = await discoverEntities()
    } else if (capabilityId === 'geo.execution.graph.build') {
      result = await buildKnowledgeGraph()
    } else if (capabilityId === 'geo.execution.kq') {
      result = await evaluateQuality()
    }

    stateMgr.complete(props.projectId, capabilityId, result)

    // 3s 后基于 watcher 数据判定 stable / drifted
    setTimeout(() => {
      const ctx = stateMgr.getState(props.projectId!, capabilityId)
      if (ctx.state === 'WATCHING') {
        const mismatch = watcherSummary.value?.fail || 0
        if (mismatch > 0) {
          stateMgr.markDrifted(props.projectId!, capabilityId, mismatch)
        } else {
          stateMgr.markStable(props.projectId!, capabilityId)
        }
      }
    }, 3000)

    await refresh()
  } catch (err: any) {
    stateMgr.fail(props.projectId, capabilityId, err.message)
    error.value = err.message
  }
}

function stateColor(state: string): string {
  return ExecutionStateDisplay[state as keyof typeof ExecutionStateDisplay]?.color || '#6b7280'
}

// 生命周期
onMounted(init)
onBeforeUnmount(destroy)
</script>

<style scoped>
.exec-studio { padding: 24px; height: 100%; color: #e0e0e0; overflow-y: auto; }
.exec-studio__header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 12px; border-bottom: 1px solid #333; }
.exec-studio__header h3 { margin: 0; font-size: 18px; font-weight: 600; }
.exec-studio__refresh-btn { padding: 6px 14px; border: 1px solid #444; border-radius: 6px; background: #2a2a3a; color: #ccc; cursor: pointer; font-size: 13px; }
.exec-studio__refresh-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.exec-studio__error { padding: 12px; background: #2a1a1a; border: 1px solid #4e2a2a; border-radius: 6px; color: #cc7e7e; font-size: 13px; margin-bottom: 16px; }
.exec-studio__empty { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 200px; color: #666; gap: 8px; }
.exec-studio__empty-icon { font-size: 48px; }

/* Two-column layout */
.exec-studio__layout { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 16px; }
@media (max-width: 900px) { .exec-studio__layout { grid-template-columns: 1fr; } }
.exec-studio__timeline-col { min-width: 0; }
.exec-studio__output-col { min-width: 0; }

/* Mini debug */
.exec-studio__mini-inspector { margin-top: 8px; }
.exec-studio__mini-inspector details { cursor: pointer; }
.exec-studio__mini-inspector summary { font-size: 13px; color: #888; padding: 4px 0; }
.exec-studio__mini-inspector summary:hover { color: #4ecca3; }
.exec-studio__debug-grid { display: flex; flex-direction: column; gap: 4px; padding: 12px; background: #12121e; border-radius: 6px; margin-top: 4px; }
.exec-studio__debug-item { display: flex; gap: 12px; align-items: center; font-size: 12px; font-family: monospace; }
.exec-studio__debug-item code { color: #ccc; min-width: 180px; }
.exec-studio__debug-state { font-weight: 600; }
.exec-studio__debug-ms { color: #6b7280; margin-left: auto; }
</style>
