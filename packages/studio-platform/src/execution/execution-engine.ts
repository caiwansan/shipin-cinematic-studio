/**
 * Execution Engine — 执行内核入口
 *
 * 这是整个平台执行模型的入口点。
 * 所有 Workspace (GEO/Video/Novel/PPT) 都通过 ExecutionEngine 提交任务。
 *
 * 核心职责：
 * 1. submit(): 接收 ExecutionRequest，创建 ExecutionTask，开始处理
 * 2. processTask(): Pipeline 执行主循环
 * 3. handleFailure(): 错误处理和重试逻辑
 * 4. 所有事件通过 EventBus 发布，组件间无直接调用
 *
 * 执行流程：
 * ```
 * submit(request)
 *   → 创建 ExecutionTask + ExecutionContext
 *   → 发布 execution.submitted 事件
 *   → scheduler.schedule(task)
 *   → processTask(task)
 *     → pipeline.execute(context, task)  [validate → plan → acquire → execute → persist → publish]
 *     → 每个阶段发布 execution.stage.* 事件
 *   → 完成: 发布 execution.completed 事件
 *   → 失败: → handleFailure() → 重试 or 发布 execution.failed 事件
 * ```
 *
 * 约束：
 * - 所有执行都通过 EventBus 通信
 * - ExecutionContext 是唯一的上下文对象
 * - 没有 workspace 特定逻辑
 *
 * @package @studio/platform/execution
 * @see RUNTIME-SPEC.md §2.1
 */

import { v4 as uuidv4 } from 'uuid';
import type { EventBus } from '../event/event-bus';
import type { CapabilityRuntime } from '../capability/capability-runtime';
import { ExecutionPipeline, DefaultExecutionPipeline } from './execution-pipeline';
import type { ExecutionScheduler } from './execution-scheduler';
import type { ExecutionLockManager } from './execution-lock';
import type { ExecutionContext } from './execution-context';
import type {
  ExecutionRequest,
  ExecutionTask,
  ExecutionResult,
  ExecutionError,
  ExecutionStatus,
} from './types';
import { ExecutionEventTypes } from './execution-events';

/**
 * Engine 配置选项
 */
export interface ExecutionEngineOptions {
  /** 默认超时时间 (ms) */
  defaultTimeout?: number;

  /** 默认最大重试次数 */
  defaultMaxRetries?: number;

  /** 默认重试延迟 (ms) */
  defaultRetryDelay?: number;

  /** 重试退避策略 */
  defaultRetryBackoff?: 'linear' | 'exponential';
}

/**
 * 默认 Engine 配置
 */
const DEFAULT_OPTIONS: ExecutionEngineOptions = {
  defaultTimeout: 30000,
  defaultMaxRetries: 0,
  defaultRetryDelay: 1000,
  defaultRetryBackoff: 'exponential',
};

/**
 * ExecutionEngine — 执行内核
 *
 * 线程安全设计：
 * - 每个任务独立处理
 * - 状态修改通过 EventBus 通知
 * - 锁机制防止资源冲突
 */
export class ExecutionEngine {
  private readonly pipeline: ExecutionPipeline;
  private readonly scheduler: ExecutionScheduler;
  private readonly eventBus: EventBus;
  private readonly lockManager: ExecutionLockManager;
  private readonly capabilityRuntime?: CapabilityRuntime;
  private readonly options: ExecutionEngineOptions;

  /** 跟踪所有活跃任务 */
  private readonly tasks: Map<string, ExecutionTask> = new Map();

  /** 跟踪所有完成的任务 */
  private readonly completedTasks: Map<string, ExecutionTask> = new Map();

  /** 取消控制器映射 */
  private readonly abortControllers: Map<string, AbortController> = new Map();

  constructor(
    pipeline: ExecutionPipeline,
    scheduler: ExecutionScheduler,
    eventBus: EventBus,
    lockManager: ExecutionLockManager,
    capabilityRuntime?: CapabilityRuntime,
    options?: ExecutionEngineOptions
  ) {
    this.pipeline = pipeline;
    this.scheduler = scheduler;
    this.eventBus = eventBus;
    this.lockManager = lockManager;
    this.capabilityRuntime = capabilityRuntime;
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * 提交一个执行请求
   *
   * 流程：
   * 1. 验证请求
   * 2. 创建 ExecutionTask + ExecutionContext
   * 3. 发布 submitted 事件
   * 4. 通过调度器入队
   * 5. 开始处理
   *
   * @param request - 执行请求
   * @returns 创建的 ExecutionTask
   */
  async submit(request: ExecutionRequest): Promise<ExecutionTask> {
    const traceId = `trace-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const abortController = new AbortController();

    // 创建执行上下文
    const context: ExecutionContext = {
      requestId: request.id,
      traceId,
      userId: request.userId,
      projectId: request.projectId,
      workspaceType: request.workspaceType,
      workspaceId: `${request.workspaceType}-${request.projectId}`,
      cancellationToken: abortController.signal,
      capabilities: new Map(),
      startedAt: Date.now(),
      timeoutMs: request.options?.timeout ?? this.options.defaultTimeout ?? 30000,
      retryCount: 0,
      maxRetries: request.options?.retry?.max ?? this.options.defaultMaxRetries ?? 0,
      metadata: {
        tags: request.options?.tags ?? [],
        originalType: request.type,
      },
    };

    // 创建任务
    const task: ExecutionTask = {
      id: `task-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      requestId: request.id,
      traceId,
      type: request.type,
      status: 'pending',
      context,
      pipeline: ['validate', 'plan', 'acquire', 'execute', 'persist', 'publish'],
      currentStage: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    // 存储取消控制器
    this.abortControllers.set(task.id, abortController);

    // 存储任务
    this.tasks.set(task.id, task);

    // 发布 submitted 事件
    await this.eventBus.publishEvent(
      ExecutionEventTypes.SUBMITTED,
      {
        taskId: task.id,
        request,
        timestamp: Date.now(),
        traceId,
      },
      {
        source: 'execution',
        userId: request.userId,
        projectId: request.projectId,
      }
    );

    // 通过调度器入队
    await this.scheduler.schedule(task);

    // 异步处理任务（不阻塞 submit 返回）
    this.processTask(task).catch((err) => {
      console.error(`[ExecutionEngine] Async process error for task ${task.id}:`, err);
    });

    return task;
  }

  /**
   * 取消一个正在执行的任务
   *
   * @param taskId - 任务 ID
   */
  async cancel(taskId: string): Promise<void> {
    // 先通过调度器取消
    await this.scheduler.cancel(taskId);

    // 触发取消信号
    const controller = this.abortControllers.get(taskId);
    if (controller) {
      controller.abort();
      this.abortControllers.delete(taskId);
    }

    // 更新任务状态
    const task = this.tasks.get(taskId);
    if (task && (task.status === 'pending' || task.status.startsWith('validating') || task.status.startsWith('executing'))) {
      task.status = 'cancelled';
      task.updatedAt = Date.now();

      // 发布取消事件
      await this.eventBus.publishEvent(
        ExecutionEventTypes.CANCELLED,
        {
          taskId,
          reason: 'User requested cancellation',
          timestamp: Date.now(),
          traceId: task.traceId,
        },
        {
          source: 'execution',
          userId: task.context.userId,
          projectId: task.context.projectId,
        }
      );

      // 移到已完成
      this.tasks.delete(taskId);
      this.completedTasks.set(taskId, task);
    }
  }

  /**
   * 获取任务状态
   *
   * @param taskId - 任务 ID
   * @returns 任务状态
   */
  async getStatus(taskId: string): Promise<ExecutionStatus> {
    const task = this.tasks.get(taskId) || this.completedTasks.get(taskId);
    if (!task) {
      throw new Error(`[ExecutionEngine] Task not found: ${taskId}`);
    }
    return task.status;
  }

  /**
   * 获取任务结果
   *
   * @param taskId - 任务 ID
   * @returns 执行结果，如果任务未完成则返回 null
   */
  async getResult(taskId: string): Promise<ExecutionResult | null> {
    const task = this.tasks.get(taskId) || this.completedTasks.get(taskId);
    if (!task) {
      throw new Error(`[ExecutionEngine] Task not found: ${taskId}`);
    }
    return task.result ?? null;
  }

  // ============ 内部方法 ============

  /**
   * 处理任务的主循环
   *
   * @param task - 执行任务
   */
  private async processTask(task: ExecutionTask): Promise<void> {
    try {
      // 检查是否被取消
      if (task.context.cancellationToken.aborted) {
        task.status = 'cancelled';
        task.updatedAt = Date.now();
        this.completedTasks.set(task.id, task);
        this.tasks.delete(task.id);
        return;
      }

      // 执行 Pipeline
      await this.pipeline.execute(task.context, task);

      // Pipeline 执行成功
      task.status = 'completed';
      task.result = {
        success: true,
        duration: Date.now() - task.context.startedAt,
        traceId: task.traceId,
      };
      task.updatedAt = Date.now();

      // 发布完成事件
      await this.eventBus.publishEvent(
        ExecutionEventTypes.COMPLETED,
        {
          taskId: task.id,
          result: task.result,
          duration: task.result.duration,
          timestamp: Date.now(),
          traceId: task.traceId,
        },
        {
          source: 'execution',
          userId: task.context.userId,
          projectId: task.context.projectId,
        }
      );

      // 标记调度器完成
      if ('markComplete' in this.scheduler) {
        await (this.scheduler as any).markComplete(task.id);
      }

      // 移到已完成
      this.completedTasks.set(task.id, task);
      this.tasks.delete(task.id);
      this.abortControllers.delete(task.id);

    } catch (err) {
      await this.handleFailure(task, this.normalizeError(err));
    }
  }

  /**
   * 处理阶段完成（当前阶段 + 1）
   *
   * @param task - 执行任务
   * @param stage - 完成的阶段名
   */
  private async handleStageCompletion(task: ExecutionTask, stage: string): Promise<void> {
    // 找到当前阶段索引并推进
    const stageIndex = task.pipeline.indexOf(stage as any);
    if (stageIndex >= 0) {
      task.currentStage = stageIndex + 1;
    }
    task.updatedAt = Date.now();
  }

  /**
   * 处理执行失败
   *
   * 根据错误是否可重试和重试策略决定：
   * - 可重试且未达上限 → 进入重试流程
   * - 不可重试或已达上限 → 标记为失败
   *
   * @param task - 执行任务
   * @param error - 执行错误
   */
  private async handleFailure(task: ExecutionTask, error: ExecutionError): Promise<void> {
    task.error = error;
    task.updatedAt = Date.now();

    // 判断是否可重试
    if (error.retryable && task.context.retryCount < task.context.maxRetries) {
      await this.handleRetry(task, error);
    } else {
      // 不可重试，标记为失败
      task.status = 'failed';
      task.result = {
        success: false,
        error,
        duration: Date.now() - task.context.startedAt,
        traceId: task.traceId,
      };

      // 发布失败事件
      await this.eventBus.publishEvent(
        ExecutionEventTypes.FAILED,
        {
          taskId: task.id,
          error,
          stage: error.stage as any,
          timestamp: Date.now(),
          traceId: task.traceId,
        },
        {
          source: 'execution',
          userId: task.context.userId,
          projectId: task.context.projectId,
        }
      );

      // 标记调度器失败
      if ('markFailed' in this.scheduler) {
        await (this.scheduler as any).markFailed(task.id);
      }

      // 移到已完成
      this.completedTasks.set(task.id, task);
      this.tasks.delete(task.id);
      this.abortControllers.delete(task.id);
    }
  }

  /**
   * 处理重试
   *
   * @param task - 执行任务
   * @param error - 触发重试的错误
   */
  private async handleRetry(task: ExecutionTask, error: ExecutionError): Promise<void> {
    task.context.retryCount++;
    task.status = 'retrying';

    // 计算重试延迟
    const baseDelay = task.context.metadata['retryDelay'] as number
      ?? this.options.defaultRetryDelay ?? 1000;
    const backoff = task.context.metadata['retryBackoff'] as string
      ?? this.options.defaultRetryBackoff ?? 'exponential';

    let delay: number;
    if (backoff === 'exponential') {
      delay = baseDelay * Math.pow(2, task.context.retryCount - 1);
      // 最大延迟 30 秒
      delay = Math.min(delay, 30000);
    } else {
      delay = baseDelay;
    }

    // 发布重试事件
    await this.eventBus.publishEvent(
      ExecutionEventTypes.RETRYING,
      {
        taskId: task.id,
        attempt: task.context.retryCount,
        maxRetries: task.context.maxRetries,
        delay,
        error,
        timestamp: Date.now(),
        traceId: task.traceId,
      },
      {
        source: 'execution',
        userId: task.context.userId,
        projectId: task.context.projectId,
      }
    );

    // 等待延迟
    await new Promise(resolve => setTimeout(resolve, delay));

    // 重置当前阶段为 0（从头开始）
    task.currentStage = 0;
    task.status = 'pending';
    task.error = undefined;
    task.updatedAt = Date.now();

    // 重新入队处理
    await this.scheduler.schedule(task);
    this.processTask(task).catch((err) => {
      console.error(`[ExecutionEngine] Retry process error for task ${task.id}:`, err);
    });
  }

  /**
   * 将任意错误规范化为 ExecutionError
   *
   * @param err - 原始错误
   * @returns 标准化的 ExecutionError
   */
  private normalizeError(err: unknown): ExecutionError {
    if (typeof err === 'object' && err !== null) {
      const e = err as Record<string, unknown>;
      return {
        code: (e.code as string) || 'INTERNAL_ERROR',
        message: (e.message as string) || String(err),
        stage: e.stage as string | undefined,
        retryable: (e.retryable as boolean) ?? false,
        details: e.details as Record<string, unknown> | undefined,
      };
    }
    return {
      code: 'INTERNAL_ERROR',
      message: String(err),
      retryable: false,
    };
  }
}
