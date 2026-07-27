<!--
  ModelSettingsLauncher.vue — 统一模型设置按钮入口
  Sprint-07A.4: 所有工作台复用此入口打开 ModelSettingsModal

  职责：仅按钮入口，不实现配置逻辑
  使用：<ModelSettingsLauncher capability="careeragent" />

  capability 映射：
    careeragent → AI 职业助理
    hdz         → 短剧工作台
    ppt         → PPT 生成
    music       → 音乐创作
    novel       → 小说创作
-->
<template>
  <button class="ms-launcher" @click="showModal = true" :title="`配置 ${label} 模型`">
    <slot>⚙️ 模型设置</slot>
  </button>
  <ModelSettingsModal
    :visible="showModal"
    @close="showModal = false"
    :filterCapability="capability"
  />
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import ModelSettingsModal from '~/components/director/ModelSettingsModal.vue'

const props = defineProps<{
  capability: string
  label?: string
}>()

const showModal = ref(false)

const label = computed(() => {
  if (props.label) return props.label
  const map: Record<string, string> = {
    career_agent: 'AI 职业助理',
    hdz: '短剧工作台',
    ppt: 'PPT 生成',
    music: '音乐创作',
    novel: '小说创作',
    llm: '语言模型',
    image: '图片模型',
    video: '视频模型',
    tts: '语音模型',
  }
  return map[props.capability] || props.capability
})
</script>

<style scoped>
.ms-launcher {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.6);
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  font-family: inherit;
}

.ms-launcher:hover {
  color: rgba(255, 255, 255, 0.9);
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.2);
}
</style>
