// ============================================================
// BrandExplainProvider — type: 'brand'
// Explains brand-level overview (ADI, health, discovery).
// ============================================================

import type { ExplainResult, ExplainProvider } from '../types.js';
import { geoProjectRepository } from '../../repositories/geo-project.repository.js';
import { geoScanHistoryRepository } from '../../repositories/geo-scan-history.repository.js';

export class BrandExplainProvider implements ExplainProvider {
  readonly type = 'brand';

  canHandle(type: string, _id: string): boolean {
    return type === 'brand';
  }

  async getExplain(_type: string, id: string): Promise<ExplainResult> {
    const project = await geoProjectRepository.findUnique({ where: { id } });
    if (!project || project.deletedAt) {
      throw new Error('Project not found');
    }

    const adi = (project.config?.adi as number) || 0;
    const scanRecords = await geoScanHistoryRepository.findMany(
      { where: { projectId: id } },
      { startedAt: 'desc' }
    );

    return {
      type: 'brand',
      title: `${project.name} 品牌概览`,
      summary: `品牌 ADI 得分 ${adi}，共 ${scanRecords.length} 次扫描记录。`,
      details: [
        { label: 'ADI 得分', value: String(adi), status: adi >= 60 ? 'good' : adi >= 40 ? 'neutral' : 'bad', reason: adi >= 60 ? '品牌发现能力良好' : '需要提升品牌可见度' },
        { label: '扫描次数', value: String(scanRecords.length), status: scanRecords.length > 0 ? 'good' : 'neutral', reason: scanRecords.length > 0 ? '已有扫描数据' : '建议进行首次扫描' },
      ],
      recommendations: [
        '运行网站扫描以评估品牌健康状况',
        '查看优化建议并创建执行计划',
        '监控 AI 可见度评分变化',
      ],
    };
  }
}
