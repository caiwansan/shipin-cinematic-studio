<!-- @deprecated — GEO v3 Legacy. Use design-system product blocks instead. -->
<template>
  <div class="geo-loading-state">
    <div class="geo-loading-spinner" :class="{ 'geo-loading-spinner--sm': small }"></div>
    <span v-if="text" class="geo-loading-text">{{ text }}</span>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  text?: string
  small?: boolean
}>(), {
  text: '加载中...',
  small: false
})
</script>

<style scoped>
.geo-loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--geo-space-xl);
  gap: var(--geo-space-md);
}
</style>
