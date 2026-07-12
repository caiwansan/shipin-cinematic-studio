<!-- @deprecated 未被任何页面引用，MissionControl 重构中废弃 -->
<template>
  <div class="mc-kpis">
    <div class="mc-kpis__card">
      <span class="mc-kpis__value">{{ readyCount }}</span>
      <span class="mc-kpis__label">可继续的任务</span>
    </div>
    <div class="mc-kpis__card">
      <span class="mc-kpis__value">{{ verificationReady }}</span>
      <span class="mc-kpis__label">待验证</span>
    </div>
    <div class="mc-kpis__card mc-kpis__card--warn" v-if="blockedCount > 0">
      <span class="mc-kpis__value">{{ blockedCount }}</span>
      <span class="mc-kpis__label">受阻的任务</span>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  readyCount: number
  verificationReady: number
  blockedCount: number
}>()
</script>

<style scoped>
.mc-kpis {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}
.mc-kpis__card {
  padding: 16px;
  background: #f9fafb;
  border-radius: 12px;
  border: 1px solid #e5e7eb;
  text-align: center;
}
.mc-kpis__card--warn {
  border-color: #fde68a;
  background: #fffbeb;
}
.mc-kpis__value {
  display: block;
  font-size: 28px;
  font-weight: 700;
  color: #111827;
  line-height: 1.2;
}
.mc-kpis__label {
  font-size: 13px;
  color: #6b7280;
  margin-top: 4px;
  display: block;
}
</style>
