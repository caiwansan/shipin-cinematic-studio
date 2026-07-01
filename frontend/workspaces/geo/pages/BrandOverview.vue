<template>
  <div class="brand-overview">
    <!-- ===== Loading State ===== -->
    <div v-if="loading" class="brand-overview__loading">
      <div class="brand-overview__spinner" />
      <span>正在加载品牌详情...</span>
    </div>

    <!-- ===== Error State ===== -->
    <div v-else-if="error" class="brand-overview__error">
      <p>{{ error }}</p>
      <button class="brand-overview__btn brand-overview__btn--primary" @click="loadData">重试</button>
    </div>

    <template v-else-if="project">
      <!-- ===== Top Bar: Back to Dashboard ===== -->
      <div class="brand-overview__top-bar">
        <NuxtLink to="/workspace/geo/dashboard" class="brand-overview__back-link">
          ← 返回 Dashboard
        </NuxtLink>
        <button class="brand-overview__btn brand-overview__btn--danger" @click="confirmDelete">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
          </svg>
          删除品牌
        </button>
      </div>

      <!-- ===== Brand Header (P2-T002-P0 1.a) ===== -->
      <header class="brand-overview__header">
        <div class="brand-overview__header-left">
          <div class="brand-overview__brand-avatar">
            {{ project.name.charAt(0).toUpperCase() }}
          </div>
          <div class="brand-overview__brand-info">
            <h1 class="brand-overview__brand-name">{{ project.name }}</h1>
            <span class="brand-overview__brand-slug">{{ projectSlug }}</span>
            <a
              v-if="projectWebsite"
              :href="projectWebsite"
              target="_blank"
              rel="noopener noreferrer"
              class="brand-overview__brand-url"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M5 1H1v8h8V5M9 1l4 4-4 4M5 5l4 4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              {{ projectWebsite }}
            </a>
          </div>
        </div>
        <span class="brand-overview__status-badge" :class="`brand-overview__status-badge--${project.status || 'draft'}`">
          {{ statusLabel(project.status) }}
        </span>
      </header>

      <!-- ===== Brand Profile Completeness (P2-T002-P0 1.b) ===== -->
      <section class="brand-overview__section">
        <div class="brand-overview__completeness-card">
          <div class="brand-overview__completeness-header">
            <h2 class="brand-overview__section-title">Brand Profile Completeness</h2>
            <div class="brand-overview__completeness-ring-wrapper">
              <div class="brand-overview__completeness-ring">
                <svg width="64" height="64" viewBox="0 0 64 64" v-if="hasAnalysis">
                  <circle cx="32" cy="32" r="27" fill="none" stroke="#e5e7eb" stroke-width="4" />
                  <circle
                    cx="32" cy="32" r="27"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="4"
                    stroke-linecap="round"
                    :stroke-dasharray="169.65"
                    :stroke-dashoffset="169.65 - (169.65 * completenessPercent) / 100"
                    class="brand-overview__completeness-ring-fill"
                    :class="completenessRingColor(completenessPercent)"
                  />
                  <text x="32" y="30" text-anchor="middle" dominant-baseline="central" class="brand-overview__completeness-percent">
                    {{ completenessPercent }}%
                  </text>
                  <text x="32" y="46" text-anchor="middle" dominant-baseline="central" class="brand-overview__completeness-label-text">
                    完成度
                  </text>
                </svg>
                <div v-else class="brand-overview__completeness-pending">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="1.5">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 8v4M12 16h.01" stroke-linecap="round" />
                  </svg>
                  <span class="brand-overview__completeness-pending-text">等待分析</span>
                </div>
              </div>
            </div>
          </div>

          <div class="brand-overview__profile-dimensions">
            <div class="brand-overview__profile-dimension">
              <div class="brand-overview__dimension-header">
                <div class="brand-overview__dimension-left">
                  <span class="brand-overview__dimension-label">Identity 身份</span>
                  <span class="brand-overview__dimension-desc">Name / Website / Industry</span>
                </div>
                <span class="brand-overview__dimension-score" :class="dimensionScoreColor(identityScore)">
                  {{ identityScore }}%
                </span>
              </div>
              <div class="brand-overview__dimension-bar">
                <div
                  class="brand-overview__dimension-fill"
                  :style="{ width: identityScore + '%' }"
                  :class="dimensionBarColor(identityScore)"
                />
              </div>
            </div>

            <div class="brand-overview__profile-dimension">
              <div class="brand-overview__dimension-header">
                <div class="brand-overview__dimension-left">
                  <span class="brand-overview__dimension-label">Knowledge 知识</span>
                  <span class="brand-overview__dimension-desc" v-if="hasAnalysis && knowledgeScore > 0">
                    {{ entityCount }} 实体 / {{ knowledgeSourceCount }} 知识源
                  </span>
                  <span class="brand-overview__dimension-desc brand-overview__dimension-desc--pending" v-else-if="hasAnalysis && knowledgeScore === 0">
                    未生成 — 暂无实体和知识源
                  </span>
                  <span class="brand-overview__dimension-desc" v-else>等待首次分析</span>
                </div>
                <span class="brand-overview__dimension-score" v-if="hasAnalysis && knowledgeScore > 0" :class="dimensionScoreColor(knowledgeScore)">
                  {{ knowledgeScore }}%
                </span>
                <span class="brand-overview__dimension-score--pending" v-else-if="hasAnalysis && knowledgeScore === 0">
                  待生成
                </span>
                <span class="brand-overview__dimension-score--pending" v-else>待分析</span>
              </div>
              <div class="brand-overview__dimension-bar" v-if="hasAnalysis && knowledgeScore > 0">
                <div
                  class="brand-overview__dimension-fill"
                  :style="{ width: knowledgeScore + '%' }"
                  :class="dimensionBarColor(knowledgeScore)"
                />
              </div>
            </div>

            <div class="brand-overview__profile-dimension">
              <div class="brand-overview__dimension-header">
                <div class="brand-overview__dimension-left">
                  <span class="brand-overview__dimension-label">Optimization 优化</span>
                  <span class="brand-overview__dimension-desc brand-overview__dimension-desc--steps" v-if="hasAnalysis">
                    <span class="brand-overview__step brand-overview__step--done">✓ 已评估</span>
                    <span class="brand-overview__step" :class="verificationCount > 0 ? 'brand-overview__step--done' : 'brand-overview__step--todo'">
                      {{ verificationCount > 0 ? '✓' : '○' }} 验真
                    </span>
                    <span class="brand-overview__step brand-overview__step--todo">○ 发布</span>
                  </span>
                  <span class="brand-overview__dimension-desc" v-else>等待首次分析</span>
                </div>
                <span class="brand-overview__dimension-score" v-if="hasAnalysis" :class="dimensionScoreColor(optimizationScore)">
                  {{ optimizationScore }}%
                </span>
                <span class="brand-overview__dimension-score--pending" v-else>待分析</span>
              </div>
              <div class="brand-overview__dimension-bar" v-if="hasAnalysis">
                <div
                  class="brand-overview__dimension-fill"
                  :style="{ width: optimizationScore + '%' }"
                  :class="dimensionBarColor(optimizationScore)"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- ===== Quick Actions (P2-T002-P0 1.c) ===== -->
      <section class="brand-overview__section">
        <h2 class="brand-overview__section-title">快速操作</h2>
        <div class="brand-overview__quick-actions">
          <button class="brand-overview__action-card" @click="handleEditBrand">
            <span class="brand-overview__action-icon brand-overview__action-icon--brand">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </span>
            <span class="brand-overview__action-text">
              <strong>完善品牌资料</strong>
              <small>更新品牌信息与配置</small>
            </span>
          </button>
          <button class="brand-overview__action-card" @click="handleQuickDiscovery" :disabled="qdRunning">
            <span class="brand-overview__action-icon brand-overview__action-icon--geo">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" />
                <path d="M12 6v6l4 2" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
              </svg>
            </span>
            <span class="brand-overview__action-text">
              <strong>{{ qdRunning ? '分析中...' : '立即分析（30 秒）' }}</strong>
              <small>{{ qdRunning ? '正在扫描品牌可见度' : '一键出分，了解品牌 AI 可见度' }}</small>
            </span>
          </button>
          <button class="brand-overview__action-card" @click="handleAddKnowledge">
            <span class="brand-overview__action-icon brand-overview__action-icon--knowledge">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M4 19.5A2.5 2.5 0 016.5 17H20" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" stroke="currentColor" stroke-width="2" />
                <path d="M8 7h8M8 11h6" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
              </svg>
            </span>
            <span class="brand-overview__action-text">
              <strong>添加知识源</strong>
              <small>导入品牌资料与文档</small>
            </span>
          </button>
        </div>
      </section>

      <!-- ===== Explain Section (P0-T003) ===== -->
      <section class="brand-overview__section">
        <h2 class="brand-overview__section-title">
          品牌 Explain
          <button
            v-if="hasAnalysis && !explainLoading && !explainData"
            class="brand-overview__explain-trigger"
            @click="loadExplain"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" />
              <path d="M12 17h.01" />
            </svg>
            查看 Explain
          </button>
          <button
            v-if="explainData"
            class="brand-overview__explain-trigger"
            @click="explainData = null; explainError = null"
          >
            收起
          </button>
        </h2>

        <!-- Explain Loading State -->
        <div v-if="explainLoading" class="brand-overview__explain-loading">
          <div class="brand-overview__explain-loading-step" v-for="step in explainSteps" :key="step.key">
            <span class="brand-overview__explain-loading-icon" :class="explainLoadingStepClass(step.key)">
              {{ step.icon }}
            </span>
            <span>{{ step.label }}</span>
          </div>
        </div>

        <!-- Explain Error -->
        <div v-else-if="explainError" class="brand-overview__explain-error">
          <p>{{ explainError }}</p>
          <button class="brand-overview__btn" @click="loadExplain">重试</button>
        </div>

        <!-- Explain Empty State -->
        <div v-else-if="!hasAnalysis && !explainData" class="brand-overview__explain-empty">
          <p>运行 Quick Discovery 以生成品牌 Explain。</p>
          <button
            class="brand-overview__btn brand-overview__btn--primary"
            @click="handleQuickDiscovery"
            :disabled="qdRunning"
          >
            {{ qdRunning ? '分析中...' : '运行 Quick Discovery' }}
          </button>
        </div>

        <!-- Explain Data -->
        <div v-else-if="explainData" class="brand-overview__explain-card">
          <!-- Confidence Badge -->
          <div class="brand-overview__explain-confidence">
            <span
              class="brand-overview__explain-confidence-badge"
              :class="confidenceClass(explainData.explain.confidence)"
            >
              {{ explainData.explain.confidence > 0 ? `Confidence ${explainData.explain.confidence}%` : 'Confidence Unknown' }}
            </span>
            <span
              v-if="explainData.score > 0"
              class="brand-overview__explain-adi-badge"
            >
              ADI {{ explainData.score }}
            </span>
          </div>

          <!-- Summary -->
          <p class="brand-overview__explain-summary">{{ explainData.explain.summary }}</p>

          <!-- Evidence Section -->
          <div class="brand-overview__explain-section">
            <h4 class="brand-overview__explain-section-title">证据来源</h4>
            <div
              v-for="ev in explainData.evidence"
              :key="ev.id"
              class="brand-overview__explain-evidence"
            >
              <div class="brand-overview__explain-evidence-header" @click="toggleEvidence(ev.id)">
                <span class="brand-overview__explain-evidence-source">{{ sourceLabel(ev.source) }}</span>
                <span class="brand-overview__explain-evidence-confidence">{{ ev.confidence }}%</span>
                <span class="brand-overview__explain-evidence-toggle">{{ expandedEvidence[ev.id] ? '−' : '+' }}</span>
              </div>
              <div v-if="expandedEvidence[ev.id]" class="brand-overview__explain-evidence-body">
                <p>{{ ev.content }}</p>
                <small>{{ formatDate(ev.createdAt) }}</small>
              </div>
            </div>
            <div v-if="explainData.evidence.length === 0" class="brand-overview__explain-evidence-empty">
              暂无可用证据
            </div>
          </div>

          <!-- Reasons Section -->
          <div class="brand-overview__explain-section">
            <h4 class="brand-overview__explain-section-title">原因分析</h4>
            <ul class="brand-overview__explain-reasons">
              <li v-for="(reason, idx) in explainData.explain.reasons" :key="idx" class="brand-overview__explain-reason">
                <code>{{ reason.code }}</code>
                <span>{{ reason.message }}</span>
              </li>
              <li v-if="explainData.explain.reasons.length === 0" class="brand-overview__explain-reason brand-overview__explain-reason--empty">
                暂无分析原因
              </li>
            </ul>
          </div>

          <!-- Limitations -->
          <div v-if="explainData.explain.limitations.length > 0" class="brand-overview__explain-section">
            <h4 class="brand-overview__explain-section-title">局限性</h4>
            <ul class="brand-overview__explain-limitations">
              <li v-for="(lim, idx) in explainData.explain.limitations" :key="idx">{{ lim }}</li>
            </ul>
          </div>

          <!-- Recommendations Section -->
          <div class="brand-overview__explain-section">
            <h4 class="brand-overview__explain-section-title">优化建议</h4>
            <div
              v-for="(rec, idx) in explainData.recommendations"
              :key="idx"
              class="brand-overview__explain-recommendation"
              :class="`brand-overview__explain-recommendation--${rec.priority}`"
            >
              <div class="brand-overview__explain-rec-header">
                <span class="brand-overview__explain-rec-priority">{{ priorityLabel(rec.priority) }}</span>
                <span class="brand-overview__explain-rec-difficulty">{{ difficultyLabel(rec.difficulty) }}</span>
              </div>
              <p class="brand-overview__explain-rec-action">{{ rec.action }}</p>
              <div class="brand-overview__explain-rec-impact">
                <span>预期收益: {{ rec.expectedImpact }}</span>
                <span>难度: {{ difficultyLabel(rec.difficulty) }}</span>
              </div>
            </div>
            <div v-if="explainData.recommendations.length === 0" class="brand-overview__explain-rec-empty">
              暂无优化建议
            </div>
          </div>
        </div>
      </section>

      <!-- ===== Optimization Center Section (P0-T004) ===== -->
      <section class="brand-overview__section">
        <h2 class="brand-overview__section-title">
          Optimization Center
          <button
            v-if="hasAnalysis && !optimizationLoading && !optimizationData"
            class="brand-overview__optimization-trigger"
            @click="loadOptimizations"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
            查看优化建议
          </button>
          <button
            v-if="optimizationData"
            class="brand-overview__optimization-trigger"
            @click="optimizationData = null; optimizationError = null"
          >
            收起
          </button>
        </h2>

        <!-- Optimization Loading State (三步骤) -->
        <div v-if="optimizationLoading" class="brand-overview__optimization-loading">
          <div class="brand-overview__optimization-loading-step" v-for="step in optSteps" :key="step.key">
            <span class="brand-overview__optimization-loading-icon" :class="optLoadingStepClass(step.key)">
              {{ step.icon }}
            </span>
            <span>{{ step.label }}</span>
          </div>
        </div>

        <!-- Optimization Error -->
        <div v-else-if="optimizationError" class="brand-overview__optimization-error">
          <p>{{ optimizationError }}</p>
          <button class="brand-overview__btn" @click="loadOptimizations">重试</button>
        </div>

        <!-- Optimization Empty State -->
        <div v-else-if="!hasAnalysis && !optimizationData" class="brand-overview__optimization-empty">
          <p>Run Quick Discovery to generate optimization suggestions.</p>
          <button
            class="brand-overview__btn brand-overview__btn--primary"
            @click="handleQuickDiscovery"
            :disabled="qdRunning"
          >
            {{ qdRunning ? '分析中...' : '运行 Quick Discovery' }}
          </button>
        </div>

        <!-- Optimization Data -->
        <div v-else-if="optimizationData" class="brand-overview__optimization-card">
          <!-- Optimization Summary (三列布局) -->
          <div class="brand-overview__opt-summary">
            <div class="brand-overview__opt-summary-item">
              <span class="brand-overview__opt-summary-label">Current ADI</span>
              <span class="brand-overview__opt-summary-value">{{ optimizationData.currentADI }}</span>
            </div>
            <div class="brand-overview__opt-summary-item">
              <span class="brand-overview__opt-summary-label">Estimated ADI</span>
              <span class="brand-overview__opt-summary-value brand-overview__opt-summary-value--estimated">
                {{ optimizationData.estimatedADI }}
              </span>
            </div>
            <div class="brand-overview__opt-summary-item">
              <span class="brand-overview__opt-summary-label">Potential Gain</span>
              <span
                v-if="optimizationData.potentialGainKnown"
                class="brand-overview__opt-summary-value brand-overview__opt-summary-value--gain"
              >
                +{{ optimizationData.potentialGain }}
              </span>
              <span v-else class="brand-overview__opt-summary-value brand-overview__opt-summary-value--unknown">
                Unknown
              </span>
            </div>
          </div>

          <!-- Recommendations -->
          <div class="brand-overview__opt-recommendations">
            <h4 class="brand-overview__opt-recommendations-title">
              优化建议 ({{ optimizationData.recommendations.length }})
            </h4>
            <div
              v-for="(rec, idx) in optimizationData.recommendations"
              :key="idx"
              class="brand-overview__opt-rec-card"
              :class="`brand-overview__opt-rec-card--${rec.priority}`"
            >
              <div class="brand-overview__opt-rec-left-bar" :class="`brand-overview__opt-rec-left-bar--${rec.priority}`" />
              <div class="brand-overview__opt-rec-content">
                <div class="brand-overview__opt-rec-header">
                  <span class="brand-overview__opt-rec-priority" :class="`brand-overview__opt-rec-priority--${rec.priority}`">
                    {{ priorityLabel(rec.priority) }}
                  </span>
                  <span class="brand-overview__opt-rec-difficulty" :class="`brand-overview__opt-rec-difficulty--${rec.difficulty}`">
                    {{ difficultyLabel(rec.difficulty) }}
                  </span>
                  <span class="brand-overview__opt-rec-impact">{{ rec.expectedImpact }}</span>
                </div>
                <p class="brand-overview__opt-rec-action">{{ rec.action }}</p>
                <p class="brand-overview__opt-rec-reason">{{ rec.reason }}</p>
                <button
                  class="brand-overview__opt-rec-start-btn"
                  @click="handleStartOptimization(rec)"
                >
                  Start Optimization
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- ===== AI Presence Section (P0-T005) ===== -->
      <section class="brand-overview__section">
        <h2 class="brand-overview__section-title">
          AI Presence
          <button
            v-if="hasAnalysis && !presenceLoading && !presenceData"
            class="brand-overview__presence-trigger"
            @click="loadPresence"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" />
            </svg>
            扫描 AI 可见度
          </button>
          <button
            v-if="presenceData"
            class="brand-overview__presence-trigger"
            @click="presenceData = null; presenceError = null"
          >
            收起
          </button>
        </h2>

        <!-- Loading -->
        <div v-if="presenceLoading" class="brand-overview__presence-loading">
          <div class="brand-overview__presence-loading-step" v-for="step in presenceSteps" :key="step.key">
            <span class="brand-overview__presence-loading-icon" :class="presenceLoadingStepClass(step.key)">
              {{ step.icon }}
            </span>
            <span>{{ step.label }}</span>
          </div>
        </div>

        <!-- Error -->
        <div v-else-if="presenceError" class="brand-overview__presence-error">
          <p>{{ presenceError }}</p>
          <button class="brand-overview__btn" @click="loadPresence">重试</button>
        </div>

        <!-- Empty State -->
        <div v-else-if="!hasAnalysis && !presenceData" class="brand-overview__presence-empty">
          <p>Run Quick Discovery to check AI presence.</p>
          <button
            class="brand-overview__btn brand-overview__btn--primary"
            @click="handleQuickDiscovery"
            :disabled="qdRunning"
          >
            {{ qdRunning ? '分析中...' : '运行 Quick Discovery' }}
          </button>
        </div>

        <!-- Presence Data -->
        <div v-else-if="presenceData" class="brand-overview__presence-card">
          <!-- Overall KPI Card -->
          <div class="brand-overview__presence-overall">
            <div class="brand-overview__presence-overall-score">
              <svg width="80" height="80" viewBox="0 0 80 80">
                <circle cx="40" cy="40" r="34" fill="none" stroke="#e5e7eb" stroke-width="4" />
                <circle
                  cx="40" cy="40" r="34"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="4"
                  stroke-linecap="round"
                  :stroke-dasharray="213.63"
                  :stroke-dashoffset="213.63 - (213.63 * presenceData.overall.score) / 100"
                  :class="presenceRingColor(presenceData.overall.score)"
                />
                <text x="40" y="36" text-anchor="middle" dominant-baseline="central" class="brand-overview__presence-score-text">
                  {{ presenceData.overall.score }}
                </text>
                <text x="40" y="54" text-anchor="middle" dominant-baseline="central" class="brand-overview__presence-score-label">
                  总分
                </text>
              </svg>
            </div>
            <div class="brand-overview__presence-overall-metrics">
              <div class="brand-overview__presence-metric">
                <span class="brand-overview__presence-metric-value">{{ presenceData.overall.visibilityCount }}/{{ presenceData.overall.totalChecked }}</span>
                <span class="brand-overview__presence-metric-label">监控中</span>
              </div>
              <div class="brand-overview__presence-metric">
                <span class="brand-overview__presence-metric-value">{{ presenceData.overall.averageKnowledge }}</span>
                <span class="brand-overview__presence-metric-label">平均知识质量</span>
              </div>
              <div class="brand-overview__presence-metric">
                <span class="brand-overview__presence-metric-value">{{ formatRelativeTime(presenceData.checkedAt) }}</span>
                <span class="brand-overview__presence-metric-label">最后扫描</span>
              </div>
            </div>
          </div>

          <!-- Provider List — Grouped by international/china -->
          <div class="brand-overview__presence-providers">
            <!-- International Group -->
            <div class="brand-overview__presence-group">
              <div class="brand-overview__presence-group-header">
                <span class="brand-overview__presence-group-icon">🌐</span>
                <span class="brand-overview__presence-group-label">国际平台</span>
              </div>
              <div
                v-for="provider in filteredProviders('international')"
                :key="provider.provider"
                class="brand-overview__presence-provider-card"
              >
                <div
                  class="brand-overview__presence-provider-header"
                  @click="togglePresenceExplain(provider.provider)"
                >
                  <!-- Provider Logo / Initial -->
                  <div class="brand-overview__presence-provider-logo" :class="`brand-overview__provider-logo--${provider.provider}`">
                    {{ provider.displayName.charAt(0) }}
                  </div>

                  <!-- Provider Info -->
                  <div class="brand-overview__presence-provider-info">
                    <div class="brand-overview__presence-provider-top">
                      <span class="brand-overview__presence-provider-name">{{ provider.displayName }}</span>
                      <span
                        class="brand-overview__presence-visibility-badge"
                        :class="`brand-overview__visibility--${provider.visibility}`"
                      >
                        {{ visibilityLabel(provider.visibility) }}
                      </span>
                    </div>
                    <div class="brand-overview__presence-provider-details">
                      <div class="brand-overview__presence-knowledge-bar" v-if="typeof provider.knowledgeQuality === 'number'">
                        <div
                          class="brand-overview__presence-knowledge-fill"
                          :style="{ width: provider.knowledgeQuality + '%' }"
                          :class="presenceBarColor(provider.knowledgeQuality)"
                        />
                      </div>
                      <span v-if="typeof provider.knowledgeQuality === 'number'" class="brand-overview__presence-knowledge-text">
                        知识质量 {{ provider.knowledgeQuality }}
                      </span>
                      <span
                        class="brand-overview__presence-evidence-badge"
                        :class="`brand-overview__evidence--${provider.evidenceLevel}`"
                      >
                        Evidence {{ provider.evidenceLevel }}
                      </span>
                    </div>
                  </div>

                  <!-- Expand Toggle -->
                  <span class="brand-overview__presence-expand-toggle">
                    {{ expandedPresence[provider.provider] ? '−' : '+' }}
                  </span>
                </div>

                <!-- Explain Section (expandable) -->
                <div v-if="expandedPresence[provider.provider]" class="brand-overview__presence-explain-body">
                  <div class="brand-overview__presence-explain-evidence" v-if="provider.evidenceCount > 0">
                    <h4>Evidence</h4>
                    <p>{{ provider.explain || provider.summary }}</p>
                  </div>
                  <div class="brand-overview__presence-explain-explain">
                    <h4>Explain</h4>
                    <p>{{ provider.explain || provider.summary || '暂无可用的分析说明' }}</p>
                  </div>
                  <div class="brand-overview__presence-explain-rec">
                    <h4>Recommendations</h4>
                    <ul>
                      <li v-for="(rec, ridx) in provider.recommendations" :key="ridx">{{ rec }}</li>
                      <li v-if="provider.recommendations.length === 0" class="brand-overview__presence-rec-empty">暂无建议</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            <!-- China Group -->
            <div class="brand-overview__presence-group">
              <div class="brand-overview__presence-group-header">
                <span class="brand-overview__presence-group-icon">🇨🇳</span>
                <span class="brand-overview__presence-group-label">国内平台</span>
              </div>
              <div
                v-for="provider in filteredProviders('china')"
                :key="provider.provider"
                class="brand-overview__presence-provider-card"
              >
                <div
                  class="brand-overview__presence-provider-header"
                  @click="togglePresenceExplain(provider.provider)"
                >
                  <!-- Provider Logo / Initial -->
                  <div class="brand-overview__presence-provider-logo" :class="`brand-overview__provider-logo--${provider.provider}`">
                    {{ provider.displayName.charAt(0) }}
                  </div>

                  <!-- Provider Info -->
                  <div class="brand-overview__presence-provider-info">
                    <div class="brand-overview__presence-provider-top">
                      <span class="brand-overview__presence-provider-name">{{ provider.displayName }}</span>
                      <span
                        class="brand-overview__presence-visibility-badge"
                        :class="`brand-overview__visibility--${provider.visibility}`"
                      >
                        {{ visibilityLabel(provider.visibility) }}
                      </span>
                    </div>
                    <div class="brand-overview__presence-provider-details">
                      <div class="brand-overview__presence-knowledge-bar" v-if="typeof provider.knowledgeQuality === 'number'">
                        <div
                          class="brand-overview__presence-knowledge-fill"
                          :style="{ width: provider.knowledgeQuality + '%' }"
                          :class="presenceBarColor(provider.knowledgeQuality)"
                        />
                      </div>
                      <span v-if="typeof provider.knowledgeQuality === 'number'" class="brand-overview__presence-knowledge-text">
                        知识质量 {{ provider.knowledgeQuality }}
                      </span>
                      <span
                        class="brand-overview__presence-evidence-badge"
                        :class="`brand-overview__evidence--${provider.evidenceLevel}`"
                      >
                        Evidence {{ provider.evidenceLevel }}
                      </span>
                    </div>
                  </div>

                  <!-- Expand Toggle -->
                  <span class="brand-overview__presence-expand-toggle">
                    {{ expandedPresence[provider.provider] ? '−' : '+' }}
                  </span>
                </div>

                <!-- Explain Section (expandable) -->
                <div v-if="expandedPresence[provider.provider]" class="brand-overview__presence-explain-body">
                  <div class="brand-overview__presence-explain-evidence" v-if="provider.evidenceCount > 0">
                    <h4>Evidence</h4>
                    <p>{{ provider.explain || provider.summary }}</p>
                  </div>
                  <div class="brand-overview__presence-explain-explain">
                    <h4>Explain</h4>
                    <p>{{ provider.explain || provider.summary || '暂无可用的分析说明' }}</p>
                  </div>
                  <div class="brand-overview__presence-explain-rec">
                    <h4>Recommendations</h4>
                    <ul>
                      <li v-for="(rec, ridx) in provider.recommendations" :key="ridx">{{ rec }}</li>
                      <li v-if="provider.recommendations.length === 0" class="brand-overview__presence-rec-empty">暂无建议</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- ===== Verification Section (P0-T006) ===== -->
      <section class="brand-overview__section">
        <h2 class="brand-overview__section-title">
          Verification
          <button
            v-if="hasAnalysis && !verificationLoading && !verificationData"
            class="brand-overview__verification-trigger"
            @click="runVerification"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M9 12l2 2 4-4" />
              <path d="M12 2a10 10 0 100 20 10 10 0 000-20z" />
            </svg>
            Run Verification
          </button>
          <button
            v-if="verificationData"
            class="brand-overview__verification-trigger"
            @click="verificationData = null; verificationError = null; verificationHistory = null"
          >
            收起
          </button>
        </h2>

        <!-- Verification Loading -->
        <div v-if="verificationLoading" class="brand-overview__verification-loading">
          <div class="brand-overview__verification-loading-step" v-for="step in veriSteps" :key="step.key">
            <span class="brand-overview__verification-loading-icon" :class="veriLoadingStepClass(step.key)">
              {{ step.icon }}
            </span>
            <span>{{ step.label }}</span>
          </div>
        </div>

        <!-- Verification Error -->
        <div v-else-if="verificationError" class="brand-overview__verification-error">
          <p>{{ verificationError }}</p>
          <button class="brand-overview__btn" @click="runVerification">重试</button>
        </div>

        <!-- Verification Empty State -->
        <div v-else-if="!hasAnalysis && !verificationData" class="brand-overview__verification-empty">
          <p>Run Quick Discovery first, then verify.</p>
          <button
            class="brand-overview__btn brand-overview__btn--primary"
            @click="handleQuickDiscovery"
            :disabled="qdRunning"
          >
            {{ qdRunning ? '分析中...' : '运行 Quick Discovery' }}
          </button>
        </div>

        <!-- Verification Data -->
        <div v-else-if="verificationData" class="brand-overview__verification-card">
          <!-- Status Header -->
          <div class="brand-overview__veri-status-bar">
            <span
              class="brand-overview__veri-status-badge"
              :class="`brand-overview__veri-status--${verificationData.status.toLowerCase()}`"
            >
              {{ verificationData.status }}
            </span>
            <span class="brand-overview__veri-confidence">
              Confidence {{ verificationData.confidence }}%
            </span>
            <span class="brand-overview__veri-evidence-grade">
              Evidence {{ verificationData.after.evidenceGrade }}
            </span>
          </div>

          <!-- Before / After Comparison Table -->
          <div class="brand-overview__veri-comparison">
            <h4 class="brand-overview__veri-subtitle">Before / After Comparison</h4>
            <table class="brand-overview__veri-table">
              <thead>
                <tr>
                  <th>Metric</th>
                  <th>Before</th>
                  <th>After</th>
                  <th>Delta</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>ADI</td>
                  <td>{{ verificationData.before.adi }}</td>
                  <td>{{ verificationData.after.adi }}</td>
                  <td :class="deltaClass(verificationData.delta.adi)">
                    {{ deltaSign(verificationData.delta.adi) }}{{ verificationData.delta.adi }}
                  </td>
                </tr>
                <tr>
                  <td>AI Presence</td>
                  <td>{{ verificationData.before.aiPresenceScore }}</td>
                  <td>{{ verificationData.after.aiPresenceScore }}</td>
                  <td :class="deltaClass(verificationData.delta.aiPresenceScore)">
                    {{ deltaSign(verificationData.delta.aiPresenceScore) }}{{ verificationData.delta.aiPresenceScore }}
                  </td>
                </tr>
                <tr>
                  <td>Visibility</td>
                  <td>{{ verificationData.before.visibilityCount }}</td>
                  <td>{{ verificationData.after.visibilityCount }}</td>
                  <td :class="deltaClass(verificationData.delta.visibilityCount)">
                    {{ deltaSign(verificationData.delta.visibilityCount) }}{{ verificationData.delta.visibilityCount }}
                  </td>
                </tr>
                <tr>
                  <td>Avg Knowledge</td>
                  <td>{{ verificationData.before.averageKnowledge }}</td>
                  <td>{{ verificationData.after.averageKnowledge }}</td>
                  <td :class="deltaClass(verificationData.delta.averageKnowledge)">
                    {{ deltaSign(verificationData.delta.averageKnowledge) }}{{ verificationData.delta.averageKnowledge }}
                  </td>
                </tr>
                <tr>
                  <td>Evidence Grade</td>
                  <td>{{ verificationData.before.evidenceGrade }}</td>
                  <td>{{ verificationData.after.evidenceGrade }}</td>
                  <td :class="deltaClass(verificationData.delta.evidenceGradeDelta)">
                    {{ verificationData.delta.evidenceGradeDelta > 0 ? '↑' : verificationData.delta.evidenceGradeDelta < 0 ? '↓' : '—' }}
                    {{ Math.abs(verificationData.delta.evidenceGradeDelta) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Claims -->
          <div class="brand-overview__veri-claims">
            <h4 class="brand-overview__veri-subtitle">
              Claims ({{ verificationData.claims.length }})
            </h4>
            <div
              v-for="claim in verificationData.claims"
              :key="claim.id"
              class="brand-overview__veri-claim-card"
              :class="`brand-overview__veri-claim--${claim.type}`"
            >
              <div class="brand-overview__veri-claim-icon">
                <span v-if="claim.type === 'improvement'">🟢</span>
                <span v-else-if="claim.type === 'regression'">🔴</span>
                <span v-else>⚪</span>
              </div>
              <div class="brand-overview__veri-claim-body">
                <div class="brand-overview__veri-claim-summary">{{ claim.summary }}</div>
                <div class="brand-overview__veri-claim-meta">
                  <span class="brand-overview__veri-claim-confidence">Confidence {{ claim.confidence }}%</span>
                  <span v-if="claim.evidence.length > 0" class="brand-overview__veri-claim-evidence-count">
                    证据: {{ claim.evidence.length }} 条
                  </span>
                </div>
              </div>
            </div>
          </div>

          <!-- Evidence Timeline -->
          <div class="brand-overview__veri-evidence">
            <h4 class="brand-overview__veri-subtitle">
              Evidence Timeline ({{ verificationData.evidence.length }})
            </h4>
            <div class="brand-overview__veri-timeline">
              <div
                v-for="(ev, idx) in verificationData.evidence"
                :key="ev.id"
                class="brand-overview__veri-timeline-item"
              >
                <div class="brand-overview__veri-timeline-dot" :class="`brand-overview__veri-timeline-dot--${ev.type}`" />
                <div class="brand-overview__veri-timeline-content">
                  <div class="brand-overview__veri-timeline-header" @click="toggleVeriEvidence(ev.id)">
                    <span class="brand-overview__veri-timeline-type">{{ ev.type }}</span>
                    <span class="brand-overview__veri-timeline-source">{{ ev.source }}</span>
                    <span class="brand-overview__veri-timeline-toggle">{{ expandedVeriEvidence[ev.id] ? '−' : '+' }}</span>
                  </div>
                  <div v-if="expandedVeriEvidence[ev.id]" class="brand-overview__veri-timeline-body">
                    <p>{{ ev.content }}</p>
                    <small>{{ formatDate(ev.timestamp) }}</small>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Explain -->
          <div class="brand-overview__veri-explain">
            <h4 class="brand-overview__veri-subtitle">Explain</h4>
            <p class="brand-overview__veri-explain-summary">{{ verificationData.explain.summary }}</p>
            <div v-if="verificationData.explain.reasons.length > 0" class="brand-overview__veri-explain-reasons">
              <h5>原因</h5>
              <ul>
                <li v-for="(reason, idx) in verificationData.explain.reasons" :key="idx">
                  <code>{{ reason.code }}</code>: {{ reason.message }}
                </li>
              </ul>
            </div>
            <div v-if="verificationData.explain.limitations.length > 0" class="brand-overview__veri-explain-limitations">
              <h5>局限性</h5>
              <ul>
                <li v-for="(lim, idx) in verificationData.explain.limitations" :key="idx">{{ lim }}</li>
              </ul>
            </div>
          </div>

          <!-- Recommendations -->
          <div class="brand-overview__veri-recommendations">
            <h4 class="brand-overview__veri-subtitle">Recommendation</h4>
            <div
              v-for="(rec, idx) in verificationData.recommendations"
              :key="idx"
              class="brand-overview__veri-rec-card"
              :class="`brand-overview__veri-rec--${rec.priority}`"
            >
              <div class="brand-overview__veri-rec-header">
                <span class="brand-overview__veri-rec-priority" :class="`brand-overview__veri-rec-priority--${rec.priority}`">
                  {{ rec.priority === 'high' ? '🔴' : rec.priority === 'medium' ? '🟡' : '🟢' }}
                  {{ priorityLabel(rec.priority) }}
                </span>
              </div>
              <p class="brand-overview__veri-rec-action">
                {{ rec.action }}
                <span v-if="rec.expectedImpact" class="brand-overview__veri-rec-impact">
                  — {{ rec.expectedImpact }}
                </span>
              </p>
              <p class="brand-overview__veri-rec-reason">{{ rec.reason }}</p>
            </div>
          </div>

          <!-- Verification History -->
          <div v-if="verificationHistory && verificationHistory.length > 1" class="brand-overview__veri-history">
            <h4 class="brand-overview__veri-subtitle">Verification History</h4>
            <div class="brand-overview__veri-history-list">
              <div
                v-for="entry in verificationHistory"
                :key="entry.id"
                class="brand-overview__veri-history-item"
                @click="viewVerificationDetail(entry.id)"
              >
                <span
                  class="brand-overview__veri-history-status"
                  :class="`brand-overview__veri-status--${entry.status.toLowerCase()}`"
                >
                  {{ entry.status }}
                </span>
                <span class="brand-overview__veri-history-adi" :class="entry.adiDelta >= 0 ? 'delta--positive' : 'delta--negative'">
                  {{ entry.adiDelta >= 0 ? '+' : '' }}{{ entry.adiDelta }}
                </span>
                <span class="brand-overview__veri-history-confidence">Conf {{ entry.confidence }}%</span>
                <span class="brand-overview__veri-history-date">{{ formatDate(entry.createdAt) }}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- ===== Brand Info Card (P2-T002-P0 1.d) ===== -->
      <section class="brand-overview__section">
        <h2 class="brand-overview__section-title">品牌信息</h2>
        <div class="brand-overview__info-card">
          <div class="brand-overview__info-row">
            <span class="brand-overview__info-label">名称</span>
            <span class="brand-overview__info-value">{{ project.name }}</span>
          </div>
          <div class="brand-overview__info-row">
            <span class="brand-overview__info-label">官网</span>
            <span class="brand-overview__info-value">
              <a
                v-if="projectWebsite"
                :href="projectWebsite"
                target="_blank"
                rel="noopener noreferrer"
                class="brand-overview__info-link"
              >
                {{ projectWebsite }}
              </a>
              <span v-else class="brand-overview__info-empty">未设置</span>
            </span>
          </div>
          <div class="brand-overview__info-row">
            <span class="brand-overview__info-label">行业</span>
            <span class="brand-overview__info-value">{{ project.industry || '未设置' }}</span>
          </div>
          <div class="brand-overview__info-row">
            <span class="brand-overview__info-label">品牌描述</span>
            <span class="brand-overview__info-value">{{ projectDescription || '暂无描述' }}</span>
          </div>
          <div class="brand-overview__info-row">
            <span class="brand-overview__info-label">创建时间</span>
            <span class="brand-overview__info-value">{{ formatDate(project.createdAt) }}</span>
          </div>
        </div>
      </section>
    </template>

    <!-- ===== Brand Create Modal (Edit Mode) ===== -->
    <BrandCreateModal
      v-if="showEditModal"
      :project="editingProject"
      @created="onBrandUpdated"
      @cancelled="onEditCancelled"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useGeoProjectStore } from '../stores/useGeoProjectStore'
import { useWorkflowStore } from '../stores/useWorkflowStore'
import BrandCreateModal from '../components/BrandCreateModal.vue'

definePageMeta({
  title: 'Brand Overview',
})

const router = useRouter()
const route = useRoute()
const projectStore = useGeoProjectStore()
const workflowStore = useWorkflowStore()

// ── State ──
const loading = ref(false)
const error = ref<string | null>(null)
const project = ref<any>(null)
const showEditModal = ref(false)
const qdRunning = ref(false)
const qdError = ref<string | null>(null)
const editingProject = ref<{
  id: string
  name: string
  website?: string
  industry?: string
  description?: string
} | null>(null)

// ── Explain State (P0-T003) ──
const explainData = ref<any>(null)
const explainLoading = ref(false)
const explainError = ref<string | null>(null)
const explainSteps = [
  { key: 'analyzing', label: 'Analyzing...', icon: '🔍', done: false },
  { key: 'collecting', label: 'Collecting Evidence...', icon: '📋', done: false },
  { key: 'generating', label: 'Generating Explain...', icon: '🧠', done: false },
]
const explainStepIndex = ref(0)
const expandedEvidence = ref<Record<string, boolean>>({})

// ── Optimization State (P0-T004) ──
const optimizationData = ref<any>(null)
const optimizationLoading = ref(false)
const optimizationError = ref<string | null>(null)
const optSteps = [
  { key: 'analyzing', label: 'Analyzing opportunities...', icon: '🔍', done: false },
  { key: 'calculating', label: 'Calculating impact...', icon: '📊', done: false },
  { key: 'generating', label: 'Generating recommendations...', icon: '💡', done: false },
]
const optStepIndex = ref(0)

// ── Presence State (P0-T005) ──
const presenceData = ref<any>(null)
const presenceLoading = ref(false)
const presenceError = ref<string | null>(null)
const presenceSteps = [
  { key: 'chatgpt', label: 'Analyzing ChatGPT...', icon: '🤖', done: false },
  { key: 'gemini', label: 'Analyzing Gemini...', icon: '🔮', done: false },
  { key: 'claude', label: 'Analyzing Claude...', icon: '🧠', done: false },
  { key: 'deepseek', label: 'Analyzing DeepSeek...', icon: '🔍', done: false },
  { key: 'perplexity', label: 'Analyzing Perplexity...', icon: '🔎', done: false },
  { key: 'copilot', label: 'Analyzing Copilot...', icon: '🪟', done: false },
  { key: 'doubao', label: 'Analyzing 豆包...', icon: '🫘', done: false },
  { key: 'tongyi', label: 'Analyzing 通义千问...', icon: '🌐', done: false },
  { key: 'wenxin', label: 'Analyzing 文心一言...', icon: '📖', done: false },
  { key: 'yuanbao', label: 'Analyzing 腾讯元宝...', icon: '💰', done: false },
  { key: 'kimi', label: 'Analyzing Kimi...', icon: '🌙', done: false },
  { key: 'xinghuo', label: 'Analyzing 讯飞星火...', icon: '🔥', done: false },
]
const presenceStepIndex = ref(0)
const expandedPresence = ref<Record<string, boolean>>({})

// ── Verification State (P0-T006) ──
const verificationData = ref<any>(null)
const verificationLoading = ref(false)
const verificationError = ref<string | null>(null)
const verificationHistory = ref<any[] | null>(null)
const expandedVeriEvidence = ref<Record<string, boolean>>({})
const veriSteps = [
  { key: 'comparing', label: 'Comparing before/after...', icon: '📊', done: false },
  { key: 'generating_claims', label: 'Generating claims...', icon: '📋', done: false },
  { key: 'building_evidence', label: 'Building evidence...', icon: '🔍', done: false },
]
const veriStepIndex = ref(0)

// ── Computed ──

const projectSlug = computed(() => {
  if (!project.value?.name) return ''
  return project.value.name
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-|-$/g, '')
})

const projectWebsite = computed(() => {
  return project.value?.website || project.value?.config?.website || ''
})

const projectDescription = computed(() => {
  return project.value?.description || project.value?.config?.description || ''
})

// Identity Score: name(15) + website(15) + industry(15) + description(15) + region(10) + language(10) = 70 max
const IDENTITY_MAX = 70

const identityScore = computed(() => {
  let score = 0
  if (project.value?.name) score += 15
  if (projectWebsite.value) score += 15
  if (project.value?.industry) score += 15
  if (projectDescription.value) score += 15
  if (project.value?.region || project.value?.config?.region) score += 10
  if (project.value?.language || project.value?.config?.language) score += 10
  return Math.min(100, Math.round((score / IDENTITY_MAX) * 100))
})

// Knowledge Score: entity count + knowledge source count (mock: max 70)
const KNOWLEDGE_MAX = 70

const entityCount = computed(() => project.value?.entityCount ?? 0)
const knowledgeSourceCount = computed(() => project.value?.versionCount ?? 0)

// Knowledge Score: 有 discovery report 才显示分数
const hasAnalysis = computed(() => !!(project.value?.config?.adi > 0 || project.value?.discoveryReportId || project.value?.discoveryReport))
const adiScore = computed(() => project.value?.config?.adi || 0)

const knowledgeScore = computed(() => {
  if (!hasAnalysis.value) return 0
  let score = 0
  if (entityCount.value > 0) score += Math.min(35, entityCount.value * 5)
  if (knowledgeSourceCount.value > 0) score += Math.min(35, knowledgeSourceCount.value * 15)
  return Math.min(100, Math.round((score / KNOWLEDGE_MAX) * 100))
})

// Optimization Score: assessment count + verification count (max 70)
const OPTIMIZATION_MAX = 70

const assessmentCount = computed(() => {
  return hasAnalysis.value ? 1 : 0
})

const verificationCount = computed(() => {
  return project.value?.verificationReport || project.value?.hasVerification ? 1 : 0
})

const optimizationScore = computed(() => {
  if (!hasAnalysis.value) return 0
  let score = 0
  if (assessmentCount.value > 0) score += 40
  if (verificationCount.value > 0) score += 30
  return Math.min(100, Math.round((score / OPTIMIZATION_MAX) * 100))
})

const completenessPercent = computed(() => {
  if (!hasAnalysis.value) return 0
  const identityScoreVal = identityScore.value
  const knowledgeScoreVal = knowledgeScore.value
  const optimizationScoreVal = optimizationScore.value
  return Math.round((identityScoreVal + knowledgeScoreVal + optimizationScoreVal) / 3)
})

// ── Helpers ──

function statusLabel(status: string): string {
  switch (status) {
    case 'active': return '进行中'
    case 'monitoring': return '监测中'
    case 'completed': return '已完成'
    default: return '草稿'
  }
}

function completenessRingColor(score: number): string {
  if (score >= 80) return 'brand-overview__ring--high'
  if (score >= 50) return 'brand-overview__ring--medium'
  return 'brand-overview__ring--low'
}

function dimensionScoreColor(score: number): string {
  if (score >= 80) return 'brand-overview__score--high'
  if (score >= 50) return 'brand-overview__score--medium'
  return 'brand-overview__score--low'
}

function dimensionBarColor(score: number): string {
  if (score >= 80) return 'brand-overview__dimension-fill--high'
  if (score >= 50) return 'brand-overview__dimension-fill--medium'
  return 'brand-overview__dimension-fill--low'
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// ── Explain Helpers (P0-T003) ──

function sourceLabel(source: string): string {
  const labels: Record<string, string> = {
    website: '官网',
    structuredData: '结构化数据',
    search: '搜索引擎',
    aiConversation: 'AI 对话',
    knowledgeBase: '知识库',
  }
  return labels[source] || source
}

function priorityLabel(priority: string): string {
  const labels: Record<string, string> = { high: '高优先级', medium: '中优先级', low: '低优先级' }
  return labels[priority] || priority
}

function difficultyLabel(difficulty: string): string {
  const labels: Record<string, string> = { easy: '简单', medium: '中等', hard: '困难' }
  return labels[difficulty] || difficulty
}

function confidenceClass(confidence: number): string {
  if (confidence >= 70) return 'brand-overview__confidence--high'
  if (confidence >= 40) return 'brand-overview__confidence--medium'
  return 'brand-overview__confidence--low'
}

function explainLoadingStepClass(stepKey: string): string {
  const idx = explainSteps.findIndex(s => s.key === stepKey)
  if (idx < explainStepIndex.value) return 'brand-overview__explain-step--done'
  if (idx === explainStepIndex.value) return 'brand-overview__explain-step--active'
  return 'brand-overview__explain-step--pending'
}

function toggleEvidence(id: string) {
  expandedEvidence.value[id] = !expandedEvidence.value[id]
}

// ── Optimization Helpers (P0-T004) ──

function optLoadingStepClass(stepKey: string): string {
  const idx = optSteps.findIndex(s => s.key === stepKey)
  if (idx < optStepIndex.value) return 'brand-overview__opt-step--done'
  if (idx === optStepIndex.value) return 'brand-overview__opt-step--active'
  return 'brand-overview__opt-step--pending'
}

async function loadOptimizations() {
  if (!project.value) return
  optimizationLoading.value = true
  optimizationError.value = null
  optimizationData.value = null
  optStepIndex.value = 0

  try {
    // Simulate multi-step loading (三步骤)
    optStepIndex.value = 0
    await new Promise(r => setTimeout(r, 600))
    optStepIndex.value = 1
    await new Promise(r => setTimeout(r, 500))
    optStepIndex.value = 2
    await new Promise(r => setTimeout(r, 400))

    const token = typeof window !== 'undefined' ? window.localStorage?.getItem('auth_token') || '' : ''
    const res = await fetch(`/api/geo/brands/${project.value.id}/optimizations`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    const json = await res.json()
    if (json.success && json.data) {
      optimizationData.value = json.data
    } else {
      optimizationError.value = json.error || '获取优化建议失败'
    }
  } catch (err: any) {
    optimizationError.value = err?.message || '请求失败'
  } finally {
    optimizationLoading.value = false
    optStepIndex.value = 3 // all steps done
  }
}

function handleStartOptimization(rec: any) {
  // 弹窗提示或占位页
  alert(`即将开始优化: ${rec.action}\n\n预期收益: ${rec.expectedImpact}\n难度: ${rec.difficulty}`)
}

async function loadExplain() {
  if (!project.value) return
  explainLoading.value = true
  explainError.value = null
  explainData.value = null
  explainStepIndex.value = 0
  expandedEvidence.value = {}

  try {
    // Simulate multi-step loading
    explainStepIndex.value = 0
    await new Promise(r => setTimeout(r, 600))

    explainStepIndex.value = 1
    await new Promise(r => setTimeout(r, 500))

    explainStepIndex.value = 2
    await new Promise(r => setTimeout(r, 400))

    const res = await fetch(`/api/geo/brands/${project.value.id}/explain`, {
      headers: {
        Authorization: `Bearer ${typeof window !== 'undefined' ? window.localStorage?.getItem('auth_token') || '' : ''}`,
      },
    })
    const json = await res.json()
    if (json.success && json.data) {
      explainData.value = json.data
    } else {
      explainError.value = json.error || '获取 Explain 失败'
    }
  } catch (err: any) {
    explainError.value = err?.message || '请求失败'
  } finally {
    explainLoading.value = false
    explainStepIndex.value = 3 // all steps done
  }
}

// ── Presence Helpers (P0-T005.1) ──

function filteredProviders(group: string) {
  if (!presenceData.value?.providers) return []
  return presenceData.value.providers.filter((p: any) => p.group === group)
}

function visibilityLabel(visibility: string): string {
  const labels: Record<string, string> = {
    visible: 'Visible',
    partial: 'Partial',
    missing: 'Missing',
    checking: 'Checking',
    unknown: 'Unknown',
  }
  return labels[visibility] || visibility
}

function presenceRingColor(score: number): string {
  if (score >= 80) return 'brand-overview__presence-ring--high'
  if (score >= 50) return 'brand-overview__presence-ring--medium'
  return 'brand-overview__presence-ring--low'
}

function presenceBarColor(quality: number): string {
  if (quality >= 80) return 'brand-overview__presence-bar--high'
  if (quality >= 50) return 'brand-overview__presence-bar--medium'
  return 'brand-overview__presence-bar--low'
}

function presenceLoadingStepClass(stepKey: string): string {
  const idx = presenceSteps.findIndex(s => s.key === stepKey)
  if (idx < presenceStepIndex.value) return 'brand-overview__presence-step--done'
  if (idx === presenceStepIndex.value) return 'brand-overview__presence-step--active'
  return 'brand-overview__presence-step--pending'
}

function formatRelativeTime(dateStr: string): string {
  if (!dateStr) return '—'
  const now = Date.now()
  const d = new Date(dateStr).getTime()
  const diff = now - d
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes} 分钟前`
  if (hours < 24) return `${hours} 小时前`
  if (days < 7) return `${days} 天前`
  return new Date(dateStr).toLocaleDateString('zh-CN')
}

function togglePresenceExplain(providerKey: string) {
  expandedPresence.value[providerKey] = !expandedPresence.value[providerKey]
}

async function loadPresence() {
  if (!project.value) return
  presenceLoading.value = true
  presenceError.value = null
  presenceData.value = null
  presenceStepIndex.value = 0
  expandedPresence.value = {}

  try {
    // Simulate multi-step scanning animation
    for (let i = 0; i < presenceSteps.length; i++) {
      presenceStepIndex.value = i
      await new Promise(r => setTimeout(r, 300 + Math.random() * 200))
    }

    const token = typeof window !== 'undefined' ? window.localStorage?.getItem('auth_token') || '' : ''
    const res = await fetch(`/api/geo/brands/${project.value.id}/presence`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    const json = await res.json()
    if (json.success && json.data) {
      presenceData.value = json.data
    } else {
      presenceError.value = json.error || '获取 AI 可见度数据失败'
    }
  } catch (err: any) {
    presenceError.value = err?.message || '请求失败'
  } finally {
    presenceLoading.value = false
    presenceStepIndex.value = presenceSteps.length // all done
  }
}

// ── Verification Functions (P0-T006) ──

function deltaClass(val: number): string {
  if (val > 0) return 'delta--positive'
  if (val < 0) return 'delta--negative'
  return ''
}

function deltaSign(val: number): string {
  return val > 0 ? '+' : ''
}

function toggleVeriEvidence(id: string) {
  expandedVeriEvidence.value[id] = !expandedVeriEvidence.value[id]
}

function veriLoadingStepClass(stepKey: string): string {
  const idx = veriSteps.findIndex(s => s.key === stepKey)
  if (idx < veriStepIndex.value) return 'brand-overview__veri-step--done'
  if (idx === veriStepIndex.value) return 'brand-overview__veri-step--active'
  return 'brand-overview__veri-step--pending'
}

async function runVerification() {
  if (!project.value) return
  verificationLoading.value = true
  verificationError.value = null
  verificationData.value = null
  verificationHistory.value = null
  expandedVeriEvidence.value = {}
  veriStepIndex.value = 0

  try {
    // Multi-step loading animation
    veriStepIndex.value = 0
    await new Promise(r => setTimeout(r, 400))
    veriStepIndex.value = 1
    await new Promise(r => setTimeout(r, 400))
    veriStepIndex.value = 2
    await new Promise(r => setTimeout(r, 400))

    const token = typeof window !== 'undefined' ? window.localStorage?.getItem('auth_token') || '' : ''
    const res = await fetch(`/api/geo/brands/${project.value.id}/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({}),
    })
    const json = await res.json()
    if (json.success && json.data) {
      verificationData.value = json.data

      // Also fetch history
      try {
        const histRes = await fetch(`/api/geo/brands/${project.value.id}/verifications`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        const histJson = await histRes.json()
        if (histJson.success && histJson.data) {
          verificationHistory.value = histJson.data
        }
      } catch { /* non-critical */ }
    } else {
      verificationError.value = json.error || 'Verification failed'
    }
  } catch (err: any) {
    verificationError.value = err?.message || '请求失败'
  } finally {
    verificationLoading.value = false
    veriStepIndex.value = 3
  }
}

async function viewVerificationDetail(id: string) {
  if (!project.value) return
  try {
    const token = typeof window !== 'undefined' ? window.localStorage?.getItem('auth_token') || '' : ''
    const res = await fetch(`/api/geo/brands/${project.value.id}/verifications/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const json = await res.json()
    if (json.success && json.data) {
      verificationData.value = json.data
    }
  } catch { /* non-critical */ }
}

// ── Lifecycle ──
onMounted(async () => {
  await loadData()
})

// ── Data Loading ──
async function loadData() {
  const projectId = route.params.id as string
  if (!projectId) {
    error.value = '缺少项目 ID'
    return
  }

  loading.value = true
  error.value = null

  try {
    // Try loading brand detail first (enriched with brand settings)
    const brandData = await projectStore.loadBrand(projectId)
    if (brandData) {
      project.value = { ...brandData }
    } else {
      // Fallback to project dashboard
      await projectStore.loadProject(projectId)
      project.value = projectStore.currentProject ? { ...projectStore.currentProject } : null

      if (!project.value) {
        // Last resort: try listing projects
        await projectStore.listProjects()
        const found = projectStore.projects.find((p: any) => p.id === projectId)
        if (found) {
          project.value = { ...found }
        } else {
          error.value = '未找到该品牌项目'
        }
      }
    }
  } catch (err: any) {
    error.value = err?.message || '加载品牌详情失败'
  } finally {
    loading.value = false
  }
}

// ── Actions ──

function handleEditBrand() {
  if (!project.value) return
  editingProject.value = {
    id: project.value.id,
    name: project.value.name || '',
    website: projectWebsite.value,
    industry: project.value.industry || '',
    description: projectDescription.value,
  }
  showEditModal.value = true
}

async function confirmDelete() {
  if (!project.value) return
  const confirmed = window.confirm(`确定要删除「${project.value.name}」吗？此操作不可撤销。`)
  if (!confirmed) return

  try {
    await projectStore.deleteBrand(project.value.id)
    router.push('/workspace/geo/dashboard')
  } catch (err: any) {
    error.value = err?.message || '删除失败'
  }
}

function handleGEOAssessment() {
  if (!project.value) return
  workflowStore.initializeForProject(project.value.id)
  router.push(`/workspace/geo/project/${project.value.id}`)
}

function handleAddKnowledge() {
  if (!project.value) return
  router.push(`/workspace/geo/knowledge?projectId=${project.value.id}`)
}

async function handleQuickDiscovery() {
  if (!project.value || qdRunning.value) return
  qdRunning.value = true
  qdError.value = null

  try {
    const result = await projectStore.quickDiscovery(project.value.id)
    if (result) {
      // Refresh project data to show updated scores
      const fresh = await projectStore.loadBrand(project.value.id)
      if (fresh) project.value = { ...fresh }
    } else {
      qdError.value = projectStore.error || '分析失败，请重试'
    }
  } catch (err: any) {
    qdError.value = err?.message || '分析失败'
  } finally {
    qdRunning.value = false
  }
}

async function onBrandUpdated(projectId: string) {
  showEditModal.value = false
  editingProject.value = null
  // Immediately load fresh brand data to reflect updates without full refresh
  const brandData = await projectStore.loadBrand(projectId)
  if (brandData) {
    project.value = { ...brandData }
  } else {
    await loadData()
  }
}

function onEditCancelled() {
  showEditModal.value = false
  editingProject.value = null
}
</script>

<style scoped>
.brand-overview {
  max-width: 900px;
  margin: 0 auto;
  font-family: var(--font-family, Inter, -apple-system, sans-serif);
  padding: 0 0 48px;
}

/* ===== Loading / Error ===== */
.brand-overview__loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 64px;
  color: #6b7280;
}

.brand-overview__spinner {
  width: 24px;
  height: 24px;
  border: 3px solid #e5e7eb;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: brandSpin 0.6s linear infinite;
}

@keyframes brandSpin {
  to { transform: rotate(360deg); }
}

.brand-overview__error {
  text-align: center;
  padding: 32px;
  color: #dc2626;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 10px;
  margin-bottom: 24px;
}

/* ===== Top Bar ===== */
.brand-overview__top-bar {
  margin-bottom: 20px;
}

.brand-overview__back-link {
  font-size: 14px;
  color: #3b82f6;
  text-decoration: none;
  padding: 6px 12px;
  border-radius: 6px;
  transition: background-color 0.15s;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.brand-overview__back-link:hover {
  background-color: #eff6ff;
}

/* ===== Section ===== */
.brand-overview__section {
  margin-bottom: 28px;
}

.brand-overview__section-title {
  font-size: 18px;
  font-weight: 600;
  color: #111827;
  margin: 0 0 16px;
}

/* ===== Brand Header ===== */
.brand-overview__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 28px;
}

.brand-overview__header-left {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  flex: 1;
  min-width: 0;
}

.brand-overview__brand-avatar {
  width: 52px;
  height: 52px;
  border-radius: 12px;
  background: linear-gradient(135deg, #3b82f6, #6366f1);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  font-weight: 700;
  flex-shrink: 0;
}

.brand-overview__brand-info {
  flex: 1;
  min-width: 0;
}

.brand-overview__brand-name {
  font-size: 24px;
  font-weight: 700;
  color: #111827;
  margin: 0 0 2px;
  letter-spacing: -0.02em;
}

.brand-overview__brand-slug {
  font-size: 13px;
  color: #9ca3af;
  font-weight: 400;
  display: block;
  margin-bottom: 6px;
}

.brand-overview__brand-url {
  font-size: 13px;
  color: #3b82f6;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  transition: color 0.15s;
}

.brand-overview__brand-url:hover {
  color: #2563eb;
  text-decoration: underline;
}

.brand-overview__status-badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
  flex-shrink: 0;
}

.brand-overview__status-badge--draft {
  background: #f3f4f6;
  color: #6b7280;
}

.brand-overview__status-badge--active {
  background: #dcfce7;
  color: #16a34a;
}

.brand-overview__status-badge--monitoring {
  background: #dbeafe;
  color: #2563eb;
}

.brand-overview__status-badge--completed {
  background: #f0fdf4;
  color: #15803d;
}

/* ===== Completeness Card ===== */
.brand-overview__completeness-card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 24px;
}

.brand-overview__completeness-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.brand-overview__completeness-ring-wrapper {
  flex-shrink: 0;
}

.brand-overview__completeness-ring {
  color: #3b82f6;
}

.brand-overview__completeness-ring-fill {
  transition: stroke-dashoffset 0.6s ease;
}

.brand-overview__ring--high {
  color: #22c55e;
}

.brand-overview__ring--medium {
  color: #f59e0b;
}

.brand-overview__ring--low {
  color: #ef4444;
}

.brand-overview__completeness-percent {
  font-size: 14px;
  font-weight: 700;
  fill: #111827;
}

.brand-overview__completeness-label-text {
  font-size: 8px;
  fill: #9ca3af;
}

.brand-overview__completeness-pending {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 120px;
  height: 120px;
}

.brand-overview__completeness-pending-text {
  font-size: 12px;
  color: #9ca3af;
}

.brand-overview__profile-dimensions {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.brand-overview__profile-dimension {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.brand-overview__dimension-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.brand-overview__dimension-left {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.brand-overview__dimension-label {
  font-size: 14px;
  font-weight: 600;
  color: #111827;
}

.brand-overview__dimension-desc {
  font-size: 12px;
  color: #9ca3af;
}

.brand-overview__dimension-desc--pending {
  font-style: italic;
}

.brand-overview__dimension-desc--steps {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.brand-overview__step {
  font-size: 11px;
  font-weight: 500;
  padding: 1px 6px;
  border-radius: 4px;
  line-height: 1.6;
}

.brand-overview__step--done {
  color: #059669;
  background: #ecfdf5;
}

.brand-overview__step--todo {
  color: #9ca3af;
  background: #f3f4f6;
}

.brand-overview__dimension-score {
  font-size: 16px;
  font-weight: 700;
  flex-shrink: 0;
}

.brand-overview__dimension-score--pending {
  font-size: 14px;
  font-weight: 500;
  color: #9ca3af;
  flex-shrink: 0;
}

.brand-overview__score--high {
  color: #22c55e;
}

.brand-overview__score--medium {
  color: #f59e0b;
}

.brand-overview__score--low {
  color: #ef4444;
}

.brand-overview__dimension-bar {
  height: 8px;
  background: #e5e7eb;
  border-radius: 4px;
  overflow: hidden;
}

.brand-overview__dimension-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.5s ease;
}

.brand-overview__dimension-fill--high {
  background: #22c55e;
}

.brand-overview__dimension-fill--medium {
  background: #f59e0b;
}

.brand-overview__dimension-fill--low {
  background: #ef4444;
}

/* ===== Quick Actions ===== */
.brand-overview__quick-actions {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.brand-overview__action-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 18px 20px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.15s ease-out;
  text-align: left;
  font-family: inherit;
}

.brand-overview__action-card:hover {
  border-color: #bfdbfe;
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.08);
  transform: translateY(-1px);
}

.brand-overview__action-icon {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  flex-shrink: 0;
}

.brand-overview__action-icon--brand {
  background: #eff6ff;
  color: #3b82f6;
}

.brand-overview__action-icon--geo {
  background: #f0fdf4;
  color: #22c55e;
}

.brand-overview__action-icon--knowledge {
  background: #fffbeb;
  color: #f59e0b;
}

.brand-overview__action-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.brand-overview__action-text strong {
  font-size: 14px;
  font-weight: 600;
  color: #111827;
}

.brand-overview__action-text small {
  font-size: 12px;
  color: #6b7280;
}

/* ===== Info Card ===== */
.brand-overview__info-card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 20px 24px;
}

.brand-overview__info-row {
  display: flex;
  padding: 12px 0;
  border-bottom: 1px solid #f3f4f6;
}

.brand-overview__info-row:last-child {
  border-bottom: none;
}

.brand-overview__info-label {
  width: 100px;
  flex-shrink: 0;
  font-size: 13px;
  font-weight: 500;
  color: #6b7280;
}

.brand-overview__info-value {
  flex: 1;
  font-size: 14px;
  color: #111827;
  word-break: break-all;
}

.brand-overview__info-link {
  color: #3b82f6;
  text-decoration: none;
}

.brand-overview__info-link:hover {
  text-decoration: underline;
}

.brand-overview__info-empty {
  color: #9ca3af;
  font-style: italic;
}

/* ===== Common Button ===== */
.brand-overview__btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  background: #fff;
  cursor: pointer;
  transition: all 0.15s;
  font-size: 14px;
  font-weight: 500;
  font-family: inherit;
}

.brand-overview__btn:hover:not(:disabled) {
  border-color: #3b82f6;
  box-shadow: 0 1px 4px rgba(59, 130, 246, 0.1);
}

.brand-overview__btn--primary {
  background: #3b82f6;
  color: #fff;
  border-color: #3b82f6;
}

.brand-overview__btn--primary:hover:not(:disabled) {
  background: #2563eb;
}

.brand-overview__btn--danger {
  color: #dc2626;
  border-color: #fecaca;
  background: #fff;
}

.brand-overview__btn--danger:hover {
  background: #fef2f2;
  border-color: #fca5a5;
}

.brand-overview__top-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

/* ===== Explain Section (P0-T003) ===== */

.brand-overview__explain-trigger {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 500;
  color: #3b82f6;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  border-radius: 6px;
  padding: 4px 10px;
  cursor: pointer;
  transition: all 0.15s;
  font-family: inherit;
}

.brand-overview__explain-trigger:hover {
  background: #dbeafe;
}

/* Loading */
.brand-overview__explain-loading {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 24px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
}

.brand-overview__explain-loading-step {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  color: #9ca3af;
}

.brand-overview__explain-loading-icon {
  width: 24px;
  text-align: center;
  transition: opacity 0.3s;
}

.brand-overview__explain-step--pending {
  opacity: 0.4;
}

.brand-overview__explain-step--active {
  opacity: 1;
  font-weight: 600;
  color: #3b82f6;
}

.brand-overview__explain-step--done {
  opacity: 0.7;
  color: #059669;
}

/* Error */
.brand-overview__explain-error {
  text-align: center;
  padding: 24px;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 10px;
  color: #dc2626;
}

.brand-overview__explain-error p {
  margin: 0 0 12px;
}

/* Empty */
.brand-overview__explain-empty {
  text-align: center;
  padding: 32px;
  background: #f9fafb;
  border: 1px dashed #d1d5db;
  border-radius: 10px;
  color: #6b7280;
}

.brand-overview__explain-empty p {
  margin: 0 0 16px;
  font-size: 14px;
}

/* Card */
.brand-overview__explain-card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 20px;
}

.brand-overview__explain-confidence {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}

.brand-overview__explain-confidence-badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
}

.brand-overview__confidence--high {
  background: #f0fdf4;
  color: #059669;
}

.brand-overview__confidence--medium {
  background: #fffbeb;
  color: #d97706;
}

.brand-overview__confidence--low {
  background: #fef2f2;
  color: #dc2626;
}

.brand-overview__explain-adi-badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  background: #eff6ff;
  color: #3b82f6;
}

.brand-overview__explain-summary {
  font-size: 14px;
  color: #374151;
  line-height: 1.6;
  margin: 0 0 20px;
  padding: 12px;
  background: #f9fafb;
  border-radius: 8px;
}

/* Section within explain */
.brand-overview__explain-section {
  margin-bottom: 20px;
}

.brand-overview__explain-section:last-child {
  margin-bottom: 0;
}

.brand-overview__explain-section-title {
  font-size: 13px;
  font-weight: 600;
  color: #111827;
  margin: 0 0 10px;
  padding-bottom: 6px;
  border-bottom: 1px solid #f3f4f6;
}

/* Evidence */
.brand-overview__explain-evidence {
  margin-bottom: 6px;
  border: 1px solid #f3f4f6;
  border-radius: 8px;
  overflow: hidden;
}

.brand-overview__explain-evidence-header {
  display: flex;
  align-items: center;
  padding: 10px 12px;
  cursor: pointer;
  transition: background-color 0.15s;
  gap: 12px;
}

.brand-overview__explain-evidence-header:hover {
  background: #f9fafb;
}

.brand-overview__explain-evidence-source {
  flex: 1;
  font-size: 13px;
  font-weight: 500;
  color: #374151;
}

.brand-overview__explain-evidence-confidence {
  font-size: 11px;
  font-weight: 600;
  color: #6b7280;
  background: #f3f4f6;
  padding: 2px 8px;
  border-radius: 10px;
}

.brand-overview__explain-evidence-toggle {
  font-size: 16px;
  color: #9ca3af;
  font-weight: 600;
  width: 16px;
  text-align: center;
}

.brand-overview__explain-evidence-body {
  padding: 0 12px 10px;
  border-top: 1px solid #f3f4f6;
}

.brand-overview__explain-evidence-body p {
  margin: 8px 0;
  font-size: 13px;
  color: #6b7280;
  line-height: 1.5;
}

.brand-overview__explain-evidence-body small {
  font-size: 11px;
  color: #9ca3af;
}

.brand-overview__explain-evidence-empty {
  font-size: 13px;
  color: #9ca3af;
  padding: 8px 0;
}

/* Reasons */
.brand-overview__explain-reasons {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.brand-overview__explain-reason {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 13px;
  color: #374151;
  padding: 8px 12px;
  background: #f9fafb;
  border-radius: 6px;
}

.brand-overview__explain-reason code {
  font-size: 11px;
  font-weight: 600;
  color: #3b82f6;
  background: #eff6ff;
  padding: 1px 6px;
  border-radius: 4px;
  white-space: nowrap;
  font-family: 'SF Mono', 'Fira Code', monospace;
}

.brand-overview__explain-reason--empty {
  color: #9ca3af;
  background: transparent;
}

/* Limitations */
.brand-overview__explain-limitations {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.brand-overview__explain-limitations li {
  font-size: 12px;
  color: #9ca3af;
  padding: 4px 8px;
  background: #f9fafb;
  border-radius: 4px;
}

/* Recommendations */
.brand-overview__explain-recommendation {
  padding: 12px;
  border: 1px solid #f3f4f6;
  border-radius: 8px;
  margin-bottom: 8px;
  border-left: 3px solid #d1d5db;
}

.brand-overview__explain-recommendation--high {
  border-left-color: #ef4444;
}

.brand-overview__explain-recommendation--medium {
  border-left-color: #f59e0b;
}

.brand-overview__explain-recommendation--low {
  border-left-color: #3b82f6;
}

.brand-overview__explain-rec-header {
  display: flex;
  gap: 6px;
  margin-bottom: 6px;
}

.brand-overview__explain-rec-priority {
  font-size: 10px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 10px;
  text-transform: uppercase;
}

.brand-overview__explain-recommendation--high .brand-overview__explain-rec-priority {
  background: #fef2f2;
  color: #dc2626;
}

.brand-overview__explain-recommendation--medium .brand-overview__explain-rec-priority {
  background: #fffbeb;
  color: #d97706;
}

.brand-overview__explain-recommendation--low .brand-overview__explain-rec-priority {
  background: #eff6ff;
  color: #3b82f6;
}

.brand-overview__explain-rec-difficulty {
  font-size: 10px;
  color: #9ca3af;
  padding: 2px 6px;
  background: #f3f4f6;
  border-radius: 6px;
}

.brand-overview__explain-rec-action {
  font-size: 14px;
  font-weight: 500;
  color: #111827;
  margin: 0 0 6px;
}

.brand-overview__explain-rec-impact {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: #6b7280;
}

.brand-overview__explain-rec-empty {
  font-size: 13px;
  color: #9ca3af;
  padding: 8px 0;
}

/* ===== Optimization Center (P0-T004) ===== */

.brand-overview__optimization-trigger {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 500;
  color: #059669;
  background: #ecfdf5;
  border: 1px solid #a7f3d0;
  border-radius: 6px;
  padding: 4px 10px;
  cursor: pointer;
  transition: all 0.15s;
  font-family: inherit;
}

.brand-overview__optimization-trigger:hover {
  background: #d1fae5;
}

/* Loading (三步骤) */
.brand-overview__optimization-loading {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 24px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
}

.brand-overview__optimization-loading-step {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  color: #9ca3af;
}

.brand-overview__optimization-loading-icon {
  width: 24px;
  text-align: center;
  transition: opacity 0.3s;
}

.brand-overview__opt-step--pending {
  opacity: 0.4;
}

.brand-overview__opt-step--active {
  opacity: 1;
  font-weight: 600;
  color: #059669;
}

.brand-overview__opt-step--done {
  opacity: 0.7;
  color: #059669;
}

/* Error */
.brand-overview__optimization-error {
  text-align: center;
  padding: 24px;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 10px;
  color: #dc2626;
}

.brand-overview__optimization-error p {
  margin: 0 0 12px;
}

/* Empty */
.brand-overview__optimization-empty {
  text-align: center;
  padding: 32px;
  background: #f9fafb;
  border: 1px dashed #d1d5db;
  border-radius: 10px;
  color: #6b7280;
}

.brand-overview__optimization-empty p {
  margin: 0 0 16px;
  font-size: 14px;
}

/* Card */
.brand-overview__optimization-card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 20px;
}

/* Summary 三列布局 */
.brand-overview__opt-summary {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-bottom: 24px;
  padding: 16px;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-radius: 10px;
}

.brand-overview__opt-summary-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.brand-overview__opt-summary-label {
  font-size: 12px;
  font-weight: 500;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.brand-overview__opt-summary-value {
  font-size: 28px;
  font-weight: 700;
  color: #111827;
}

.brand-overview__opt-summary-value--estimated {
  color: #059669;
}

.brand-overview__opt-summary-value--gain {
  color: #16a34a;
}

.brand-overview__opt-summary-value--unknown {
  color: #9ca3af;
  font-size: 18px;
}

/* Recommendations Section */
.brand-overview__opt-recommendations {
  margin-top: 8px;
}

.brand-overview__opt-recommendations-title {
  font-size: 14px;
  font-weight: 600;
  color: #111827;
  margin: 0 0 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid #f3f4f6;
}

/* Recommendation Card */
.brand-overview__opt-rec-card {
  display: flex;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  margin-bottom: 12px;
  overflow: hidden;
  background: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  transition: box-shadow 0.15s;
}

.brand-overview__opt-rec-card:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

/* Priority 色条 (左侧彩色条，类似 Explain recommendation) */
.brand-overview__opt-rec-left-bar {
  width: 4px;
  flex-shrink: 0;
}

.brand-overview__opt-rec-left-bar--high {
  background: #ef4444;
}

.brand-overview__opt-rec-left-bar--medium {
  background: #f59e0b;
}

.brand-overview__opt-rec-left-bar--low {
  background: #3b82f6;
}

.brand-overview__opt-rec-content {
  flex: 1;
  padding: 14px 16px;
}

.brand-overview__opt-rec-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}

.brand-overview__opt-rec-priority {
  font-size: 10px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 10px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.brand-overview__opt-rec-priority--high {
  background: #fef2f2;
  color: #dc2626;
}

.brand-overview__opt-rec-priority--medium {
  background: #fffbeb;
  color: #d97706;
}

.brand-overview__opt-rec-priority--low {
  background: #eff6ff;
  color: #3b82f6;
}

.brand-overview__opt-rec-difficulty {
  font-size: 10px;
  font-weight: 500;
  padding: 2px 8px;
  border-radius: 6px;
}

.brand-overview__opt-rec-difficulty--easy {
  background: #f0fdf4;
  color: #059669;
}

.brand-overview__opt-rec-difficulty--medium {
  background: #fffbeb;
  color: #d97706;
}

.brand-overview__opt-rec-difficulty--hard {
  background: #fef2f2;
  color: #dc2626;
}

.brand-overview__opt-rec-impact {
  font-size: 11px;
  font-weight: 500;
  color: #6b7280;
  background: #f3f4f6;
  padding: 2px 8px;
  border-radius: 6px;
}

.brand-overview__opt-rec-action {
  font-size: 14px;
  font-weight: 600;
  color: #111827;
  margin: 0 0 4px;
}

.brand-overview__opt-rec-reason {
  font-size: 12px;
  color: #6b7280;
  margin: 0 0 10px;
  line-height: 1.5;
}

.brand-overview__opt-rec-start-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  color: #fff;
  background: #059669;
  border: none;
  border-radius: 6px;
  padding: 6px 14px;
  cursor: pointer;
  transition: background-color 0.15s;
  font-family: inherit;
}

.brand-overview__opt-rec-start-btn:hover {
  background: #047857;
}

/* ===== AI Presence Section (P0-T005) ===== */

.brand-overview__presence-trigger {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 500;
  color: #7c3aed;
  background: #f5f3ff;
  border: 1px solid #ddd6fe;
  border-radius: 6px;
  padding: 4px 10px;
  cursor: pointer;
  transition: all 0.15s;
  font-family: inherit;
}

.brand-overview__presence-trigger:hover {
  background: #ede9fe;
}

/* Loading */
.brand-overview__presence-loading {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 24px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
}

.brand-overview__presence-loading-step {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  color: #9ca3af;
}

.brand-overview__presence-loading-icon {
  width: 24px;
  text-align: center;
  transition: opacity 0.3s;
}

.brand-overview__presence-step--pending {
  opacity: 0.4;
}

.brand-overview__presence-step--active {
  opacity: 1;
  font-weight: 600;
  color: #7c3aed;
}

.brand-overview__presence-step--done {
  opacity: 0.7;
  color: #059669;
}

/* Error */
.brand-overview__presence-error {
  text-align: center;
  padding: 24px;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 10px;
  color: #dc2626;
}

.brand-overview__presence-error p {
  margin: 0 0 12px;
}

/* Empty */
.brand-overview__presence-empty {
  text-align: center;
  padding: 32px;
  background: #f9fafb;
  border: 1px dashed #d1d5db;
  border-radius: 10px;
  color: #6b7280;
}

.brand-overview__presence-empty p {
  margin: 0 0 16px;
  font-size: 14px;
}

/* Main Card */
.brand-overview__presence-card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 20px;
}

/* Overall KPI */
.brand-overview__presence-overall {
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 16px;
  background: linear-gradient(135deg, #f5f3ff, #ede9fe);
  border: 1px solid #ddd6fe;
  border-radius: 10px;
  margin-bottom: 20px;
}

.brand-overview__presence-overall-score {
  flex-shrink: 0;
}

.brand-overview__presence-score-text {
  font-size: 18px;
  font-weight: 700;
  fill: #111827;
}

.brand-overview__presence-score-label {
  font-size: 9px;
  fill: #6b7280;
}

.brand-overview__presence-ring--high {
  color: #059669;
}

.brand-overview__presence-ring--medium {
  color: #f59e0b;
}

.brand-overview__presence-ring--low {
  color: #ef4444;
}

.brand-overview__presence-overall-metrics {
  display: flex;
  gap: 24px;
  flex-wrap: wrap;
}

.brand-overview__presence-metric {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.brand-overview__presence-metric-value {
  font-size: 20px;
  font-weight: 700;
  color: #111827;
}

.brand-overview__presence-metric-label {
  font-size: 11px;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

/* Provider List */
.brand-overview__presence-providers {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* Presence Groups (international / china) */
.brand-overview__presence-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.brand-overview__presence-group-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  margin-bottom: 4px;
}

.brand-overview__presence-group-icon {
  font-size: 18px;
  line-height: 1;
}

.brand-overview__presence-group-label {
  font-size: 14px;
  font-weight: 600;
  color: #374151;
  letter-spacing: 0.02em;
}

.brand-overview__presence-provider-card {
  border: 1px solid #f3f4f6;
  border-radius: 10px;
  overflow: hidden;
  transition: box-shadow 0.15s;
}

.brand-overview__presence-provider-card:hover {
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
}

.brand-overview__presence-provider-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  cursor: pointer;
  transition: background-color 0.15s;
}

.brand-overview__presence-provider-header:hover {
  background: #f9fafb;
}

/* Provider Logo */
.brand-overview__presence-provider-logo {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  font-weight: 700;
  color: #fff;
  flex-shrink: 0;
}

.brand-overview__provider-logo--chatgpt {
  background: linear-gradient(135deg, #10a37f, #0d8c6e);
}

.brand-overview__provider-logo--gemini {
  background: linear-gradient(135deg, #4285f4, #34a853);
}

.brand-overview__provider-logo--claude {
  background: linear-gradient(135deg, #d97706, #b45309);
}

.brand-overview__provider-logo--deepseek {
  background: linear-gradient(135deg, #4f46e5, #3730a3);
}

.brand-overview__provider-logo--perplexity {
  background: linear-gradient(135deg, #1e3a5f, #0d2137);
}

.brand-overview__provider-logo--copilot {
  background: linear-gradient(135deg, #0078d4, #106ebe);
}

.brand-overview__provider-logo--doubao {
  background: linear-gradient(135deg, #ff6b35, #e55a2b);
}

.brand-overview__provider-logo--tongyi {
  background: linear-gradient(135deg, #ff6a00, #ee8200);
}

.brand-overview__provider-logo--wenxin {
  background: linear-gradient(135deg, #1a7bec, #0d5fcc);
}

.brand-overview__provider-logo--yuanbao {
  background: linear-gradient(135deg, #07c160, #06ad56);
}

.brand-overview__provider-logo--kimi {
  background: linear-gradient(135deg, #8b5cf6, #7c3aed);
}

.brand-overview__provider-logo--xinghuo {
  background: linear-gradient(135deg, #2563eb, #1d4ed8);
}

/* Provider Info */
.brand-overview__presence-provider-info {
  flex: 1;
  min-width: 0;
}

.brand-overview__presence-provider-top {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
  flex-wrap: wrap;
}

.brand-overview__presence-provider-name {
  font-size: 14px;
  font-weight: 600;
  color: #111827;
}

/* Visibility Badge */
.brand-overview__presence-visibility-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 10px;
}

.brand-overview__visibility--visible {
  background: #f0fdf4;
  color: #059669;
}

.brand-overview__visibility--visible::before {
  content: '✅';
  font-size: 10px;
}

.brand-overview__visibility--partial {
  background: #fffbeb;
  color: #d97706;
}

.brand-overview__visibility--partial::before {
  content: '🟡';
  font-size: 10px;
}

.brand-overview__visibility--missing {
  background: #fef2f2;
  color: #dc2626;
}

.brand-overview__visibility--missing::before {
  content: '❌';
  font-size: 10px;
}

.brand-overview__visibility--checking {
  background: #eff6ff;
  color: #3b82f6;
}

.brand-overview__visibility--checking::before {
  content: '⏳';
  font-size: 10px;
}

.brand-overview__visibility--unknown {
  background: #f3f4f6;
  color: #6b7280;
}

.brand-overview__visibility--unknown::before {
  content: '❓';
  font-size: 10px;
}

/* Provider details row */
.brand-overview__presence-provider-details {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

/* Knowledge Quality Bar */
.brand-overview__presence-knowledge-bar {
  width: 60px;
  height: 6px;
  background: #e5e7eb;
  border-radius: 3px;
  overflow: hidden;
}

.brand-overview__presence-knowledge-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.5s ease;
}

.brand-overview__presence-bar--high {
  background: #059669;
}

.brand-overview__presence-bar--medium {
  background: #f59e0b;
}

.brand-overview__presence-bar--low {
  background: #ef4444;
}

.brand-overview__presence-knowledge-text {
  font-size: 11px;
  color: #6b7280;
  font-weight: 500;
}

/* Evidence Level Badge */
.brand-overview__presence-evidence-badge {
  font-size: 10px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 6px;
}

.brand-overview__evidence--A {
  background: #f0fdf4;
  color: #059669;
}

.brand-overview__evidence--B {
  background: #eff6ff;
  color: #3b82f6;
}

.brand-overview__evidence--C {
  background: #fffbeb;
  color: #d97706;
}

.brand-overview__evidence--D {
  background: #fef2f2;
  color: #dc2626;
}

.brand-overview__evidence--N\/A {
  background: #f3f4f6;
  color: #9ca3af;
}

/* Expand toggle */
.brand-overview__presence-expand-toggle {
  font-size: 18px;
  color: #9ca3af;
  font-weight: 600;
  width: 16px;
  text-align: center;
  flex-shrink: 0;
}

/* Explain Body (expandable) */
.brand-overview__presence-explain-body {
  padding: 0 16px 16px;
  border-top: 1px solid #f3f4f6;
}

.brand-overview__presence-explain-body h4 {
  font-size: 12px;
  font-weight: 600;
  color: #111827;
  margin: 10px 0 4px;
}

.brand-overview__presence-explain-body p {
  font-size: 13px;
  color: #6b7280;
  line-height: 1.5;
  margin: 0 0 8px;
}

.brand-overview__presence-explain-body ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.brand-overview__presence-explain-body li {
  font-size: 13px;
  color: #6b7280;
  padding: 4px 0 4px 16px;
  position: relative;
  line-height: 1.4;
}

.brand-overview__presence-explain-body li::before {
  content: '•';
  position: absolute;
  left: 4px;
  color: #3b82f6;
}

.brand-overview__presence-rec-empty {
  color: #9ca3af;
}

/* ===== Responsive ===== */
@media (max-width: 768px) {
  .brand-overview__header {
    flex-direction: column;
    gap: 12px;
  }

  .brand-overview__quick-actions {
    grid-template-columns: 1fr;
  }

  .brand-overview__completeness-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .brand-overview__presence-overall {
    flex-direction: column;
    gap: 16px;
  }

  .brand-overview__presence-overall-metrics {
    gap: 16px;
  }

  .brand-overview__presence-overall-metrics {
    gap: 16px;
  }
}

/* ===== Verification Section (P0-T006) ===== */
.brand-overview__verification-trigger {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 500;
  color: #059669;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-radius: 6px;
  padding: 4px 10px;
  cursor: pointer;
  transition: all 0.15s;
  margin-left: 8px;
}

.brand-overview__verification-trigger:hover {
  background: #dcfce7;
}

.brand-overview__verification-loading {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px;
  background: #f9fafb;
  border: 1px dashed #e5e7eb;
  border-radius: 10px;
}

.brand-overview__verification-loading-step {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  color: #6b7280;
}

.brand-overview__verification-loading-icon {
  width: 20px;
  text-align: center;
}

.brand-overview__veri-step--done {
  color: #059669;
}

.brand-overview__veri-step--active {
  color: #3b82f6;
  font-weight: 600;
}

.brand-overview__veri-step--pending {
  color: #d1d5db;
}

.brand-overview__verification-error {
  text-align: center;
  padding: 16px;
  color: #dc2626;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 10px;
}

.brand-overview__verification-empty {
  text-align: center;
  padding: 24px;
  color: #6b7280;
  background: #f9fafb;
  border: 1px dashed #e5e7eb;
  border-radius: 10px;
}

.brand-overview__verification-card {
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 20px;
  background: #fff;
}

.brand-overview__veri-status-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid #f3f4f6;
}

.brand-overview__veri-status-badge {
  font-size: 13px;
  font-weight: 700;
  padding: 4px 12px;
  border-radius: 999px;
}

.brand-overview__veri-status--pass {
  background: #f0fdf4;
  color: #059669;
  border: 1px solid #bbf7d0;
}

.brand-overview__veri-status--partial {
  background: #fffbeb;
  color: #d97706;
  border: 1px solid #fde68a;
}

.brand-overview__veri-status--fail {
  background: #fef2f2;
  color: #dc2626;
  border: 1px solid #fecaca;
}

.brand-overview__veri-status--inconclusive {
  background: #f3f4f6;
  color: #6b7280;
  border: 1px solid #e5e7eb;
}

.brand-overview__veri-confidence {
  font-size: 12px;
  color: #6b7280;
  font-weight: 500;
}

.brand-overview__veri-evidence-grade {
  font-size: 12px;
  font-weight: 600;
  color: #3b82f6;
  background: #eff6ff;
  padding: 2px 8px;
  border-radius: 6px;
}

.brand-overview__veri-subtitle {
  font-size: 15px;
  font-weight: 600;
  color: #111827;
  margin: 0 0 12px;
}

.brand-overview__veri-comparison {
  margin-bottom: 20px;
}

.brand-overview__veri-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.brand-overview__veri-table th {
  text-align: left;
  font-size: 12px;
  font-weight: 600;
  color: #6b7280;
  text-transform: uppercase;
  padding: 8px 12px;
  border-bottom: 2px solid #e5e7eb;
  background: #f9fafb;
}

.brand-overview__veri-table td {
  padding: 10px 12px;
  border-bottom: 1px solid #f3f4f6;
  color: #374151;
}

.brand-overview__veri-table td:first-child {
  font-weight: 500;
}

.delta--positive {
  color: #059669;
  font-weight: 600;
}

.delta--negative {
  color: #dc2626;
  font-weight: 600;
}

/* ===== Claims ===== */
.brand-overview__veri-claims {
  margin-bottom: 20px;
}

.brand-overview__veri-claim-card {
  display: flex;
  gap: 10px;
  padding: 10px 14px;
  margin-bottom: 8px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fafafa;
  transition: background 0.15s;
}

.brand-overview__veri-claim--improvement {
  border-left: 3px solid #059669;
}

.brand-overview__veri-claim--regression {
  border-left: 3px solid #dc2626;
}

.brand-overview__veri-claim--unchanged {
  border-left: 3px solid #9ca3af;
}

.brand-overview__veri-claim-icon {
  font-size: 16px;
  flex-shrink: 0;
  padding-top: 2px;
}

.brand-overview__veri-claim-body {
  flex: 1;
}

.brand-overview__veri-claim-summary {
  font-size: 14px;
  font-weight: 600;
  color: #111827;
  margin-bottom: 4px;
}

.brand-overview__veri-claim-meta {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: #6b7280;
}

.brand-overview__veri-claim-confidence {
  font-weight: 500;
}

.brand-overview__veri-claim-evidence-count {
  color: #3b82f6;
}

/* ===== Evidence Timeline ===== */
.brand-overview__veri-evidence {
  margin-bottom: 20px;
}

.brand-overview__veri-timeline {
  position: relative;
  padding-left: 24px;
}

.brand-overview__veri-timeline::before {
  content: '';
  position: absolute;
  left: 8px;
  top: 0;
  bottom: 0;
  width: 2px;
  background: #e5e7eb;
}

.brand-overview__veri-timeline-item {
  position: relative;
  margin-bottom: 8px;
}

.brand-overview__veri-timeline-dot {
  position: absolute;
  left: -18px;
  top: 14px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #d1d5db;
  border: 2px solid #fff;
}

.brand-overview__veri-timeline-dot--snapshot {
  background: #3b82f6;
}

.brand-overview__veri-timeline-dot--optimization {
  background: #059669;
}

.brand-overview__veri-timeline-dot--ai_presence {
  background: #8b5cf6;
}

.brand-overview__veri-timeline-dot--claim_result {
  background: #d97706;
}

.brand-overview__veri-timeline-content {
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  overflow: hidden;
}

.brand-overview__veri-timeline-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  cursor: pointer;
  transition: background 0.15s;
}

.brand-overview__veri-timeline-header:hover {
  background: #f3f4f6;
}

.brand-overview__veri-timeline-type {
  font-size: 12px;
  font-weight: 600;
  color: #374151;
  text-transform: capitalize;
}

.brand-overview__veri-timeline-source {
  font-size: 11px;
  color: #6b7280;
  flex: 1;
}

.brand-overview__veri-timeline-toggle {
  font-size: 16px;
  color: #9ca3af;
  font-weight: 600;
}

.brand-overview__veri-timeline-body {
  padding: 8px 12px 12px;
  border-top: 1px solid #e5e7eb;
}

.brand-overview__veri-timeline-body p {
  font-size: 13px;
  color: #374151;
  margin: 0 0 4px;
  line-height: 1.4;
}

.brand-overview__veri-timeline-body small {
  font-size: 11px;
  color: #9ca3af;
}

/* ===== Explain ===== */
.brand-overview__veri-explain {
  margin-bottom: 20px;
  padding: 14px;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-radius: 8px;
}

.brand-overview__veri-explain-summary {
  font-size: 14px;
  color: #065f46;
  line-height: 1.5;
  margin: 0 0 12px;
}

.brand-overview__veri-explain h5 {
  font-size: 12px;
  font-weight: 600;
  color: #065f46;
  margin: 0 0 6px;
}

.brand-overview__veri-explain-reasons ul,
.brand-overview__veri-explain-limitations ul {
  list-style: none;
  padding: 0;
  margin: 0 0 10px;
}

.brand-overview__veri-explain-reasons li,
.brand-overview__veri-explain-limitations li {
  font-size: 13px;
  color: #374151;
  padding: 4px 0 4px 16px;
  position: relative;
  line-height: 1.4;
}

.brand-overview__veri-explain-reasons li::before,
.brand-overview__veri-explain-limitations li::before {
  content: '•';
  position: absolute;
  left: 4px;
  color: #059669;
}

.brand-overview__veri-explain-reasons code {
  font-size: 11px;
  background: #d1fae5;
  padding: 1px 6px;
  border-radius: 4px;
  color: #065f46;
}

/* ===== Recommendations ===== */
.brand-overview__veri-recommendations {
  margin-bottom: 20px;
}

.brand-overview__veri-rec-card {
  padding: 12px 14px;
  margin-bottom: 8px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fafafa;
}

.brand-overview__veri-rec--high {
  border-left: 3px solid #dc2626;
}

.brand-overview__veri-rec--medium {
  border-left: 3px solid #d97706;
}

.brand-overview__veri-rec--low {
  border-left: 3px solid #059669;
}

.brand-overview__veri-rec-header {
  margin-bottom: 6px;
}

.brand-overview__veri-rec-priority {
  font-size: 12px;
  font-weight: 600;
}

.brand-overview__veri-rec-priority--high {
  color: #dc2626;
}

.brand-overview__veri-rec-priority--medium {
  color: #d97706;
}

.brand-overview__veri-rec-priority--low {
  color: #059669;
}

.brand-overview__veri-rec-action {
  font-size: 14px;
  font-weight: 500;
  color: #111827;
  margin: 0 0 4px;
}

.brand-overview__veri-rec-impact {
  font-size: 12px;
  color: #6b7280;
  font-weight: 400;
}

.brand-overview__veri-rec-reason {
  font-size: 12px;
  color: #6b7280;
  margin: 0;
  line-height: 1.4;
}

/* ===== History ===== */
.brand-overview__veri-history {
  border-top: 1px solid #e5e7eb;
  padding-top: 16px;
}

.brand-overview__veri-history-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.brand-overview__veri-history-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s;
}

.brand-overview__veri-history-item:hover {
  background: #f3f4f6;
}

.brand-overview__veri-history-status {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 6px;
}

.brand-overview__veri-history-adi {
  font-size: 14px;
  font-weight: 700;
}

.brand-overview__veri-history-confidence {
  font-size: 12px;
  color: #6b7280;
}

.brand-overview__veri-history-date {
  font-size: 12px;
  color: #9ca3af;
  margin-left: auto;
}
</style>
