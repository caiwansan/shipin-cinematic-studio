<!--
  MediaPanel — 驾驶舱面板容器（Sprint-MEDIA-UX-03）
  标题 + 说明 + 可选操作区 + 内容插槽
-->
<template>
  <section class="mp">
    <div class="mp-head">
      <div class="mp-head-left">
        <span class="mp-icon">{{ icon }}</span>
        <div>
          <h3 class="mp-title">{{ title }}</h3>
          <p v-if="sub" class="mp-sub">{{ sub }}</p>
        </div>
      </div>
      <div v-if="$slots.actions" class="mp-actions">
        <slot name="actions" />
      </div>
    </div>
    <div class="mp-body">
      <slot />
    </div>
  </section>
</template>

<script setup lang="ts">
defineProps<{
  icon: string
  title: string
  sub?: string
}>()
</script>

<style scoped>
.mp {
  background: var(--media-card-bg);
  border: 1px solid var(--media-card-border);
  border-radius: var(--media-radius-card);
  overflow: hidden;
  box-shadow: var(--media-card-shadow);
  transition: border-color 0.2s;
}
.mp:hover { border-color: var(--media-card-border-hover); }
.mp-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--color-border-primary);
  background: linear-gradient(180deg, rgba(139, 92, 246, 0.07), transparent);
}
.mp-head-left {
  display: flex;
  align-items: center;
  gap: 12px;
}
.mp-icon {
  width: 36px;
  height: 36px;
  border-radius: var(--media-radius-node);
  background: var(--media-brand-soft);
  border: 1px solid var(--media-ai-border);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
}
.mp-title {
  font-size: 14px;
  font-weight: 800;
  color: var(--media-text-title);
  margin: 0;
}
.mp-sub {
  font-size: 11px;
  color: var(--media-text-dim);
  margin: 2px 0 0;
}
.mp-body {
  padding: 20px;
}
</style>
