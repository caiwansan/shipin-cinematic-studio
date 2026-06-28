<template>
  <div class="r11-replay-view">
    <div class="controls">
      <label class="domain-select">
        Domain:
        <select v-model="selectedDomain">
          <option v-for="d in domains" :key="d" :value="d">{{ d }}</option>
        </select>
      </label>
      <button class="run-btn" @click="$emit('runReplay', { domain: selectedDomain })">
        Run Replay
      </button>
    </div>

    <div class="replay-container" v-if="replayData">
      <ReplayInspector :replay="replayData" />
    </div>
    <div class="empty-state" v-else>
      Select domain and click "Run Replay" to view execution trace
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref } from 'vue'
import ReplayInspector from '../../../components/r11/ReplayInspector.vue'
import type { ReplayRenderData } from '../../../components/r11/r11-api'

export default defineComponent({
  name: 'ReplayView',
  components: { ReplayInspector },
  props: {
    domains: {
      type: Array as () => string[],
      required: true,
    },
  },
  emits: ['runReplay'],
  setup() {
    const selectedDomain = ref('')
    const replayData = ref<ReplayRenderData | null>(null)

    function updateReplay(data: ReplayRenderData | null) {
      replayData.value = data
    }

    return { selectedDomain, replayData, updateReplay }
  },
})
</script>

<style scoped>
.r11-replay-view {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.controls {
  display: flex;
  gap: 12px;
  align-items: center;
}
.controls select {
  background: #16213e;
  color: #e0e0e0;
  border: 1px solid #333;
  border-radius: 4px;
  padding: 4px 8px;
  font-family: monospace;
}
.run-btn {
  background: #1565c0;
  color: #fff;
  border: none;
  border-radius: 4px;
  padding: 6px 16px;
  cursor: pointer;
  font-family: monospace;
  font-size: 13px;
}
.run-btn:hover {
  background: #1976d2;
}
.replay-container {
  background: #0d1117;
  border-radius: 8px;
  padding: 12px;
}
.empty-state {
  background: #0d1117;
  border-radius: 8px;
  padding: 40px;
  text-align: center;
  color: #546e7a;
  font-size: 14px;
}
</style>
