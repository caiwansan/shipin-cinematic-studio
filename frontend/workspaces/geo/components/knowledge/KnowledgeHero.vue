<!-- KnowledgeHero.vue — Header 状态栏 -->
<template>
  <header class="geo-knowledge__hero">
    <div class="geo-knowledge__hero-left">
      <NuxtLink to="/workspace/geo/dashboard" class="geo-knowledge__hero-back">← 工作台</NuxtLink>
      <div class="geo-knowledge__hero-brand-section">
        <h1 class="geo-knowledge__hero-brand">{{ vm.hero.brandName }}</h1>
        <p class="geo-knowledge__hero-subtitle">品牌知识库 — 构建 AI 可读的知识资产</p>
      </div>
    </div>
    <div class="geo-knowledge__hero-right">
      <div class="geo-knowledge__hero-stat">
        <span class="geo-knowledge__hero-stat-value" :class="scoreClass">{{ vm.hero.knowledgeScore }}</span>
        <span class="geo-knowledge__hero-stat-label">知识评分</span>
      </div>
      <div class="geo-knowledge__hero-stat">
        <span class="geo-knowledge__hero-stat-value--small">{{ vm.hero.objectsCoverage }}%</span>
        <span class="geo-knowledge__hero-stat-label">覆盖度</span>
      </div>
      <div class="geo-knowledge__hero-stat">
        <span class="geo-knowledge__hero-stat-value--small">{{ vm.hero.lastUpdate }}</span>
        <span class="geo-knowledge__hero-stat-label">最近更新</span>
      </div>
      <div class="geo-knowledge__hero-status">
        <span :class="['geo-knowledge__hero-status-dot', statusDotClass]"></span>
        <span class="geo-knowledge__hero-status-text">{{ vm.hero.statusText }}</span>
      </div>
      <button
        v-if="vm.hero.actions.import"
        class="geo-knowledge__hero-btn"
        @click="$emit('import')"
      >导入</button>
      <button
        v-if="vm.hero.actions.create"
        class="geo-knowledge__hero-btn geo-knowledge__hero-btn--secondary"
        @click="$emit('create')"
      >创建</button>
      <button
        v-if="vm.hero.actions.refresh"
        class="geo-knowledge__hero-btn geo-knowledge__hero-btn--outline"
        @click="$emit('refresh')"
      >刷新</button>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { KnowledgeVM } from '../../viewmodels/KnowledgeViewModel'

const props = defineProps<{ vm: KnowledgeVM }>()
defineEmits<{ import: []; create: []; refresh: [] }>()

const scoreClass = computed(() => {
  if (props.vm.hero.knowledgeScore >= 70) return 'score--high'
  if (props.vm.hero.knowledgeScore >= 40) return 'score--mid'
  return 'score--low'
})

const statusDotClass = computed(() => {
  if (props.vm.hero.isRunning) return 'dot--running'
  if (props.vm.hero.isCompleted) return 'dot--completed'
  return 'dot--idle'
})
</script>

<style scoped>
.geo-knowledge__hero {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  background: linear-gradient(135deg, #1e293b, #334155);
  border-radius: 14px;
  color: #fff;
  gap: 16px;
  flex-wrap: wrap;
}

.geo-knowledge__hero-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.geo-knowledge__hero-back {
  color: rgba(255,255,255,.6);
  font-size: 13px;
  text-decoration: none;
  white-space: nowrap;
}

.geo-knowledge__hero-back:hover { color: #fff; }

.geo-knowledge__hero-brand-section {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.geo-knowledge__hero-brand {
  font-size: 20px;
  font-weight: 700;
  margin: 0;
}

.geo-knowledge__hero-subtitle {
  font-size: 13px;
  color: rgba(255,255,255,.6);
  margin: 0;
}

.geo-knowledge__hero-right {
  display: flex;
  align-items: center;
  gap: 20px;
  flex-wrap: wrap;
}

.geo-knowledge__hero-stat {
  text-align: center;
}

.geo-knowledge__hero-stat-value {
  display: block;
  font-size: 28px;
  font-weight: 800;
  line-height: 1;
}

.geo-knowledge__hero-stat-value--small {
  display: block;
  font-size: 14px;
  font-weight: 600;
  line-height: 1;
  color: rgba(255,255,255,.8);
}

.geo-knowledge__hero-stat-label {
  font-size: 11px;
  opacity: .6;
  margin-top: 2px;
  display: block;
}

.score--high { color: #4ade80; }
.score--mid { color: #fbbf24; }
.score--low { color: #f87171; }

.geo-knowledge__hero-status {
  display: flex;
  align-items: center;
  gap: 6px;
}

.geo-knowledge__hero-status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.dot--running { background: #4ade80; animation: pulse 1.5s infinite; }
.dot--completed { background: #4ade80; }
.dot--idle { background: #94a3b8; }

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: .4; }
}

.geo-knowledge__hero-status-text {
  font-size: 13px;
  color: rgba(255,255,255,.7);
}

.geo-knowledge__hero-btn {
  padding: 8px 20px;
  background: #3b82f6;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: background .15s;
}

.geo-knowledge__hero-btn:hover { background: #2563eb; }

.geo-knowledge__hero-btn--secondary {
  background: transparent;
  border: 1px solid rgba(255,255,255,.3);
}

.geo-knowledge__hero-btn--secondary:hover {
  background: rgba(255,255,255,.1);
}

.geo-knowledge__hero-btn--outline {
  background: rgba(255,255,255,.1);
  border: 1px solid rgba(255,255,255,.2);
}

.geo-knowledge__hero-btn--outline:hover {
  background: rgba(255,255,255,.2);
}
</style>
