<template>
  <div class="inspector-panel">
    <div class="inspector-panel__header">
      <h3>🔬 系统检视器</h3>
      <button class="inspector-panel__refresh-btn" @click="refresh" :disabled="loading">
        {{ loading ? '加载中...' : '🔄 刷新' }}
      </button>
    </div>

    <div v-if="!projectId" class="inspector-panel__empty">
      <span class="inspector-panel__empty-icon">📁</span>
      <p>请先选择一个项目</p>
    </div>

    <template v-else>
      <!-- Project -->
      <section class="inspector-panel__section">
        <h4>📦 项目 (Project)</h4>
        <div class="inspector-panel__grid">
          <div class="inspector-panel__field">
            <label>ID</label>
            <code>{{ projectInfo?.id }}</code>
          </div>
          <div class="inspector-panel__field">
            <label>名称</label>
            <span>{{ projectInfo?.name || '—' }}</span>
          </div>
          <div class="inspector-panel__field">
            <label>类型</label>
            <span class="tag">{{ projectInfo?.projectType || '—' }}</span>
          </div>
          <div class="inspector-panel__field">
            <label>状态</label>
            <span :class="badge(projectInfo?.status)">{{ projectInfo?.status || '—' }}</span>
          </div>
          <div class="inspector-panel__field">
            <label>TenantId</label>
            <code v-if="projectInfo?.tenantId">{{ projectInfo.tenantId }}</code>
            <span v-else class="inspector-panel__missing">未设置</span>
          </div>
          <div class="inspector-panel__field">
            <label>OwnerId</label>
            <code v-if="projectInfo?.ownerId || projectInfo?.userId">
              {{ projectInfo.ownerId || projectInfo.userId }}
            </code>
            <span v-else class="inspector-panel__missing">未设置</span>
          </div>
        </div>
      </section>

      <!-- GeoProfile (computed from project type / execution results) -->
      <section class="inspector-panel__section">
        <h4>🌐 Geo 项目档案</h4>
        <div v-if="isGeoProject" class="inspector-panel__grid">
          <div class="inspector-panel__field">
            <label>项目类型</label>
            <span class="tag">{{ projectInfo?.projectType }}</span>
          </div>
          <div class="inspector-panel__field">
            <label>状态同步</label>
            <span class="inspector-panel__badge--ok">✅ Project → GeoProfile</span>
          </div>
          <div class="inspector-panel__field">
            <label>双写标记</label>
            <span class="inspector-panel__badge--ok">🔄 DUAL_WRITE_PROJECT</span>
          </div>
        </div>
        <div v-else class="inspector-panel__missing-block">
          ⚠️ 非 GEO 类型项目（类型: {{ projectInfo?.projectType || '未设置' }}）
        </div>
      </section>

      <!-- Execution Status -->
      <section class="inspector-panel__section">
        <h4>⚡ 执行状态</h4>
        <div v-if="executionSummary" class="inspector-panel__stats">
          <div class="inspector-panel__stat" v-for="(val, key) in executionSummary" :key="key">
            <label>{{ key }}</label>
            <span>{{ val }}</span>
          </div>
        </div>
        <div v-else class="inspector-panel__stat-empty">暂无执行数据</div>
      </section>

      <!-- Watcher Summary -->
      <section class="inspector-panel__section">
        <h4>👁️ Watcher 事件</h4>
        <template v-if="watcherSummary">
          <div class="inspector-panel__watcher-big">
            <div class="inspector-panel__watcher-stat">
              <label>总计</label>
              <span>{{ watcherSummary.total }}</span>
            </div>
            <div class="inspector-panel__watcher-stat">
              <label>SUCCESS</label>
              <span class="inspector-panel__watcher-ok">{{ watcherSummary.success }}</span>
            </div>
            <div class="inspector-panel__watcher-stat" v-if="watcherSummary.fail">
              <label>FAIL</label>
              <span class="inspector-panel__watcher-fail">{{ watcherSummary.fail }}</span>
            </div>
          </div>
          <details>
            <summary>事件列表 (最近 {{ recentWatcherEvents.length }})</summary>
            <div class="inspector-panel__table-wrap">
              <table class="inspector-panel__table">
                <thead><tr><th>entity</th><th>op</th><th>status</th><th>ms</th><th>time</th></tr></thead>
                <tbody>
                  <tr v-for="ev in recentWatcherEvents" :key="ev.id">
                    <td>{{ ev.entity }}</td>
                    <td>{{ ev.operation }}</td>
                    <td><span :class="dot(ev.status)"></span>{{ ev.status }}</td>
                    <td class="inspector-panel__mono">{{ ev.latency_ms }}ms</td>
                    <td class="inspector-panel__dim">{{ fmtTime(ev.created_at) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </details>
        </template>
        <div v-else class="inspector-panel__stat-empty">暂无事件</div>
      </section>

      <!-- Hydrate Raw -->
      <section class="inspector-panel__section">
        <h4>📄 原始 Hydrate 数据</h4>
        <details v-if="projectInfo">
          <summary>project 对象</summary>
          <pre class="inspector-panel__json">{{ JSON.stringify(projectInfo, null, 2) }}</pre>
        </details>
        <details v-if="executionResults">
          <summary>executionResults</summary>
          <pre class="inspector-panel__json">{{ JSON.stringify(executionResults, null, 2) }}</pre>
        </details>
      </section>

      <div v-if="error" class="inspector-panel__error">⚠️ {{ error }}</div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount } from 'vue'
import { useGeoHydrate } from '~/studio-v2/workspace/brand-geo/composables/useGeoHydrate'

const props = defineProps<{ projectId: string | null }>()

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

const isGeoProject = computed(() =>
  projectInfo.value?.projectType === 'geo' || projectInfo.value?.projectType === 'GEO'
)

onMounted(init)
onBeforeUnmount(destroy)

function badge(s: string) {
  const m: Record<string, string> = {
    draft: 'chip chip--draft',
    active: 'chip chip--active',
    completed: 'chip chip--done',
  }
  return m[s] || 'chip'
}

function dot(s: string) {
  if (s === 'SUCCESS') return 'dot dot--ok '
  if (s === 'FAIL') return 'dot dot--fail '
  return 'dot '
}

function fmtTime(t: string) {
  if (!t) return '—'
  return new Date(t).toLocaleTimeString()
}
</script>

<style scoped>
.inspector-panel { height: 100%; overflow-y: auto; padding: 20px; color: #e0e0e0; }
.inspector-panel__header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; padding-bottom: 12px; border-bottom: 1px solid #333; }
.inspector-panel__header h3 { margin: 0; font-size: 18px; font-weight: 600; }
.inspector-panel__refresh-btn { padding: 6px 14px; border: 1px solid #444; border-radius: 6px; background: #2a2a3a; color: #ccc; cursor: pointer; font-size: 13px; }
.inspector-panel__refresh-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.inspector-panel__empty { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 200px; color: #666; }
.inspector-panel__empty-icon { font-size: 48px; margin-bottom: 12px; }

.inspector-panel__section { margin-bottom: 20px; padding: 16px; background: #1e1e2e; border-radius: 8px; border: 1px solid #333; }
.inspector-panel__section h4 { margin: 0 0 12px; font-size: 14px; font-weight: 600; color: #aaa; text-transform: uppercase; letter-spacing: 0.5px; }
.inspector-panel__grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 12px; }
.inspector-panel__field { display: flex; flex-direction: column; gap: 4px; }
.inspector-panel__field label { font-size: 11px; color: #888; text-transform: uppercase; }
.inspector-panel__field code { font-size: 12px; font-family: monospace; color: #4ecca3; word-break: break-all; }
.inspector-panel__missing { color: #cc7e4e; font-size: 12px; }
.inspector-panel__missing-block { padding: 8px 12px; background: #2a1a1a; border-radius: 6px; color: #cc7e7e; font-size: 13px; }

.tag { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; background: #2a2a3a; color: #4ea3cc; }
.chip { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 500; }
.chip--draft { background: #333; color: #aaa; }
.chip--active { background: #1a3a2a; color: #4ecca3; }
.chip--done { background: #1a3a5a; color: #4ea3cc; }

.inspector-panel__badge--ok { color: #4ecca3; font-size: 13px; }

.inspector-panel__stats { display: flex; gap: 24px; }
.inspector-panel__stat { display: flex; flex-direction: column; gap: 4px; }
.inspector-panel__stat label { font-size: 11px; color: #888; text-transform: uppercase; }
.inspector-panel__stat span { font-size: 22px; font-weight: 700; color: #4ecca3; }
.inspector-panel__stat-empty { padding: 12px; text-align: center; color: #666; font-size: 13px; }

.inspector-panel__watcher-big { display: flex; gap: 24px; margin-bottom: 12px; }
.inspector-panel__watcher-stat { display: flex; flex-direction: column; align-items: center; gap: 4px; }
.inspector-panel__watcher-stat label { font-size: 11px; color: #888; text-transform: uppercase; }
.inspector-panel__watcher-stat span { font-size: 20px; font-weight: 700; }
.inspector-panel__watcher-ok { color: #4ecca3; }
.inspector-panel__watcher-fail { color: #cc4e4e; }

.dot { width: 6px; height: 6px; border-radius: 50%; display: inline-block; margin-right: 4px; }
.dot--ok { background: #4ecca3; }
.dot--fail { background: #cc4e4e; }

.inspector-panel__table-wrap { overflow-x: auto; }
.inspector-panel__table { width: 100%; border-collapse: collapse; font-size: 12px; }
.inspector-panel__table th { text-align: left; padding: 6px 8px; background: #12121e; color: #888; font-weight: 500; border-bottom: 1px solid #333; }
.inspector-panel__table td { padding: 6px 8px; border-bottom: 1px solid #2a2a3a; font-family: monospace; }

.inspector-panel__mono { font-family: monospace; color: #888; }
.inspector-panel__dim { color: #666; font-size: 11px; }

.inspector-panel__json { max-height: 400px; overflow: auto; padding: 12px; background: #12121e; border-radius: 6px; font-size: 12px; line-height: 1.5; color: #aaccbb; }
.inspector-panel__error { padding: 12px; background: #2a1a1a; border: 1px solid #4e2a2a; border-radius: 6px; color: #cc7e7e; font-size: 13px; }

details { cursor: pointer; }
details summary { font-size: 13px; color: #888; padding: 4px 0; }
details summary:hover { color: #4ecca3; }
</style>
