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
  width: 60px;
  height: 60px;
  border-radius: 16px;
  background: var(--color-bg-hover);
  border: 1px solid var(--color-border-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 8px;
}
.mes-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--color-text-primary);
}
.mes-desc {
  font-size: 12px;
  color: var(--color-text-secondary);
  max-width: 340px;
  line-height: 1.6;
}
.mes-source {
  margin-top: 10px;
  font-size: 10px;
  color: var(--color-text-disabled);
  background: var(--color-bg-secondary);
  border: 1px dashed var(--color-border-primary);
  border-radius: 8px;
  padding: 4px 12px;
  letter-spacing: 0.04em;
}
.mes-action {
  margin-top: 12px;
}
</style>
