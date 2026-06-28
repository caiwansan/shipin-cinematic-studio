<template>
  <div class="provenance-timeline">
    <div v-if="!provenance" class="provenance-timeline__empty">
      暂无溯源数据
    </div>
    <div v-else class="provenance-timeline__chain">
      <div class="provenance-timeline__current">
        <h4>当前实体</h4>
        <div class="provenance-timeline__entity-info">
          <span class="provenance-timeline__entity-name">{{ provenance.current.name }}</span>
          <span class="provenance-timeline__entity-type">{{ provenance.current.type }}</span>
        </div>
      </div>

      <div class="provenance-timeline__events">
        <h4>溯源链</h4>
        <div
          v-for="(record, index) in provenance.provenanceChain"
          :key="index"
          class="provenance-timeline__event"
        >
          <div class="provenance-timeline__event-dot" />
          <div class="provenance-timeline__event-content">
            <div class="provenance-timeline__event-header">
              <span class="provenance-timeline__event-action">{{ record.action }}</span>
              <span class="provenance-timeline__event-actor">{{ record.actor }}</span>
            </div>
            <div class="provenance-timeline__event-time">{{ formatTime(record.timestamp) }}</div>
            <div v-if="record.reason" class="provenance-timeline__event-reason">
              {{ record.reason }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ProvenanceChain } from '../types/index'

defineProps<{
  provenance: ProvenanceChain | null
}>()

function formatTime(ts: string) {
  const d = new Date(ts)
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}
</script>

<style scoped>
.provenance-timeline {
  padding: 12px;
}

.provenance-timeline__empty {
  text-align: center;
  color: #9ca3af;
  padding: 24px 0;
  font-size: 13px;
}

.provenance-timeline__current {
  margin-bottom: 20px;
}

.provenance-timeline__current h4 {
  font-size: 12px;
  font-weight: 600;
  color: #6b7280;
  margin: 0 0 8px 0;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.provenance-timeline__entity-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.provenance-timeline__entity-name {
  font-size: 15px;
  font-weight: 600;
  color: #1f2937;
}

.provenance-timeline__entity-type {
  font-size: 11px;
  padding: 2px 6px;
  background: #eef2ff;
  border-radius: 4px;
  color: #4338ca;
}

.provenance-timeline__events h4 {
  font-size: 12px;
  font-weight: 600;
  color: #6b7280;
  margin: 0 0 12px 0;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.provenance-timeline__event {
  display: flex;
  gap: 12px;
  padding-bottom: 16px;
  position: relative;
}

.provenance-timeline__event:not(:last-child)::before {
  content: '';
  position: absolute;
  left: 4px;
  top: 12px;
  bottom: 0;
  width: 2px;
  background: #e5e7eb;
}

.provenance-timeline__event-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #6366f1;
  flex-shrink: 0;
  margin-top: 3px;
  position: relative;
  z-index: 1;
}

.provenance-timeline__event-content {
  flex: 1;
}

.provenance-timeline__event-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 2px;
}

.provenance-timeline__event-action {
  font-size: 13px;
  font-weight: 500;
  color: #4338ca;
  text-transform: capitalize;
}

.provenance-timeline__event-actor {
  font-size: 11px;
  color: #9ca3af;
}

.provenance-timeline__event-time {
  font-size: 11px;
  color: #d1d5db;
  margin-bottom: 4px;
}

.provenance-timeline__event-reason {
  font-size: 12px;
  color: #6b7280;
  background: #f9fafb;
  padding: 6px 10px;
  border-radius: 6px;
  line-height: 1.4;
}
</style>
