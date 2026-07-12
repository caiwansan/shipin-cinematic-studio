<template>
  <div class="dt-task">
    <div v-if="brand" class="dt-task__card">
      <div class="dt-task__brand-name">{{ brand }}</div>
      <div class="dt-task__status" :class="'dt-task__status--' + statusClass">
        {{ statusLabel }}
      </div>
      <p class="dt-task__summary">{{ summary }}</p>
      <p class="dt-task__issues" v-if="issueCount !== undefined && issueCount > 0">
        发现 <strong>{{ issueCount }}</strong> 个待处理问题
      </p>
      <NuxtLink
        v-if="nextUrl"
        :to="nextUrl"
        class="dt-task__cta"
      >
        {{ ctaLabel }}
      </NuxtLink>
    </div>
    <div v-else class="dt-task__empty">
      <h2 class="dt-task__empty-title">暂无品牌数据</h2>
      <p class="dt-task__empty-desc">请先在 Dashboard 创建一个品牌</p>
      <NuxtLink to="/workspace/geo/dashboard" class="dt-task__cta dt-task__cta--secondary">
        返回工作台
      </NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  brand?: string
  statusLabel?: string
  statusClass?: string
  summary?: string
  issueCount?: number
  nextUrl?: string
  ctaLabel?: string
}>()
</script>

<style scoped>
.dt-task__card {
  border-radius: 16px;
  background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);
  padding: 40px 36px;
  color: #fff;
}
.dt-task__brand-name {
  font-size: 28px;
  font-weight: 700;
  margin-bottom: 12px;
}
.dt-task__status {
  display: inline-block;
  padding: 4px 14px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 16px;
}
.dt-task__status--ready { background: rgba(255,255,255,0.2); }
.dt-task__status--pending { background: rgba(245,158,11,0.3); }
.dt-task__status--done { background: rgba(34,197,94,0.3); }
.dt-task__summary {
  font-size: 16px;
  opacity: 0.9;
  margin: 0 0 8px;
  line-height: 1.5;
}
.dt-task__issues {
  font-size: 14px;
  opacity: 0.75;
  margin: 0 0 24px;
}
.dt-task__cta {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 12px 32px;
  background: #fff;
  color: #1e40af;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 700;
  text-decoration: none;
  transition: all 0.15s;
}
.dt-task__cta:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(0,0,0,0.2);
}
.dt-task__cta--secondary {
  background: #3b82f6;
  color: #fff;
}
.dt-task__empty {
  text-align: center;
  padding: 60px 24px;
}
.dt-task__empty-title {
  font-size: 20px;
  font-weight: 700;
  color: #111827;
  margin: 0 0 8px;
}
.dt-task__empty-desc {
  font-size: 15px;
  color: #6b7280;
  margin: 0 0 24px;
}
</style>
