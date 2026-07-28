<!-- /enterprise/pricing.vue — AI新媒体运营部门套餐页 -->
<template>
  <div class="pricing-page">
    <!-- Header -->
    <div class="pricing-header">
      <h1 class="pricing-title">选择您的 AI 数字部门套餐</h1>
      <p class="pricing-subtitle">所有套餐均包含 Hermes Runtime + Memory + Tool + Governance</p>
      <p class="pricing-byok">💡 模型费用自理：使用您自己的 LLM API Key，昆仑镜不收取模型调用费</p>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <p>加载套餐中...</p>
    </div>

    <!-- Plans Grid -->
    <div v-else class="plans-grid">
      <div
        v-for="plan in plans"
        :key="plan.id"
        class="plan-card"
        :class="{ featured: plan.name === 'pro', disabled: !plan.enabled }"
      >
        <!-- Badge -->
        <div v-if="plan.name === 'pro'" class="plan-badge">推荐</div>

        <!-- Plan Info -->
        <div class="plan-info">
          <h3 class="plan-name">{{ plan.displayName }}</h3>
          <p v-if="plan.description" class="plan-desc">{{ plan.description }}</p>
        </div>

        <!-- Price -->
        <div class="plan-price">
          <span class="price-symbol">¥</span>
          <span class="price-value">{{ formatPrice(plan.price) }}</span>
          <span class="price-cycle">/{{ plan.billingCycle === 'yearly' ? '年' : '月' }}</span>
        </div>
        <p v-if="plan.originalPrice > plan.price" class="plan-original">
          原价 ¥{{ formatPrice(plan.originalPrice) }}
        </p>

        <!-- Features -->
        <div class="plan-features">
          <div class="feature-item">
            <span class="feature-icon">🤖</span>
            <span class="feature-text">
              <strong>{{ plan.maxEmployees === 0 ? '不限' : plan.maxEmployees + ' 个' }}</strong> AI 员工
            </span>
          </div>
          <div class="feature-item">
            <span class="feature-icon">📡</span>
            <span class="feature-text">
              <strong>{{ plan.maxChannels === 0 ? '不限' : plan.maxChannels + ' 个' }}</strong> 业务渠道
            </span>
          </div>
          <div class="feature-item">
            <span class="feature-icon">👥</span>
            <span class="feature-text">
              <strong>{{ plan.maxMembers === 0 ? '不限' : plan.maxMembers + ' 人' }}</strong> 企业成员
            </span>
          </div>
          <div class="feature-item">
            <span class="feature-icon">💾</span>
            <span class="feature-text">
              <strong>{{ plan.storageLimit }} GB</strong> 存储空间
            </span>
          </div>
          <div v-if="plan.requireOwnLLMKey" class="feature-item">
            <span class="feature-icon">🔑</span>
            <span class="feature-text">
              <strong>BYOK</strong> 自带模型 API Key
            </span>
          </div>
          <div v-if="plan.features && parseFeatures(plan.features).length > 0" class="feature-list">
            <div v-for="feat in parseFeatures(plan.features)" :key="feat" class="feature-extra">
              ✓ {{ feat }}
            </div>
          </div>
        </div>

        <!-- CTA -->
        <button
          class="plan-cta"
          :class="{ primary: plan.name === 'pro' }"
          :disabled="!plan.enabled"
          @click="handleSelectPlan(plan)"
        >
          {{ plan.enabled ? '选择此套餐' : '暂不可用' }}
        </button>
      </div>
    </div>

    <!-- Empty State -->
    <div v-if="!loading && plans.length === 0" class="empty-state">
      <p>暂无可用套餐，请联系管理员配置</p>
    </div>

    <!-- FAQ -->
    <div class="faq-section">
      <h2>常见问题</h2>
      <div class="faq-list">
        <div class="faq-item">
          <h4>Q: 模型费用如何计算？</h4>
          <p>A: 昆仑镜不收取模型调用费用。您需要配置自己的 LLM API Key（支持 DeepSeek、OpenAI、Claude、智谱等），模型费用由您直接支付给模型供应商。</p>
        </div>
        <div class="faq-item">
          <h4>Q: 可以随时升级套餐吗？</h4>
          <p>A: 可以随时升级，升级后立即获得更多 AI 员工额度和渠道数量。</p>
        </div>
        <div class="faq-item">
          <h4>Q: 订阅过期后 AI 员工会怎样？</h4>
          <p>A: 订阅过期后 AI 员工将暂停运行，但所有数据和配置保留。续费后自动恢复运行。</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { getAuthToken } from '~/utils/auth/token'
import { ref, onMounted } from 'vue'

interface EnterprisePlan {
  id: string
  name: string
  displayName: string
  description: string | null
  price: number
  originalPrice: number
  currency: string
  billingCycle: string
  maxEmployees: number
  maxChannels: number
  maxMembers: number
  storageLimit: number
  requireOwnLLMKey: boolean
  allowedProviders: string[]
  quotaPolicy: string
  features: any
  enabled: boolean
  sortOrder: number
}

const plans = ref<EnterprisePlan[]>([])
const loading = ref(true)

onMounted(async () => {
  try {
    const res = await fetch('/api/enterprise/plans', {
      headers: { Authorization: `Bearer ${getAuthToken() || ''}` },
    })
    const data = await res.json()
    if (data.code === 0) {
      plans.value = data.data
    }
  } catch (e) {
    console.error('Failed to load plans:', e)
  } finally {
    loading.value = false
  }
})

function formatPrice(price: number): string {
  return (price / 100).toFixed(0)
}

function parseFeatures(features: any): string[] {
  if (!features) return []
  if (typeof features === 'string') {
    try { return JSON.parse(features) } catch { return [] }
  }
  return Array.isArray(features) ? features : []
}

function handleSelectPlan(plan: EnterprisePlan) {
  // Navigate to payment page
  window.location.href = `/enterprise/payment?planId=${plan.id}`
}
</script>

<style scoped>
.pricing-page {
  max-width: 1100px;
  margin: 0 auto;
  padding: 60px 24px 80px;
  color: #e0e0e0;
}

.pricing-header {
  text-align: center;
  margin-bottom: 48px;
}
.pricing-title {
  font-size: 32px;
  font-weight: bold;
  margin-bottom: 12px;
  background: linear-gradient(135deg, #e0e0e0, #60a5fa);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}
.pricing-subtitle {
  font-size: 16px;
  color: #9ca3af;
  margin-bottom: 8px;
}
.pricing-byok {
  display: inline-block;
  padding: 6px 16px;
  background: rgba(34, 197, 94, 0.1);
  border: 1px solid rgba(34, 197, 94, 0.3);
  border-radius: 20px;
  font-size: 13px;
  color: #86efac;
}

/* Loading */
.loading-state {
  text-align: center;
  padding: 60px;
  color: #6b7280;
}
.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #374151;
  border-top-color: #60a5fa;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: 0 auto 12px;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* Plans Grid */
.plans-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 24px;
  margin-bottom: 60px;
}

.plan-card {
  position: relative;
  background: #1f2937;
  border: 1px solid #374151;
  border-radius: 16px;
  padding: 32px 24px;
  display: flex;
  flex-direction: column;
  transition: border-color 0.2s, transform 0.2s;
}
.plan-card:hover {
  border-color: #60a5fa;
  transform: translateY(-2px);
}
.plan-card.featured {
  border-color: #60a5fa;
  box-shadow: 0 0 24px rgba(96, 165, 250, 0.15);
}
.plan-card.disabled {
  opacity: 0.5;
  pointer-events: none;
}

.plan-badge {
  position: absolute;
  top: -12px;
  right: 20px;
  background: #60a5fa;
  color: #fff;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: bold;
}

.plan-name {
  font-size: 20px;
  font-weight: bold;
  margin-bottom: 4px;
}
.plan-desc {
  font-size: 13px;
  color: #9ca3af;
  margin-bottom: 16px;
}

.plan-price {
  margin-bottom: 4px;
}
.price-symbol {
  font-size: 20px;
  vertical-align: top;
  line-height: 1.2;
}
.price-value {
  font-size: 42px;
  font-weight: bold;
}
.price-cycle {
  font-size: 14px;
  color: #9ca3af;
}
.plan-original {
  font-size: 12px;
  color: #6b7280;
  text-decoration: line-through;
  margin-bottom: 20px;
}

/* Features */
.plan-features {
  flex: 1;
  margin-bottom: 24px;
}
.feature-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 0;
  font-size: 14px;
}
.feature-icon {
  font-size: 16px;
}
.feature-text {
  color: #d1d5db;
}
.feature-list {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid #374151;
}
.feature-extra {
  font-size: 13px;
  color: #9ca3af;
  padding: 2px 0;
}

/* CTA */
.plan-cta {
  width: 100%;
  padding: 12px;
  border: 1px solid #4b5563;
  border-radius: 8px;
  background: transparent;
  color: #e0e0e0;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}
.plan-cta:hover {
  border-color: #60a5fa;
  color: #60a5fa;
}
.plan-cta.primary {
  background: #60a5fa;
  border-color: #60a5fa;
  color: #fff;
}
.plan-cta.primary:hover {
  background: #3b82f6;
}
.plan-cta:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* Empty */
.empty-state {
  text-align: center;
  padding: 60px;
  color: #6b7280;
}

/* FAQ */
.faq-section {
  border-top: 1px solid #374151;
  padding-top: 40px;
}
.faq-section h2 {
  font-size: 22px;
  margin-bottom: 24px;
  text-align: center;
}
.faq-list {
  max-width: 700px;
  margin: 0 auto;
}
.faq-item {
  margin-bottom: 20px;
}
.faq-item h4 {
  font-size: 15px;
  margin-bottom: 6px;
  color: #d1d5db;
}
.faq-item p {
  font-size: 14px;
  color: #9ca3af;
  line-height: 1.6;
}
</style>
