<!-- EmployeeTools.vue — 工具权限区 -->
<template>
  <section class="employee-tools">
    <h2 class="section-title">
      <span class="section-icon">🔧</span>
      工具与权限
    </h2>

    <!-- 工具 -->
    <div v-if="tools.length > 0" class="tools-subsection">
      <div class="tools-label">工具</div>
      <div class="tools-list">
        <div v-for="tool in tools" :key="tool" class="tool-item">
          <span class="tool-check">✓</span>
          <span class="tool-text">{{ tool }}</span>
        </div>
      </div>
    </div>

    <!-- 权限 -->
    <div v-if="permissions.length > 0" class="tools-subsection">
      <div class="tools-label">权限</div>
      <div class="tools-list">
        <div v-for="perm in permissions" :key="perm" class="tool-item">
          <span class="tool-check perm-check">🔒</span>
          <span class="tool-text">{{ perm }}</span>
        </div>
      </div>
    </div>

    <!-- 空状态 -->
    <div v-if="tools.length === 0 && permissions.length === 0" class="tools-empty">
      <span class="empty-icon">🔧</span>
      <span class="empty-text">暂无工具与权限配置</span>
    </div>
  </section>
</template>

<script setup lang="ts">
defineProps<{
  tools: string[]
  permissions: string[]
}>()
</script>

<style scoped>
.employee-tools {
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

.tools-subsection {
  margin-bottom: 14px;
}

.tools-subsection:last-child {
  margin-bottom: 0;
}

.tools-label {
  font-size: 10px;
  color: #5A6A8A;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 8px;
  font-weight: 600;
}

.tools-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.tool-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: rgba(16, 185, 129, 0.05);
  border: 1px solid rgba(16, 185, 129, 0.15);
  border-radius: 8px;
}

.tool-check {
  font-size: 10px;
  color: #22C55E;
  font-weight: 700;
}

.perm-check {
  font-size: 11px;
}

.tool-text {
  font-size: 12px;
  color: #D1D5DB;
  font-weight: 500;
}

.tools-empty {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #5A6A8A;
  font-size: 12px;
}

.empty-icon { font-size: 16px; }
</style>
