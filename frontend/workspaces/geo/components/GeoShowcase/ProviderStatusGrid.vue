<template>
  <section class="geo-showcase__section">
    <GeoSectionHeader
      title="AI 生态覆盖"
      subtitle="由 PresenceEngine 实时监测的 AI 平台状态"
    />

    <div class="geo-showcase__providers-grid">
      <GeoCard
        v-for="provider in providers"
        :key="provider.name"
        variant="outline"
        class="geo-showcase__provider-card"
      >
        <div class="geo-showcase__provider-content">
          <span class="geo-showcase__provider-name">{{ provider.displayName }}</span>
          <span
            class="geo-showcase__provider-status"
            :class="`geo-showcase__provider-status--${provider.status}`"
          >
            {{ statusLabel(provider.status) }}
          </span>
        </div>
      </GeoCard>
    </div>
  </section>
</template>

<script setup lang="ts">
import GeoSectionHeader from '../GeoSectionHeader/index.vue'
import GeoCard from '../GeoCard/index.vue'
import type { ShowcaseProvider } from '../../services/showcaseService'

defineProps<{
  providers: ShowcaseProvider[]
}>()

function statusLabel(status: ShowcaseProvider['status']): string {
  switch (status) {
    case 'supported':
      return '已配置'
    case 'in-progress':
      return '集成中'
    case 'coming-soon':
      return '即将支持'
    default:
      return status
  }
}
</script>

<style scoped>
.geo-showcase__section {
  margin-bottom: 28px;
}

.geo-showcase__providers-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 12px;
}

.geo-showcase__provider-card {
  cursor: default;
  transition: all 0.15s;
}

.geo-showcase__provider-card:hover {
  border-color: #d1d5db;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.geo-showcase__provider-content {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.geo-showcase__provider-name {
  font-size: 15px;
  font-weight: 600;
  color: #111827;
}

.geo-showcase__provider-status {
  font-size: 12px;
  font-weight: 500;
  padding: 2px 8px;
  border-radius: 10px;
  display: inline-block;
  width: fit-content;
}

.geo-showcase__provider-status--supported {
  background: #e0f2fe;
  color: #0369a1;
}

.geo-showcase__provider-status--in-progress {
  background: #fef3c7;
  color: #92400e;
}

.geo-showcase__provider-status--coming-soon {
  background: #f3f4f6;
  color: #6b7280;
}

@media (max-width: 640px) {
  .geo-showcase__providers-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}
</style>
