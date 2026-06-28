<template>
  <section class="timeline-panel">
    <div class="panel-header">
      <h2>🕐 Timeline</h2>
    </div>

    <div class="timeline-scroll">
      <div
        v-for="scene in scenes"
        :key="scene.id"
        class="timeline-row"
        :class="{ active: scene.id === activeSceneId, past: isPast(scene.id) }"
      >
        <div class="scene-label">
          <span class="tl-index">{{ indexOf(scene.id) }}</span>
          <span class="tl-name">{{ scene.type }}</span>
        </div>
        <div class="timeline-bar">
          <div
            v-for="shot in shotCountFor(scene.id)"
            :key="shot"
            class="tl-shot"
            :class="{ highlighted: scene.id === activeSceneId && shot - 1 === currentShotIndex }"
            @click="$emit('seek', scene.id, shot - 1)"
          >
            <div class="shot-dot"></div>
            <span class="shot-label">S{{ shot }}</span>
          </div>
          <div class="tl-line"></div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
const props = defineProps<{
  scenes: { id: string; type: string }[]
  activeSceneId: string | null
  currentShotIndex: number
  completedScenes: number
}>()
defineEmits<{ seek: [sceneId: string, shotIndex: number] }>()

function indexOf(id: string) { return props.scenes.findIndex(s => s.id === id) + 1 }
function isPast(id: string) { return props.scenes.findIndex(s => s.id === id) < props.completedScenes }
function shotCountFor(_id: string) { return 3 } // 占位：实际从 runtime 获取
</script>

<style scoped>
.timeline-panel {
  background: #12121a; border: 1px solid #1e1e2e; border-radius: 10px;
  padding: 16px; display: flex; flex-direction: column; gap: 12px;
}
.panel-header h2 { font-size: 0.95rem; color: #a0a0b0; margin: 0; }
.timeline-scroll { display: flex; flex-direction: column; gap: 12px; overflow-y: auto; }
.timeline-row { display: flex; gap: 12px; align-items: center; }
.timeline-row.active .scene-label .tl-name { color: #60a5fa; }
.timeline-row.past .tl-line { background: #2a2a3e; }
.scene-label {
  display: flex; align-items: center; gap: 6px; width: 100px; flex-shrink: 0;
}
.tl-index {
  width: 20px; height: 20px; border-radius: 50%;
  background: #2a2a3e; display: flex; align-items: center;
  justify-content: center; font-size: 0.7rem; color: #666;
}
.tl-name { font-size: 0.8rem; color: #888; }
.timeline-bar {
  flex: 1; display: flex; gap: 8px; align-items: center;
  position: relative; padding: 4px 0;
}
.tl-line {
  position: absolute; top: 50%; left: 0; right: 0;
  height: 2px; background: #1e1e2e; z-index: 0; transform: translateY(-50%);
}
.tl-shot {
  display: flex; flex-direction: column; align-items: center;
  gap: 2px; cursor: pointer; z-index: 1; position: relative;
}
.shot-dot {
  width: 10px; height: 10px; border-radius: 50%;
  background: #2a2a3e; transition: all 0.2s;
}
.tl-shot.highlighted .shot-dot { background: #60a5fa; box-shadow: 0 0 8px #60a5fa80; }
.shot-label { font-size: 0.65rem; color: #555; }
</style>
