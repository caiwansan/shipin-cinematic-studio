<template>
  <section class="brand-overview__section">
    <div class="brand-overview__completeness-card">
      <div class="brand-overview__completeness-header">
        <h2 class="brand-overview__section-title">品牌完整度</h2>
        <CapabilityBadge :meta="_meta?.completenessPercent" />
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
              <span class="brand-overview__dimension-label">身份 Identity</span>
              <CapabilityBadge :meta="_meta?.identityScore" />
              <span class="brand-overview__dimension-desc">名称 / 网站 / 行业</span>
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
              <span class="brand-overview__dimension-label">知识 Knowledge</span>
              <CapabilityBadge :meta="_meta?.knowledgeScore" />
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
              <span class="brand-overview__dimension-label">优化 Optimization</span>
              <CapabilityBadge :meta="_meta?.optimizationScore" />
              <span class="brand-overview__dimension-desc brand-overview__dimension-desc--steps" v-if="hasAnalysis">
                <span class="brand-overview__step brand-overview__step--done">✓ 已评估</span>
                <span class="brand-overview__step" :class="verificationCount > 0 ? 'brand-overview__step--done' : 'brand-overview__step--todo'">
                  {{ verificationCount > 0 ? '✓' : '○' }} 验真
                </span>
                <span class="brand-overview__step" :class="publishCount > 0 ? 'brand-overview__step--done' : 'brand-overview__step--todo'">
                  {{ publishCount > 0 ? '✓' : '○' }} 发布
                </span>
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
</template>

<script setup lang="ts">
import CapabilityBadge from '../business/CapabilityBadge.vue'
import type { CapabilityMetaMap } from '~/workspaces/geo/types/foundation/capability'

defineProps<{
  hasAnalysis: boolean
  identityScore: number
  knowledgeScore: number
  optimizationScore: number
  completenessPercent: number
  entityCount: number
  knowledgeSourceCount: number
  verificationCount: number
  publishCount: number
  completenessRingColor: (score: number) => string
  dimensionScoreColor: (score: number) => string
  dimensionBarColor: (score: number) => string
  _meta?: CapabilityMetaMap
}>()
</script>
