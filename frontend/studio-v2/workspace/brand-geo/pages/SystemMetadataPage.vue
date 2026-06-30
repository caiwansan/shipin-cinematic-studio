<template>
  <div class="sysmeta">
    <div class="sysmeta__header">
      <h3>🌐 配置信息</h3>
      <button class="sysmeta__refresh-btn" :disabled="loading" @click="refresh">
        {{ loading ? '加载中...' : '🔄 刷新' }}
      </button>
    </div>

    <div v-if="error" class="sysmeta__error">⚠️ {{ error }}</div>
    <div v-if="!projectId" class="sysmeta__empty">
      <span class="sysmeta__empty-icon">📁</span>
      <p>请先选择一个项目</p>
    </div>

    <template v-if="projectId">
      <!-- Card 1: Project Narrative — "这个项目是什么" -->
      <section class="sysmeta__card">
        <div class="sysmeta__card-header">
          <span class="sysmeta__card-icon">📖</span>
          <h4>项目说明</h4>
        </div>
        <div class="sysmeta__card-body">
          <div class="sysmeta__narrative">
            <p>这是一个 <strong>{{ projectTypeLabel }}</strong> 类型的项目，
              当前处于 <strong>{{ currentStatusLabel }}</strong> 阶段。</p>
            <p v-if="projectInfo">
              由 <code>{{ projectInfo.ownerId || projectInfo.userId || '未知用户' }}</code>
              在 <strong>{{ projectInfo.created_at ? fmtDate(projectInfo.created_at) : '—' }}</strong> 创建。
            </p>
            <p v-if="executionHistory.length">
              已执行 <strong>{{ executionHistory.length }}</strong> 次操作，
              最近一次在 <strong>{{ lastExecTimeLabel }}</strong>。
            </p>
          </div>
          <!-- 信息卡片 -->
          <div class="sysmeta__identity-grid">
            <div class="sysmeta__identity-item">
              <label>Project ID</label>
              <code>{{ projectInfo?.id }}</code>
            </div>
            <div class="sysmeta__identity-item">
              <label>项目名称</label>
              <span>{{ projectInfo?.name || '—' }}</span>
            </div>
            <div class="sysmeta__identity-item">
              <label>项目类型</label>
              <span class="sysmeta__pill">{{ projectInfo?.projectType || '—' }}</span>
            </div>
            <div class="sysmeta__identity-item">
              <label>生命周期</label>
              <span :class="statusPillClass">{{ projectInfo?.status || '—' }}</span>
            </div>
            <div class="sysmeta__identity-item">
              <label>租户</label>
              <code>{{ projectInfo?.tenantId || '—' }}</code>
            </div>
            <div class="sysmeta__identity-item">
              <label>双写模式</label>
              <span class="sysmeta__badge--ok">🔄 Active</span>
            </div>
          </div>
        </div>
      </section>

      <!-- Card 2: Execution Summary (非技术版) -->
      <section class="sysmeta__card">
        <div class="sysmeta__card-header">
          <span class="sysmeta__card-icon">⚡</span>
          <h4>执行摘要</h4>
        </div>
        <div class="sysmeta__card-body">
          <div v-if="executionHistory.length" class="sysmeta__exec-story">
            <div class="sysmeta__story-item" v-for="(ctx, idx) in executionHistory" :key="ctx.capabilityId">
              <span class="sysmeta__story-icon">{{ storyIcon(ctx.state) }}</span>
              <div class="sysmeta__story-content">
                <div class="sysmeta__story-title">{{ storyTitle(ctx.capabilityId) }}</div>
                <div class="sysmeta__story-meta">
                  <span>{{ storyStateLabel(ctx.state) }}</span>
                  <span v-if="ctx.lastRunAt">· {{ fmtRelative(ctx.lastRunAt) }}</span>
                  <span v-if="ctx.duration">· {{ fmtDuration(ctx.duration) }}</span>
                </div>
              </div>
              <span v-if="idx === mostRecentIdx" class="sysmeta__story-tag">最新</span>
            </div>
          </div>
          <div v-else class="sysmeta__placeholder">该项目尚未执行任何操作</div>

          <div class="sysmeta__exec-metrics">
            <div class="sysmeta__metric">
              <label>成功率</label>
              <span :class="successRateClass">{{ successRateLabel }}</span>
            </div>
            <div class="sysmeta__metric">
              <label>执行次数</label>
              <span>{{ executionHistory.length }}</span>
            </div>
            <div class="sysmeta__metric">
              <label>当前不一致</label>
              <span :class="driftClass">{{ totalMismatch }}</span>
            </div>
          </div>
        </div>
      </section>

      <!-- Card 3: Knowledge Exposure — 系统对外表达 -->
      <section class="sysmeta__card">
        <div class="sysmeta__card-header">
          <span class="sysmeta__card-icon">🔗</span>
          <h4>知识曝光</h4>
        </div>
        <div class="sysmeta__card-body">
          <div class="sysmeta__exposure-grid">
            <div class="sysmeta__exposure-item">
              <label>图谱节点</label>
              <span>{{ graphStats.nodes }}</span>
            </div>
            <div class="sysmeta__exposure-item">
              <label>图谱边</label>
              <span>{{ graphStats.edges }}</span>
            </div>
            <div class="sysmeta__exposure-item">
              <label>事件总数</label>
              <span>{{ watcherSummary?.total || 0 }}</span>
            </div>
            <div class="sysmeta__exposure-item">
              <label>数据新鲜度</label>
              <span>{{ freshnessLabel }}</span>
            </div>
            <div class="sysmeta__exposure-item">
              <label>曝光层级</label>
              <span class="sysmeta__pill">Internal Only</span>
            </div>
            <div class="sysmeta__exposure-item">
              <label>可索引</label>
              <span>{{ graphStats.nodes > 0 ? '🟢 是' : '⚪ 否' }}</span>
            </div>
          </div>
          <div class="sysmeta__exposure-tags" v-if="systemTags.length">
            <span class="sysmeta__tag" v-for="tag in systemTags" :key="tag">#{{ tag }}</span>
          </div>
        </div>
      </section>

      <!-- Card 4: System Tags & Metadata -->
      <section class="sysmeta__card">
        <div class="sysmeta__card-header">
          <span class="sysmeta__card-icon">🏷️</span>
          <h4>系统元数据</h4>
        </div>
        <div class="sysmeta__card-body">
          <div class="sysmeta__tags-grid">
            <div class="sysmeta__tag-row"><label>Type</label><code>GEO</code></div>
            <div class="sysmeta__tag-row"><label>Version</label><code>2.0</code></div>
            <div class="sysmeta__tag-row"><label>Kernel</label><code>Execution Kernel</code></div>
            <div class="sysmeta__tag-row"><label>Frontend</label><code>Product UX (P2.3)</code></div>
            <div class="sysmeta__tag-row"><label>Dual Write</label><code>{{ dualWriteLabel }}</code></div>
            <div class="sysmeta__tag-row"><label>Watcher</label><code>{{ watcherSummary && watcherSummary.total > 0 ? 'Active' : 'Inactive' }}</code></div>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount } from 'vue'
import { useGeoHydrate } from '~/studio-v2/workspace/brand-geo/composables/useGeoHydrate'
import { ExecutionStateManager, ExecutionStateDisplay } from '~/utils/executionStateManager'
import type { ExecutionState } from '~/utils/executionStateManager'

const props = defineProps<{ projectId: string | null }>()

const stateMgr = ExecutionStateManager.getInstance()
let unsub: (() => void) | null = null

const {
  loading,
  error,
  projectInfo,
  executionSummary,
  recentWatcherEvents,
  watcherSummary,
  refresh,
  init,
  destroy,
} = useGeoHydrate(() => props.projectId)

// ═══════════════════════════════════════════════
// Card 1: Project Narrative
// ═══════════════════════════════════════════════
const projectTypeLabel = computed(() => {
  const t = projectInfo.value?.projectType
  const map: Record<string, string> = { geo: 'GEO 知识图谱', video: '视频短剧', novel: '小说创作' }
  return map[t as string] || t || '未知'
})

const currentStatusLabel = computed(() => {
  const s = projectInfo.value?.status
  if (!s) return '未知'
  return s.charAt(0).toUpperCase() + s.slice(1)
})

const statusPillClass = computed(() => {
  const s = projectInfo.value?.status
  const map: Record<string, string> = { draft: 'sysmeta__pill--draft', active: 'sysmeta__pill--active', completed: 'sysmeta__pill--done' }
  return 'sysmeta__pill ' + (map[s as string] || '')
})

// ═══════════════════════════════════════════════
// Card 2: Execution History
// ═══════════════════════════════════════════════
const executionHistory = computed(() => {
  if (!props.projectId) return []
  const all = stateMgr.getAllStates(props.projectId)
  return all.filter(s => s.state !== 'IDLE')
})

const mostRecentIdx = computed(() => {
  const sorted = [...executionHistory.value].sort((a, b) => (b.lastRunAt || 0) - (a.lastRunAt || 0))
  const mostRecent = sorted[0]
  if (!mostRecent) return -1
  return executionHistory.value.indexOf(mostRecent)
})

const lastExecTimeLabel = computed(() => {
  const times = executionHistory.value.map(s => s.lastRunAt).filter(Boolean) as number[]
  if (times.length === 0) return '—'
  return fmtRelative(Math.max(...times))
})

const totalMismatch = computed(() =>
  executionHistory.value.reduce((sum, ctx) => sum + (ctx.mismatchCount || 0), 0)
)

const successRateLabel = computed(() => {
  const total = executionHistory.value.length
  if (total === 0) return '—'
  const stable = executionHistory.value.filter(s => s.state === 'STABLE').length
  return `${Math.round((stable / total) * 100)}%`
})

const successRateClass = computed(() => {
  const rate = parseInt(successRateLabel.value)
  if (isNaN(rate)) return ''
  return rate >= 80 ? 'sysmeta__metric--ok' : rate >= 50 ? 'sysmeta__metric--warn' : 'sysmeta__metric--fail'
})

const driftClass = computed(() =>
  totalMismatch.value > 0 ? 'sysmeta__metric--warn' : 'sysmeta__metric--ok'
)

function storyIcon(state: ExecutionState): string {
  return ExecutionStateDisplay[state]?.icon || '⏸️'
}
function storyStateLabel(state: ExecutionState): string {
  return ExecutionStateDisplay[state]?.label || '未知'
}
function storyTitle(id: string): string {
  const map: Record<string, string> = { 'geo.execution.discover': '实体发现', 'geo.execution.graph.build': '知识图谱构建', 'geo.execution.kq': '质量评估' }
  return map[id] || id
}

// ═══════════════════════════════════════════════
// Card 3: Knowledge Exposure
// ═══════════════════════════════════════════════
const graphStats = computed(() => {
  const info = projectInfo.value
  const ex = executionSummary.value
  return {
    nodes: ex?.totalEntities || info?.executionResults?.totalEntities || '—',
    edges: ex?.totalRelations || info?.executionResults?.totalRelations || '—',
  }
})

const freshnessLabel = computed(() => {
  if (!recentWatcherEvents.value?.length) return '无数据'
  const last = recentWatcherEvents.value[0]
  if (!last.created_at) return '未知'
  return fmtRelative(new Date(last.created_at).getTime())
})

const systemTags = computed(() => {
  const tags: string[] = ['GEO']
  const status = projectInfo.value?.status
  if (status) tags.push(status.toUpperCase())
  if (watcherSummary.value?.total > 0) tags.push('WATCHING')
  const states = executionHistory.value.map(s => s.state)
  if (states.includes('DRIFTED')) tags.push('DRIFTED')
  if (states.includes('STABLE')) tags.push('SYNCED')
  return [...new Set(tags)]
})

// ═══════════════════════════════════════════════
// Card 4: System Tags
// ═══════════════════════════════════════════════
const dualWriteLabel = computed(() => {
  const dw = process.env?.DUAL_WRITE_PROJECT || 'true'
  return dw === 'true' ? 'Project Active, GeoProfile Shadow' : 'Disabled'
})

// ═══════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════
function fmtDate(t: string): string {
  return new Date(t).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })
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

onMounted(() => {
  init()
  unsub = stateMgr.onStateChange(() => {})
})

onBeforeUnmount(() => {
  destroy()
  if (unsub) unsub()
})
</script>

<style scoped>
.sysmeta { padding: 24px; height: 100%; color: #e0e0e0; overflow-y: auto; }
.sysmeta__header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 12px; border-bottom: 1px solid #333; }
.sysmeta__header h3 { margin: 0; font-size: 18px; font-weight: 600; }
.sysmeta__refresh-btn { padding: 6px 14px; border: 1px solid #444; border-radius: 6px; background: #2a2a3a; color: #ccc; cursor: pointer; font-size: 13px; }
.sysmeta__refresh-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.sysmeta__error { padding: 12px; background: #2a1a1a; border: 1px solid #4e2a2a; border-radius: 6px; color: #cc7e7e; font-size: 13px; margin-bottom: 16px; }
.sysmeta__empty { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 200px; color: #666; gap: 8px; }
.sysmeta__empty-icon { font-size: 48px; }
.sysmeta__placeholder { padding: 20px; text-align: center; color: #666; font-size: 13px; }

/* Card common */
.sysmeta__card { margin-bottom: 16px; background: #1e1e2e; border-radius: 8px; border: 1px solid #333; overflow: hidden; }
.sysmeta__card-header { display: flex; align-items: center; gap: 8px; padding: 14px 16px; background: rgba(255,255,255,0.02); border-bottom: 1px solid #2a2a3a; }
.sysmeta__card-icon { font-size: 16px; }
.sysmeta__card-header h4 { margin: 0; font-size: 14px; font-weight: 600; color: #ccc; text-transform: uppercase; letter-spacing: 0.5px; }
.sysmeta__card-body { padding: 16px; }

/* Card 1: Narrative */
.sysmeta__narrative { margin-bottom: 16px; }
.sysmeta__narrative p { font-size: 14px; line-height: 1.7; color: #ccc; margin: 0 0 8px; }
.sysmeta__narrative code { color: #4ecca3; font-family: monospace; font-size: 13px; }
.sysmeta__identity-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.sysmeta__identity-item { display: flex; flex-direction: column; gap: 2px; padding: 8px 10px; background: rgba(255,255,255,0.02); border-radius: 6px; }
.sysmeta__identity-item label { font-size: 11px; color: #888; text-transform: uppercase; }
.sysmeta__identity-item span, .sysmeta__identity-item code { font-size: 13px; }
.sysmeta__identity-item code { font-family: monospace; color: #4ecca3; }
.sysmeta__pill { padding: 2px 8px; border-radius: 8px; font-size: 12px; font-weight: 500; display: inline-block; }
.sysmeta__pill--draft { background: #333; color: #aaa; }
.sysmeta__pill--active { background: #1a3a2a; color: #4ecca3; }
.sysmeta__pill--done { background: #1a3a5a; color: #4ea3cc; }

/* Card 2: Execution Story */
.sysmeta__exec-story { display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px; }
.sysmeta__story-item { display: flex; align-items: center; gap: 10px; padding: 10px 12px; background: rgba(255,255,255,0.02); border-radius: 6px; border: 1px solid rgba(255,255,255,0.04); }
.sysmeta__story-icon { font-size: 18px; }
.sysmeta__story-content { flex: 1; }
.sysmeta__story-title { font-size: 14px; font-weight: 600; color: #e0e0e0; }
.sysmeta__story-meta { font-size: 12px; color: #888; margin-top: 2px; }
.sysmeta__story-tag { font-size: 10px; padding: 2px 6px; border-radius: 8px; background: #1a3a5a; color: #4ea3cc; font-weight: 600; }
.sysmeta__exec-metrics { display: flex; gap: 20px; padding-top: 12px; border-top: 1px solid #2a2a3a; }
.sysmeta__metric { display: flex; flex-direction: column; gap: 2px; }
.sysmeta__metric label { font-size: 11px; color: #888; text-transform: uppercase; }
.sysmeta__metric span { font-size: 18px; font-weight: 700; }
.sysmeta__metric--ok { color: #22c55e; }
.sysmeta__metric--warn { color: #f97316; }
.sysmeta__metric--fail { color: #ef4444; }

/* Card 3: Exposure */
.sysmeta__exposure-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px; }
.sysmeta__exposure-item { display: flex; flex-direction: column; gap: 2px; }
.sysmeta__exposure-item label { font-size: 11px; color: #888; text-transform: uppercase; }
.sysmeta__exposure-item span { font-size: 18px; font-weight: 700; }
.sysmeta__exposure-tags { display: flex; flex-wrap: wrap; gap: 4px; }
.sysmeta__tag { padding: 2px 8px; background: rgba(78,204,163,0.08); color: #4ecca3; border-radius: 8px; font-size: 11px; font-family: monospace; }

/* Card 4: System Tags */
.sysmeta__tags-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.sysmeta__tag-row { display: flex; align-items: center; gap: 8px; padding: 6px 8px; background: rgba(255,255,255,0.02); border-radius: 4px; }
.sysmeta__tag-row label { font-size: 11px; color: #888; min-width: 70px; }
.sysmeta__tag-row code { font-size: 12px; color: #4ecca3; font-family: monospace; }
</style>
