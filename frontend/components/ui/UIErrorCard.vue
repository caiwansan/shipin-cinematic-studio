<template>
  <div :class="['ui-error-card', { 'ui-error-card--dismissed': dismissed }]">
    <div class="ui-error-card__main">
      <div class="ui-error-card__icon">
        <span v-if="severity === 'critical'">🚨</span>
        <span v-else-if="severity === 'warning'">⚠️</span>
        <span v-else>❌</span>
      </div>
      <div class="ui-error-card__body">
        <div class="ui-error-card__title">{{ title }}</div>
        <div v-if="reason" class="ui-error-card__reason">原因：{{ reason }}</div>
        <div v-if="impact" class="ui-error-card__impact">影响：{{ impact }}</div>
      </div>
      <div class="ui-error-card__actions">
        <button v-if="onRetry" class="ui-error-card__btn ui-error-card__btn--retry" @click="$emit('retry')">
          重试
        </button>
        <button v-if="detailRoute" class="ui-error-card__btn ui-error-card__btn--detail" @click="$emit('viewDetail')">
          详情
        </button>
        <button v-if="dismissable" class="ui-error-card__btn ui-error-card__btn--dismiss" @click="dismissed = true">
          ✕
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

defineProps<{
  title: string
  reason?: string
  impact?: string
  severity?: 'error' | 'warning' | 'critical'
  onRetry?: boolean
  detailRoute?: string
  dismissable?: boolean
}>()

defineEmits<{
  (e: 'retry'): void
  (e: 'viewDetail'): void
}>()

const dismissed = ref(false)
</script>

<style scoped>
.ui-error-card {
  background: #fff;
  border: 1px solid #fecaca;
  border-left: 4px solid #ef4444;
  border-radius: 10px;
  padding: 16px 18px;
  margin-bottom: 12px;
  transition: opacity .3s;
}
.ui-error-card--dismissed { display: none; }

.ui-error-card--warning { border-left-color: #f97316; border-color: #fed7aa; }
.ui-error-card--critical { border-left-color: #dc2626; }

.ui-error-card__main { display: flex; align-items: flex-start; gap: 12px; }
.ui-error-card__icon { font-size: 20px; flex-shrink: 0; margin-top: 2px; }
.ui-error-card__body { flex: 1; min-width: 0; }
.ui-error-card__title { font-size: 14px; font-weight: 600; color: #991b1b; margin-bottom: 4px; }
.ui-error-card__reason,
.ui-error-card__impact { font-size: 13px; color: #64748b; }
.ui-error-card__actions { display: flex; gap: 6px; flex-shrink: 0; }
.ui-error-card__btn {
  font-size: 12px;
  padding: 4px 12px;
  border-radius: 6px;
  border: none;
  cursor: pointer;
  font-weight: 500;
}
.ui-error-card__btn--retry { background: #fee2e2; color: #991b1b; }
.ui-error-card__btn--retry:hover { background: #fecaca; }
.ui-error-card__btn--detail { background: #f1f5f9; color: #475569; }
.ui-error-card__btn--detail:hover { background: #e2e8f0; }
.ui-error-card__btn--dismiss { background: none; color: #94a3b8; padding: 4px 6px; }
.ui-error-card__btn--dismiss:hover { color: #475569; }
</style>
