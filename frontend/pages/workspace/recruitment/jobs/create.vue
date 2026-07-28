<template>
  <div class="create-job-page">
    <!-- Top Navigation Bar -->
    <div class="create-job-top-nav">
      <button @click="goBack" class="create-job-nav-btn">
        ← 返回 AI 招聘中心
      </button>
      <WorkspaceSwitcher />
    </div>

    <!-- Page Header -->
    <div class="create-job-header">
      <h1 class="create-job-title">➕ 创建岗位</h1>
      <p class="create-job-subtitle">粘贴 JD 或手动输入，AI 自动解析岗位要求</p>
    </div>

    <!-- Main Content: Two Columns -->
    <div class="create-job-body">
      <!-- Left Column: JD Input -->
      <div class="jd-input-panel">
        <div class="panel-header">
          <h2>📝 输入 JD</h2>
        </div>
        <textarea
          v-model="jdText"
          class="jd-textarea"
          placeholder="粘贴岗位 JD 或手动输入...&#10;&#10;例如：&#10;高级前端工程师&#10;&#10;岗位职责：&#10;1. 负责公司 SaaS 平台前端开发&#10;2. 参与技术方案设计&#10;&#10;任职要求：&#10;1. 本科及以上学历，计算机相关专业&#10;2. 5年以上前端开发经验&#10;3. 精通 Vue3、TypeScript&#10;4. 有 Node.js 后端经验优先"
          :disabled="isExtracting"
        ></textarea>

        <div class="jd-actions">
          <button
            class="ai-extract-btn"
            @click="handleExtract"
            :disabled="!jdText.trim() || isExtracting"
          >
            <span v-if="isExtracting" class="btn-loading">
              <span class="spinner"></span>
              AI 解析中...
            </span>
            <span v-else>🤖 AI 解析 JD</span>
          </button>
          <button
            class="clear-btn"
            @click="handleClear"
            :disabled="isExtracting"
          >
            🗑 清空
          </button>
        </div>

        <!-- Error Message -->
        <div v-if="extractError" class="extract-error">
          <span class="error-icon">⚠️</span>
          <span>{{ extractError }}</span>
        </div>
      </div>

      <!-- Right Column: AI Extracted Result -->
      <div class="extract-result-panel">
        <div class="panel-header">
          <h2>🤖 AI 解析结果</h2>
        </div>

        <!-- Empty State -->
        <div v-if="!extracted && !isExtracting" class="extract-empty">
          <div class="empty-icon">📋</div>
          <p>在左侧输入 JD 后</p>
          <p>点击"AI 解析 JD"按钮</p>
          <button class="manual-fill-btn" @click="handleManualFill">
            ✏️ 手动填写岗位要求
          </button>
        </div>

        <!-- Loading Skeleton -->
        <div v-else-if="isExtracting" class="extract-skeleton">
          <div class="skeleton-line w-60"></div>
          <div class="skeleton-line w-40"></div>
          <div class="skeleton-tags">
            <div class="skeleton-tag"></div>
            <div class="skeleton-tag"></div>
            <div class="skeleton-tag"></div>
          </div>
          <div class="skeleton-line w-50"></div>
          <div class="skeleton-line w-30"></div>
        </div>

        <!-- Extracted Result -->
        <div v-else-if="extracted" class="extract-result">
          <!-- Job Title -->
          <div class="result-field">
            <label>职位名称</label>
            <input
              v-model="extracted.title"
              class="result-input"
              placeholder="职位名称"
            />
          </div>

          <!-- Required Skills -->
          <div class="result-field">
            <label>核心技能</label>
            <div class="skill-tags">
              <span
                v-for="(skill, idx) in extracted.requiredSkills"
                :key="'req-' + idx"
                class="skill-tag required"
              >
                {{ skill.name }}
                <small class="skill-level">L{{ skill.level }}</small>
                <button class="tag-remove" @click="removeRequiredSkill(idx)">×</button>
              </span>
            </div>
            <div class="add-skill-row">
              <input
                v-model="newRequiredSkill"
                class="add-skill-input"
                placeholder="添加技能..."
                @keyup.enter="addRequiredSkill"
              />
              <select v-model="newRequiredSkillLevel" class="add-skill-level">
                <option :value="1">L1</option>
                <option :value="2">L2</option>
                <option :value="3">L3</option>
                <option :value="4">L4</option>
              </select>
              <button class="add-skill-btn" @click="addRequiredSkill">+</button>
            </div>
          </div>

          <!-- Preferred Skills -->
          <div class="result-field">
            <label>加分技能</label>
            <div class="skill-tags">
              <span
                v-for="(skill, idx) in extracted.preferredSkills"
                :key="'pref-' + idx"
                class="skill-tag preferred"
              >
                {{ skill.name }}
                <small class="skill-level">L{{ skill.level }}</small>
                <button class="tag-remove" @click="removePreferredSkill(idx)">×</button>
              </span>
            </div>
            <div class="add-skill-row">
              <input
                v-model="newPreferredSkill"
                class="add-skill-input"
                placeholder="添加加分技能..."
                @keyup.enter="addPreferredSkill"
              />
              <select v-model="newPreferredSkillLevel" class="add-skill-level">
                <option :value="1">L1</option>
                <option :value="2">L2</option>
                <option :value="3">L3</option>
                <option :value="4">L4</option>
              </select>
              <button class="add-skill-btn" @click="addPreferredSkill">+</button>
            </div>
          </div>

          <!-- Experience & Education Row -->
          <div class="result-row">
            <div class="result-field half">
              <label>经验要求</label>
              <select v-model="extracted.experienceMin" class="result-select">
                <option :value="undefined">不限</option>
                <option :value="1">1年以上</option>
                <option :value="3">3年以上</option>
                <option :value="5">5年以上</option>
                <option :value="8">8年以上</option>
                <option :value="10">10年以上</option>
              </select>
            </div>
            <div class="result-field half">
              <label>学历要求</label>
              <select v-model="extracted.educationLevel" class="result-select">
                <option :value="undefined">不限</option>
                <option value="大专">大专</option>
                <option value="本科">本科</option>
                <option value="硕士">硕士</option>
                <option value="博士">博士</option>
              </select>
            </div>
          </div>

          <!-- Level & Location Row -->
          <div class="result-row">
            <div class="result-field half">
              <label>岗位级别</label>
              <select v-model="extracted.departmentLevel" class="result-select">
                <option :value="undefined">不限</option>
                <option value="Junior">初级</option>
                <option value="Mid">中级</option>
                <option value="Senior">高级</option>
                <option value="Lead">负责人</option>
                <option value="Director">总监</option>
              </select>
            </div>
            <div class="result-field half">
              <label>工作地点</label>
              <input
                v-model="extracted.location"
                class="result-input"
                placeholder="如：北京"
              />
            </div>
          </div>

          <!-- Model Used Badge -->
          <div v-if="extracted.modelUsed" class="model-badge">
            <span>由 AI 模型提取: {{ extracted.modelUsed }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Footer Actions -->
    <div class="create-job-footer">
      <button class="footer-btn-secondary" @click="goBack">
        取消
      </button>
      <button
        class="footer-btn-primary"
        @click="handleSave"
        :disabled="!extracted || isSaving"
      >
        <span v-if="isSaving" class="btn-loading">
          <span class="spinner"></span>
          保存中...
        </span>
        <span v-else>💾 保存并发布匹配</span>
      </button>
    </div>

    <!-- Success Modal -->
    <div v-if="showSuccess" class="modal-overlay" @click.self="showSuccess = false">
      <div class="modal-card">
        <div class="modal-icon">✅</div>
        <h2>岗位创建成功！</h2>
        <p>岗位已保存为草稿状态，可在招聘工作台查看和管理。</p>
        <div class="modal-actions">
          <button class="footer-btn-primary" @click="goToJobDetail">
                返回招聘工作台
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { extractRequirement, createPosting } from '~/studio-v2/api/recruitment-api'

// ─── Navigation ───
// Sprint 07 Week 1: 统一入口 — 返回企业工作台
function goBack() {
  window.location.href = '/workspace/enterprise'
}

const createdJobId = ref('')

function goToJobDetail() {
  // 岗位详情页尚未建设，返回企业工作台
  window.location.href = '/workspace/enterprise'
}

// ─── State ───
const jdText = ref('')
const isExtracting = ref(false)
const isSaving = ref(false)
const extractError = ref('')
const extracted = ref<any>(null)
const showSuccess = ref(false)
const newRequiredSkill = ref('')
const newPreferredSkill = ref('')
const newRequiredSkillLevel = ref(2)
const newPreferredSkillLevel = ref(2)

// ─── Extract JD ───
async function handleExtract() {
  if (!jdText.value.trim()) return

  isExtracting.value = true
  extractError.value = ''
  extracted.value = null

  try {
    const result = await extractRequirement(jdText.value)
    extracted.value = {
      title: result.title || '',
      description: result.description || '',
      // 技能是 {name, level}[] 对象数组
      requiredSkills: (result.requiredSkills || []).map((s: any) => typeof s === 'string' ? { name: s, level: 2 } : { name: s.name, level: s.level || 2 }),
      preferredSkills: (result.preferredSkills || []).map((s: any) => typeof s === 'string' ? { name: s, level: 2 } : { name: s.name, level: s.level || 2 }),
      experienceMin: result.experienceMin,
      experienceMax: result.experienceMax,
      educationLevel: result.educationLevel,
      salaryMin: result.salaryMin,
      salaryMax: result.salaryMax,
      location: result.location || '',
      departmentLevel: result.departmentLevel || '',
      jobType: result.employmentType || result.jobType || '',
      modelUsed: result.modelUsed || '',
    }
  } catch (e: any) {
    // LLM 不可用时降级提示
    if (e.message?.includes('502') || e.message?.includes('503') || e.message?.includes('LLM')) {
      extractError.value = 'AI 暂不可用，请手动填写岗位要求'
    } else {
      extractError.value = e.message || 'AI 解析失败，请重试或手动填写'
    }
  } finally {
    isExtracting.value = false
  }
}

// ─── Manual Fill (AI 不可用时的降级方案) ───
function handleManualFill() {
  extracted.value = {
    title: jdText.value.split('\n')[0]?.trim() || '',
    description: jdText.value || '',
    requiredSkills: [],
    preferredSkills: [],
    experienceMin: undefined,
    experienceMax: undefined,
    educationLevel: undefined,
    salaryMin: undefined,
    salaryMax: undefined,
    location: '',
    departmentLevel: undefined,
    jobType: undefined,
    modelUsed: '',
  }
}

// ─── Clear ───
function handleClear() {
  jdText.value = ''
  extracted.value = null
  extractError.value = ''
}

// ─── Skill Management ───
function addRequiredSkill() {
  const skill = newRequiredSkill.value.trim()
  if (skill && extracted.value && !extracted.value.requiredSkills.find((s: any) => s.name === skill)) {
    extracted.value.requiredSkills.push({ name: skill, level: newRequiredSkillLevel.value })
  }
  newRequiredSkill.value = ''
}

function removeRequiredSkill(idx: number) {
  extracted.value?.requiredSkills.splice(idx, 1)
}

function addPreferredSkill() {
  const skill = newPreferredSkill.value.trim()
  if (skill && extracted.value && !extracted.value.preferredSkills.find((s: any) => s.name === skill)) {
    extracted.value.preferredSkills.push({ name: skill, level: newPreferredSkillLevel.value })
  }
  newPreferredSkill.value = ''
}

function removePreferredSkill(idx: number) {
  extracted.value?.preferredSkills.splice(idx, 1)
}

// ─── Save ───
async function handleSave() {
  if (!extracted.value) return

  isSaving.value = true
  try {
    // 技能 {name, level}[] → string[]
    const skillNames = (extracted.value.requiredSkills || [])
      .map((s: any) => typeof s === 'string' ? s : s.name)
      .filter(Boolean)

    const result = await createPosting({
      title: extracted.value.title,
      description: extracted.value.description,
      requirements: extracted.value.description, // 任职要求 → description
      salary: extracted.value.salaryMin ? `${extracted.value.salaryMin}-${extracted.value.salaryMax}K` : undefined,
      location: extracted.value.location,
      skillRequirements: skillNames,
      status: 'draft', // 默认草稿，用户手动发布
    })

    // POST /api/enterprise/postings 返回 { success: true, data: job }
    if (result.success && result.data) {
      createdJobId.value = result.data.id
      showSuccess.value = true
    } else {
      throw new Error('创建失败，请重试')
    }
  } catch (e: any) {
    extractError.value = e.message || '保存失败，请重试'
  } finally {
    isSaving.value = false
  }
}
</script>

<style scoped>
.create-job-page {
  min-height: 100vh;
  background: #0a0f1e;
  color: #e0e0e0;
  display: flex;
  flex-direction: column;
}

/* ─── Top Nav ─── */
.create-job-top-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 24px;
  background: #0d1220;
  border-bottom: 1px solid #1a2240;
}

.create-job-nav-btn {
  padding: 8px 16px;
  font-size: 0.85rem;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  transition: all 0.15s;
}

.create-job-nav-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

/* ─── Header ─── */
.create-job-header {
  padding: 24px 24px 16px;
  border-bottom: 1px solid #1a2240;
}

.create-job-title {
  margin: 0;
  font-size: 1.4rem;
  font-weight: 700;
  color: #fff;
}

.create-job-subtitle {
  margin: 4px 0 0;
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.5);
}

/* ─── Body ─── */
.create-job-body {
  flex: 1;
  display: flex;
  gap: 20px;
  padding: 20px 24px;
  min-height: 0;
}

/* ─── Left Panel: JD Input ─── */
.jd-input-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: #0d1220;
  border: 1px solid #1a2240;
  border-radius: 12px;
  overflow: hidden;
}

.panel-header {
  padding: 16px 20px;
  border-bottom: 1px solid #1a2240;
}

.panel-header h2 {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.85);
}

.jd-textarea {
  flex: 1;
  padding: 20px;
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.85);
  font-size: 0.88rem;
  line-height: 1.6;
  resize: none;
  outline: none;
  font-family: inherit;
  min-height: 300px;
}

.jd-textarea::placeholder {
  color: rgba(255, 255, 255, 0.25);
}

.jd-textarea:focus {
  background: rgba(255, 255, 255, 0.02);
}

.jd-actions {
  display: flex;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid #1a2240;
}

.ai-extract-btn {
  flex: 1;
  padding: 12px 20px;
  font-size: 0.9rem;
  font-weight: 600;
  background: linear-gradient(135deg, #60a5fa, #3b82f6);
  border: none;
  border-radius: 8px;
  color: #fff;
  cursor: pointer;
  transition: box-shadow 0.15s;
}

.ai-extract-btn:hover:not(:disabled) {
  box-shadow: 0 4px 16px rgba(96, 165, 250, 0.3);
}

.ai-extract-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.clear-btn {
  padding: 12px 16px;
  font-size: 0.85rem;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: rgba(255, 255, 255, 0.6);
  cursor: pointer;
  transition: all 0.15s;
}

.clear-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.extract-error {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  margin: 0 16px 12px;
  background: rgba(245, 158, 11, 0.1);
  border: 1px solid rgba(245, 158, 11, 0.3);
  border-radius: 8px;
  font-size: 0.82rem;
  color: #f59e0b;
}

/* ─── Right Panel: Extract Result ─── */
.extract-result-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: #0d1220;
  border: 1px solid #1a2240;
  border-radius: 12px;
  overflow: hidden;
}

.extract-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.3);
  gap: 4px;
}

.extract-empty .empty-icon {
  font-size: 2.5rem;
  margin-bottom: 8px;
}

.extract-empty p {
  margin: 0;
  font-size: 0.85rem;
}

.manual-fill-btn {
  margin-top: 16px;
  padding: 10px 20px;
  font-size: 0.85rem;
  font-weight: 600;
  background: rgba(96, 165, 200, 0.12);
  border: 1px solid rgba(96, 165, 200, 0.3);
  border-radius: 8px;
  color: #60a5fa;
  cursor: pointer;
  transition: all 0.15s;
}

.manual-fill-btn:hover {
  background: rgba(96, 165, 200, 0.2);
  box-shadow: 0 2px 12px rgba(96, 165, 200, 0.15);
}

/* ─── Skeleton ─── */
.extract-skeleton {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.skeleton-line {
  height: 16px;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 4px;
  animation: shimmer 1.5s infinite;
}

.skeleton-tags {
  display: flex;
  gap: 8px;
}

.skeleton-tag {
  width: 60px;
  height: 28px;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 14px;
  animation: shimmer 1.5s infinite;
}

.w-60 { width: 60%; }
.w-50 { width: 50%; }
.w-40 { width: 40%; }
.w-30 { width: 30%; }

@keyframes shimmer {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 0.8; }
}

/* ─── Result Form ─── */
.extract-result {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.result-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.result-field label {
  font-size: 0.78rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.5);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.result-input {
  padding: 8px 12px;
  font-size: 0.88rem;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  color: rgba(255, 255, 255, 0.85);
  outline: none;
  transition: border-color 0.15s;
}

.result-input:focus {
  border-color: rgba(96, 165, 250, 0.4);
}

.result-select {
  padding: 8px 12px;
  font-size: 0.88rem;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  color: rgba(255, 255, 255, 0.85);
  outline: none;
  cursor: pointer;
}

.result-row {
  display: flex;
  gap: 12px;
}

.result-field.half {
  flex: 1;
}

/* ─── Skill Tags ─── */
.skill-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.skill-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  font-size: 0.78rem;
  border-radius: 14px;
  font-weight: 500;
}

.skill-tag.required {
  background: rgba(96, 165, 250, 0.15);
  color: #60a5fa;
}

.skill-tag.preferred {
  background: rgba(168, 85, 247, 0.15);
  color: #a855f7;
}

.tag-remove {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  font-size: 0.75rem;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  border-radius: 50%;
  color: rgba(255, 255, 255, 0.5);
  cursor: pointer;
  transition: all 0.15s;
}

.tag-remove:hover {
  background: rgba(239, 68, 68, 0.3);
  color: #ef4444;
}

.add-skill-row {
  display: flex;
  gap: 6px;
}

.add-skill-input {
  flex: 1;
  padding: 6px 10px;
  font-size: 0.8rem;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  color: rgba(255, 255, 255, 0.85);
  outline: none;
}

.add-skill-input:focus {
  border-color: rgba(96, 165, 250, 0.4);
}

.add-skill-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
  background: rgba(96, 165, 250, 0.15);
  border: 1px solid rgba(96, 165, 250, 0.3);
  border-radius: 6px;
  color: #60a5fa;
  cursor: pointer;
  transition: all 0.15s;
}

.add-skill-btn:hover {
  background: rgba(96, 165, 250, 0.25);
}

.skill-level {
  font-size: 0.65rem;
  opacity: 0.7;
  margin-left: 2px;
}

.add-skill-level {
  padding: 6px 8px;
  font-size: 0.8rem;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  color: rgba(255, 255, 255, 0.85);
  outline: none;
  cursor: pointer;
}

/* ─── Model Badge ─── */
.model-badge {
  padding: 6px 12px;
  background: rgba(168, 85, 247, 0.1);
  border: 1px solid rgba(168, 85, 247, 0.2);
  border-radius: 6px;
  font-size: 0.72rem;
  color: rgba(168, 85, 247, 0.8);
}

/* ─── Footer ─── */
.create-job-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 24px;
  border-top: 1px solid #1a2240;
  background: #0d1220;
}

.footer-btn-secondary {
  padding: 10px 20px;
  font-size: 0.88rem;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  transition: all 0.15s;
}

.footer-btn-secondary:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.footer-btn-primary {
  padding: 10px 24px;
  font-size: 0.88rem;
  font-weight: 600;
  background: linear-gradient(135deg, #60a5fa, #3b82f6);
  border: none;
  border-radius: 8px;
  color: #fff;
  cursor: pointer;
  transition: box-shadow 0.15s;
}

.footer-btn-primary:hover:not(:disabled) {
  box-shadow: 0 4px 16px rgba(96, 165, 250, 0.3);
}

.footer-btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* ─── Button Loading ─── */
.btn-loading {
  display: flex;
  align-items: center;
  gap: 8px;
}

.spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* ─── Success Modal ─── */
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
}

.modal-card {
  background: #131a2e;
  border: 1px solid #1a2240;
  border-radius: 16px;
  padding: 40px;
  text-align: center;
  max-width: 400px;
}

.modal-icon {
  font-size: 3rem;
  margin-bottom: 16px;
}

.modal-card h2 {
  margin: 0 0 8px;
  font-size: 1.2rem;
  color: #fff;
}

.modal-card p {
  margin: 0 0 24px;
  font-size: 0.88rem;
  color: rgba(255, 255, 255, 0.5);
}

.modal-actions {
  display: flex;
  justify-content: center;
}
</style>
