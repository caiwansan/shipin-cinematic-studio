<!--
  MediaPageHeader — 产品级页面头（Sprint-MEDIA-UX-03）
  世界级 SaaS 页面头：标题 + 描述 + 右侧操作区
  全部使用 Enterprise Design Tokens（CTO Frozen）
-->
<template>
  <div class="mph">
    <div class="mph-left">
      <div class="mph-kicker">{{ kicker }}</div>
      <h1 class="mph-title">{{ title }}</h1>
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
}
.mph-desc {
  font-size: 13px;
  color: var(--color-text-secondary);
  margin: 6px 0 0;
  max-width: 560px;
  line-height: 1.6;
}
.mph-actions {
  display: flex;
  gap: 10px;
  align-items: center;
}
</style>
