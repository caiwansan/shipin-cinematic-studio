<template>
  <div class="geo-page">
    <div class="geo-page-header">
      <div class="geo-page-header-left">
        <h2 class="geo-page-title">📚 Knowledge 中心</h2>
        <p class="geo-page-subtitle">管理知识对象，查看 Evidence、Claim、Citation 详情</p>
      </div>
    </div>

    <!-- Project selector -->
    <div class="geo-filters-bar">
      <div class="geo-filter-group">
        <label class="geo-filter-label">选择项目</label>
        <select v-model="selectedProjectId" class="geo-input geo-input-sm" @change="fetchKnowledgeObjects">
          <option value="">选择项目</option>
          <option v-for="p in projects" :key="p.id" :value="p.id">{{ p.name }}</option>
        </select>
      </div>
    </div>

    <div v-if="!selectedProjectId" class="geo-empty-state">
      <p>请先选择一个品牌项目</p>
    </div>

    <template v-else>
      <!-- KO List -->
      <div v-if="loading" class="geo-loading-state">
        <div class="geo-loading-spinner"></div>
        <span>加载中...</span>
      </div>

      <template v-else-if="knowledgeObjects.length > 0">
        <!-- Stats Summary -->
        <div class="geo-stats-row">
          <div class="geo-stat-card" style="border-left-color: #818cf8">
            <span class="geo-stat-icon">📚</span>
            <div class="geo-stat-body">
              <span class="geo-stat-number">{{ knowledgeObjects.length }}</span>
              <span class="geo-stat-label">知识对象</span>
            </div>
          </div>
          <div class="geo-stat-card" style="border-left-color: #34d399">
            <span class="geo-stat-icon">💡</span>
            <div class="geo-stat-body">
              <span class="geo-stat-number">{{ totalClaims }}</span>
              <span class="geo-stat-label">Claim</span>
            </div>
          </div>
          <div class="geo-stat-card" style="border-left-color: #f59e0b">
            <span class="geo-stat-icon">📄</span>
            <div class="geo-stat-body">
              <span class="geo-stat-number">{{ totalEvidence }}</span>
              <span class="geo-stat-label">Evidence</span>
            </div>
          </div>
          <div class="geo-stat-card" style="border-left-color: #ec4899">
            <span class="geo-stat-icon">📝</span>
            <div class="geo-stat-body">
              <span class="geo-stat-number">{{ totalCitations }}</span>
              <span class="geo-stat-label">Citation</span>
            </div>
          </div>
        </div>

        <!-- KO Cards -->
        <div class="geo-ko-list">
          <div v-for="ko in knowledgeObjects" :key="ko.id" class="geo-ko-card" @click="selectKO(ko)">
            <div class="geo-ko-card-header">
              <span class="geo-ko-topic">{{ ko.topic || '未命名' }}</span>
              <span :class="['geo-status-badge', `geo-ko-status--${ko.status}`]">{{ ko.status }}</span>
            </div>
            <div class="geo-ko-card-body">
              <div class="geo-ko-metrics">
                <span class="geo-ko-metric">
                  <span class="geo-metric-value">{{ ko.entities?.length || 0 }}</span>
                  <span class="geo-metric-label">实体</span>
                </span>
                <span class="geo-ko-metric">
                  <span class="geo-metric-value">{{ ko.claims?.length || 0 }}</span>
                  <span class="geo-metric-label">Claim</span>
                </span>
                <span class="geo-ko-metric">
                  <span class="geo-metric-value">{{ ko.evidence?.length || 0 }}</span>
                  <span class="geo-metric-label">Evidence</span>
                </span>
                <span class="geo-ko-metric">
                  <span class="geo-metric-value">{{ ko.citations?.length || 0 }}</span>
                  <span class="geo-metric-label">Citation</span>
                </span>
              </div>
              <div class="geo-ko-confidence" v-if="ko.confidence">
                <span class="geo-metric-label">置信度</span>
                <span class="geo-metric-value">{{ (ko.confidence * 100).toFixed(0) }}%</span>
              </div>
            </div>
            <div class="geo-ko-card-footer">
              <span class="geo-ko-date">{{ formatTime(ko.createdAt) }}</span>
            </div>
          </div>
        </div>
      </template>

      <div v-else class="geo-empty-state">
        <p>暂无知识对象，请先运行 Entity Discovery 工作流</p>
      </div>

      <!-- KO Detail Panel -->
      <div v-if="selectedKO" class="geo-ko-detail-overlay" @click.self="selectedKO = null">
        <div class="geo-ko-detail">
          <div class="geo-detail-header">
            <h3>{{ selectedKO.topic || '知识对象详情' }}</h3>
            <button class="geo-modal-close" @click="selectedKO = null">✕</button>
          </div>
          <div class="geo-detail-body">
            <!-- Entities -->
            <div class="geo-detail-section">
              <h4>Entities ({{ selectedKO.entities?.length || 0 }})</h4>
              <div v-if="selectedKO.entities && selectedKO.entities.length > 0" class="geo-entity-list">
                <div v-for="(entity, i) in selectedKO.entities" :key="i" class="geo-entity-item">
                  <span class="geo-entity-name">{{ entity.name }}</span>
                  <span class="geo-entity-type">{{ entity.type }}</span>
                  <span class="geo-entity-desc">{{ entity.description }}</span>
                </div>
              </div>
              <div v-else class="geo-empty-inline">暂无实体</div>
            </div>

            <!-- Relations -->
            <div class="geo-detail-section">
              <h4>Relations ({{ selectedKO.relations?.length || 0 }})</h4>
              <div v-if="selectedKO.relations && selectedKO.relations.length > 0" class="geo-relation-list">
                <div v-for="(rel, i) in selectedKO.relations" :key="i" class="geo-relation-item">
                  <span class="geo-rel-source">{{ rel.source }}</span>
                  <span class="geo-rel-type">{{ rel.type }}</span>
                  <span class="geo-rel-target">{{ rel.target }}</span>
                </div>
              </div>
              <div v-else class="geo-empty-inline">暂无关系</div>
            </div>

            <!-- Claims -->
            <div class="geo-detail-section">
              <h4>Claims ({{ selectedKO.claims?.length || 0 }})</h4>
              <div v-if="selectedKO.claims && selectedKO.claims.length > 0" class="geo-list-items">
                <div v-for="(claim, i) in selectedKO.claims" :key="i" class="geo-list-item">
                  <p class="geo-list-text">{{ claim.text || claim }}</p>
                  <span v-if="claim.type" class="geo-list-tag">{{ claim.type }}</span>
                </div>
              </div>
              <div v-else class="geo-empty-inline">暂无 Claim</div>
            </div>

            <!-- Evidence -->
            <div class="geo-detail-section">
              <h4>Evidence ({{ selectedKO.evidence?.length || 0 }})</h4>
              <div v-if="selectedKO.evidence && selectedKO.evidence.length > 0" class="geo-list-items">
                <div v-for="(ev, i) in selectedKO.evidence" :key="i" class="geo-list-item">
                  <p class="geo-list-text">{{ ev.content || ev }}</p>
                  <span v-if="ev.source" class="geo-list-source">{{ ev.source }}</span>
                </div>
              </div>
              <div v-else class="geo-empty-inline">暂无 Evidence</div>
            </div>

            <!-- Citations -->
            <div class="geo-detail-section">
              <h4>Citations ({{ selectedKO.citations?.length || 0 }})</h4>
              <div v-if="selectedKO.citations && selectedKO.citations.length > 0" class="geo-list-items">
                <div v-for="(cit, i) in selectedKO.citations" :key="i" class="geo-list-item geo-citation-item">
                  <p class="geo-list-text">{{ cit.citationText || cit }}</p>
                  <div v-if="cit.sourceUrl" class="geo-citation-url">
                    <a :href="cit.sourceUrl" target="_blank" rel="noopener">{{ cit.sourceUrl }}</a>
                  </div>
                </div>
              </div>
              <div v-else class="geo-empty-inline">暂无 Citation</div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'

const loading = ref(false)
const projects = ref<any[]>([])
const selectedProjectId = ref('')
const knowledgeObjects = ref<any[]>([])
const selectedKO = ref<any>(null)

const totalClaims = computed(() => knowledgeObjects.value.reduce((sum, ko) => sum + (ko.claims?.length || 0), 0))
const totalEvidence = computed(() => knowledgeObjects.value.reduce((sum, ko) => sum + (ko.evidence?.length || 0), 0))
const totalCitations = computed(() => knowledgeObjects.value.reduce((sum, ko) => sum + (ko.citations?.length || 0), 0))

function authHeaders(): Record<string, string> {
  try {
    const ls = window.localStorage
    for (const key of ['auth_token', 'accessToken', 'token']) {
      const val = ls.getItem(key)
      if (val) return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${val}` }
    }
  } catch { /* ignore */ }
  return { 'Content-Type': 'application/json' }
}

async function fetchProjects() {
  try {
    const res = await fetch('/api/geo/brands', { headers: authHeaders() })
    const json = await res.json()
    if (json.success) projects.value = json.data
  } catch (err) {
    console.error('Failed to fetch projects:', err)
  }
}

async function fetchKnowledgeObjects() {
  if (!selectedProjectId.value) return
  loading.value = true
  try {
    const res = await fetch(`/api/geo/knowledge?projectId=${selectedProjectId.value}`, { headers: authHeaders() })
    const json = await res.json()
    if (json.success) {
      knowledgeObjects.value = Array.isArray(json.data) ? json.data : (json.data?.items || [])
    }
  } catch (err) {
    console.error('Failed to fetch knowledge objects:', err)
  } finally {
    loading.value = false
  }
}

async function selectKO(ko: any) {
  try {
    const res = await fetch(`/api/geo/knowledge/${ko.id}`, { headers: authHeaders() })
    const json = await res.json()
    if (json.success) {
      selectedKO.value = json.data
    } else {
      selectedKO.value = ko // fallback to list data
    }
  } catch {
    selectedKO.value = ko
  }
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleDateString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch { return iso }
}

onMounted(fetchProjects)
</script>

<style scoped>
.geo-page { padding: 24px; color: #e0e0e0; height: 100%; overflow-y: auto; }

.geo-page-header { margin-bottom: 20px; }
.geo-page-title { font-size: 20px; font-weight: 700; margin: 0 0 4px; }
.geo-page-subtitle { color: #888; font-size: 13px; margin: 0; }

.geo-filters-bar { margin-bottom: 16px; display: flex; gap: 12px; }
.geo-filter-group { display: flex; flex-direction: column; gap: 4px; }
.geo-filter-label { font-size: 11px; color: #6b7280; font-weight: 500; }
.geo-input { padding: 8px 12px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.04); color: #e0e0e0; font-size: 13px; outline: none; }
.geo-input:focus { border-color: #818cf8; }
.geo-input-sm { padding: 6px 10px; font-size: 12px; }

.geo-stats-row { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 12px; margin-bottom: 20px; }
.geo-stat-card { display: flex; align-items: center; gap: 12px; padding: 14px; background: #1a1a2e; border-radius: 8px; border-left: 3px solid; border-top: 1px solid rgba(255,255,255,0.04); border-right: 1px solid rgba(255,255,255,0.04); border-bottom: 1px solid rgba(255,255,255,0.04); }
.geo-stat-icon { font-size: 22px; }
.geo-stat-body { display: flex; flex-direction: column; }
.geo-stat-number { font-size: 20px; font-weight: 700; }
.geo-stat-label { font-size: 11px; color: #888; }

.geo-empty-state { padding: 60px 20px; text-align: center; color: #666; font-size: 14px; }
.geo-loading-state { padding: 40px; text-align: center; display: flex; align-items: center; justify-content: center; gap: 8px; color: #6b7280; }
.geo-loading-spinner { width: 16px; height: 16px; border: 2px solid rgba(129,140,248,0.2); border-top-color: #818cf8; border-radius: 50%; animation: spin 0.6s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

.geo-ko-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 12px; }
.geo-ko-card { background: #1a1a2e; border-radius: 10px; border: 1px solid rgba(255,255,255,0.04); padding: 16px; cursor: pointer; transition: all 0.15s; }
.geo-ko-card:hover { border-color: #818cf8; background: #1e1e36; transform: translateY(-1px); }
.geo-ko-card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.geo-ko-topic { font-weight: 600; font-size: 14px; }
.geo-status-badge { padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 600; }
.geo-ko-status--DISCOVERED { background: rgba(129,140,248,0.15); color: #818cf8; }
.geo-ko-status--PROCESSED { background: rgba(52,211,153,0.15); color: #34d399; }
.geo-ko-status--FAILED { background: rgba(239,68,68,0.15); color: #ef4444; }
.geo-ko-card-body { margin-bottom: 12px; }
.geo-ko-metrics { display: flex; gap: 16px; margin-bottom: 8px; }
.geo-ko-metric { display: flex; flex-direction: column; }
.geo-metric-value { font-size: 14px; font-weight: 700; }
.geo-metric-label { font-size: 10px; color: #6b7280; text-transform: uppercase; }
.geo-ko-confidence { display: flex; gap: 6px; align-items: center; font-size: 12px; }
.geo-ko-card-footer { border-top: 1px solid rgba(255,255,255,0.04); padding-top: 10px; }
.geo-ko-date { font-size: 11px; color: #6b7280; }

/* Detail Panel */
.geo-ko-detail-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.geo-ko-detail { background: #1a1a2e; border-radius: 12px; border: 1px solid rgba(255,255,255,0.08); width: 720px; max-width: 90vw; max-height: 85vh; overflow-y: auto; }
.geo-detail-header { display: flex; justify-content: space-between; align-items: center; padding: 18px 20px 0; position: sticky; top: 0; background: #1a1a2e; z-index: 1; }
.geo-detail-header h3 { margin: 0; font-size: 18px; font-weight: 700; }
.geo-modal-close { background: none; border: none; color: #6b7280; font-size: 18px; cursor: pointer; padding: 4px; }
.geo-modal-close:hover { color: #ccc; }
.geo-detail-body { padding: 16px 20px 20px; }
.geo-detail-section { margin-bottom: 20px; }
.geo-detail-section h4 { font-size: 14px; font-weight: 600; color: #aaa; margin: 0 0 8px; }

.geo-entity-list, .geo-relation-list { display: flex; flex-direction: column; gap: 6px; }
.geo-entity-item, .geo-relation-item { padding: 8px 12px; background: rgba(255,255,255,0.02); border-radius: 6px; font-size: 13px; display: flex; gap: 8px; flex-wrap: wrap; }
.geo-entity-name { font-weight: 600; }
.geo-entity-type { padding: 1px 6px; border-radius: 4px; font-size: 10px; background: rgba(129,140,248,0.15); color: #818cf8; }
.geo-entity-desc { color: #888; font-size: 12px; width: 100%; }
.geo-rel-source { color: #818cf8; }
.geo-rel-type { color: #fbbf24; font-size: 11px; }
.geo-rel-target { color: #34d399; }

.geo-list-items { display: flex; flex-direction: column; gap: 6px; }
.geo-list-item { padding: 10px 12px; background: rgba(255,255,255,0.02); border-radius: 6px; font-size: 13px; }
.geo-list-text { margin: 0 0 4px; }
.geo-list-tag { font-size: 10px; color: #818cf8; background: rgba(129,140,248,0.1); padding: 1px 6px; border-radius: 4px; }
.geo-list-source { font-size: 11px; color: #6b7280; }
.geo-citation-item { }
.geo-citation-url { margin-top: 4px; font-size: 11px; }
.geo-citation-url a { color: #818cf8; text-decoration: none; }
.geo-citation-url a:hover { text-decoration: underline; }

.geo-empty-inline { color: #6b7280; font-size: 13px; padding: 8px 0; }
</style>
