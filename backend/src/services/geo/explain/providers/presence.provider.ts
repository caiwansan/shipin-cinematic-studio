// ============================================================
// PresenceExplainProvider — type: 'presence'
// RC1-T004: Explain Everywhere
//
// Explains AI Presence score (visible/partial/unknown reasons).
// Data from presence check results (via project config or presence API).
// ============================================================

import type { ExplainResult, ExplainProvider } from '../types.js';
import { geoProjectRepository } from '../../repositories/geo-project.repository.js';

export class PresenceExplainProvider implements ExplainProvider {
  readonly type = 'presence';

  canHandle(type: string, _id: string): boolean {
    return type === 'presence';
  }

  async getExplain(_type: string, id: string): Promise<ExplainResult> {
    const project = await geoProjectRepository.findUnique({ where: { id } });
    if (!project || project.deletedAt) {
      throw new Error('Project not found');
    }

    // Try to load presence data from project config or external source
    const presenceData = project.config?.presenceData as any || {};

    // Normalize presence stats
    const totalChecked = presenceData.totalChecked ?? 0;
    const visibleCount = presenceData.visibleCount ?? 0;
    const partialCount = presenceData.partialCount ?? 0;
    const unknownCount = presenceData.unknownCount ?? 0;
    const presenceScore = presenceData.score ?? (project.config?.presenceScore as number) ?? 0;

    const reasons: Array<{ label: string; severity: 'high' | 'medium' | 'low' }> = [];
    if (totalChecked === 0) {
      reasons.push({ label: '尚未检查 AI 平台可见度', severity: 'high' });
    } else {
      const visiblePercent = Math.round((visibleCount / totalChecked) * 100);
      const partialPercent = Math.round((partialCount / totalChecked) * 100);

      if (visibleCount > 0) {
        reasons.push({ label: `${visibleCount}/${totalChecked} 平台可见 (${visiblePercent}%)`, severity: 'low' });
      }
      if (partialCount > 0) {
        reasons.push({ label: `${partialCount}/${totalChecked} 平台部分可见 (${partialPercent}%)`, severity: 'medium' });
      }
      if (unknownCount > 0) {
        reasons.push({ label: `${unknownCount} 个平台不可见`, severity: 'high' });
      }
    }
    if (!project.website) {
      reasons.push({ label: '官网缺失 — 影响 AI 可见度', severity: 'high' });
    }
    if (project.website && totalChecked === 0) {
      reasons.push({ label: '官网已配置，等待 AI Presence 扫描', severity: 'medium' });
    }

    const evidence: Array<{ source: string; detail: string }> = [];
    if (totalChecked > 0) {
      evidence.push({ source: 'presence_check', detail: `已扫描 ${totalChecked} 个 AI 平台` });
      evidence.push({ source: 'visibility', detail: `Visible: ${visibleCount}, Partial: ${partialCount}, Unknown: ${unknownCount}` });
    }
    if (project.website) {
      evidence.push({ source: 'website', detail: `官网: ${project.website}` });
    }

    const citations: Array<{ title: string; url?: string }> = [];
    if (project.website) {
      citations.push({ title: '品牌官网', url: project.website });
    }

    const recommendations: Array<{ action: string; priority: string; impact: string }> = [];
    if (totalChecked === 0) {
      recommendations.push({ action: '运行 AI Presence 扫描', priority: 'high', impact: '获取基线可见度数据' });
    }
    if (unknownCount > 0) {
      recommendations.push({ action: `改善 ${unknownCount} 个平台的品牌可见度`, priority: 'high', impact: '提升 AI Presence 评分' });
    }
    if (partialCount > 0) {
      recommendations.push({ action: `完善 ${partialCount} 个平台的品牌信息`, priority: 'medium', impact: '提升品牌完整度' });
    }
    if (!project.website) {
      recommendations.push({ action: '配置品牌官网', priority: 'high', impact: 'AI 可见度基础' });
    }
    if (presenceScore < 80 && totalChecked > 0) {
      recommendations.push({ action: '提交品牌资料到主流 AI 平台', priority: 'medium', impact: '提升 AI 收录率' });
    }
    if (recommendations.length === 0) {
      recommendations.push({ action: '持续监控 AI 可见度变化', priority: 'low', impact: '及时发现问题' });
    }

    const suggestions: string[] = [];
    if (totalChecked === 0) suggestions.push('运行 AI Presence 扫描');
    if (unknownCount > 0) suggestions.push(`关注 ${unknownCount} 个不可见平台`);
    if (partialCount > 0) suggestions.push(`完善 ${partialCount} 个部分可见平台的品牌信息`);
    if (!project.website) suggestions.push('配置品牌官网');
    if (suggestions.length === 0) suggestions.push('AI 可见度良好，持续监控');

    const confidence = totalChecked > 0
      ? Math.min(100, Math.round((visibleCount + partialCount) / totalChecked * 100))
      : 0;

    return {
      id: `presence-${id}`,
      title: 'AI Presence 评分解释',
      summary: totalChecked === 0
        ? '尚未检查品牌在各 AI 平台的可见度。请运行 AI Presence 扫描。'
        : `品牌在 ${totalChecked} 个 AI 平台中，${visibleCount} 个可见、${partialCount} 个部分可见、${unknownCount} 个不可见。Presence 评分: ${presenceScore}。`,
      confidence,
      score: presenceScore || undefined,
      reasons,
      evidence,
      citations,
      recommendations,
      suggestions,
      updatedAt: new Date().toISOString(),
    };
  }
}
