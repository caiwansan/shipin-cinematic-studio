<template>
  <div class="geo-pcw">
    <div class="geo-pcw__header">
      <h3>🚀 创建新项目</h3>
      <p class="geo-pcw__subtitle">三步完成项目创建，系统会根据你的目标自动匹配执行方案</p>
    </div>

    <div v-if="error" class="geo-pcw__error">{{ error }}</div>

    <!-- 步骤指示器 -->
    <div class="geo-pcw__steps">
      <div
        v-for="(s, idx) in wizardSteps"
        :key="s.id"
        :class="['geo-pcw__step-indicator', {
          'geo-pcw__step-indicator--active': wizardStep === idx,
          'geo-pcw__step-indicator--done': wizardStep > idx,
        }]"
      >
        <span class="geo-pcw__step-num">{{ wizardStep > idx ? '✓' : idx + 1 }}</span>
        <span class="geo-pcw__step-label">{{ s.label }}</span>
      </div>
    </div>

    <form class="geo-pcw__form" @submit.prevent="handleSubmit">

      <!-- Step 1: Goal 选择 -->
      <div v-if="wizardStep === 0" class="geo-pcw__panel">
        <h4 class="geo-pcw__panel-title">选择项目目标</h4>
        <p class="geo-pcw__panel-hint">目标决定了系统执行的方案类型</p>
        <div class="geo-pcw__goal-grid">
          <div
            v-for="g in goals"
            :key="g.id"
            :class="['geo-pcw__goal-card', { 'geo-pcw__goal-card--active': selectedGoal === g.id }]"
            @click="selectedGoal = g.id"
          >
            <span class="geo-pcw__goal-icon">{{ g.icon }}</span>
            <div class="geo-pcw__goal-info">
              <div class="geo-pcw__goal-name">{{ g.label }}</div>
              <div class="geo-pcw__goal-desc">{{ g.description }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Step 2: Recipe 选择 -->
      <div v-if="wizardStep === 1" class="geo-pcw__panel">
        <h4 class="geo-pcw__panel-title">选择执行方案</h4>
        <p class="geo-pcw__panel-hint">系统根据你的目标推荐以下方案，可选择其中一种作为项目执行模板</p>
        <div v-if="filteredRecipes.length === 0" class="geo-pcw__empty">
          当前等级下没有可用方案
        </div>
        <div v-else class="geo-pcw__recipe-list">
          <div
            v-for="r in filteredRecipes"
            :key="r.id"
            :class="['geo-pcw__recipe-card', { 'geo-pcw__recipe-card--active': selectedRecipe?.id === r.id }]"
            @click="selectedRecipe = r"
          >
            <div class="geo-pcw__recipe-name">{{ r.name }}</div>
            <div class="geo-pcw__recipe-desc">{{ r.description }}</div>
            <div class="geo-pcw__recipe-tags">
              <span class="geo-pcw__tag" v-for="t in r.tags" :key="t">{{ t }}</span>
            </div>
            <div class="geo-pcw__recipe-steps">
              <div class="geo-pcw__recipe-step" v-for="s in r.steps" :key="s.id">
                <span class="geo-pcw__recipe-step-icon">{{ s.icon }}</span>
                <span class="geo-pcw__recipe-step-label">{{ s.label }}</span>
                <span class="geo-pcw__recipe-step-tier">{{ s.requiredTier }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Step 3: Mode + 项目信息 -->
      <div v-if="wizardStep === 2" class="geo-pcw__panel">
        <h4 class="geo-pcw__panel-title">配置项目详情</h4>

        <div class="geo-pcw__mode-section">
          <label class="geo-pcw__mode-label">执行模式</label>
          <div class="geo-pcw__mode-list">
            <div
              v-for="m in availableModes"
              :key="m"
              :class="['geo-pcw__mode-option', { 'geo-pcw__mode-option--active': selectedMode === m }]"
              @click="selectedMode = m"
            >
              <span class="geo-pcw__mode-icon">{{ modeIcon(m) }}</span>
              <div class="geo-pcw__mode-info">
                <div class="geo-pcw__mode-name">{{ modeLabel(m) }}</div>
                <div class="geo-pcw__mode-desc">{{ modeDesc(m) }}</div>
              </div>
            </div>
          </div>
        </div>

        <div class="geo-pcw__divider"></div>

        <div class="geo-pcw__fields">
          <div class="geo-pcw__field">
            <label>项目名称 *</label>
            <input v-model="form.name" type="text" placeholder="例如：某品牌 GEO 优化" required />
          </div>
          <div class="geo-pcw__field-row">
            <div class="geo-pcw__field">
              <label>网站 URL</label>
              <input v-model="form.website" type="url" placeholder="https://example.com" />
            </div>
            <div class="geo-pcw__field">
              <label>行业</label>
              <input v-model="form.industry" type="text" placeholder="如：科技、零售" />
            </div>
          </div>
          <div class="geo-pcw__field-row">
            <div class="geo-pcw__field">
              <label>语言</label>
              <input v-model="form.language" type="text" placeholder="zh-CN" />
            </div>
            <div class="geo-pcw__field">
              <label>国家/地区</label>
              <input v-model="form.country" type="text" placeholder="CN" />
            </div>
          </div>
        </div>

        <div class="geo-pcw__summary">
          <div class="geo-pcw__summary-title">项目摘要</div>
          <div class="geo-pcw__summary-grid">
            <div class="geo-pcw__summary-item">
              <label>目标</label>
              <span>{{ goalDisplayName(selectedGoal) }}</span>
            </div>
            <div class="geo-pcw__summary-item">
              <label>方案</label>
              <span>{{ selectedRecipe?.name || '—' }}</span>
            </div>
            <div class="geo-pcw__summary-item">
              <label>模式</label>
              <span>{{ modeLabel(selectedMode) }}</span>
            </div>
            <div class="geo-pcw__summary-item">
              <label>步骤数</label>
              <span>{{ selectedRecipe?.steps.length || 0 }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 按钮区 -->
      <div class="geo-pcw__actions">
        <button v-if="wizardStep > 0" type="button" class="geo-pcw__btn geo-pcw__btn--back" @click="prevStep">
          上一步
        </button>
        <button v-if="wizardStep < 2" type="button" class="geo-pcw__btn geo-pcw__btn--next" @click="nextStep"
          :disabled="!canProceed">
          下一步
        </button>
        <button v-if="wizardStep === 2" type="submit" class="geo-pcw__btn geo-pcw__btn--submit" :disabled="submitting">
          {{ submitting ? '创建中...' : '创建项目' }}
        </button>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useBrandGeoStore } from '~/studio-v2/workspace/brand-geo/stores/useBrandGeoStore'
import {
  type GoalType,
  type ExecutionRecipe,
  type ExecutionMode,
  getBuiltinRecipes,
  getRecipesByGoal,
  getAccessibleRecipes,
  getAvailableModes,
  serializeRecipeConfig,
  goalDisplayName,
  goalDescription,
} from '~/utils/executionRecipe'
import { getCurrentUserTier } from '~/utils/geoCapability'

const emit = defineEmits<{
  created: [projectId: string]
  cancel: []
}>()

const store = useBrandGeoStore()
const submitting = ref(false)
const error = ref('')

// Wizard 步骤
const wizardStep = ref(0)
const wizardSteps = [
  { id: 'goal', label: '选择目标' },
  { id: 'recipe', label: '选择方案' },
  { id: 'config', label: '配置详情' },
]

// 目标定义
const goals = [
  { id: 'geo' as GoalType, icon: '🌐', label: 'GEO 知识图谱', description: '构建品牌/实体的知识图谱体系' },
  { id: 'seo' as GoalType, icon: '🔍', label: 'SEO 优化', description: '优化网站在知识图谱中的语义曝光' },
  { id: 'brand' as GoalType, icon: '🏷️', label: '品牌情报', description: '分析品牌在知识空间中的关联度' },
  { id: 'knowledge' as GoalType, icon: '📚', label: '知识构建', description: '从多源数据构建结构化知识' },
]

const selectedGoal = ref<GoalType>('geo')
const selectedRecipe = ref<ExecutionRecipe | null>(null)
const selectedMode = ref<ExecutionMode>('auto')

// 当前 tier
const userTier = getCurrentUserTier()

const filteredRecipes = computed(() => {
  return getAccessibleRecipes(userTier, selectedGoal.value)
})

const availableModes = computed(() => {
  return getAvailableModes(userTier)
})

const canProceed = computed(() => {
  if (wizardStep.value === 0) return true
  if (wizardStep.value === 1) return filteredRecipes.value.length > 0 && selectedRecipe.value !== null
  return true
})

// 表单字段
const form = reactive({
  name: '',
  website: '',
  industry: '',
  language: '',
  country: '',
})

// 模式 UI
function modeIcon(m: ExecutionMode): string {
  return { auto: '⚡', step: '👣', debug: '🔬' }[m]
}
function modeLabel(m: ExecutionMode): string {
  return { auto: '自动执行', step: '逐步推进', debug: '调试模式' }[m]
}
function modeDesc(m: ExecutionMode): string {
  return {
    auto: '系统自动执行全部步骤，无需中间确认',
    step: '每步执行后暂停，确认后继续（VIP 1+）',
    debug: '每步可查看中间结果，适合深度分析（VIP 2+）',
  }[m]
}

// 导航
function nextStep() {
  if (wizardStep.value === 0 && !selectedGoal.value) return
  if (wizardStep.value === 1) {
    // 如果用户没选，自动选第一个
    if (!selectedRecipe.value && filteredRecipes.value.length > 0) {
      selectedRecipe.value = filteredRecipes.value[0]
    }
  }
  wizardStep.value++
}

function prevStep() {
  wizardStep.value--
}

// 提交
async function handleSubmit() {
  if (!form.name.trim()) {
    error.value = '项目名称不能为空'
    return
  }

  submitting.value = true
  error.value = ''
  try {
    const recipe = selectedRecipe.value || filteredRecipes.value[0]
    const recipeConfig = recipe ? serializeRecipeConfig(recipe, selectedMode.value) : {}

    const id = await store.createV2Project({
      name: form.name.trim(),
      website: form.website.trim() || undefined,
      industry: form.industry.trim() || undefined,
      language: form.language.trim() || undefined,
      country: form.country.trim() || undefined,
      executionResults: recipeConfig as any,
    })
    if (id) {
      store.setSelectedV2ProjectId(id)
      store.setStageStatus('create_project', 'completed')
      store.setCurrentStage('edit_brand_profile')
      emit('created', id)
    } else {
      error.value = store.error.value || '创建失败'
    }
  } catch (err: any) {
    error.value = err.message
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.geo-pcw { padding: 24px; max-width: 720px; margin: 0 auto; color: #e2e8f0; }
.geo-pcw__header { margin-bottom: 20px; }
.geo-pcw__header h3 { font-size: 22px; font-weight: 700; margin: 0 0 6px; color: #e2e8f0; }
.geo-pcw__subtitle { font-size: 14px; color: #6b7280; margin: 0; }
.geo-pcw__error { background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.2); color: #fca5a5; padding: 10px 16px; border-radius: 8px; font-size: 13px; margin-bottom: 16px; }

/* Steps indicator */
.geo-pcw__steps { display: flex; gap: 8px; margin-bottom: 24px; }
.geo-pcw__step-indicator { display: flex; align-items: center; gap: 8px; flex: 1; padding: 10px 14px; border-radius: 8px; background: rgba(255,255,255,0.02); border: 1px solid #2a2a3a; }
.geo-pcw__step-indicator--active { border-color: #6366f1; background: rgba(99,102,241,0.08); }
.geo-pcw__step-indicator--done { border-color: #22c55e; background: rgba(34,197,94,0.05); }
.geo-pcw__step-num { width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; background: #2a2a3a; color: #666; flex-shrink: 0; }
.geo-pcw__step-indicator--active .geo-pcw__step-num { background: #6366f1; color: white; }
.geo-pcw__step-indicator--done .geo-pcw__step-num { background: #22c55e; color: white; }
.geo-pcw__step-label { font-size: 13px; font-weight: 600; color: #666; }
.geo-pcw__step-indicator--active .geo-pcw__step-label { color: #e2e8f0; }
.geo-pcw__step-indicator--done .geo-pcw__step-label { color: #22c55e; }

/* Panel */
.geo-pcw__panel { margin-bottom: 20px; }
.geo-pcw__panel-title { font-size: 16px; font-weight: 600; margin: 0 0 4px; }
.geo-pcw__panel-hint { font-size: 13px; color: #6b7280; margin: 0 0 16px; }
.geo-pcw__empty { padding: 20px; text-align: center; color: #666; font-size: 14px; }

/* Goal cards */
.geo-pcw__goal-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.geo-pcw__goal-card { display: flex; align-items: flex-start; gap: 12px; padding: 14px; border-radius: 8px; border: 1px solid #2a2a3a; background: rgba(255,255,255,0.02); cursor: pointer; transition: all 0.15s; }
.geo-pcw__goal-card:hover { border-color: #444; background: rgba(255,255,255,0.04); }
.geo-pcw__goal-card--active { border-color: #6366f1; background: rgba(99,102,241,0.08); }
.geo-pcw__goal-icon { font-size: 24px; line-height: 1; }
.geo-pcw__goal-info { flex: 1; }
.geo-pcw__goal-name { font-size: 14px; font-weight: 600; color: #e2e8f0; }
.geo-pcw__goal-desc { font-size: 12px; color: #6b7280; margin-top: 2px; }

/* Recipe cards */
.geo-pcw__recipe-list { display: flex; flex-direction: column; gap: 10px; }
.geo-pcw__recipe-card { padding: 14px; border-radius: 8px; border: 1px solid #2a2a3a; background: rgba(255,255,255,0.02); cursor: pointer; transition: all 0.15s; }
.geo-pcw__recipe-card:hover { border-color: #444; background: rgba(255,255,255,0.04); }
.geo-pcw__recipe-card--active { border-color: #6366f1; background: rgba(99,102,241,0.06); }
.geo-pcw__recipe-name { font-size: 15px; font-weight: 600; color: #e2e8f0; margin-bottom: 4px; }
.geo-pcw__recipe-desc { font-size: 13px; color: #6b7280; margin-bottom: 8px; }
.geo-pcw__recipe-tags { display: flex; gap: 4px; margin-bottom: 8px; }
.geo-pcw__tag { padding: 2px 8px; background: rgba(99,102,241,0.1); color: #818cf8; border-radius: 8px; font-size: 11px; }
.geo-pcw__recipe-steps { display: flex; flex-wrap: wrap; gap: 4px; }
.geo-pcw__recipe-step { display: flex; align-items: center; gap: 4px; padding: 4px 8px; background: rgba(255,255,255,0.03); border-radius: 4px; font-size: 12px; }
.geo-pcw__recipe-step-icon { font-size: 13px; }
.geo-pcw__recipe-step-label { color: #ccc; }
.geo-pcw__recipe-step-tier { color: #6b7280; font-size: 10px; font-family: monospace; }

/* Mode */
.geo-pcw__mode-section { margin-bottom: 16px; }
.geo-pcw__mode-label { font-size: 14px; font-weight: 600; display: block; margin-bottom: 8px; }
.geo-pcw__mode-list { display: flex; flex-direction: column; gap: 8px; }
.geo-pcw__mode-option { display: flex; align-items: center; gap: 10px; padding: 12px; border-radius: 8px; border: 1px solid #2a2a3a; cursor: pointer; transition: all 0.15s; }
.geo-pcw__mode-option:hover { border-color: #444; }
.geo-pcw__mode-option--active { border-color: #6366f1; background: rgba(99,102,241,0.06); }
.geo-pcw__mode-icon { font-size: 20px; }
.geo-pcw__mode-info { flex: 1; }
.geo-pcw__mode-name { font-size: 14px; font-weight: 600; color: #e2e8f0; }
.geo-pcw__mode-desc { font-size: 12px; color: #6b7280; }

/* Divider */
.geo-pcw__divider { height: 1px; background: #2a2a3a; margin: 16px 0; }

/* Fields */
.geo-pcw__fields { display: flex; flex-direction: column; gap: 12px; margin-bottom: 16px; }
.geo-pcw__field { display: flex; flex-direction: column; gap: 4px; }
.geo-pcw__field label { font-size: 12px; font-weight: 600; color: #9ca3af; }
.geo-pcw__field input { background: #11151c; border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; padding: 10px 12px; color: #e2e8f0; font-size: 14px; outline: none; }
.geo-pcw__field input:focus { border-color: #6366f1; }
.geo-pcw__field input::placeholder { color: #4b5563; }
.geo-pcw__field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }

/* Summary */
.geo-pcw__summary { padding: 14px; background: rgba(255,255,255,0.02); border-radius: 8px; border: 1px solid #2a2a3a; }
.geo-pcw__summary-title { font-size: 13px; font-weight: 600; color: #9ca3af; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
.geo-pcw__summary-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.geo-pcw__summary-item { display: flex; gap: 8px; align-items: center; }
.geo-pcw__summary-item label { font-size: 12px; color: #6b7280; min-width: 40px; }
.geo-pcw__summary-item span { font-size: 13px; color: #e2e8f0; }

/* Actions */
.geo-pcw__actions { display: flex; gap: 10px; justify-content: flex-end; }
.geo-pcw__btn { padding: 10px 20px; border-radius: 6px; font-size: 14px; font-weight: 600; cursor: pointer; border: none; transition: all 0.15s; }
.geo-pcw__btn--back { background: rgba(255,255,255,0.05); color: #9ca3af; border: 1px solid #2a2a3a; }
.geo-pcw__btn--back:hover { background: rgba(255,255,255,0.1); }
.geo-pcw__btn--next { background: rgba(99,102,241,0.15); color: #818cf8; border: 1px solid rgba(99,102,241,0.3); }
.geo-pcw__btn--next:hover { background: rgba(99,102,241,0.25); }
.geo-pcw__btn--next:disabled { opacity: 0.4; cursor: not-allowed; }
.geo-pcw__btn--submit { background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; }
.geo-pcw__btn--submit:hover { opacity: 0.9; }
.geo-pcw__btn--submit:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
