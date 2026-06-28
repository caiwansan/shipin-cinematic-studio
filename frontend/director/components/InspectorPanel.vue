<template>
  <section class="inspector-panel">
    <div class="panel-header">
      <h2>🔍 Inspector</h2>
    </div>

    <div class="inspector-tabs">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        class="tab-btn"
        :class="{ active: activeTab === tab.key }"
        @click="activeTab = tab.key"
      >{{ tab.label }}</button>
    </div>

    <!-- 记忆面板 -->
    <div v-if="activeTab === 'memory'" class="tab-content">
      <div v-if="memory" class="memory-section">
        <div v-for="(char, name) in memory.characters" :key="name" class="memory-card">
          <div class="char-name">{{ name }}</div>
          <div class="emotion-list">
            <span
              v-for="e in (char.emotionalStates || []).slice(-3)"
              :key="e.emotion"
              class="emotion-tag"
            >{{ e.emotion }}</span>
          </div>
        </div>
      </div>
      <div v-else class="panel-empty">暂无记忆数据</div>
    </div>

    <!-- 身份面板 -->
    <div v-if="activeTab === 'identity'" class="tab-content">
      <div v-if="Object.keys(identities).length > 0" class="identity-section">
        <div v-for="(vec, name) in identities" :key="name" class="identity-card">
          <div class="id-char-name">{{ name }}</div>
          <div v-for="(val, key) in vec" :key="key" class="id-row">
            <span class="id-key">{{ key }}</span>
            <div class="id-bar"><div class="id-bar-fill" :style="{ width: (val * 100).toFixed(0) + '%' }"></div></div>
            <span class="id-val">{{ (val * 100).toFixed(0) }}</span>
          </div>
        </div>
      </div>
      <div v-else class="panel-empty">暂无身份数据</div>
    </div>

    <!-- 决策面板 -->
    <div v-if="activeTab === 'decisions'" class="tab-content">
      <div v-if="decisions.length > 0">
        <div v-for="(d, i) in decisions" :key="i" class="decision-card">
          <div class="decision-rule">{{ d.rule }}</div>
          <div class="decision-action">{{ d.action }}</div>
          <div class="decision-reason">{{ d.reason }}</div>
        </div>
      </div>
      <div v-else class="panel-empty">暂无自适应决策</div>
    </div>

    <!-- Export 面板 -->
    <div v-if="activeTab === 'export'" class="tab-content">
      <div v-if="exportData" class="export-preview">
        <p class="export-summary">{{ exportData.summary }}</p>
        <div v-for="s in exportData.scenes" :key="s.sceneId" class="export-scene">
          <span>{{ s.sceneId }}</span>
          <span class="export-tone">{{ s.emotionalTone }}</span>
          <span class="export-pacing">{{ s.pacingHint }}</span>
        </div>
      </div>
      <div v-else class="panel-empty">点击"导出"获取投影</div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { MemorySnapshot, IdentityVector, AdaptiveDecision } from '../stores/directorStore'

defineProps<{
  memory: MemorySnapshot | null
  identities: Record<string, IdentityVector>
  decisions: AdaptiveDecision[]
  exportData: any
}>()

const tabs = [
  { key: 'memory', label: '🧠 记忆' },
  { key: 'identity', label: '🧬 身份' },
  { key: 'decisions', label: '⚙️ 决策' },
  { key: 'export', label: '📤 投影' },
]
const activeTab = ref('memory')
</script>

<style scoped>
.inspector-panel {
  background: #12121a; border: 1px solid #1e1e2e; border-radius: 10px;
  padding: 16px; display: flex; flex-direction: column; gap: 12px; overflow-y: auto;
}
.panel-header h2 { font-size: 0.95rem; color: #a0a0b0; margin: 0; }
.inspector-tabs { display: flex; gap: 4px; background: #0a0a0f; border-radius: 6px; padding: 3px; }
.tab-btn {
  flex: 1; padding: 5px 8px; border: none; border-radius: 4px;
  background: transparent; color: #666; font-size: 0.75rem; cursor: pointer;
  transition: all 0.2s;
}
.tab-btn.active { background: #2a2a3e; color: #c0c0d0; }
.tab-content { display: flex; flex-direction: column; gap: 8px; max-height: 300px; overflow-y: auto; }
.memory-card, .identity-card, .decision-card {
  padding: 8px 10px; background: #181825; border-radius: 6px;
}
.char-name, .id-char-name { font-size: 0.8rem; color: #60a5fa; margin-bottom: 4px; }
.emotion-list { display: flex; gap: 4px; flex-wrap: wrap; }
.emotion-tag {
  padding: 2px 6px; background: #1e1e2e; border-radius: 3px;
  font-size: 0.7rem; color: #888;
}
.id-row { display: flex; align-items: center; gap: 6px; margin: 2px 0; }
.id-key { font-size: 0.7rem; color: #666; width: 50px; }
.id-bar { flex: 1; height: 4px; background: #1e1e2e; border-radius: 2px; overflow: hidden; }
.id-bar-fill { height: 100%; background: linear-gradient(90deg, #60a5fa, #a78bfa); border-radius: 2px; }
.id-val { font-size: 0.7rem; color: #888; width: 24px; text-align: right; }
.decision-rule { font-size: 0.75rem; color: #fbbf24; }
.decision-action { font-size: 0.75rem; color: #c0c0d0; }
.decision-reason { font-size: 0.7rem; color: #666; }
.export-summary { font-size: 0.8rem; color: #888; margin-bottom: 8px; }
.export-scene { display: flex; gap: 8px; font-size: 0.75rem; padding: 4px 0; color: #777; }
.export-tone { color: #60a5fa; }
.export-pacing { color: #888; }
.panel-empty { text-align: center; padding: 24px 0; color: #555; font-size: 0.8rem; }
</style>
