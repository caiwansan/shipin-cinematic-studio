<!--
  Admin: 求职管家 Agent 配置
  位置：/admin/recruitment/config.vue
  职责：管理平台提供的招聘 AI Agent「产品定义」（基础信息 / 能力 / Prompt 模板 / 版本）

  Sprint-ADMIN-IA-RECRUITMENT-CLEANUP-01 T02/T03：
  - 重构前：Provider / 模型 / API Key 配置（模型管理，错误方向）
  - 重构后：产品定义视图。模型不在此处管理——
    ❌ DeepSeek API Key / OpenAI Key / 模型健康 / Provider（属「大模型管理」或用户自己的模型设置）
    ✅ 用户/企业模型配置 → Runtime Resolver → Agent 执行（昆仑镜统一架构）

  数据源：
  - GET /api/admin/recruitment/agent-product → 产品定义（只读）
-->
<template>
  <RecruitmentPageShell>
    <template #title>🧠 求职管家 Agent 配置</template>
    <template #subtitle>平台招聘 AI Agent 产品定义 · 管理「产品」不管理「模型」</template>
    <template #actions>
      <button class="rec-btn" @click="loadData" :disabled="loading">
        <span v-if="!loading">🔄 刷新</span>
        <span v-else>加载中...</span>
      </button>
    </template>

    <!-- Loading -->
    <div v-if="loading" class="rec-loading">
      <div class="rec-spinner"></div>
      <span>加载产品定义中...</span>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="rec-error">
      <span>⚠️ {{ error }}</span>
      <button class="rec-link" @click="loadData">重试</button>
    </div>

    <template v-else-if="product">
      <!-- ═══ 基础信息 ═══ -->
      <section class="rec-section-card">
        <h3 class="rec-section-title">基础信息</h3>
        <div class="rec-basic-grid">
          <div class="rec-basic-item">
            <span class="rec-basic-label">Agent 名称</span>
            <span class="rec-basic-value">{{ product.base.name }}（{{ product.base.displayName }}）</span>
          </div>
          <div class="rec-basic-item">
            <span class="rec-basic-label">Agent 头像</span>
            <span class="rec-basic-value">{{ product.base.avatar }}</span>
          </div>
          <div class="rec-basic-item">
            <span class="rec-basic-label">状态</span>
            <span class="rec-basic-value"><span class="rec-status-pill rec-status-active">● 已启用</span></span>
          </div>
          <div class="rec-basic-item">
            <span class="rec-basic-label">服务对象</span>
            <span class="rec-basic-value">{{ product.base.audience }}</span>
          </div>
          <div class="rec-basic-item rec-basic-wide">
            <span class="rec-basic-label">Agent 介绍</span>
            <span class="rec-basic-value">{{ product.base.description }}</span>
          </div>
          <div class="rec-basic-item rec-basic-wide">
            <span class="rec-basic-label">模型策略</span>
            <span class="rec-basic-value rec-model-policy">{{ product.base.modelPolicy }}</span>
          </div>
        </div>
      </section>

      <!-- ═══ 能力 ═══ -->
      <section class="rec-section-card">
        <h3 class="rec-section-title">能力</h3>
        <div class="rec-cap-grid">
          <div v-for="cap in product.capabilities" :key="cap.code" class="rec-cap-item">
            <div class="rec-cap-head">
              <span class="rec-cap-name">{{ cap.name }}</span>
              <span class="rec-cap-code">{{ cap.code }}</span>
              <span class="rec-status-pill rec-status-active">启用</span>
            </div>
            <p class="rec-cap-desc">{{ cap.desc }}</p>
          </div>
        </div>
      </section>

      <!-- ═══ Prompt 模板 ═══ -->
      <section class="rec-section-card">
        <h3 class="rec-section-title">Prompt 模板</h3>
        <div class="rec-prompt-meta">
          <span class="rec-basic-label">当前版本</span>
          <span class="rec-version-tag">v1 · 当前线上</span>
          <span class="rec-basic-label" style="margin-left:16px">管理方式</span>
          <span class="rec-basic-value">代码发布管理（STATIC_SYSTEM_PROMPT · KV Cache 友好）</span>
        </div>
        <div class="rec-prompt-box">
          <pre class="rec-prompt-pre">{{ currentPrompt }}</pre>
        </div>
      </section>

      <!-- ═══ 版本管理 ═══ -->
      <section class="rec-section-card">
        <h3 class="rec-section-title">版本管理</h3>
        <table class="rec-version-table">
          <thead>
            <tr>
              <th>版本</th>
              <th>说明</th>
              <th>状态</th>
              <th>发布时间</th>
              <th>备注</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="v in product.versions" :key="v.version">
              <td><span class="rec-version-tag">{{ v.version }}</span></td>
              <td>{{ v.label }}</td>
              <td>
                <span class="rec-status-pill" :class="v.status === 'released' ? 'rec-status-active' : 'rec-status-planned'">
                  {{ v.status === 'released' ? '已发布' : '规划中' }}
                </span>
              </td>
              <td>{{ v.releasedAt || '—' }}</td>
              <td class="rec-version-note">{{ v.note }}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <!-- ═══ 模型配置说明（删除区域） ═══ -->
      <section class="rec-section-card rec-model-note">
        <h3 class="rec-section-title">🔒 模型配置（已移除）</h3>
        <p class="rec-model-note-text">
          招聘后台不再管理模型 / Provider / API Key。企业用户使用的 AI 员工，配置的大模型通过
          <strong>用户模型设置（UserModelConfigV2）→ Runtime Resolver → Agent 执行</strong> 映射，
          与短剧 / 小说工作台共用同一套昆仑镜统一模型架构。平台模型配置请前往
          <NuxtLink to="/admin/aigc/models" class="rec-link">🤖 大模型管理</NuxtLink>。
        </p>
      </section>
    </template>
  </RecruitmentPageShell>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { getAuthToken } from '~/utils/auth/token'
import RecruitmentPageShell from '~/components/enterprise/recruitment/ui/RecruitmentPageShell.vue'
definePageMeta({ layout: 'admin-aigc' })

interface AgentProduct {
  base: {
    name: string
    displayName: string
    avatar: string
    description: string
    status: string
    audience: string
    modelPolicy: string
  }
  capabilities: Array<{ code: string; name: string; desc: string; enabled: boolean }>
  versions: Array<{ version: string; label: string; status: string; releasedAt: string | null; note: string; content: string }>
}

const loading = ref(true)
const error = ref('')
const product = ref<AgentProduct | null>(null)

const currentPrompt = computed(() => {
  const released = product.value?.versions.find(v => v.status === 'released')
  return released?.content || '（暂无提示词内容）'
})

async function loadData() {
  loading.value = true
  error.value = ''
  try {
    const token = getAuthToken() || ''
    const headers: Record<string, string> = {}
    if (token) headers['Authorization'] = `Bearer ${token}`
    const res = await fetch('/api/admin/recruitment/agent-product', { headers })
    const json = await res.json()
    if (!res.ok || !json.success) throw new Error(json.message || `HTTP ${res.status}`)
    product.value = json.data
  } catch (e: any) {
    error.value = e.message || '加载失败'
  } finally {
    loading.value = false
  }
}

onMounted(loadData)
</script>

<style scoped>
.rec-section-card {
  background: var(--color-bg-secondary, #0F1526);
  border: 1px solid var(--color-border-primary, #1E293B);
  border-radius: 12px;
  padding: 20px;
}

.rec-section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary, #F1F5F9);
  margin: 0 0 14px;
}

.rec-basic-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 12px 20px;
}

.rec-basic-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.rec-basic-wide {
  grid-column: 1 / -1;
}

.rec-basic-label {
  font-size: 11px;
  color: var(--color-text-secondary, #94A3B8);
}

.rec-basic-value {
  font-size: 13px;
  color: var(--color-text-primary, #F1F5F9);
  line-height: 1.5;
}

.rec-model-policy {
  color: #38BDF8;
}

.rec-status-pill {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 99px;
  font-size: 11px;
  font-weight: 500;
}

.rec-status-active {
  background: rgba(34, 197, 94, 0.15);
  color: #4ADE80;
}

.rec-status-planned {
  background: rgba(148, 163, 184, 0.15);
  color: #94A3B8;
}

.rec-cap-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 12px;
}

.rec-cap-item {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 10px;
  padding: 14px;
}

.rec-cap-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.rec-cap-name {
  font-size: 13px;
  font-weight: 600;
  color: #F1F5F9;
}

.rec-cap-code {
  font-size: 10px;
  color: #64748B;
  font-family: monospace;
}

.rec-cap-desc {
  font-size: 12px;
  color: #94A3B8;
  margin: 0;
  line-height: 1.6;
}

.rec-prompt-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.rec-version-tag {
  font-size: 11px;
  font-weight: 600;
  color: #38BDF8;
  background: rgba(56, 189, 248, 0.12);
  border: 1px solid rgba(56, 189, 248, 0.25);
  padding: 2px 10px;
  border-radius: 6px;
  font-family: monospace;
}

.rec-prompt-box {
  background: #0A0F1E;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 10px;
  max-height: 320px;
  overflow-y: auto;
  padding: 14px;
}

.rec-prompt-pre {
  margin: 0;
  font-size: 11px;
  line-height: 1.7;
  color: #CBD5E1;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}

.rec-version-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.rec-version-table th {
  text-align: left;
  padding: 8px 10px;
  color: #64748B;
  font-weight: 500;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  font-size: 11px;
}

.rec-version-table td {
  padding: 10px;
  color: #CBD5E1;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}

.rec-version-note {
  color: #64748B;
  font-size: 11px;
}

.rec-model-note {
  border-color: rgba(245, 158, 11, 0.25);
  background: rgba(245, 158, 11, 0.04);
}

.rec-model-note-text {
  font-size: 12px;
  color: #94A3B8;
  line-height: 1.8;
  margin: 0;
}

.rec-model-note-text strong {
  color: #FBBF24;
}

.rec-link {
  color: #38BDF8;
  text-decoration: none;
  font-size: 12px;
}

.rec-link:hover {
  text-decoration: underline;
}
</style>
