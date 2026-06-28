<template>
  <div
    class="geo-project-card"
    :class="{ 'geo-project-card--active': isActive }"
    @click="$emit('click')"
  >
    <div class="geo-project-card__header">
      <h3 class="geo-project-card__title">{{ project.name }}</h3>
      <span class="geo-project-card__status" :class="`geo-project-card__status--${project.status}`">
        {{ statusLabel }}
      </span>
    </div>
    <div v-if="project.topic" class="geo-project-card__topic">
      <span class="geo-project-card__label">主题：</span>{{ project.topic }}
    </div>
    <div class="geo-project-card__meta">
      <span class="geo-project-card__meta-item">
        🧩 {{ project.entityCount ?? 0 }} 实体
      </span>
      <span class="geo-project-card__meta-item">
        🔗 {{ project.relationCount ?? 0 }} 关系
      </span>
      <span class="geo-project-card__meta-item">
        📅 {{ formatDate(project.createdAt) }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { GEOProject } from '../types/index'

const props = defineProps<{
  project: GEOProject
  isActive?: boolean
}>()

defineEmits<{
  click: []
}>()

const statusLabel = computed(() => {
  const labels: Record<string, string> = {
    draft: '草稿',
    active: '进行中',
    archived: '已归档',
  }
  return labels[props.project.status] || props.project.status
})

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
})

import { computed } from 'vue'
</script>

<style scoped>
.geo-project-card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 16px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.geo-project-card:hover {
  border-color: #6366f1;
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.1);
  transform: translateY(-2px);
}

.geo-project-card--active {
  border-color: #6366f1;
  background: #f5f3ff;
}

.geo-project-card__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.geo-project-card__title {
  font-size: 16px;
  font-weight: 600;
  color: #1f2937;
  margin: 0;
}

.geo-project-card__status {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 12px;
}

.geo-project-card__status--draft {
  background: #fef3c7;
  color: #92400e;
}
.geo-project-card__status--active {
  background: #dbeafe;
  color: #1e40af;
}
.geo-project-card__status--archived {
  background: #f3f4f6;
  color: #6b7280;
}

.geo-project-card__topic {
  font-size: 13px;
  color: #6b7280;
  margin-bottom: 10px;
}

.geo-project-card__label {
  color: #9ca3af;
}

.geo-project-card__meta {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: #9ca3af;
}

.geo-project-card__meta-item {
  display: flex;
  align-items: center;
  gap: 4px;
}
</style>
