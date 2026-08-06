<template>
  <div class="mpage">
    <div class="mpage-head">
      <span class="mpage-back" @click="$emit('close')">‹</span>
      <span class="mpage-title">{{ title }}</span>
      <span class="mpage-right"><slot name="right" /></span>
    </div>
    <div class="mpage-body">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ title: string }>()
defineEmits<{ (e: 'close'): void }>()
</script>

<style scoped>
.mpage {
  position: absolute;
  inset: 0;
  z-index: 60;
  background: #f5f6f7;
  display: flex;
  flex-direction: column;
  height: 100%;
}
.mpage-head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  background: #fff;
  border-bottom: 1px solid #ececec;
  flex-shrink: 0;
}
.mpage-back { font-size: 24px; color: #576b95; cursor: pointer; padding-right: 4px; line-height: 1; }
.mpage-title { flex: 1; font-size: 16px; font-weight: 600; text-align: center; }
.mpage-right { min-width: 28px; }
.mpage-body { flex: 1; overflow-y: auto; padding: 12px; }
</style>
