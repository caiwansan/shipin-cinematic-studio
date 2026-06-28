<template>
  <div class="agent-card" :class="[`status-${agent.status}`, { selected }]" @click="$emit('select', agent)">
    <div class="card-header">
      <div class="agent-icon">
        {{ agent.name.charAt(0).toUpperCase() }}
      </div>
      <div class="agent-info">
        <h3 class="agent-name">{{ agent.name }}</h3>
        <span class="agent-code">{{ agent.code }}</span>
      </div>
      <span class="status-badge" :class="agent.status">
        {{ agent.status }}
      </span>
    </div>

    <p v-if="agent.description" class="agent-description">{{ agent.description }}</p>

    <div class="agent-meta">
      <div class="meta-item">
        <label>版本</label>
        <span>v{{ agent.version }}</span>
      </div>
      <div class="meta-item">
        <label>模式</label>
        <span>{{ agent.executionMode }}</span>
      </div>
      <div class="meta-item" v-if="agent.category">
        <label>类别</label>
        <span>{{ agent.category }}</span>
      </div>
    </div>

    <div class="agent-capabilities" v-if="agent.capabilities?.length">
      <span class="capability-tag" v-for="cap in agent.capabilities" :key="cap">
        {{ cap }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { AgentDefinition } from '../types/index'

defineProps<{
  agent: AgentDefinition
  selected?: boolean
}>()

defineEmits<{
  select: [agent: AgentDefinition]
}>()
</script>

<style scoped>
.agent-card {
  background: var(--surface-color, #1a1a2e);
  border: 1px solid var(--border-color, #2a2a4a);
  border-radius: 12px;
  padding: 16px;
  cursor: pointer;
  transition: all 0.2s ease;
}
.agent-card:hover {
  border-color: var(--primary-color, #6366f1);
  transform: translateY(-2px);
}
.agent-card.selected {
  border-color: var(--primary-color, #6366f1);
  box-shadow: 0 0 20px rgba(99, 102, 241, 0.2);
}
.agent-card.status-deprecated {
  opacity: 0.6;
}
.agent-card.status-disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.agent-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  font-weight: 700;
  color: white;
  flex-shrink: 0;
}

.agent-info {
  flex: 1;
  min-width: 0;
}

.agent-name {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary, #e2e8f0);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.agent-code {
  font-size: 12px;
  color: var(--text-secondary, #94a3b8);
  font-family: monospace;
}

.status-badge {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 6px;
  font-weight: 500;
  text-transform: uppercase;
  white-space: nowrap;
}
.status-badge.active { background: #22c55e20; color: #22c55e; }
.status-badge.deprecated { background: #f59e0b20; color: #f59e0b; }
.status-badge.disabled { background: #ef444420; color: #ef4444; }

.agent-description {
  font-size: 13px;
  color: var(--text-secondary, #94a3b8);
  margin: 0 0 12px;
  line-height: 1.5;
}

.agent-meta {
  display: flex;
  gap: 16px;
  margin-bottom: 12px;
}

.meta-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.meta-item label {
  font-size: 10px;
  color: var(--text-muted, #64748b);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.meta-item span {
  font-size: 13px;
  color: var(--text-primary, #e2e8f0);
}

.agent-capabilities {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.capability-tag {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
  background: var(--primary-color, #6366f1)20;
  color: var(--primary-color, #6366f1);
  border: 1px solid var(--primary-color, #6366f1)30;
}
</style>
