<!-- DiscoveryHero.vue — Header 状态栏 -->
<template>
  <header class="geo-discovery__hero">
    <div class="geo-discovery__hero-left">
      <NuxtLink to="/workspace/geo/dashboard" class="geo-discovery__hero-back">← 工作台</NuxtLink>
      <div class="geo-discovery__hero-brand-section">
        <h1 class="geo-discovery__hero-brand">{{ vm.hero.brandName }}</h1>
        <p class="geo-discovery__hero-subtitle">发现品牌在 AI 世界中的真实可见性</p>
      </div>
    </div>
    <div class="geo-discovery__hero-right">
      <div class="geo-discovery__hero-stat">
        <span class="geo-discovery__hero-stat-value" :class="adiClass">{{ vm.hero.adi }}</span>
        <span class="geo-discovery__hero-stat-label">ADI 分数</span>
      </div>
      <div class="geo-discovery__hero-stat">
        <span class="geo-discovery__hero-stat-value--small">{{ lastScanDisplay }}</span>
        <span class="geo-discovery__hero-stat-label">最近扫描</span>
      </div>
      <div class="geo-discovery__hero-status">
        <span :class="['geo-discovery__hero-status-dot', statusDotClass]"></span>
        <span class="geo-discovery__hero-status-text">{{ vm.hero.scanStatus }}</span>
      </div>
      <button
        v-if="vm.hero.actions.runScan"
        class="geo-discovery__hero-btn"
        @click="$emit('run-scan')"
      >开始扫描</button>
      <button
        v-if="vm.hero.actions.rescan"
        class="geo-discovery__hero-btn geo-discovery__hero-btn--secondary"
        @click="$emit('run-scan')"
      >重新扫描</button>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { DiscoveryVM } from '../../viewmodels/DiscoveryViewModel'

const props = defineProps<{ vm: DiscoveryVM }>()
defineEmits<{ 'run-scan': [] }>()

const adiClass = computed(() => {
  if (props.vm.hero.adi >= 70) return 'adi--high'
  if (props.vm.hero.adi >= 40) return 'adi--mid'
  return 'adi--low'
})

const lastScanDisplay = computed(() => props.vm.hero.lastScan || '—')

const statusDotClass = computed(() => {
  if (props.vm.hero.isRunning) return 'dot--running'
  if (props.vm.hero.isCompleted) return 'dot--completed'
  return 'dot--idle'
})
</script>

<style scoped>
.geo-discovery__hero {
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

.geo-discovery__hero-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.geo-discovery__hero-back {
  color: rgba(255,255,255,.6);
  font-size: 13px;
  text-decoration: none;
  white-space: nowrap;
}

.geo-discovery__hero-back:hover { color: #fff; }

.geo-discovery__hero-brand-section {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.geo-discovery__hero-brand {
  font-size: 20px;
  font-weight: 700;
  margin: 0;
}

.geo-discovery__hero-subtitle {
  font-size: 13px;
  color: rgba(255,255,255,.6);
  margin: 0;
}

.geo-discovery__hero-right {
  display: flex;
  align-items: center;
  gap: 20px;
  flex-wrap: wrap;
}

.geo-discovery__hero-stat {
  text-align: center;
}

.geo-discovery__hero-stat-value {
  display: block;
  font-size: 28px;
  font-weight: 800;
  line-height: 1;
}

.geo-discovery__hero-stat-value--small {
  display: block;
  font-size: 14px;
  font-weight: 600;
  line-height: 1;
  color: rgba(255,255,255,.8);
}

.geo-discovery__hero-stat-label {
  font-size: 11px;
  opacity: .6;
  margin-top: 2px;
  display: block;
}

.adi--high { color: #4ade80; }
.adi--mid { color: #fbbf24; }
.adi--low { color: #f87171; }

.geo-discovery__hero-status {
  display: flex;
  align-items: center;
  gap: 6px;
}

.geo-discovery__hero-status-dot {
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

.geo-discovery__hero-status-text {
  font-size: 13px;
  color: rgba(255,255,255,.7);
}

.geo-discovery__hero-btn {
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

.geo-discovery__hero-btn:hover { background: #2563eb; }

.geo-discovery__hero-btn--secondary {
  background: transparent;
  border: 1px solid rgba(255,255,255,.3);
}

.geo-discovery__hero-btn--secondary:hover {
  background: rgba(255,255,255,.1);
}
</style>
