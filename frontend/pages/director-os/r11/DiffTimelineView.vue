<template>
  <div class="r11-diff-view">
    <div class="controls">
      <label class="domain-select">
        Domain:
        <select v-model="selectedDomain">
          <option v-for="d in domains" :key="d" :value="d">{{ d }}</option>
        </select>
      </label>
      <button class="run-btn" @click="$emit('runDiff', { domain: selectedDomain })">
        Run Diff
      </button>
    </div>

    <div class="diff-container" v-if="diffData">
      <DiffTimeline :diff="diffData" />
    </div>
    <div class="empty-state" v-else>
      Select domain and click "Run Diff" to compare baseline vs current
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref } from 'vue'
import DiffTimeline from '../../../components/r11/DiffTimeline.vue'
import type { DiffRenderData } from '../../../components/r11/r11-api'

export default defineComponent({
  name: 'DiffTimelineView',
  components: { DiffTimeline },
  props: {
    domains: {
      type: Array as () => string[],
      required: true,
    },
  },
  emits: ['runDiff'],
  setup() {
    const selectedDomain = ref('')
    const diffData = ref<DiffRenderData | null>(null)

    function updateDiff(data: DiffRenderData | null) {
      diffData.value = data
    }

    return { selectedDomain, diffData, updateDiff }
  },
})
</script>

<style scoped>
.r11-diff-view {
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
.diff-container {
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
