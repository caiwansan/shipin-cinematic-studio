<!-- @deprecated — GEO v3 Legacy. Use design-system product blocks instead. -->
<template>
  <div class="syslens">
    <div class="syslens__header">
      <h3>🔬 System Lens</h3>
      <button class="syslens__refresh-btn" :disabled="loading" @click="refresh">
        {{ loading ? '加载中...' : '🔄 刷新' }}
      </button>
    </div>

    <div v-if="error" class="syslens__error">⚠️ {{ error }}</div>
    <div v-if="!projectId" class="syslens__empty">
      <span class="syslens__empty-icon">📁</span>
      <p>请先选择一个项目</p>
    </div>

    <template v-if="projectId">
      <!-- Card 1: Execution Summary -->
      <section class="syslens__card">
        <div class="syslens__card-header">
          <span class="syslens__card-icon">⚡</span>
          <h4>执行摘要</h4>
        </div>
        <div class="syslens__card-body">
          <div v-if="execStates.length" class="syslens__cap-grid">
            <div v-for="ctx in execStates" :key="ctx.capabilityId" class="syslens__cap-item">
              <div class="syslens__cap-name">{{ capDisplayName(ctx.capabilityId) }}</div>
              <div class="syslens__cap-state">
                <span class="syslens__state-chip"
                  :style="{ background: stateColor(ctx.state) + '22', color: stateColor(ctx.state), borderColor: stateColor(ctx.state) + '44' }">
                  {{ stateIcon(ctx.state) }} {{ stateLabel(ctx.state) }}
                </span>
              </div>
              <div v-if="ctx.lastRunAt" class="syslens__cap-time">
                {{ fmtRelative(ctx.lastRunAt) }}
              </div>
              <div v-if="ctx.duration" class="syslens__cap-dur">
                {{ fmtDuration(ctx.duration) }}
              </div>
              <div v-if="ctx.mismatchCount" class="syslens__cap-warn">
                不一致: {{ ctx.mismatchCount }}
              </div>
            </div>
          </div>
          <div v-else class="syslens__placeholder">暂无执行记录</div>
        </div>
      </section>

      <!-- Card 2: Project Lifecycle -->
      <section class="syslens__card">
        <div class="syslens__card-header">
          <span class="syslens__card-icon">📊</span>
          <h4>项目生命周期</h4>
        </div>
        <div class="syslens__card-body">
          <div class="syslens__lifecycle">
            <div
              v-for="(stage, idx) in lifecycleStages"
              :key="stage.id"
              class="syslens__lifecycle-stage"
              :class="{ 'syslens__lifecycle-stage--active': stage.active, 'syslens__lifecycle-stage--done': stage.done }"
            >
              <div class="syslens__lifecycle-dot">{{ stage.done ? '✓' : stage.active ? '●' : '○' }}</div>
              <div class="syslens__lifecycle-name">{{ stage.label }}</div>
              <div v-if="idx < lifecycleStages.length - 1" class="syslens__lifecycle-line"
                :class="{ 'syslens__lifecycle-line--done': stage.done }">
              </div>
            </div>
          </div>
          <div class="syslens__lifecycle-current">
            当前状态: <strong>{{ currentStatusLabel }}</strong>
          </div>
        </div>
      </section>

      <!-- Card 3: Capability Access Map -->
      <section class="syslens__card">
        <div class="syslens__card-header">
          <span class="syslens__card-icon">🛡️</span>
          <h4>能力访问映射</h4>
        </div>
        <div class="syslens__card-body">
          <div class="syslens__cap-grid">
            <div v-for="cap in capAccessList" :key="cap.id" class="syslens__cap-item">
              <div class="syslens__cap-name">{{ capDisplayName(cap.id) }}</div>
              <div class="syslens__cap-tier">
                <span v-if="cap.accessible" class="syslens__tick">✓</span>
                <span v-else class="syslens__cross">✗</span>
                <span class="syslens__tier-label">{{ cap.requiredTier }}</span>
              </div>
            </div>
          </div>
          <div class="syslens__tier-summary">
            当前等级: <strong>{{ userTier }}</strong> —
            {{ accessibleCount }}/{{ capAccessList.length }} 能力可用
          </div>
        </div>
      </section>

      <!-- Card 4: System Health -->
      <section class="syslens__card">
        <div class="syslens__card-header">
          <span class="syslens__card-icon">🧠</span>
          <h4>系统健康</h4>
        </div>
        <div class="syslens__card-body">
          <div class="syslens__health-grid">
            <div class="syslens__health-item">
              <label>Watcher</label>
              <span :class="healthOk('watcher')">
                {{ watcherSummary && watcherSummary.total > 0 ? '🟢 运行中' : '🟡 待激活' }}
              </span>
            </div>
            <div class="syslens__health-item">
              <label>不一致数</label>
              <span :class="healthMismatch">
                {{ watcherSummary?.fail || 0 }}
              </span>
            </div>
            <div class="syslens__health-item">
              <label>Watcher 间隔</label>
              <span>8s</span>
            </div>
            <div class="syslens__health-item">
              <label>最后刷新</label>
              <span>{{ lastRefreshLabel }}</span>
            </div>
            <div class="syslens__health-item">
              <label>执行状态</label>
              <span>{{ execHealthLabel }}</span>
            </div>
            <div class="syslens__health-item">
              <label>双写模式</label>
              <span class="syslens__health--ok">🔄 DUAL_WRITE_PROJECT</span>
            </div>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import { useGeoHydrate } from '~/legacy/brand-geo/composables/useGeoHydrate'
import { ExecutionStateManager, ExecutionStateDisplay } from '~/utils/executionStateManager'
import { PermissionService, getCurrentUserTier } from '~/utils/geoCapability'
import type { CapabilityId, SubscriberTier } from '~/utils/geoCapability'

const props = defineProps<{ projectId: string | null }>()

const stateMgr = ExecutionStateManager.getInstance()
const userTier = ref<SubscriberTier>(getCurrentUserTier())
const lastRefreshTime = ref<number>(Date.now())
let unsub: (() => void) | null = null

const {
  loading,
  error,
  projectInfo,
  executionResults,
  executionSummary,
  recentWatcherEvents,
  watcherSummary,
  refresh,
  init,
  destroy,
} = useGeoHydrate(() => props.projectId)

// Execution Summary — from state machine
const execStates = computed(() => {
  if (!props.projectId) return []
  return stateMgr.getAllStates(props.projectId)
})

// 生命周期阶段映射
const lifecycleStages = computed(() => {
  const status = projectInfo.value?.status || 'draft'
  const stages = ['DRAFT', 'ACTIVE', 'RUNNING', 'COMPLETED', 'ARCHIVED']
  const currentIdx = stages.indexOf(status.toUpperCase())
  return stages.map((id, idx) => ({
    id,
    label: id.charAt(0) + id.slice(1).toLowerCase(),
    active: idx === currentIdx,
    done: idx < currentIdx,
  }))
})

const currentStatusLabel = computed(() => {
  const s = projectInfo.value?.status
  if (!s) return '未知'
  return s.charAt(0).toUpperCase() + s.slice(1)
})

// Capability Access Map
const capAccessList = computed(() => {
  return PermissionService.getAllCapabilities().map(cap => ({
    id: cap.id,
    requiredTier: cap.requiredTier,
    accessible: PermissionService.hasCapability(userTier.value, cap.id),
  }))
})

const accessibleCount = computed(() =>
  capAccessList.value.filter(c => c.accessible).length
)

// Health section
const lastRefreshLabel = computed(() => {
  const elapsed = Math.floor((Date.now() - lastRefreshTime.value) / 1000)
  if (elapsed < 5) return '刚刚'
  if (elapsed < 60) return `${elapsed}s 前`
  return `${Math.floor(elapsed / 60)}m 前`
})

const execHealthLabel = computed(() => {
  const running = execStates.value.filter(
    s => s.state === 'EXECUTING' || s.state === 'WATCHING'
  ).length
  if (running > 0) return `🟡 ${running} 个进行中`
  const failed = execStates.value.filter(s => s.state === 'FAILED').length
  if (failed > 0) return `🔴 ${failed} 个失败`
  const stable = execStates.value.filter(s => s.state === 'STABLE').length
  if (stable > 0) return `🟢 ${stable} 个已同步`
  return '⚪ 暂无执行'
})

function healthOk(key: string): string {
  return 'syslens__health--ok'
}

const healthMismatch = computed(() => {
  const m = watcherSummary.value?.fail || 0
  return m > 0 ? 'syslens__health--warn' : 'syslens__health--ok'
})

// 能力名称映射
function capDisplayName(id: string): string {
  const map: Record<string, string> = {
    'geo.project.create': '创建项目',
    'geo.project.read': '查看项目',
    'geo.project.update': '更新项目',
    'geo.project.delete': '删除项目',
    'geo.execution.discover': '实体发现',
    'geo.execution.graph.build': '知识图谱',
    'geo.execution.kq': '质量评估',
    'geo.execution.watch': '实时监控',
    'geo.graph.read': '查看图谱',
    'geo.graph.node.create': '创建节点',
    'geo.graph.edge.create': '创建边',
    'geo.system.hydrate': '系统数据',
    'geo.system.watcher': 'Watcher 流',
  }
  return map[id] || id
}

// State machine display helpers
function stateColor(state: string): string {
  return ExecutionStateDisplay[state as keyof typeof ExecutionStateDisplay]?.color || '#6b7280'
}
function stateIcon(state: string): string {
  return ExecutionStateDisplay[state as keyof typeof ExecutionStateDisplay]?.icon || '⏸️'
}
function stateLabel(state: string): string {
  return ExecutionStateDisplay[state as keyof typeof ExecutionStateDisplay]?.label || '未知'
}
function fmtRelative(ts: number): string {
  const elapsed = Date.now() - ts
  if (elapsed < 1000) return '刚刚'
  if (elapsed < 60000) return `${Math.floor(elapsed / 1000)}s 前`
  if (elapsed < 3600000) return `${Math.floor(elapsed / 60000)}m 前`
  return `${Math.floor(elapsed / 3600000)}h 前`
}
function fmtDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60000)}m`
}

// 刷新时记录时间
const origRefresh = refresh
async function handleRefresh() {
  await origRefresh()
  lastRefreshTime.value = Date.now()
}

onMounted(() => {
  init()
  unsub = stateMgr.onStateChange((ctx) => {
    if (ctx.projectId === props.projectId) {
      // force re-render via ref reactivity
      lastRefreshTime.value = Date.now()
    }
  })
})

onBeforeUnmount(() => {
  destroy()
  if (unsub) unsub()
})
</script>

<style scoped>
.syslens { padding: 24px; height: 100%; color: #e0e0e0; overflow-y: auto; }
.syslens__header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 12px; border-bottom: 1px solid #333; }
.syslens__header h3 { margin: 0; font-size: 18px; font-weight: 600; }
.syslens__refresh-btn { padding: 6px 14px; border: 1px solid #444; border-radius: 6px; background: #2a2a3a; color: #ccc; cursor: pointer; font-size: 13px; }
.syslens__refresh-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.syslens__error { padding: 12px; background: #2a1a1a; border: 1px solid #4e2a2a; border-radius: 6px; color: #cc7e7e; font-size: 13px; margin-bottom: 16px; }
.syslens__empty { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 200px; color: #666; gap: 8px; }
.syslens__empty-icon { font-size: 48px; }
.syslens__placeholder { padding: 20px; text-align: center; color: #666; font-size: 13px; }

/* Card common */
.syslens__card { margin-bottom: 16px; background: #1e1e2e; border-radius: 8px; border: 1px solid #333; overflow: hidden; }
.syslens__card-header { display: flex; align-items: center; gap: 8px; padding: 14px 16px; background: rgba(255,255,255,0.02); border-bottom: 1px solid #2a2a3a; }
.syslens__card-icon { font-size: 16px; }
.syslens__card-header h4 { margin: 0; font-size: 14px; font-weight: 600; color: #ccc; text-transform: uppercase; letter-spacing: 0.5px; }
.syslens__card-body { padding: 16px; }

/* Capability grid (reused in card 1 + 3) */
.syslens__cap-grid { display: flex; flex-direction: column; gap: 8px; }
.syslens__cap-item { display: flex; align-items: center; gap: 12px; padding: 8px 10px; background: rgba(255,255,255,0.02); border-radius: 6px; }
.syslens__cap-name { font-size: 13px; color: #ccc; min-width: 100px; }
.syslens__cap-state { flex: 1; }
.syslens__cap-time, .syslens__cap-dur { font-size: 11px; color: #6b7280; font-family: monospace; }
.syslens__cap-warn { font-size: 11px; color: #f97316; }
.syslens__state-chip { padding: 3px 10px; border-radius: 12px; font-size: 11px; font-weight: 600; border: 1px solid; }

/* Capability access map */
.syslens__cap-tier { display: flex; align-items: center; gap: 6px; }
.syslens__tick { color: #22c55e; font-weight: 700; font-size: 14px; }
.syslens__cross { color: #ef4444; font-weight: 700; font-size: 14px; }
.syslens__tier-label { font-size: 11px; color: #888; font-family: monospace; text-transform: uppercase; }
.syslens__tier-summary { margin-top: 12px; padding: 10px; background: rgba(255,255,255,0.02); border-radius: 6px; font-size: 13px; color: #aaa; }

/* Lifecycle */
.syslens__lifecycle { display: flex; align-items: flex-start; gap: 0; margin-bottom: 12px; }
.syslens__lifecycle-stage { display: flex; flex-direction: column; align-items: center; position: relative; flex: 1; }
.syslens__lifecycle-dot { width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; margin-bottom: 6px; background: #2a2a3a; color: #666; border: 2px solid #333; }
.syslens__lifecycle-stage--done .syslens__lifecycle-dot { background: #1a3a2a; color: #22c55e; border-color: #22c55e; }
.syslens__lifecycle-stage--active .syslens__lifecycle-dot { background: #1a3a5a; color: #3b82f6; border-color: #3b82f6; box-shadow: 0 0 8px rgba(59,130,246,0.3); }
.syslens__lifecycle-name { font-size: 10px; color: #888; text-align: center; }
.syslens__lifecycle-line { width: 100%; height: 2px; background: #333; position: absolute; top: 11px; left: 50%; }
.syslens__lifecycle-line--done { background: #22c55e; }
.syslens__lifecycle-current { padding: 8px 12px; background: rgba(255,255,255,0.02); border-radius: 6px; font-size: 13px; color: #aaa; }

/* Health */
.syslens__health-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.syslens__health-item { display: flex; flex-direction: column; gap: 4px; }
.syslens__health-item label { font-size: 11px; color: #888; text-transform: uppercase; }
.syslens__health-item span { font-size: 13px; }
.syslens__health--ok { color: #22c55e; }
.syslens__health--warn { color: #f97316; }
</style>
