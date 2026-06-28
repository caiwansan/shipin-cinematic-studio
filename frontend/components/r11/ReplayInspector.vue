<template>
  <div class="r11-replay-inspector">
    <!-- Header -->
    <div class="replay-header">
      <span class="domain-tag">{{ replay.domain }}</span>
      <span class="iteration">Iteration #{{ replay.iteration }}</span>
      <span :class="['determinism-badge', replay.deterministic ? 'stable' : 'unstable']">
        {{ replay.deterministic ? '✅ Deterministic' : '⚠️ Non-deterministic' }}
      </span>
    </div>

    <!-- Step slider -->
    <div class="slider-section">
      <input
        type="range"
        :min="1"
        :max="replay.totalSteps"
        v-model.number="currentStep"
        class="step-slider"
      />
      <span class="step-label">Step {{ currentStep }} / {{ replay.totalSteps }}</span>
    </div>

    <!-- Current step detail -->
    <div class="step-detail" v-if="currentStepData">
      <div class="step-header">
        <span class="step-id">{{ currentStepData.nodeId }}</span>
        <span class="step-type">({{ currentStepData.nodeType }})</span>
      </div>

      <!-- Incoming arrows -->
      <div class="flow-section" v-if="currentStepData.incomingFrom.length > 0">
        <div class="flow-label">← Incoming</div>
        <div class="flow-nodes">
          <span v-for="n in currentStepData.incomingFrom" :key="n" class="flow-node">
            {{ n }}
          </span>
        </div>
      </div>

      <!-- Outgoing arrows -->
      <div class="flow-section" v-if="currentStepData.outgoingTo.length > 0">
        <div class="flow-label">→ Outgoing</div>
        <div class="flow-nodes">
          <span v-for="n in currentStepData.outgoingTo" :key="n" class="flow-node">
            {{ n }}
          </span>
        </div>
      </div>
    </div>

    <!-- Full trace sequence -->
    <div class="trace-sequence">
      <div class="trace-label">Execution Trace</div>
      <div class="trace-steps">
        <div
          v-for="(step, i) in replay.steps"
          :key="i"
          :class="['trace-step', { active: i + 1 === currentStep }]"
          @click="currentStep = i + 1"
        >
          <span class="step-num">{{ step.step }}</span>
          <span class="step-name">{{ step.nodeId }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, type PropType, ref, computed } from 'vue'
import type { ReplayRenderData } from './r11-api'

export default defineComponent({
  name: 'ReplayInspector',
  props: {
    replay: {
      type: Object as PropType<ReplayRenderData>,
      required: true,
    },
  },
  setup(props) {
    const currentStep = ref(1)

    const currentStepData = computed(() => {
      return props.replay.steps.find(s => s.step === currentStep.value) || null
    })

    return { currentStep, currentStepData }
  },
})
</script>

<style scoped>
.r11-replay-inspector {
  background: #1a1a2e;
  border-radius: 8px;
  padding: 16px;
  color: #e0e0e0;
  font-family: monospace;
  font-size: 13px;
}
.replay-header {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 8px;
  border-bottom: 1px solid #333;
}
.domain-tag {
  background: #1565c0;
  padding: 2px 10px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: bold;
}
.iteration {
  color: #90caf9;
  font-size: 12px;
}
.determinism-badge {
  margin-left: auto;
  padding: 2px 10px;
  border-radius: 4px;
  font-size: 11px;
}
.determinism-badge.stable { background: #1b5e20; color: #4caf50; }
.determinism-badge.unstable { background: #b71c1c; color: #f44336; }

.slider-section {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}
.step-slider {
  flex: 1;
  accent-color: #4fc3f7;
  height: 4px;
}
.step-label {
  color: #78909c;
  font-size: 12px;
  min-width: 100px;
  text-align: right;
}

.step-detail {
  background: #16213e;
  border-radius: 6px;
  padding: 12px;
  margin-bottom: 16px;
}
.step-header {
  margin-bottom: 8px;
}
.step-id {
  color: #4fc3f7;
  font-weight: bold;
  font-size: 16px;
}
.step-type {
  color: #78909c;
  font-size: 12px;
  margin-left: 4px;
}
.flow-section {
  margin-top: 8px;
}
.flow-label {
  color: #78909c;
  font-size: 11px;
  margin-bottom: 4px;
}
.flow-nodes {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.flow-node {
  background: #0d2137;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  color: #90caf9;
  border: 1px solid #1a3a5c;
}

.trace-sequence {
  margin-top: 8px;
}
.trace-label {
  color: #78909c;
  font-size: 11px;
  margin-bottom: 6px;
}
.trace-steps {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.trace-step {
  display: flex;
  align-items: center;
  gap: 4px;
  background: #0d2137;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 11px;
  border: 1px solid transparent;
  transition: all 0.2s;
}
.trace-step:hover {
  border-color: #4fc3f7;
}
.trace-step.active {
  border-color: #4fc3f7;
  background: #1a3a5c;
}
.step-num {
  color: #546e7a;
  font-size: 10px;
}
.step-name {
  color: #90caf9;
}
</style>
