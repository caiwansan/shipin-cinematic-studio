// ============================================================
// MissionExplainProvider — type: 'mission'
//
// 使用 ExplainDocumentBuilder 组装 Mission 的 Explain 文档。
// 数据来源：
//   - geoProjectRepository: 项目基本信息
//   - IssueGraphBuilder: 构建 Issue Graph → 得到 Mission
//   - MissionGenerator.generate(): 从 Graph 生成 Missions
//
// 所有数据来自真实 Repository，无硬编码。
// Uses ExplainDocumentBuilder for assembly — no hand-rolled JSON.
// ============================================================

import type { ExplainProvider } from '../types.js'
import { ExplainDocumentBuilder } from '../builder.js'
import type { ExplainDocument } from '../explain-document.js'
import { geoProjectRepository } from '../../repositories/geo-project.repository.js'
import { IssueGraphBuilder } from '../../decision-intelligence/issue-graph-builder.js'
import { MissionGenerator } from '../../mission-engine/mission-generator.js'

export class MissionExplainProvider implements ExplainProvider {
  readonly type = 'mission'

  canHandle(type: string, _id: string): boolean {
    return type === 'mission'
  }

  async getExplain(_type: string, id: string): Promise<ExplainDocument> {
    // 1. 获取项目数据
    const project = await geoProjectRepository.findUnique({ where: { id } })
    if (!project || project.deletedAt) {
      throw new Error('Mission not found — project not found')
    }

    const brandName = (project as any).name || id
    const adi = (project.config?.adi as number) || 0

    // 2. 通过 Issue Graph 生成 Missions（复用真实 Pipeline）
    const builder = new IssueGraphBuilder()
    let missions: import('../../mission-engine/types.js').Mission[] = []

    try {
      const graph = await builder.build(id)
      if (graph.nodes && graph.nodes.length > 0) {
        missions = MissionGenerator.generate(graph, id, brandName)
      } else {
        missions = MissionGenerator.generateEmptyMissions(id)
      }
    } catch {
      // Fallback: empty missions
      missions = MissionGenerator.generateEmptyMissions(id)
    }

    // 3. 使用 Builder 组装 ExplainDocument
    const explainBuilder = new ExplainDocumentBuilder()

    // --- Section: reasoning（Mission 生成的决策依据）---
    explainBuilder.addSection('reasoning', '任务生成依据')

    if (missions.length === 0) {
      explainBuilder.addItem('reasoning', {
        id: 'reason-generate',
        label: '生成状态',
        value: '未找到可生成的优化任务',
        status: 'neutral',
      })
    } else {
      const pendingCount = missions.filter(m => m.status === 'pending').length
      const rootCauseCount = missions.filter(m => m.order === 0).length
      const improvementCount = missions.filter(m =>
        m.sourceIssueKind === 'missing_schema' ||
        m.sourceIssueKind === 'incomplete_schema' ||
        m.sourceIssueKind === 'schema_error'
      ).length

      explainBuilder.addItem('reasoning', {
        id: 'reason-count',
        label: '任务总数',
        value: `${missions.length} 个任务`,
        status: 'positive',
      })
      explainBuilder.addItem('reasoning', {
        id: 'reason-pending',
        label: '待处理',
        value: `${pendingCount} 个任务待处理`,
        status: pendingCount > 0 ? 'action_required' : 'positive',
      })
      explainBuilder.addItem('reasoning', {
        id: 'reason-root-cause',
        label: '根因任务',
        value: `${rootCauseCount} 个根因任务`,
        status: rootCauseCount > 0 ? 'action_required' : 'neutral',
      })
      if (improvementCount > 0) {
        explainBuilder.addItem('reasoning', {
          id: 'reason-schema',
          label: 'Schema 优化',
          value: `${improvementCount} 个 Schema 相关任务`,
          status: 'action_required',
        })
      }
      explainBuilder.addItem('reasoning', {
        id: 'reason-adi',
        label: '当前 ADI',
        value: `ADI ${adi}`,
        status: adi < 60 ? 'negative' : adi < 80 ? 'action_required' : 'positive',
      })
    }

    // --- Section: evidence（数据来源）---
    explainBuilder.addSection('evidence', '数据来源')
    explainBuilder.addItem('evidence', {
      id: 'evidence-project',
      label: '品牌',
      value: brandName,
      source: 'geoProjectRepository',
    })
    explainBuilder.addItem('evidence', {
      id: 'evidence-missions',
      label: '任务数量',
      value: missions.length,
      source: 'MissionGenerator.generate()',
    })

    const issueKinds = new Set(missions.map(m => m.sourceIssueKind))
    if (issueKinds.size > 0) {
      explainBuilder.addItem('evidence', {
        id: 'evidence-issue-kinds',
        label: 'Issue 类型数',
        value: issueKinds.size,
        source: 'IssueGraphBuilder',
      })
    }

    // --- Section: metric（指标展示）---
    explainBuilder.addSection('metric', '评分指标')
    const avgScore = missions.length > 0
      ? Math.round(missions.reduce((s, m) => s + m.score, 0) / missions.length)
      : 0
    explainBuilder.addItem('metric', {
      id: 'metric-score',
      label: '平均优先级评分',
      value: avgScore,
      source: 'MissionGenerator.generate()',
    })

    // --- Section: recommendation（建议/行动项）---
    explainBuilder.addSection('recommendation', '建议操作')
    const topMissions = missions.slice(0, 4)
    for (const m of topMissions) {
      explainBuilder.addItem('recommendation', {
        id: `rec-${m.id}`,
        label: m.title,
        value: m.difficulty,
        detail: m.estimatedTime,
        status: m.status === 'pending' ? 'action_required' : 'neutral',
      })
    }
    if (missions.length > 4) {
      explainBuilder.addItem('recommendation', {
        id: 'rec-more',
        label: `查看更多任务（共 ${missions.length} 个）`,
        value: 'all',
        detail: '前往任务中心查看完整列表',
        status: 'neutral',
      })
    }

    // confidence: based on actual data quality
    const hasMissions = missions.length > 0
    const confidence = hasMissions ? Math.min(85, 30 + Math.round(avgScore / 2)) : 0

    return explainBuilder.build({
      id: `mission-explain-${id}`,
      title: `"${brandName}" 优化任务解释`,
      summary: hasMissions
        ? `基于品牌「${brandName}」的 Issue Graph 分析，生成了 ${missions.length} 个优化任务。平均优先级评分 ${avgScore}，当前 ADI ${adi}。`
        : `品牌「${brandName}」暂无优化任务。请先完成基础数据准备。`,
      confidence,
      metadata: {
        type: 'mission',
        sourceId: id,
        sourceType: 'mission',
        provider: 'MissionExplainProvider',
      },
    })
  }
}
