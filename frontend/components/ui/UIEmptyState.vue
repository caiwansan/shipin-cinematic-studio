<template>
  <div class="ui-empty-state">
    <div class="ui-empty-state__icon">{{ icon }}</div>
    <h3 class="ui-empty-state__title">{{ title }}</h3>
    <p class="ui-empty-state__desc">{{ description }}</p>
    <NuxtLink
      v-if="actionTo"
      :to="actionTo"
      class="ui-empty-state__action"
    >
      {{ actionLabel }}
    </NuxtLink>
    <button
      v-else-if="actionLabel"
      class="ui-empty-state__action"
      @click="$emit('action')"
    >
      {{ actionLabel }}
    </button>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  icon: string
  title: string
  description: string
  actionLabel?: string
  actionTo?: string
}>()

defineEmits<{
  (e: 'action'): void
}>()
</script>

<style scoped>
.ui-empty-state {
  text-align: center;
  padding: 48px 24px;
  background: #fff;
  border-radius: 12px;
}
.ui-empty-state__icon { font-size: 40px; margin-bottom: 12px; }
.ui-empty-state__title {
  font-size: 18px;
  font-weight: 600;
  color: #1a1a2e;
  margin-bottom: 6px;
}
.ui-empty-state__desc {
  font-size: 14px;
  color: #64748b;
  margin-bottom: 20px;
  max-width: 400px;
  margin-left: auto;
  margin-right: auto;
}
.ui-empty-state__action {
  display: inline-block;
  padding: 10px 24px;
  background: #667eea;
  color: #fff;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  text-decoration: none;
  border: none;
  cursor: pointer;
  transition: background 0.15s;
}
.ui-empty-state__action:hover { background: #5a6fd6; }
</style>
