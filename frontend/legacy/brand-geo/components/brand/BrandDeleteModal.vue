<!-- @deprecated — GEO v3 Legacy. Use design-system product blocks instead. -->
<template>
  <div class="geo-modal-overlay" @click.self="emit('close')">
    <div class="geo-modal geo-modal-sm">
      <div class="geo-modal-header">
        <h3>确认删除</h3>
        <button class="geo-modal-close" @click="emit('close')">✕</button>
      </div>
      <div class="geo-modal-body">
        <p>确定要删除品牌「{{ brandName }}」吗？此操作不可撤销，关联数据将被保留。</p>
      </div>
      <div class="geo-modal-footer">
        <button class="geo-btn geo-btn-ghost" @click="emit('close')">取消</button>
        <button class="geo-btn geo-btn-danger" @click="emit('confirm')" :disabled="saving">
          {{ saving ? '删除中...' : '确认删除' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  brandName: string
  saving?: boolean
}>()

const emit = defineEmits<{
  close: []
  confirm: []
}>()
</script>

<style scoped>
.geo-modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.geo-modal { background: #1a1a2e; border-radius: 12px; border: 1px solid rgba(255,255,255,0.08); max-width: 90vw; max-height: 85vh; overflow-y: auto; }
.geo-modal-sm { width: 380px; }
.geo-modal-header { display: flex; justify-content: space-between; align-items: center; padding: 18px 20px 0; }
.geo-modal-header h3 { margin: 0; font-size: 16px; font-weight: 700; }
.geo-modal-close { background: none; border: none; color: #6b7280; font-size: 18px; cursor: pointer; padding: 4px; }
.geo-modal-close:hover { color: #ccc; }
.geo-modal-body { padding: 16px 20px; color: #ccc; font-size: 14px; line-height: 1.5; }
.geo-modal-footer { display: flex; justify-content: flex-end; gap: 8px; padding: 0 20px 18px; }
.geo-btn { padding: 8px 20px; border-radius: 6px; border: none; cursor: pointer; font-size: 14px; font-weight: 600; transition: all 0.15s; }
.geo-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.geo-btn-ghost { background: rgba(255,255,255,0.06); color: #ccc; }
.geo-btn-ghost:hover { background: rgba(255,255,255,0.1); }
.geo-btn-danger { background: rgba(239,68,68,0.2); color: #ef4444; }
.geo-btn-danger:hover { background: rgba(239,68,68,0.3); }
</style>
