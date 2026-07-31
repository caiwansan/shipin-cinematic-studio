<template>
  <div class="ew-wrapper">
    <!-- 顶部导航 -->
    <header class="ew-header">
      <div class="ew-header-left">
        <button class="ew-back-btn" @click="goHome">← 返回首页</button>
        <h1>🏢 企业 AI 招聘工作台</h1>
        <span class="ew-plan-badge">{{ plan }}</span>
      </div>
      <div class="ew-header-right">
        <NuxtLink to="/workspace/job" class="ew-btn ew-btn-job">🪞 镜心</NuxtLink>
      </div>
    </header>

    <!-- 可滚动内容区 -->
    <main class="ew-content">
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
const plan = ref('basic')

function goHome() {
  window.location.href = '/'
}

// 从子组件获取 plan
onMounted(() => {
  try {
    const stored = localStorage.getItem('enterprise_plan')
    if (stored) plan.value = stored
  } catch {}
})
</script>

<style scoped>
.ew-wrapper {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
  background: #0b0f14;
}

.ew-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 20px;
  background: rgba(255,255,255,0.03);
  border-bottom: 1px solid rgba(255,255,255,0.06);
  flex-shrink: 0;
}

.ew-header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.ew-back-btn {
  padding: 6px 14px;
  font-size: 0.85rem;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 6px;
  color: rgba(255,255,255,0.7);
  cursor: pointer;
  transition: all 0.15s;
}

.ew-back-btn:hover {
  background: rgba(255,255,255,0.1);
  color: rgba(255,255,255,0.95);
}

.ew-header h1 {
  margin: 0;
  font-size: 1.2rem;
  color: rgba(255,255,255,0.95);
}

.ew-plan-badge {
  padding: 2px 10px;
  background: rgba(201, 168, 108, 0.2);
  color: rgba(201, 168, 108, 0.9);
  border-radius: 12px;
  font-size: 0.75rem;
  text-transform: uppercase;
}

.ew-header-right {
  display: flex;
  gap: 8px;
}

.ew-btn {
  padding: 8px 16px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.15s;
  text-decoration: none;
}

.ew-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255,255,255,0.95);
}

.ew-btn-job {
  background: rgba(74, 222, 128, 0.1);
  border-color: rgba(74, 222, 128, 0.3);
  color: rgba(74, 222, 128, 0.85);
}

.ew-btn-job:hover {
  background: rgba(74, 222, 128, 0.2);
  color: #4ade80;
  border-color: rgba(74, 222, 128, 0.5);
}

.ew-content {
  flex: 1;
  overflow-y: auto;
  padding: 0;
}
</style>
