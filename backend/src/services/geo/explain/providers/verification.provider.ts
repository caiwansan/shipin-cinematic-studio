// ============================================================
// VerificationExplainProvider — type: 'verification'
// RC1-T004: Explain Everywhere
//
// Explains verification results: before/after comparison,
// dimension changes, evidence timeline.
// Data from verification result repository.
// ============================================================

import type { ExplainResult, ExplainProvider } from '../types.js';
import { geoProjectRepository } from '../../repositories/geo-project.repository.js';
import { verificationResultRepository } from '../../repositories/verification-result.repository.js';

export class VerificationExplainProvider implements ExplainProvider {
  readonly type = 'verification';

  canHandle(type: string, _id: string): boolean {
    return type === 'verification';
  }

  async getExplain(_type: string, id: string): Promise<ExplainResult> {
    const project = await geoProjectRepository.findUnique({ where: { id } });
    if (!project || project.deletedAt) {
      throw new Error('Project not found');
    }

    const verifications = await verificationResultRepository.findMany({
      where: { projectId: id },
      orderBy: { createdAt: 'desc' },
    });

    const latestVerification = verifications[0] || null;

    const reasons: Array<{ label: string; severity: 'high' | 'medium' | 'low' }> = [];
    if (!latestVerification) {
      reasons.push({ label: '尚未运行验证', severity: 'high' });
    } else {
      const delta = (latestVerification as any).deltaAdi || 0;
      if (delta > 0) {
        reasons.push({ label: `ADI 提升 +${delta}，验证通过`, severity: 'low' });
      } else if (delta === 0) {
        reasons.push({ label: 'ADI 无变化，需检查优化执行', severity: 'medium' });
      } else {
        reasons.push({ label: `ADI 下降 ${delta}，需紧急处理`, severity: 'high' });
      }
      reasons.push({ label: `已执行 ${verifications.length} 次验证`, severity: 'low' });
    }

    const evidence: Array<{ source: string; detail: string }> = [];
    if (latestVerification) {
      evidence.push({
        source: 'verification_result',
        detail: `Before ADI: ${(latestVerification as any).beforeAdi ?? 'N/A'}, After ADI: ${(latestVerification as any).afterAdi ?? 'N/A'}`,
      });
    }
    if (verifications.length > 0) {
      evidence.push({
        source: 'verification_history',
        detail: `共 ${verifications.length} 条验证记录`,
      });
    }

    const citations: Array<{ title: string; url?: string }> = [];
    if (project.website) {
      citations.push({ title: '品牌官网', url: project.website });
    }

    const recommendations: Array<{ action: string; priority: string; impact: string }> = [];
    if (!latestVerification) {
      recommendations.push({ action: '运行首次验证', priority: 'high', impact: '获取基线对比' });
    }
    recommendations.push({ action: '对比最新验证结果与优化计划', priority: 'medium', impact: '驱动持续改进' });
    recommendations.push({ action: '设置定期验证提醒', priority: 'low', impact: '保证长期趋势可见' });

    const suggestions: string[] = [];
    if (!latestVerification) {
      suggestions.push('运行首次 Verification 获取基线对比');
    }
    suggestions.push('定期运行验证以跟踪优化进展');
    suggestions.push('关注 ADI Delta 变化趋势');

    const maxAdi = latestVerification ? Math.max((latestVerification as any).beforeAdi || 0, (latestVerification as any).afterAdi || 0) : 0;

    return {
      id: `verification-${id}`,
      title: '验证结果解释',
      summary: latestVerification
        ? `已完成 ${verifications.length} 次验证。最新结果：Before ADI ${(latestVerification as any).beforeAdi ?? 'N/A'} → After ADI ${(latestVerification as any).afterAdi ?? 'N/A'}。`
        : '尚未运行验证。请运行 Verification 获取品牌优化对比数据。',
      confidence: latestVerification ? 85 : 0,
      score: maxAdi || undefined,
      reasons,
      evidence,
      citations,
      recommendations,
      suggestions,
      updatedAt: new Date().toISOString(),
    };
  }
}
