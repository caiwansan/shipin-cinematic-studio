<!-- EmployeeRole.vue — 职责区 -->
<!-- 角色 + 目标 + 今日工作 -->
<template>
  <section class="employee-role">
    <h2 class="section-title">
      <span class="section-icon">📋</span>
      职责
    </h2>

    <div class="role-grid">
      <!-- 负责 -->
      <div class="role-card">
        <div class="role-card-label">负责</div>
        <div class="role-card-value">{{ displayRole }}</div>
      </div>
      <!-- 目标 -->
      <div class="role-card">
        <div class="role-card-label">目标</div>
        <div class="role-card-value">{{ goal || '执行企业增长任务' }}</div>
      </div>
    </div>

    <!-- 今日工作 -->
    <div v-if="todayTasks.length > 0" class="today-section">
      <div class="today-header">
        <span class="today-title">今日工作</span>
        <span class="today-progress">{{ todayCompleted }}/{{ todayTarget || '?' }} 项任务</span>
      </div>
      <div class="today-list">
        <div v-for="(task, idx) in todayTasks.slice(0, 5)" :key="idx" class="today-item">
          <span class="today-dot" :class="task.status === '已完成' ? 'done' : 'pending'" />
          <span class="today-action">{{ task.action }}</span>
          <span class="today-time">{{ formatTime(task.time) }}</span>
        </div>
      </div>
    </div>

    <!-- 今日空状态 -->
    <div v-else class="today-empty">
      <span class="today-empty-icon">📋</span>
      <span class="today-empty-text">今日暂无任务记录</span>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface TodayTaskItem {
  action: string
  resource: string
  time: string
  status: string
}

const props = defineProps<{
  role: string
  goal: string | null
  todayTarget: number
  todayCompleted: number
  todayTasks: TodayTaskItem[]
}>()

const displayRole = computed(() => {
  const map: Record<string, string> = {
    growth_director: '企业业务增长',
    market_analyst: '市场研究与分析',
    content_manager: '内容运营与创作',
    customer_ops: '客户运营与互动',
    sales_assistant: '销售支持与参谋',
    sales: '销售与客户开发',
    marketing: '营销与推广',
    support: '客户支持与服务',
    analyst: '数据分析与洞察',
    content: '内容创作与运营',
    customer_success: '客户成功与留存',
  }
  return map[props.role] || '企业增长相关任务'
})

function formatTime(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}
</script>

<style scoped>
.employee-role {
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

.section-icon {
  font-size: 16px;
}

/* Role Grid */
.role-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 16px;
}

.role-card {
  background: #060A18;
  border: 1px solid #1A2240;
  border-radius: 10px;
  padding: 12px;
}

.role-card-label {
  font-size: 10px;
  color: #5A6A8A;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 4px;
}

.role-card-value {
  font-size: 13px;
  color: #D1D5DB;
  font-weight: 500;
  line-height: 1.4;
}

/* Today Section */
.today-section {
  border-top: 1px solid #1A2240;
  padding-top: 14px;
}

.today-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.today-title {
  font-size: 12px;
  color: #8899B8;
  font-weight: 600;
}

.today-progress {
  font-size: 11px;
  color: #3B82F6;
}

.today-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.today-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}

.today-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  flex-shrink: 0;
}

.today-dot.done { background: #22C55E; }
.today-dot.pending { background: #F59E0B; }

.today-action {
  flex: 1;
  color: #B0B8D0;
}

.today-time {
  font-size: 10px;
  color: #3A4A6A;
}

/* Empty */
.today-empty {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 0;
  color: #5A6A8A;
  font-size: 12px;
  border-top: 1px solid #1A2240;
  padding-top: 14px;
}

.today-empty-icon {
  font-size: 16px;
}

@media (max-width: 640px) {
  .role-grid {
    grid-template-columns: 1fr;
  }
}
</style>
