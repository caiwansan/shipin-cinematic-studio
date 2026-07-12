// ============================================================
// GEO Showcase Service — AI Visibility Showcase Data Aggregation
// RC1-T005: Mission Dashboard — AI Visibility Showcase
// P0-A Truth Dashboard: providers now sourced from PresenceEngine adapter registry
// ============================================================

import { presenceEngine, providerAdapterRegistry } from '../presence/index.js';
import { geoBrandRepository } from '../repositories/geo-brand.repository'
import { geoProjectRepository } from '../repositories/geo-project.repository'
import { geoClaimRepository } from '../repositories/geo-claim.repository'
import { geoScoreSnapshotRepository } from '../repositories/geo-score-snapshot.repository'
import { knowledgePackageRepository } from '../repositories/knowledge-package.repository'
import { verificationResultRepository } from '../repositories/verification-result.repository'

// ── Types ──

export interface ShowcaseProvider {
  name: string;
  displayName: string;
  status: 'supported' | 'in-progress' | 'coming-soon';
  group: 'international' | 'china';
}

export interface ShowcaseStory {
  industry: string;
  duration: string;
  adiImprovement: number;
  visibilityImprovement: number;
  recommendationIncrease: number;
  knowledgeCoverageIncrease: number;
}

export interface ShowcaseTrending {
  topic: string;
  mentions: number;
  trend: 'up' | 'stable' | 'down';
}

export interface ShowcaseInsight {
  title: string;
  description: string;
  link: string;
}

export interface ShowcaseResponse {
  overview: {
    brandsMonitored: number;
    activeProjects: number;
    verifiedCitations: number;
    recommendationAppearances: number;
    knowledgeAssetsManaged: number;
    verificationReportsCompleted: number;
  };
  providers: ShowcaseProvider[];
  stories: ShowcaseStory[];
  trending: ShowcaseTrending[];
  insights: ShowcaseInsight[];
}

// ── Insights (static marketing copy — acceptable to hardcode) ──

const INSIGHTS: ShowcaseInsight[] = [
  {
    title: '持续优化',
    description: '逐步完善品牌知识资产，跨 AI 生态持续监测，确保持续增长的可见度。',
    link: '/workspace/geo/discovery',
  },
  {
    title: '验证驱动工作流',
    description: '每项优化都可量化验证，确保每次改动都能带来真实的 AI 可见度提升。',
    link: '/workspace/geo/verification',
  },
  {
    title: '知识优先架构',
    description: '结构化知识图谱驱动持久化、跨平台的 AI 可见度 — 品牌数据不被任何单一大模型绑定。',
    link: '/workspace/geo/knowledge',
  },
  {
    title: '跨 AI 可见度监测',
    description: '实时追踪多款主流 AI 生态，随时随地掌握品牌表现。',
    link: '/workspace/geo/publishing',
  },
];

// ── Safe Counter Helpers ──

async function safeCount<T>(fn: () => Promise<T>): Promise<number> {
  try {
    const result = await fn();
    return Number(result) || 0;
  } catch {
    return 0;
  }
}

// ── Build providers from real PresenceEngine registry ──

function buildProvidersFromPresenceRegistry(): ShowcaseProvider[] {
  // Get ALL registered adapters (including non-presence-capable ones like copilot)
  const allAdapters = providerAdapterRegistry.getAll();
  const grouped = providerAdapterRegistry.getGroupedProviders();

  const internationalNames = new Set(grouped.international.map(a => a.provider));
  const chinaNames = new Set(grouped.china.map(a => a.provider));

  // Deduplicate by displayName: keep the first occurrence (qwen/tongyi both show as 通义千问)
  const seenDisplayNames = new Set<string>();

  return allAdapters
    .filter(adapter => {
      // Skip truly unsupported adapters (non-presence, but keep copilot as coming-soon)
      const name = adapter.displayName || adapter.provider;
      if (seenDisplayNames.has(name)) return false;
      seenDisplayNames.add(name);
      return true;
    })
    .map(adapter => ({
      name: adapter.provider,
      displayName: adapter.displayName || adapter.provider,
      status: (adapter.supportsPresence ? 'supported' : 'coming-soon') as ShowcaseProvider['status'],
      group: internationalNames.has(adapter.provider) ? 'international' as const : 'china' as const,
    }));
}

// ── Service ──

export async function getShowcaseData(): Promise<ShowcaseResponse> {
  const [
    brandsMonitored,
    activeProjects,
    verifiedCitations,
    recommendationAppearances,
    knowledgeAssetsManaged,
    verificationReportsCompleted,
  ] = await Promise.all([
    safeCount(() => geoBrandRepository.count()),
    safeCount(() => geoProjectRepository.count({ status: { not: 'archived' } })),
    safeCount(() => geoClaimRepository.count({ where: { status: 'approved' } })),
    // recommendationCount is stored in the JSON `scores` field of GEOScoreSnapshot
    // We aggregate as sum of a numeric recommendation_score from each snapshot
    safeCount(async () => {
      const snapshots = await geoScoreSnapshotRepository.findMany({ select: { scores: true } });
      let total = 0;
      for (const snap of snapshots) {
        const scores = snap.scores as Record<string, any> | null;
        if (scores && typeof scores.recommendationCount === 'number') {
          total += scores.recommendationCount;
        } else if (scores && typeof scores.recommendations === 'number') {
          total += scores.recommendations;
        } else if (scores && typeof scores.recommendation_score === 'number') {
          total += scores.recommendation_score;
        }
      }
      return total;
    }),
    safeCount(() => knowledgePackageRepository.count()),
    safeCount(() => verificationResultRepository.count()),
  ]);

  return {
    overview: {
      brandsMonitored,
      activeProjects,
      verifiedCitations,
      recommendationAppearances,
      knowledgeAssetsManaged,
      verificationReportsCompleted,
    },
    providers: buildProvidersFromPresenceRegistry(),
    stories: [],
    trending: [],
    insights: INSIGHTS,
  };
}
