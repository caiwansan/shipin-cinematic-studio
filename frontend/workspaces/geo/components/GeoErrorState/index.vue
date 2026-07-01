<template>
  <div class="geo-error">
    <p class="geo-error__message">{{ message }}</p>
    <button
      v-if="onRetry"
      class="geo-btn geo-btn--secondary"
      @click="onRetry"
    >
      重试
    </button>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  message?: string
  onRetry?: (() => void) | null
}>()
</script>
