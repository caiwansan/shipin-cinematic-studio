<script setup lang="ts">
import { getAuthToken } from '~/utils/auth/token'
definePageMeta({ middleware: 'auth' })

import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const projects = ref<any[]>([])
const loading = ref(true)
const showCreate = ref(false)
const newProjectName = ref('')
const creating = ref(false)

async function loadProjects() {
  loading.value = true
  try {
    const token = getAuthToken()
    const res = await fetch('/api/ecom/projects', {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) {
      const data = await res.json()
      projects.value = data.data || []
    }
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

async function createProject() {
  if (!newProjectName.value.trim()) return
  creating.value = true
  try {
    const token = getAuthToken()
    const res = await fetch('/api/ecom/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ skuName: newProjectName.value.trim() }),
    })
    if (res.ok) {
      const data = await res.json()
      showCreate.value = false
      newProjectName.value = ''
      router.push(`/workspace/ecom-image/workbench/${data.data.id}`)
    }
  } catch (e) {
    console.error(e)
  } finally {
    creating.value = false
  }
}

function goToWorkbench(id: string) {
  router.push(`/workspace/ecom-image/workbench/${id}`)
}

const statusLabels: Record<string, string> = {
  draft: '草稿',
  analyzing: '分析中',
  prompts: '已生成提示词',
  generating: '生成图片中',
  done: '已完成',
  error: '出错',
}

onMounted(loadProjects)
</script>

<template>
  <div class="ecom-list-page">
    <div class="ecom-list-header">
      <h1>🖼️ 电商图片</h1>
      <button class="btn-create" @click="showCreate = true">+ 新建项目</button>
    </div>

    <!-- 新建弹窗 -->
    <div v-if="showCreate" class="modal-overlay" @click.self="showCreate = false">
      <div class="modal-card">
        <h3>新建电商图片项目</h3>
        <input
          v-model="newProjectName"
          placeholder="输入 SKU 名称 / 产品名"
          class="input-field"
          @keyup.enter="createProject"
        />
        <div class="modal-actions">
          <button class="btn-cancel" @click="showCreate = false">取消</button>
          <button class="btn-primary" :disabled="!newProjectName.trim() || creating" @click="createProject">
            {{ creating ? '创建中...' : '创建' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 项目列表 -->
    <div v-if="loading" class="ecom-loading">加载中...</div>
    <div v-else-if="projects.length === 0" class="ecom-empty">
      <div class="empty-icon">🖼️</div>
      <p>还没有项目，开始创建你的第一个电商图片吧</p>
    </div>
    <div v-else class="ecom-project-grid">
      <div
        v-for="p in projects"
        :key="p.id"
        class="ecom-project-card"
        @click="goToWorkbench(p.id)"
      >
        <div class="card-header">
          <span class="card-name">{{ p.skuName || '未命名' }}</span>
          <span class="card-status">{{ statusLabels[p.status] || p.status }}</span>
        </div>
        <div class="card-body">
          <div class="card-field">
            <span class="field-label">类目</span>
            <span class="field-val">{{ p.category || '-' }}</span>
          </div>
          <div class="card-field">
            <span class="field-label">风格</span>
            <span class="field-val">{{ p.style || '-' }}</span>
          </div>
        </div>
        <div class="card-footer">
          {{ new Date(p.createdAt).toLocaleDateString('zh-CN') }}
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ecom-list-page {
  max-width: 1000px;
  margin: 0 auto;
  padding: 40px 24px;
  min-height: 100vh;
  background: #0b0f14;
  color: #f8f6f1;
}

.ecom-list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 32px;
}

.ecom-list-header h1 {
  font-size: 1.6rem;
  font-weight: 600;
}

.btn-create {
  background: linear-gradient(135deg, #C9A86C, #E2C88A);
  color: #08131F;
  border: none;
  border-radius: 8px;
  padding: 10px 24px;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: box-shadow 0.3s;
}
.btn-create:hover {
  box-shadow: 0 4px 16px rgba(201, 168, 108, 0.25);
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
}

.modal-card {
  background: #1a1f2e;
  border: 1px solid #2a2f3e;
  border-radius: 12px;
  padding: 32px;
  width: 400px;
  max-width: 90vw;
}

.modal-card h3 {
  margin-bottom: 16px;
  font-size: 1.1rem;
}

.input-field {
  width: 100%;
  padding: 10px 14px;
  background: #11151c;
  border: 1px solid #2a2f3e;
  border-radius: 8px;
  color: #f8f6f1;
  font-size: 0.9rem;
  outline: none;
  box-sizing: border-box;
}
.input-field:focus {
  border-color: #C9A86C;
}

.modal-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  margin-top: 20px;
}

.btn-cancel {
  background: transparent;
  border: 1px solid #2a2f3e;
  color: #a0a0a0;
  border-radius: 8px;
  padding: 8px 20px;
  cursor: pointer;
}

.btn-primary {
  background: linear-gradient(135deg, #C9A86C, #E2C88A);
  color: #08131F;
  border: none;
  border-radius: 8px;
  padding: 8px 20px;
  font-weight: 600;
  cursor: pointer;
}
.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.ecom-loading, .ecom-empty {
  text-align: center;
  padding: 80px 0;
  color: #6b7280;
}

.empty-icon {
  font-size: 3rem;
  margin-bottom: 16px;
}

.ecom-project-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

.ecom-project-card {
  background: #11151c;
  border: 1px solid #1f2937;
  border-radius: 12px;
  padding: 20px;
  cursor: pointer;
  transition: all 0.3s;
}
.ecom-project-card:hover {
  border-color: #C9A86C;
  background: #161b26;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.card-name {
  font-weight: 600;
  font-size: 1rem;
}

.card-status {
  font-size: 0.75rem;
  padding: 2px 8px;
  background: #1f2937;
  border-radius: 4px;
  color: #9ca3af;
}

.card-body {
  margin-bottom: 12px;
}

.card-field {
  display: flex;
  gap: 8px;
  font-size: 0.82rem;
  margin-bottom: 4px;
}

.field-label {
  color: #6b7280;
}

.field-val {
  color: #d1d5db;
}

.card-footer {
  font-size: 0.75rem;
  color: #4b5563;
}
</style>
