<template>
  <section class="brand-overview__section">
    <h2 class="brand-overview__section-title">快速操作</h2>
    <div class="brand-overview__quick-actions">
      <button class="brand-overview__action-card" @click="onEditBrand">
        <span class="brand-overview__action-icon brand-overview__action-icon--brand">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </span>
        <span class="brand-overview__action-text">
          <strong>完善品牌资料</strong>
          <small>更新品牌信息与配置</small>
        </span>
      </button>
      <button class="brand-overview__action-card" @click="onQuickDiscovery" :disabled="isQdRunning">
        <span class="brand-overview__action-icon brand-overview__action-icon--geo">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" />
            <path d="M12 6v6l4 2" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          </svg>
        </span>
        <span class="brand-overview__action-text">
          <strong>{{ isQdRunning ? '分析中...' : '立即分析（30 秒）' }}</strong>
          <small>{{ isQdRunning ? '正在扫描品牌可见度' : '一键出分，了解品牌 AI 可见度' }}</small>
        </span>
      </button>
      <button class="brand-overview__action-card" @click="onAddKnowledge">
        <span class="brand-overview__action-icon brand-overview__action-icon--knowledge">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M4 19.5A2.5 2.5 0 016.5 17H20" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" stroke="currentColor" stroke-width="2" />
            <path d="M8 7h8M8 11h6" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          </svg>
        </span>
        <span class="brand-overview__action-text">
          <strong>添加知识源</strong>
          <small>导入品牌资料与文档</small>
        </span>
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
defineProps<{
  isQdRunning: boolean
  onEditBrand: () => void
  onQuickDiscovery: () => void
  onAddKnowledge: () => void
}>()
</script>

<style scoped>
.brand-overview__quick-actions {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
}

.brand-overview__action-card {
  display: flex;
  align-items: center;
  gap: 12px;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 16px;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: left;
  font-family: inherit;
  width: 100%;
}

.brand-overview__action-card:hover:not(:disabled) {
  border-color: #3b82f6;
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.1);
  transform: translateY(-1px);
}

.brand-overview__action-card:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.brand-overview__action-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  flex-shrink: 0;
}

.brand-overview__action-icon--brand {
  background: #eff6ff;
  color: #3b82f6;
}

.brand-overview__action-icon--geo {
  background: #fef3c7;
  color: #f59e0b;
}

.brand-overview__action-icon--knowledge {
  background: #f3e8ff;
  color: #8b5cf6;
}

.brand-overview__action-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.brand-overview__action-text strong {
  font-size: 14px;
  font-weight: 600;
  color: #1a1a2e;
}

.brand-overview__action-text small {
  font-size: 12px;
  color: #64748b;
}
</style>
