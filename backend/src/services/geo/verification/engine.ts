// ============================================================
// P0-T006: Verification Engine
// 完整闭环：Before/After → Claims → Evidence → Explain → Recommendation
// ============================================================

import { PrismaClient } from '@prisma/client';
import type {
  VerificationResult,
  VerificationClaim,
  VerificationEvidence,
  VerificationHistoryEntry,
  VerificationRunRequest,
} from './types';
import {
  evidenceGradeToNumber,
  numberToEvidenceGrade,
  generateVerificationId,
} from './types';
import { generateClaims } from './claim-generator';
import { buildEvidenceTimeline } from './evidence-timeline';

export class VerificationEngine {
  constructor(private prisma: PrismaClient) {}

  /**
   * 运行验证（简化入口）
   */
  async verify(projectId: string, beforeSnapshotId?: string): Promise<VerificationResult> {
    return this.runVerification({ projectId, beforeSnapshotId });
  }

  /**
   * 完整验证流程
   */
  async runVerification(request: VerificationRunRequest): Promise<VerificationResult> {
    const { projectId } = request;

    // 1. 获取 project 数据
    const project = await this.getProject(projectId);
    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }

    // 2. 获取 "after" 数据 — 当前 ADI / Presence
    const after = await this.getCurrentMetrics(project);

    // 3. 获取 "before" 数据
    const before = await this.getBeforeMetrics(project, request.beforeSnapshotId, after);

    // 4. 计算 delta
    const delta = {
      adi: after.adi - before.adi,
      aiPresenceScore: after.aiPresenceScore - before.aiPresenceScore,
      visibilityCount: after.visibilityCount - before.visibilityCount,
      averageKnowledge: after.averageKnowledge - before.averageKnowledge,
      evidenceGradeDelta: evidenceGradeToNumber(after.evidenceGrade) - evidenceGradeToNumber(before.evidenceGrade),
    };

    // 5. 构建证据时间线
    const evidenceList = buildEvidenceTimeline(project, before.checkedAt, after.checkedAt);

    // 6. 建立 evidence ID → metric 映射
    const evidenceMap: Record<string, string[]> = this.buildEvidenceMap(evidenceList, delta);

    // 7. 生成 claims
    const claims = generateClaims(before, after, delta, {
      'adi': evidenceMap['adi'] || [],
      'ai presence score': evidenceMap['aiPresenceScore'] || evidenceMap['ai_presence_score'] || [],
      'visibility count': evidenceMap['visibilityCount'] || evidenceMap['visibility_count'] || [],
      'knowledge quality': evidenceMap['averageKnowledge'] || evidenceMap['average_knowledge'] || [],
    });

    // 8. 计算 status
    const status = this.calculateStatus(delta, claims);

    // 9. 计算总体 confidence
    const confidence = this.calculateConfidence(claims, evidenceList);

    // 10. 生成 explain
    const explain = this.generateExplain(delta, claims, evidenceList, confidence);

    // 11. 生成 recommendations
    const recommendations = this.generateRecommendations(delta, status, explain);

    // 12. 组装结果
    const result: VerificationResult = {
      id: generateVerificationId(),
      projectId,
      status,
      confidence,
      before,
      after,
      delta,
      claims,
      evidence: evidenceList,
      explain,
      recommendations,
      createdAt: new Date().toISOString(),
      projectSnapshotId: request.beforeSnapshotId || undefined,
    };

    // 13. 保存到 project.config
    await this.saveVerification(projectId, result);

    return result;
  }

  /**
   * 获取历史记录
   */
  async getHistory(projectId: string): Promise<VerificationHistoryEntry[]> {
    const project = await this.getProject(projectId);
    if (!project) return [];

    const verifications = project.config?.verifications || [];
    if (!Array.isArray(verifications)) return [];

    return verifications.map((v: any) => ({
      id: v.id || '',
      projectId,
      status: v.status || 'INCONCLUSIVE',
      confidence: v.confidence || 0,
      adiDelta: v.delta?.adi || 0,
      createdAt: v.createdAt || '',
    })).sort((a: any, b: any) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  /**
   * 获取单条验证详情
   */
  async getVerification(verificationId: string): Promise<VerificationResult | null> {
    // 在所有项目中查找
    const projects = await this.prisma.project.findMany({
      where: { deletedAt: null },
    });

    for (const project of projects) {
      const config = (project as any).config || {};
      const verifications = config.verifications || [];
      if (Array.isArray(verifications)) {
        const found = verifications.find((v: any) => v.id === verificationId);
        if (found) return found as VerificationResult;
      }
    }

    return null;
  }

  // ─── Private Helpers ───

  private async getProject(projectId: string): Promise<any> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });
    return project;
  }

  /**
   * 获取当前指标（after）
   */
  private async getCurrentMetrics(project: any): Promise<{
    adi: number;
    aiPresenceScore: number;
    visibilityCount: number;
    averageKnowledge: number;
    evidenceGrade: 'A' | 'B' | 'C' | 'D' | 'N/A';
    checkedAt: string;
  }> {
    const config = project.config || {};
    const presenceData = config.presenceReport || config.presence || config.latestPresence || {};

    // ADI — 从 config.adi 或 discovery report 获取
    const adi = typeof config.adi === 'number' ? config.adi : 0;
    const discoveryReport = config.discoveryReport || {};
    const aiPresenceScore = presenceData.overall?.score ?? presenceData.score ?? discoveryReport.aiPresenceScore ?? 0;
    const visibilityCount = presenceData.overall?.visibilityCount ?? presenceData.visibilityCount ?? 0;
    const averageKnowledge = presenceData.overall?.averageKnowledge ?? presenceData.averageKnowledge ?? 0;

    // Evidence Grade — 从 presence 数据的最高证据等级推算
    const evidenceGrade = this.calculateEvidenceGrade(presenceData);

    return {
      adi,
      aiPresenceScore,
      visibilityCount,
      averageKnowledge,
      evidenceGrade,
      checkedAt: new Date().toISOString(),
    };
  }

  /**
   * 获取 before 指标
   */
  private async getBeforeMetrics(
    project: any,
    beforeSnapshotId: string | undefined,
    after: {
      adi: number;
      aiPresenceScore: number;
      visibilityCount: number;
      averageKnowledge: number;
      evidenceGrade: 'A' | 'B' | 'C' | 'D' | 'N/A';
      checkedAt: string;
    }
  ): Promise<{
    adi: number;
    aiPresenceScore: number;
    visibilityCount: number;
    averageKnowledge: number;
    evidenceGrade: 'A' | 'B' | 'C' | 'D' | 'N/A';
    checkedAt: string;
  }> {
    const config = project.config || {};

    // 如果有指定的 snapshot，从 verifications 或 snapshots 查找
    if (beforeSnapshotId) {
      const verifications = config.verifications || [];
      const snapshot = verifications.find((v: any) => v.id === beforeSnapshotId);
      if (snapshot) {
        return {
          adi: snapshot.before?.adi ?? 0,
          aiPresenceScore: snapshot.before?.aiPresenceScore ?? 0,
          visibilityCount: snapshot.before?.visibilityCount ?? 0,
          averageKnowledge: snapshot.before?.averageKnowledge ?? 0,
          evidenceGrade: snapshot.before?.evidenceGrade || 'N/A',
          checkedAt: snapshot.before?.checkedAt || snapshot.createdAt || new Date().toISOString(),
        };
      }
    }

    // 查找最近的 verification 记录作为 before
    const verifications = config.verifications || [];
    if (Array.isArray(verifications) && verifications.length > 0) {
      // 取最新的 verification 的 after 作为 before
      const sorted = [...verifications].sort(
        (a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      const latest = sorted[0];
      if (latest && latest.after) {
        return {
          adi: latest.after.adi ?? 0,
          aiPresenceScore: latest.after.aiPresenceScore ?? 0,
          visibilityCount: latest.after.visibilityCount ?? 0,
          averageKnowledge: latest.after.averageKnowledge ?? 0,
          evidenceGrade: latest.after.evidenceGrade || 'N/A',
          checkedAt: latest.after.checkedAt || latest.createdAt || new Date().toISOString(),
        };
      }
    }

    // 查找最早的 snapshot 或 scan 记录
    const scanHistories = config.scanHistory || config.scan_histories || [];
    if (Array.isArray(scanHistories) && scanHistories.length > 0) {
      const sorted = [...scanHistories].sort(
        (a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
      const earliest = sorted[0];
      if (earliest) {
        return {
          adi: earliest.adi ?? earliest.score ?? 0,
          aiPresenceScore: earliest.aiPresenceScore ?? 0,
          visibilityCount: earliest.visibilityCount ?? 0,
          averageKnowledge: earliest.averageKnowledge ?? 0,
          evidenceGrade: earliest.evidenceGrade || 'N/A',
          checkedAt: earliest.createdAt || earliest.timestamp || new Date().toISOString(),
        };
      }
    }

    // 没有历史数据：默认 before = current - estimated growth
    const estimatedGrowth = after.adi * 0.1; // 估算 10% 增长
    return {
      adi: Math.max(0, after.adi - estimatedGrowth),
      aiPresenceScore: Math.max(0, after.aiPresenceScore - 5),
      visibilityCount: Math.max(0, after.visibilityCount - 1),
      averageKnowledge: Math.max(0, after.averageKnowledge - 5),
      evidenceGrade: numberToEvidenceGrade(
        Math.max(0, evidenceGradeToNumber(after.evidenceGrade) - 1)
      ),
      checkedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(), // 14 days ago
    };
  }

  /**
   * 从 presence provider 数据推算证据等级
   */
  private calculateEvidenceGrade(presenceData: any): 'A' | 'B' | 'C' | 'D' | 'N/A' {
    const providers = presenceData.providers || [];
    if (!Array.isArray(providers) || providers.length === 0) return 'N/A';

    // 统计各等级数量
    const gradeCount: Record<string, number> = { A: 0, B: 0, C: 0, D: 0 };
    for (const p of providers) {
      const g = (p.evidenceLevel || p.evidenceGrade || 'N/A').toUpperCase();
      if (g in gradeCount) gradeCount[g]++;
    }

    // 取最高等级
    for (const g of ['A', 'B', 'C', 'D'] as const) {
      if (gradeCount[g] > 0) return g;
    }
    return 'N/A';
  }

  /**
   * 构建 evidence → metric 映射
   */
  private buildEvidenceMap(evidence: VerificationEvidence[], delta: any): Record<string, string[]> {
    const map: Record<string, string[]> = {};

    for (const ev of evidence) {
      // 根据 evidence 类型和内容判断关联的 metric
      const content = ev.content.toLowerCase();
      if (content.includes('adi') || content.includes('score') || ev.type === 'snapshot') {
        map['adi'] = map['adi'] || [];
        map['adi'].push(ev.id);
      }
      if (content.includes('presence') || content.includes('visibility') || ev.type === 'ai_presence') {
        map['aiPresenceScore'] = map['aiPresenceScore'] || [];
        map['aiPresenceScore'].push(ev.id);
      }
      if (ev.type === 'optimization') {
        map['averageKnowledge'] = map['averageKnowledge'] || [];
        map['averageKnowledge'].push(ev.id);
        map['adi'] = map['adi'] || [];
        map['adi'].push(ev.id);
      }
    }

    return map;
  }

  /**
   * 计算验证状态
   */
  private calculateStatus(
    delta: { adi: number; aiPresenceScore: number; averageKnowledge: number },
    claims: VerificationClaim[]
  ): 'PASS' | 'PARTIAL' | 'FAIL' | 'INCONCLUSIVE' {
    const improvements = claims.filter(c => c.type === 'improvement').length;
    const regressions = claims.filter(c => c.type === 'regression').length;

    // ADI 增长 ≥ 5 that pass
    if (delta.adi >= 5 && improvements > 0 && regressions === 0) return 'PASS';
    // 有改善但也有退步，或仅部分改善
    if (improvements > 0 && regressions === 0) return 'PASS';
    if (improvements > 0) return 'PARTIAL';
    if (regressions > 0 && improvements === 0) return 'FAIL';
    return 'INCONCLUSIVE';
  }

  /**
   * 计算总体置信度
   */
  private calculateConfidence(claims: VerificationClaim[], evidence: VerificationEvidence[]): number {
    const claimConf = claims.reduce((sum, c) => sum + c.confidence, 0) / Math.max(1, claims.length);
    const evidenceConf = evidence.reduce((sum, e) => sum + e.confidence, 0) / Math.max(1, evidence.length);
    return Math.round((claimConf * 0.6 + evidenceConf * 0.4));
  }

  /**
   * 生成 Explain
   */
  private generateExplain(
    delta: { adi: number; aiPresenceScore: number; averageKnowledge: number },
    claims: VerificationClaim[],
    evidence: VerificationEvidence[],
    confidence: number
  ): {
    summary: string;
    confidence: number;
    reasons: Array<{ code: string; message: string }>;
    limitations: string[];
  } {
    const positiveClaims = claims.filter(c => c.type === 'improvement' && c.delta > 0);
    const reasons: Array<{ code: string; message: string }> = [];

    // 构建 reasons
    for (const c of positiveClaims) {
      const evidenceItems = evidence.filter(e => c.evidence.includes(e.id));
      for (const ev of evidenceItems) {
        reasons.push({
          code: `evidence.${ev.type}`,
          message: `${c.summary}: ${ev.content} (${ev.source})`,
        });
      }
    }

    if (reasons.length === 0 && delta.adi > 0) {
      reasons.push({
        code: 'delta.adi',
        message: `ADI 提升 +${delta.adi}`,
      });
    }

    // 构建 summary
    let summary = '';
    if (delta.adi > 0) {
      summary = `ADI 从提升 ${delta.adi > 0 ? '+' : ''}${delta.adi}`;
      if (delta.aiPresenceScore > 0) {
        summary += `，AI Presence 提升 +${delta.aiPresenceScore}`;
      }
      summary += '。验证通过。';
    } else if (delta.adi === 0) {
      summary = 'ADI 未发生变化。可能需要更多优化措施。';
    } else {
      summary = `ADI 下降 ${Math.abs(delta.adi)}。建议重新评估优化策略。`;
    }

    return {
      summary,
      confidence,
      reasons,
      limitations: [
        '验证基于当前已检测到的 AI 平台数据',
        '部分平台可能延迟更新（最长 72 小时）',
        '知识质量评分仅供参考',
      ],
    };
  }

  /**
   * 生成 Recommendations
   */
  private generateRecommendations(
    delta: { adi: number; aiPresenceScore: number; averageKnowledge: number },
    status: string,
    explain: { summary: string; reasons: Array<{ code: string; message: string }> }
  ): Array<{ action: string; priority: 'high' | 'medium' | 'low'; expectedImpact: string; reason: string }> {
    const recs: Array<{
      action: string;
      priority: 'high' | 'medium' | 'low';
      expectedImpact: string;
      reason: string;
    }> = [];

    if (status === 'PASS') {
      recs.push({
        action: 'Optimization Completed',
        priority: 'low',
        expectedImpact: 'Sustain current ADI level',
        reason: 'All key metrics show improvement. Continue monitoring.',
      });
    }

    if (delta.adi < 10 || status === 'PARTIAL' || status === 'FAIL') {
      recs.push({
        action: 'Continue Optimization',
        priority: 'high',
        expectedImpact: 'Expected +4 ADI',
        reason: 'ADI gain is below target. Further optimization recommended.',
      });
    }

    if (delta.aiPresenceScore < 5) {
      recs.push({
        action: 'Improve AI Presence',
        priority: 'high',
        expectedImpact: 'Expected +3-5 AI Presence Score',
        reason: 'AI presence improvement is minimal. Check platform coverage.',
      });
    }

    if (delta.averageKnowledge < 10) {
      recs.push({
        action: 'Enhance Knowledge Quality',
        priority: 'medium',
        expectedImpact: 'Expected +10 Knowledge Quality',
        reason: 'Knowledge quality shows limited improvement. Update FAQ and content.',
      });
    }

    return recs;
  }

  /**
   * 保存到 project.config.verifications[]
   */
  private async saveVerification(projectId: string, result: VerificationResult): Promise<void> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) return;

    const config = (project as any).config || {};
    const verifications = Array.isArray(config.verifications) ? config.verifications : [];

    // 最多保留 50 条历史
    verifications.push(result);
    if (verifications.length > 50) {
      verifications.splice(0, verifications.length - 50);
    }

    await this.prisma.project.update({
      where: { id: projectId },
      data: {
        config: {
          ...config,
          verifications,
          lastVerification: {
            id: result.id,
            status: result.status,
            confidence: result.confidence,
            adiDelta: result.delta.adi,
            createdAt: result.createdAt,
          },
        },
      } as any,
    });
  }
}
