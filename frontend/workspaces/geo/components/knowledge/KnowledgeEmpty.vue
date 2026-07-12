<!-- KnowledgeEmpty.vue — 无知识数据时的 Empty State -->
<template>
  <section class="geo-knowledge-empty">
    <div class="geo-knowledge-empty__card">
      <div class="geo-knowledge-empty__icon">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.5" stroke-linecap="round">
          <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
          <path d="M8 7h8M8 11h6" />
        </svg>
      </div>
      <h2 class="geo-knowledge-empty__title">还没有品牌知识</h2>
      <p class="geo-knowledge-empty__desc">
        该品牌尚未建立知识库。导入已有数据或创建新知识对象开始构建 AI 可读的品牌知识资产。
      </p>
      <div class="geo-knowledge-empty__actions">
        <button
          class="geo-knowledge-empty__btn geo-knowledge-empty__btn--primary"
          @click="$emit('import')"
        >导入知识</button>
        <button
          class="geo-knowledge-empty__btn"
          @click="$emit('create')"
        >创建知识</button>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { KnowledgeVM } from '../../viewmodels/KnowledgeViewModel'

defineProps<{ vm: KnowledgeVM }>()
defineEmits<{ import: []; create: [] }>()
</script>

<style scoped>
.geo-knowledge-empty {
  display: flex;
  justify-content: center;
  padding: 60px 0;
}

.geo-knowledge-empty__card {
  text-align: center;
  max-width: 460px;
  padding: 48px;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
}

.geo-knowledge-empty__icon {
  margin-bottom: 12px;
  opacity: 0.5;
}

.geo-knowledge-empty__title {
  font-size: 20px;
  font-weight: 700;
  color: #1a1a2e;
  margin: 0 0 8px;
}

.geo-knowledge-empty__desc {
  font-size: 14px;
  color: #64748b;
  line-height: 1.6;
  margin: 0 0 24px;
}

.geo-knowledge-empty__actions {
  display: flex;
  gap: 12px;
  justify-content: center;
}

.geo-knowledge-empty__btn {
  display: inline-flex;
  align-items: center;
  padding: 10px 24px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  text-decoration: none;
  border: 1px solid #e2e8f0;
  color: #1a1a2e;
  background: #fff;
  cursor: pointer;
  transition: background .15s, border-color .15s;
}

.geo-knowledge-empty__btn:hover {
  background: #f8fafc;
  border-color: #3b82f6;
}

.geo-knowledge-empty__btn--primary {
  background: #3b82f6;
  color: #fff;
  border-color: #3b82f6;
}

.geo-knowledge-empty__btn--primary:hover {
  background: #2563eb;
}
</style>
