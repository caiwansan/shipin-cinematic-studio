<!-- KnowledgeImportModal.vue — 批量导入知识对象弹窗 -->
<template>
  <Dialog
    :open="open"
    title="导入知识"
    size="lg"
    @update:open="$emit('close')"
    @close="$emit('close')"
  >
    <div class="kim-body">
      <p class="kim-desc">批量导入知识条目。每行一条，格式：<code>主题 | 描述内容</code></p>

      <div class="kim-field">
        <label class="kim-label">知识条目（每行一个）</label>
        <textarea
          v-model="rawText"
          class="kim-textarea"
          rows="8"
          placeholder="品牌介绍 | 昆仑镜是一款AI短剧生成系统，面向短视频创作市场&#10;官网信息 | 品牌官网位于 aigc.fushtn.com&#10;技术说明 | 基于大语言模型和自有剧本引擎"
        ></textarea>
      </div>

      <div v-if="preview.length > 0" class="kim-preview">
        <div class="kim-preview-title">预览（{{ preview.length }} 条）</div>
        <div class="kim-preview-list">
          <div v-for="(item, i) in preview" :key="i" class="kim-preview-item">
            <span class="kim-preview-idx">{{ i + 1 }}.</span>
            <span class="kim-preview-topic">{{ item.topic }}</span>
            <span v-if="item.content" class="kim-preview-content">— {{ item.content }}</span>
          </div>
        </div>
      </div>

      <div v-if="result" class="kim-result">
        <template v-if="result.success">
          <div class="kim-result-success">✅ 成功导入 {{ result.created }} 条知识</div>
          <div v-if="result.failed > 0" class="kim-result-warn">⚠️ {{ result.failed }} 条导入失败</div>
        </template>
        <template v-else>
          <div class="kim-result-error">❌ 导入失败：{{ result.error }}</div>
        </template>
      </div>

      <div v-if="error" class="kim-error">{{ error }}</div>
    </div>

    <template #footer>
      <button class="kim-btn kim-btn--cancel" @click="handleClose">关闭</button>
      <button
        class="kim-btn kim-btn--primary"
        :disabled="submitting || preview.length === 0"
        @click="handleImport"
      >
        {{ submitting ? '导入中...' : `导入 ${preview.length} 条` }}
      </button>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useAuthStore } from '~/stores/auth'
import { getToken as getCachedToken } from '~/utils/token-cache'
import Dialog from '~/design-system/primitives/Dialog/index.vue'

const props = defineProps<{
  open: boolean
  projectId: string
}>()

const emit = defineEmits<{
  close: []
  imported: [count: number]
}>()

const rawText = ref('')
const submitting = ref(false)
const error = ref('')
const result = ref<{ success: boolean; created?: number; failed?: number; error?: string } | null>(null)

const preview = computed(() => {
  return rawText.value
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .map(line => {
      const sep = line.indexOf('|')
      if (sep > 0) {
        return {
          topic: line.substring(0, sep).trim(),
          content: line.substring(sep + 1).trim(),
        }
      }
      return { topic: line, content: '' }
    })
})

async function handleImport() {
  if (preview.value.length === 0) return
  submitting.value = true
  error.value = ''
  result.value = null

  try {
    const token = getToken()
    const items = preview.value.map((p, i) => ({
      topic: p.topic,
      claims: p.content
        ? [{ id: `claim-${Date.now()}-${i}`, statement: p.content, entityId: '' }]
        : [],
    }))

    const res = await fetch('/api/geo/knowledge/import', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        projectId: props.projectId,
        items,
      }),
    })

    const json = await res.json()
    if (!json.success) {
      result.value = { success: false, error: json.error || '导入失败' }
      return
    }

    result.value = { success: true, created: json.data.created, failed: json.data.failed }
    emit('imported', json.data.created)
  } catch (err: any) {
    error.value = err.message || '网络错误'
  } finally {
    submitting.value = false
  }
}

function handleClose() {
  rawText.value = ''
  result.value = null
  emit('close')
}

function getToken(): string {
  try { return getCachedToken() } catch {}
  try {
    const auth = useAuthStore()
    const token = auth.getToken()
    if (token) return token
  } catch {}
  return ''
}
</script>

<style scoped>
.kim-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.kim-desc {
  font-size: 13px;
  color: #6b7280;
  line-height: 1.5;
  margin: 0;
}

.kim-desc code {
  background: #f3f4f6;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 12px;
  color: #374151;
}

.kim-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.kim-label {
  font-size: 13px;
  font-weight: 600;
  color: #374151;
}

.kim-textarea {
  padding: 10px 12px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 14px;
  font-family: 'SF Mono', 'Monaco', 'Menlo', monospace;
  color: #111;
  background: #fff;
  resize: vertical;
  min-height: 120px;
  line-height: 1.6;
}

.kim-textarea:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59,130,246,0.1);
}

.kim-preview {
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 12px;
  max-height: 200px;
  overflow-y: auto;
}

.kim-preview-title {
  font-size: 12px;
  font-weight: 600;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 8px;
}

.kim-preview-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.kim-preview-item {
  font-size: 13px;
  color: #374151;
  line-height: 1.4;
}

.kim-preview-idx {
  color: #9ca3af;
  margin-right: 4px;
}

.kim-preview-topic {
  font-weight: 500;
}

.kim-preview-content {
  color: #6b7280;
}

.kim-result {
  padding: 12px;
  border-radius: 8px;
  font-size: 14px;
}

.kim-result-success {
  color: #059669;
  font-weight: 500;
}

.kim-result-warn {
  color: #d97706;
  margin-top: 4px;
}

.kim-result-error {
  color: #dc2626;
}

.kim-error {
  color: #ef4444;
  font-size: 13px;
  padding: 8px 12px;
  background: #fef2f2;
  border-radius: 6px;
}

.kim-btn {
  display: inline-flex;
  align-items: center;
  padding: 8px 20px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid transparent;
  transition: background 0.15s;
}

.kim-btn--primary {
  background: #3b82f6;
  color: #fff;
  border-color: #3b82f6;
}

.kim-btn--primary:hover:not(:disabled) {
  background: #2563eb;
}

.kim-btn--primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.kim-btn--cancel {
  background: #fff;
  color: #374151;
  border-color: #d1d5db;
}

.kim-btn--cancel:hover {
  background: #f9fafb;
}
</style>
