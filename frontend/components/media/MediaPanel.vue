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
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border-primary);
  border-radius: 14px;
  overflow: hidden;
}
.mp-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--color-border-primary);
  background: linear-gradient(180deg, rgba(139, 92, 246, 0.04), transparent);
}
.mp-head-left {
  display: flex;
  align-items: center;
  gap: 12px;
}
.mp-icon {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  background: var(--color-bg-hover);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
}
.mp-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--color-text-primary);
  margin: 0;
}
.mp-sub {
  font-size: 11px;
  color: var(--color-text-muted);
  margin: 2px 0 0;
}
.mp-body {
  padding: 20px;
}
</style>
