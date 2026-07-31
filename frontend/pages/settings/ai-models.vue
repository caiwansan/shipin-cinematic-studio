<!--
  pages/settings/ai-models.vue — AI 模型设置中心
  Sprint-07A.4: 统一入口页，各能力独立打开 ModelSettingsModal

  所有工作台共用的 AI 模型设置入口
-->
<template>
  <div class="page-container">
    <h1 class="page-title">🤖 AI 模型设置</h1>
    <p class="page-desc">为每项 AI 能力配置独立的模型 API Key</p>

    <div class="capability-list">
      <div class="cap-card">
        <div class="cap-info">
          <span class="cap-icon">🎯</span>
          <div>
            <span class="cap-name">AI 职业助理</span>
            <span class="cap-desc">个人求职助手（使用全局语言模型配置）</span>
          </div>
        </div>
        <div class="cap-hint">使用全局模型</div>
      </div>

      <div class="cap-card">
        <div class="cap-info">
          <span class="cap-icon">🎵</span>
          <div>
            <span class="cap-name">音乐创作</span>
            <span class="cap-desc">AI 音乐生成、配乐</span>
          </div>
        </div>
        <ModelSettingsLauncher capability="music" label="音乐" />
      </div>

      <div class="cap-card">
        <div class="cap-info">
          <span class="cap-icon">🧠</span>
          <div>
            <span class="cap-name">通用模型</span>
            <span class="cap-desc">语言、图片、视频、视觉理解</span>
          </div>
        </div>
        <ModelSettingsLauncher capability="llm" label="通用" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import ModelSettingsLauncher from '~/components/ai-model/ModelSettingsLauncher.vue'

definePageMeta({ layout: 'user', middleware: 'auth' })
useHead({ title: 'AI 模型设置 - 昆仑镜' })
</script>

<style scoped>
.page-container {
  max-width: 800px;
  margin: 0 auto;
  padding: 24px;
}

.page-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: #e4e4e7;
  margin: 0 0 8px;
}

.page-desc {
  font-size: 0.85rem;
  color: #71717a;
  margin: 0 0 24px;
}

.capability-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.cap-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 12px;
  transition: background 0.2s;
}

.cap-card:hover {
  background: rgba(255, 255, 255, 0.05);
}

.cap-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.cap-icon {
  font-size: 1.5rem;
}

.cap-name {
  display: block;
  font-size: 0.9rem;
  font-weight: 600;
  color: #e4e4e7;
}

.cap-desc {
  display: block;
  font-size: 0.75rem;
  color: #71717a;
  margin-top: 2px;
}
</style>
