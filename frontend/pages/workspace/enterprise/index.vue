<template>
  <div class="ceo-dashboard">
    <!-- Top Navigation Bar -->
    <div class="ceo-top-nav">
      <button @click="goToWorkspaceCenter" class="ceo-nav-btn" title="返回工作台中心">
        ← 工作台中心
      </button>
      <WorkspaceSwitcher />
      <button @click="goToBilling" class="ceo-nav-btn" title="套餐订阅">
        📦 套餐订阅
      </button>
    </div>

    <!-- Tab Navigation -->
    <div class="ceo-tabs">
      <button
        :class="['ceo-tab', { active: activeTab === 'dashboard' }]"
        @click="activeTab = 'dashboard'"
      >
        📊 Dashboard
      </button>
      <button
        :class="['ceo-tab', { active: activeTab === 'pipeline' }]"
        @click = "activeTab = 'pipeline'; loadPipeline()"
      >
        🔄 招聘 Pipeline
      </button>
      <button
        :class="['ceo-tab', { active: activeTab === 'resumes' }]"
        @click="activeTab = 'resumes'; loadResumes()"
      >
        📄 简历管理
      </button>
      <button
        class="ceo-tab"
        @click="goToInterview"
      >
        🎤 面试管理
      </button>
      <button
        class="ceo-tab"
        @click="goToJobs"
      >
        📋 职位管理
      </button>
    </div>

    <!-- Dashboard Tab -->
    <div v-if="activeTab === 'dashboard'">
      <div class="ceo-maintenance-banner" style="background:#fff3cd;border:1px solid #ffc107;border-radius:8px;padding:12px 16px;margin-bottom:16px;color:#856404;">
        ⚠️ 企业招聘 Dashboard 正在升级中，部分数据暂时不可用。
      </div>
      <div v-if="!dashboardData?.exists" class="ceo-empty">
        <h2>欢迎使用昆仑镜 AI 招聘部门</h2>
        <p>您还没有创建企业招聘空间</p>
        <button @click="goOnboarding" class="ceo-btn">创建招聘空间</button>
      </div>
      <div v-else-if="loading" class="ceo-loading">
        <span>加载 Dashboard...</span>
      </div>
      <div v-else-if="dashboardData" class="ceo-content">
        <!-- Header -->
        <div class="ceo-header">
          <div>
            <h1>{{ dashboardData.enterprise.name }}</h1>
            <span class="ceo-plan-badge">{{ dashboardData.enterprise.planLabel }}</span>
          </div>
          <button @click="refresh" class="ceo-btn-secondary">🔄 刷新</button>
        </div>

        <!-- AI Workforce -->
        <div class="ceo-section">
          <h2 class="ceo-section-title">🤖 AI 员工编制</h2>
          <div class="ceo-workforce-grid">
            <div
              v-for="agent in dashboardData.workforce.agents"
              :key="agent.id"
              class="ceo-agent-card"
            >
              <div class="ceo-agent-name">{{ agent.displayName }}</div>
              <div class="ceo-agent-role">{{ agent.roleDescription }}</div>
              <span :class="['ceo-status', agent.status]">{{ agent.status }}</span>
            </div>
          </div>
          <div v-if="dashboardData.workforce.agents.length === 0" class="ceo-empty-small">
            暂无 AI 员工，<NuxtLink to="/workspace/enterprise/onboarding">去创建</NuxtLink>
          </div>
        </div>

        <!-- Recruitment Funnel -->
        <div class="ceo-section">
          <h2 class="ceo-section-title">📊 招聘漏斗</h2>
          <div v-if="hasRecruitmentData" class="ceo-funnel">
            <div class="ceo-funnel-item">
              <span class="ceo-funnel-num">{{ dashboardData.recruitment.funnel.total }}</span>
              <span class="ceo-funnel-label">总候选人</span>
            </div>
            <div class="ceo-funnel-item">
              <span class="ceo-funnel-num">{{ dashboardData.recruitment.funnel.screening }}</span>
              <span class="ceo-funnel-label">筛选中</span>
            </div>
            <div class="ceo-funnel-item">
              <span class="ceo-funnel-num">{{ dashboardData.recruitment.funnel.interview }}</span>
              <span class="ceo-funnel-label">面试中</span>
            </div>
            <div class="ceo-funnel-item">
              <span class="ceo-funnel-num">{{ dashboardData.recruitment.funnel.offer }}</span>
              <span class="ceo-funnel-label">Offer</span>
            </div>
            <div class="ceo-funnel-item">
              <span class="ceo-funnel-num">{{ dashboardData.recruitment.funnel.hired }}</span>
              <span class="ceo-funnel-label">已入职</span>
            </div>
          </div>
          <div v-else class="ceo-empty-small">暂无招聘数据</div>
          <div v-if="dashboardData.recruitment.interviews.total > 0" class="ceo-interview-stats">
            <div><span class="ceo-stat-num">{{ dashboardData.recruitment.interviews.total }}</span> 总面试</div>
            <div><span class="ceo-stat-num">{{ dashboardData.recruitment.interviews.completed }}</span> 已完成</div>
          </div>
        </div>

        <!-- Cost -->
        <div class="ceo-section">
          <h2 class="ceo-section-title">💰 成本</h2>
          <div class="ceo-cost-card">
            <span class="ceo-cost-amount">{{ dashboardData.cost.totalMonthlyCost.toFixed(2) }}</span>
            <span class="ceo-cost-currency">{{ dashboardData.cost.currency }}</span>
            <span class="ceo-cost-label">本月</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Pipeline Tab -->
    <div v-if="activeTab === 'pipeline'">
      <div v-if="pipelineLoading" class="ceo-loading">
        <span>加载 Pipeline...</span>
      </div>
      <div v-else-if="pipelineData" class="pipeline-container">
        <!-- Upload Section (Slice A) -->
        <div class="upload-section">
          <input
            ref="fileInput"
            type="file"
            accept="application/pdf"
            style="display: none"
            @change="handleFileSelect"
          />
          <button
            class="upload-btn"
            :disabled="uploading"
            @click="triggerFileSelect"
          >
            <span v-if="!uploading">📤 上传简历</span>
            <span v-else>上传中...</span>
          </button>
          <span class="upload-hint">仅支持 PDF，≤10MB</span>
          <span v-if="uploadProgress > 0 && uploading" class="upload-progress">
            {{ uploadProgress }}%
          </span>
        </div>

        <!-- Upload Toast -->
        <div v-if="uploadMessage" :class="['upload-toast', uploadMessageType]">
          {{ uploadMessage }}
        </div>

        <!-- Slice B: Parse Result Card -->
        <div v-if="showParseResult && parsedResult" class="parse-result-card">
          <div class="parse-result-header">
            <span class="parse-result-title">📊 解析结果</span>
            <span class="parse-quality-score" :class="parsedResult.quality.score >= 70 ? 'score-high' : parsedResult.quality.score >= 50 ? 'score-mid' : 'score-low'">
              {{ parsedResult.quality.score }}分
            </span>
          </div>
          <div class="parse-result-body">
            <div class="parse-row"><span class="parse-label">姓名</span><span class="parse-value">{{ parsedResult.name || '-' }}</span></div>
            <div class="parse-row"><span class="parse-label">邮箱</span><span class="parse-value">{{ parsedResult.email || '-' }}</span></div>
            <div class="parse-row"><span class="parse-label">电话</span><span class="parse-value">{{ parsedResult.phone || '-' }}</span></div>
            <div class="parse-row"><span class="parse-label">学历</span><span class="parse-value">{{ parsedResult.education || '-' }} {{ parsedResult.major }}</span></div>
            <div class="parse-row"><span class="parse-label">经验</span><span class="parse-value">{{ parsedResult.experienceYears }}年 {{ parsedResult.city }}</span></div>
            <div class="parse-row"><span class="parse-label">技能</span><span class="parse-value">{{ parsedResult.skills.join(', ') || '-' }}</span></div>
          </div>
          <div class="parse-result-footer">
            <span class="parse-meta">{{ parsedResult.pageCount }}页 · {{ parsedResult.parseDurationMs }}ms</span>
            <button class="reparse-btn" @click="triggerReparse">重新解析</button>
          </div>
        </div>

        <!-- Parse Error -->
        <div v-if="parseError" class="parse-error-card">
          <span>⚠️ 解析失败: {{ parseError }}</span>
          <button class="reparse-btn" @click="triggerReparse">重试</button>
        </div>
        <!-- Kanban Board -->
        <div class="pipeline-kanban">
          <div
            v-for="(column, stage) in pipelineData.columns"
            :key="stage"
            class="kanban-column"
            @dragover.prevent
            @drop="handleDrop($event, stage)"
          >
            <div class="kanban-header">
              <span class="kanban-title">{{ stageLabels[stage] || stage }}</span>
              <span class="kanban-count">{{ column.length }}</span>
            </div>
            <div class="kanban-cards">
              <div
                v-for="card in column"
                :key="card.id"
                class="candidate-card"
                draggable="true"
                @dragstart="handleDragStart($event, card)"
                @click="showTimeline(card)"
              >
                <div class="candidate-name">{{ card.candidateName }}</div>
                <div class="candidate-job">{{ card.jobTitle }}</div>
                <div class="candidate-meta">
                  <span v-if="card.screeningScore" class="candidate-score">{{ card.screeningScore }}分</span>
                  <span class="candidate-stage">{{ stageLabels[card.stage] || card.stage }}</span>
                </div>
                <div class="candidate-actions" @click.stop>
                  <button @click="aiRescore(card)" class="ai-btn beta-btn" title="AI重新评分（Beta 模板）">🎯</button>
                  <button @click="aiInterview(card)" class="ai-btn beta-btn" title="AI面试题（Beta）">❓</button>
                  <button @click="aiInvite(card)" class="ai-btn beta-btn" title="发送邀约（Beta）">📧</button>
                  <button @click="aiOffer(card)" class="ai-btn beta-btn" title="生成Offer（Beta 模板）">📝</button>
                </div>
              </div>
            </div>
            <div v-if="column.length === 0" class="kanban-empty">暂无候选人</div>
          </div>
        </div>

        <!-- Sprint-02: Candidate Detail Drawer -->
        <div v-if="candidateDrawer" class="candidate-drawer-overlay" @click.self="candidateDrawer = null">
          <div class="candidate-drawer">
            <div class="drawer-header">
              <h3>{{ candidateDrawer.candidateName || '候选人详情' }}</h3>
              <button @click="candidateDrawer = null" class="close-btn">✕</button>
            </div>
            <div v-if="candidateDrawerLoading" class="drawer-loading">加载中...</div>
            <div v-else-if="candidateDetail" class="drawer-body">
              <!-- Basic Info -->
              <div class="drawer-section">
                <h4>基本信息</h4>
                <div class="info-grid">
                  <div class="info-item"><span class="info-label">姓名</span><span>{{ candidateDetail.candidateName || '-' }}</span></div>
                  <div class="info-item"><span class="info-label">应聘岗位</span><span>{{ candidateDetail.jobTitle || '-' }}</span></div>
                  <div class="info-item"><span class="info-label">当前阶段</span><span :class="['stage-badge', candidateDetail.stage]">{{ stageLabels[candidateDetail.stage] || candidateDetail.stage }}</span></div>
                  <div class="info-item"><span class="info-label">AI评分</span><span>{{ candidateDetail.screeningScore || '-' }}</span></div>
                  <div class="info-item"><span class="info-label">面试轮次</span><span>{{ candidateDetail.interviewCount || 0 }}</span></div>
                  <div class="info-item"><span class="info-label">来源</span><span>{{ candidateDetail.autoCreated ? '简历上传' : '手动创建' }}</span></div>
                </div>
              </div>

              <!-- Tags -->
              <div class="drawer-section">
                <h4>标签</h4>
                <div class="tags-container">
                  <span v-for="tag in (candidateDetail.tags || [])" :key="tag" class="tag-item">
                    {{ tag }}
                    <button @click="removeTag(tag)" class="tag-remove">×</button>
                  </span>
                  <span v-if="!candidateDetail.tags || candidateDetail.tags.length === 0" class="tag-empty">暂无标签</span>
                </div>
                <div class="tag-add">
                  <select v-model="newTagValue" class="tag-select">
                    <option value="">选择标签...</option>
                    <option v-for="t in availableTags" :key="t" :value="t" :disabled="(candidateDetail.tags || []).includes(t)">{{ t }}</option>
                  </select>
                  <button @click="addTag" class="ceo-btn-small" :disabled="!newTagValue">添加</button>
                </div>
              </div>

              <!-- Offer Status -->
              <div class="drawer-section" v-if="candidateDetail.stage === 'offer'">
                <h4>Offer 状态</h4>
                <div class="offer-status">
                  <select v-model="candidateDetail.offerStatus" @change="updateOfferStatus" class="tag-select">
                    <option value="">未设置</option>
                    <option value="draft">草稿</option>
                    <option value="sent">已发送</option>
                    <option value="accepted">已接受</option>
                    <option value="rejected">已拒绝</option>
                    <option value="expired">已过期</option>
                  </select>
                </div>
              </div>

              <!-- Notes -->
              <div class="drawer-section">
                <h4>备注 ({{ (candidateDetail.notes || []).length }})</h4>
                <div class="notes-list">
                  <div v-for="note in (candidateDetail.notes || [])" :key="note.id" class="note-item">
                    <div class="note-content" v-if="editingNoteId !== note.id">{{ note.content }}</div>
                    <textarea v-else v-model="editingNoteContent" class="note-edit-textarea"></textarea>
                    <div class="note-meta">
                      <span class="note-time">{{ new Date(note.updatedAt).toLocaleString('zh-CN') }}</span>
                      <div class="note-actions" v-if="editingNoteId !== note.id">
                        <button @click="startEditNote(note)" class="action-btn">✏️</button>
                        <button @click="deleteNote(note.id)" class="action-btn action-delete">🗑️</button>
                      </div>
                      <div class="note-actions" v-else>
                        <button @click="saveEditNote(note.id)" class="action-btn">✅</button>
                        <button @click="cancelEditNote" class="action-btn">❌</button>
                      </div>
                    </div>
                  </div>
                  <div v-if="!candidateDetail.notes || candidateDetail.notes.length === 0" class="note-empty">暂无备注</div>
                </div>
                <div class="note-add">
                  <textarea v-model="newNoteContent" placeholder="添加备注..." class="note-textarea"></textarea>
                  <button @click="addNote" class="ceo-btn-small" :disabled="!newNoteContent.trim()">添加备注</button>
                </div>
              </div>

              <!-- Resume Info -->
              <div class="drawer-section" v-if="candidateDetail.resume">
                <h4>简历信息</h4>
                <div class="info-grid">
                  <div class="info-item"><span class="info-label">文件名</span><span>{{ candidateDetail.resume.fileName }}</span></div>
                  <div class="info-item"><span class="info-label">上传时间</span><span>{{ new Date(candidateDetail.resume.uploadedAt).toLocaleString('zh-CN') }}</span></div>
                </div>
                <div v-if="candidateDetail.resume.profile" class="resume-profile">
                  <div class="info-grid">
                    <div class="info-item"><span class="info-label">姓名</span><span>{{ candidateDetail.resume.profile.name || '-' }}</span></div>
                    <div class="info-item"><span class="info-label">邮箱</span><span>{{ candidateDetail.resume.profile.email || '-' }}</span></div>
                    <div class="info-item"><span class="info-label">电话</span><span>{{ candidateDetail.resume.profile.phone || '-' }}</span></div>
                    <div class="info-item"><span class="info-label">学历</span><span>{{ candidateDetail.resume.profile.education || '-' }}</span></div>
                    <div class="info-item"><span class="info-label">技能</span><span>{{ (candidateDetail.resume.profile.skills || []).join(', ') || '-' }}</span></div>
                    <div class="info-item"><span class="info-label">经验</span><span>{{ candidateDetail.resume.profile.experienceYears || 0 }}年</span></div>
                  </div>
                </div>
              </div>

              <!-- Timeline -->
              <div class="drawer-section">
                <h4>时间线</h4>
                <div class="timeline-list">
                  <div v-for="event in (candidateDetail.recentEvents || [])" :key="event.id" class="timeline-item">
                    <div class="timeline-dot" :class="event.type"></div>
                    <div class="timeline-info">
                      <span class="timeline-type">{{ eventLabels[event.type] || event.type }}</span>
                      <span v-if="event.fromStage" class="timeline-stage">
                        {{ stageLabels[event.fromStage] || event.fromStage }} → {{ stageLabels[event.toStage] || event.toStage }}
                      </span>
                      <span class="timeline-actor">{{ event.actor }}</span>
                      <span class="timeline-time">{{ new Date(event.createdAt).toLocaleString('zh-CN') }}</span>
                    </div>
                  </div>
                  <div v-if="!candidateDetail.recentEvents || candidateDetail.recentEvents.length === 0" class="timeline-empty">暂无事件</div>
                </div>
              </div>

              <!-- Delete -->
              <div class="drawer-section drawer-footer">
                <button @click="confirmDeleteCandidate" class="ceo-btn-danger">🗑️ 删除候选人</button>
              </div>
            </div>
          </div>
        </div>

        <!-- Delete Confirm Modal -->
        <div v-if="deleteCandidateConfirm" class="delete-confirm-modal" @click.self="deleteCandidateConfirm = false">
          <div class="delete-confirm-content">
            <h3>⚠️ 确认删除候选人</h3>
            <p>确定要删除 <strong>{{ candidateDetail?.candidateName }}</strong> 吗？</p>
            <p class="delete-warning">此操作将删除所有备注、事件记录，且不可恢复。</p>
            <div class="delete-confirm-actions">
              <button @click="deleteCandidateConfirm = false" class="ceo-btn-secondary">取消</button>
              <button @click="deleteCandidate" class="ceo-btn-danger">确认删除</button>
            </div>
          </div>
        </div>

        <!-- AI Result Modal -->
        <div v-if="aiResult" class="ai-result-modal" @click.self="aiResult = null">
          <div class="ai-result-content">
            <div class="ai-result-header">
              <h3>{{ aiResultTitle }}</h3>
              <button @click="aiResult = null" class="close-btn">✕</button>
            </div>
            <div class="ai-result-body">
              <pre v-if="typeof aiResult === 'string'">{{ aiResult }}</pre>
              <div v-else-if="Array.isArray(aiResult)">
                <div v-for="(q, i) in aiResult" :key="i" class="question-item">
                  <div class="question-text">{{ i + 1 }}. {{ q.question }}</div>
                  <div class="question-purpose">{{ q.purpose }}</div>
                </div>
              </div>
              <div v-else>
                <p>操作成功完成</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Resume Management Tab (Sprint-01) -->
    <div v-if="activeTab === 'resumes'">
      <div class="resume-mgmt">
        <!-- Header + Upload -->
        <div class="resume-mgmt-header">
          <h2>📄 简历管理</h2>
          <div class="resume-upload-inline">
            <input
              ref="resumeFileInput"
              type="file"
              accept="application/pdf"
              style="display: none"
              @change="handleResumeFileSelect"
            />
            <button
              class="ceo-btn"
              :disabled="uploading"
              @click="triggerResumeFileSelect"
            >
              <span v-if="!uploading">📤 上传简历</span>
              <span v-else>上传中...</span>
            </button>
            <span class="upload-hint">仅支持 PDF，≤10MB</span>
          </div>
        </div>

        <!-- Toast -->
        <div v-if="uploadMessage" :class="['upload-toast', uploadMessageType]">
          {{ uploadMessage }}
        </div>

        <!-- Parse Result Card -->
        <div v-if="showParseResult && parsedResult" class="parse-result-card">
          <div class="parse-result-header">
            <span class="parse-result-title">📊 最新解析结果</span>
            <span class="parse-quality-score" :class="parsedResult.quality.score >= 70 ? 'score-high' : parsedResult.quality.score >= 50 ? 'score-mid' : 'score-low'">
              {{ parsedResult.quality.score }}分
            </span>
          </div>
          <div class="parse-result-body">
            <div class="parse-row"><span class="parse-label">姓名</span><span class="parse-value">{{ parsedResult.name || '-' }}</span></div>
            <div class="parse-row"><span class="parse-label">邮箱</span><span class="parse-value">{{ parsedResult.email || '-' }}</span></div>
            <div class="parse-row"><span class="parse-label">电话</span><span class="parse-value">{{ parsedResult.phone || '-' }}</span></div>
            <div class="parse-row"><span class="parse-label">学历</span><span class="parse-value">{{ parsedResult.education || '-' }} {{ parsedResult.major }}</span></div>
            <div class="parse-row"><span class="parse-label">技能</span><span class="parse-value">{{ parsedResult.skills.join(', ') || '-' }}</span></div>
          </div>
          <div class="parse-result-footer">
            <span class="parse-meta">{{ parsedResult.pageCount }}页 · {{ parsedResult.parseDurationMs }}ms</span>
            <button class="reparse-btn" @click="triggerReparse">重新解析</button>
          </div>
        </div>

        <!-- Parse Error -->
        <div v-if="parseError" class="parse-error-card">
          <span>⚠️ 解析失败: {{ parseError }}</span>
          <button class="reparse-btn" @click="triggerReparse">重试</button>
        </div>

        <!-- Resume History Table -->
        <div class="resume-history">
          <div class="resume-history-header">
            <h3>上传历史 ({{ resumeList.length }})</h3>
            <button @click="loadResumes" class="ceo-btn-secondary">🔄 刷新</button>
          </div>

          <div v-if="resumeLoading" class="ceo-loading">加载简历列表...</div>

          <table v-else-if="resumeList.length > 0" class="resume-table">
            <thead>
              <tr>
                <th>候选人</th>
                <th>文件名</th>
                <th>状态</th>
                <th>质量</th>
                <th>上传时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="resume in resumeList" :key="resume.id">
                <td class="resume-candidate">{{ resume.candidateName || '未解析' }}</td>
                <td class="resume-filename">{{ resume.fileName }}</td>
                <td>
                  <span :class="['status-badge', `status-${resume.status}`]">
                    {{ statusLabels[resume.status] || resume.status }}
                  </span>
                </td>
                <td>
                  <span v-if="resume.qualityScore > 0" :class="['score-badge', resume.qualityScore >= 70 ? 'score-high' : resume.qualityScore >= 50 ? 'score-mid' : 'score-low']">
                    {{ resume.qualityScore }}
                  </span>
                  <span v-else>-</span>
                </td>
                <td class="resume-date">{{ new Date(resume.createdAt).toLocaleString('zh-CN') }}</td>
                <td class="resume-actions">
                  <button @click="viewResumeDetail(resume.id)" class="action-btn" title="查看详情">👁️</button>
                  <button @click="reparseResume(resume.id)" class="action-btn" title="重新解析">🔄</button>
                  <button @click="confirmDeleteResume(resume)" class="action-btn action-delete" title="删除">🗑️</button>
                </td>
              </tr>
            </tbody>
          </table>

          <div v-else class="resume-empty">
            <p>暂无简历，请上传第一份简历</p>
          </div>
        </div>

        <!-- Resume Detail Modal -->
        <div v-if="resumeDetail" class="resume-detail-modal" @click.self="resumeDetail = null">
          <div class="resume-detail-content">
            <div class="resume-detail-header">
              <h3>简历详情 — {{ resumeDetail.candidateName || '未命名' }}</h3>
              <button @click="resumeDetail = null" class="close-btn">✕</button>
            </div>
            <div class="resume-detail-body">
              <div class="detail-meta">
                <span><strong>文件名:</strong> {{ resumeDetail.fileName }}</span>
                <span><strong>状态:</strong> {{ statusLabels[resumeDetail.status] || resumeDetail.status }}</span>
                <span><strong>质量分:</strong> {{ resumeDetail.qualityScore || '-' }}</span>
              </div>

              <div v-if="resumeDetail.profile" class="detail-profile">
                <h4>结构化信息</h4>
                <div class="profile-grid">
                  <div class="profile-item"><span class="profile-label">姓名</span><span>{{ resumeDetail.profile.name || '-' }}</span></div>
                  <div class="profile-item"><span class="profile-label">邮箱</span><span>{{ resumeDetail.profile.email || '-' }}</span></div>
                  <div class="profile-item"><span class="profile-label">电话</span><span>{{ resumeDetail.profile.phone || '-' }}</span></div>
                  <div class="profile-item"><span class="profile-label">学历</span><span>{{ resumeDetail.profile.education || '-' }}</span></div>
                  <div class="profile-item"><span class="profile-label">专业</span><span>{{ resumeDetail.profile.major || '-' }}</span></div>
                  <div class="profile-item"><span class="profile-label">经验</span><span>{{ resumeDetail.profile.experienceYears || 0 }}年</span></div>
                  <div class="profile-item"><span class="profile-label">城市</span><span>{{ resumeDetail.profile.city || '-' }}</span></div>
                  <div class="profile-item"><span class="profile-label">技能</span><span>{{ (resumeDetail.profile.skills || []).join(', ') || '-' }}</span></div>
                </div>
                <div v-if="resumeDetail.profile.rawText" class="raw-text-section">
                  <h4>原始文本</h4>
                  <pre class="raw-text">{{ resumeDetail.profile.rawText }}</pre>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Delete Confirmation Modal -->
        <div v-if="deleteConfirmResume" class="delete-confirm-modal" @click.self="deleteConfirmResume = null">
          <div class="delete-confirm-content">
            <h3>⚠️ 确认删除</h3>
            <p>确定要删除简历 <strong>{{ deleteConfirmResume.fileName }}</strong> 吗？</p>
            <p class="delete-warning">此操作将同时删除关联的候选人记录，且不可恢复。</p>
            <div class="delete-confirm-actions">
              <button @click="deleteConfirmResume = null" class="ceo-btn-secondary">取消</button>
              <button @click="deleteResume(deleteConfirmResume.id)" class="ceo-btn-danger">确认删除</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useEnterpriseContext } from '~/composables/useEnterpriseContext'
import { useIdentityStore } from '~/stores/identity'
import WorkspaceSwitcher from '~/components/WorkspaceSwitcher.vue'

// ─── Identity Store (Sprint-08: 统一身份上下文) ───
const identityStore = useIdentityStore()

// ─── Tab State ───
const activeTab = ref('dashboard')
const ctx = useEnterpriseContext()

// ─── Dashboard State ───
interface DashboardData {
  exists: boolean
  enterprise: { id: string; name: string; industry: string; scale: string; plan: string; planLabel: string }
  workforce: {
    stats: { total: number; active: number; trial: number; paused: number; disabled: number }
    agents: Array<{ id: string; agentType: string; displayName: string; status: string; roleDescription: string; monthlyCalls: number }>
  }
  recruitment: {
    postingsCount: number
    funnel: { total: number; discovered: number; screening: number; interview: number; offer: number; hired: number; rejected: number }
    interviews: { total: number; preparing: number; ongoing: number; completed: number }
  }
  cost: { totalMonthlyTokens: number; totalMonthlyCost: number; currency: string }
  recentResumes: Array<{ id: string; candidateName: string; qualityScore: number; analyzedAt: string }>
}

const loading = ref(true)
const dashboardData = ref<DashboardData | null>(null)

const hasRecruitmentData = computed(() => dashboardData.value?.recruitment?.funnel?.total > 0)

// ─── Pipeline State ───
interface PipelineCard {
  id: string
  candidateName: string
  jobTitle: string
  stage: string
  screeningScore: number | null
  interviewCount: number
  lastActivityAt: string
  recentEvents: Array<{ id: string; type: string; fromStage: string | null; toStage: string | null; actor: string; metadata: any; createdAt: string }>
}

interface PipelineData {
  workspaceId: string
  columns: Record<string, PipelineCard[]>
  counts: Record<string, number>
  total: number
}

const pipelineLoading = ref(false)
const pipelineData = ref<PipelineData | null>(null)
const draggedCard = ref<PipelineCard | null>(null)
const showingCandidate = ref<PipelineCard | null>(null)
const timelineLoading = ref(false)
const timelineData = ref<any>(null)
const aiResult = ref<any>(null)
const aiResultTitle = ref('')

// ─── Upload State (Slice A) ───
const fileInput = ref<HTMLInputElement | null>(null)
const uploading = ref(false)
const uploadProgress = ref(0)
const uploadMessage = ref('')
const uploadMessageType = ref<'success' | 'error' | 'info'>('info')

function triggerFileSelect() {
  fileInput.value?.click()
}

async function handleFileSelect(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  // ─── 前端校验 ───
  const MAX_FILE_SIZE = 10 * 1024 * 1024
  if (file.size > MAX_FILE_SIZE) {
    showUploadMessage('文件超过 10MB', 'error')
    return
  }

  if (file.type !== 'application/pdf') {
    showUploadMessage('仅支持 PDF 格式', 'error')
    return
  }

  // ─── 上传文件 ───
  uploading.value = true
  uploadProgress.value = 0
  uploadMessage.value = ''

  try {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('workspaceId', getWorkspaceId())

    // 模拟上传进度
    const progressInterval = setInterval(() => {
      if (uploadProgress.value < 90) {
        uploadProgress.value += 10
      }
    }, 200)

    const res = await fetch('/api/enterprise/resume/upload', {
      method: 'POST',
      body: formData,
    })

    clearInterval(progressInterval)
    uploadProgress.value = 100

    const data = await res.json()

    if (res.ok && data.success) {
      lastUploadedFileId.value = data.fileId || ''
      if (data.duplicate) {
        showUploadMessage(`文件已存在: ${data.fileName}`, 'info')
      } else {
        showUploadMessage(`上传成功: ${data.fileName}`, 'success')
      }

      // ─── Slice B: 显示解析结果 ───
      if (data.parsed) {
        parsedResult.value = {
          name: data.parsed.name,
          email: data.parsed.email,
          phone: data.parsed.phone,
          education: data.parsed.education,
          major: data.parsed.major,
          skills: data.parsed.skills,
          experienceYears: data.parsed.experienceYears,
          city: data.parsed.city,
          quality: data.quality,
          parseDurationMs: data.parseDurationMs,
          pageCount: data.pageCount,
        }
        showParseResult.value = true
        showUploadMessage(`上传成功，已解析: ${data.parsed.name || data.fileName}`, 'success')
      } else if (data.parseError) {
        parseError.value = data.parseError
        showUploadMessage(`上传成功，但解析失败`, 'error')
      }

      // 刷新 Pipeline
      await loadPipeline()
      await loadDashboard()
    } else {
      showUploadMessage(data.error || '上传失败', 'error')
    }
  } catch (e: any) {
    showUploadMessage(`上传失败: ${e.message}`, 'error')
  } finally {
    uploading.value = false
    uploadProgress.value = 0
    // 重置文件选择
    if (fileInput.value) {
      fileInput.value.value = ''
    }
  }
}

// ─── Slice B: 解析结果状态 ───
const parsedResult = ref<{
  name: string
  email: string
  phone: string
  education: string
  major: string
  skills: string[]
  experienceYears: number
  city: string
  quality: {
    score: number
    strengths: string[]
    weaknesses: string[]
  }
  parseDurationMs: number
  pageCount: number
} | null>(null)

const parseError = ref<string>('')
const showParseResult = ref(false)
const lastUploadedFileId = ref<string>('')

async function triggerReparse() {
  if (!lastUploadedFileId.value) return
  try {
    const res = await fetch(`/api/enterprise/resume/parse/${lastUploadedFileId.value}`, {
      method: 'POST',
    })
    const data = await res.json()
    if (res.ok && data.success) {
      if (data.parsed) {
        parsedResult.value = {
          name: data.parsed.name,
          email: data.parsed.email,
          phone: data.parsed.phone,
          education: data.parsed.education,
          major: data.parsed.major,
          skills: data.parsed.skills,
          experienceYears: data.parsed.experienceYears,
          city: data.parsed.city,
          quality: data.quality,
          parseDurationMs: data.parseDurationMs,
          pageCount: data.pageCount,
        }
        showParseResult.value = true
        parseError.value = ''
        showUploadMessage('重新解析成功', 'success')
      }
    } else {
      showUploadMessage(data.error || '解析失败', 'error')
    }
  } catch (e: any) {
    showUploadMessage(`解析请求失败: ${e.message}`, 'error')
  }
}

function showUploadMessage(message: string, type: 'success' | 'error' | 'info') {
  uploadMessage.value = message
  uploadMessageType.value = type
  setTimeout(() => {
    uploadMessage.value = ''
  }, 5000)
}

// ─── Sprint-01: Resume Management State ───
const resumeFileInput = ref<HTMLInputElement | null>(null)
const resumeList = ref<any[]>([])
const resumeLoading = ref(false)
const resumeDetail = ref<any>(null)
const deleteConfirmResume = ref<any>(null)

const statusLabels: Record<string, string> = {
  uploaded: '已上传',
  parsing: '解析中',
  parsed: '已解析',
  parse_failed: '解析失败',
  analyzed: '已分析',
}

function triggerResumeFileSelect() {
  resumeFileInput.value?.click()
}

async function handleResumeFileSelect(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  const MAX_FILE_SIZE = 10 * 1024 * 1024
  if (file.size > MAX_FILE_SIZE) {
    showUploadMessage('文件超过 10MB', 'error')
    return
  }
  if (file.type !== 'application/pdf') {
    showUploadMessage('仅支持 PDF 格式', 'error')
    return
  }

  uploading.value = true
  uploadProgress.value = 0
  uploadMessage.value = ''

  try {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('workspaceId', getWorkspaceId())

    const progressInterval = setInterval(() => {
      if (uploadProgress.value < 90) {
        uploadProgress.value += 10
      }
    }, 200)

    const res = await fetch('/api/enterprise/resume/upload', {
      method: 'POST',
      body: formData,
    })

    clearInterval(progressInterval)
    uploadProgress.value = 100

    const data = await res.json()

    if (res.ok && data.success) {
      lastUploadedFileId.value = data.fileId || ''
      if (data.duplicate) {
        showUploadMessage(`文件已存在: ${data.fileName}`, 'info')
      } else {
        showUploadMessage(`上传成功: ${data.fileName}`, 'success')
      }

      if (data.parsed) {
        parsedResult.value = {
          name: data.parsed.name,
          email: data.parsed.email,
          phone: data.parsed.phone,
          education: data.parsed.education,
          major: data.parsed.major,
          skills: data.parsed.skills,
          experienceYears: data.parsed.experienceYears,
          city: data.parsed.city,
          quality: data.quality,
          parseDurationMs: data.parseDurationMs,
          pageCount: data.pageCount,
        }
        showParseResult.value = true
      } else if (data.parseError) {
        parseError.value = data.parseError
        showUploadMessage(`上传成功，但解析失败`, 'error')
      }

      // 刷新列表
      await loadResumes()
      await loadPipeline()
      await loadDashboard()
    } else {
      showUploadMessage(data.error || '上传失败', 'error')
    }
  } catch (e: any) {
    showUploadMessage(`上传失败: ${e.message}`, 'error')
  } finally {
    uploading.value = false
    uploadProgress.value = 0
    if (resumeFileInput.value) {
      resumeFileInput.value.value = ''
    }
  }
}

async function loadResumes() {
  const wsId = getWorkspaceId()
  if (!wsId) return

  resumeLoading.value = true
  try {
    const res = await fetch(`/api/enterprise/resumes?workspaceId=${wsId}`)
    const data = await res.json()
    if (res.ok && data.resumes) {
      resumeList.value = data.resumes
    }
  } catch (e: any) {
    console.error('Failed to load resumes:', e)
  } finally {
    resumeLoading.value = false
  }
}

async function viewResumeDetail(resumeId: string) {
  try {
    const res = await fetch(`/api/enterprise/resume/${resumeId}`)
    const data = await res.json()
    if (res.ok && data.resume) {
      resumeDetail.value = data.resume
    }
  } catch (e: any) {
    showUploadMessage(`获取详情失败: ${e.message}`, 'error')
  }
}

async function reparseResume(resumeId: string) {
  try {
    const res = await fetch(`/api/enterprise/resume/parse/${resumeId}`, {
      method: 'POST',
    })
    const data = await res.json()
    if (res.ok && data.success) {
      showUploadMessage('重新解析成功', 'success')
      await loadResumes()
    } else {
      showUploadMessage(data.error || '解析失败', 'error')
    }
  } catch (e: any) {
    showUploadMessage(`解析请求失败: ${e.message}`, 'error')
  }
}

function confirmDeleteResume(resume: any) {
  deleteConfirmResume.value = resume
}

async function deleteResume(resumeId: string) {
  try {
    const res = await fetch(`/api/enterprise/resume/${resumeId}`, {
      method: 'DELETE',
    })
    const data = await res.json()
    if (res.ok && data.success) {
      showUploadMessage('简历已删除', 'success')
      deleteConfirmResume.value = null
      await loadResumes()
      await loadPipeline()
      await loadDashboard()
    } else {
      showUploadMessage(data.error || '删除失败', 'error')
    }
  } catch (e: any) {
    showUploadMessage(`删除失败: ${e.message}`, 'error')
  }
}

const stageLabels: Record<string, string> = {
  discovered: '待筛选',
  screening: '筛选中',
  interview: '面试中',
  offer: 'Offer',
  hired: '已入职',
  rejected: '已拒绝',
}

const eventLabels: Record<string, string> = {
  stage_change: '阶段变更',
  ai_score: 'AI评分',
  ai_interview: 'AI面试题',
  ai_invite: 'AI邀约',
  ai_offer: 'AI Offer',
  note: '备注',
}

function getEnterpriseId(): string {
  return identityStore.enterpriseId || ctx.getEnterpriseId()
}

function getWorkspaceId(): string {
  return identityStore.workspaceId || ctx.getWorkspaceId()
}

function goOnboarding() {
  window.location.href = '/workspace/enterprise/onboarding'
}

// Sprint-03: Navigation
function goToWorkspaceCenter() {
  window.location.href = '/workspace/enterprise/onboarding'
}

function goToBilling() {
  window.location.href = '/workspace/enterprise/billing'
}

function goToInterview() {
  window.location.href = '/workspace/enterprise/interview'
}

function goToJobs() {
  window.location.href = '/workspace/enterprise/jobs'
}

async function loadDashboard() {
  const eId = getEnterpriseId()
  if (!eId) return

  loading.value = true
  try {
    const res = await fetch(`/api/enterprise/dashboard?enterpriseId=${eId}`)
    const data = await res.json()
    if (data.success) {
      dashboardData.value = data
    } else {
      dashboardData.value = { exists: false } as any
    }
  } catch (e) {
    console.error('加载Dashboard失败', e)
    dashboardData.value = { exists: false } as any
  } finally {
    loading.value = false
  }
}

async function loadPipeline() {
  const wsId = getWorkspaceId()
  if (!wsId) return

  pipelineLoading.value = true
  try {
    const res = await fetch(`/api/pipeline/kanban?workspaceId=${wsId}`)
    const data = await res.json()
    pipelineData.value = data
  } catch (e) {
    console.error('加载Pipeline失败', e)
  } finally {
    pipelineLoading.value = false
  }
}

function refresh() {
  loadDashboard()
}

// ─── Drag & Drop ───
function handleDragStart(event: DragEvent, card: PipelineCard) {
  draggedCard.value = card
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', card.id)
  }
}

async function handleDrop(event: DragEvent, targetStage: string) {
  if (!draggedCard.value || draggedCard.value.stage === targetStage) return
  const card = draggedCard.value
  try {
    await fetch(`/api/pipeline/${card.id}/stage`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage: targetStage, actor: 'user' }),
    })
    await loadPipeline()
    await loadDashboard() // Sync dashboard
  } catch (e) {
    console.error('移动失败', e)
  }
  draggedCard.value = null
}

// ─── Sprint-02: Candidate Detail Drawer State ───
const candidateDrawer = ref<any>(null)
const candidateDetail = ref<any>(null)
const candidateDrawerLoading = ref(false)
const newNoteContent = ref('')
const editingNoteId = ref<string | null>(null)
const editingNoteContent = ref('')
const newTagValue = ref('')
const deleteCandidateConfirm = ref(false)

const availableTags = ['高潜', '待跟进', '已联系', 'VIP', '黑名单']

// ─── Sprint-02: Candidate Detail ───
async function showTimeline(card: PipelineCard) {
  candidateDrawer.value = card
  candidateDrawerLoading.value = true
  candidateDetail.value = null
  newNoteContent.value = ''
  editingNoteId.value = null
  newTagValue.value = ''
  try {
    const res = await fetch(`/api/pipeline/${card.id}`)
    const data = await res.json()
    candidateDetail.value = data.candidate
  } catch (e) {
    console.error('加载候选人详情失败', e)
  } finally {
    candidateDrawerLoading.value = false
  }
}

// ─── Sprint-02: Notes ───
async function addNote() {
  if (!newNoteContent.value.trim() || !candidateDetail.value) return
  try {
    const res = await fetch(`/api/pipeline/${candidateDetail.value.id}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: newNoteContent.value.trim() }),
    })
    const data = await res.json()
    if (data.success) {
      newNoteContent.value = ''
      await refreshCandidateDetail()
    }
  } catch (e) {
    console.error('添加备注失败', e)
  }
}

function startEditNote(note: any) {
  editingNoteId.value = note.id
  editingNoteContent.value = note.content
}

function cancelEditNote() {
  editingNoteId.value = null
  editingNoteContent.value = ''
}

async function saveEditNote(noteId: string) {
  if (!editingNoteContent.value.trim()) return
  try {
    const res = await fetch(`/api/pipeline/notes/${noteId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: editingNoteContent.value.trim() }),
    })
    const data = await res.json()
    if (data.success) {
      editingNoteId.value = null
      editingNoteContent.value = ''
      await refreshCandidateDetail()
    }
  } catch (e) {
    console.error('编辑备注失败', e)
  }
}

async function deleteNote(noteId: string) {
  try {
    const res = await fetch(`/api/pipeline/notes/${noteId}`, { method: 'DELETE' })
    const data = await res.json()
    if (data.success) {
      await refreshCandidateDetail()
    }
  } catch (e) {
    console.error('删除备注失败', e)
  }
}

// ─── Sprint-02: Tags ───
async function addTag() {
  if (!newTagValue.value || !candidateDetail.value) return
  try {
    const res = await fetch(`/api/pipeline/${candidateDetail.value.id}/tags`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tag: newTagValue.value }),
    })
    const data = await res.json()
    if (data.success) {
      newTagValue.value = ''
      candidateDetail.value.tags = data.tags
    }
  } catch (e) {
    console.error('添加标签失败', e)
  }
}

async function removeTag(tag: string) {
  if (!candidateDetail.value) return
  try {
    const res = await fetch(`/api/pipeline/${candidateDetail.value.id}/tags/${encodeURIComponent(tag)}`, {
      method: 'DELETE',
    })
    const data = await res.json()
    if (data.success) {
      candidateDetail.value.tags = data.tags
    }
  } catch (e) {
    console.error('删除标签失败', e)
  }
}

// ─── Sprint-02: Offer Status ───
async function updateOfferStatus() {
  if (!candidateDetail.value) return
  try {
    const res = await fetch(`/api/pipeline/${candidateDetail.value.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ offerStatus: candidateDetail.value.offerStatus }),
    })
    const data = await res.json()
    if (data.success) {
      await loadPipeline()
      await loadDashboard()
    }
  } catch (e) {
    console.error('更新Offer状态失败', e)
  }
}

// ─── Sprint-02: Delete Candidate ───
function confirmDeleteCandidate() {
  deleteCandidateConfirm.value = true
}

async function deleteCandidate() {
  if (!candidateDetail.value) return
  try {
    const res = await fetch(`/api/pipeline/${candidateDetail.value.id}`, { method: 'DELETE' })
    const data = await res.json()
    if (data.success) {
      deleteCandidateConfirm.value = false
      candidateDrawer.value = null
      candidateDetail.value = null
      await loadPipeline()
      await loadDashboard()
    }
  } catch (e) {
    console.error('删除候选人失败', e)
  }
}

async function refreshCandidateDetail() {
  if (!candidateDetail.value) return
  try {
    const res = await fetch(`/api/pipeline/${candidateDetail.value.id}`)
    const data = await res.json()
    candidateDetail.value = data.candidate
  } catch (e) {
    console.error('刷新详情失败', e)
  }
}

// ─── AI Actions ───
async function aiRescore(card: PipelineCard) {
  aiResultTitle.value = '🎯 AI 评分结果'
  try {
    const res = await fetch(`/api/pipeline/${card.id}/ai-rescore`, { method: 'POST' })
    const data = await res.json()
    const scoreLine = data.score ? `AI 评分: ${data.score}/100` : ''
    const disclaimer = data.beta ? `\n\n⚠️ ${data.disclaimer || '当前为 Beta 模板，非真实 AI'}` : ''
    aiResult.value = scoreLine + disclaimer || data
    await loadPipeline()
    await loadDashboard()
  } catch (e) {
    aiResult.value = '评分失败'
  }
}

async function aiInterview(card: PipelineCard) {
  aiResultTitle.value = '❓ AI 面试题'
  try {
    const res = await fetch(`/api/pipeline/${card.id}/ai-interview`, { method: 'POST' })
    const data = await res.json()
    aiResult.value = data.questions || data
  } catch (e) {
    aiResult.value = '生成失败'
  }
}

async function aiInvite(card: PipelineCard) {
  aiResultTitle.value = '📧 发送邀约'
  try {
    const res = await fetch(`/api/pipeline/${card.id}/ai-invite`, { method: 'POST' })
    const data = await res.json()
    const disclaimer = data.beta ? `\n\n⚠️ ${data.disclaimer || '当前为 Beta 模板，非真实 AI'}` : ''
    aiResult.value = (data.message || '') + disclaimer || data
    await loadPipeline()
    await loadDashboard()
  } catch (e) {
    aiResult.value = '发送失败'
  }
}

async function aiOffer(card: PipelineCard) {
  aiResultTitle.value = '📝 AI Offer'
  try {
    const res = await fetch(`/api/pipeline/${card.id}/ai-offer`, { method: 'POST' })
    const data = await res.json()
    const disclaimer = data.beta ? `\n\n⚠️ ${data.disclaimer || '当前为 Beta 模板，非真实 AI'}` : ''
    aiResult.value = (data.content || '') + disclaimer || data
    await loadPipeline()
    await loadDashboard()
  } catch (e) {
    aiResult.value = '生成失败'
  }
}

// Reload all data after workspace switch
async function reloadAll() {
  if (getEnterpriseId()) {
    await loadDashboard()
    await loadResumes()
    if (activeTab.value === 'pipeline') {
      await loadPipeline()
    }
  }
}

onMounted(async () => {
  // Sprint-08: Fetch identity context from backend
  await identityStore.fetchContext()

  if (getEnterpriseId()) {
    loadDashboard()
    loadResumes()
  } else {
    // No enterprise context, redirect to onboarding
    window.location.href = '/workspace/enterprise/onboarding'
  }

  // Sprint-08: Listen for workspace switch events
  window.addEventListener('workspace-switched', reloadAll)
})
</script>

<style scoped>
.ceo-dashboard {
  padding: 24px;
  max-width: 1200px;
  margin: 0 auto;
}

/* Sprint-03: Top Navigation */
.ceo-top-nav {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid #e5e7eb;
}

.ceo-nav-btn {
  padding: 6px 14px;
  background: #fff;
  color: #374151;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.ceo-nav-btn:hover {
  background: #f3f4f6;
  border-color: #9ca3af;
}

/* Tabs */
.ceo-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 24px;
  border-bottom: 2px solid #e5e7eb;
  padding-bottom: 8px;
}

.ceo-tab {
  padding: 10px 20px;
  border: none;
  background: transparent;
  font-size: 15px;
  font-weight: 500;
  color: #6b7280;
  cursor: pointer;
  border-radius: 8px 8px 0 0;
  transition: all 0.2s;
}

.ceo-tab:hover {
  background: #f3f4f6;
  color: #374151;
}

.ceo-tab.active {
  background: #eff6ff;
  color: #2563eb;
  font-weight: 600;
}

/* Loading & Empty */
.ceo-loading, .ceo-empty {
  text-align: center;
  padding: 60px 20px;
  color: #6b7280;
}

.ceo-empty h2 {
  font-size: 24px;
  margin-bottom: 12px;
}

/* Header */
.ceo-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.ceo-header h1 {
  font-size: 28px;
  margin: 0;
}

.ceo-plan-badge {
  display: inline-block;
  padding: 4px 12px;
  background: #eff6ff;
  color: #2563eb;
  border-radius: 20px;
  font-size: 13px;
  margin-left: 12px;
}

.ceo-btn {
  padding: 10px 24px;
  background: #2563eb;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  font-weight: 500;
}

.ceo-btn:hover {
  background: #1d4ed8;
}

.ceo-btn-secondary {
  padding: 8px 16px;
  background: #f3f4f6;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
}

/* Sections */
.ceo-section {
  margin-bottom: 32px;
}

.ceo-section-title {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 16px;
  color: #111827;
}

/* Workforce */
.ceo-workforce-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 16px;
}

.ceo-agent-card {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 16px;
  position: relative;
}

.ceo-agent-name {
  font-weight: 600;
  font-size: 15px;
  margin-bottom: 4px;
}

.ceo-agent-role {
  color: #6b7280;
  font-size: 13px;
}

.ceo-status {
  position: absolute;
  top: 12px;
  right: 12px;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 11px;
  text-transform: uppercase;
}

.ceo-status.active, .ceo-status.trial {
  background: #dcfce7;
  color: #16a34a;
}

.ceo-status.paused, .ceo-status.disabled {
  background: #f3f4f6;
  color: #6b7280;
}

/* Funnel */
.ceo-funnel {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.ceo-funnel-item {
  flex: 1;
  min-width: 100px;
  text-align: center;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 16px 8px;
}

.ceo-funnel-num {
  display: block;
  font-size: 28px;
  font-weight: 700;
  color: #2563eb;
}

.ceo-funnel-label {
  font-size: 13px;
  color: #6b7280;
}

.ceo-interview-stats {
  display: flex;
  gap: 24px;
  margin-top: 16px;
  color: #6b7280;
  font-size: 14px;
}

.ceo-stat-num {
  font-weight: 700;
  color: #111827;
}

/* Cost */
.ceo-cost-card {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.ceo-cost-amount {
  font-size: 32px;
  font-weight: 700;
  color: #111827;
}

.ceo-cost-currency {
  color: #6b7280;
}

.ceo-cost-label {
  color: #9ca3af;
  font-size: 13px;
}

/* Empty small */
.ceo-empty-small {
  color: #9ca3af;
  font-size: 14px;
  padding: 12px 0;
}

/* ─── Kanban ─── */
.pipeline-container {
  min-height: 600px;
}

.pipeline-kanban {
  display: flex;
  gap: 12px;
  overflow-x: auto;
  padding-bottom: 16px;
}

.kanban-column {
  flex: 1;
  min-width: 200px;
  background: #f9fafb;
  border-radius: 12px;
  padding: 12px;
  border: 1px solid #e5e7eb;
}

.kanban-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 2px solid #e5e7eb;
}

.kanban-title {
  font-weight: 600;
  font-size: 14px;
  color: #374151;
}

.kanban-count {
  background: #e5e7eb;
  color: #6b7280;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 600;
}

.kanban-cards {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 100px;
}

.kanban-empty {
  color: #9ca3af;
  font-size: 13px;
  text-align: center;
  padding: 20px 0;
}

/* Candidate Card */
.candidate-card {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 12px;
  cursor: grab;
  transition: all 0.2s;
}

.candidate-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  border-color: #2563eb;
}

.candidate-card:active {
  cursor: grabbing;
}

.candidate-name {
  font-weight: 600;
  font-size: 14px;
  margin-bottom: 4px;
}

.candidate-job {
  color: #6b7280;
  font-size: 12px;
  margin-bottom: 8px;
}

.candidate-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.candidate-score {
  background: #dcfce7;
  color: #16a34a;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
}

.candidate-stage {
  color: #9ca3af;
  font-size: 11px;
}

.candidate-actions {
  display: flex;
  gap: 4px;
}

.ai-btn {
  width: 28px;
  height: 28px;
  border: 1px solid #e5e7eb;
  background: white;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.15s;
}

.ai-btn:hover {
  background: #eff6ff;
  border-color: #2563eb;
}

.beta-btn {
  position: relative;
  opacity: 0.7;
  border-style: dashed !important;
}

.beta-btn::after {
  content: 'β';
  position: absolute;
  top: -6px;
  right: -6px;
  background: #f59e0b;
  color: white;
  font-size: 8px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  line-height: 1;
}

/* Sprint-02: Candidate Detail Drawer */
.candidate-drawer-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: flex-end;
  z-index: 3000;
}

.candidate-drawer {
  background: #fff;
  width: 480px;
  max-width: 90vw;
  height: 100%;
  overflow-y: auto;
  box-shadow: -4px 0 20px rgba(0, 0, 0, 0.15);
  animation: slideInRight 0.3s ease;
}

@keyframes slideInRight {
  from { transform: translateX(100%); }
  to { transform: translateX(0); }
}

.drawer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #e5e7eb;
  position: sticky;
  top: 0;
  background: #fff;
  z-index: 10;
}

.drawer-header h3 {
  font-size: 16px;
  font-weight: 600;
}

.drawer-loading {
  padding: 40px;
  text-align: center;
  color: #9ca3af;
}

.drawer-body {
  padding: 16px 20px;
}

.drawer-section {
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid #f3f4f6;
}

.drawer-section h4 {
  font-size: 13px;
  font-weight: 600;
  color: #6b7280;
  margin-bottom: 10px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.info-label {
  font-size: 11px;
  color: #9ca3af;
}

.info-item span:last-child {
  font-size: 13px;
  color: #111827;
  font-weight: 500;
}

.stage-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 500;
  background: #eff6ff;
  color: #2563eb;
}

.tags-container {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
}

.tag-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  background: #eff6ff;
  color: #2563eb;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.tag-remove {
  background: none;
  border: none;
  color: #2563eb;
  cursor: pointer;
  font-size: 14px;
  padding: 0;
  line-height: 1;
}

.tag-remove:hover {
  color: #dc2626;
}

.tag-empty, .note-empty, .timeline-empty {
  font-size: 12px;
  color: #9ca3af;
  padding: 8px 0;
}

.tag-add {
  display: flex;
  gap: 8px;
}

.tag-select {
  flex: 1;
  padding: 6px 10px;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  font-size: 12px;
}

.ceo-btn-small {
  padding: 6px 12px;
  background: #2563eb;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
}

.ceo-btn-small:disabled {
  background: #9ca3af;
  cursor: not-allowed;
}

.notes-list {
  margin-bottom: 8px;
}

.note-item {
  padding: 8px 0;
  border-bottom: 1px solid #f3f4f6;
}

.note-item:last-child {
  border-bottom: none;
}

.note-content {
  font-size: 13px;
  color: #374151;
  margin-bottom: 4px;
  white-space: pre-wrap;
}

.note-edit-textarea {
  width: 100%;
  min-height: 60px;
  padding: 6px 8px;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  font-size: 13px;
  resize: vertical;
  margin-bottom: 4px;
}

.note-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.note-time {
  font-size: 11px;
  color: #9ca3af;
}

.note-actions {
  display: flex;
  gap: 4px;
}

.note-add {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.note-textarea {
  width: 100%;
  min-height: 50px;
  padding: 8px;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  font-size: 13px;
  resize: vertical;
}

.resume-profile {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid #f3f4f6;
}

.timeline-list {
  max-height: 200px;
  overflow-y: auto;
}

.drawer-footer {
  border-bottom: none;
  padding-top: 8px;
}

.delete-confirm-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 4000;
}

.delete-confirm-content {
  background: #fff;
  border-radius: 12px;
  padding: 24px;
  width: 360px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.delete-confirm-content h3 {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 12px;
}

.delete-confirm-content p {
  font-size: 14px;
  color: #374151;
  margin-bottom: 8px;
}

.delete-warning {
  color: #dc2626;
  font-size: 13px;
}

.delete-confirm-actions {
  display: flex;
  gap: 12px;
  margin-top: 20px;
  justify-content: flex-end;
}

/* Modals */
.timeline-modal, .ai-result-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.timeline-content, .ai-result-content {
  background: white;
  border-radius: 16px;
  padding: 24px;
  max-width: 600px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
}

.timeline-header, .ai-result-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.timeline-header h3, .ai-result-header h3 {
  margin: 0;
  font-size: 18px;
}

.close-btn {
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  color: #6b7280;
}

.timeline-loading {
  text-align: center;
  padding: 20px;
  color: #6b7280;
}

.timeline-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.timeline-item {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.timeline-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #d1d5db;
  margin-top: 5px;
  flex-shrink: 0;
}

.timeline-dot.stage_change { background: #2563eb; }
.timeline-dot.ai_score { background: #16a34a; }
.timeline-dot.ai_interview { background: #f59e0b; }
.timeline-dot.ai_invite { background: #8b5cf6; }
.timeline-dot.ai_offer { background: #ef4444; }

.timeline-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.timeline-type {
  font-weight: 600;
  font-size: 14px;
}

.timeline-stage {
  color: #2563eb;
  font-size: 13px;
}

.timeline-actor {
  color: #6b7280;
  font-size: 12px;
}

.timeline-time {
  color: #9ca3af;
  font-size: 12px;
}

/* AI Result */
.question-item {
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid #f3f4f6;
}

.question-text {
  font-weight: 500;
  margin-bottom: 4px;
}

.question-purpose {
  color: #6b7280;
  font-size: 13px;
}

.ai-result-body pre {
  white-space: pre-wrap;
  line-height: 1.6;
  font-size: 14px;
}

/* ─── Upload Section (Slice A) ─── */
.upload-section {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  padding: 12px 16px;
  background: #f9fafb;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
}

.upload-btn {
  padding: 8px 16px;
  background: #2563eb;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.upload-btn:hover:not(:disabled) {
  background: #1d4ed8;
}

.upload-btn:disabled {
  background: #9ca3af;
  cursor: not-allowed;
}

.upload-hint {
  color: #9ca3af;
  font-size: 12px;
}

.upload-progress {
  color: #2563eb;
  font-size: 12px;
  font-weight: 600;
}

/* Upload Toast */
.upload-toast {
  position: fixed;
  top: 20px;
  right: 20px;
  padding: 12px 20px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  z-index: 2000;
  animation: slideIn 0.3s ease;
}

.upload-toast.success {
  background: #dcfce7;
  color: #16a34a;
  border: 1px solid #bbf7d0;
}

.upload-toast.error {
  background: #fef2f2;
  color: #dc2626;
  border: 1px solid #fecaca;
}

.upload-toast.info {
  background: #eff6ff;
  color: #2563eb;
  border: 1px solid #bfdbfe;
}

@keyframes slideIn {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

/* ─── Slice B: Parse Result Card ─── */
.parse-result-card {
  margin-bottom: 16px;
  padding: 16px;
  background: #fff;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.parse-result-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid #f3f4f6;
}

.parse-result-title {
  font-size: 14px;
  font-weight: 600;
  color: #111827;
}

.parse-quality-score {
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 13px;
  font-weight: 700;
}

.score-high {
  background: #dcfce7;
  color: #16a34a;
}

.score-mid {
  background: #fef3c7;
  color: #d97706;
}

.score-low {
  background: #fef2f2;
  color: #dc2626;
}

.parse-result-body {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.parse-row {
  display: flex;
  gap: 8px;
  font-size: 13px;
}

.parse-label {
  color: #6b7280;
  min-width: 40px;
}

.parse-value {
  color: #111827;
  font-weight: 500;
}

.parse-result-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 12px;
  padding-top: 8px;
  border-top: 1px solid #f3f4f6;
}

.parse-meta {
  color: #9ca3af;
  font-size: 12px;
}

.reparse-btn {
  padding: 4px 12px;
  background: #f3f4f6;
  color: #374151;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.reparse-btn:hover {
  background: #e5e7eb;
}

.parse-error-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding: 12px 16px;
  background: #fef2f2;
  border-radius: 8px;
  border: 1px solid #fecaca;
  color: #dc2626;
  font-size: 13px;
}

/* ─── Sprint-01: Resume Management ─── */
.resume-mgmt {
  padding: 20px;
  background: #fff;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
}

.resume-mgmt-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.resume-mgmt-header h2 {
  font-size: 18px;
  font-weight: 600;
  color: #111827;
}

.resume-upload-inline {
  display: flex;
  align-items: center;
  gap: 12px;
}

.resume-history {
  margin-top: 20px;
}

.resume-history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.resume-history-header h3 {
  font-size: 15px;
  font-weight: 600;
  color: #374151;
}

.resume-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.resume-table th {
  text-align: left;
  padding: 10px 12px;
  background: #f9fafb;
  border-bottom: 2px solid #e5e7eb;
  color: #6b7280;
  font-weight: 600;
}

.resume-table td {
  padding: 10px 12px;
  border-bottom: 1px solid #f3f4f6;
  vertical-align: middle;
}

.resume-table tr:hover {
  background: #f9fafb;
}

.resume-candidate {
  font-weight: 500;
  color: #111827;
}

.resume-filename {
  color: #6b7280;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.resume-date {
  color: #9ca3af;
  font-size: 12px;
}

.resume-actions {
  display: flex;
  gap: 4px;
}

.action-btn {
  padding: 4px 8px;
  background: transparent;
  border: 1px solid #e5e7eb;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.action-btn:hover {
  background: #f3f4f6;
}

.action-delete:hover {
  background: #fef2f2;
  border-color: #fecaca;
}

.status-badge {
  display: inline-block;
  padding: 3px 8px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 500;
}

.status-uploaded {
  background: #eff6ff;
  color: #2563eb;
}

.status-parsing {
  background: #fef3c7;
  color: #d97706;
}

.status-parsed {
  background: #dcfce7;
  color: #16a34a;
}

.status-parse_failed {
  background: #fef2f2;
  color: #dc2626;
}

.status-analyzed {
  background: #dcfce7;
  color: #16a34a;
}

.score-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 600;
}

.resume-empty {
  text-align: center;
  padding: 40px;
  color: #9ca3af;
}

/* Resume Detail Modal */
.resume-detail-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 3000;
}

.resume-detail-content {
  background: #fff;
  border-radius: 12px;
  width: 90%;
  max-width: 700px;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.resume-detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #e5e7eb;
}

.resume-detail-header h3 {
  font-size: 16px;
  font-weight: 600;
}

.resume-detail-body {
  padding: 20px;
}

.detail-meta {
  display: flex;
  gap: 20px;
  margin-bottom: 16px;
  font-size: 13px;
  color: #6b7280;
}

.detail-profile h4 {
  font-size: 14px;
  font-weight: 600;
  color: #374151;
  margin-bottom: 12px;
}

.profile-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
  margin-bottom: 16px;
}

.profile-item {
  display: flex;
  gap: 8px;
  font-size: 13px;
}

.profile-label {
  color: #6b7280;
  min-width: 50px;
}

.raw-text-section {
  margin-top: 16px;
}

.raw-text {
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  padding: 12px;
  font-size: 12px;
  color: #374151;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 300px;
  overflow-y: auto;
}

/* Delete Confirm Modal */
.delete-confirm-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 3000;
}

.delete-confirm-content {
  background: #fff;
  border-radius: 12px;
  padding: 24px;
  width: 400px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.delete-confirm-content h3 {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 12px;
}

.delete-confirm-content p {
  font-size: 14px;
  color: #374151;
  margin-bottom: 8px;
}

.delete-warning {
  color: #dc2626;
  font-size: 13px;
}

.delete-confirm-actions {
  display: flex;
  gap: 12px;
  margin-top: 20px;
  justify-content: flex-end;
}

.ceo-btn-danger {
  padding: 8px 16px;
  background: #dc2626;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.ceo-btn-danger:hover {
  background: #b91c1c;
}
</style>
