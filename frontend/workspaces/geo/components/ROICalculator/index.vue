<template>
  <GeoCard title="ROI 计算器" class="roi-calculator">
    <template #header-actions>
      <button class="roi-calculator__reset-btn" @click="resetForm" title="重置">↺</button>
    </template>

    <!-- ===== Input Form ===== -->
    <div class="roi-calculator__form">
      <div class="roi-calculator__row">
        <div class="roi-calculator__field">
          <label class="roi-calculator__label">行业</label>
          <select v-model="form.industry" class="roi-calculator__select">
            <option value="technology">科技 / 互联网</option>
            <option value="finance">金融 / 证券</option>
            <option value="healthcare">医疗 / 医药</option>
            <option value="education">教育 / 培训</option>
            <option value="ecommerce">电商 / 零售</option>
            <option value="media">媒体 / 娱乐</option>
            <option value="manufacturing">制造业</option>
            <option value="energy">能源 / 环保</option>
            <option value="realestate">房地产 / 建筑</option>
            <option value="transportation">交通 / 物流</option>
            <option value="legal">法律 / 律师</option>
            <option value="catering">餐饮 / 美食</option>
            <option value="tourism">旅游 / 酒店</option>
            <option value="beauty">美容 / 美体</option>
            <option value="livestream">直播 / 带货</option>
            <option value="tea">茶叶 / 茶饮</option>
            <option value="agriculture">农产品 / 农业</option>
            <option value="liquor">白酒 / 酒水</option>
            <option value="apparel">服装 / 鞋帽</option>
            <option value="wellness">养生 / 健康</option>
            <option value="employment">就业 / 招聘</option>
            <option value="driving">驾校 / 驾驶培训</option>
            <option value="carrental">租车 / 出行</option>
            <option value="lighting">灯饰 / 照明</option>
            <option value="decoration">装修 / 装饰</option>
            <option value="agency">房产 / 中介</option>
            <option value="wedding">婚礼 / 司仪</option>
            <option value="parenting">育儿 / 月嫂</option>
            <option value="homeappliance">家电 / 家居</option>
            <option value="automotive">汽车 / 维修美容</option>
            <option value="textile">家纺 / 布艺</option>
            <option value="construction">建材 / 工程</option>
            <option value="default">其他</option>
          </select>
        </div>
        <div class="roi-calculator__field">
          <label class="roi-calculator__label">品牌规模</label>
          <select v-model="form.brandScale" class="roi-calculator__select">
            <option value="small">小型</option>
            <option value="medium" selected>中型</option>
            <option value="large">大型</option>
            <option value="enterprise">企业级</option>
          </select>
        </div>
      </div>

      <div class="roi-calculator__row">
        <div class="roi-calculator__field">
          <label class="roi-calculator__label">客单价（元）</label>
          <input v-model.number="form.averageOrderValue" type="number" min="0" class="roi-calculator__input" placeholder="例如：299" />
        </div>
        <div class="roi-calculator__field">
          <label class="roi-calculator__label">月咨询量</label>
          <input v-model.number="form.monthlyInquiries" type="number" min="0" class="roi-calculator__input" placeholder="例如：1000" />
        </div>
      </div>

      <div class="roi-calculator__row">
        <div class="roi-calculator__field">
          <label class="roi-calculator__label">转化率（%）</label>
          <input v-model.number="form.conversionRate" type="number" min="0" max="100" step="0.1" class="roi-calculator__input" placeholder="例如：5" />
        </div>
        <div class="roi-calculator__field roi-calculator__field--action">
          <button
            class="roi-calculator__calculate-btn"
            :disabled="calculating || !isFormValid"
            @click="calculateROI"
          >
            {{ calculating ? '计算中...' : '计算 ROI' }}
          </button>
        </div>
      </div>
    </div>

    <!-- ===== Error State ===== -->
    <div v-if="error" class="roi-calculator__error">
      {{ error }}
    </div>

    <!-- ===== Results ===== -->
    <div v-if="result" class="roi-calculator__results">
      <div class="roi-calculator__results-header">
        <h4 class="roi-calculator__results-title">估算结果</h4>
        <span class="roi-calculator__results-period">基于月度数据预估</span>
      </div>

      <div class="roi-calculator__metrics">
        <div class="roi-calculator__metric roi-calculator__metric--highlight">
          <span class="roi-calculator__metric-label">预计 ROI</span>
          <span class="roi-calculator__metric-value" :class="roiColorClass">
            {{ result.estimatedROI > 0 ? '+' : '' }}{{ result.estimatedROI }}%
          </span>
        </div>
        <div class="roi-calculator__metric">
          <span class="roi-calculator__metric-label">回本周期</span>
          <span class="roi-calculator__metric-value">
            {{ result.estimatedPaybackPeriod >= 999 ? '—' : result.estimatedPaybackPeriod + ' 月' }}
          </span>
        </div>
      </div>

      <div class="roi-calculator__detail">
        <div class="roi-calculator__detail-row">
          <span class="roi-calculator__detail-label">AI 新增曝光</span>
          <span class="roi-calculator__detail-value">{{ formatNumber(result.estimatedAIExposureIncrease) }}</span>
        </div>
        <div class="roi-calculator__detail-row">
          <span class="roi-calculator__detail-label">新增咨询</span>
          <span class="roi-calculator__detail-value">{{ formatNumber(result.estimatedNewInquiries) }}</span>
        </div>
        <div class="roi-calculator__detail-row">
          <span class="roi-calculator__detail-label">新增订单</span>
          <span class="roi-calculator__detail-value">{{ formatNumber(result.estimatedNewOrders) }}</span>
        </div>
        <div class="roi-calculator__detail-row roi-calculator__detail-row--total">
          <span class="roi-calculator__detail-label">新增收入</span>
          <span class="roi-calculator__detail-value">¥{{ formatNumber(result.estimatedNewRevenue) }}</span>
        </div>
      </div>

      <div class="roi-calculator__benchmark">
        <div class="roi-calculator__benchmark-header">
          <span class="roi-calculator__benchmark-title">行业基准</span>
          <span class="roi-calculator__benchmark-subtitle">同类品牌平均 AI 曝光</span>
        </div>
        <div class="roi-calculator__benchmark-bar">
          <div class="roi-calculator__benchmark-track">
            <div
              class="roi-calculator__benchmark-fill"
              :style="{ width: benchmarkPercent + '%' }"
            />
          </div>
          <div class="roi-calculator__benchmark-labels">
            <span>平均: {{ formatNumber(result.industryBenchmark.averageAIExposure) }}</span>
            <span>头部: {{ formatNumber(result.industryBenchmark.topPerformers) }}</span>
          </div>
        </div>
      </div>
    </div>
  </GeoCard>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import GeoCard from '../GeoCard/index.vue'

interface ROICalculationInput {
  industry: string
  brandScale: string
  averageOrderValue: number
  monthlyInquiries: number
  conversionRate: number
}

interface ROICalculationResult {
  estimatedAIExposureIncrease: number
  estimatedNewInquiries: number
  estimatedNewOrders: number
  estimatedNewRevenue: number
  estimatedROI: number
  estimatedPaybackPeriod: number
  industryBenchmark: {
    averageAIExposure: number
    topPerformers: number
  }
}

const API_BASE = '/api/geo'

const form = reactive<ROICalculationInput>({
  industry: 'technology',
  brandScale: 'medium',
  averageOrderValue: 299,
  monthlyInquiries: 1000,
  conversionRate: 5,
})

const result = ref<ROICalculationResult | null>(null)
const calculating = ref(false)
const error = ref<string | null>(null)

const isFormValid = computed(() => {
  return (
    form.averageOrderValue > 0 &&
    form.monthlyInquiries >= 0 &&
    form.conversionRate >= 0 &&
    form.conversionRate <= 100
  )
})

const roiColorClass = computed(() => {
  if (!result.value) return ''
  const roi = result.value.estimatedROI
  if (roi >= 200) return 'roi-calculator__metric-value--great'
  if (roi >= 100) return 'roi-calculator__metric-value--good'
  if (roi >= 0) return 'roi-calculator__metric-value--neutral'
  return 'roi-calculator__metric-value--bad'
})

const benchmarkPercent = computed(() => {
  if (!result.value) return 0
  const max = result.value.industryBenchmark.topPerformers
  if (max === 0) return 0
  return Math.min((result.value.estimatedAIExposureIncrease / max) * 100, 100)
})

function formatNumber(num: number): string {
  if (num >= 10000) {
    return (num / 10000).toFixed(1) + '万'
  }
  return num.toLocaleString('zh-CN')
}

function resetForm() {
  form.industry = 'technology'
  form.brandScale = 'medium'
  form.averageOrderValue = 299
  form.monthlyInquiries = 1000
  form.conversionRate = 5
  result.value = null
  error.value = null
}

async function calculateROI() {
  if (!isFormValid.value) return

  calculating.value = true
  error.value = null
  result.value = null

  try {
    const res = await fetch(`${API_BASE}/roi/calculate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}))
      throw new Error(errData.error || `请求失败 (${res.status})`)
    }

    const json = await res.json()
    result.value = json.data
  } catch (err: any) {
    error.value = err.message || '计算失败，请重试'
  } finally {
    calculating.value = false
  }
}
</script>

<style scoped>
.roi-calculator {
  --roi-great: #059669;
  --roi-good: #0284c7;
  --roi-neutral: #d97706;
  --roi-bad: #dc2626;
}

.roi-calculator__reset-btn {
  background: none;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 14px;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.15s;
}

.roi-calculator__reset-btn:hover {
  background: #f9fafb;
  border-color: #d1d5db;
  color: #111827;
}

/* ===== Form ===== */
.roi-calculator__form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.roi-calculator__row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.roi-calculator__field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.roi-calculator__field--action {
  justify-content: flex-end;
}

.roi-calculator__label {
  font-size: 12px;
  font-weight: 600;
  color: #374151;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.roi-calculator__input,
.roi-calculator__select {
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
  color: #111827;
  background: #fff;
  transition: border-color 0.15s;
  outline: none;
  width: 100%;
  box-sizing: border-box;
}

.roi-calculator__input:focus,
.roi-calculator__select:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
}

.roi-calculator__calculate-btn {
  padding: 8px 24px;
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  width: 100%;
  margin-top: 16px;
}

.roi-calculator__calculate-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, #2563eb, #1d4ed8);
}

.roi-calculator__calculate-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* ===== Error ===== */
.roi-calculator__error {
  margin-top: 12px;
  padding: 10px 14px;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 8px;
  color: #dc2626;
  font-size: 13px;
}

/* ===== Results ===== */
.roi-calculator__results {
  margin-top: 20px;
  border-top: 1px solid #f3f4f6;
  padding-top: 16px;
}

.roi-calculator__results-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 12px;
}

.roi-calculator__results-title {
  font-size: 15px;
  font-weight: 700;
  color: #111827;
  margin: 0;
}

.roi-calculator__results-period {
  font-size: 11px;
  color: #9ca3af;
}

/* ===== Key Metrics ===== */
.roi-calculator__metrics {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-bottom: 16px;
}

.roi-calculator__metric {
  padding: 12px;
  background: #f9fafb;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.roi-calculator__metric--highlight {
  background: linear-gradient(135deg, #eff6ff, #f0fdf4);
}

.roi-calculator__metric-label {
  font-size: 11px;
  font-weight: 500;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.roi-calculator__metric-value {
  font-size: 22px;
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: -0.02em;
}

.roi-calculator__metric-value--great { color: var(--roi-great); }
.roi-calculator__metric-value--good { color: var(--roi-good); }
.roi-calculator__metric-value--neutral { color: var(--roi-neutral); }
.roi-calculator__metric-value--bad { color: var(--roi-bad); }

/* ===== Detail ===== */
.roi-calculator__detail {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 16px;
}

.roi-calculator__detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 0;
  border-bottom: 1px solid #f3f4f6;
}

.roi-calculator__detail-row--total {
  border-bottom: none;
  padding-top: 8px;
  border-top: 2px solid #e5e7eb;
}

.roi-calculator__detail-label {
  font-size: 13px;
  color: #6b7280;
}

.roi-calculator__detail-value {
  font-size: 14px;
  font-weight: 600;
  color: #111827;
}

.roi-calculator__detail-row--total .roi-calculator__detail-value {
  font-size: 16px;
  color: #059669;
}

/* ===== Benchmark ===== */
.roi-calculator__benchmark {
  padding: 12px;
  background: #f9fafb;
  border-radius: 8px;
}

.roi-calculator__benchmark-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.roi-calculator__benchmark-title {
  font-size: 12px;
  font-weight: 600;
  color: #374151;
}

.roi-calculator__benchmark-subtitle {
  font-size: 11px;
  color: #9ca3af;
}

.roi-calculator__benchmark-track {
  height: 6px;
  background: #e5e7eb;
  border-radius: 3px;
  overflow: hidden;
}

.roi-calculator__benchmark-fill {
  height: 100%;
  background: linear-gradient(90deg, #3b82f6, #8b5cf6);
  border-radius: 3px;
  transition: width 0.4s ease;
}

.roi-calculator__benchmark-labels {
  display: flex;
  justify-content: space-between;
  margin-top: 4px;
  font-size: 11px;
  color: #9ca3af;
}
</style>
