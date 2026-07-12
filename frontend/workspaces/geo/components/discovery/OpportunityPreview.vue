<!-- OpportunityPreview.vue — Top 机会预览 -->
<template>
  <section class="geo-opp-preview">
    <div class="geo-opp-preview__header">
      <h2 class="geo-opp-preview__title">Top 优化机会</h2>
      <span class="geo-opp-preview__badge">共 {{ vm.opportunities.total }} 项</span>
    </div>

    <div v-if="vm.opportunities.items.length === 0" class="geo-opp-preview__empty">
      <p>暂无优化机会</p>
    </div>

    <div v-else class="geo-opp-preview__list">
      <div
        v-for="item in vm.opportunities.items"
        :key="item.id"
        :class="['geo-opp-preview__card', `card--${item.priority}`]"
      >
        <div class="geo-opp-preview__card-header">
          <span class="geo-opp-preview__card-priority">
            {{ item.priority === 'high' ? '🔴' : item.priority === 'medium' ? '🟡' : '⚪' }}
            {{ priorityLabel(item.priority) }}
          </span>
          <span class="geo-opp-preview__card-gain">+{{ item.expectedAdiGain }} ADI</span>
        </div>
        <p class="geo-opp-preview__card-title">{{ item.title }}</p>
        <p class="geo-opp-preview__card-desc">{{ item.suggestion }}</p>
        <NuxtLink :to="item.actionUrl" class="geo-opp-preview__card-action">
          Fix in Knowledge →
        </NuxtLink>
      </div>
    </div>

    <NuxtLink
      v-if="vm.opportunities.showAll"
      to="/workspace/geo/discovery"
      class="geo-opp-preview__view-all"
    >
      View All Opportunities →
    </NuxtLink>
  </section>
</template>

<script setup lang="ts">
import type { DiscoveryVM } from '../../viewmodels/DiscoveryViewModel'

defineProps<{ vm: DiscoveryVM }>()

function priorityLabel(p: string): string {
  const m: Record<string, string> = { high: 'High', medium: 'Medium', low: 'Low' }
  return m[p] || p
}
</script>

<style scoped>
.geo-opp-preview {
  background: #fff;
  border-radius: 12px;
  padding: 20px;
  border: 1px solid #e2e8f0;
}

.geo-opp-preview__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}

.geo-opp-preview__title {
  font-size: 15px;
  font-weight: 600;
  color: #1a1a2e;
  margin: 0;
}

.geo-opp-preview__badge {
  font-size: 12px;
  padding: 2px 10px;
  background: #f1f5f9;
  color: #64748b;
  border-radius: 6px;
  font-weight: 500;
}

.geo-opp-preview__empty {
  padding: 24px;
  text-align: center;
  color: #94a3b8;
  font-size: 14px;
}

.geo-opp-preview__list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.geo-opp-preview__card {
  padding: 14px;
  border-radius: 10px;
  border: 1px solid #e2e8f0;
  transition: box-shadow .15s;
}

.geo-opp-preview__card:hover {
  box-shadow: 0 2px 8px rgba(0,0,0,.06);
}

.card--high { border-left: 3px solid #ef4444; }
.card--medium { border-left: 3px solid #f59e0b; }
.card--low { border-left: 3px solid #94a3b8; }

.geo-opp-preview__card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.geo-opp-preview__card-priority {
  font-size: 12px;
  font-weight: 600;
  color: #475569;
}

.geo-opp-preview__card-gain {
  font-size: 12px;
  font-weight: 700;
  color: #16a34a;
}

.geo-opp-preview__card-title {
  font-size: 14px;
  font-weight: 500;
  color: #1a1a2e;
  margin: 0 0 4px;
}

.geo-opp-preview__card-desc {
  font-size: 13px;
  color: #64748b;
  margin: 0 0 8px;
  line-height: 1.5;
}

.geo-opp-preview__card-action {
  font-size: 13px;
  font-weight: 500;
  color: #3b82f6;
  text-decoration: none;
}

.geo-opp-preview__card-action:hover {
  color: #2563eb;
  text-decoration: underline;
}

.geo-opp-preview__view-all {
  display: block;
  text-align: center;
  margin-top: 12px;
  padding: 8px;
  font-size: 13px;
  font-weight: 500;
  color: #64748b;
  text-decoration: none;
  border-radius: 8px;
  transition: background .15s;
}

.geo-opp-preview__view-all:hover {
  background: #f8fafc;
  color: #3b82f6;
}
</style>
