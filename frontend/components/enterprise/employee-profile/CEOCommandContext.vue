<!-- CEOCommandContext.vue — CEO 指令上下文 -->
<template>
  <section class="ceo-command">
    <h2 class="section-title">
      <span class="section-icon">📝</span>
      CEO 指令
    </h2>

    <div v-if="managerNote" class="command-content">
      <div class="command-label">管理备注</div>
      <div class="command-text">{{ managerNote }}</div>
      <div v-if="lastUpdated" class="command-updated">
        更新于 {{ formatDate(lastUpdated) }}
      </div>
    </div>

    <div v-else class="command-empty">
      <span class="empty-icon">📋</span>
      <span class="empty-text">暂无 CEO 指令</span>
      <span class="empty-hint">在 AI 员工配置中添加管理备注</span>
    </div>
  </section>
</template>

<script setup lang="ts">
defineProps<{
  managerNote: string | null
  lastUpdated: string | null
}>()

function formatDate(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getMonth() + 1}月${d.getDate()}日 ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
}
</script>

<style scoped>
.ceo-command {
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

/* Content */
.command-content {
  background: rgba(245, 158, 11, 0.05);
  border: 1px solid rgba(245, 158, 11, 0.15);
  border-radius: 10px;
  padding: 14px;
}

.command-label {
  font-size: 10px;
  color: #F59E0B;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 8px;
  font-weight: 600;
}

.command-text {
  font-size: 13px;
  color: #D1D5DB;
  line-height: 1.6;
  white-space: pre-wrap;
}

.command-updated {
  margin-top: 10px;
  font-size: 10px;
  color: #3A4A6A;
}

/* Empty */
.command-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 24px 0;
  text-align: center;
}

.empty-icon { font-size: 20px; }

.empty-text {
  font-size: 12px;
  color: #5A6A8A;
}

.empty-hint {
  font-size: 10px;
  color: #3A4A6A;
}
</style>
