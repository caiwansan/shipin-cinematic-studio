/**
 * Enterprise Approval Service v2.0
 * 
 * 完整状态机（含修正2 revision_required）:
 * draft → ai_review → wait_approval → approved → published
 *                                  ↘ revision_required → (修改后) → wait_approval
 *                                  ↘ rejected
 * 
 * 修正3：审批必须绑定Agent身份
 * 每条记录都带 generated_by_agent_id, 审批页显示Agent信息
 */

import { randomUUID } from 'crypto';
import { contentSafetyEngine } from '../../enterprise/knowledge/content-safety.engine';

export interface ApprovalItem {
  id: string;
  tenantId: string;
  title: string;
  body: string;
  platform: string;
  status: string;
  agentId: string;
  agentName?: string;
  agentType?: string;
  generatedByAgentId?: string;
  aiReviewScore: number;
  aiReviewNote?: string;
  approverId?: string;
  approvalNote?: string;
  approvalAt?: string;
  revisionCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ApprovalStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  revisionRequired: number;
  avgScore: number;
}

// 内存Store: contentPublishId -> approvalRecord
const approvalStore: Map<string, any> = new Map();

// Agent信息查询 (从agent profile获取)
const agentNameMap: Record<string, { name: string; type: string }> = {
  'agent-growth-director': { name: 'AI增长总监', type: 'growth_director' },
  'agent-market-analyst': { name: 'AI市场分析师', type: 'market_analyst' },
  'agent-content-manager': { name: 'AI内容经理', type: 'content_manager' },
  'agent-customer-ops': { name: 'AI客户运营', type: 'customer_ops' },
  'agent-sales-assistant': { name: 'AI销售助理', type: 'sales_assistant' }
};

export class EnterpriseApprovalService {
  
  /**
   * Agent生成内容后，提交审批
   * 自动触发Content Safety Engine
   */
  async submitForApproval(input: {
    tenantId: string;
    contentPublishId: string;
    title: string;
    body: string;
    platform: string;
    agentId: string;
  }): Promise<{ id: string; status: string; safetyScore: number }> {
    
    // 1. 运行Content Safety Engine
    const safetyResult = contentSafetyEngine.review(input.title, input.body);
    
    // 2. 决定状态
    let status = 'wait_approval';
    if (!safetyResult.passed && safetyResult.riskLevel === 'high') {
      status = 'rejected';  // 高风险直接拒绝
    } else if (!safetyResult.passed) {
      status = 'ai_review';  // 需要修改
    }
    
    // 3. 保存审批记录
    const now = new Date().toISOString();
    const record = {
      id: randomUUID(),
      tenant_id: input.tenantId,
      content_publish_id: input.contentPublishId,
      title: input.title,
      body: input.body,
      platform: input.platform,
      status,
      agent_id: input.agentId,
      generated_by_agent_id: input.agentId,
      ai_review_score: safetyResult.score,
      ai_review_note: safetyResult.summary,
      approver_id: null,
      approval_note: null,
      approval_at: null,
      revision_count: 0,
      created_at: now,
      updated_at: now
    };
    
    approvalStore.set(record.id, record);
    
    return {
      id: record.id,
      status: record.status,
      safetyScore: safetyResult.score
    };
  }
  
  /**
   * 获取审批列表 (按状态筛选)
   */
  async list(tenantId: string, options?: {
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: ApprovalItem[]; total: number }> {
    let all = Array.from(approvalStore.values())
      .filter((r: any) => r.tenant_id === tenantId);
    
    if (options?.status) {
      all = all.filter((r: any) => r.status === options.status);
    }
    
    // 优先级: wait_approval > ai_review > others
    const statusOrder: Record<string, number> = {
      'wait_approval': 0,
      'ai_review': 1,
      'revision_required': 2,
      'approved': 3,
      'rejected': 4,
      'published': 5
    };
    
    all.sort((a: any, b: any) => {
      const orderA = statusOrder[a.status] ?? 99;
      const orderB = statusOrder[b.status] ?? 99;
      if (orderA !== orderB) return orderA - orderB;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
    
    const total = all.length;
    const limit = options?.limit || 20;
    const offset = options?.offset || 0;
    const items = all.slice(offset, offset + limit).map(this.toItem);
    
    return { items, total };
  }
  
  /**
   * 获取审批详情 (含Agent身份信息)
   */
  async getDetail(id: string): Promise<ApprovalItem | null> {
    const record = approvalStore.get(id);
    if (!record) return null;
    return this.toItem(record);
  }
  
  /**
   * CEO批准发布
   */
  async approve(id: string, approverId: string, note?: string): Promise<{ success: boolean; status: string }> {
    const record = approvalStore.get(id);
    if (!record) return { success: false, status: 'not_found' };
    
    record.status = 'approved';
    record.approver_id = approverId;
    record.approval_note = note || null;
    record.approval_at = new Date().toISOString();
    record.updated_at = new Date().toISOString();
    
    return { success: true, status: 'approved' };
  }
  
  /**
   * CEO拒绝发布
   */
  async reject(id: string, approverId: string, reason: string): Promise<{ success: boolean; status: string }> {
    const record = approvalStore.get(id);
    if (!record) return { success: false, status: 'not_found' };
    
    record.status = 'rejected';
    record.approver_id = approverId;
    record.approval_note = reason;
    record.approval_at = new Date().toISOString();
    record.updated_at = new Date().toISOString();
    
    return { success: true, status: 'rejected' };
  }
  
  /**
   * 修正2: 要求修改（revision_required）
   * 区别于拒绝：方向可以，但需要修改
   */
  async requestRevision(id: string, approverId: string, note: string): Promise<{ success: boolean; status: string }> {
    const record = approvalStore.get(id);
    if (!record) return { success: false, status: 'not_found' };
    
    record.status = 'revision_required';
    record.approver_id = approverId;
    record.approval_note = note;
    record.approval_at = new Date().toISOString();
    record.revision_count += 1;
    record.updated_at = new Date().toISOString();
    
    return { success: true, status: 'revision_required' };
  }
  
  /**
   * Agent修改后重新提交
   */
  async resubmit(id: string, newTitle?: string, newBody?: string): Promise<{ success: boolean; safetyScore: number }> {
    const record = approvalStore.get(id);
    if (!record) return { success: false, safetyScore: 0 };
    
    if (newTitle) record.title = newTitle;
    if (newBody) record.body = newBody;
    
    // 重新运行安全引擎
    const safetyResult = contentSafetyEngine.review(record.title, record.body);
    
    record.status = safetyResult.passed ? 'wait_approval' : 'ai_review';
    record.ai_review_score = safetyResult.score;
    record.ai_review_note = safetyResult.summary;
    record.updated_at = new Date().toISOString();
    
    return { success: true, safetyScore: safetyResult.score };
  }
  
  /**
   * 获取审批统计
   */
  async getStats(tenantId: string): Promise<ApprovalStats> {
    const all = Array.from(approvalStore.values())
      .filter((r: any) => r.tenant_id === tenantId) as any[];
    
    const scores = all.filter(r => r.ai_review_score > 0).map(r => r.ai_review_score);
    
    return {
      total: all.length,
      pending: all.filter(r => r.status === 'wait_approval').length,
      approved: all.filter(r => r.status === 'approved').length,
      rejected: all.filter(r => r.status === 'rejected').length,
      revisionRequired: all.filter(r => r.status === 'revision_required').length,
      avgScore: scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0
    };
  }
  
  /**
   * 获取审批历史（已处理的记录）
   */
  async getHistory(tenantId: string, options?: {
    limit?: number;
    offset?: number;
  }): Promise<{ items: ApprovalItem[]; total: number }> {
    const all = Array.from(approvalStore.values())
      .filter((r: any) => 
        r.tenant_id === tenantId && 
        (r.status === 'approved' || r.status === 'rejected' || r.status === 'published')
      );
    
    all.sort((a: any, b: any) => 
      new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );
    
    const total = all.length;
    const limit = options?.limit || 20;
    const offset = options?.offset || 0;
    const items = all.slice(offset, offset + limit).map(this.toItem);
    
    return { items, total };
  }
  
  private toItem(record: any): ApprovalItem {
    const agent = agentNameMap[record.agent_id] || { name: 'AI Agent', type: 'unknown' };
    
    return {
      id: record.id,
      tenantId: record.tenant_id,
      title: record.title,
      body: record.body,
      platform: record.platform,
      status: record.status,
      agentId: record.agent_id,
      agentName: agent.name,
      agentType: agent.type,
      generatedByAgentId: record.generated_by_agent_id,
      aiReviewScore: record.ai_review_score || 0,
      aiReviewNote: record.ai_review_note || undefined,
      approverId: record.approver_id || undefined,
      approvalNote: record.approval_note || undefined,
      approvalAt: record.approval_at || undefined,
      revisionCount: record.revision_count || 0,
     createdAt: record.created_at,
      updatedAt: record.updated_at
    };
  }
}

export const enterpriseApprovalService = new EnterpriseApprovalService();
