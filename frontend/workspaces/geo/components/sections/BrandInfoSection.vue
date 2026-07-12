<template>
  <section class="brand-overview__section">
    <h2 class="brand-overview__section-title">品牌信息</h2>
    <div class="brand-overview__info-card">
      <div class="brand-overview__info-row">
        <span class="brand-overview__info-label">名称</span>
        <span class="brand-overview__info-value">{{ project.name }}</span>
      </div>
      <div class="brand-overview__info-row">
        <span class="brand-overview__info-label">官网</span>
        <span class="brand-overview__info-value">
          <a
            v-if="website"
            :href="website"
            target="_blank"
            rel="noopener noreferrer"
            class="brand-overview__info-link"
          >
            {{ website }}
          </a>
          <span v-else class="brand-overview__info-empty">未设置</span>
        </span>
      </div>
      <div class="brand-overview__info-row">
        <span class="brand-overview__info-label">行业</span>
        <span class="brand-overview__info-value">{{ project.industry || '未设置' }}</span>
      </div>
      <div class="brand-overview__info-row">
        <span class="brand-overview__info-label">品牌描述</span>
        <span class="brand-overview__info-value">{{ description || '暂无描述' }}</span>
      </div>
      <div class="brand-overview__info-row">
        <span class="brand-overview__info-label">创建时间</span>
        <span class="brand-overview__info-value">{{ formatDate(project.createdAt) }}</span>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
defineProps<{
  project: any
  website: string
  description: string
}>()

function formatDate(dateStr: string): string {
  if (!dateStr) return '未知'
  // eslint-disable-next-line prefer-const
  let d = new Date(dateStr)
  if (isNaN(d.getTime())) return '未知'
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
</script>

<style scoped>
.brand-overview__info-card {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 20px;
}

.brand-overview__info-row {
  display: flex;
  align-items: flex-start;
  padding: 8px 0;
  border-bottom: 1px solid #f1f5f9;
}

.brand-overview__info-row:last-child {
  border-bottom: none;
}

.brand-overview__info-label {
  min-width: 80px;
  font-size: 13px;
  font-weight: 500;
  color: #64748b;
}

.brand-overview__info-value {
  font-size: 13px;
  color: #1a1a2e;
  word-break: break-all;
}

.brand-overview__info-link {
  color: #3b82f6;
  text-decoration: none;
}

.brand-overview__info-link:hover {
  text-decoration: underline;
}

.brand-overview__info-empty {
  color: #94a3b8;
  font-style: italic;
}
</style>
