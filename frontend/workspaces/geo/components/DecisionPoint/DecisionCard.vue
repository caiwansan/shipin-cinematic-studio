<template>
  <div class="dp-decision">
    <div class="dp-decision__card">
      <div class="dp-decision__header">
        <div class="dp-decision__problem-label">当前问题</div>
        <h2 class="dp-decision__problem">{{ problem }}</h2>
      </div>
      <div class="dp-decision__body">
        <div class="dp-decision__row">
          <span class="dp-decision__label">建议方案</span>
          <p class="dp-decision__value">{{ solution }}</p>
        </div>
        <div class="dp-decision__row">
          <span class="dp-decision__label">预期结果</span>
          <p class="dp-decision__value dp-decision__value--gain">
            {{ expectedResult }}
          </p>
        </div>
        <div class="dp-decision__row" v-if="effort">
          <span class="dp-decision__label">预计耗时</span>
          <p class="dp-decision__value">{{ effort }}</p>
        </div>
      </div>
      <div class="dp-decision__actions">
        <button
          class="dp-decision__cta"
          :disabled="disabled"
          @click="$emit('execute')"
        >
          {{ ctaLabel || '执行方案 →' }}
        </button>
        <button
          v-if="showSecondary"
          class="dp-decision__secondary"
          @click="$emit('secondary')"
        >
          {{ secondaryLabel || '查看其他方案' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  problem: string
  solution: string
  expectedResult: string
  effort?: string
  ctaLabel?: string
  showSecondary?: boolean
  secondaryLabel?: string
  disabled?: boolean
}>()
defineEmits<{
  execute: []
  secondary: []
}>()
</script>

<style scoped>
.dp-decision__card {
  border-radius: 16px;
  background: linear-gradient(135deg, #1e3a5f 0%, #1e40af 100%);
  padding: 36px;
  color: #fff;
}
.dp-decision__header {
  margin-bottom: 24px;
  padding-bottom: 24px;
  border-bottom: 1px solid rgba(255,255,255,0.15);
}
.dp-decision__problem-label {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  opacity: 0.7;
  margin-bottom: 8px;
}
.dp-decision__problem {
  font-size: 22px;
  font-weight: 700;
  margin: 0;
  line-height: 1.4;
}
.dp-decision__body {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 32px;
}
.dp-decision__row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.dp-decision__label {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  opacity: 0.6;
}
.dp-decision__value {
  font-size: 15px;
  margin: 0;
  line-height: 1.5;
  opacity: 0.9;
}
.dp-decision__value--gain {
  font-size: 18px;
  font-weight: 700;
  opacity: 1;
  color: #86efac;
}
.dp-decision__actions {
  display: flex;
  gap: 12px;
  align-items: center;
}
.dp-decision__cta {
  padding: 12px 36px;
  background: #fff;
  color: #1e40af;
  border: none;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s;
}
.dp-decision__cta:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(0,0,0,0.2);
}
.dp-decision__cta:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.dp-decision__secondary {
  padding: 12px 24px;
  background: transparent;
  color: #fff;
  border: 1px solid rgba(255,255,255,0.3);
  border-radius: 10px;
  font-size: 14px;
  cursor: pointer;
  opacity: 0.8;
  transition: opacity 0.15s;
}
.dp-decision__secondary:hover {
  opacity: 1;
}
</style>
