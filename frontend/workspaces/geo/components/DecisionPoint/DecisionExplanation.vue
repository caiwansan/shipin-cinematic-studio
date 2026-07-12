<!-- @deprecated 未被引用，保留作参考 -->
<template>
  <div class="dp-explanation">
    <h3 class="dp-explanation__title">决策依据</h3>
    <div class="dp-explanation__items">
      <div v-for="(item, i) in items" :key="i" class="dp-explanation__item">
        <div class="dp-explanation__icon">{{ item.icon || '📊' }}</div>
        <div class="dp-explanation__body">
          <p class="dp-explanation__text">{{ item.text }}</p>
          <p v-if="item.detail" class="dp-explanation__detail">{{ item.detail }}</p>
        </div>
      </div>
      <div v-if="items.length === 0" class="dp-explanation__empty">暂无决策依据</div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  items: Array<{
    icon?: string
    text: string
    detail?: string
  }>
}>()
</script>

<style scoped>
.dp-explanation {
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 20px 24px;
}
.dp-explanation__title {
  font-size: 16px;
  font-weight: 700;
  color: #111827;
  margin: 0 0 16px;
}
.dp-explanation__items {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.dp-explanation__item {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}
.dp-explanation__icon {
  flex-shrink: 0;
  font-size: 16px;
  margin-top: 2px;
}
.dp-explanation__body { flex: 1; }
.dp-explanation__text {
  font-size: 14px;
  color: #374151;
  margin: 0;
  font-weight: 500;
}
.dp-explanation__detail {
  font-size: 13px;
  color: #9ca3af;
  margin: 4px 0 0;
}
.dp-explanation__empty {
  color: #9ca3af;
  font-size: 13px;
  text-align: center;
  padding: 12px;
}
</style>
