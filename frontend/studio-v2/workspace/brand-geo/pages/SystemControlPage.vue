<template>
  <div class="sysctl">
    <div class="sysctl__header">
      <h3>⚙️ System Control</h3>
      <button class="sysctl__refresh-btn" :disabled="loading" @click="refresh">
        {{ loading ? '加载中...' : '🔄 刷新' }}
      </button>
    </div>

    <div v-if="error" class="sysctl__error">⚠️ {{ error }}</div>
    <div v-if="!projectId" class="sysctl__empty">
      <span class="sysctl__empty-icon">📁</span>
      <p>请先选择一个项目</p>
    </div>

    <template v-if="projectId">
      <!-- Panel 1: Feature Flag View -->
      <section class="sysctl__panel">
        <div class="sysctl__panel-header">
          <span class="sysctl__panel-icon">🚩</span>
          <h4>Feature Flags</h4>
          <span class="sysctl__panel-count">{{ flags.length }} flags</span>
        </div>
        <div class="sysctl__panel-body">
          <div class="sysctl__flag-list">
            <div v-for="flag in flags" :key="flag.key" class="sysctl__flag-item">
              <div class="sysctl__flag-main">
                <span :class="['sysctl__flag-dot', flag.enabled ? 'sysctl__flag-dot--on' : 'sysctl__flag-dot--off']"></span>
                <code class="sysctl__flag-key">{{ flag.key }}</code>
                <span :class="['sysctl__flag-badge', flag.enabled ? 'sysctl__flag-badge--on' : 'sysctl__flag-badge--off']">
                  {{ flag.enabled ? 'ENABLED' : 'DISABLED' }}
                </span>
              </div>
              <div class="sysctl__flag-desc">{{ flag.description }}</div>
              <div v-if="flag.dependencies?.length" class="sysctl__flag-deps">
                依赖: {{ flag.dependencies.join(', ') }}
              </div>
              <div v-if="flag.effective" class="sysctl__flag-note">
                {{ flag.effective }}
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Panel 2: Tier & Capability -->
      <section class="sysctl__panel">
        <div class="sysctl__panel-header">
          <span class="sysctl__panel-icon">🛡️</span>
          <h4>Tier &amp; Capability</h4>
          <span class="sysctl__panel-count">{{ userTier }}</span>
        </div>
        <div class="sysctl__panel-body">
          <div class="sysctl__tier-bar">
            <span v-for="t in allTiers" :key="t"
              :class="['sysctl__tier-chip', tierChipClass(t)]"
              @click="overrideTier(t)">
              {{ t }}
            </span>
            <span v-if="tierOverridden" class="sysctl__tier-override-note">
              (localStorage override — 清除后恢复)
            </span>
          </div>
          <div class="sysctl__cap-matrix">
            <div v-for="group in capGroups" :key="group.name" class="sysctl__cap-group">
              <div class="sysctl__cap-group-name">{{ group.name }}</div>
              <div class="sysctl__cap-group-items">
                <div v-for="cap in group.items" :key="cap.id"
                  :class="['sysctl__cap-cell', cap.accessible ? 'sysctl__cap-cell--on' : 'sysctl__cap-cell--off']">
                  <span class="sysctl__cap-icon">{{ cap.accessible ? '✓' : '✗' }}</span>
                  <span class="sysctl__cap-label">{{ cap.label }}</span>
                  <span class="sysctl__cap-tier">{{ cap.requiredTier }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Panel 3: Execution Debug -->
      <section class="sysctl__panel">
        <div class="sysctl__panel-header">
          <span class="sysctl__panel-icon">🐛</span>
          <h4>Execution Debug</h4>
          <span class="sysctl__panel-count">{{ execStates.length }} states</span>
        </div>
        <div class="sysctl__panel-body">
          <div class="sysctl__debug-grid">
            <div class="sysctl__debug-item">
              <label>Watcher</label>
              <span :class="watcherHealthClass">
                {{ watcherSummary && watcherSummary.total > 0 ? '🟢 Active' : '🟡 Inactive' }}
              </span>
            </div>
            <div class="sysctl__debug-item">
              <label>Dual Write (Project)</label>
              <span class="sysctl__health--ok">🔄 Active</span>
            </div>
            <div class="sysctl__debug-item">
              <label>Dual Write (GeoProfile)</label>
              <span class="sysctl__health--pending">⏸️ Shadow Run Only</span>
            </div>
            <div class="sysctl__debug-item">
              <label>Execution Count</label>
              <span>{{ execStates.filter(s => s.state !== 'IDLE').length }}</span>
            </div>
            <div class="sysctl__debug-item">
              <label>Drift Count</label>
              <span :class="driftHealthClass">{{ totalMismatch }}</span>
            </div>
            <div class="sysctl__debug-item">
              <label>Last Watcher Event</label>
              <span>{{ lastWatcherTime }}</span>
            </div>
          </div>
        </div>
      </section>

      <!-- Panel 4: System Introspection -->
      <section class="sysctl__panel">
        <div class="sysctl__panel-header">
          <span class="sysctl__panel-icon">🧠</span>
          <h4>System Introspection</h4>
          <span class="sysctl__panel-count">snapshot</span>
        </div>
        <div class="sysctl__panel-body">
          <div class="sysctl__intro-grid">
            <div class="sysctl__intro-section">
              <h5>Execution Graph Snapshot</h5>
              <div class="sysctl__intro-flow">
                <span v-for="(ctx, idx) in execStates" :key="ctx.capabilityId">
                  <span :style="{ color: stateColor(ctx.state) }" class="sysctl__intro-node">
                    {{ shortCapName(ctx.capabilityId) }} [{{ ctx.state }}]
                  </span>
                  <span v-if="idx < execStates.length - 1" class="sysctl__intro-arrow">→</span>
                </span>
              </div>
              <div v-if="!execStates.length" class="sysctl__intro-empty">(empty — no executions yet)</div>
            </div>

            <div class="sysctl__intro-section">
              <h5>Capability Load</h5>
              <div class="sysctl__intro-load">
                <div class="sysctl__load-bar" v-for="(ctx, idx) in execStates" :key="'load-' + idx">
                  <span class="sysctl__load-name">{{ shortCapName(ctx.capabilityId) }}</span>
                  <div class="sysctl__load-track">
                    <div class="sysctl__load-fill" :style="{
                      width: ctx.duration ? Math.min((ctx.duration / 10000) * 100, 100) + '%' : '0%',
                      background: stateColor(ctx.state)
                    }"></div>
                  </div>
                  <span class="sysctl__load-ms">{{ ctx.duration ? ctx.duration + 'ms' : '—' }}</span>
                </div>
              </div>
            </div>

            <div class="sysctl__intro-section">
              <h5>Recent Execution Traces</h5>
              <div v-if="watcherSummary" class="sysctl__trace-summary">
                <div class="sysctl__trace-stat">
                  <label>Total Watcher Events</label>
                  <span>{{ watcherSummary.total }}</span>
                </div>
                <div class="sysctl__trace-stat">
                  <label>Success</label>
                  <span class="sysctl__health--ok">{{ watcherSummary.success }}</span>
                </div>
                <div class="sysctl__trace-stat" v-if="watcherSummary.fail">
                  <label>Fail</label>
                  <span class="sysctl__health--warn">{{ watcherSummary.fail }}</span>
                </div>
              </div>
              <div class="sysctl__trace-list">
                <div v-for="ev in recentWatcherEvents.slice(0, 8)" :key="ev.id" class="sysctl__trace-item">
                  <span :class="ev.status === 'SUCCESS' ? 'sysctl__trace-ok' : 'sysctl__trace-fail'">
                    {{ ev.status === 'SUCCESS' ? '✓' : '✗' }}
                  </span>
                  <code>{{ ev.entity }}</code>
                  <span class="sysctl__trace-op">{{ ev.operation }}</span>
                  <span class="sysctl__trace-ms">{{ ev.latency_ms }}ms</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Panel 5: Developer Console (collapsible) -->
      <section class="sysctl__panel dev-console-panel">
        <div class="sysctl__panel-header dev-console-header" @click="devConsoleExpanded = !devConsoleExpanded">
          <span class="sysctl__panel-icon">⚙</span>
          <h4>Dev Console</h4>
          <span class="dev-console-toggle">{{ devConsoleExpanded ? '▾' : '▸' }}</span>
        </div>
        <div v-if="devConsoleExpanded" class="sysctl__panel-body dev-console-body">
          <ExecutionTraceViewer ref="traceViewerRef" />
        </div>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import ExecutionTraceViewer from '~/studio-v2/workspace/brand-geo/components/runtime/ExecutionTraceViewer.vue'
import { useGeoHydrate } from '~/studio-v2/workspace/brand-geo/composables/useGeoHydrate'
import { ExecutionStateManager, ExecutionStateDisplay } from '~/utils/executionStateManager'
import { PermissionService, getCurrentUserTier } from '~/utils/geoCapability'
import type { CapabilityId, SubscriberTier } from '~/utils/geoCapability'
import type { FeatureFlagKey } from '~/utils/featureFlags'
import { getAllFeatureFlags } from '~/utils/featureFlags'

const props = defineProps<{ projectId: string | null }>()

const stateMgr = ExecutionStateManager.getInstance()
const userTier = ref<SubscriberTier>(getCurrentUserTier())
const tierOverridden = ref(false)
const devConsoleExpanded = ref(false)
const traceViewerRef = ref<InstanceType<typeof ExecutionTraceViewer> | null>(null)
let unsub: (() => void) | null = null

const {
  loading,
  error,
  executionSummary,
  recentWatcherEvents,
  watcherSummary,
  refresh,
  init,
  destroy,
} = useGeoHydrate(() => props.projectId)

// ═══════════════════════════════════════════════
// Panel 1: Feature Flags
// ═══════════════════════════════════════════════
const flags = computed(() => {
  const raw = getAllFeatureFlags()
  return Object.entries(raw).map(([key, enabled]) => ({
    key,
    enabled,
    description: getFlagDescription(key),
    dependencies: getFlagDeps(key),
    effective: getFlagEffective(key, enabled),
  }))
})

function getFlagDescription(key: string): string {
  const descs: Record<string, string> = {
    'project-v2-enabled': '统一 Project 主实体（替代 GEOProject/HdzProject）',
    'tenant-isolation-enabled': '多租户数据隔离',
    'feature-gate-enabled': 'Feature Gate 统一权限体系',
    'resource-platform-enabled': 'Resource Platform v4.2',
    'geo-use-legacy-project': 'GEO 使用旧 GEOProject 表',
  }
  return descs[key] || key
}

function getFlagDeps(key: string): string[] | null {
  const deps: Record<string, string[]> = {
    'tenant-isolation-enabled': ['project-v2-enabled'],
    'resource-platform-enabled': ['project-v2-enabled', 'tenant-isolation-enabled'],
  }
  return deps[key] || null
}

function getFlagEffective(key: string, enabled: boolean): string | null {
  if (key === 'geo-use-legacy-project' && !enabled) return '已切换到新 Project+GeoProfile 架构'
  if (key === 'tenant-isolation-enabled' && enabled) return '数据已按 tenantId 隔离'
  return null
}

// ═══════════════════════════════════════════════
// Panel 2: Tier & Capability
// ═══════════════════════════════════════════════
const allTiers: SubscriberTier[] = ['FREE', 'VIP_1', 'VIP_2', 'ADMIN']
const capTierOrder: Record<SubscriberTier, number> = { FREE: 0, VIP_1: 1, VIP_2: 2, ADMIN: 99 }

interface CapGroup {
  name: string
  items: Array<{ id: string; label: string; requiredTier: string; accessible: boolean }>
}

const capGroups = computed<CapGroup[]>(() => {
  const all = PermissionService.getAllCapabilities()
  const tier = userTier.value

  const groups: Record<string, CapGroup> = {
    project: { name: 'Project CRUD', items: [] },
    execution: { name: 'Execution', items: [] },
    graph: { name: 'Graph', items: [] },
    system: { name: 'System', items: [] },
  }

  const labelMap: Record<string, string> = {
    'geo.project.create': 'Create', 'geo.project.read': 'Read',
    'geo.project.update': 'Update', 'geo.project.delete': 'Delete',
    'geo.execution.discover': 'Discover', 'geo.execution.graph.build': 'Graph Build',
    'geo.execution.kq': 'KQ', 'geo.execution.watch': 'Watch',
    'geo.graph.read': 'Read', 'geo.graph.node.create': 'Node Create',
    'geo.graph.edge.create': 'Edge Create',
    'geo.system.hydrate': 'Hydrate', 'geo.system.watcher': 'Watcher',
  }

  const groupMap: Record<string, string> = {
    'geo.project': 'project', 'geo.execution': 'execution',
    'geo.graph': 'graph', 'geo.system': 'system',
  }

  for (const cap of all) {
    const prefix = Object.keys(groupMap).find(p => cap.id.startsWith(p))
    const g = prefix ? groupMap[prefix] : 'system'
    groups[g].items.push({
      id: cap.id,
      label: labelMap[cap.id] || cap.id.split('.').pop() || cap.id,
      requiredTier: cap.requiredTier,
      accessible: PermissionService.hasCapability(tier, cap.id),
    })
  }

  return Object.values(groups)
})

function tierChipClass(t: SubscriberTier): Record<string, boolean> {
  const order = capTierOrder
  const current = userTier.value
  return {
    'sysctl__tier-chip--active': t === current,
    'sysctl__tier-chip--above': order[t] > order[current],
    'sysctl__tier-chip--below': order[t] < order[current],
  }
}

function overrideTier(t: SubscriberTier): void {
  userTier.value = t
  if (import.meta.client) {
    localStorage.setItem('geo_tier_override', t)
    tierOverridden.value = true
  }
}

// ═══════════════════════════════════════════════
// Panel 3: Execution Debug
// ═══════════════════════════════════════════════
const execStates = computed(() => {
  if (!props.projectId) return []
  return stateMgr.getAllStates(props.projectId)
})

const totalMismatch = computed(() =>
  execStates.value.reduce((sum, ctx) => sum + (ctx.mismatchCount || 0), 0)
)

const watcherHealthClass = computed(() =>
  watcherSummary.value?.total > 0 ? 'sysctl__health--ok' : 'sysctl__health--pending'
)

const driftHealthClass = computed(() =>
  totalMismatch.value > 0 ? 'sysctl__health--warn' : 'sysctl__health--ok'
)

const lastWatcherTime = computed(() => {
  if (!recentWatcherEvents.value?.length) return '—'
  const last = recentWatcherEvents.value[0]
  if (!last.created_at) return '—'
  return new Date(last.created_at).toLocaleTimeString()
})

// ═══════════════════════════════════════════════
// Panel 4: Helpers
// ═══════════════════════════════════════════════
function shortCapName(id: string): string {
  const parts = id.split('.')
  return parts[parts.length - 1]
}

function stateColor(state: string): string {
  return ExecutionStateDisplay[state as keyof typeof ExecutionStateDisplay]?.color || '#6b7280'
}

// 生命周期
onMounted(() => {
  init()
  unsub = stateMgr.onStateChange((ctx) => {
    if (ctx.projectId === props.projectId) {
      // trigger re-render indirectly
    }
  })
  // 检查 localStorage 是否有 override
  if (import.meta.client) {
    const ov = localStorage.getItem('geo_tier_override')
    if (ov && ['FREE', 'VIP_1', 'VIP_2', 'ADMIN'].includes(ov)) {
      userTier.value = ov as SubscriberTier
      tierOverridden.value = true
    }
  }
})

onBeforeUnmount(() => {
  destroy()
  if (unsub) unsub()
})
</script>

<style scoped>
.sysctl { padding: 24px; height: 100%; color: #e0e0e0; overflow-y: auto; }
.sysctl__header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 12px; border-bottom: 1px solid #333; }
.sysctl__header h3 { margin: 0; font-size: 18px; font-weight: 600; }
.sysctl__refresh-btn { padding: 6px 14px; border: 1px solid #444; border-radius: 6px; background: #2a2a3a; color: #ccc; cursor: pointer; font-size: 13px; }
.sysctl__refresh-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.sysctl__error { padding: 12px; background: #2a1a1a; border: 1px solid #4e2a2a; border-radius: 6px; color: #cc7e7e; font-size: 13px; margin-bottom: 16px; }
.sysctl__empty { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 200px; color: #666; gap: 8px; }
.sysctl__empty-icon { font-size: 48px; }

/* Panel common */
.sysctl__panel { margin-bottom: 16px; background: #1e1e2e; border-radius: 8px; border: 1px solid #333; overflow: hidden; }
.sysctl__panel-header { display: flex; align-items: center; gap: 8px; padding: 14px 16px; background: rgba(255,255,255,0.02); border-bottom: 1px solid #2a2a3a; }
.sysctl__panel-icon { font-size: 16px; }
.sysctl__panel-header h4 { margin: 0; font-size: 14px; font-weight: 600; color: #ccc; text-transform: uppercase; letter-spacing: 0.5px; }
.sysctl__panel-count { margin-left: auto; font-size: 11px; color: #6b7280; font-family: monospace; background: rgba(255,255,255,0.03); padding: 2px 8px; border-radius: 8px; }
.sysctl__panel-body { padding: 16px; }

/* Panel 1: Flags */
.sysctl__flag-list { display: flex; flex-direction: column; gap: 10px; }
.sysctl__flag-item { padding: 10px 12px; background: rgba(255,255,255,0.02); border-radius: 6px; border: 1px solid rgba(255,255,255,0.04); }
.sysctl__flag-main { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
.sysctl__flag-dot { width: 8px; height: 8px; border-radius: 50%; }
.sysctl__flag-dot--on { background: #22c55e; box-shadow: 0 0 6px rgba(34,197,94,0.4); }
.sysctl__flag-dot--off { background: #6b7280; }
.sysctl__flag-key { font-size: 13px; color: #e0e0e0; font-family: monospace; }
.sysctl__flag-badge { font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px; font-family: monospace; }
.sysctl__flag-badge--on { background: rgba(34,197,94,0.15); color: #22c55e; }
.sysctl__flag-badge--off { background: rgba(107,114,128,0.15); color: #6b7280; }
.sysctl__flag-desc { font-size: 12px; color: #888; margin-left: 16px; }
.sysctl__flag-deps { font-size: 11px; color: #6b7280; margin-left: 16px; }
.sysctl__flag-note { font-size: 11px; color: #4ea3cc; margin-left: 16px; }

/* Panel 2: Tier */
.sysctl__tier-bar { display: flex; gap: 8px; margin-bottom: 16px; align-items: center; }
.sysctl__tier-chip { padding: 6px 16px; border-radius: 16px; font-size: 12px; font-weight: 600; cursor: pointer; border: 1px solid #444; color: #888; background: transparent; transition: all 0.2s; }
.sysctl__tier-chip:hover { border-color: #888; color: #ccc; }
.sysctl__tier-chip--active { background: #1a3a5a; color: #3b82f6; border-color: #3b82f6; }
.sysctl__tier-chip--above { opacity: 0.5; }
.sysctl__tier-chip--below { opacity: 0.7; }
.sysctl__tier-override-note { font-size: 11px; color: #f59e0b; }

/* Capability matrix */
.sysctl__cap-matrix { display: flex; flex-direction: column; gap: 12px; }
.sysctl__cap-group {}
.sysctl__cap-group-name { font-size: 11px; color: #888; text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.5px; }
.sysctl__cap-group-items { display: flex; flex-wrap: wrap; gap: 4px; }
.sysctl__cap-cell { display: flex; align-items: center; gap: 4px; padding: 4px 10px; border-radius: 6px; font-size: 12px; }
.sysctl__cap-cell--on { background: rgba(34,197,94,0.08); color: #22c55e; }
.sysctl__cap-cell--off { background: rgba(107,114,128,0.08); color: #6b7280; }
.sysctl__cap-icon { font-weight: 700; }
.sysctl__cap-label { color: #ccc; }
.sysctl__cap-tier { font-size: 10px; color: #6b7280; font-family: monospace; }

/* Panel 3: Debug */
.sysctl__debug-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.sysctl__debug-item { display: flex; flex-direction: column; gap: 4px; }
.sysctl__debug-item label { font-size: 11px; color: #888; text-transform: uppercase; }
.sysctl__debug-item span { font-size: 13px; }
.sysctl__health--ok { color: #22c55e; }
.sysctl__health--warn { color: #f97316; }
.sysctl__health--pending { color: #f59e0b; }

/* Panel 4: Introspection */
.sysctl__intro-grid { display: flex; flex-direction: column; gap: 16px; }
.sysctl__intro-section {}
.sysctl__intro-section h5 { margin: 0 0 8px; font-size: 12px; color: #aaa; text-transform: uppercase; letter-spacing: 0.5px; }
.sysctl__intro-flow { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; font-size: 12px; font-family: monospace; }
.sysctl__intro-node { padding: 3px 8px; background: rgba(255,255,255,0.03); border-radius: 4px; }
.sysctl__intro-arrow { color: #444; }
.sysctl__intro-empty { font-size: 12px; color: #6b7280; }
.sysctl__intro-load { display: flex; flex-direction: column; gap: 6px; }
.sysctl__load-bar { display: flex; align-items: center; gap: 8px; }
.sysctl__load-name { font-size: 11px; color: #888; min-width: 60px; font-family: monospace; }
.sysctl__load-track { flex: 1; height: 6px; background: #2a2a3a; border-radius: 3px; overflow: hidden; }
.sysctl__load-fill { height: 100%; border-radius: 3px; transition: width 0.5s; }
.sysctl__load-ms { font-size: 11px; color: #6b7280; font-family: monospace; min-width: 50px; text-align: right; }

/* Traces */
.sysctl__trace-summary { display: flex; gap: 20px; margin-bottom: 10px; }
.sysctl__trace-stat { display: flex; flex-direction: column; gap: 2px; }
.sysctl__trace-stat label { font-size: 11px; color: #888; }
.sysctl__trace-stat span { font-size: 16px; font-weight: 700; }
.sysctl__trace-list { display: flex; flex-direction: column; gap: 4px; }
.sysctl__trace-item { display: flex; align-items: center; gap: 8px; padding: 4px 8px; background: rgba(255,255,255,0.02); border-radius: 4px; font-size: 12px; font-family: monospace; }
.sysctl__trace-ok { color: #22c55e; }
.sysctl__trace-fail { color: #ef4444; }
.sysctl__trace-item code { color: #4ecca3; }
.sysctl__trace-op { color: #888; }
.sysctl__trace-ms { margin-left: auto; color: #6b7280; }
/* Panel 5: Developer Console */
.dev-console-panel { }
.dev-console-header { cursor: pointer; user-select: none; }
.dev-console-header:hover { background: rgba(255,255,255,0.04); }
.dev-console-toggle { margin-left: auto; font-size: 14px; color: #64748b; transition: transform 0.15s; }
.dev-console-body { padding: 0; }
</style>
