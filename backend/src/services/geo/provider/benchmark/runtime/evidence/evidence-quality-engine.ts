import type { EvidenceEntry } from './evidence-registry';

export interface EvidenceQualityScore {
  coverage: number;       // 0-100
  authority: number;      // 0-100
  freshness: number;      // 0-100
  traceability: number;   // 0-100
  diversity: number;      // 0-100
  overall: number;        // 加权总分
}

export interface EvidenceExplainability {
  coverage: string[];
  authority: string[];
  freshness: string;
  traceability: string;
  diversity: string;
  recommendations: string[];
}

// 可信来源白名单
const HIGH_AUTHORITY_SOURCES = [
  '官网', '官方网站', 'github', 'documentation',
  'official', 'wikipedia', '维基百科',
  'gov.cn', '政府', '监管', '专利',
  'research paper', '论文', '学术',
];

const MEDIUM_AUTHORITY_SOURCES = [
  '新闻', 'news', '报道', '科技媒体',
  'techcrunch', '36kr', '虎嗅', '雷锋网',
  'blog', '博客', 'medium',
  '报告', 'report', '行业分析',
];

function calcCoverage(evidence: EvidenceEntry[]): { score: number; issues: string[] } {
  const issues: string[] = [];
  // 检查是否覆盖品牌/产品/能力/FAQ 等维度
  const allContent = evidence.map(e => (e.content + ' ' + e.source).toLowerCase());
  const totalText = allContent.join(' ');

  let coveredDimensions = 0;
  const dimensions = ['品牌', '产品', '能力', 'FAQ', '技术', '市场', '竞争'];

  for (const d of dimensions) {
    if (totalText.includes(d) || allContent.some(c => c.includes(d))) {
      coveredDimensions++;
    }
  }

  if (coveredDimensions < 2) {
    issues.push(`证据仅覆盖 ${coveredDimensions}/7 个评估维度`);
  }

  const score = Math.min(100, Math.round((coveredDimensions / dimensions.length) * 100 + 30));
  return { score, issues };
}

function calcAuthority(evidence: EvidenceEntry[]): { score: number; issues: string[] } {
  const issues: string[] = [];
  if (evidence.length === 0) return { score: 0, issues: ['无证据可评估'] };

  let totalScore = 0;
  for (const e of evidence) {
    const source = e.source.toLowerCase();
    if (HIGH_AUTHORITY_SOURCES.some(s => source.includes(s))) {
      totalScore += 90;
    } else if (MEDIUM_AUTHORITY_SOURCES.some(s => source.includes(s))) {
      totalScore += 70;
    } else if (e.confidence > 0.8) {
      totalScore += 60;
    } else {
      totalScore += 40;
    }
  }
  const score = Math.round(totalScore / evidence.length);

  if (evidence.every(e => !HIGH_AUTHORITY_SOURCES.some(s => e.source.toLowerCase().includes(s)))) {
    issues.push('缺乏高权威来源（官网/政府/学术）');
  }
  return { score, issues };
}

function calcFreshness(evidence: EvidenceEntry[]): { score: number; issues: string[] } {
  const issues: string[] = [];
  if (evidence.length === 0) return { score: 0, issues: ['无证据可评估'] };

  const now = Date.now();
  const DAY_MS = 86400000;
  let totalScore = 0;

  for (const e of evidence) {
    const age = now - new Date(e.capturedAt).getTime();
    const ageDays = age / DAY_MS;
    if (ageDays < 30) totalScore += 100;
    else if (ageDays < 90) totalScore += 80;
    else if (ageDays < 180) totalScore += 60;
    else if (ageDays < 365) totalScore += 40;
    else totalScore += 20;
  }
  const score = Math.round(totalScore / evidence.length);

  const maxAge = Math.max(...evidence.map(e => now - new Date(e.capturedAt).getTime())) / DAY_MS;
  if (maxAge > 180) {
    issues.push(`部分证据已超过 ${Math.round(maxAge)} 天，建议更新`);
  }
  return { score, issues };
}

function calcTraceability(evidence: EvidenceEntry[]): { score: number; issues: string[] } {
  const issues: string[] = [];
  if (evidence.length === 0) return { score: 0, issues: ['无证据可评估'] };

  // 检查是否每个 evidence 都有 source/content/hash/evidenceId
  const traceable = evidence.filter(e => e.source && e.evidenceId).length;
  const score = Math.round((traceable / evidence.length) * 100);

  if (traceable < evidence.length) {
    issues.push(`${evidence.length - traceable} 条证据缺少追溯信息`);
  }
  return { score, issues };
}

function calcDiversity(evidence: EvidenceEntry[]): { score: number; issues: string[] } {
  const issues: string[] = [];
  if (evidence.length === 0) return { score: 0, issues: ['无证据可评估'] };

  const uniqueSources = new Set(evidence.map(e => e.source));
  const diversityRatio = uniqueSources.size / evidence.length;
  const score = Math.round(Math.min(100, diversityRatio * 120));

  if (uniqueSources.size < 2) {
    issues.push('所有证据来自同一来源');
  } else if (uniqueSources.size < 3) {
    issues.push('证据来源不够丰富，建议扩展到多源交叉验证');
  }
  return { score, issues };
}

// 主评分函数
export function evaluateEvidenceQuality(evidence: EvidenceEntry[]): {
  scores: EvidenceQualityScore;
  explainability: EvidenceExplainability;
} {
  const coverage = calcCoverage(evidence);
  const authority = calcAuthority(evidence);
  const freshness = calcFreshness(evidence);
  const traceability = calcTraceability(evidence);
  const diversity = calcDiversity(evidence);

  // 加权总分
  const overall = Math.round(
    (coverage.score * 0.25 +
     authority.score * 0.25 +
     freshness.score * 0.15 +
     traceability.score * 0.20 +
     diversity.score * 0.15)
  );

  const recommendations: string[] = [];
  if (coverage.issues.length > 0) recommendations.push(...coverage.issues.map(i => `Coverage: ${i}`));
  if (authority.issues.length > 0) recommendations.push(...authority.issues.map(i => `Authority: ${i}`));
  if (freshness.issues.length > 0) recommendations.push(...freshness.issues.map(i => `Freshness: ${i}`));
  if (traceability.issues.length > 0) recommendations.push(...traceability.issues.map(i => `Traceability: ${i}`));
  if (diversity.issues.length > 0) recommendations.push(...diversity.issues.map(i => `Diversity: ${i}`));

  return {
    scores: {
      coverage: coverage.score,
      authority: authority.score,
      freshness: freshness.score,
      traceability: traceability.score,
      diversity: diversity.score,
      overall,
    },
    explainability: {
      coverage: coverage.issues,
      authority: authority.issues,
      freshness: freshness.issues.length > 0 ? freshness.issues[0] : '证据较新',
      traceability: traceability.issues.length > 0 ? traceability.issues[0] : '所有证据可追溯',
      diversity: diversity.issues.length > 0 ? diversity.issues[0] : '来源多样性良好',
      recommendations,
    },
  };
}
