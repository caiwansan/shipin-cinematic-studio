<template>
  <section class="scene-graph-panel">
    <div class="panel-header">
      <h2>🎬 Scene Graph</h2>
      <button class="btn-add" @click="$emit('add')" title="添加场景">＋</button>
    </div>
    <div class="scene-list" v-if="scenes.length > 0">
      <div
        v-for="(scene, i) in scenes"
        :key="scene.id"
        class="scene-card"
        :class="{ active: scene.id === activeSceneId }"
        @click="$emit('select', scene.id)"
      >
        <span class="scene-index">{{ i + 1 }}</span>
        <div class="scene-info">
          <span class="scene-type">{{ scene.type }}</span>
          <span class="scene-desc">{{ scene.description || '—' }}</span>
        </div>
        <button v-if="scene.id !== activeSceneId" class="btn-run" @click.stop="$emit('runFrom', scene.id)" title="从此场景开始运行">▶</button>
      </div>
    </div>
    <div v-else class="panel-empty">
      <p>添加场景以构建故事结构</p>
    </div>
  </section>
</template>

<script setup lang="ts">
defineProps<{
  scenes: { id: string; type: string; description: string }[]
  activeSceneId: string | null
}>()
defineEmits<{
  add: []
  select: [id: string]
  runFrom: [id: string]
}>()
</script>

<style scoped>
.scene-graph-panel {
  background: #12121a;
  border: 1px solid #1e1e2e;
  border-radius: 10px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow-y: auto;
}
.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.panel-header h2 { font-size: 0.95rem; color: #a0a0b0; margin: 0; }
.btn-add {
  width: 28px; height: 28px; border-radius: 6px;
  border: 1px solid #2a2a3e; background: #181825; color: #60a5fa;
  font-size: 1rem; cursor: pointer;
}
.scene-list { display: flex; flex-direction: column; gap: 8px; }
.scene-card {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 12px; border-radius: 8px;
  background: #181825; border: 1px solid #2a2a3e;
  cursor: pointer; transition: all 0.2s;
}
.scene-card:hover { border-color: #3a3a5e; }
.scene-card.active { border-color: #60a5fa; background: #1a1a3e; }
.scene-index {
  width: 24px; height: 24px; border-radius: 50%;
  background: #2a2a3e; display: flex; align-items: center;
  justify-content: center; font-size: 0.75rem; color: #888;
  flex-shrink: 0;
}
.scene-info { flex: 1; display: flex; flex-direction: column; gap: 2px; }
.scene-type { font-size: 0.85rem; color: #c0c0d0; }
.scene-desc { font-size: 0.75rem; color: #666; }
.btn-run {
  width: 28px; height: 28px; border-radius: 6px;
  border: 1px solid #064e3b; background: #064e3b20;
  color: #4ade80; cursor: pointer; font-size: 0.85rem;
}
.panel-empty { text-align: center; padding: 32px 0; color: #555; font-size: 0.85rem; }
</style>
