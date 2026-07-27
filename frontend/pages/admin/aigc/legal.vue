<template>
  <div class="admin-legal">
    <div class="admin-legal__header">
      <h1 class="admin-legal__title">法律工作台管理</h1>
    </div>

    <!-- Tabs -->
    <div class="admin-legal__tabs">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        :class="['admin-legal__tab', { 'admin-legal__tab--active': activeTab === tab.id }]"
        @click="activeTab = tab.id"
      >
        {{ tab.label }}
      </button>
    </div>

    <!-- Tab Content -->
    <div class="admin-legal__content">
      <!-- 1. 案件管理 -->
      <div v-if="activeTab === 'cases'">
        <div class="admin-legal__toolbar">
          <input v-model="caseSearch" placeholder="搜索案件名称..." class="admin-legal__search" @input="loadCases" />
        </div>
        <table class="admin-legal__table">
          <thead><tr><th>案件名称</th><th>状态</th><th>当事人</th><th>创建时间</th><th>操作</th></tr></thead>
          <tbody>
            <tr v-for="item in cases" :key="item.id">
              <td>{{ item.caseName }}</td>
              <td><span :class="'status-' + item.status">{{ statusLabel(item.status) }}</span></td>
              <td>{{ item.party || '-' }}</td>
              <td>{{ formatDate(item.createdAt) }}</td>
              <td>
                <button class="admin-legal__btn admin-legal__btn--danger" @click="deleteCase(item.id)">删除</button>
                <button class="admin-legal__btn" @click="toggleCaseStatus(item)">{{ item.status === 'active' ? '归档' : '激活' }}</button>
              </td>
            </tr>
            <tr v-if="cases.length === 0"><td colspan="5" class="empty">暂无数据</td></tr>
          </tbody>
        </table>
      </div>

      <!-- 2. 法律知识库 -->
      <div v-if="activeTab === 'knowledge'">
        <div class="admin-legal__toolbar">
          <input v-model="knowledgeSearch" placeholder="搜索知识..." class="admin-legal__search" @input="loadKnowledge" />
        </div>
        <table class="admin-legal__table">
          <thead><tr><th>标题</th><th>分类</th><th>更新</th><th>状态</th><th>操作</th></tr></thead>
          <tbody>
            <tr v-for="item in knowledgeList" :key="item.id">
              <td>{{ item.title }}</td>
              <td>{{ item.category || '-' }}</td>
              <td>{{ formatDate(item.updatedAt) }}</td>
              <td>{{ item.enabled ? '✅ 启用' : '⛔ 停用' }}</td>
              <td>
                <button class="admin-legal__btn" @click="toggleKnowledge(item)">{{ item.enabled ? '停用' : '启用' }}</button>
              </td>
            </tr>
            <tr v-if="knowledgeList.length === 0"><td colspan="5" class="empty">暂无数据</td></tr>
          </tbody>
        </table>
      </div>

      <!-- 3. 法律法规 -->
      <div v-if="activeTab === 'regulations'">
        <div class="admin-legal__toolbar">
          <input v-model="regulationSearch" placeholder="搜索法规..." class="admin-legal__search" @input="loadRegulations" />
          <button class="admin-legal__btn admin-legal__btn--primary" @click="openRegForm">+ 新增法规</button>
          <button class="admin-legal__btn admin-legal__btn--ai" @click="openAiImport">🤖 AI 批量导入</button>
          <button class="admin-legal__btn admin-legal__btn--primary" @click="reindexRag" :disabled="ragReindexing">
            {{ ragReindexing ? '重建中...' : '🔁 重新生成 Embedding' }}
          </button>
          <span v-if="ragStatus" class="admin-legal__rag-status">{{ ragStatus }}</span>
        </div>
        <table class="admin-legal__table">
          <thead><tr><th>名称</th><th>分类</th><th>标签</th><th>版本</th><th>状态</th><th>更新时间</th><th>操作</th></tr></thead>
          <tbody>
            <tr v-for="item in regulations" :key="item.id">
              <td>{{ item.title }}</td>
              <td>{{ item.category || '-' }}</td>
              <td>{{ item.tags || '-' }}</td>
              <td>{{ item.version || 'v1' }}</td>
              <td>{{ item.enabled ? '✅ 启用' : '⛔ 停用' }}</td>
              <td>{{ formatDate(item.updatedAt) }}</td>
              <td>
                <button class="admin-legal__btn" @click="editRegulation(item)">编辑</button>
                <button class="admin-legal__btn admin-legal__btn--danger" @click="deleteRegulation(item.id)">删除</button>
              </td>
            </tr>
            <tr v-if="regulations.length === 0"><td colspan="7" class="empty">暂无数据</td></tr>
          </tbody>
        </table>
        <div class="admin-legal__pagination">
          <button class="admin-legal__btn" :disabled="regPage <= 1" @click="regPage--; loadRegulations()">上一页</button>
          <span class="admin-legal__page-info">第 {{ regPage }} / {{ regTotalPages }} 页（共 {{ regTotal }} 条）</span>
          <button class="admin-legal__btn" :disabled="regPage >= regTotalPages" @click="regPage++; loadRegulations()">下一页</button>
          <span class="admin-legal__page-size">
            <select v-model="regPageSize" @change="regPage=1; loadRegulations()">
              <option :value="50">50条/页</option>
              <option :value="100">100条/页</option>
              <option :value="200">200条/页</option>
            </select>
          </span>
        </div>
      </div>

      <!-- 4. 案例管理 -->
      <div v-if="activeTab === 'caseTemplates'">
        <div class="admin-legal__toolbar">
          <input v-model="caseTemplateSearch" placeholder="搜索案例..." class="admin-legal__search" @input="loadCaseTemplates" />
        </div>
        <table class="admin-legal__table">
          <thead><tr><th>案例名称</th><th>分类</th><th>法院</th><th>年份</th><th>状态</th><th>操作</th></tr></thead>
          <tbody>
            <tr v-for="item in caseTemplates" :key="item.id">
              <td>{{ item.title || item.caseName }}</td>
              <td>{{ item.category || '-' }}</td>
              <td>{{ item.court || '-' }}</td>
              <td>{{ item.year || '-' }}</td>
              <td>{{ item.enabled ? '✅' : '⛔' }}</td>
              <td><button class="admin-legal__btn" @click="toggleCaseTemplate(item)">{{ item.enabled ? '停用' : '启用' }}</button></td>
            </tr>
            <tr v-if="caseTemplates.length === 0"><td colspan="6" class="empty">暂无数据</td></tr>
          </tbody>
        </table>
      </div>

      <!-- 5. 合同模板 -->
      <div v-if="activeTab === 'contractTemplates'">
        <div class="admin-legal__toolbar">
          <button class="admin-legal__btn admin-legal__btn--primary" @click="showContractForm = true">+ 新增</button>
        </div>
        <table class="admin-legal__table">
          <thead><tr><th>模板名称</th><th>分类</th><th>状态</th><th>操作</th></tr></thead>
          <tbody>
            <tr v-for="item in contractTemplates" :key="item.id">
              <td>{{ item.title }}</td>
              <td>{{ item.category || '-' }}</td>
              <td>{{ item.enabled ? '✅ 启用' : '⛔ 停用' }}</td>
              <td>
                <button class="admin-legal__btn" @click="editContract(item)">编辑</button>
                <button class="admin-legal__btn admin-legal__btn--danger" @click="deleteContract(item.id)">删除</button>
                <button class="admin-legal__btn" @click="toggleContract(item)">{{ item.enabled ? '停用' : '启用' }}</button>
              </td>
            </tr>
            <tr v-if="contractTemplates.length === 0"><td colspan="4" class="empty">暂无数据</td></tr>
          </tbody>
        </table>
      </div>

      <!-- 6. 法律文书模板 -->
      <div v-if="activeTab === 'documentTemplates'">
        <div class="admin-legal__toolbar">
          <button class="admin-legal__btn admin-legal__btn--primary" @click="showDocForm = true">+ 新增</button>
        </div>
        <table class="admin-legal__table">
          <thead><tr><th>模板名称</th><th>分类</th><th>状态</th><th>操作</th></tr></thead>
          <tbody>
            <tr v-for="item in documentTemplates" :key="item.id">
              <td>{{ item.title }}</td>
              <td>{{ item.category || '-' }}</td>
              <td>{{ item.enabled ? '✅ 启用' : '⛔ 停用' }}</td>
              <td>
                <button class="admin-legal__btn" @click="editDoc(item)">编辑</button>
                <button class="admin-legal__btn" @click="toggleDoc(item)">{{ item.enabled ? '停用' : '启用' }}</button>
              </td>
            </tr>
            <tr v-if="documentTemplates.length === 0"><td colspan="4" class="empty">暂无数据</td></tr>
          </tbody>
        </table>
      </div>

      <!-- 7. AI Prompt -->
      <div v-if="activeTab === 'prompts'">
        <table class="admin-legal__table">
          <thead><tr><th>名称</th><th>版本</th><th>状态</th><th>操作</th></tr></thead>
          <tbody>
            <tr v-for="item in prompts" :key="item.id">
              <td>{{ item.name }}</td>
              <td>v{{ item.version || 1 }}</td>
              <td>{{ item.enabled ? '✅ 启用' : '⛔ 停用' }}</td>
              <td>
                <button class="admin-legal__btn" @click="rollbackPrompt(item)">回滚</button>
                <button class="admin-legal__btn" @click="togglePrompt(item)">{{ item.enabled ? '停用' : '启用' }}</button>
              </td>
            </tr>
            <tr v-if="prompts.length === 0"><td colspan="4" class="empty">暂无数据</td></tr>
          </tbody>
        </table>
      </div>

      <!-- 8. 系统配置 -->
      <div v-if="activeTab === 'config'">
        <div class="admin-legal__config-form">
          <div class="admin-legal__config-row">
            <label>默认 AI 模型</label>
            <input v-model="sysConfig.defaultModel" class="admin-legal__input" />
          </div>
          <div class="admin-legal__config-row">
            <label>默认 Prompt</label>
            <textarea v-model="sysConfig.defaultPrompt" class="admin-legal__textarea" rows="3" />
          </div>
          <div class="admin-legal__config-row">
            <label>上传限制（MB）</label>
            <input v-model.number="sysConfig.uploadLimit" type="number" class="admin-legal__input" />
          </div>
          <div class="admin-legal__config-row">
            <label>OCR 开关</label>
            <select v-model="sysConfig.ocrEnabled" class="admin-legal__select">
              <option :value="true">开启</option>
              <option :value="false">关闭</option>
            </select>
          </div>
          <div class="admin-legal__config-row">
            <label>最大文件大小（MB）</label>
            <input v-model.number="sysConfig.maxFileSize" type="number" class="admin-legal__input" />
          </div>
          <div class="admin-legal__config-row">
            <label>分析参数（JSON）</label>
            <textarea v-model="sysConfig.analysisParams" class="admin-legal__textarea" rows="3" />
          </div>
          <div class="admin-legal__divider"></div>
          <h3 class="admin-legal__config-section">Embedding 向量检索</h3>
          <div class="admin-legal__config-row">
            <label>Provider <span class="admin-legal__config-hint">(选择 Embedding API 供应商)</span></label>
            <select v-model="LEGAL_EMBEDDING_PROVIDER" class="admin-legal__select" @change="onProviderChange">
              <option value="openai">OpenAI 兼容 (DashScope / OpenAI / 其他)</option>
              <option value="dashscope">DashScope (阿里云 text-embedding-v3)</option>
              <option value="deepseek">DeepSeek (LLM 特征向量，无需专用 embedding)</option>
            </select>
          </div>
          <div class="admin-legal__config-row">
            <label>Model <span class="admin-legal__config-hint">(模型名称)</span></label>
            <input v-model="LEGAL_EMBEDDING_MODEL" class="admin-legal__input" />
          </div>
          <div class="admin-legal__config-row">
            <label>API Key <span class="admin-legal__config-hint">(保存后自动注入，无需重启)</span></label>
            <div class="admin-legal__input-row">
              <input v-model="LEGAL_EMBEDDING_API_KEY" :type="keyVisible ? 'text' : 'password'" class="admin-legal__input" placeholder="sk-..." @focus="onKeyFocus" />
              <button class="admin-legal__btn" @click="keyVisible = !keyVisible" type="button">{{ keyVisible ? '隐藏' : '显示' }}</button>
              <span v-if="LEGAL_EMBEDDING_API_KEY && LEGAL_EMBEDDING_API_KEY.includes('***')" class="admin-legal__key-hint">已配置</span>
            </div>
          </div>
          <div class="admin-legal__config-row">
            <label>API Base URL <span class="admin-legal__config-hint">(v1/compatible-mode 结尾)</span></label>
            <input v-model="LEGAL_EMBEDDING_BASE_URL" class="admin-legal__input" />
          </div>
          <p class="admin-legal__config-note">💡 切换 Provider 会自动填充 Model 和 BaseURL，你也可以手动修改。选 DeepSeek 时用 LLM 提取特征做向量（准确率不如专用 embedding）。</p>
          <div class="admin-legal__divider"></div>
          <h3 class="admin-legal__config-section">AI 法律顾问对话模型</h3>
          <p class="admin-legal__config-note">⚖️ 配置后法律顾问对话使用此 LLM，留空则使用平台默认模型</p>
          <div class="admin-legal__config-row">
            <label>Model <span class="admin-legal__config-hint">(模型名称，如 deepseek-v4-flash)</span></label>
            <input v-model="LEGAL_LLM_MODEL" class="admin-legal__input" placeholder="deepseek-v4-flash" />
          </div>
          <div class="admin-legal__config-row">
            <label>API Key <span class="admin-legal__config-hint">(对话模型 API Key)</span></label>
            <div class="admin-legal__input-row">
              <input v-model="LEGAL_LLM_API_KEY" :type="llmKeyVisible ? 'text' : 'password'" class="admin-legal__input" placeholder="sk-..." @focus="onLlmKeyFocus" />
              <button class="admin-legal__btn" @click="llmKeyVisible = !llmKeyVisible" type="button">{{ llmKeyVisible ? '隐藏' : '显示' }}</button>
              <span v-if="LEGAL_LLM_API_KEY && LEGAL_LLM_API_KEY.includes('***')" class="admin-legal__key-hint">已配置</span>
            </div>
          </div>
          <div class="admin-legal__config-row">
            <label>API Base URL <span class="admin-legal__config-hint">(如 https://api.deepseek.com/v1)</span></label>
            <input v-model="LEGAL_LLM_BASE_URL" class="admin-legal__input" placeholder="https://api.deepseek.com/v1" />
          </div>
          <button class="admin-legal__btn admin-legal__btn--primary" @click="saveConfig">保存配置</button>
        </div>
      </div>
    </div>
  </div>

  <!-- 新增法规弹窗：AI 查询 -->
  <div v-if="showRegForm" class="admin-legal__overlay" @click.self="showRegForm = false">
    <div class="admin-legal__modal">
      <h3>{{ editingReg?.id ? '编辑法规' : 'AI 查询法规' }}</h3>
      <div class="admin-legal__modal-body">
        <!-- AI 查询模式（仅新增时显示） -->
        <template v-if="!editingReg?.id">
          <div class="admin-legal__fetch-row">
            <input v-model="regFetchName" class="admin-legal__input admin-legal__input--big" placeholder="输入法规名称，如：中华人民共和国劳动法" @keyup.enter="fetchRegulation" />
            <button class="admin-legal__btn admin-legal__btn--primary" @click="fetchRegulation" :disabled="regFetching">
              {{ regFetching ? '查询中...' : '🤖 AI 查询' }}
            </button>
          </div>
          <p v-if="regFetchError" class="admin-legal__fetch-error">{{ regFetchError }}</p>
          <div class="admin-legal__divider"></div>
        </template>

        <div class="admin-legal__config-row">
          <label>法规名称 *</label>
          <input v-model="regForm.title" class="admin-legal__input" placeholder="中华人民共和国XXX法" />
        </div>
        <div class="admin-legal__config-row">
          <label>分类</label>
          <select v-model="regForm.category" class="admin-legal__select">
            <option value="劳动纠纷">劳动纠纷</option>
            <option value="合同纠纷">合同纠纷</option>
            <option value="消费者权益">消费者权益</option>
            <option value="侵权纠纷">侵权纠纷</option>
            <option value="婚姻家庭">婚姻家庭</option>
            <option value="刑事诉讼">刑事诉讼</option>
            <option value="行政管理">行政管理</option>
            <option value="知识产权">知识产权</option>
            <option value="通用法律">通用法律</option>
          </select>
        </div>
        <div class="admin-legal__config-row">
          <label>标签（逗号分隔）</label>
          <input v-model="regForm.tags" class="admin-legal__input" placeholder="劳动, 合同, 工资" />
        </div>
        <div class="admin-legal__config-row">
          <label>版本</label>
          <input v-model="regForm.version" class="admin-legal__input" placeholder="2025修订版" />
        </div>
        <div class="admin-legal__config-row">
          <label>全文内容 *</label>
          <textarea v-model="regForm.content" class="admin-legal__textarea" rows="12" placeholder="输入法律法规完整条文…"></textarea>
        </div>
        <div class="admin-legal__modal-actions">
          <button class="admin-legal__btn" @click="showRegForm = false">取消</button>
          <button class="admin-legal__btn admin-legal__btn--primary" @click="saveRegulation" :disabled="!regForm.title || !regForm.content">保存</button>
        </div>
      </div>
    </div>
  </div>

  <!-- AI 批量导入弹窗 -->
  <div v-if="showAiImport" class="admin-legal__overlay" @click.self="showAiImport = false">
    <div class="admin-legal__modal">
      <h3>🤖 AI 批量导入法律条款</h3>
      <div class="admin-legal__modal-body">
        <p class="admin-legal__ai-import-desc">选择一个法律类别，AI 将自动生成该类别下最常用的法律法规条款并批量导入数据库。导入完成后自动重建 Embedding 向量索引。</p>
        <div class="admin-legal__config-row">
          <label>法律类别 *</label>
          <select v-model="aiImportCategory" class="admin-legal__select">
            <option value="劳动纠纷">劳动纠纷</option>
            <option value="合同纠纷">合同纠纷</option>
            <option value="消费者权益">消费者权益</option>
            <option value="侵权纠纷">侵权纠纷</option>
            <option value="婚姻家庭">婚姻家庭</option>
            <option value="债权债务">债权债务</option>
            <option value="房产纠纷">房产纠纷</option>
            <option value="知识产权">知识产权</option>
            <option value="行政纠纷">行政纠纷</option>
            <option value="刑事诉讼">刑事诉讼</option>
            <option value="通用法律">通用法律</option>
          </select>
        </div>
        <div v-if="aiImportResult" class="admin-legal__ai-import-result">
          <template v-if="aiImportResult.success">
            <p>✅ 导入完成！</p>
            <p>类别：{{ aiImportResult.data.category }}</p>
            <p>AI 返回 {{ aiImportResult.data.totalResponse }} 部法规</p>
            <p>成功导入 {{ aiImportResult.data.imported }} 部</p>
            <p v-if="aiImportResult.data.skipped > 0">跳过 {{ aiImportResult.data.skipped }} 部（内容不完整）</p>
            <p v-if="aiImportResult.data.embeddingTriggered">✅ 已自动重建 Embedding</p>
          </template>
          <template v-else>
            <p style="color:#ef4444;">❌ 导入失败：{{ aiImportResult.error }}</p>
          </template>
        </div>
        <div v-if="aiImportLog" class="admin-legal__ai-import-log">
          <pre>{{ aiImportLog }}</pre>
        </div>
        <div class="admin-legal__modal-actions">
          <button class="admin-legal__btn" @click="showAiImport = false">关闭</button>
          <button class="admin-legal__btn admin-legal__btn--ai" @click="startAiImport" :disabled="aiImporting || !aiImportCategory">
            {{ aiImporting ? '⏳ AI 生成中（约 15-30 秒）...' : '🤖 开始导入' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { getToken } from '~/utils/token-cache'

definePageMeta({ layout: 'admin-aigc' })

const activeTab = ref('cases')
const tabs = [
  { id: 'cases', label: '案件管理' },
  { id: 'knowledge', label: '法律知识库' },
  { id: 'regulations', label: '法律法规' },
  { id: 'caseTemplates', label: '案例管理' },
  { id: 'contractTemplates', label: '合同模板' },
  { id: 'documentTemplates', label: '法律文书模板' },
  { id: 'prompts', label: 'AI Prompt' },
  { id: 'config', label: '系统配置' },
]

// Search states
const caseSearch = ref('')
const knowledgeSearch = ref('')
const regulationSearch = ref('')
const caseTemplateSearch = ref('')

// Data
const cases = ref<any[]>([])
const knowledgeList = ref<any[]>([])
const regulations = ref<any[]>([])
const regPage = ref(1)
const regPageSize = ref(50)
const regTotal = ref(0)
const regTotalPages = computed(() => Math.ceil(regTotal.value / regPageSize.value))
const caseTemplates = ref<any[]>([])
const contractTemplates = ref<any[]>([])
const documentTemplates = ref<any[]>([])
const prompts = ref<any[]>([])
// Embedding 配置（全量可选，不硬编码任何 provider）
const LEGAL_EMBEDDING_PROVIDER = ref('openai')
const LEGAL_EMBEDDING_MODEL = ref('text-embedding-v3')
const LEGAL_EMBEDDING_API_KEY = ref('')
const LEGAL_EMBEDDING_BASE_URL = ref('')
// AI 法律顾问对话模型配置
const LEGAL_LLM_MODEL = ref('')
const LEGAL_LLM_API_KEY = ref('')
const LEGAL_LLM_BASE_URL = ref('')
const llmKeyVisible = ref(false)

/** Provider 预设，切换时更新 Model + BaseURL */
const EMBEDDING_PRESETS: Record<string, { model: string; baseURL: string }> = {
  openai:     { model: 'text-embedding-v3',      baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1' },
  dashscope:  { model: 'text-embedding-v3',      baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1' },
  deepseek:   { model: 'deepseek-v4-flash',      baseURL: 'https://api.deepseek.com' },
}
function onProviderChange() {
  const preset = EMBEDDING_PRESETS[LEGAL_EMBEDDING_PROVIDER.value]
  if (preset) {
    LEGAL_EMBEDDING_MODEL.value = preset.model
    LEGAL_EMBEDDING_BASE_URL.value = preset.baseURL
  }
}

const sysConfig = ref({
  defaultModel: 'deepseek-v4-flash',
  defaultPrompt: '',
  uploadLimit: 50,
  ocrEnabled: true,
  maxFileSize: 50,
  analysisParams: '{}',
})

const showContractForm = ref(false)
const showDocForm = ref(false)

// RAG state
const ragReindexing = ref(false)
const ragStatus = ref('')
const keyVisible = ref(false)

// 法规表单
const showRegForm = ref(false)
const editingReg = ref<any>(null)
const regForm = ref({ title: '', category: '劳动纠纷', tags: '', version: '', content: '' })
// AI 查询
const regFetchName = ref('')
const regFetching = ref(false)
const regFetchError = ref('')
// AI 批量导入
const showAiImport = ref(false)
const aiImportCategory = ref('劳动纠纷')
const aiImporting = ref(false)
const aiImportResult = ref<any>(null)
const aiImportLog = ref('')

function statusLabel(s: string) {
  const m: Record<string,string>={draft:'草稿',active:'进行中',pending:'待处理',closed:'已结案',archived:'已归档'}
  return m[s]||s
}
function formatDate(d: string) { return d ? new Date(d).toLocaleDateString('zh-CN') : '-' }

async function fetchData(url: string) {
  try {
    const token = getToken()
    const headers: Record<string, string> = {}
    if (token) headers['Authorization'] = `Bearer ${token}`
    const res = await fetch(url, { headers })
    if (res.status === 401) {
      return null // 未登录或 token 过期
    }
    const json = await res.json()
    return json.success ? (json.data || []) : []
  } catch { return [] }
}
async function fetchData2(url: string) {
  try {
    const token = getToken()
    const headers: Record<string, string> = {}
    if (token) headers['Authorization'] = `Bearer ${token}`
    const res = await fetch(url, { headers })
    const json = await res.json()
    return json.success ? json : { data: [], total: 0 }
  } catch { return { data: [], total: 0 } }
}

async function loadCases() {
  const q = caseSearch.value ? `?search=${encodeURIComponent(caseSearch.value)}` : ''
  cases.value = await fetchData(`/api/admin/legal/cases${q}`)
}
async function loadKnowledge() {
  const q = knowledgeSearch.value ? `?search=${encodeURIComponent(knowledgeSearch.value)}` : ''
  knowledgeList.value = await fetchData(`/api/admin/legal/knowledge${q}`)
}
async function loadRegulations() {
  const params = new URLSearchParams()
  if (regulationSearch.value) params.set('search', regulationSearch.value)
  params.set('page', String(regPage.value))
  params.set('pageSize', String(regPageSize.value))
  const json = await fetchData2(`/api/legal/regulations?${params.toString()}`)
  regulations.value = json.data || []
  regTotal.value = json.total || 0
}
async function loadCaseTemplates() {
  const q = caseTemplateSearch.value ? `?search=${encodeURIComponent(caseTemplateSearch.value)}` : ''
  caseTemplates.value = await fetchData(`/api/legal/case-templates${q}`)
}
async function loadContracts() { contractTemplates.value = await fetchData('/api/legal/contract-templates') }
async function loadDocs() { documentTemplates.value = await fetchData('/api/legal/document-templates') }
async function loadPrompts() { prompts.value = await fetchData('/api/admin/legal/prompts') }
async function loadConfig() {
  const data = await fetchData('/api/admin/legal/config')
  if (data === null) {
    // 401 未登录
    alert('登录已过期，请重新登录')
    window.location.href = '/admin/aigc/login'
    return
  }
  if (data && data.length === undefined) {
    // 正常配置对象
    if (data.defaultModel) sysConfig.value.defaultModel = data.defaultModel
    if (data.defaultPrompt) sysConfig.value.defaultPrompt = data.defaultPrompt
    if (data.uploadLimit) sysConfig.value.uploadLimit = data.uploadLimit
    if (data.ocrEnabled !== undefined) sysConfig.value.ocrEnabled = data.ocrEnabled
    if (data.maxFileSize) sysConfig.value.maxFileSize = data.maxFileSize
    if (data.analysisParams) sysConfig.value.analysisParams = data.analysisParams
    // Embedding 配置
    if (data.LEGAL_EMBEDDING_PROVIDER) LEGAL_EMBEDDING_PROVIDER.value = data.LEGAL_EMBEDDING_PROVIDER
    if (data.LEGAL_EMBEDDING_MODEL) LEGAL_EMBEDDING_MODEL.value = data.LEGAL_EMBEDDING_MODEL
    if (data.LEGAL_EMBEDDING_API_KEY) LEGAL_EMBEDDING_API_KEY.value = data.LEGAL_EMBEDDING_API_KEY
    if (data.LEGAL_EMBEDDING_BASE_URL) LEGAL_EMBEDDING_BASE_URL.value = data.LEGAL_EMBEDDING_BASE_URL
    // LLM 对话配置
    if (data.LEGAL_LLM_MODEL) LEGAL_LLM_MODEL.value = data.LEGAL_LLM_MODEL
    if (data.LEGAL_LLM_API_KEY) LEGAL_LLM_API_KEY.value = data.LEGAL_LLM_API_KEY
    if (data.LEGAL_LLM_BASE_URL) LEGAL_LLM_BASE_URL.value = data.LEGAL_LLM_BASE_URL
  }
}

// Actions
async function deleteCase(id: string) {
  await fetch(`/api/admin/legal/cases/${id}`, { method: 'DELETE' })
  loadCases()
}
async function toggleCaseStatus(item: any) {
  const newStatus = item.status === 'active' ? 'archived' : 'active'
  await fetch(`/api/admin/legal/cases/${item.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: newStatus }) })
  loadCases()
}
/** 焦点进入 Embedding API Key 输入框时清掉脱敏占位 */
function onKeyFocus() {
  if (LEGAL_EMBEDDING_API_KEY.value.includes('***')) {
    LEGAL_EMBEDDING_API_KEY.value = ''
  }
}
/** 焦点进入 LLM API Key 输入框时清掉脱敏占位 */
function onLlmKeyFocus() {
  if (LEGAL_LLM_API_KEY.value.includes('***')) {
    LEGAL_LLM_API_KEY.value = ''
  }
}
async function toggleKnowledge(item: any) {
  await fetch(`/api/admin/legal/knowledge/${item.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: !item.enabled }) })
  loadKnowledge()
}
function viewRegulation(item: any) { alert(`全文：${item.content || '(暂无全文)'}`) }
function editRegulation(item: any) {
  editingReg.value = item
  regForm.value = {
    title: item.title || '',
    category: item.category || '劳动纠纷',
    tags: item.tags || '',
    version: item.version || '',
    content: item.content || '',
  }
  showRegForm.value = true
}
async function deleteRegulation(id: string) {
  if (!confirm('确认删除该法规？')) return
  try {
    const token = getToken()
    const headers: Record<string, string> = {}
    if (token) headers['Authorization'] = `Bearer ${token}`
    await fetch(`/api/admin/legal/regulations/${id}`, { method: 'DELETE', headers })
    loadRegulations()
  } catch { alert('删除失败') }
}
async function saveRegulation() {
  const body = {
    title: regForm.value.title,
    category: regForm.value.category,
    tags: regForm.value.tags || null,
    version: regForm.value.version || null,
    content: regForm.value.content,
    enabled: true,
  }
  const token = getToken()
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`

  try {
    if (editingReg.value?.id) {
      await fetch(`/api/admin/legal/regulations/${editingReg.value.id}`, { method: 'PATCH', headers, body: JSON.stringify(body) })
    } else {
      await fetch('/api/admin/legal/regulations', { method: 'POST', headers, body: JSON.stringify(body) })
    }
    closeRegForm()
    loadRegulations()
  } catch { alert('保存失败') }
}

/** AI 查询法规全文 */
async function fetchRegulation() {
  const name = regFetchName.value.trim()
  if (!name) return
  regFetching.value = true
  regFetchError.value = ''
  try {
    const token = getToken()
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (token) headers['Authorization'] = `Bearer ${token}`
    const res = await fetch('/api/admin/legal/regulations/fetch', {
      method: 'POST',
      headers,
      body: JSON.stringify({ title: name }),
    })
    const json = await res.json()
    if (json.success) {
      regForm.value.title = json.data.title
      regForm.value.content = ''
      regFetchError.value = '✅ 法规已保存到数据库，可继续编辑或直接关闭'
      // 刷新列表
      loadRegulations()
      // 填入内容到表单（从数据库重新加载）
      const res2 = await fetch(`/api/legal/regulations/${json.data.id}`)
      const item = await res2.json()
      if (item.success && item.data) {
        regForm.value.title = item.data.title
        regForm.value.content = item.data.content || ''
        regForm.value.category = item.data.category || '通用法律'
        regForm.value.tags = item.data.tags || ''
        regForm.value.version = item.data.version || 'v1'
      }
    } else if (json.error?.includes('已存在')) {
      regFetchError.value = `⚠️ ${json.error}`
      if (json.data) {
        regForm.value.title = json.data.title
        regForm.value.content = json.data.content || ''
        regForm.value.category = json.data.category || '通用法律'
        regForm.value.tags = json.data.tags || ''
        regForm.value.version = json.data.version || 'v1'
      }
    } else {
      regFetchError.value = `❌ ${json.error || '查询失败'}`
    }
  } catch (err: any) {
    regFetchError.value = `❌ 请求失败: ${err.message}`
  }
  regFetching.value = false
}

function openRegForm() {
  editingReg.value = null
  regForm.value = { title: '', category: '劳动纠纷', tags: '', version: '', content: '' }
  regFetchName.value = ''
  regFetchError.value = ''
  showRegForm.value = true
}

function openAiImport() {
  aiImportCategory.value = '劳动纠纷'
  aiImportResult.value = null
  aiImportLog.value = ''
  showAiImport.value = true
}

async function startAiImport() {
  if (!aiImportCategory.value) return
  aiImporting.value = true
  aiImportResult.value = null
  aiImportLog.value = ''
  try {
    const res = await fetch('/api/admin/legal/regulation/ai-import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category: aiImportCategory.value }),
    })
    const json = await res.json()
    aiImportResult.value = json
    aiImportLog.value = ''
    // 刷新列表
    loadRegulations()
  } catch (err: any) {
    aiImportResult.value = { success: false, error: err.message }
  }
  aiImporting.value = false
}
function closeRegForm() {
  showRegForm.value = false
  editingReg.value = null
  regForm.value = { title: '', category: '劳动纠纷', tags: '', version: '', content: '' }
  regFetchName.value = ''
  regFetchError.value = ''
}
async function toggleCaseTemplate(item: any) {
  await fetch(`/api/legal/case-templates/${item.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: !item.enabled }) })
  loadCaseTemplates()
}
async function deleteContract(id: string) {
  await fetch(`/api/legal/contract-templates/${id}`, { method: 'DELETE' })
  loadContracts()
}
async function toggleContract(item: any) {
  await fetch(`/api/legal/contract-templates/${item.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: !item.enabled }) })
  loadContracts()
}
function editContract(item: any) { alert(`编辑合同模板：${item.title}\n功能即将上线`) }
async function editDoc(item: any) { alert(`编辑文书模板：${item.title}\n功能即将上线`) }
async function toggleDoc(item: any) {
  await fetch(`/api/legal/document-templates/${item.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: !item.enabled }) })
  loadDocs()
}
async function rollbackPrompt(item: any) {
  await fetch(`/api/admin/legal/prompts/${item.id}/rollback`, { method: 'POST' })
  loadPrompts()
}
async function togglePrompt(item: any) {
  await fetch(`/api/admin/legal/prompts/${item.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: !item.enabled }) })
  loadPrompts()
}
async function saveConfig() {
  const body = {
    ...sysConfig.value,
    LEGAL_EMBEDDING_PROVIDER: LEGAL_EMBEDDING_PROVIDER.value,
    LEGAL_EMBEDDING_MODEL: LEGAL_EMBEDDING_MODEL.value,
    LEGAL_EMBEDDING_API_KEY: LEGAL_EMBEDDING_API_KEY.value,
    LEGAL_EMBEDDING_BASE_URL: LEGAL_EMBEDDING_BASE_URL.value,
    LEGAL_LLM_MODEL: LEGAL_LLM_MODEL.value,
    LEGAL_LLM_API_KEY: LEGAL_LLM_API_KEY.value,
    LEGAL_LLM_BASE_URL: LEGAL_LLM_BASE_URL.value,
  }
  const token = getToken()
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch('/api/admin/legal/config', { method: 'PUT', headers, body: JSON.stringify(body) })
  if (res.status === 401) {
    alert('登录已过期，请重新登录')
    window.location.href = '/admin/aigc/login'
    return
  }
  const json = await res.json()
  if (json.success) {
    alert('配置已保存')
    // 重新加载配置以获取脱敏后的 API Key
    loadConfig()
  } else {
    alert(`保存失败: ${json.error || '未知错误'}`)
  }
}

async function reindexRag() {
  ragReindexing.value = true
  ragStatus.value = '正在重建 Embedding...'
  try {
    const token = getToken()
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (token) headers['Authorization'] = `Bearer ${token}`
    const res = await fetch('/api/admin/legal/rag/reindex', { method: 'POST', headers })
    const json = await res.json()
    if (json.success) {
      ragStatus.value = '✅ 重建任务已启动，稍后刷新查看结果'
    } else {
      ragStatus.value = `❌ 重建失败: ${json.error || '未知错误'}`
    }
  } catch (err: any) {
    ragStatus.value = `❌ 请求失败: ${err.message}`
  }
  ragReindexing.value = false
}

onMounted(() => {
  loadCases()
  loadKnowledge()
  loadRegulations()
  loadCaseTemplates()
  loadContracts()
  loadDocs()
  loadPrompts()
  loadConfig()
})
</script>

<style scoped>
.admin-legal { padding: 0; }
.admin-legal__header { margin-bottom: 24px; }
.admin-legal__title { font-size: 22px; font-weight: 700; color: #F8F6F1; margin: 0; }
.admin-legal__tabs { display: flex; gap: 4px; border-bottom: 1px solid rgba(248,246,241,0.08); margin-bottom: 24px; flex-wrap: wrap; }
.admin-legal__tab { padding: 10px 18px; font-size: 13px; background: transparent; border: none; color: rgba(248,246,241,0.5); cursor: pointer; border-bottom: 2px solid transparent; transition: all 0.15s; }
.admin-legal__tab:hover { color: rgba(248,246,241,0.7); }
.admin-legal__tab--active { color: #FBBF24; border-bottom-color: #FBBF24; }
.admin-legal__toolbar { display: flex; gap: 12px; margin-bottom: 16px; align-items: center; }
.admin-legal__search { background: rgba(248,246,241,0.05); border: 1px solid rgba(248,246,241,0.1); border-radius: 6px; padding: 8px 12px; color: #F8F6F1; font-size: 13px; width: 280px; outline: none; }
.admin-legal__search:focus { border-color: rgba(251,191,36,0.3); }
.admin-legal__table { width: 100%; border-collapse: collapse; }
.admin-legal__table th, .admin-legal__table td { text-align: left; padding: 10px 12px; border-bottom: 1px solid rgba(248,246,241,0.06); font-size: 13px; }
.admin-legal__table th { color: rgba(248,246,241,0.4); font-weight: 500; }
.admin-legal__table td { color: rgba(248,246,241,0.7); }
.admin-legal__btn { background: rgba(248,246,241,0.05); border: 1px solid rgba(248,246,241,0.1); border-radius: 5px; color: rgba(248,246,241,0.7); padding: 4px 10px; cursor: pointer; font-size: 12px; margin-right: 4px; transition: all 0.15s; }
.admin-legal__btn:hover { border-color: rgba(251,191,36,0.3); color: #FBBF24; }
.admin-legal__btn--primary { background: rgba(251,191,36,0.15); border-color: rgba(251,191,36,0.3); color: #FBBF24; }
.admin-legal__btn--primary:hover { background: rgba(251,191,36,0.25); }
.admin-legal__btn--ai { background: rgba(34,197,94,0.1); border-color: rgba(34,197,94,0.2); color: #22c55e; }
.admin-legal__btn--ai:hover { background: rgba(34,197,94,0.2); }
.admin-legal__btn--danger:hover { border-color: rgba(239,68,68,0.4); color: #EF4444; }
.admin-legal__ai-import-desc { color: rgba(248,246,241,0.5); font-size: 13px; margin: 0 0 16px; line-height: 1.6; }
.admin-legal__ai-import-result { background: rgba(34,197,94,0.04); border: 1px solid rgba(34,197,94,0.1); border-radius: 8px; padding: 12px; margin-bottom: 12px; font-size: 13px; line-height: 1.8; }
.admin-legal__ai-import-result p { margin: 0; }
.admin-legal__ai-import-log { background: rgba(0,0,0,0.2); border-radius: 6px; padding: 8px; max-height: 200px; overflow-y: auto; margin-bottom: 12px; }
.admin-legal__ai-import-log pre { margin: 0; font-size: 11px; color: rgba(248,246,241,0.5); white-space: pre-wrap; }
.admin-legal__btn:disabled { opacity: 0.5; cursor: not-allowed; }
.admin-legal__rag-status { font-size: 12px; color: rgba(248,246,241,0.5); margin-left: 8px; }
.admin-legal__pagination { display: flex; align-items: center; gap: 12px; justify-content: center; margin-top: 16px; padding-top: 12px; border-top: 1px solid rgba(248,246,241,0.06); }
.admin-legal__page-info { font-size: 13px; color: rgba(248,246,241,0.6); }
.admin-legal__page-size select { background: rgba(248,246,241,0.05); border: 1px solid rgba(248,246,241,0.1); border-radius: 5px; color: rgba(248,246,241,0.7); padding: 4px 8px; font-size: 12px; }
.admin-legal__divider { height: 1px; background: rgba(248,246,241,0.08); margin: 20px 0; }
.admin-legal__config-section { font-size: 14px; font-weight: 600; color: #F8F6F1; margin: 0 0 16px; }
.admin-legal__config-hint { font-size: 12px; color: rgba(248,246,241,0.4); font-weight: 400; }
.admin-legal__input-row { display: flex; gap: 8px; align-items: center; }
.admin-legal__input-row .admin-legal__input { flex: 1; }
.admin-legal__key-hint { font-size: 12px; color: #22c55e; }
.admin-legal__config-note { font-size: 11px; color: rgba(248,246,241,0.3); margin: 4px 0 0; }
.status-active { color: #22c55e; } .status-closed { color: #818cf8; } .status-pending { color: #FBBF24; }
.empty { text-align: center; color: rgba(248,246,241,0.3); padding: 40px; }
.admin-legal__config-form { max-width: 600px; display: flex; flex-direction: column; gap: 16px; }
.admin-legal__config-row { display: flex; flex-direction: column; gap: 4px; }
.admin-legal__config-row label { font-size: 13px; color: rgba(248,246,241,0.6); }
.admin-legal__input, .admin-legal__select { background: rgba(248,246,241,0.05); border: 1px solid rgba(248,246,241,0.1); border-radius: 6px; padding: 8px 12px; color: #F8F6F1; font-size: 13px; outline: none; }
.admin-legal__select option { background: #1C1A1A; color: #F8F6F1; }
.admin-legal__textarea { background: rgba(248,246,241,0.05); border: 1px solid rgba(248,246,241,0.1); border-radius: 6px; padding: 8px 12px; color: #F8F6F1; font-size: 13px; outline: none; resize: vertical; font-family: inherit; }
.admin-legal__input:focus, .admin-legal__textarea:focus, .admin-legal__select:focus { border-color: rgba(251,191,36,0.3); }
.admin-legal__select { cursor: pointer; }

/* 弹窗 */
.admin-legal__overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.admin-legal__modal { background: #1C1A1A; border: 1px solid rgba(248,246,241,0.1); border-radius: 12px; width: 720px; max-width: 90vw; max-height: 85vh; overflow-y: auto; padding: 24px; }
.admin-legal__modal h3 { font-size: 16px; font-weight: 600; color: #F8F6F1; margin: 0 0 20px; }
.admin-legal__modal-body { display: flex; flex-direction: column; gap: 14px; }
.admin-legal__modal-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 8px; }
</style>
