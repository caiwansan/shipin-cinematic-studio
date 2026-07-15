<script setup lang="ts">
// ─── Prompt 预览/编辑面板 ───
// 显示 Stage3 生成的 14 条 GPT-Image-2 提示词
// 支持双击编辑 + 一键复制

import { ref, watch } from 'vue'

const props = defineProps<{
  project: any
  projectId: string
}>()

const emit = defineEmits<{
  (e: 'go-to-generate'): void
}>()

const prompts = ref<any>(null)
const promptsList = ref<any[]>([])
const editing = ref<string | null>(null)
const editText = ref('')
const activeTab = ref<'hero' | 'detail'>('hero')
const saving = ref(false)

// 模块代号展示
const moduleLabels: Record<string, string> = {
  H1: '主图 1 — 白底主图',
  H2: '主图 2 — 卖点副图',
  H3: '主图 3 — 模特展示',
  H4: '主图 4 — 场景主图',
  H5: '主图 5 — 多规格卡',
  D1: '详情 1 — 品牌故事',
  D2: '详情 2 — 痛点场景',
  D3: '详情 3 — 产品核心',
  D4: '详情 4 — 材质细节',
  D5: '详情 5 — 功能展示',
  D6: '详情 6 — 使用步骤',
  D7: '详情 7 — 场景套图',
  D8: '详情 8 — 对比评测',
  D9: '详情 9 — 信任背书',
  M1: '套图 1 — 全身正面',
  M2: '套图 2 — 侧面 45°',
  M3: '套图 3 — 背面',
  M4: '套图 4 — 近景特写',
  M5: '套图 5 — 场景化',
  product_ref: '产品身份证参考图',
  lookbook_ref: '三面参考图',
}

watch(() => props.project, (p) => {
  if (p?.promptJson?.prompts) {
    loadPrompts(p.promptJson.prompts)
  }
}, { immediate: true })

function loadPrompts(raw: any) {
  prompts.value = raw
  const list: any[] = []
  for (const [code, data] of Object.entries(raw)) {
    list.push({
      code,
      label: moduleLabels[code] || code,
      ...(data as any),
    })
  }
  // H 开头的排前面
  list.sort((a, b) => {
    const order = ['H','D','M']
    const ai = order.indexOf(a.code[0])
    const bi = order.indexOf(b.code[0])
    if (ai !== bi) return ai - bi
    return parseInt(a.code.slice(1)) - parseInt(b.code.slice(1))
  })
  promptsList.value = list
}

function getFilteredPrompts() {
  if (activeTab.value === 'hero') {
    return promptsList.value.filter(p => p.code.startsWith('H'))
  } else if (activeTab.value === 'model') {
    return promptsList.value.filter(p => p.code.startsWith('M'))
  }
  return promptsList.value.filter(p => p.code.startsWith('D'))
}

function startEdit(code: string) {
  const p = promptsList.value.find(x => x.code === code)
  if (!p) return
  editing.value = code
  editText.value = p.prompt || ''
}

function cancelEdit() {
  editing.value = null
  editText.value = ''
}

async function saveEdit(code: string) {
  const idx = promptsList.value.findIndex(x => x.code === code)
  if (idx === -1) return
  promptsList.value[idx].prompt = editText.value
  editing.value = null
  
  // 保存回后端
  saving.value = true
  try {
    const token = localStorage.getItem('auth_token')
    // 重建 promptJson
    const newPrompts: any = {}
    for (const p of promptsList.value) {
      newPrompts[p.code] = { ...p }
      delete newPrompts[p.code].label
    }
    await fetch(`/api/ecom/projects/${props.projectId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        promptJson: {
          product: props.project?.promptJson?.product,
          campaign: props.project?.promptJson?.campaign,
          prompts: newPrompts,
        },
      }),
    })
  } catch (e) {
    console.error(e)
  } finally {
    saving.value = false
  }
}

function copyPrompt(code: string) {
  const p = promptsList.value.find(x => x.code === code)
  if (!p?.prompt) return
  navigator.clipboard.writeText(p.prompt).then(() => {
    // 短暂提示
  }).catch(() => {})
}

function copyAll() {
  const texts = getFilteredPrompts().map(p => `=== ${p.label} ===\n${p.prompt}`).join('\n\n')
  navigator.clipboard.writeText(texts).catch(() => {})
}

function getModuleName(code: string): string {
  return moduleLabels[code] || code
}
</script>

<template>
  <div class="prompts-panel">
    <div class="panel-header">
      <div>
        <h2>📝 Prompt 预览</h2>
        <p class="panel-desc">双击 prompt 可编辑，点击复制单条或全部</p>
      </div>
      <div class="panel-actions">
        <button class="btn-outline" @click="copyAll">📋 复制全部</button>
        <button v-if="promptsList.length" class="btn-primary" @click="emit('go-to-generate')">
          🖼️ 去生成 →
        </button>
      </div>
    </div>

    <div v-if="!promptsList.length" class="idle-placeholder">
      <div class="idle-icon">📝</div>
      <p>还没有 Prompt 数据，请先完成产品分析</p>
    </div>

    <template v-else>
      <!-- 分类 tab -->
      <div class="tabs">
        <button
          :class="{ active: activeTab === 'hero' }"
          @click="activeTab = 'hero'"
        >主图 (H1-H5)</button>
        <button
          :class="{ active: activeTab === 'detail' }"
          @click="activeTab = 'detail'"
        >详情图 (D1-D9)</button>
        <button
          v-if="promptsList.some(p => p.code.startsWith('M'))"
          :class="{ active: activeTab === 'modele' }"
          @click="activeTab = 'modele'"
        >模特套图 (M1-M5)</button>
      </div>

      <div class="prompts-list">
        <div
          v-for="p in getFilteredPrompts()"
          :key="p.code"
          class="prompt-card"
        >
          <div class="prompt-header">
            <span class="prompt-code">{{ p.code }}</span>
            <span class="prompt-label">{{ getModuleName(p.code) }}</span>
            <div class="prompt-actions">
              <button class="btn-icon" title="复制" @click="copyPrompt(p.code)">📋</button>
              <button v-if="editing !== p.code" class="btn-icon" title="编辑" @click="startEdit(p.code)">✏️</button>
            </div>
          </div>

          <!-- 编辑模式 -->
          <div v-if="editing === p.code" class="edit-area">
            <textarea v-model="editText" class="edit-textarea" rows="6"></textarea>
            <div class="edit-buttons">
              <button class="btn-save" @click="saveEdit(p.code)">{{ saving ? '保存中...' : '💾 保存' }}</button>
              <button class="btn-cancel" @click="cancelEdit()">取消</button>
            </div>
          </div>

          <!-- 查看模式 -->
          <div v-else class="prompt-body">
            <div class="prompt-text">{{ p.prompt || '（空）' }}</div>
            <div v-if="p.size || p.product_ratio" class="prompt-meta">
              <span v-if="p.size">📐 {{ p.size }}</span>
              <span v-if="p.product_ratio">占比 {{ p.product_ratio }}</span>
              <span v-if="p.whitespace_pct">留白 {{ p.whitespace_pct }}+</span>
              <span v-if="p.angle">📷 {{ p.angle }}</span>
              <span v-if="p.shot_size">景别 {{ p.shot_size }}</span>
            </div>
            <div v-if="p.color_control?.length" class="prompt-colors">
              <span
                v-for="c in p.color_control"
                :key="c"
                class="color-dot"
                :style="{ background: c }"
                :title="c"
              ></span>
              <span class="color-label">{{ (p.color_control || []).join(', ') }}</span>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.prompts-panel h2 {
  font-size: 1.3rem;
  margin-bottom: 8px;
}

.panel-desc {
  color: #6b7280;
  font-size: 0.85rem;
}

.panel-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 16px;
}

.panel-actions {
  display: flex;
  gap: 8px;
}

.btn-outline {
  background: transparent;
  border: 1px solid #2a2f3e;
  color: #9ca3af;
  border-radius: 8px;
  padding: 8px 16px;
  font-size: 0.8rem;
  cursor: pointer;
}

.btn-outline:hover {
  border-color: #C9A86C;
  color: #C9A86C;
}

.btn-primary {
  background: linear-gradient(135deg, #C9A86C, #E2C88A);
  color: #08131F;
  border: none;
  border-radius: 8px;
  padding: 8px 20px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
}

.idle-placeholder {
  text-align: center;
  padding: 60px;
  color: #6b7280;
}

.idle-icon {
  font-size: 3rem;
  margin-bottom: 16px;
}

.tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 16px;
  background: #11151c;
  border-radius: 8px;
  padding: 3px;
}

.tabs button {
  flex: 1;
  background: transparent;
  border: none;
  color: #6b7280;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.8rem;
  transition: all 0.2s;
}

.tabs button.active {
  background: #1f2937;
  color: #f8f6f1;
}

.prompts-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.prompt-card {
  background: #11151c;
  border: 1px solid #1f2937;
  border-radius: 10px;
  overflow: hidden;
}

.prompt-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: #1a1f2e;
  border-bottom: 1px solid #1f2937;
}

.prompt-code {
  font-size: 0.7rem;
  font-weight: 700;
  color: #C9A86C;
  background: rgba(201, 168, 108, 0.1);
  padding: 2px 8px;
  border-radius: 4px;
}

.prompt-label {
  flex: 1;
  font-size: 0.8rem;
  color: #d1d5db;
}

.prompt-actions {
  display: flex;
  gap: 4px;
}

.btn-icon {
  background: transparent;
  border: none;
  color: #6b7280;
  cursor: pointer;
  font-size: 0.85rem;
  padding: 2px 6px;
  border-radius: 4px;
}

.btn-icon:hover {
  background: #1f2937;
  color: #f8f6f1;
}

.prompt-body {
  padding: 12px 14px;
}

.prompt-text {
  font-size: 0.8rem;
  color: #d1d5db;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}

.prompt-meta {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 8px;
  font-size: 0.7rem;
  color: #4b5563;
}

.prompt-colors {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 6px;
}

.color-dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 1px solid #2a2f3e;
  display: inline-block;
}

.color-label {
  font-size: 0.7rem;
  color: #4b5563;
  margin-left: 4px;
}

.edit-area {
  padding: 12px 14px;
}

.edit-textarea {
  width: 100%;
  min-height: 140px;
  background: #0b0f14;
  border: 1px solid #2a2f3e;
  border-radius: 8px;
  color: #f8f6f1;
  padding: 10px;
  font-size: 0.8rem;
  line-height: 1.5;
  resize: vertical;
  font-family: monospace;
}

.edit-textarea:focus {
  border-color: #C9A86C;
  outline: none;
}

.edit-buttons {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.btn-save {
  background: linear-gradient(135deg, #C9A86C, #E2C88A);
  color: #08131F;
  border: none;
  border-radius: 6px;
  padding: 6px 16px;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
}

.btn-cancel {
  background: transparent;
  border: 1px solid #2a2f3e;
  color: #9ca3af;
  border-radius: 6px;
  padding: 6px 16px;
  font-size: 0.8rem;
  cursor: pointer;
}
</style>
