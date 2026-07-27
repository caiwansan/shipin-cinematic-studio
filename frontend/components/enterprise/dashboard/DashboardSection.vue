<template>
  <div class="dashboard-section" v-if="visible">
    <div v-if="title" class="dashboard-section__header">
      <h2 class="dashboard-section__title">{{ title }}</h2>
      <p v-if="description" class="dashboard-section__description">{{ description }}</p>
    </div>
    <div class="dashboard-section__body">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  title?: string
  description?: string
  visible?: boolean
}

withDefaults(defineProps<Props>(), {
  visible: true,
})
</script>

<style scoped>
.dashboard-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-md, 16px);
}

.dashboard-section__header {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.dashboard-section__title {
  font-size: var(--font-size-lg, 18px);
  font-weight: 600;
  color: var(--color-text-primary, #e8e8e8);
  margin: 0;
}

.dashboard-section__description {
  font-size: var(--font-size-sm, 14px);
  color: var(--color-text-muted, #8899aa);
  margin: 0;
}

.dashboard-section__body {
  flex: 1;
}
</style>
