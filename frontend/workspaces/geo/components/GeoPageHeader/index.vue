<template>
  <header class="geo-page-header" :class="className">
    <div class="geo-page-header__main">
      <div class="geo-page-header__title-row">
        <h1 class="geo-page-header__title">{{ title }}</h1>
        <div class="geo-page-header__badges">
          <slot name="badges" />
        </div>
      </div>
      <p v-if="subtitle" class="geo-page-header__subtitle">{{ subtitle }}</p>
    </div>
    <div class="geo-page-header__actions">
      <slot name="actions" />
    </div>
    <slot name="extra" />
  </header>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  title: string
  subtitle?: string
  className?: string
}>(), {
  subtitle: '',
  className: '',
})
</script>

<style scoped>
.geo-page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 16px;
  padding: 24px 0 16px;
}
.geo-page-header__main {
  flex: 1;
  min-width: 0;
}
.geo-page-header__title-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.geo-page-header__title {
  font-size: 24px;
  font-weight: 700;
  line-height: 1.3;
  color: #111827;
  margin: 0;
}
.geo-page-header__subtitle {
  font-size: 14px;
  color: #6b7280;
  margin: 6px 0 0;
  line-height: 1.5;
}
.geo-page-header__badges {
  display: flex;
  gap: 8px;
}
.geo-page-header__actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}
</style>
