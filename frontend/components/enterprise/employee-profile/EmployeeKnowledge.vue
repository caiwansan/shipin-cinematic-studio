<!-- EmployeeKnowledge.vue — 知识库区 -->
<template>
  <section class="employee-knowledge">
    <h2 class="section-title">
      <span class="section-icon">📚</span>
      知识库
    </h2>

    <div v-if="knowledge.length > 0" class="knowledge-list">
      <div v-for="item in knowledge" :key="item" class="knowledge-item">
        <span class="knowledge-icon">📖</span>
        <span class="knowledge-text">{{ item }}</span>
      </div>
    </div>

    <div v-else class="knowledge-empty">
      <span class="empty-icon">📚</span>
      <span class="empty-text">暂无知识库配置</span>
    </div>
  </section>
</template>

<script setup lang="ts">
defineProps<{
  knowledge: string[]
}>()
</script>

<style scoped>
.employee-knowledge {
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

.knowledge-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.knowledge-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: rgba(139, 92, 246, 0.05);
  border: 1px solid rgba(139, 92, 246, 0.15);
  border-radius: 10px;
}

.knowledge-icon {
  font-size: 14px;
  flex-shrink: 0;
}

.knowledge-text {
  font-size: 13px;
  color: #D1D5DB;
  font-weight: 500;
}

.knowledge-empty {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #5A6A8A;
  font-size: 12px;
}

.empty-icon { font-size: 16px; }
</style>
