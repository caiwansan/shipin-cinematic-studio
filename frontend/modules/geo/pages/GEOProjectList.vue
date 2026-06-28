<template>
  <div class="geo-project-list">
    <div class="geo-project-list__header">
      <h2 class="geo-project-list__title">GEO 项目</h2>
      <button class="geo-project-list__create-btn" @click="showCreateDialog = true">
        + 新建项目
      </button>
    </div>

    <!-- Create Project Dialog -->
    <div v-if="showCreateDialog" class="geo-project-list__overlay" @click.self="showCreateDialog = false">
      <div class="geo-project-list__dialog">
        <h3>新建 GEO 项目</h3>
        <div class="geo-project-list__form">
          <div class="geo-project-list__field">
            <label>项目名称 *</label>
            <input v-model="form.name" placeholder="输入项目名称" />
          </div>
          <div class="geo-project-list__field">
            <label>研究主题</label>
            <input v-model="form.topic" placeholder="输入研究主题（可选）" />
          </div>
          <div class="geo-project-list__field">
            <label>行业</label>
            <input v-model="form.industry" placeholder="如：科技、教育、医疗" />
          </div>
          <div class="geo-project-list__field">
            <label>语言</label>
            <select v-model="form.language">
              <option value="zh">中文</option>
              <option value="en">English</option>
              <option value="ja">日本語</option>
            </select>
          </div>
        </div>
        <div class="geo-project-list__dialog-actions">
          <button class="geo-project-list__cancel-btn" @click="showCreateDialog = false">取消</button>
          <button class="geo-project-list__submit-btn" :disabled="!form.name.trim() || loading" @click="handleCreate">
            {{ loading ? '创建中...' : '创建' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading && projects.length === 0" class="geo-project-list__loading">
      加载中...
    </div>

    <!-- Error -->
    <div v-if="error" class="geo-project-list__error">
      {{ error }}
    </div>

    <!-- Project Grid -->
    <div v-else-if="projects.length > 0" class="geo-project-list__grid">
      <GEOProjectCard
        v-for="project in projects"
        :key="project.id"
        :project="project"
        @click="handleOpenProject(project.id)"
      />
    </div>

    <!-- Empty State -->
    <div v-else class="geo-project-list__empty">
      <div class="geo-project-list__empty-icon">📋</div>
      <p>暂无 GEO 项目</p>
      <p class="geo-project-list__empty-hint">点击「新建项目」开始知识图谱分析</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useGEOStore } from '../store/useGEOStore'
import GEOProjectCard from '../components/GEOProjectCard.vue'

const router = useRouter()
const store = useGEOStore()

const showCreateDialog = ref(false)
const loading = ref(false)
const form = ref({
  name: '',
  topic: '',
  industry: '',
  language: 'zh',
})

onMounted(async () => {
  // Use a default tenant ID — in real app this comes from auth
  const tenantId = 'default-tenant'
  await store.loadProjects(tenantId)
})

const projects = computed(() => store.projects)
const error = computed(() => store.error)

import { computed } from 'vue'

async function handleCreate() {
  if (!form.value.name.trim()) return
  loading.value = true
  try {
    const project = await store.createProject({
      name: form.value.name,
      topic: form.value.topic || undefined,
      industry: form.value.industry || undefined,
      language: form.value.language,
    })
    if (project) {
      showCreateDialog.value = false
      form.value = { name: '', topic: '', industry: '', language: 'zh' }
    }
  } finally {
    loading.value = false
  }
}

function handleOpenProject(id: string) {
  router.push(`/geo/workspace/${id}`)
}
</script>

<style scoped>
.geo-project-list {
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px;
}

.geo-project-list__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.geo-project-list__title {
  font-size: 24px;
  font-weight: 700;
  color: #1f2937;
  margin: 0;
}

.geo-project-list__create-btn {
  padding: 10px 20px;
  background: #6366f1;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
}

.geo-project-list__create-btn:hover {
  background: #4f46e5;
}

.geo-project-list__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
}

.geo-project-list__loading,
.geo-project-list__empty {
  text-align: center;
  padding: 64px 0;
  color: #9ca3af;
}

.geo-project-list__empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.geo-project-list__empty-hint {
  font-size: 13px;
  color: #d1d5db;
}

.geo-project-list__error {
  text-align: center;
  padding: 16px;
  color: #dc2626;
  background: #fef2f2;
  border-radius: 8px;
  margin-bottom: 16px;
}

/* Dialog */
.geo-project-list__overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.geo-project-list__dialog {
  background: #fff;
  border-radius: 12px;
  padding: 24px;
  width: 480px;
  max-width: 90vw;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
}

.geo-project-list__dialog h3 {
  font-size: 18px;
  font-weight: 600;
  margin: 0 0 20px 0;
  color: #1f2937;
}

.geo-project-list__form {
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin-bottom: 20px;
}

.geo-project-list__field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.geo-project-list__field label {
  font-size: 13px;
  font-weight: 500;
  color: #374151;
}

.geo-project-list__field input,
.geo-project-list__field select {
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
  outline: none;
}

.geo-project-list__field input:focus,
.geo-project-list__field select:focus {
  border-color: #6366f1;
}

.geo-project-list__dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.geo-project-list__cancel-btn {
  padding: 8px 16px;
  background: #f3f4f6;
  color: #374151;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
}

.geo-project-list__submit-btn {
  padding: 8px 16px;
  background: #6366f1;
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
}

.geo-project-list__submit-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
