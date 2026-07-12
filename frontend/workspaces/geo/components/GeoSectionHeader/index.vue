<template>
  <div class="geo-section-header" :class="className">
    <div class="geo-section-header__left">
      <h3 class="geo-section-header__title">{{ title }}</h3>
      <span v-if="badge" class="geo-section-header__badge">{{ badge }}</span>
      <span v-if="subtitle" class="geo-section-header__subtitle">{{ subtitle }}</span>
    </div>
    <div class="geo-section-header__right">
      <slot name="actions" />
    </div>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  title: string
  subtitle?: string
  badge?: string
  className?: string
}>(), {
  subtitle: '',
  badge: '',
  className: '',
})
</script>

<style scoped>
.geo-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;
}
.geo-section-header__left {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.geo-section-header__title {
  font-size: 18px;
  font-weight: 600;
  color: #111827;
  margin: 0;
}
.geo-section-header__badge {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 10px;
  background: #e0e7ff;
  color: #4338ca;
  font-weight: 500;
}
.geo-section-header__subtitle {
  font-size: 13px;
  color: #9ca3af;
}
.geo-section-header__right {
  display: flex;
  gap: 8px;
}
</style>
