<template>
  <div class="geo-modal-overlay" @click.self="emit('close')">
    <div class="geo-modal">
      <div class="geo-modal-header">
        <h3>{{ isEdit ? '编辑品牌' : '创建品牌' }}</h3>
        <button class="geo-modal-close" @click="emit('close')">✕</button>
      </div>
      <div class="geo-modal-body">
        <div class="geo-form-group">
          <label class="geo-form-label">品牌名称 *</label>
          <input v-model="form.name" class="geo-input" placeholder="输入品牌名称" />
        </div>
        <div class="geo-form-group">
          <label class="geo-form-label">官网地址</label>
          <input v-model="form.website" class="geo-input" placeholder="https://example.com" />
        </div>
        <div class="geo-form-row">
          <div class="geo-form-group">
            <label class="geo-form-label">行业</label>
            <input v-model="form.industry" class="geo-input" placeholder="如：科技、教育" />
          </div>
          <div class="geo-form-group">
            <label class="geo-form-label">地区</label>
            <input v-model="form.region" class="geo-input" placeholder="如：中国、全球" />
          </div>
        </div>
        <div class="geo-form-group">
          <label class="geo-form-label">语言</label>
          <select v-model="form.language" class="geo-input">
            <option value="zh">中文</option>
            <option value="en">English</option>
            <option value="ja">日本語</option>
            <option value="ko">한국어</option>
          </select>
        </div>
        <div class="geo-form-group">
          <label class="geo-form-label">品牌描述</label>
          <textarea v-model="form.description" class="geo-input geo-textarea" placeholder="品牌简介、核心业务等" rows="3"></textarea>
        </div>
      </div>
      <div class="geo-modal-footer">
        <button class="geo-btn geo-btn-ghost" @click="emit('close')">取消</button>
        <button class="geo-btn geo-btn-primary" @click="emit('save', { ...form })" :disabled="saving || !form.name">
          {{ saving ? '保存中...' : '保存' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, onMounted } from 'vue'

export interface BrandForm {
  name: string
  website: string
  industry: string
  region: string
  language: string
  description: string
}

const props = defineProps<{
  isEdit?: boolean
  initial?: Partial<BrandForm>
  saving?: boolean
}>()

const emit = defineEmits<{
  close: []
  save: [form: BrandForm]
}>()

const form = reactive<BrandForm>({
  name: '',
  website: '',
  industry: '',
  region: '',
  language: 'zh',
  description: '',
})

onMounted(() => {
  if (props.initial) {
    Object.assign(form, {
      name: props.initial.name || '',
      website: props.initial.website || '',
      industry: props.initial.industry || '',
      region: props.initial.region || '',
      language: props.initial.language || 'zh',
      description: props.initial.description || '',
    })
  }
})
</script>

<style scoped>
.geo-modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.geo-modal { background: #1a1a2e; border-radius: 12px; border: 1px solid rgba(255,255,255,0.08); width: 480px; max-width: 90vw; max-height: 85vh; overflow-y: auto; }
.geo-modal-header { display: flex; justify-content: space-between; align-items: center; padding: 18px 20px 0; }
.geo-modal-header h3 { margin: 0; font-size: 16px; font-weight: 700; }
.geo-modal-close { background: none; border: none; color: #6b7280; font-size: 18px; cursor: pointer; padding: 4px; }
.geo-modal-close:hover { color: #ccc; }
.geo-modal-body { padding: 16px 20px; }
.geo-modal-footer { display: flex; justify-content: flex-end; gap: 8px; padding: 0 20px 18px; }
.geo-form-group { margin-bottom: 14px; }
.geo-form-label { display: block; font-size: 12px; color: #888; margin-bottom: 4px; font-weight: 500; }
.geo-form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.geo-form-row .geo-form-group { margin-bottom: 0; }
.geo-input { width: 100%; padding: 10px 14px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.04); color: #e0e0e0; font-size: 13px; outline: none; transition: border-color 0.15s; box-sizing: border-box; }
.geo-input:focus { border-color: #818cf8; }
.geo-textarea { resize: vertical; min-height: 60px; }
.geo-btn { padding: 8px 20px; border-radius: 6px; border: none; cursor: pointer; font-size: 14px; font-weight: 600; transition: all 0.15s; }
.geo-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.geo-btn-primary { background: linear-gradient(135deg, #818cf8, #6366f1); color: white; }
.geo-btn-primary:hover:not(:disabled) { opacity: 0.9; }
.geo-btn-ghost { background: rgba(255,255,255,0.06); color: #ccc; }
.geo-btn-ghost:hover { background: rgba(255,255,255,0.1); }
</style>
