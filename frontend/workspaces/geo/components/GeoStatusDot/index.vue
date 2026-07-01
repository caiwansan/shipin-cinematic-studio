<template>
  <span
    class="geo-status-dot"
    :class="`geo-status-dot--${status}`"
  />
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  status?: 'success' | 'warning' | 'error' | 'checking' | 'unknown'
}>(), {
  status: 'unknown',
})
</script>
