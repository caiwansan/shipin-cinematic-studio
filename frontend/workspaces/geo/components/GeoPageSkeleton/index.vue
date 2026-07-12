<template>
  <div class="geo-page-skeleton" :class="className">
    <!-- Header skeleton -->
    <div class="geo-page-skeleton__header">
      <div class="geo-page-skeleton__title-block">
        <div class="geo-page-skeleton__title-line skeleton-pulse" />
        <div class="geo-page-skeleton__subtitle-line skeleton-pulse" />
      </div>
    </div>

    <!-- Card skeletons -->
    <div class="geo-page-skeleton__grid" :class="[`geo-page-skeleton__grid--${layout}`]">
      <div
        v-for="i in cardCount"
        :key="i"
        class="geo-page-skeleton__card skeleton-pulse"
      >
        <div class="geo-page-skeleton__card-header skeleton-pulse" />
        <div class="geo-page-skeleton__card-body">
          <div class="geo-page-skeleton__card-line skeleton-pulse" />
          <div class="geo-page-skeleton__card-line skeleton-pulse" style="width: 60%" />
          <div class="geo-page-skeleton__card-line skeleton-pulse" style="width: 80%" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  cardCount?: number
  layout?: 'grid' | 'list' | 'dashboard'
  className?: string
}>(), {
  cardCount: 4,
  layout: 'grid',
  className: '',
})
</script>

<style scoped>
.skeleton-pulse {
  background: linear-gradient(90deg, #e5e7eb 25%, #f3f4f6 50%, #e5e7eb 75%);
  background-size: 200% 100%;
  animation: skeleton-pulse 1.5s ease-in-out infinite;
  border-radius: 6px;
}

@keyframes skeleton-pulse {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.geo-page-skeleton__header {
  padding: 24px 0 16px;
}
.geo-page-skeleton__title-block {
  max-width: 400px;
}
.geo-page-skeleton__title-line {
  height: 28px;
  width: 240px;
  margin-bottom: 10px;
}
.geo-page-skeleton__subtitle-line {
  height: 14px;
  width: 320px;
}

.geo-page-skeleton__grid {
  display: grid;
  gap: 20px;
  margin-top: 8px;
}
.geo-page-skeleton__grid--grid {
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
}
.geo-page-skeleton__grid--list {
  grid-template-columns: 1fr;
}
.geo-page-skeleton__grid--dashboard {
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
}

.geo-page-skeleton__card {
  padding: 24px;
  border-radius: 12px;
  background: #fff;
  border: 1px solid #e5e7eb;
}
.geo-page-skeleton__card-header {
  height: 20px;
  width: 120px;
  margin-bottom: 20px;
}
.geo-page-skeleton__card-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.geo-page-skeleton__card-line {
  height: 14px;
  width: 100%;
}
</style>
