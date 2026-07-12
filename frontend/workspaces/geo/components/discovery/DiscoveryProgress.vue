<!-- DiscoveryProgress.vue — Scan Progress 卡片 -->
<template>
  <section class="geo-progress">
    <div class="geo-progress__header">
      <h2 class="geo-progress__title">
        <template v-if="vm.progress.isRunning">发现扫描进行中…</template>
        <template v-else-if="vm.progress.isCompleted">发现扫描已完成</template>
        <template v-else>发现扫描</template>
      </h2>
      <span v-if="vm.progress.isRunning" class="geo-progress__percent">{{ vm.progress.percent }}%</span>
      <span v-if="vm.progress.isCompleted" class="geo-progress__check">✓ 完成</span>
    </div>

    <!-- Progress Bar -->
    <div class="geo-progress__bar-track">
      <div
        class="geo-progress__bar-fill"
        :class="{ 'progress--running': vm.progress.isRunning, 'progress--done': vm.progress.isCompleted }"
        :style="{ width: vm.progress.percent + '%' }"
      />
    </div>

    <!-- Steps List -->
    <ul v-if="vm.progress.steps.length" class="geo-progress__steps">
      <li
        v-for="(step, i) in vm.progress.steps"
        :key="i"
        class="geo-progress__step"
        :class="{ 'step--done': vm.progress.isCompleted, 'step--active': vm.progress.isRunning && i === activeStepIndex }"
      >
        <span class="geo-progress__step-icon">
          <template v-if="vm.progress.isCompleted">✓</template>
          <template v-else-if="i === activeStepIndex">⟳</template>
          <template v-else>○</template>
        </span>
        <span class="geo-progress__step-text">{{ step }}</span>
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { DiscoveryVM } from '../../viewmodels/DiscoveryViewModel'

const props = defineProps<{ vm: DiscoveryVM }>()

const activeStepIndex = computed(() => {
  if (!props.vm.progress.isRunning) return -1
  return Math.min(
    props.vm.progress.steps.length - 1,
    Math.floor((props.vm.progress.percent / 100) * props.vm.progress.steps.length) - 1
  )
})
</script>

<style scoped>
.geo-progress {
  background: #fff;
  border-radius: 12px;
  padding: 20px;
  border: 1px solid #e2e8f0;
}

.geo-progress__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.geo-progress__title {
  font-size: 15px;
  font-weight: 600;
  color: #1a1a2e;
  margin: 0;
}

.geo-progress__percent {
  font-size: 14px;
  font-weight: 700;
  color: #3b82f6;
}

.geo-progress__check {
  font-size: 14px;
  font-weight: 600;
  color: #16a34a;
}

.geo-progress__bar-track {
  height: 8px;
  background: #e2e8f0;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 14px;
}

.geo-progress__bar-fill {
  height: 100%;
  border-radius: 4px;
  transition: width .4s ease;
}

.progress--running {
  background: linear-gradient(90deg, #3b82f6, #8b5cf6);
  animation: shimmer 2s infinite;
}

.progress--done {
  background: #22c55e;
}

@keyframes shimmer {
  0% { opacity: 1; }
  50% { opacity: .6; }
  100% { opacity: 1; }
}

.geo-progress__steps {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.geo-progress__step {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
  font-size: 13px;
  color: #64748b;
}

.step--active {
  color: #3b82f6;
  font-weight: 500;
}

.step--done {
  color: #16a34a;
}

.geo-progress__step-icon {
  width: 16px;
  text-align: center;
  font-size: 12px;
  flex-shrink: 0;
}

.step--active .geo-progress__step-icon {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
