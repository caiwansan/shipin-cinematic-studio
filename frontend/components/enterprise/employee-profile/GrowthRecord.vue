<!-- GrowthRecord.vue — Agent 成长时间线 -->
<template>
  <section class="growth-record">
    <h2 class="section-title">
      <span class="section-icon">🌱</span>
      成长记录
    </h2>

    <div v-if="items.length > 0" class="growth-timeline">
      <div v-for="(item, idx) in items" :key="idx" class="growth-item">
        <div class="growth-dot" :class="dotClass(item.event)" />
        <div v-if="idx < items.length - 1" class="growth-line" />
        <div class="growth-content">
          <div class="growth-event">{{ item.event }}</div>
          <div v-if="item.detail" class="growth-detail">{{ item.detail }}</div>
          <div class="growth-date">{{ formatDate(item.date) }}</div>
        </div>
      </div>
    </div>

    <div v-else class="growth-empty">
      <span class="empty-icon">🌱</span>
      <span class="empty-text">暂无成长记录</span>
    </div>
  </section>
</template>

<script setup lang="ts">
interface GrowthItem {
  date: string
  event: string
  detail: string
}

defineProps<{
  items: GrowthItem[]
}>()

function dotClass(event: string): string {
  if (event.includes('入职')) return 'dot-create'
  if (event.includes('部署')) return 'dot-deploy'
  if (event.includes('技能')) return 'dot-skill'
  return 'dot-update'
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getMonth() + 1}月${d.getDate()}日`
}
</script>

<style scoped>
.growth-record {
  background: #0D1328;
  border: 1px solid #1A2240;
  border-radius: 16px;
  padding: 20px;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: #e8e8e8;
  margin: 0 0 14px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.section-icon { font-size: 16px; }

/* Timeline */
.growth-timeline {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.growth-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding-bottom: 16px;
  position: relative;
}

.growth-item:last-child {
  padding-bottom: 0;
}

.growth-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
  margin-top: 6px;
  z-index: 1;
}

.dot-create { background: #22C55E; box-shadow: 0 0 6px #22C55E50; }
.dot-deploy { background: #3B82F6; box-shadow: 0 0 6px #3B82F650; }
.dot-skill { background: #8B5CF6; box-shadow: 0 0 6px #8B5CF650; }
.dot-update { background: #F59E0B; box-shadow: 0 0 6px #F59E0B50; }

.growth-line {
  position: absolute;
  left: 3px;
  top: 14px;
  bottom: 0;
  width: 2px;
  background: #1A2240;
}

.growth-content {
  flex: 1;
}

.growth-event {
  font-size: 13px;
  font-weight: 600;
  color: #D1D5DB;
  margin-bottom: 2px;
}

.growth-detail {
  font-size: 11px;
  color: #9CA3AF;
  margin-bottom: 4px;
}

.growth-date {
  font-size: 10px;
  color: #3A4A6A;
}

/* Empty */
.growth-empty {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 20px 0;
  color: #5A6A8A;
  font-size: 12px;
}

.empty-icon { font-size: 16px; }
</style>
