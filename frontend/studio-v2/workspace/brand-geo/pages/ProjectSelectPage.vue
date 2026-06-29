<template>
  <div class="geo-project-select">
    <div class="geo-panel-header">
      <h3 class="geo-panel-title">📁 选择项目</h3>
      <p class="geo-panel-subtitle">选择已有项目，或创建新项目开始 Brand GEO 优化。</p>
    </div>

    <!-- Project list -->
    <div class="geo-project-list">
      <div
        v-for="project in projects"
        :key="project.id"
        class="geo-project-card"
        :class="{ selected: project.id === selectedId }"
        @click="selectProject(project.id)"
      >
        <div class="geo-project-icon">📦</div>
        <div class="geo-project-body">
          <span class="geo-project-name">{{ project.name }}</span>
          <span v-if="project.website" class="geo-project-url">{{ project.website }}</span>
          <span class="geo-project-meta">
            {{ project.industry || '—' }} · {{ project.status }}
          </span>
        </div>
        <div class="geo-project-date">
          {{ formatDate(project.createdAt) }}
        </div>
      </div>

      <div v-if="projects.length === 0" class="geo-empty">
        <p>还没有项目，创建一个吧！</p>
      </div>
    </div>

    <!-- Actions -->
    <div class="geo-actions">
      <button class="geo-btn geo-btn-primary" @click="$emit('create')">
        + 新建项目
      </button>
      <button
        v-if="selectedId"
        class="geo-btn geo-btn-secondary"
        @click="$emit('select', selectedId)"
      >
        进入项目
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useBrandGeoStore } from '~/studio-v2/workspace/brand-geo/stores/useBrandGeoStore'

const emit = defineEmits<{
  create: []
  select: [projectId: string]
}>()

const store = useBrandGeoStore()
const selectedId = ref<string | null>(null)
const projects = computed(() => store.v2Projects.value)

onMounted(async () => {
  // 页面自身管理项目列表加载 — 不依赖外部初始化
  await store.fetchV2Projects()
})

function selectProject(id: string) {
  selectedId.value = id
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  } catch {
    return dateStr
  }
}
</script>

<style scoped>
.geo-project-select { padding: 24px; max-width: 720px; margin: 0 auto; }
.geo-panel-header { margin-bottom: 24px; }
.geo-panel-title { font-size: 22px; font-weight: 700; color: #e2e8f0; margin: 0 0 8px; }
.geo-panel-subtitle { font-size: 14px; color: #6b7280; margin: 0; }

.geo-project-list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 20px; }

.geo-project-card {
  display: flex; align-items: center; gap: 14px;
  background: #11151c; border-radius: 12px; padding: 16px 20px;
  border: 1px solid rgba(255, 255, 255, 0.04);
  cursor: pointer; transition: all 0.15s;
}
.geo-project-card:hover { border-color: rgba(99, 102, 241, 0.2); background: #161c26; }
.geo-project-card.selected {
  border-color: #6366f1; background: rgba(99, 102, 241, 0.06);
}
.geo-project-icon { font-size: 28px; }
.geo-project-body { flex: 1; display: flex; flex-direction: column; gap: 2px; }
.geo-project-name { font-size: 15px; font-weight: 600; color: #e2e8f0; }
.geo-project-url { font-size: 12px; color: #6366f1; }
.geo-project-meta { font-size: 11px; color: #6b7280; }
.geo-project-date { font-size: 11px; color: #4b5563; flex-shrink: 0; }
.geo-empty { text-align: center; padding: 40px; color: #4b5563; font-size: 13px; }

.geo-actions { display: flex; gap: 12px; }
.geo-btn {
  padding: 10px 24px; border-radius: 8px; font-size: 14px; font-weight: 600;
  cursor: pointer; border: none; transition: all 0.15s;
}
.geo-btn-primary { background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; }
.geo-btn-primary:hover { opacity: 0.9; }
.geo-btn-secondary {
  background: rgba(255, 255, 255, 0.05); color: #e2e8f0; border: 1px solid rgba(255, 255, 255, 0.08);
}
.geo-btn-secondary:hover { background: rgba(255, 255, 255, 0.1); }
</style>
