<template>
  <div v-if="!hasError" class="scene-boundary">
    <slot />
  </div>
  <div v-else class="scene-boundary scene-boundary--error" :style="{ minHeight: minHeight || 'auto' }">
    <!-- 场景崩溃时静默降级：不影响页面其他部分 -->
  </div>
</template>

<script setup lang="ts">
import { ref, onErrorCaptured, provide } from 'vue'

const props = withDefaults(defineProps<{
  name?: string
  minHeight?: string
}>(), {
  name: 'Scene',
  minHeight: '0',
})

const hasError = ref(false)

onErrorCaptured((err: Error) => {
  console.error(`[SceneErrorBoundary] ${props.name} crashed:`, err)
  hasError.value = true
  // 阻止继续冒泡，避免污染其他 Scene
  return false
})

provide('sceneHasError', hasError)
</script>

<style scoped>
.scene-boundary {
  position: relative;
}
.scene-boundary--error {
  background: transparent;
}
</style>
