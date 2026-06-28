<template>
  <div class="geo-scanner">
    <div class="geo-panel-header">
      <h3 class="geo-panel-title">🔍 网站扫描</h3>
      <p class="geo-panel-subtitle">
        输入网站 URL 进行扫描分析。系统将自动抓取首页并解析 meta 信息、站点地图、页面结构等。
      </p>
    </div>

    <!-- Scan Input -->
    <div class="geo-scan-input">
      <input
        v-model="scanUrl"
        type="url"
        class="geo-scan-url"
        placeholder="https://example.com"
        :disabled="scanning"
      />
      <button
        class="geo-scan-btn"
        :disabled="!scanUrl || scanning"
        @click="startScan"
      >
        {{ scanning ? '扫描中...' : '开始扫描' }}
      </button>
    </div>

    <div v-if="error" class="geo-error-message">{{ error }}</div>

    <!-- Scan Status -->
    <div v-if="scanning || snapshot" class="geo-scan-status">
      <div v-if="scanning" class="geo-scan-progress">
        <span class="geo-loading-spinner"></span>
        <span>正在扫描 {{ scanUrl }} ...</span>
      </div>

      <div v-if="snapshot" class="geo-snapshot-results">
        <h4 class="geo-snapshot-title">📋 扫描结果</h4>

        <div class="geo-snapshot-grid">
          <div class="geo-snapshot-card">
            <span class="geo-snapshot-label">状态</span>
            <span class="geo-snapshot-value" :class="snapshot.status">
              {{ statusLabel(snapshot.status) }}
            </span>
          </div>
          <div class="geo-snapshot-card">
            <span class="geo-snapshot-label">页面标题</span>
            <span class="geo-snapshot-value">{{ snapshot.title || '—' }}</span>
          </div>
          <div class="geo-snapshot-card">
            <span class="geo-snapshot-label">描述</span>
            <span class="geo-snapshot-value text-truncate">{{ snapshot.description || '—' }}</span>
          </div>
          <div class="geo-snapshot-card">
            <span class="geo-snapshot-label">语言</span>
            <span class="geo-snapshot-value">{{ snapshot.language || '—' }}</span>
          </div>
        </div>

        <div v-if="errorMsg" class="geo-snapshot-error">
          ⚠️ {{ errorMsg }}
        </div>

        <div class="geo-snapshot-detail" v-if="parsedMeta">
          <h4 class="geo-snapshot-section-title">Meta 信息</h4>
          <div class="geo-snapshot-keyvals">
            <div v-for="(val, key) in parsedMeta" :key="key" class="geo-snapshot-keyval">
              <span class="geo-snapshot-key">{{ key }}</span>
              <span class="geo-snapshot-val">{{ val || '—' }}</span>
            </div>
          </div>
        </div>

        <div class="geo-snapshot-detail" v-if="parsedPages && parsedPages.length > 0">
          <h4 class="geo-snapshot-section-title">
            页面链接 ({{ parsedPages.length }})
          </h4>
          <div class="geo-snapshot-page-list">
            <div v-for="(page, i) in parsedPages.slice(0, 20)" :key="i" class="geo-snapshot-page-item">
              <span class="geo-page-type">{{ page.type }}</span>
              <span class="geo-page-title">{{ page.title }}</span>
              <span class="geo-page-url">{{ page.url }}</span>
            </div>
            <div v-if="parsedPages.length > 20" class="geo-snapshot-more">
              ...还有 {{ parsedPages.length - 20 }} 个页面
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty state -->
    <div v-if="!scanning && !snapshot" class="geo-scan-empty">
      <div class="geo-empty-icon">🌐</div>
      <p>输入网站 URL 并点击"开始扫描"</p>
      <p class="geo-empty-hint">系统会自动抓取网站首页并提取关键信息</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useBrandGeoStore } from '~/studio-v2/workspace/brand-geo/stores/useBrandGeoStore'
import type { WebsiteSnapshot } from '~/studio-v2/types/geo'

const props = defineProps<{
  projectId: string
}>()

const emit = defineEmits<{
  scanned: []
}>()

const store = useBrandGeoStore()
const scanUrl = ref('')
const scanning = ref(false)
const snapshot = ref<WebsiteSnapshot | null>(null)
const error = ref('')

const parsedMeta = computed(() => {
  if (!snapshot.value?.meta) return null
  try {
    return JSON.parse(snapshot.value.meta)
  } catch { return null }
})

const parsedPages = computed(() => {
  if (!snapshot.value?.pages) return null
  try {
    return JSON.parse(snapshot.value.pages)
  } catch { return null }
})

const errorMsg = computed(() => snapshot.value?.error || '')

// Load existing snapshot
watch(() => props.projectId, async (id) => {
  if (!id) return
  const s = await store.fetchSnapshot(id)
  if (s) {
    snapshot.value = s
    scanUrl.value = s.url
  }
}, { immediate: true })

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    pending: '待处理',
    scanning: '扫描中',
    completed: '已完成',
    error: '失败',
    not_started: '未开始',
  }
  return map[status] || status
}

async function startScan() {
  if (!scanUrl.value || !props.projectId) return
  scanning.value = true
  error.value = ''
  snapshot.value = null

  try {
    const result = await store.triggerScan(props.projectId, scanUrl.value)
    if (result) {
      snapshot.value = result

      // Poll for completion
      const pollInterval = setInterval(async () => {
        const status = await store.fetchScanStatus(props.projectId)
        if (status && (status.status === 'completed' || status.status === 'error')) {
          clearInterval(pollInterval)
          scanning.value = false

          // Fetch final snapshot
          const finalSnapshot = await store.fetchSnapshot(props.projectId)
          if (finalSnapshot) {
            snapshot.value = finalSnapshot
            store.setStageStatus('website_scan', 'completed')
            store.setStageStatus('generate_snapshot', 'completed')

            if (status.status === 'completed') {
              store.setCurrentStage('build_graph')
              emit('scanned')
            }
          }
        }
      }, 2000)

      // Timeout after 60 seconds
      setTimeout(() => {
        clearInterval(pollInterval)
        scanning.value = false
        if (snapshot.value?.status === 'scanning') {
          error.value = '扫描超时，请稍后重试'
        }
      }, 60000)
    }
  } catch (err: any) {
    error.value = err.message
    scanning.value = false
  }
}
</script>

<style scoped>
.geo-scanner { padding: 24px; max-width: 800px; margin: 0 auto; }
.geo-panel-header { margin-bottom: 24px; }
.geo-panel-title { font-size: 22px; font-weight: 700; color: #e2e8f0; margin: 0 0 8px; }
.geo-panel-subtitle { font-size: 14px; color: #6b7280; margin: 0; }
.geo-error-message {
  background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2);
  color: #fca5a5; padding: 10px 16px; border-radius: 8px; font-size: 13px; margin-top: 12px;
}

.geo-scan-input { display: flex; gap: 12px; }
.geo-scan-url {
  flex: 1; background: #11151c; border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px; padding: 12px 16px; color: #e2e8f0; font-size: 15px; outline: none;
}
.geo-scan-url:focus { border-color: #6366f1; }
.geo-scan-url:disabled { opacity: 0.5; }
.geo-scan-btn {
  padding: 12px 28px; border-radius: 8px; background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: white; font-size: 14px; font-weight: 600; border: none; cursor: pointer; white-space: nowrap;
}
.geo-scan-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.geo-scan-btn:hover:not(:disabled) { opacity: 0.9; }

.geo-scan-status { margin-top: 20px; }
.geo-scan-progress {
  display: flex; align-items: center; gap: 10px;
  padding: 16px; background: rgba(99, 102, 241, 0.05);
  border: 1px solid rgba(99, 102, 241, 0.15); border-radius: 10px;
  color: #a5b4fc; font-size: 14px;
}
.geo-loading-spinner {
  width: 18px; height: 18px;
  border: 2px solid rgba(99, 102, 241, 0.2); border-top-color: #6366f1;
  border-radius: 50%; animation: spin 0.6s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.geo-snapshot-results { margin-top: 16px; }
.geo-snapshot-title { font-size: 16px; font-weight: 600; color: #d1d5db; margin: 0 0 12px; }
.geo-snapshot-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 16px; }
.geo-snapshot-card {
  background: #11151c; border-radius: 10px; padding: 14px 16px;
  border: 1px solid rgba(255, 255, 255, 0.04); display: flex; flex-direction: column; gap: 4px;
}
.geo-snapshot-label { font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; }
.geo-snapshot-value { font-size: 14px; color: #e2e8f0; font-weight: 500; }
.geo-snapshot-value.completed { color: #34d399; }
.geo-snapshot-value.error { color: #f87171; }
.geo-snapshot-value.pending { color: #fbbf24; }
.text-truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.geo-snapshot-error {
  background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.15);
  color: #fca5a5; padding: 10px 16px; border-radius: 8px; font-size: 13px; margin-bottom: 16px;
}

.geo-snapshot-detail { margin-bottom: 16px; }
.geo-snapshot-section-title { font-size: 14px; font-weight: 600; color: #9ca3af; margin: 0 0 8px; }
.geo-snapshot-keyvals { display: flex; flex-direction: column; gap: 4px; }
.geo-snapshot-keyval {
  display: flex; gap: 12px; padding: 6px 0;
  font-size: 13px; border-bottom: 1px solid rgba(255, 255, 255, 0.03);
}
.geo-snapshot-key { color: #6b7280; min-width: 100px; flex-shrink: 0; }
.geo-snapshot-val { color: #d1d5db; }

.geo-snapshot-page-list { display: flex; flex-direction: column; gap: 6px; }
.geo-snapshot-page-item {
  display: flex; gap: 8px; align-items: center;
  padding: 6px 10px; border-radius: 6px; background: rgba(255, 255, 255, 0.02);
  font-size: 12px;
}
.geo-page-type {
  background: rgba(99, 102, 241, 0.1); color: #a5b4fc;
  padding: 2px 6px; border-radius: 4px; font-size: 10px; flex-shrink: 0;
}
.geo-page-title { color: #d1d5db; flex-shrink: 0; }
.geo-page-url { color: #6b7280; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.geo-snapshot-more { color: #4b5563; font-size: 12px; padding: 4px 10px; }

.geo-scan-empty {
  text-align: center; padding: 60px 20px; color: #6b7280;
}
.geo-empty-icon { font-size: 48px; margin-bottom: 12px; }
.geo-empty-hint { font-size: 13px; color: #4b5563; margin-top: 4px; }
</style>
