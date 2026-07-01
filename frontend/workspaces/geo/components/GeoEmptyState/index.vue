<template>
  <div class="geo-empty">
    <div class="geo-empty__icon">{{ icon }}</div>
    <h3 class="geo-empty__title">{{ title }}</h3>
    <p class="geo-empty__desc">{{ description }}</p>
    <div class="geo-empty__actions">
      <slot name="actions" />
    </div>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  icon?: string
  title?: string
  description?: string
}>(), {
  icon: '📭',
  title: '暂无数据',
  description: '',
})
</script>
