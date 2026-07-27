<!-- EmployeeCapability.vue — 技能区 -->
<template>
  <section class="employee-capability">
    <h2 class="section-title">
      <span class="section-icon">🎯</span>
      技能
    </h2>

    <div v-if="capabilities.length > 0" class="capability-list">
      <span v-for="cap in capabilities" :key="cap" class="capability-tag">
        {{ cap }}
      </span>
    </div>

    <div v-else class="capability-empty">
      <span class="empty-icon">🎯</span>
      <span class="empty-text">暂无技能配置</span>
    </div>
  </section>
</template>

<script setup lang="ts">
defineProps<{
  capabilities: string[]
}>()
</script>

<style scoped>
.employee-capability {
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

.capability-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.capability-tag {
  font-size: 12px;
  padding: 6px 14px;
  background: rgba(59, 130, 246, 0.08);
  border: 1px solid rgba(59, 130, 246, 0.2);
  border-radius: 20px;
  color: #60A5FA;
  font-weight: 500;
}

.capability-empty {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #5A6A8A;
  font-size: 12px;
}

.empty-icon { font-size: 16px; }
</style>
