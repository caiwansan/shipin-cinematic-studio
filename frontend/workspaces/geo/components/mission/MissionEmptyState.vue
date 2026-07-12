<!--
MissionEmptyState.vue — Empty State for Mission Workspace

Displayed when there are no missions to process.
Product-oriented copy, not a technical "No Data" message.
-->
<template>
  <div class="mes">
    <div class="mes__icon">🎯</div>
    <p class="mes__title">当前没有需要处理的优化任务。</p>
    <p class="mes__description">
      你可以尝试重新分析你的项目，查看是否有新的优化建议可用。
    </p>
  </div>
</template>

<style scoped>
.mes {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 64px 24px;
  min-height: 320px;
}

.mes__icon {
  font-size: 48px;
  line-height: 1;
  margin-bottom: 16px;
}

.mes__title {
  font-size: 18px;
  font-weight: 700;
  color: #111827;
  margin: 0 0 8px;
  line-height: 1.4;
}

.mes__description {
  font-size: 14px;
  color: #6b7280;
  margin: 0;
  line-height: 1.6;
  max-width: 400px;
}
</style>
