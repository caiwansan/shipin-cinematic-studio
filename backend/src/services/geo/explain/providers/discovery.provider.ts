// ============================================================
// DiscoveryExplainProvider — type: 'discovery'
// RC1-T004: Explain Everywhere
//
// Explains ADI score from scan history + project config.
// Reasons: entity extraction count, citation source count, semantic coverage.
// ============================================================

import type { ExplainResult, ExplainProvider } from '../types.js';
import { geoProjectRepository } from '../../repositories/geo-project.repository.js';
import { geoScanHistoryRepository } from '../../repositories/geo-scan-history.repository.js';
import { geoClaimRepository } from '../../repositories/geo-claim.repository.js';

export class DiscoveryExplainProvider implements ExplainProvider {
  readonly type = 'discovery';

  canHandle(type: string, _id: string): boolean {
    return type === 'discovery';
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

    const claims = await geoClaimRepository.findMany({
      where: { projectId: id },
    });

    const evidenceCount = claims.length;
    const scanCount = scanRecords.length;
    const citationSources = new Set<string>();
    for (const c of claims) {
      if (c.source) citationSources.add(c.source);
    }

    const reasons: Array<{ label: string; severity: 'high' | 'medium' | 'low' }> = [];
    if (entityCount === 0) {
      reasons.push({ label: '未提取到品牌实体', severity: 'high' });
    } else {
      reasons.push({ label: `已提取 ${entityCount} 个实体`, severity: 'low' });
    }
    if (evidenceCount === 0) {
      reasons.push({ label: '缺少支撑证据 / Claims', severity: 'high' });
    } else {
      reasons.push({ label: `已有 ${evidenceCount} 条 Claims`, severity: 'low' });
    }
    if (scanCount === 0) {
      reasons.push({ label: '尚未运行发现扫描', severity: 'high' });
    } else {
      reasons.push({ label: `已完成 ${scanCount} 次扫描`, severity: 'low' });
    }
    if (citationSources.size === 0) {
      reasons.push({ label: '无引用来源', severity: 'medium' });
    } else {
      reasons.push({ label: `引用来源: ${citationSources.size} 个`, severity: 'low' });
    }
    if (adi < 30) {
      reasons.push({ label: 'ADI 评分低于 30，品牌可见度极低', severity: 'high' });
    } else if (adi < 60) {
      reasons.push({ label: 'ADI 评分在 30–60 之间，有较大优化空间', severity: 'medium' });
    } else if (adi < 80) {
      reasons.push({ label: 'ADI 评分良好，仍有提升空间', severity: 'low' });
    } else {
      reasons.push({ label: 'ADI 评分优秀，继续保持', severity: 'low' });
    }

    const evidence: Array<{ source: string; detail: string }> = [];
    if (project.website) {
      evidence.push({ source: 'website', detail: `官网: ${project.website}` });
    }
    if (entityCount > 0) {
      evidence.push({ source: 'entity', detail: `知识库实体数: ${entityCount}` });
    }
    if (evidenceCount > 0) {
      evidence.push({ source: 'evidence', detail: `Claims/证据数: ${evidenceCount}` });
    }
    if (scanCount > 0) {
      evidence.push({ source: 'scan', detail: `扫描次数: ${scanCount}` });
    }

    const citations: Array<{ title: string; url?: string }> = [];
    for (const c of claims) {
      if (c.source && (c as any).url) {
        citations.push({ title: c.content?.slice(0, 80) || c.source, url: (c as any).url });
      }
    }
    if (citations.length === 0 && project.website) {
      citations.push({ title: '品牌官网', url: project.website });
    }

    const recommendations: Array<{ action: string; priority: string; impact: string }> = [];
    if (!project.website) {
      recommendations.push({ action: '配置官网 URL', priority: 'high', impact: 'ADI +5~10' });
    }
    if (scanCount === 0) {
      recommendations.push({ action: '运行 Quick Discovery 获取基线', priority: 'high', impact: 'ADI +0~2' });
    }
    if (entityCount === 0) {
      recommendations.push({ action: '运行实体提取，构建知识图谱', priority: 'high', impact: 'ADI +4~10' });
    }
    if (evidenceCount < 3) {
      recommendations.push({ action: '添加品牌资料与 FAQ 内容', priority: 'medium', impact: 'ADI +3~6' });
    }
    if (adi < 80) {
      recommendations.push({ action: '完善结构化数据与知识源', priority: 'medium', impact: 'ADI +5~8' });
    }
    if (adi >= 80) {
      recommendations.push({ action: '持续监控 ADI 趋势', priority: 'low', impact: 'ADI +0~2' });
    }

    const suggestions: string[] = [];
    if (scanCount === 0) suggestions.push('立即运行 Quick Discovery');
    if (entityCount === 0) suggestions.push('完成实体提取');
    if (evidenceCount < 3) suggestions.push('添加至少 3 条品牌 Claims');
    if (!citationSources.size) suggestions.push('添加引用来源');
    if (suggestions.length === 0) suggestions.push('所有指标表现良好，继续保持');

    const confidence = Math.min(
      100,
      (entityCount > 0 ? 30 : 0) +
      (evidenceCount > 0 ? 30 : 0) +
      (scanCount > 0 ? 25 : 0) +
      (citationSources.size > 0 ? 15 : 0),
    );

    return {
      id: `discovery-${id}`,
      title: 'Discovery ADI 评分解释',
      summary: adi === 0
        ? '尚未开始分析，暂无可用评分数据。请运行 Quick Discovery 来获取 ADI 评分。'
        : `ADI ${adi} — 基于 ${entityCount} 个实体、${evidenceCount} 条 Claims 和 ${scanCount} 次扫描的综合评估。`,
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
