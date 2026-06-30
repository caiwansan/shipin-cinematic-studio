<!-- @deprecated — GEO v3 Legacy. Use design-system product blocks instead. -->
<template>
  <div class="geo-modal-overlay" @click.self="$emit('close')">
    <div class="geo-modal">
      <div class="geo-modal-header">
        <h3>导入关键词</h3>
        <button class="geo-modal-close" @click="$emit('close')">✕</button>
      </div>
      <div class="geo-modal-body">
        <div class="geo-form-group">
          <label class="geo-form-label">粘贴关键词内容（每行一个，或逗号分隔）</label>
          <textarea v-model="importContent" class="geo-input geo-textarea" placeholder="关键词1&#10;关键词2, 关键词3" rows="8"></textarea>
        </div>
        <div class="geo-form-group">
          <label class="geo-form-label">类型</label>
          <select v-model="importType" class="geo-input">
            <option value="brand">品牌词</option>
            <option value="ai">AI词</option>
            <option value="industry">行业词</option>
            <option value="long_tail">长尾词</option>
          </select>
        </div>
      </div>
      <div class="geo-modal-footer">
        <button class="geo-btn geo-btn-ghost" @click="$emit('close')">取消</button>
        <button class="geo-btn geo-btn-primary" @click="$emit('save', { content: importContent, type: importType })" :disabled="saving || !importContent.trim()">
          {{ saving ? '导入中...' : '导入' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

defineProps<{ saving?: boolean }>()
const emit = defineEmits<{ close: []; save: [data: { content: string; type: string }] }>()

const importContent = ref('')
const importType = ref('brand')
</script>

<style scoped>
.geo-modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.geo-modal { background: #1a1a2e; border-radius: 12px; border: 1px solid rgba(255,255,255,0.08); width: 480px; max-width: 90vw; max-height: 85vh; overflow-y: auto; }
.geo-modal-header { display: flex; justify-content: space-between; align-items: center; padding: 18px 20px 0; }
.geo-modal-header h3 { margin: 0; font-size: 16px; font-weight: 700; color: #e0e0e0; }
.geo-modal-close { background: none; border: none; color: #6b7280; font-size: 18px; cursor: pointer; padding: 4px; }
.geo-modal-close:hover { color: #ccc; }
.geo-modal-body { padding: 16px 20px; }
.geo-modal-footer { display: flex; justify-content: flex-end; gap: 8px; padding: 0 20px 18px; }
.geo-form-group { margin-bottom: 14px; }
.geo-form-label { display: block; font-size: 12px; color: #888; margin-bottom: 4px; font-weight: 500; }
.geo-input { width: 100%; padding: 10px 14px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.04); color: #e0e0e0; font-size: 13px; outline: none; box-sizing: border-box; }
.geo-input:focus { border-color: #818cf8; }
.geo-textarea { resize: vertical; min-height: 80px; }
.geo-btn { padding: 8px 20px; border-radius: 6px; border: none; cursor: pointer; font-size: 13px; font-weight: 600; transition: all 0.15s; }
.geo-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.geo-btn-primary { background: linear-gradient(135deg, #818cf8, #6366f1); color: white; }
.geo-btn-primary:hover:not(:disabled) { opacity: 0.9; }
.geo-btn-ghost { background: rgba(255,255,255,0.06); color: #ccc; }
.geo-btn-ghost:hover { background: rgba(255,255,255,0.1); }
</style>
