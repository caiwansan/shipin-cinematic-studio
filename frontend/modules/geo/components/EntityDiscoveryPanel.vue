<template>
  <div class="entity-discovery-panel">
    <!-- Entity List -->
    <div class="entity-discovery-panel__section">
      <h4 class="entity-discovery-panel__section-title">
        实体列表 ({{ entities.length }})
      </h4>
      <div v-if="entities.length === 0" class="entity-discovery-panel__empty">
        暂无实体，请先进行主题研究
      </div>
      <div v-else class="entity-discovery-panel__list">
        <div
          v-for="entity in entities"
          :key="entity.id"
          class="entity-discovery-panel__entity"
          :class="{ 'entity-discovery-panel__entity--selected': selectedId === entity.id }"
          @click="selectedId = entity.id"
        >
          <div class="entity-discovery-panel__entity-header">
            <span class="entity-discovery-panel__entity-name">{{ entity.name }}</span>
            <span class="entity-discovery-panel__entity-type">{{ entity.type }}</span>
          </div>
          <div v-if="entity.description" class="entity-discovery-panel__entity-desc">
            {{ entity.description }}
          </div>
        </div>
      </div>
    </div>

    <!-- Relations List -->
    <div v-if="relations.length > 0" class="entity-discovery-panel__section">
      <h4 class="entity-discovery-panel__section-title">
        实体关系 ({{ relations.length }})
      </h4>
      <div class="entity-discovery-panel__relations">
        <div v-for="rel in relations" :key="rel.id" class="entity-discovery-panel__relation">
          <span class="entity-discovery-panel__relation-source">{{ getEntityName(rel.sourceId) }}</span>
          <span class="entity-discovery-panel__relation-arrow">→</span>
          <span class="entity-discovery-panel__relation-type">{{ rel.type }}</span>
          <span class="entity-discovery-panel__relation-arrow">→</span>
          <span class="entity-discovery-panel__relation-target">{{ getEntityName(rel.targetId) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { Entity, EntityRelation } from '../types/index'

const props = defineProps<{
  entities: Entity[]
  relations: EntityRelation[]
}>()

const selectedId = ref<string | null>(null)

function getEntityName(id: string): string {
  const entity = props.entities.find(e => e.id === id)
  return entity?.name || id.substring(0, 8)
}
</script>

<style scoped>
.entity-discovery-panel {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.entity-discovery-panel__section-title {
  font-size: 13px;
  font-weight: 600;
  color: #6b7280;
  margin: 0 0 10px 0;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.entity-discovery-panel__empty {
  font-size: 13px;
  color: #9ca3af;
  text-align: center;
  padding: 24px 0;
}

.entity-discovery-panel__list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.entity-discovery-panel__entity {
  padding: 10px 12px;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.entity-discovery-panel__entity:hover {
  border-color: #c7d2fe;
  background: #f5f3ff;
}

.entity-discovery-panel__entity--selected {
  border-color: #6366f1;
  background: #eef2ff;
}

.entity-discovery-panel__entity-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.entity-discovery-panel__entity-name {
  font-size: 14px;
  font-weight: 500;
  color: #1f2937;
}

.entity-discovery-panel__entity-type {
  font-size: 11px;
  padding: 2px 6px;
  background: #e5e7eb;
  border-radius: 4px;
  color: #6b7280;
}

.entity-discovery-panel__entity-desc {
  font-size: 12px;
  color: #9ca3af;
  margin-top: 4px;
}

.entity-discovery-panel__relations {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.entity-discovery-panel__relation {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  background: #f9fafb;
  border-radius: 8px;
  font-size: 12px;
  flex-wrap: wrap;
}

.entity-discovery-panel__relation-source,
.entity-discovery-panel__relation-target {
  font-weight: 500;
  color: #4338ca;
}

.entity-discovery-panel__relation-arrow {
  color: #9ca3af;
}

.entity-discovery-panel__relation-type {
  padding: 2px 6px;
  background: #fef3c7;
  border-radius: 4px;
  color: #92400e;
  font-size: 11px;
}
</style>
