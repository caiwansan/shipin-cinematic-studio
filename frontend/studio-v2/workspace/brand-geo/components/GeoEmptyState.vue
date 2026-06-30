<template>
  <div class="geo-empty-state">
    <div class="geo-empty-state-icon">{{ icon }}</div>
    <div class="geo-empty-state-title">{{ title }}</div>
    <div v-if="description" class="geo-empty-state-desc">{{ description }}</div>
    <div v-if="$slots.actions" class="geo-empty-state-actions">
      <slot name="actions" />
    </div>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  icon?: string
  title: string
  description?: string
}>(), {
  icon: '📭'
})
</script>

<style scoped>
.geo-empty-state-actions {
  margin-top: 16px;
  display: flex;
  gap: 8px;
}
</style>
