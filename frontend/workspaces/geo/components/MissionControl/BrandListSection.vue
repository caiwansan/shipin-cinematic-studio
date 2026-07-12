<!-- @deprecated 未被任何页面引用，MissionControl 重构中废弃 -->
<template>
  <div class="mc-brands">
    <div v-if="projects.length === 0" class="mc-brands__empty">暂无品牌数据</div>
    <div
      v-for="project in projects"
      :key="project.id"
      class="mc-brands__row"
    >
      <span class="mc-brands__name">{{ project.name }}</span>
      <span class="mc-brands__adi">ADI {{ project.adi > 0 ? project.adi : '—' }}</span>
      <span class="mc-brands__step">{{ project.currentStep }}</span>
      <NuxtLink
        v-if="project.continueUrl"
        :to="project.continueUrl"
        class="mc-brands__action"
      >
        查看
      </NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  projects: Array<{
    id: string
    name: string
    adi: number
    currentStep: string
    continueUrl?: string
  }>
}>()
</script>

<style scoped>
.mc-brands {
  display: flex;
  flex-direction: column;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  overflow: hidden;
}
.mc-brands__empty {
  padding: 16px;
  color: #9ca3af;
  font-size: 13px;
  text-align: center;
}
.mc-brands__row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid #f3f4f6;
  transition: background 0.1s;
}
.mc-brands__row:last-child {
  border-bottom: none;
}
.mc-brands__row:hover {
  background: #f9fafb;
}
.mc-brands__name {
  flex: 1;
  font-size: 14px;
  font-weight: 600;
  color: #111827;
}
.mc-brands__adi {
  width: 60px;
  font-size: 13px;
  color: #6b7280;
  text-align: center;
}
.mc-brands__step {
  width: 100px;
  font-size: 13px;
  color: #6b7280;
}
.mc-brands__action {
  padding: 6px 16px;
  font-size: 13px;
  font-weight: 500;
  color: #3b82f6;
  text-decoration: none;
  border-radius: 6px;
  transition: background 0.1s;
}
.mc-brands__action:hover {
  background: #eff6ff;
}
</style>
