<!--
  MediaEmptyState — 诚实空态（Sprint-MEDIA-UX-03）
  真实数据未接入时展示；注明数据源与接入 Sprint，禁 mock
-->
<template>
  <div class="mes">
    <div class="mes-ico">{{ icon }}</div>
    <div class="mes-title">{{ title }}</div>
    <div v-if="desc" class="mes-desc">{{ desc }}</div>
    <div class="mes-source">数据源：{{ source }}</div>
    <div v-if="action" class="mes-action">
      <slot name="action" />
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  icon: string
  title: string
  desc?: string
  source: string
  action?: boolean
}>()
</script>

<style scoped>
.mes {
  text-align: center;
  padding: 36px 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}
.mes-ico {
  font-size: 30px;
  width: 64px;
  height: 64px;
  border-radius: 18px;
  background: var(--media-brand-soft);
  border: 1px solid var(--media-ai-border);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 10px;
  box-shadow: 0 6px 18px rgba(2, 6, 23, 0.4);
}
.mes-title {
  font-size: 14px;
  font-weight: 800;
  color: var(--media-text-title);
}
.mes-desc {
  font-size: 12px;
  color: var(--media-text-body);
  max-width: 360px;
  line-height: 1.7;
}
.mes-source {
  margin-top: 12px;
  font-size: 10px;
  color: var(--media-text-dim);
  background: var(--color-bg-secondary);
  border: 1px dashed var(--color-border-secondary);
  border-radius: var(--media-radius-pill);
  padding: 4px 14px;
  letter-spacing: 0.04em;
  font-family: var(--font-mono);
}
.mes-action {
  margin-top: 14px;
}
</style>
