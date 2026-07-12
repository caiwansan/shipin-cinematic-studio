<template>
  <div class="geo-verified-items-table">
    <div class="geo-verified-items-table__header">
      <span class="geo-verified-items-table__col geo-verified-items-table__col--status">状态</span>
      <span class="geo-verified-items-table__col geo-verified-items-table__col--title">任务</span>
      <span class="geo-verified-items-table__col geo-verified-items-table__col--adi">ADI 贡献</span>
      <span class="geo-verified-items-table__col geo-verified-items-table__col--detail">详情</span>
    </div>
    <div
      v-for="item in items"
      :key="item.id"
      class="geo-verified-items-table__row"
    >
      <span class="geo-verified-items-table__col geo-verified-items-table__col--status">
        <span
          :class="[
            'geo-status-chip',
            item.status === 'completed' ? 'geo-status-chip--completed' : '',
            item.status === 'pending' ? 'geo-status-chip--pending' : '',
            item.status === 'skipped' ? 'geo-status-chip--skipped' : '',
          ]"
        >
          {{ statusLabel(item.status) }}
        </span>
      </span>
      <span class="geo-verified-items-table__col geo-verified-items-table__col--title">{{ item.title }}</span>
      <span class="geo-verified-items-table__col geo-verified-items-table__col--adi">
        <template v-if="item.adiContribution > 0">+{{ item.adiContribution }}</template>
        <template v-else>—</template>
      </span>
      <span class="geo-verified-items-table__col geo-verified-items-table__col--detail">{{ item.details }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { VerifiedItem } from './types'

defineProps<{
  items: VerifiedItem[]
}>()

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    completed: '✅ 已完成',
    pending: '⏳ 待完成',
    skipped: '⏭ 已忽略',
  }
  return map[status] || status
}
</script>

<style scoped>
.geo-verified-items-table {
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  overflow: hidden;
}

.geo-verified-items-table__header {
  display: flex;
  gap: 8px;
  padding: 10px 16px;
  background-color: #f9fafb;
  border-bottom: 1px solid #e5e7eb;
  font-size: 12px;
  font-weight: 600;
  color: #6b7280;
  text-transform: uppercase;
}

.geo-verified-items-table__row {
  display: flex;
  gap: 8px;
  padding: 10px 16px;
  border-bottom: 1px solid #f3f4f6;
  font-size: 13px;
  align-items: center;
}

.geo-verified-items-table__row:last-child {
  border-bottom: none;
}

.geo-verified-items-table__col--status {
  width: 80px;
  flex-shrink: 0;
}

.geo-verified-items-table__col--title {
  flex: 1;
  color: #111827;
  font-weight: 500;
}

.geo-verified-items-table__col--adi {
  width: 80px;
  text-align: center;
  color: #059669;
  font-weight: 600;
  flex-shrink: 0;
}

.geo-verified-items-table__col--detail {
  width: 200px;
  color: #6b7280;
  font-size: 12px;
  flex-shrink: 0;
}

@media (max-width: 768px) {
  .geo-verified-items-table__col--detail {
    display: none;
  }
}

.geo-status-chip {
  font-size: 12px;
  white-space: nowrap;
  padding: 2px 8px;
  border-radius: 4px;
}

.geo-status-chip--completed {
  background-color: #ecfdf5;
  color: #059669;
}

.geo-status-chip--pending {
  background-color: #fffbeb;
  color: #d97706;
}

.geo-status-chip--skipped {
  background-color: #f3f4f6;
  color: #9ca3af;
}
</style>
