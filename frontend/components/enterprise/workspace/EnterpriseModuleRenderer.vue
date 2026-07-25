<!-- EnterpriseModuleRenderer — 模块动态渲染器 -->
<!-- 根据 currentModule 动态切换部门视图 -->
<!-- 无页面跳转感: 切换时只有内容区域更新 -->
<template>
  <div class="module-renderer">
    <Transition name="module-fade" mode="out-in">
      <component :is="moduleComponent" :key="module" />
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { defineAsyncComponent, computed } from 'vue'

const props = defineProps<{
  module: string
}>()

// Lazy load modules to keep initial bundle small
const moduleMap: Record<string, any> = {
  'dashboard': defineAsyncComponent(() => import('./modules/DashboardModule.vue')),
  'intelligence': defineAsyncComponent(() => import('./modules/IntelligenceModule.vue')),
  'decisions': defineAsyncComponent(() => import('./modules/DecisionsModule.vue')),
  'execution': defineAsyncComponent(() => import('./modules/ExecutionModule.vue')),
  'channels': defineAsyncComponent(() => import('./modules/ChannelsModule.vue')),
  'ai-employees': defineAsyncComponent(() => import('./modules/EmployeesModule.vue')),
  'recruitment': defineAsyncComponent(() => import('./modules/RecruitmentModule.vue')),
  'knowledge': defineAsyncComponent(() => import('./modules/KnowledgeModule.vue')),
  'growth': defineAsyncComponent(() => import('./modules/GrowthModule.vue')),
  'governance': defineAsyncComponent(() => import('./modules/GovernanceModule.vue')),
  'settings': defineAsyncComponent(() => import('./modules/SettingsModule.vue')),
}

const moduleComponent = computed(() => moduleMap[props.module] || moduleMap['dashboard'])
</script>

<style scoped>
.module-renderer {
  height: 100%;
}

.module-fade-enter-active,
.module-fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.module-fade-enter-from {
  opacity: 0;
  transform: translateY(8px);
}

.module-fade-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
