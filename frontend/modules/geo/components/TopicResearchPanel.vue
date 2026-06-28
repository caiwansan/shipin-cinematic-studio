<template>
  <div class="topic-research-panel">
    <div v-if="!research" class="topic-research-panel__empty">
      <div class="topic-research-panel__placeholder">
        🔍 输入主题开始研究
      </div>
      <div class="topic-research-panel__input-group">
        <input
          v-model="topicInput"
          class="topic-research-panel__input"
          placeholder="输入研究主题..."
          @keyup.enter="handleResearch"
        />
        <button
          class="topic-research-panel__btn"
          :disabled="!topicInput.trim() || loading"
          @click="handleResearch"
        >
          {{ loading ? '研究中...' : '开始研究' }}
        </button>
      </div>
    </div>

    <div v-else class="topic-research-panel__results">
      <h3 class="topic-research-panel__title">{{ research.primaryTopic }}</h3>

      <div v-if="research.secondaryTopics?.length" class="topic-research-panel__section">
        <h4>相关主题</h4>
        <div class="topic-research-panel__tags">
          <span v-for="t in research.secondaryTopics" :key="t" class="topic-research-panel__tag">
            {{ t }}
          </span>
        </div>
      </div>

      <div v-if="research.audience" class="topic-research-panel__section">
        <h4>目标受众</h4>
        <p>{{ research.audience }}</p>
      </div>

      <div v-if="research.keywords?.length" class="topic-research-panel__section">
        <h4>关键词</h4>
        <div class="topic-research-panel__tags">
          <span v-for="kw in research.keywords" :key="kw" class="topic-research-panel__tag topic-research-panel__tag--keyword">
            {{ kw }}
          </span>
        </div>
      </div>

      <div v-if="research.questions?.length" class="topic-research-panel__section">
        <h4>相关问题</h4>
        <ul class="topic-research-panel__questions">
          <li v-for="(q, i) in research.questions" :key="i">{{ q }}</li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { ResearchOutput } from '../types/index'

const props = defineProps<{
  research: ResearchOutput | null
  loading?: boolean
}>()

const emit = defineEmits<{
  research: [topic: string]
}>()

const topicInput = ref('')

function handleResearch() {
  if (topicInput.value.trim() && !props.loading) {
    emit('research', topicInput.value.trim())
  }
}
</script>

<style scoped>
.topic-research-panel {
  padding: 12px;
}

.topic-research-panel__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 32px 0;
}

.topic-research-panel__placeholder {
  font-size: 18px;
  color: #9ca3af;
}

.topic-research-panel__input-group {
  display: flex;
  gap: 8px;
  width: 100%;
  max-width: 400px;
}

.topic-research-panel__input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s;
}

.topic-research-panel__input:focus {
  border-color: #6366f1;
}

.topic-research-panel__btn {
  padding: 8px 16px;
  background: #6366f1;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.2s;
  white-space: nowrap;
}

.topic-research-panel__btn:hover:not(:disabled) {
  background: #4f46e5;
}

.topic-research-panel__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.topic-research-panel__results {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.topic-research-panel__title {
  font-size: 18px;
  font-weight: 600;
  color: #1f2937;
  margin: 0;
}

.topic-research-panel__section h4 {
  font-size: 13px;
  font-weight: 600;
  color: #6b7280;
  margin: 0 0 8px 0;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.topic-research-panel__section p {
  font-size: 14px;
  color: #374151;
  margin: 0;
  line-height: 1.5;
}

.topic-research-panel__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.topic-research-panel__tag {
  padding: 4px 10px;
  background: #f3f4f6;
  border-radius: 16px;
  font-size: 12px;
  color: #374151;
}

.topic-research-panel__tag--keyword {
  background: #eef2ff;
  color: #4338ca;
}

.topic-research-panel__questions {
  margin: 0;
  padding-left: 20px;
}

.topic-research-panel__questions li {
  font-size: 13px;
  color: #6b7280;
  line-height: 1.8;
}
</style>
