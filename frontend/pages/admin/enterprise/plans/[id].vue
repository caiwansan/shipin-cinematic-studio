<!-- /admin/enterprise/plans/[id].vue — 套餐详情 & AI员工包配置 -->
<template>
  <div class="plan-detail">
    <div class="breadcrumb">
      <a @click="$router.push('/admin/enterprise/plans')">← 套餐管理</a>
      <span class="sep">/</span>
      <span>{{ plan?.displayName || '...' }}</span>
    </div>

    <div v-if="loading" class="loading">加载中...</div>
    <div v-else-if="error" class="error">{{ error }}</div>

    <template v-else-if="plan">
      <!-- 套餐基本信息 -->
      <section class="card">
        <h2>套餐信息</h2>
        <div class="info-grid">
          <div><label>套餐名</label><strong>{{ plan.displayName }}</strong></div>
          <div><label>价格</label><strong>¥{{ (plan.price / 100).toFixed(0) }}/月</strong></div>
          <div><label>年价</label><strong>¥{{ ((plan.yearlyPrice || 0) / 100).toFixed(0) }}/年</strong></div>
          <div><label>AI员工上限</label><strong>{{ plan.maxEmployees }}</strong></div>
          <div><label>渠道上限</label><strong>{{ plan.maxChannels }}</strong></div>
          <div><label>状态</label>
            <span class="badge" :class="plan.enabled ? 'active' : 'inactive'">{{ plan.enabled ? '启用' : '停用' }}</span>
          </div>
        </div>
      </section>

      <!-- AI员工包配置 -->
      <section class="card">
        <div class="card-header">
          <h2>AI 员工包配置</h2>
          <span class="counter">{{ selectedIds.length }} / {{ plan.maxEmployees }}</span>
        </div>
        <p class="hint">选择该套餐包含的 AI 员工模板。企业订阅后将自动实例化这些员工。</p>

        <div class="template-grid">
          <label
            v-for="tpl in templates"
            :key="tpl.id"
            class="template-card"
            :class="{ selected: isSelected(tpl.id), disabled: !isSelected(tpl.id) && selectedIds.length >= plan.maxEmployees }"
          >
            <input
              type="checkbox"
              :checked="isSelected(tpl.id)"
              :disabled="!isSelected(tpl.id) && selectedIds.length >= plan.maxEmployees"
              @change="toggleTemplate(tpl)"
            />
            <div class="tpl-content">
              <div class="tpl-name">{{ tpl.name }}</div>
              <div class="tpl-role">{{ tpl.role }}</div>
              <div class="tpl-desc">{{ tpl.description }}</div>
            </div>
          </label>
        </div>

        <div v-if="selectedIds.length > 0" class="selected-list">
          <h3>已配置员工</h3>
          <div v-for="tpl in selectedTemplates" :key="tpl.id" class="selected-item">
            <span class="check">✓</span>
            <strong>{{ tpl.name }}</strong>
            <span class="role-tag">{{ tpl.role }}</span>
          </div>
        </div>

        <div class="actions">
          <button class="btn-save" :disabled="saving" @click="saveBundle">{{ saving ? '保存中...' : '保存配置' }}</button>
          <span v-if="saved" class="saved-hint">✅ 已保存</span>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup>
const route = useRoute()

const plan = ref(null)
const templates = ref([])
const selectedIds = ref([])
const loading = ref(true)
const saving = ref(false)
const error = ref('')
const saved = ref(false)

onMounted(async () => {
  try {
    const res = await fetch(`/api/admin/enterprise/plans/${route.params.id}`, {
      headers: { Authorization: `Bearer ${getAdminToken()}` },
    })
    const data = await res.json()
    if (data.success) {
      plan.value = data.data.plan
      templates.value = data.data.templates || []
      selectedIds.value = (data.data.plan.agentBundle || []).map((a) => a.templateId)
    } else {
      error.value = data.message || '加载失败'
    }
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
})

function isSelected(id) {
  return selectedIds.value.includes(id)
}

function toggleTemplate(tpl) {
  const idx = selectedIds.value.indexOf(tpl.id)
  if (idx >= 0) {
    selectedIds.value.splice(idx, 1)
  } else {
    if (selectedIds.value.length >= plan.value.maxEmployees) return
    selectedIds.value.push(tpl.id)
  }
  saved.value = false
}

const selectedTemplates = computed(() =>
  templates.value.filter((t) => selectedIds.value.includes(t.id))
)

async function saveBundle() {
  saving.value = true
  try {
    const agentBundle = selectedIds.value.map((id) => {
      const tpl = templates.value.find((t) => t.id === id)
      return { templateId: id, name: tpl?.name, role: tpl?.role }
    })

    const res = await fetch(`/api/admin/enterprise/plans/${route.params.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getAdminToken()}` },
      body: JSON.stringify({ agentBundle }),
    })
    const data = await res.json()
    if (data.success) {
      saved.value = true
      plan.value = data.data
    } else {
      alert(data.message || '保存失败')
    }
  } catch (e) {
    alert(e.message)
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.plan-detail { padding: 24px; color: #e0e0e0; max-width: 900px; margin: 0 auto; }
.breadcrumb { margin-bottom: 20px; font-size: 14px; color: #9ca3af; }
.breadcrumb a { cursor: pointer; color: #3b82f6; }
.breadcrumb a:hover { text-decoration: underline; }
.sep { margin: 0 8px; }
.card { background: #1a1f2e; border: 1px solid #2d3748; border-radius: 12px; padding: 20px; margin-bottom: 20px; }
.card h2 { font-size: 18px; margin-bottom: 12px; }
.card-header { display: flex; align-items: center; justify-content: space-between; }
.counter { font-size: 14px; color: #9ca3af; }
.hint { font-size: 13px; color: #6b7280; margin-bottom: 16px; }
.info-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
.info-grid label { display: block; font-size: 12px; color: #6b7280; margin-bottom: 4px; }
.badge { padding: 2px 10px; border-radius: 6px; font-size: 12px; }
.badge.active { background: #065f46; color: #6ee7b7; }
.badge.inactive { background: #7f1d1d; color: #fca5a5; }
.template-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 12px; }
.template-card { display: flex; align-items: flex-start; gap: 10px; padding: 14px; border: 2px solid #374151; border-radius: 10px; cursor: pointer; transition: all 0.15s; }
.template-card:hover { border-color: #4b5563; }
.template-card.selected { border-color: #3b82f6; background: #1e3a5f; }
.template-card.disabled { opacity: 0.4; cursor: not-allowed; }
.template-card input { margin-top: 2px; cursor: pointer; }
.tpl-name { font-weight: 600; font-size: 14px; }
.tpl-role { font-size: 12px; color: #60a5fa; margin: 2px 0; }
.tpl-desc { font-size: 12px; color: #9ca3af; }
.selected-list { margin-top: 20px; border-top: 1px solid #374151; padding-top: 16px; }
.selected-list h3 { font-size: 14px; margin-bottom: 10px; }
.selected-item { display: flex; align-items: center; gap: 8px; padding: 6px 0; }
.check { color: #34d399; }
.role-tag { font-size: 11px; padding: 1px 8px; background: #1e3a5f; border-radius: 4px; color: #60a5fa; }
.actions { margin-top: 20px; display: flex; align-items: center; gap: 12px; }
.btn-save { padding: 10px 28px; background: #3b82f6; border: none; border-radius: 8px; color: white; font-weight: 600; cursor: pointer; }
.btn-save:disabled { opacity: 0.5; cursor: not-allowed; }
.saved-hint { color: #34d399; font-size: 14px; }
.loading, .error { padding: 40px; text-align: center; }
.error { color: #ef4444; }
</style>
