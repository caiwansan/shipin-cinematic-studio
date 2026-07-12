<!-- @deprecated 未被任何页面引用，MissionControl 重构中废弃 -->
<template>
  <div class="mc-current-mission">
    <div v-if="journey" class="mc-current-mission__content">
      <div class="mc-current-mission__label">当前任务</div>
      <h2 class="mc-current-mission__brand">{{ journey.projectName }}</h2>
      <div class="mc-current-mission__meta">
        <span class="mc-current-mission__step-label">当前阶段：{{ journey.currentStep }}</span>
        <span class="mc-current-mission__step-label">下一步：<strong>{{ journey.nextStep }}</strong></span>
        <span class="mc-current-mission__eta" v-if="eta">预计耗时：{{ eta }}</span>
      </div>
      <NuxtLink
        v-if="journey.canContinue && journey.nextStepUrl"
        :to="journey.nextStepUrl"
        class="mc-current-mission__cta"
      >
        继续 →
      </NuxtLink>
    </div>
    <div v-else class="mc-current-mission__empty">
      <h2 class="mc-current-mission__empty-title">欢迎使用 GEO Workspace</h2>
      <p class="mc-current-mission__empty-desc">创建一个品牌，开始你的第一次 AI 可见度优化</p>
      <NuxtLink to="/workspace/geo/create" class="mc-current-mission__cta">
        创建品牌
      </NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  journey: {
    projectName: string
    currentStep: string
    nextStep: string
    nextStepUrl: string
    canContinue: boolean
  } | null
  eta?: string
}>()
</script>

<style scoped>
.mc-current-mission {
  border-radius: 16px;
  background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);
  padding: 32px;
  color: #fff;
}
.mc-current-mission__label {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  opacity: 0.75;
  margin-bottom: 8px;
}
.mc-current-mission__brand {
  font-size: 28px;
  font-weight: 700;
  margin: 0 0 20px;
  line-height: 1.2;
}
.mc-current-mission__meta {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 24px;
}
.mc-current-mission__step-label {
  font-size: 14px;
  opacity: 0.9;
}
.mc-current-mission__eta {
  font-size: 13px;
  opacity: 0.7;
  margin-top: 4px;
}
.mc-current-mission__cta {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 12px 32px;
  background: #fff;
  color: #1e40af;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 700;
  text-decoration: none;
  transition: all 0.15s;
}
.mc-current-mission__cta:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(0,0,0,0.2);
}
.mc-current-mission__empty-title {
  font-size: 24px;
  font-weight: 700;
  margin: 0 0 8px;
}
.mc-current-mission__empty-desc {
  font-size: 15px;
  opacity: 0.85;
  margin: 0 0 24px;
}
</style>
