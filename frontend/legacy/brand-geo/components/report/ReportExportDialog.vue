<!-- @deprecated — GEO v3 Legacy. Use design-system product blocks instead. -->
<template>
  <div v-if="visible" class="geo-dialog-overlay" @click.self="$emit('close')">
    <div class="geo-dialog">
      <div class="geo-dialog-header">
        <h3 class="geo-dialog-title">导出报告</h3>
        <button class="geo-dialog-close" @click="$emit('close')">✕</button>
      </div>
      <div class="geo-dialog-body">
        <div class="geo-dialog-section">
          <h4 class="geo-dialog-section-title">报告名称</h4>
          <input v-model="exportTitle" class="geo-input" placeholder="输入报告名称" />
        </div>
        <div class="geo-dialog-section">
          <h4 class="geo-dialog-section-title">导出格式</h4>
          <div class="geo-format-options">
            <label
              v-for="fmt in formats"
              :key="fmt.value"
              :class="['geo-format-option', { 'geo-format-option--active': format === fmt.value }]"
            >
              <input type="radio" v-model="format" :value="fmt.value" class="geo-radio-hidden" />
              <span class="geo-format-icon">{{ fmt.icon }}</span>
              <span class="geo-format-label">{{ fmt.label }}</span>
              <span class="geo-format-desc">{{ fmt.desc }}</span>
            </label>
          </div>
        </div>
      </div>
      <div class="geo-dialog-footer">
        <button class="geo-btn geo-btn-ghost" @click="$emit('close')">取消</button>
        <button class="geo-btn geo-btn-primary" @click="onExport" :disabled="exporting">
          {{ exporting ? '导出中...' : '导出' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

defineProps<{
  visible: boolean
  reportTitle?: string
}>()

const emit = defineEmits<{
  close: []
  export: [{ title: string; format: string }]
}>()

const exportTitle = ref('')
const format = ref('markdown')
const exporting = ref(false)

const formats = [
  { value: 'markdown', icon: '📝', label: 'Markdown', desc: '.md — 适合文本编辑' },
  { value: 'html', icon: '🌐', label: 'HTML', desc: '.html — 适合浏览器查看' },
  { value: 'pdf', icon: '📄', label: 'PDF', desc: '.pdf — 适合打印分享（即将支持）' },
]

async function onExport() {
  exporting.value = true
  emit('export', { title: exportTitle.value || '报告', format: format.value })
  setTimeout(() => {
    exporting.value = false
    emit('close')
  }, 500)
}
</script>

<style scoped>
.geo-dialog-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.6);
  display: flex; align-items: center; justify-content: center;
  z-index: 1000;
}
.geo-dialog {
  background: var(--geo-bg-surface);
  border: 1px solid var(--geo-border-strong);
  border-radius: var(--geo-radius-xl);
  width: 440px; max-width: 90vw;
  box-shadow: 0 20px 60px rgba(0,0,0,0.4);
}
.geo-dialog-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 20px; border-bottom: 1px solid var(--geo-border);
}
.geo-dialog-title { font-size: 16px; font-weight: 700; color: var(--geo-text); margin: 0; }
.geo-dialog-close { background: none; border: none; color: var(--geo-text-dim); cursor: pointer; font-size: 16px; padding: 4px; }
.geo-dialog-close:hover { color: var(--geo-text); }
.geo-dialog-body { padding: 20px; display: flex; flex-direction: column; gap: 16px; }
.geo-dialog-section { }
.geo-dialog-section-title { font-size: 13px; font-weight: 600; color: var(--geo-text); margin: 0 0 8px; }
.geo-input { width: 100%; padding: 8px 12px; border-radius: var(--geo-radius-md); border: 1px solid var(--geo-border); background: var(--geo-bg); color: var(--geo-text); font-size: 13px; outline: none; box-sizing: border-box; }
.geo-input:focus { border-color: var(--geo-accent); }
.geo-format-options { display: flex; flex-direction: column; gap: 8px; }
.geo-format-option {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 14px;
  border: 1px solid var(--geo-border);
  border-radius: var(--geo-radius-md);
  cursor: pointer;
  transition: border-color 0.15s;
}
.geo-format-option:hover, .geo-format-option--active { border-color: var(--geo-accent); background: var(--geo-bg-hover); }
.geo-radio-hidden { display: none; }
.geo-format-icon { font-size: 18px; }
.geo-format-label { font-size: 13px; font-weight: 600; color: var(--geo-text); min-width: 80px; }
.geo-format-desc { font-size: 11px; color: var(--geo-text-dim); }
.geo-dialog-footer {
  display: flex; justify-content: flex-end; gap: 8px;
  padding: 14px 20px; border-top: 1px solid var(--geo-border);
}
.geo-btn { border-radius: var(--geo-radius-md); border: none; cursor: pointer; font-size: 13px; font-weight: 600; padding: 8px 16px; transition: all 0.15s; }
.geo-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.geo-btn-primary { background: var(--geo-accent); color: #fff; }
.geo-btn-primary:hover:not(:disabled) { opacity: 0.9; }
.geo-btn-ghost { background: var(--geo-bg-hover); color: var(--geo-text-secondary); }
.geo-btn-ghost:hover { background: var(--geo-border); }
</style>
