<template>
  <div :class="['channel-list', classOverride]" :style="styleOverride" :data-testid="dataTestId">
    <h3 v-if="title" class="channel-list__title">{{ title }}</h3>
    <div class="channel-list__items">
      <div
        v-for="channel in channels"
        :key="channel.name"
        class="channel-list__item"
      >
        <div class="channel-list__item-info">
          <span class="channel-list__item-name">{{ channel.name }}</span>
          <StatusIndicator
            :status="channel.status"
            :label="statusLabel(channel.status)"
          />
        </div>
        <div class="channel-list__item-details">
          <span v-if="channel.lastSync" class="channel-list__item-sync">{{ channel.lastSync }}</span>
          <button
            v-if="channel.status === 'error'"
            class="channel-list__item-action"
            @click="$emit('retry', channel.name)"
          >
            Retry
          </button>
          <button
            v-if="channel.status === 'not-set-up'"
            class="channel-list__item-action"
            @click="$emit('setup', channel.name)"
          >
            Set Up
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import StatusIndicator from '~/design-system/components/StatusIndicator/index.vue'

export interface ChannelInfo {
  name: string
  status: 'connected' | 'pending' | 'error' | 'not-set-up'
  lastSync?: string
}

const props = withDefaults(defineProps<{
  title?: string
  channels: ChannelInfo[]
  class?: string
  style?: string | Record<string, string>
  'data-testid'?: string
}>(), {
  title: 'Connected Channels',
  channels: () => [],
})

defineEmits<{
  retry: [name: string]
  setup: [name: string]
}>()

const classOverride = computed(() => props.class || '')
const styleOverride = computed(() => props.style || undefined)
const dataTestId = computed(() => props['data-testid'] || undefined)

function statusLabel(status: string): string {
  switch (status) {
    case 'connected': return 'Connected'
    case 'pending': return 'Pending'
    case 'error': return 'Error'
    case 'not-set-up': return 'Not Set Up'
    default: return 'Pending'
  }
}
</script>

<style scoped>
.channel-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-4, 16px);
}

.channel-list__title {
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-heading-3-size, 20px);
  font-weight: var(--text-heading-3-weight, 500);
  color: var(--color-text-primary, #111111);
  margin: 0;
}

.channel-list__items {
  display: flex;
  flex-direction: column;
  gap: var(--space-2, 8px);
}

.channel-list__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3, 12px);
  padding: var(--space-4, 16px);
  border-radius: var(--radius-md, 8px);
  background-color: var(--color-surface, #ffffff);
  border: 1px solid var(--color-border, #e5e7eb);
  transition: all var(--motion-fast-duration, 100ms) ease-out;
}

.channel-list__item:hover {
  border-color: var(--color-text-tertiary, #9ca3af);
}

.channel-list__item-info {
  display: flex;
  align-items: center;
  gap: var(--space-3, 12px);
}

.channel-list__item-name {
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-body-sm-size, 14px);
  font-weight: 600;
  color: var(--color-text-primary, #111111);
}

.channel-list__item-details {
  display: flex;
  align-items: center;
  gap: var(--space-2, 8px);
}

.channel-list__item-sync {
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-caption-size, 12px);
  color: var(--color-text-tertiary, #9ca3af);
}

.channel-list__item-action {
  padding: var(--space-1, 4px) var(--space-3, 12px);
  border: 1px solid var(--color-info, #3b82f6);
  border-radius: var(--radius-sm, 4px);
  background-color: transparent;
  color: var(--color-info, #3b82f6);
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  font-size: var(--text-caption-size, 12px);
  font-weight: 500;
  cursor: pointer;
  transition: all var(--motion-fast-duration, 100ms) ease-out;
}

.channel-list__item-action:hover {
  background-color: var(--color-info, #3b82f6);
  color: #ffffff;
}
</style>
