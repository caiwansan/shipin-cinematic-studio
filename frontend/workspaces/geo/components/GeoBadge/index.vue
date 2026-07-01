<template>
  <span class="geo-badge" :class="`geo-badge--${variant}`">
    <slot />
  </span>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  variant?: 'success' | 'warning' | 'error' | 'info' | 'neutral'
}>(), {
  variant: 'neutral',
})
</script>
