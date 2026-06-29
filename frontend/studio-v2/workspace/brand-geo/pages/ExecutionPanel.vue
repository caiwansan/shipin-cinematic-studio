<template>
  <div class="execution-panel">
    <div class="execution-panel__header">
      <h3>⚡ 执行控制台</h3>
      <button class="execution-panel__refresh-btn" @click="refresh" :disabled="loading">
        {{ loading ? '加载中...' : '🔄 刷新' }}
      </button>
    </div>

    <div v-if="!projectId" class="execution-panel__empty">
      <span class="execution-panel__empty-icon">📁</span>
      <p>请先选择一个项目</p>
    </div>

    <template v-else>
      <!-- Project Info -->
      <section class="execution-panel__section">
        <h4>📋 项目信息</h4>
        <div class="execution-panel__grid">
          <div class="execution-panel__field">
            <label>ID</label>
            <code>{{ projectInfo?.id?.slice(0, 12) }}...</code>
          </div>
          <div class="execution-panel__field" v-if="projectInfo">
            <label>名称</label>
            <span>{{ projectInfo?.name }}</span>
          </div>
          <div class="execution-panel__field" v-if="projectInfo">
            <label>状态</label>
            <span :class="statusBadge(projectInfo.status)">{{ projectInfo.status }}</span>
          </div>
          <div class="execution-panel__field" v-if="projectInfo?.tenantId">
            <label>租户</label>
            <code>{{ projectInfo.tenantId?.slice(0, 12) }}...</code>
          </div>
        </div>
      </section>

      <!-- Actions -->
      <section class="execution-panel__section">
        <h4>🎯 执行动作</h4>
        <div class="execution-panel__actions">
          <button v-if="canDiscover" class="execution-panel__action-btn"
            @click="wrapAction('geo.execution.discover', discoverEntities)" :disabled="anyExecuting">
            <span v-if="discoverState.state === 'EXECUTING'" class="execution-panel__spinner"></span>
            {{ buttonLabel(discoverState.state, '🔍 实体发现') }}
          </button>
          <button v-if="canBuildGraph" class="execution-panel__action-btn"
            @click="wrapAction('geo.execution.graph.build', buildKnowledgeGraph)" :disabled="anyExecuting">
            <span v-if="graphState.state === 'EXECUTING'" class="execution-panel__spinner"></span>
            {{ buttonLabel(graphState.state, '🔗 知识图谱') }}
          </button>
          <button v-if="canRunKQ" class="execution-panel__action-btn"
            @click="wrapAction('geo.execution.kq', evaluateQuality)" :disabled="anyExecuting">
            <span v-if="kqState.state === 'EXECUTING'" class="execution-panel__spinner"></span>
            {{ buttonLabel(kqState.state, '✅ 质量评估') }}
          </button>
        </div>

        <!-- Per-capability state badges -->
        <div class="execution-panel__state-row">
          <div class="execution-panel__state-chip" v-if="discoverState.state !== 'IDLE'">
            <span>实体发现</span>
            <span class="execution-panel__state-badge"
              :style="{ background: ExecutionStateDisplay[discoverState.state].color + '22', color: ExecutionStateDisplay[discoverState.state].color, borderColor: ExecutionStateDisplay[discoverState.state].color + '44' }">
              {{ ExecutionStateDisplay[discoverState.state].icon }} {{ ExecutionStateDisplay[discoverState.state].label }}
            </span>
          </div>
          <div class="execution-panel__state-chip" v-if="graphState.state !== 'IDLE'">
            <span>知识图谱</span>
            <span class="execution-panel__state-badge"
              :style="{ background: ExecutionStateDisplay[graphState.state].color + '22', color: ExecutionStateDisplay[graphState.state].color, borderColor: ExecutionStateDisplay[graphState.state].color + '44' }">
              {{ ExecutionStateDisplay[graphState.state].icon }} {{ ExecutionStateDisplay[graphState.state].label }}
            </span>
          </div>
          <div class="execution-panel__state-chip" v-if="kqState.state !== 'IDLE'">
            <span>质量评估</span>
            <span class="execution-panel__state-badge"
              :style="{ background: ExecutionStateDisplay[kqState.state].color + '22', color: ExecutionStateDisplay[kqState.state].color, borderColor: ExecutionStateDisplay[kqState.state].color + '44' }">
              {{ ExecutionStateDisplay[kqState.state].icon }} {{ ExecutionStateDisplay[kqState.state].label }}
            </span>
          </div>
        </div>

        <div v-if="!canDiscover && !canBuildGraph && !canRunKQ" class="execution-panel__tier-locked">
          当前为 FREE 等级。升级到 VIP 后可解锁执行功能。
        </div>

        <!-- 状态 badge 区已迁移到 per-capability state-row 上方 -->
      </section>

      <!-- Execution Status -->
      <section class="execution-panel__section">
        <h4>🏗️ 执行状态</h4>
        <div v-if="executionSummary" class="execution-panel__stats">
          <div class="execution-panel__stat" v-for="(val, key) in executionSummary" :key="key">
            <label>{{ key }}</label>
            <span>{{ val }}</span>
          </div>
        </div>
        <div v-else class="execution-panel__placeholder">暂无执行记录</div>

        <details v-if="projectInfo?.executionResults">
          <summary>查看执行结果 JSON</summary>
          <pre class="execution-panel__json">{{ JSON.stringify(projectInfo.executionResults, null, 2) }}</pre>
        </details>
      </section>

      <!-- Watcher Events -->
      <section class="execution-panel__section" v-if="canWatch">
        <h4>👁️ 实时事件流</h4>
        <template v-if="recentWatcherEvents.length">
          <div class="execution-panel__watcher-summary" v-if="watcherSummary">
            <span>总计 {{ watcherSummary.total }}</span>
            <span class="execution-panel__watcher-ok">成功 {{ watcherSummary.success }}</span>
            <span v-if="watcherSummary.fail" class="execution-panel__watcher-fail">失败 {{ watcherSummary.fail }}</span>
          </div>
          <div class="execution-panel__watcher-list">
            <div v-for="ev in recentWatcherEvents" :key="ev.id" class="execution-panel__watcher-item">
              <span :class="watcherDot(ev.status)"></span>
              <code>{{ ev.entity }}</code>
              <span class="execution-panel__watcher-op">{{ ev.operation }}</span>
              <span class="execution-panel__watcher-time">{{ fmtTime(ev.created_at) }}</span>
              <span v-if="ev.latency_ms" class="execution-panel__watcher-ms">{{ ev.latency_ms }}ms</span>
            </div>
          </div>
        </template>
        <div v-else class="execution-panel__placeholder">暂无事件</div>
      </section>

      <!-- Dual Write Status -->
      <section class="execution-panel__section">
        <h4>🔄 双写状态</h4>
        <div class="execution-panel__flags">
          <div class="execution-panel__flag">
            <span class="execution-panel__dot execution-panel__dot--on"></span>
            DUAL_WRITE_PROJECT
          </div>
          <div class="execution-panel__flag">
            <span class="execution-panel__dot execution-panel__dot--off"></span>
            DUAL_WRITE_GEO_PROFILE
          </div>
        </div>
      </section>

      <div v-if="error" class="execution-panel__error">⚠️ {{ error }}</div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { useGeoHydrate } from '~/studio-v2/workspace/brand-geo/composables/useGeoHydrate'
import { PermissionService, getCurrentUserTier } from '~/utils/geoCapability'
import type { SubscriberTier } from '~/utils/geoCapability'
import { ExecutionStateManager, ExecutionStateDisplay } from '~/utils/executionStateManager'
import type { ExecutionState, CapabilityId } from '~/utils/executionStateManager'

const props = defineProps<{ projectId: string | null }>()

// 权限层
const userTier = ref<SubscriberTier>(getCurrentUserTier())
const canDiscover = computed(() => PermissionService.hasCapability(userTier.value, 'geo.execution.discover'))
const canBuildGraph = computed(() => PermissionService.hasCapability(userTier.value, 'geo.execution.graph.build'))
const canRunKQ = computed(() => PermissionService.hasCapability(userTier.value, 'geo.execution.kq'))
const canWatch = computed(() => PermissionService.hasCapability(userTier.value, 'geo.execution.watch'))

// State Manager
const stateMgr = ExecutionStateManager.getInstance()

// Per-capability state refs (reactive wrappers around state manager)
const discoverState = ref(stateMgr.getState(props.projectId || '', 'geo.execution.discover'))
const graphState = ref(stateMgr.getState(props.projectId || '', 'geo.execution.graph.build'))
const kqState = ref(stateMgr.getState(props.projectId || '', 'geo.execution.kq'))

// Watch for state changes
onMounted(() => {
  const unsub = stateMgr.onStateChange((ctx) => {
    if (ctx.projectId !== props.projectId) return
    if (ctx.capabilityId === 'geo.execution.discover') discoverState.value = ctx
    if (ctx.capabilityId === 'geo.execution.graph.build') graphState.value = ctx
    if (ctx.capabilityId === 'geo.execution.kq') kqState.value = ctx
  })
  // store unsub for cleanup
  ;(window as any).__geo_state_unsub = unsub
})

onBeforeUnmount(() => {
  const unsub = (window as any).__geo_state_unsub
  if (unsub) unsub()
})

// 每个 button 是否 disabled
const anyExecuting = computed(() =>
  discoverState.value.state === 'EXECUTING' ||
  graphState.value.state === 'EXECUTING' ||
  kqState.value.state === 'EXECUTING'
)

const {
  state,
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

onMounted(init)
onBeforeUnmount(destroy)

// 状态机包装器 — 调用 API + 驱动状态转换
async function wrapAction(capabilityId: CapabilityId, apiFn: () => Promise<any>) {
  if (!props.projectId) return
  stateMgr.start(props.projectId, capabilityId)
  try {
    const result = await apiFn()
    stateMgr.complete(props.projectId, capabilityId, result)
    // 3 秒后检查 watcher event → 模拟 stable 判定
    setTimeout(() => {
      const ctx = stateMgr.getState(props.projectId!, capabilityId)
      if (ctx.state === 'WATCHING') {
        // watcher mismatch count 可通过 hydrate refresh 获知
        // 当前使用最近 watcher 事件判断
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

function buttonLabel(state: ExecutionState, defaultLabel: string): string {
  if (state === 'EXECUTING') return '执行中...'
  if (state === 'STABLE') return '✅ ' + defaultLabel.replace(/^[^\s]+\s/, '')
  return defaultLabel
}

function statusBadge(s: string) {
  const m: Record<string, string> = {
    draft: 'chip chip--draft',
    active: 'chip chip--active',
    completed: 'chip chip--done',
    archived: 'chip chip--archived',
  }
  return m[s] || 'chip'
}

function watcherDot(s: string) {
  if (s === 'SUCCESS') return 'dot dot--ok'
  if (s === 'FAIL') return 'dot dot--fail'
  return 'dot'
}

function fmtTime(t: string) {
  if (!t) return '—'
  return new Date(t).toLocaleTimeString()
}
</script>

<style scoped>
.execution-panel { height: 100%; overflow-y: auto; padding: 20px; color: #e0e0e0; }
.execution-panel__header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; padding-bottom: 12px; border-bottom: 1px solid #333; }
.execution-panel__header h3 { margin: 0; font-size: 18px; font-weight: 600; }
.execution-panel__refresh-btn { padding: 6px 14px; border: 1px solid #444; border-radius: 6px; background: #2a2a3a; color: #ccc; cursor: pointer; font-size: 13px; }
.execution-panel__refresh-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.execution-panel__empty { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 200px; color: #666; }
.execution-panel__empty-icon { font-size: 48px; margin-bottom: 12px; }
.execution-panel__section { margin-bottom: 20px; padding: 16px; background: #1e1e2e; border-radius: 8px; border: 1px solid #333; }
.execution-panel__section h4 { margin: 0 0 12px; font-size: 14px; font-weight: 600; color: #aaa; text-transform: uppercase; letter-spacing: 0.5px; }

.execution-panel__grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 12px; }
.execution-panel__field { display: flex; flex-direction: column; gap: 4px; }
.execution-panel__field label { font-size: 11px; color: #888; text-transform: uppercase; }
.execution-panel__field code { font-size: 12px; font-family: monospace; color: #4ecca3; word-break: break-all; }

.chip { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 500; }
.chip--draft { background: #333; color: #aaa; }
.chip--active { background: #1a3a2a; color: #4ecca3; }
.chip--done { background: #1a3a5a; color: #4ea3cc; }
.chip--archived { background: #2a1a1a; color: #cc4e4e; }

.execution-panel__actions { display: flex; gap: 12px; flex-wrap: wrap; }
.execution-panel__action-btn { display: flex; align-items: center; gap: 6px; padding: 10px 20px; border: 1px solid #444; border-radius: 8px; background: linear-gradient(180deg, #2a2a3e 0%, #1e1e30 100%); color: #ddd; cursor: pointer; font-size: 14px; font-weight: 500; }
.execution-panel__action-btn:hover:not(:disabled) { border-color: #4ecca3; color: #fff; background: linear-gradient(180deg, #2a3a3e 0%, #1e2e30 100%); }
.execution-panel__action-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.execution-panel__spinner { display: inline-block; width: 14px; height: 14px; border: 2px solid #4ecca3; border-top-color: transparent; border-radius: 50%; animation: spin 0.6s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.execution-panel__action-result { margin-top: 12px; padding: 10px 14px; border-radius: 6px; font-size: 13px; }
.execution-panel__action-result--ok { background: #1a2a2a; border: 1px solid #2a4a3a; color: #4ecca3; }
.execution-panel__action-result--fail { background: #2a1a1a; border: 1px solid #4e2a2a; color: #cc7e7e; }
.execution-panel__state-row { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px; }
.execution-panel__state-chip { display: flex; align-items: center; gap: 6px; font-size: 12px; }
.execution-panel__state-chip > span:first-child { color: #888; }
.execution-panel__state-badge { padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; border: 1px solid; }

.execution-panel__stats { display: flex; gap: 24px; }
.execution-panel__stat { display: flex; flex-direction: column; gap: 4px; }
.execution-panel__stat label { font-size: 11px; color: #888; text-transform: uppercase; }
.execution-panel__stat span { font-size: 22px; font-weight: 700; color: #4ecca3; }
.execution-panel__placeholder { padding: 12px; text-align: center; color: #666; font-size: 13px; }
.execution-panel__json { max-height: 300px; overflow: auto; padding: 12px; background: #12121e; border-radius: 6px; font-size: 12px; line-height: 1.5; color: #aaccbb; }

.execution-panel__watcher-summary { display: flex; gap: 16px; margin-bottom: 8px; font-size: 12px; color: #888; }
.execution-panel__watcher-ok { color: #4ecca3; }
.execution-panel__watcher-fail { color: #cc4e4e; }
.execution-panel__watcher-list { display: flex; flex-direction: column; gap: 4px; }
.execution-panel__watcher-item { display: flex; align-items: center; gap: 8px; padding: 5px 8px; border-radius: 4px; background: #16162a; font-size: 12px; font-family: monospace; }
.execution-panel__watcher-op { color: #4ea3cc; }
.execution-panel__watcher-time { color: #666; }
.execution-panel__watcher-ms { color: #888; }

.dot { width: 6px; height: 6px; border-radius: 50%; background: #555; flex-shrink: 0; }
.dot--ok { background: #4ecca3; }
.dot--fail { background: #cc4e4e; }

.execution-panel__flags { display: flex; flex-direction: column; gap: 8px; }
.execution-panel__flag { display: flex; align-items: center; gap: 8px; font-size: 13px; font-family: monospace; }
.execution-panel__dot { width: 8px; height: 8px; border-radius: 50%; }
.execution-panel__dot--on { background: #4ecca3; }
.execution-panel__dot--off { background: #555; }

.execution-panel__error { padding: 12px; background: #2a1a1a; border: 1px solid #4e2a2a; border-radius: 6px; color: #cc7e7e; font-size: 13px; }
.execution-panel__tier-locked { padding: 12px; background: rgba(107, 114, 128, 0.05); border: 1px solid rgba(107, 114, 128, 0.1); border-radius: 8px; color: #6b7280; font-size: 13px; text-align: center; }
details { cursor: pointer; }
details summary { font-size: 13px; color: #888; padding: 4px 0; }
details summary:hover { color: #4ecca3; }
</style>
