<template>
  <div class="geo-error-state">
    <div class="geo-error-state-icon">{{ icon }}</div>
    <div class="geo-error-state-title">{{ title }}</div>
    <div v-if="description" class="geo-error-state-desc">{{ description }}</div>
    <div v-if="retryable" class="geo-error-state-actions">
      <button class="geo-btn geo-btn-primary" @click="$emit('retry')">重试</button>
    </div>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  icon?: string
  title?: string
  description?: string
  retryable?: boolean
}>(), {
  icon: '⚠️',
  title: '出错了',
  description: '发生了一个错误，请稍后重试',
  retryable: false
})

defineEmits<{
  retry: []
}>()
</script>

<style scoped>
.geo-error-state-actions {
  margin-top: 16px;
}
</style>
