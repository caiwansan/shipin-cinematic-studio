<!-- KnowledgeSnapshot.vue — 知识快照卡片网格 -->
<template>
  <section class="geo-knowledge-snapshot">
    <h2 class="geo-knowledge-snapshot__title">知识快照</h2>
    <div class="geo-knowledge-snapshot__grid">
      <div class="geo-knowledge-snapshot__item geo-knowledge-snapshot__item--score">
        <div class="geo-knowledge-snapshot__value" :class="scoreClass">{{ vm.snapshot.knowledgeScore }}</div>
        <div class="geo-knowledge-snapshot__label">知识评分</div>
        <div class="geo-knowledge-snapshot__desc">{{ scoreDesc }}</div>
      </div>
      <div class="geo-knowledge-snapshot__item">
        <div class="geo-knowledge-snapshot__value">{{ vm.snapshot.objectsTotal }}</div>
        <div class="geo-knowledge-snapshot__label">知识对象</div>
        <div class="geo-knowledge-snapshot__desc">知识条目总数</div>
      </div>
      <div class="geo-knowledge-snapshot__item">
        <div class="geo-knowledge-snapshot__value geo-knowledge-snapshot__value--small">{{ vm.snapshot.coveragePercent }}%</div>
        <div class="geo-knowledge-snapshot__label">覆盖度</div>
        <div class="geo-knowledge-snapshot__bar-track">
          <div class="geo-knowledge-snapshot__bar-fill" :style="{ width: vm.snapshot.coveragePercent + '%' }"></div>
        </div>
      </div>
      <div class="geo-knowledge-snapshot__item">
        <div class="geo-knowledge-snapshot__value">{{ vm.snapshot.verifiedCount }}</div>
        <div class="geo-knowledge-snapshot__label">已验证</div>
        <div class="geo-knowledge-snapshot__desc">已核实知识</div>
      </div>
      <div class="geo-knowledge-snapshot__item">
        <div class="geo-knowledge-snapshot__value">{{ vm.snapshot.publishedCount }}</div>
        <div class="geo-knowledge-snapshot__label">已发布</div>
        <div class="geo-knowledge-snapshot__desc">可被 AI 读取</div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { KnowledgeVM } from '../../viewmodels/KnowledgeViewModel'

const props = defineProps<{ vm: KnowledgeVM }>()

const scoreClass = computed(() => {
  if (props.vm.snapshot.knowledgeScore >= 70) return 'score--high'
  if (props.vm.snapshot.knowledgeScore >= 40) return 'score--mid'
  return 'score--low'
})

const scoreDesc = computed(() => {
  if (props.vm.snapshot.knowledgeScore >= 70) return '知识库质量良好'
  if (props.vm.snapshot.knowledgeScore >= 40) return '有改善空间'
  return '需要大幅提升'
})
</script>

<style scoped>
.geo-knowledge-snapshot {
  background: #fff;
  border-radius: 12px;
  padding: 20px;
  border: 1px solid #e2e8f0;
}

.geo-knowledge-snapshot__title {
  font-size: 15px;
  font-weight: 600;
  color: #1a1a2e;
  margin: 0 0 16px;
}

.geo-knowledge-snapshot__grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 12px;
}

.geo-knowledge-snapshot__item {
  padding: 16px;
  background: #f8fafc;
  border-radius: 10px;
  text-align: center;
}

.geo-knowledge-snapshot__item--score {
  background: linear-gradient(135deg, #eef2ff, #f0f0ff);
}

.geo-knowledge-snapshot__value {
  font-size: 32px;
  font-weight: 800;
  line-height: 1;
  margin-bottom: 4px;
  color: #1a1a2e;
}

.geo-knowledge-snapshot__value--small {
  font-size: 20px;
}

.score--high { color: #16a34a; }
.score--mid { color: #ca8a04; }
.score--low { color: #dc2626; }

.geo-knowledge-snapshot__label {
  font-size: 12px;
  color: #64748b;
  margin-bottom: 4px;
}

.geo-knowledge-snapshot__desc {
  font-size: 11px;
  color: #94a3b8;
}

.geo-knowledge-snapshot__bar-track {
  height: 4px;
  background: #e2e8f0;
  border-radius: 2px;
  margin-top: 6px;
  overflow: hidden;
}

.geo-knowledge-snapshot__bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #667eea, #764ba2);
  border-radius: 2px;
  transition: width .4s;
}

@media (max-width: 768px) {
  .geo-knowledge-snapshot__grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
