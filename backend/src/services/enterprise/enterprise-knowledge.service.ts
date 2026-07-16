/**
 * Enterprise Knowledge Asset Service v2.0
 * 
 * 修正1：enterprise_knowledge 不是第二知识库
 * 定位：企业知识资产入口（Agent Runtime不直接读取，经Knowledge Hub）
 * 
 * 6种类型: intro|product|case|script|faq|industry
 * agent_access_scope: 控制哪种Agent可访问
 */

import { randomUUID } from 'crypto';

export interface CreateKnowledgeInput {
  tenantId: string;
  type: 'intro' | 'product' | 'case' | 'script' | 'faq' | 'industry';
  title: string;
  content: string;
  fileUrl?: string;
  agentAccessScope?: string[];
}

export interface KnowledgeItem {
  id: string;
  tenantId: string;
  type: string;
  title: string;
  content: string;
  fileUrl?: string;
  source: string;
  status: string;
  charCount: number;
  agentAccessScope: string[];
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeStats {
  total: number;
  byType: Record<string, number>;
  totalChars: number;
  activeCount: number;
}

export interface UpdateKnowledgeInput {
  title?: string;
  content?: string;
  fileUrl?: string;
  status?: 'active' | 'archived';
  agentAccessScope?: string[];
}

// Memory MVP store
const knowledgeStore: Map<string, any> = new Map();

export class EnterpriseKnowledgeService {
  
  /**
   * 创建知识资产
   */
  async create(input: CreateKnowledgeInput): Promise<KnowledgeItem> {
    const id = randomUUID();
    const now = new Date().toISOString();
    
    const record = {
      id,
      tenant_id: input.tenantId,
      type: input.type,
      title: input.title,
      content: input.content,
      file_url: input.fileUrl || null,
      source: 'upload',
      status: 'active',
      char_count: input.content.length,
      agent_access_scope: JSON.stringify(input.agentAccessScope || []),
      created_at: now,
      updated_at: now
    };
    
    knowledgeStore.set(id, record);
    return this.toItem(record);
  }
  
  /**
   * 查询列表 (分页+类型筛选+搜索)
   */
  async list(tenantId: string, options?: {
    type?: string;
    status?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: KnowledgeItem[]; total: number }> {
    let all = Array.from(knowledgeStore.values())
      .filter((k: any) => k.tenant_id === tenantId);
    
    if (options?.type) {
      all = all.filter((k: any) => k.type === options.type);
    }
    if (options?.status) {
      all = all.filter((k: any) => k.status === options.status);
    } else {
      all = all.filter((k: any) => k.status === 'active');
    }
    if (options?.search) {
      const q = options.search.toLowerCase();
      all = all.filter((k: any) => 
        k.title.toLowerCase().includes(q) || k.content.toLowerCase().includes(q)
      );
    }
    
    all.sort((a: any, b: any) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    
    const total = all.length;
    const limit = options?.limit || 20;
    const offset = options?.offset || 0;
    const items = all.slice(offset, offset + limit).map(this.toItem);
    
    return { items, total };
  }
  
  /**
   * 获取单个知识资产
   */
  async get(id: string): Promise<KnowledgeItem | null> {
    const record = knowledgeStore.get(id);
    if (!record) return null;
    return this.toItem(record);
  }
  
  /**
   * 更新知识资产
   */
  async update(id: string, input: UpdateKnowledgeInput): Promise<KnowledgeItem | null> {
    const record = knowledgeStore.get(id);
    if (!record) return null;
    
    if (input.title !== undefined) record.title = input.title;
    if (input.content !== undefined) {
      record.content = input.content;
      record.char_count = input.content.length;
    }
    if (input.fileUrl !== undefined) record.file_url = input.fileUrl;
    if (input.status !== undefined) record.status = input.status;
    if (input.agentAccessScope !== undefined) {
      record.agent_access_scope = JSON.stringify(input.agentAccessScope);
    }
    record.updated_at = new Date().toISOString();
    
    return this.toItem(record);
  }
  
  /**
   * 删除（归档）知识资产
   */
  async archive(id: string): Promise<boolean> {
    const record = knowledgeStore.get(id);
    if (!record) return false;
    record.status = 'archived';
    record.updated_at = new Date().toISOString();
    return true;
  }
  
  /**
   * 获取知识库统计
   */
  async getStats(tenantId: string): Promise<KnowledgeStats> {
    const all = Array.from(knowledgeStore.values())
      .filter((k: any) => k.tenant_id === tenantId && k.status === 'active');
    
    const byType: Record<string, number> = {};
    all.forEach((k: any) => {
      byType[k.type] = (byType[k.type] || 0) + 1;
    });
    
    return {
      total: all.length,
      byType,
      totalChars: all.reduce((sum: number, k: any) => sum + (k.char_count || 0), 0),
      activeCount: all.length
    };
  }
  
  /**
   * 按类型批量获取（供Agent Runtime Context使用）
   * 修正1实现：Agent经Knowledge Hub读取，不直接访问
   */
  async getByType(tenantId: string, types: string[]): Promise<KnowledgeItem[]> {
    const all = Array.from(knowledgeStore.values())
      .filter((k: any) => 
        k.tenant_id === tenantId && 
        k.status === 'active' && 
        types.includes(k.type)
      );
    return all.map(this.toItem);
  }
  
  private toItem(record: any): KnowledgeItem {
    let scope: string[] = [];
    try {
      scope = JSON.parse(record.agent_access_scope || '[]');
    } catch { /* ignore */ }
    
    return {
      id: record.id,
      tenantId: record.tenant_id,
      type: record.type,
      title: record.title,
      content: record.content,
      fileUrl: record.file_url || undefined,
      source: record.source,
      status: record.status,
      charCount: record.char_count,
      agentAccessScope: scope,
      createdAt: record.created_at,
      updatedAt: record.updated_at
    };
  }
}

export const enterpriseKnowledgeService = new EnterpriseKnowledgeService();
