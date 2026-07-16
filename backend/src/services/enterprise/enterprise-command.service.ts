/**
 * Enterprise Command Service v1.1
 * 
 * CEO Intent Layer 核心服务
 * 创建指令 → 解析意图 → Planner生成计划 → 持久化 → 返回执行ID
 */

import { randomUUID } from 'crypto';
import type { CommandIntent } from './enterprise-planner.service';

export interface CreateCommandInput {
  tenantId: string;
  creatorId: string;
  content: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
}

export interface CommandListItem {
  id: string;
  content: string;
  commandType: string;
  priority: string;
  status: string;
  creatorId: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  agentCount?: number;
}

export interface CommandDetail {
  id: string;
  content: string;
  commandType: string;
  priority: string;
  status: string;
  plannerResult: CommandIntent | null;
  resultSummary?: string;
  resultJson?: any;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  creatorId: string;
}

export interface CommandStats {
  total: number;
  pending: number;
  running: number;
  completed: number;
  todayCount: number;
  todayCompleted: number;
  todayCost: number;      // token消耗成本（估算）
  avgAgentsPerTask: number;
}

// 内存storage MVP，后续迁移到Prisma EnterpriseCommand
const commandStore: Map<string, any> = new Map();

export class EnterpriseCommandService {
  
  /**
   * CEO创建新指令
   * 流程: 保存 → 解析意图 → Planner生成计划 → 更新状态
   */
  async createCommand(input: CreateCommandInput): Promise<{ id: string; status: string; plan: CommandIntent }> {
    const id = randomUUID();
    const now = new Date();
    
    // 1. 解析意图（调用Planner）
    const { enterprisePlannerService } = await import('./enterprise-planner.service');
    const plan = enterprisePlannerService.parseIntent(input.content);
    
    // 2. 保存到Store
    const record = {
      id,
      tenant_id: input.tenantId,
      creator_id: input.creatorId,
      content: input.content,
      command_type: plan.commandType,
      priority: input.priority || 'normal',
      status: 'PLANNING',
      planner_result: plan,
      result_summary: null,
      result_json: null,
      created_at: now.toISOString(),
      started_at: null,
      completed_at: null
    };
    
    commandStore.set(id, record);
    
    // 3. 模拟异步执行: 将PLANNING→RUNNING
    // Future: 这里触发Agent Runtime执行
    record.status = 'RUNNING';
    record.started_at = now.toISOString();
    
    return {
      id,
      status: record.status,
      plan
    };
  }
  
  /**
   * 查询指令列表（分页+状态筛选）
   */
  async listCommands(tenantId: string, options?: {
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: CommandListItem[]; total: number }> {
    const all = Array.from(commandStore.values())
      .filter((c: any) => c.tenant_id === tenantId);
    
    const filtered = options?.status
      ? all.filter((c: any) => c.status === options.status)
      : all;
    
    // 按时间倒序
    filtered.sort((a: any, b: any) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    
    const total = filtered.length;
    const limit = options?.limit || 20;
    const offset = options?.offset || 0;
    const items = filtered.slice(offset, offset + limit).map(this.toListItem);
    
    return { items, total };
  }
  
  /**
   * 查询指令详情（含执行计划）
   */
  async getCommandDetail(id: string): Promise<CommandDetail | null> {
    const record = commandStore.get(id);
    if (!record) return null;
    
    return {
      id: record.id,
      content: record.content,
      commandType: record.command_type,
      priority: record.priority,
      status: record.status,
      plannerResult: record.planner_result,
      resultSummary: record.result_summary || undefined,
      resultJson: record.result_json || undefined,
      createdAt: record.created_at,
      startedAt: record.started_at || undefined,
      completedAt: record.completed_at || undefined,
      creatorId: record.creator_id
    };
  }
  
  /**
   * 查询统计面板数据
   */
  async getStats(tenantId: string): Promise<CommandStats> {
    const all = Array.from(commandStore.values())
      .filter((c: any) => c.tenant_id === tenantId) as any[];
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString();
    
    const todayItems = all.filter((c: any) => c.created_at >= todayStr);
    
    return {
      total: all.length,
      pending: all.filter((c: any) => c.status === 'PENDING').length,
      running: all.filter((c: any) => c.status === 'RUNNING').length,
      completed: all.filter((c: any) => c.status === 'COMPLETED').length,
      todayCount: todayItems.length,
      todayCompleted: todayItems.filter((c: any) => c.status === 'COMPLETED').length,
      todayCost: todayItems.length * 2.5, // 估算: 每条指令平均消耗¥2.5
      avgAgentsPerTask: all.length > 0 
        ? Math.round(all.reduce((sum: number, c: any) => sum + (c.planner_result?.assignedAgents?.length || 0), 0) / all.length * 10) / 10
        : 0
    };
  }
  
  /**
   * 取消执行中的指令
   */
  async cancelCommand(id: string): Promise<boolean> {
    const record = commandStore.get(id);
    if (!record) return false;
    if (record.status === 'COMPLETED' || record.status === 'FAILED') return false;
    
    record.status = 'CANCELLED';
    record.completed_at = new Date().toISOString();
    return true;
  }
  
  /**
   * 标记指令完成（由Agent Runtime回调）
   */
  async markCompleted(id: string, results: { summary?: string; data?: any }): Promise<void> {
    const record = commandStore.get(id);
    if (!record) return;
    
    record.status = 'COMPLETED';
    record.completed_at = new Date().toISOString();
    record.result_summary = results.summary || null;
    record.result_json = results.data || null;
  }
  
  private toListItem(record: any): CommandListItem {
    return {
      id: record.id,
      content: record.content,
      commandType: record.command_type,
      priority: record.priority,
      status: record.status,
      creatorId: record.creator_id,
      createdAt: record.created_at,
      startedAt: record.started_at || undefined,
      completedAt: record.completed_at || undefined,
      agentCount: record.planner_result?.assignedAgents?.length || 0
    };
  }
}

export const enterpriseCommandService = new EnterpriseCommandService();
