<template>
  <div class="geo-stub-panel">
    <div class="geo-stub-banner">
      ℹ️ 品牌资料已整合到 System Metadata
    </div>
    <div class="geo-stub-body">
      <div class="geo-stub-icon">🔀</div>
      <h3 class="geo-stub-title">正在跳转到 Execution Studio…</h3>
      <p class="geo-stub-desc">
        品牌资料功能已整合到 Execution Studio 的 System Metadata 面板。
        3 秒后自动跳转，或点击下方按钮手动跳转。
      </p>
      <button class="geo-stub-btn" @click="goToExecutionStudio">
        前往 Execution Studio
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useBrandGeoStore } from '~/studio-v2/workspace/brand-geo/stores/useBrandGeoStore'

const store = useBrandGeoStore()

function goToExecutionStudio() {
  // Navigate via sidebar panel
  const parent = (store as any).setActivePanel
  if (parent) {
    ;(store as any).setActivePanel('execution-studio')
  }
}

onMounted(() => {
  setTimeout(goToExecutionStudio, 3000)
})
</script>

<style scoped>
.geo-stub-panel { padding: 24px; max-width: 600px; margin: 0 auto; }
.geo-stub-banner {
  padding: 8px 14px; border-radius: 6px;
  background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.2);
  color: #93c5fd; font-size: 12px; font-weight: 600; text-align: center;
  margin-bottom: 24px;
}
.geo-stub-body { text-align: center; padding: 48px 24px; }
.geo-stub-icon { font-size: 48px; margin-bottom: 16px; opacity: 0.3; }
.geo-stub-title { font-size: 22px; font-weight: 700; color: #e2e8f0; margin: 0 0 12px; }
.geo-stub-desc { font-size: 14px; color: #94a3b8; line-height: 1.6; max-width: 400px; margin: 0 auto 20px; }
.geo-stub-btn {
  padding: 8px 20px; border-radius: 6px; font-size: 14px; font-weight: 600;
  background: #3b82f6; color: #fff; border: none; cursor: pointer;
}
.geo-stub-btn:hover { background: #2563eb; }
</style>
