/**
 * Execution Scheduler — 调度器接口（仅接口，无实现）
 *
 * Scheduler 是调度策略的抽象：
 * - 当前提供 InMemoryScheduler（默认实现）
 * - 未来可替换为 Redis Scheduler / RabbitMQ Scheduler / Kafka Scheduler
 *
 * 重要：Kernel 先于 Scheduler 构建。
 * Scheduler 是策略层；Kernel 是平台层。
 *
 * @package @studio/platform/execution
 */

import type { ExecutionTask } from './types';

/**
 * ExecutionScheduler — 调度器接口
 *
 * 职责：
 * - schedule: 将任务加入调度队列
 * - cancel: 取消一个已调度的任务
 * - pause: 暂停任务执行
 * - resume: 恢复暂停的任务
 * - retry: 重新执行失败的任务
 * - getQueueLength: 获取当前排队任务数
 *
 * 调度器不直接执行任务 — 它决定任务何时被 Engine 处理。
 */
export interface ExecutionScheduler {
  /**
   * 调度一个任务
   * 将任务加入队列等待 Engine 处理
   */
  schedule(task: ExecutionTask): Promise<void>;

  /**
   * 取消一个已调度的任务
   * 从队列中移除（如果尚未执行）
   */
  cancel(taskId: string): Promise<void>;

  /**
   * 暂停一个正在执行的任务
   * 任务暂停后可以通过 resume 恢复
   */
  pause(taskId: string): Promise<void>;

  /**
   * 恢复一个已暂停的任务
   */
  resume(taskId: string): Promise<void>;

  /**
   * 重新执行一个失败的任务
   * 通常结合重试策略使用
   */
  retry(taskId: string): Promise<void>;

  /**
   * 获取当前队列长度
   */
  getQueueLength(): Promise<number>;
}
