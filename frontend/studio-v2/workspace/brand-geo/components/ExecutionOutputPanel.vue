<template>
  <div class="exec-output">
    <section class="exec-output__section">
      <h4>📋 执行日志</h4>
      <div class="exec-output__results">
        <div v-if="executionSummary" class="exec-output__summary">
          <div class="exec-output__stat">
            <label>总实体</label>
            <span>{{ executionSummary.totalEntities || '—' }}</span>
          </div>
          <div class="exec-output__stat">
            <label>总关系</label>
            <span>{{ executionSummary.totalRelations || '—' }}</span>
          </div>
          <div class="exec-output__stat">
            <label>最新执行</label>
            <span>{{ executionSummary.lastExecutionTime || '—' }}</span>
          </div>
        </div>
        <div v-else class="exec-output__placeholder">暂无执行记录</div>
      </div>
    </section>

    <section class="exec-output__section" v-if="watcherEnabled">
      <h4>👁️ 实时事件流</h4>
      <template v-if="recentWatcherEvents.length">
        <div class="exec-output__watcher-summary" v-if="watcherSummary">
          <span>总计 {{ watcherSummary.total }}</span>
          <span class="exec-output__watcher-ok">成功 {{ watcherSummary.success }}</span>
          <span v-if="watcherSummary.fail" class="exec-output__watcher-fail">失败 {{ watcherSummary.fail }}</span>
        </div>
        <div class="exec-output__watcher-list">
          <div v-for="ev in recentWatcherEvents" :key="ev.id" class="exec-output__watcher-item">
            <span :class="watcherDot(ev.status)"></span>
            <code>{{ ev.entity }}</code>
            <span class="exec-output__watcher-op">{{ ev.operation }}</span>
            <span class="exec-output__watcher-time">{{ fmtTime(ev.created_at) }}</span>
            <span v-if="ev.latency_ms" class="exec-output__watcher-ms">{{ ev.latency_ms }}ms</span>
          </div>
        </div>
      </template>
      <div v-else class="exec-output__placeholder">暂无事件</div>
    </section>

    <section class="exec-output__section" v-if="rawJson">
      <details>
        <summary>查看执行结果 JSON</summary>
        <pre class="exec-output__json">{{ rawJson }}</pre>
      </details>
    </section>
  </div>
</template>

<script setup lang="ts">
import type { HydrateState } from '~/studio-v2/workspace/brand-geo/composables/useGeoHydrate'

const props = defineProps<{
  watcherEnabled: boolean
  recentWatcherEvents: any[]
  watcherSummary: any
  executionSummary: any
  projectInfo: any
}>()

const rawJson = computed(() => {
  if (!props.projectInfo?.executionResults) return null
  return JSON.stringify(props.projectInfo.executionResults, null, 2)
})

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
.exec-output { padding: 0; }
.exec-output__section { margin-bottom: 16px; padding: 16px; background: #1e1e2e; border-radius: 8px; border: 1px solid #333; }
.exec-output__section h4 { margin: 0 0 12px; font-size: 14px; font-weight: 600; color: #aaa; text-transform: uppercase; letter-spacing: 0.5px; }
.exec-output__summary { display: flex; gap: 24px; }
.exec-output__stat { display: flex; flex-direction: column; gap: 4px; }
.exec-output__stat label { font-size: 11px; color: #888; text-transform: uppercase; }
.exec-output__stat span { font-size: 20px; font-weight: 700; color: #4ecca3; }
.exec-output__placeholder { padding: 12px; text-align: center; color: #666; font-size: 13px; }
.exec-output__json { max-height: 300px; overflow: auto; padding: 12px; background: #12121e; border-radius: 6px; font-size: 12px; line-height: 1.5; color: #aaccbb; }
.exec-output__watcher-summary { display: flex; gap: 16px; margin-bottom: 8px; font-size: 13px; color: #ccc; }
.exec-output__watcher-ok { color: #4ecca3; }
.exec-output__watcher-fail { color: #cc4e4e; }
.exec-output__watcher-list { display: flex; flex-direction: column; gap: 6px; }
.exec-output__watcher-item { display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-radius: 4px; background: rgba(255,255,255,0.02); font-size: 13px; }
.exec-output__watcher-item code { color: #4ecca3; font-family: monospace; }
.exec-output__watcher-op { color: #888; font-size: 12px; }
.exec-output__watcher-time { margin-left: auto; font-size: 11px; color: #666; font-family: monospace; }
.exec-output__watcher-ms { font-size: 11px; color: #888; font-family: monospace; }
.dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
.dot--ok { background: #4ecca3; }
.dot--fail { background: #cc4e4e; }
details { cursor: pointer; }
details summary { font-size: 13px; color: #888; padding: 4px 0; }
details summary:hover { color: #4ecca3; }
</style>
