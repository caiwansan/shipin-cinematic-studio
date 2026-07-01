// ============================================================
// RecommendationExplainProvider — type: 'recommendation'
// RC1-T004: Explain Everywhere
//
// Explains each recommendation's basis (evidence sources, gaps).
// Data from project config + scan records.
// ============================================================

import type { ExplainResult, ExplainProvider } from '../types.js';
import { geoProjectRepository } from '../../repositories/geo-project.repository.js';
import { geoScanHistoryRepository } from '../../repositories/geo-scan-history.repository.js';
import { geoClaimRepository } from '../../repositories/geo-claim.repository.js';

export class RecommendationExplainProvider implements ExplainProvider {
  readonly type = 'recommendation';

  canHandle(type: string, _id: string): boolean {
    return type === 'recommendation';
  }

  async getExplain(_type: string, id: string): Promise<ExplainResult> {
    const project = await geoProjectRepository.findUnique({ where: { id } });
    if (!project || project.deletedAt) {
      throw new Error('Project not found');
    }

    const adi = (project.config?.adi as number) || 0;
    const entityCount = (project.config?.entityCount as number) || 0;

    const scanRecords = await geoScanHistoryRepository.findMany({
      where: { projectId: id },
      orderBy: { createdAt: 'desc' },
    });

    const claims = await geoClaimRepository.findMany({ where: { projectId: id } });
    const evidenceCount = claims.length;
    const scanCount = scanRecords.length;

    const reasons: Array<{ label: string; severity: 'high' | 'medium' | 'low' }> = [];
    if (!project.website) {
      reasons.push({ label: '官网缺失 — 需优先配置', severity: 'high' });
    }
    if (scanCount === 0) {
      reasons.push({ label: '未运行扫描 — 无基线数据', severity: 'high' });
    }
    if (entityCount === 0) {
      reasons.push({ label: '知识库为空 — 需实体提取', severity: 'high' });
    } else {
      reasons.push({ label: `已有 ${entityCount} 个实体`, severity: 'low' });
    }
    if (evidenceCount < 3) {
      reasons.push({ label: `Claims 不足 (${evidenceCount}条)，需补充`, severity: 'medium' });
    } else {
      reasons.push({ label: `已有 ${evidenceCount} 条 Claims`, severity: 'low' });
    }
    if (adi < 60) {
      reasons.push({ label: `ADI ${adi} 偏低，需系统性优化`, severity: 'high' });
    } else if (adi < 80) {
      reasons.push({ label: `ADI ${adi} 中等，可针对性优化`, severity: 'medium' });
    } else {
      reasons.push({ label: `ADI ${adi} 良好，持续监控即可`, severity: 'low' });
    }

    const evidence: Array<{ source: string; detail: string }> = [];
    if (project.website) {
      evidence.push({ source: 'project', detail: `官网已配置: ${project.website}` });
    }
    if (scanCount > 0) {
      evidence.push({ source: 'scan_history', detail: `已完成 ${scanCount} 次扫描` });
    }
    if (entityCount > 0) {
      evidence.push({ source: 'entity', detail: `实体数: ${entityCount}` });
    }
    if (evidenceCount > 0) {
      evidence.push({ source: 'claims', detail: `Claims: ${evidenceCount} 条` });
    }

    const citations: Array<{ title: string; url?: string }> = [];
    if (project.website) {
      citations.push({ title: '品牌官网', url: project.website });
    }

    const recommendations: Array<{ action: string; priority: string; impact: string }> = [
      ...(!project.website ? [{ action: '配置官网 URL', priority: 'high', impact: 'ADI +5~10' }] : []),
      ...(scanCount === 0 ? [{ action: '运行 Quick Discovery', priority: 'high', impact: 'ADI +0~2（基线）' }] : []),
      ...(entityCount === 0 ? [{ action: '运行实体提取', priority: 'high', impact: 'ADI +4~10' }] : []),
      ...(evidenceCount < 3 ? [{ action: '添加品牌资料与 FAQ', priority: 'medium', impact: 'ADI +3~6' }] : []),
      ...(adi < 60 ? [{ action: '完善品牌描述与知识源', priority: 'high', impact: 'ADI +5~12' }] : []),
      ...(adi >= 60 && adi < 80 ? [{ action: '扩展知识源（白皮书/案例）', priority: 'medium', impact: 'ADI +5~8' }] : []),
      ...(adi >= 80 ? [{ action: '设置评分漂移告警', priority: 'low', impact: 'ADI +0~2' }] : []),
    ];

    const suggestions: string[] = [];
    if (!project.website) suggestions.push('请先配置品牌官网 URL');
    if (scanCount === 0) suggestions.push('运行 Quick Discovery 获取基线');
    if (entityCount === 0) suggestions.push('完成实体提取');
    if (evidenceCount < 3) suggestions.push('添加至少 3 条 Claims');
    if (suggestions.length === 0) suggestions.push('各项指标基础良好，按优先级执行优化');

    const confidence = Math.min(
      100,
      20 +
      (entityCount > 0 ? 20 : 0) +
      (evidenceCount > 0 ? 20 : 0) +
      (scanCount > 0 ? 20 : 0) +
      (project.website ? 20 : 0),
    );

    return {
      id: `recommendation-${id}`,
      title: '优化建议解释',
      summary: `基于品牌「${project.name}」的当前状态，生成 ${recommendations.length} 条优化建议。主要发现: ${reasons.slice(0, 2).map(r => r.label).join('、')}。`,
      confidence,
      score: adi || undefined,
      reasons,
      evidence,
      citations,
      recommendations,
      suggestions,
      updatedAt: new Date().toISOString(),
    };
  }
}
