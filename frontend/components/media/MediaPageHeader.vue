<!--
  MediaPageHeader — 产品级页面头（Sprint-MEDIA-UX-03 + GOVERNANCE-02）
  四要素：页面名称 + 一句 AI 产品解释 + 当前状态 + 快捷操作
  全部使用 Kunlun Design Token（CTO Frozen）
-->
<template>
  <div class="mph">
    <div class="mph-left">
      <div class="mph-kicker">{{ kicker }}</div>
      <h1 class="mph-title">
        {{ title }}
        <span v-if="status" class="mph-status" :class="`mph-status--${status.type || 'off'}`">
          <span class="mph-status-dot"></span>
          {{ status.text }}
        </span>
      </h1>
      <p v-if="desc" class="mph-desc">{{ desc }}</p>
    </div>
    <div v-if="$slots.actions" class="mph-actions">
      <slot name="actions" />
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  kicker: string
  title: string
  desc?: string
  status?: { text: string; type?: 'ok' | 'warn' | 'off' }
}>()
</script>

<style scoped>
.mph {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 20px;
  margin-bottom: 24px;
  flex-wrap: wrap;
}
.mph-kicker {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--color-intelligence);
  margin-bottom: 6px;
}
.mph-title {
  font-size: 24px;
  font-weight: 800;
  color: var(--color-text-primary);
  margin: 0;
  letter-spacing: -0.02em;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}
.mph-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 700;
  border-radius: var(--media-radius-pill);
  padding: 3px 12px;
  letter-spacing: 0;
  white-space: nowrap;
}
.mph-status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
}
.mph-status--ok {
  background: rgba(16, 185, 129, 0.09);
  color: #059669;
  border: 1px solid rgba(16, 185, 129, 0.25);
}
.mph-status--ok .mph-status-dot {
  background: #10B981;
}
.mph-status--warn {
  background: rgba(217, 119, 6, 0.09);
  color: #B45309;
  border: 1px solid rgba(217, 119, 6, 0.25);
}
.mph-status--warn .mph-status-dot {
  background: #D97706;
}
.mph-status--off {
  background: var(--color-bg-hover);
  color: var(--color-text-muted);
  border: 1px solid var(--color-border-primary);
}
.mph-status--off .mph-status-dot {
  background: var(--color-text-disabled);
}
.mph-desc {
  font-size: 13px;
  color: var(--color-text-secondary);
  margin: 8px 0 0;
  max-width: 600px;
  line-height: 1.7;
}
.mph-actions {
  display: flex;
  gap: 10px;
  align-items: center;
}
</style>
