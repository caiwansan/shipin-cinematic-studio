<script setup lang="ts">
// ─── 分析面板 ───
// Stage1: 产品视觉分析结果（product.json）
// Stage2: 营销策略结果（campaign.json）

import { ref, watch } from 'vue'

const props = defineProps<{
  project: any
  projectId: string
}>()

const emit = defineEmits<{
  (e: 'analysis-done', data: any): void
  (e: 'go-to-prompts'): void
}>()

const analyzing = ref(false)
const stage = ref<'idle' | 'analyzing' | 'done' | 'error'>('idle')
const error = ref('')
const product = ref<any>(null)
const campaign = ref<any>(null)

async function startAnalysis() {
  analyzing.value = true
  stage.value = 'analyzing'
  error.value = ''
  try {
    const token = localStorage.getItem('auth_token')
    const res = await fetch(`/api/ecom/projects/${props.projectId}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error || '分析失败')
    }
    const data = await res.json()
    product.value = data.data.product
    campaign.value = data.data.campaign
    stage.value = 'done'
    emit('analysis-done', data.data)
  } catch (e: any) {
    stage.value = 'error'
    error.value = e.message || '未知错误'
  } finally {
    analyzing.value = false
  }
}

// 如果有已有 promptJson 则直接加载
watch(() => props.project, (p) => {
  if (p?.promptJson) {
    product.value = p.promptJson.product
    campaign.value = p.promptJson.campaign
    if (product.value) stage.value = 'done'
  }
}, { immediate: true })
</script>

<template>
  <div class="analysis-panel">
    <!-- 标题栏 -->
    <div class="panel-header">
      <div>
        <h2>🔍 产品分析</h2>
        <p class="panel-desc">AI 分析产品视觉特征并生成营销策略</p>
      </div>
      <button
        v-if="stage !== 'done'"
        class="btn-analyze"
        :disabled="analyzing"
        @click="startAnalysis"
      >
        {{ analyzing ? '分析中...' : '🚀 开始分析' }}
      </button>
      <button
        v-else
        class="btn-regenerate"
        @click="stage = 'idle'; startAnalysis()"
      >
        🔄 重新分析
      </button>
    </div>

    <!-- 分析中 -->
    <div v-if="stage === 'analyzing'" class="analyzing-status">
      <div class="analyzing-spinner"></div>
      <p>正在通过 GPT-4o Vision 分析产品...</p>
      <p class="analyzing-sub">Stage 1: 产品视觉分析 → Stage 2: 营销策略 → Stage 3: Prompt 生成</p>
    </div>

    <!-- 错误 -->
    <div v-else-if="stage === 'error'" class="error-box">
      <p class="error-text">❌ {{ error }}</p>
      <button class="btn-analyze" @click="startAnalysis">重试</button>
    </div>

    <!-- 分析结果 -->
    <div v-else-if="stage === 'done' && product" class="analysis-results">
      <!-- Stage1: 产品分析 -->
      <section class="result-section">
        <div class="section-title">
          <span class="section-badge stage1">Stage 1</span>
          <h3>产品视觉分析</h3>
        </div>
        <div class="product-card">
          <div class="product-name">{{ product.product_name || '未命名产品' }}</div>
          <div class="product-meta">
            <span class="meta-tag">类目: {{ product.category || '未分类' }}</span>
            <span class="meta-tag">材质: {{ (product.materials || []).join(', ') || '未检测' }}</span>
          </div>
          <div class="detail-grid">
            <div class="detail-item">
              <label>颜色</label>
              <div class="color-chips">
                <span
                  v-for="c in (product.colors || [])"
                  :key="c"
                  class="color-chip"
                >{{ c }}</span>
              </div>
            </div>
            <div class="detail-item">
              <label>结构特征</label>
              <ul><li v-for="s in (product.structure || [])" :key="s">{{ s }}</li></ul>
            </div>
            <div class="detail-item">
              <label>可见属性</label>
              <ul><li v-for="f in (product.visible_features || [])" :key="f">{{ f }}</li></ul>
            </div>
            <div class="detail-item">
              <label>锁定约束</label>
              <ul class="constraint-list">
                <li v-for="c in (product.constraints || [])" :key="c">⚠️ {{ c }}</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <!-- Stage2: 营销策略 -->
      <section v-if="campaign" class="result-section">
        <div class="section-title">
          <span class="section-badge stage2">Stage 2</span>
          <h3>营销策略</h3>
        </div>
        <div class="campaign-card">
          <div class="selling-point">
            <label>核心卖点</label>
            <p>{{ campaign.core_selling_point || 'AI 生成中' }}</p>
          </div>
          <div class="campaign-grid">
            <div class="campaign-block">
              <label>🩹 痛点</label>
              <ul><li v-for="p in (campaign.pain_points || [])" :key="p">{{ p }}</li></ul>
            </div>
            <div class="campaign-block">
              <label>✅ 利益点</label>
              <ul><li v-for="b in (campaign.benefits || [])" :key="b">{{ b }}</li></ul>
            </div>
            <div class="campaign-block">
              <label>📍 使用场景</label>
              <ul><li v-for="s in (campaign.usage_scenarios || [])" :key="s">{{ s }}</li></ul>
            </div>
            <div class="campaign-block">
              <label>🏆 信任元素</label>
              <ul><li v-for="t in (campaign.trust_elements || [])" :key="t">{{ t }}</li></ul>
            </div>
          </div>
        </div>
      </section>

      <!-- 下一步 -->
      <div class="next-step">
        <button class="btn-primary" @click="emit('go-to-prompts')">
          📝 查看生成 Prompt →
        </button>
      </div>
    </div>

    <!-- 空闲状态 -->
    <div v-else class="idle-placeholder">
      <div class="idle-icon">⏳</div>
      <p>点击「开始分析」按钮，AI 将：</p>
      <ul>
        <li>Stage 1 — GPT-4o Vision 分析产品视觉特征</li>
        <li>Stage 2 — 生成高转化营销策略</li>
        <li>Stage 3 — 生成 14 条 GPT-Image-2 提示词</li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.analysis-panel h2 {
  font-size: 1.3rem;
  margin-bottom: 8px;
}

.panel-desc {
  color: #6b7280;
  font-size: 0.85rem;
}

.panel-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 20px;
}

.btn-analyze {
  background: linear-gradient(135deg, #C9A86C, #E2C88A);
  color: #08131F;
  border: none;
  border-radius: 8px;
  padding: 8px 20px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}

.btn-analyze:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-regenerate {
  background: transparent;
  border: 1px solid #2a2f3e;
  color: #9ca3af;
  border-radius: 8px;
  padding: 8px 20px;
  font-size: 0.85rem;
  cursor: pointer;
}

.btn-regenerate:hover {
  border-color: #C9A86C;
  color: #C9A86C;
}

.analyzing-status {
  text-align: center;
  padding: 60px 24px;
  color: #6b7280;
}

.analyzing-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid #1f2937;
  border-top-color: #C9A86C;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: 0 auto 16px;
}

@keyframes spin { to { transform: rotate(360deg); } }

.analyzing-sub {
  font-size: 0.75rem;
  margin-top: 8px;
  color: #4b5563;
}

.error-box {
  text-align: center;
  padding: 40px;
}

.error-text {
  color: #ef4444;
  margin-bottom: 16px;
  font-size: 0.9rem;
}

.idle-placeholder {
  text-align: center;
  padding: 60px 24px;
  color: #6b7280;
}

.idle-icon {
  font-size: 3rem;
  margin-bottom: 16px;
}

.idle-placeholder ul {
  list-style: none;
  padding: 0;
  margin-top: 12px;
  font-size: 0.85rem;
  line-height: 2;
}

.idle-placeholder li::before {
  content: '• ';
  color: #C9A86C;
}

.result-section {
  margin-bottom: 24px;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}

.section-title h3 {
  font-size: 1rem;
}

.section-badge {
  font-size: 0.65rem;
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: 600;
}

.section-badge.stage1 {
  background: rgba(96, 165, 250, 0.15);
  color: #60A5FA;
}

.section-badge.stage2 {
  background: rgba(52, 211, 153, 0.15);
  color: #34D399;
}

.product-card, .campaign-card {
  background: #11151c;
  border: 1px solid #1f2937;
  border-radius: 10px;
  padding: 16px;
}

.product-name {
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: 8px;
  color: #f8f6f1;
}

.product-meta {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}

.meta-tag {
  font-size: 0.75rem;
  padding: 2px 8px;
  background: #1a1f2e;
  border-radius: 4px;
  color: #9ca3af;
}

.detail-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.detail-item label, .campaign-block label, .selling-point label {
  display: block;
  font-size: 0.75rem;
  color: #6b7280;
  margin-bottom: 4px;
}

.detail-item ul, .campaign-block ul {
  list-style: none;
  padding: 0;
  margin: 0;
  font-size: 0.8rem;
  color: #d1d5db;
  line-height: 1.6;
}

.detail-item li::before {
  content: '→ ';
  color: #C9A86C;
}

.constraint-list li {
  color: #f59e0b;
  font-size: 0.75rem;
}

.color-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.color-chip {
  font-size: 0.75rem;
  padding: 2px 8px;
  background: #1a1f2e;
  border-radius: 4px;
  color: #d1d5db;
}

.campaign-card .selling-point {
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid #1f2937;
}

.campaign-card .selling-point p {
  font-size: 1rem;
  color: #C9A86C;
  font-weight: 500;
}

.campaign-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.next-step {
  margin-top: 24px;
  text-align: center;
}

.btn-primary {
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

.btn-primary:hover {
  box-shadow: 0 4px 16px rgba(201, 168, 108, 0.25);
}
</style>
