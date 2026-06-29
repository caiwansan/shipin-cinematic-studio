/**
 * InMemoryScheduler — 内存调度器（默认 C2 实现）
 *
 * 实现 ExecutionScheduler 接口。
 * 任务在内存队列中排队，Engine 从中取出任务执行。
 *
 * 当前为单进程实现，适用于：
 * - 开发环境
 * - 测试环境
 * - 单进程部署
 *
 * 生产环境应替换为 Redis/Kafka/RabbitMQ 实现。
 *
 * 特性：
 * - FIFO 队列
 * - 任务去重（相同 taskId 不会重复入队）
 * - 支持取消、暂停、恢复
 * - 支持手动重试
 *
 * @package @studio/platform/execution
 */

import type { ExecutionTask } from './types';
import type { ExecutionScheduler } from './execution-scheduler';

/**
 * 节点内部任务状态
 */
interface SchedulerEntry {
  task: ExecutionTask;
  status: 'queued' | 'active' | 'paused' | 'completed' | 'failed' | 'cancelled';
  enqueuedAt: number;
}

/**
 * InMemoryScheduler — 内存调度器
 */
export class InMemoryScheduler implements ExecutionScheduler {
  private queue: SchedulerEntry[] = [];
  private active: Map<string, SchedulerEntry> = new Map();
  private completed: Map<string, SchedulerEntry> = new Map();

  /**
   * 调度一个任务
   * 如果任务已存在（相同 taskId），则不重复入队
   */
  async schedule(task: ExecutionTask): Promise<void> {
    // 去重检查
    const existing = this.queue.find(e => e.task.id === task.id);
    if (existing) return;

    this.queue.push({
      task,
      status: 'queued',
      enqueuedAt: Date.now(),
    });
  }

  /**
   * 取消任务
   * 如果任务在队列中则直接移除
   * 如果任务正在执行则标记为取消（由 Engine 处理）
   */
  async cancel(taskId: string): Promise<void> {
    // 从队列中移除
    const queueIndex = this.queue.findIndex(e => e.task.id === taskId);
    if (queueIndex >= 0) {
      const removed = this.queue.splice(queueIndex, 1)[0];
      removed.status = 'cancelled';
      this.completed.set(taskId, removed);
      return;
    }

    // 如果正在执行，标记为取消
    const active = this.active.get(taskId);
    if (active) {
      active.status = 'cancelled';
    }
  }

  /**
   * 暂停一个正在执行的任务
   */
  async pause(taskId: string): Promise<void> {
    const active = this.active.get(taskId);
    if (active) {
      active.status = 'paused';
    }
  }

  /**
   * 恢复一个已暂停的任务
   */
  async resume(taskId: string): Promise<void> {
    const entry = this.active.get(taskId);
    if (entry && entry.status === 'paused') {
      entry.status = 'active';
    }
  }

  /**
   * 重新调度一个失败的任务
   */
  async retry(taskId: string): Promise<void> {
    const entry = this.completed.get(taskId);
    if (!entry) return;

    // 从已完成移到队列
    this.completed.delete(taskId);
    entry.status = 'queued';
    this.queue.push(entry);
  }

  /**
   * 获取队列长度
   */
  async getQueueLength(): Promise<number> {
    return this.queue.length;
  }

  // ============ 内部方法（供 Engine 使用） ============

  /**
   * 从队列中取出下一个任务
   * @returns 下一个待执行任务，或 undefined（队列空）
   */
  async dequeue(): Promise<ExecutionTask | undefined> {
    // 找到第一个 queued 状态的任务
    const index = this.queue.findIndex(e => e.status === 'queued');
    if (index < 0) return undefined;

    const entry = this.queue.splice(index, 1)[0];
    entry.status = 'active';
    this.active.set(entry.task.id, entry);
    return entry.task;
  }

  /**
   * 标记任务为完成
   */
  async markComplete(taskId: string): Promise<void> {
    const entry = this.active.get(taskId);
    if (entry) {
      this.active.delete(taskId);
      entry.status = 'completed';
      this.completed.set(taskId, entry);
    }
  }

  /**
   * 标记任务为失败
   */
  async markFailed(taskId: string): Promise<void> {
    const entry = this.active.get(taskId);
    if (entry) {
      this.active.delete(taskId);
      entry.status = 'failed';
      this.completed.set(taskId, entry);
    }
  }

  /**
   * 获取当前活跃任务数
   */
  get activeCount(): number {
    return this.active.size;
  }

  /**
   * 清除所有任务（测试用）
   */
  clear(): void {
    this.queue = [];
    this.active.clear();
    this.completed.clear();
  }
}
