<template>
  <div class="geo-skeleton" :class="[`geo-skeleton--${type}`, { 'geo-skeleton--animated': animated }]">
    <!-- Card skeleton -->
    <template v-if="type === 'card'">
      <div v-for="i in count" :key="i" class="geo-skeleton-card">
        <div class="geo-skeleton-line geo-skeleton-line--icon"></div>
        <div class="geo-skeleton-card-body">
          <div class="geo-skeleton-line geo-skeleton-line--title"></div>
          <div class="geo-skeleton-line geo-skeleton-line--subtitle"></div>
        </div>
      </div>
    </template>

    <!-- Table skeleton -->
    <template v-else-if="type === 'table'">
      <div class="geo-skeleton-table">
        <div class="geo-skeleton-table-header">
          <div v-for="i in 5" :key="`h${i}`" class="geo-skeleton-line" :style="{ width: `${20 + i * 10}px` }"></div>
        </div>
        <div v-for="r in count" :key="`r${r}`" class="geo-skeleton-table-row">
          <div v-for="i in 5" :key="`c${i}`" class="geo-skeleton-line" :style="{ width: `${30 + (i % 3) * 15}%` }"></div>
        </div>
      </div>
    </template>

    <!-- List skeleton -->
    <template v-else-if="type === 'list'">
      <div v-for="i in count" :key="i" class="geo-skeleton-list-item">
        <div class="geo-skeleton-line geo-skeleton-line--icon"></div>
        <div class="geo-skeleton-list-body">
          <div class="geo-skeleton-line" style="width: 60%"></div>
          <div class="geo-skeleton-line" style="width: 40%"></div>
        </div>
      </div>
    </template>

    <!-- Text skeleton (default) -->
    <template v-else>
      <div v-for="i in count" :key="i" class="geo-skeleton-line" :class="`geo-skeleton-line--${i}`" :style="getTextStyle(i)"></div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  type?: 'text' | 'card' | 'table' | 'list'
  count?: number
  animated?: boolean
}>(), {
  type: 'text',
  count: 3,
  animated: true,
})

function getTextStyle(index: number) {
  const widths = ['100%', '85%', '70%', '90%', '60%']
  return { width: widths[(index - 1) % widths.length] }
}
</script>

<style scoped>
.geo-skeleton { display: flex; flex-direction: column; gap: 12px; }
.geo-skeleton--animated .geo-skeleton-line,
.geo-skeleton--animated .geo-skeleton-card,
.geo-skeleton--animated .geo-skeleton-table-row {
  animation: geo-skeleton-pulse 1.5s ease-in-out infinite;
}

@keyframes geo-skeleton-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.geo-skeleton-line {
  height: 14px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.06);
}
.geo-skeleton-line--icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  flex-shrink: 0;
}
.geo-skeleton-line--title {
  width: 60%;
  height: 18px;
  margin-bottom: 8px;
}
.geo-skeleton-line--subtitle {
  width: 40%;
  height: 12px;
}

/* Card */
.geo-skeleton-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 18px;
  background: rgba(255, 255, 255, 0.02);
  border-radius: 10px;
}
.geo-skeleton-card-body {
  flex: 1;
}

/* Table */
.geo-skeleton-table {
  display: flex;
  flex-direction: column;
  gap: 0;
  background: rgba(255, 255, 255, 0.02);
  border-radius: 10px;
  overflow: hidden;
}
.geo-skeleton-table-header {
  display: flex;
  gap: 16px;
  padding: 14px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}
.geo-skeleton-table-row {
  display: flex;
  gap: 16px;
  padding: 14px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.02);
}
.geo-skeleton-table-row:last-child { border-bottom: none; }

/* List */
.geo-skeleton-list-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.02);
  border-radius: 8px;
}
.geo-skeleton-list-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
</style>
