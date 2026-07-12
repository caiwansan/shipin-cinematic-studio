<!-- DiscoverySnapshot.vue — ADI + KPI 快照卡片 -->
<template>
  <section class="geo-snapshot">
    <h2 class="geo-snapshot__title">发现概览</h2>
    <div class="geo-snapshot__grid">
      <div class="geo-snapshot__item geo-snapshot__item--adi">
        <div class="geo-snapshot__value" :class="adiClass">{{ vm.snapshot.adi }}</div>
        <div class="geo-snapshot__label">AI 发现指数</div>
        <div class="geo-snapshot__desc">{{ adiDesc }}</div>
      </div>
      <div class="geo-snapshot__item">
        <div class="geo-snapshot__value">{{ vm.snapshot.scenariosTotal }}</div>
        <div class="geo-snapshot__label">AI 场景</div>
        <div class="geo-snapshot__desc">AI 可回答的品牌需求场景</div>
      </div>
      <div class="geo-snapshot__item">
        <div class="geo-snapshot__value">{{ vm.snapshot.opportunitiesTotal }}</div>
        <div class="geo-snapshot__label">优化机会</div>
        <div class="geo-snapshot__desc">{{ vm.snapshot.highPriorityCount }} 个高优先级</div>
      </div>
      <div class="geo-snapshot__item">
        <div class="geo-snapshot__value geo-snapshot__value--small">{{ adiPercent }}%</div>
        <div class="geo-snapshot__label">发现完整度</div>
        <div class="geo-snapshot__bar-track">
          <div class="geo-snapshot__bar-fill" :style="{ width: adiPercent + '%' }"></div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { DiscoveryVM } from '../../viewmodels/DiscoveryViewModel'

const props = defineProps<{ vm: DiscoveryVM }>()

const adiPercent = computed(() => Math.min(100, props.vm.snapshot.adi))
const adiClass = computed(() => {
  if (props.vm.snapshot.adi >= 70) return 'score--high'
  if (props.vm.snapshot.adi >= 40) return 'score--mid'
  return 'score--low'
})
const adiDesc = computed(() => {
  if (props.vm.snapshot.adi >= 70) return '品牌发现就绪度良好'
  if (props.vm.snapshot.adi >= 40) return '有改善空间'
  return '需要大幅提升'
})
</script>

<style scoped>
.geo-snapshot {
  background: #fff;
  border-radius: 12px;
  padding: 20px;
  border: 1px solid #e2e8f0;
}

.geo-snapshot__title {
  font-size: 15px;
  font-weight: 600;
  color: #1a1a2e;
  margin: 0 0 16px;
}

.geo-snapshot__grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

.geo-snapshot__item {
  padding: 16px;
  background: #f8fafc;
  border-radius: 10px;
  text-align: center;
}

.geo-snapshot__item--adi {
  background: linear-gradient(135deg, #eef2ff, #f0f0ff);
}

.geo-snapshot__value {
  font-size: 32px;
  font-weight: 800;
  line-height: 1;
  margin-bottom: 4px;
  color: #1a1a2e;
}

.geo-snapshot__value--small {
  font-size: 20px;
}

.score--high { color: #16a34a; }
.score--mid { color: #ca8a04; }
.score--low { color: #dc2626; }

.geo-snapshot__label {
  font-size: 12px;
  color: #64748b;
  margin-bottom: 4px;
}

.geo-snapshot__desc {
  font-size: 11px;
  color: #94a3b8;
}

.geo-snapshot__bar-track {
  height: 4px;
  background: #e2e8f0;
  border-radius: 2px;
  margin-top: 6px;
  overflow: hidden;
}

.geo-snapshot__bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #667eea, #764ba2);
  border-radius: 2px;
  transition: width .4s;
}

@media (max-width: 768px) {
  .geo-snapshot__grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
