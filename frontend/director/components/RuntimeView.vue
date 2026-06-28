<template>
  <section class="runtime-view-panel">
    <div class="panel-header">
      <h2>🎞 Runtime View</h2>
      <span v-if="state" class="status-badge" :class="{ playing: state.isPlaying }">
        {{ state.isPlaying ? '▶ 运行中' : '⏸ 暂停' }}
      </span>
    </div>

    <!-- 状态卡 -->
    <div v-if="state" class="status-card">
      <div class="stat-row">
        <span>场景</span>
        <strong>{{ state.currentSceneId || '—' }}</strong>
      </div>
      <div class="stat-row">
        <span>镜头</span>
        <strong>{{ state.currentShotIndex + 1 }} / 总</strong>
      </div>
      <div class="stat-row">
        <span>强度</span>
        <strong :style="{ color: intensityColor }">{{ (state.intensity * 100).toFixed(0) }}%</strong>
      </div>
      <div class="stat-row">
        <span>进度</span>
        <strong>{{ state.completedScenes }}/{{ state.totalScenes }}</strong>
      </div>
      <div class="stat-row">
        <span>时间</span>
        <strong>{{ state.playbackTime.toFixed(1) }}s</strong>
      </div>
    </div>

    <!-- 空状态 -->
    <div v-else class="panel-empty">
      <p>启动运行时以查看执行状态</p>
    </div>

    <!-- 身份向量迷你图 -->
    <div v-if="identityKeys.length > 0" class="identity-mini">
      <div class="mini-title">🧠 身份</div>
      <div v-for="(name, i) in identityKeys" :key="name" class="identity-bar-row">
        <span class="id-label">{{ name.slice(0, 4) }}</span>
        <div class="id-bar-bg">
          <div
            class="id-bar-fill"
            :style="{ width: ((identities[name]?.[activeChar] ?? 0.5) * 100).toFixed(0) + '%' }"
          ></div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { RuntimeState } from '../stores/directorStore'

const props = defineProps<{
  state: RuntimeState | null
  identityKeys: string[]
  identities: Record<string, Record<string, number>>
  activeChar: string
}>()

const intensityColor = computed(() => {
  if (!props.state) return '#888'
  const i = props.state.intensity
  return i > 0.7 ? '#f87171' : i > 0.4 ? '#fbbf24' : '#4ade80'
})
</script>

<style scoped>
.runtime-view-panel {
  background: #12121a; border: 1px solid #1e1e2e; border-radius: 10px;
  padding: 16px; display: flex; flex-direction: column; gap: 12px; overflow-y: auto;
}
.panel-header {
  display: flex; justify-content: space-between; align-items: center;
}
.panel-header h2 { font-size: 0.95rem; color: #a0a0b0; margin: 0; }
.status-badge {
  font-size: 0.7rem; padding: 3px 8px; border-radius: 4px;
  background: #2a2a3e; color: #888;
}
.status-badge.playing { background: #064e3b; color: #4ade80; }
.status-card {
  display: flex; flex-direction: column; gap: 6px;
  padding: 12px; background: #181825; border-radius: 8px;
}
.stat-row {
  display: flex; justify-content: space-between; font-size: 0.85rem;
}
.stat-row span { color: #666; }
.stat-row strong { color: #c0c0d0; }
.identity-mini { margin-top: 4px; }
.mini-title { font-size: 0.8rem; color: #888; margin-bottom: 8px; }
.identity-bar-row { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; }
.id-label { font-size: 0.7rem; color: #666; width: 28px; flex-shrink: 0; }
.id-bar-bg { flex: 1; height: 6px; background: #1e1e2e; border-radius: 3px; overflow: hidden; }
.id-bar-fill { height: 100%; background: linear-gradient(90deg, #60a5fa, #a78bfa); border-radius: 3px; transition: width 0.3s; }
.panel-empty { text-align: center; padding: 32px 0; color: #555; font-size: 0.85rem; }
</style>
