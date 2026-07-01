<template>
  <GeoCard v-if="show" class="geo-walkthrough-welcome" variant="primary">
    <div class="geo-walkthrough-welcome__content">
      <div class="geo-walkthrough-welcome__icon">🚀</div>
      <div class="geo-walkthrough-welcome__text">
        <h3 class="geo-walkthrough-welcome__title">欢迎使用 GEO 工作台</h3>
        <p class="geo-walkthrough-welcome__desc">
          创建您的第一个品牌，开始 AI 可见度优化之旅。我们将引导您逐步完成发现、分析、优化和验证。
        </p>
      </div>
      <div class="geo-walkthrough-welcome__actions">
        <button class="geo-walkthrough-welcome__btn" @click="$emit('create')">
          创建第一个品牌
        </button>
        <button class="geo-walkthrough-welcome__skip" @click="$emit('skip')">
          跳过引导
        </button>
      </div>
    </div>
  </GeoCard>
</template>

<script setup lang="ts">
import GeoCard from './GeoCard/index.vue'

defineProps<{
  show: boolean
}>()

defineEmits<{
  create: []
  skip: []
}>()
</script>

<style scoped>
.geo-walkthrough-welcome {
  margin-bottom: 24px;
  border: none;
  background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 50%, #ede9fe 100%);
  border: 1px solid #bfdbfe;
  border-radius: 12px;
  overflow: hidden;
}

.geo-walkthrough-welcome__content {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 4px;
}

.geo-walkthrough-welcome__icon {
  font-size: 40px;
  flex-shrink: 0;
  animation: geo-bounce 2s ease-in-out infinite;
}

@keyframes geo-bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-4px); }
}

.geo-walkthrough-welcome__text {
  flex: 1;
}

.geo-walkthrough-welcome__title {
  font-size: 18px;
  font-weight: 700;
  color: #1e40af;
  margin: 0 0 4px;
}

.geo-walkthrough-welcome__desc {
  font-size: 14px;
  color: #3b82f6;
  margin: 0;
  line-height: 1.5;
}

.geo-walkthrough-welcome__actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.geo-walkthrough-welcome__btn {
  padding: 10px 24px;
  background: #2563eb;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  font-family: inherit;
  white-space: nowrap;
}

.geo-walkthrough-welcome__btn:hover {
  background: #1d4ed8;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.25);
}

.geo-walkthrough-welcome__skip {
  padding: 8px 16px;
  background: transparent;
  color: #6b7280;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
  font-family: inherit;
  white-space: nowrap;
}

.geo-walkthrough-welcome__skip:hover {
  background: #f3f4f6;
  color: #374151;
}
</style>
