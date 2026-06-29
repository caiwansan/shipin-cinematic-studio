/**
 * Execution Pipeline — 标准化的执行管道
 *
 * 定义统一的 Pipeline 阶段和执行流程：
 *   validate → plan → acquire → execute → persist → publish
 *
 * 所有 ExecutionRequest 都经过这个 Pipeline。
 * Workspace 可以注册自定义的 PipelineHandler 来扩展行为，
 * 但不能跳过或改变阶段的顺序。
 *
 * Pipeline 与 EventBus 深度集成：
 * - 每个阶段的开始和完成都会发布事件
 * - 阶段之间的流转通过 Engine 协调，不直接调用
 *
 * @package @studio/platform/execution
 */

import type { ExecutionContext } from './execution-context';
import type { ExecutionTask } from './types';
import type { EventBus, StudioEvent } from '../event/event-bus';
import type { CapabilityRuntime } from '../capability/capability-runtime';
import { ExecutionCapabilityHandler } from './execution-capability-handler';
import { ExecutionEventTypes } from './execution-events';

// ============ Pipeline Stage 定义 ============

/**
 * Pipeline 阶段枚举
 * 顺序固定：validate → plan → acquire → execute → persist → publish
 */
export type ExecutionPipelineStage =
  | 'validate'
  | 'plan'
  | 'acquire'
  | 'execute'
  | 'persist'
  | 'publish';

/** 所有阶段的顺序数组 */
export const PIPELINE_STAGES: readonly ExecutionPipelineStage[] = [
  'validate',
  'plan',
  'acquire',
  'execute',
  'persist',
  'publish',
] as const;

// ============ Pipeline Handler 接口 ============

/**
 * Pipeline handler — 每个阶段可以注册一个 handler
 *
 * Handler 负责：
 * 1. 执行该阶段的逻辑
 * 2. 在开始/完成时通过 EventBus 发布事件
 * 3. 返回成功或抛出 ExecutionError
 */
export interface PipelineHandler {
  /** 所属阶段 */
  stage: ExecutionPipelineStage;

  /**
   * 执行阶段逻辑
   * @param context - 执行上下文
   * @param task - 执行任务（可读写）
   */
  execute(context: ExecutionContext, task: ExecutionTask): Promise<void>;
}

// ============ Pipeline 类 ============

/**
 * Execution Pipeline — 管理阶段 handler 注册和执行
 *
 * 职责：
 * 1. 维护阶段 → handler 的映射
 * 2. 按固定顺序执行所有阶段
 * 3. 在每个阶段开始/完成时发布事件
 *
 * Pipeline 不直接处理错误或重试 — 由 Engine 负责。
 */
export class ExecutionPipeline {
  private handlers: Map<ExecutionPipelineStage, PipelineHandler> = new Map();

  /**
   * 注册一个 handler 到指定阶段
   * 每个阶段只能注册一个 handler（后注册覆盖先注册）
   */
  registerHandler(handler: PipelineHandler): void {
    if (!PIPELINE_STAGES.includes(handler.stage)) {
      throw new Error(
        `[ExecutionPipeline] Invalid pipeline stage: ${handler.stage}. ` +
        `Valid stages: ${PIPELINE_STAGES.join(', ')}`
      );
    }
    this.handlers.set(handler.stage, handler);
  }

  /**
   * 获取某个阶段的 handler
   */
  getHandler(stage: ExecutionPipelineStage): PipelineHandler | undefined {
    return this.handlers.get(stage);
  }

  /**
   * 获取所有已注册的阶段
   */
  getRegisteredStages(): ExecutionPipelineStage[] {
    return Array.from(this.handlers.keys());
  }

  /**
   * 按顺序执行整个 Pipeline
   * 从 currentStage 开始，依次执行到末尾
   *
   * @param context - 执行上下文
   * @param task - 执行任务（currentStage 决定从哪开始）
   */
  async execute(context: ExecutionContext, task: ExecutionTask): Promise<void> {
    const startIndex = task.currentStage;

    for (let i = startIndex; i < PIPELINE_STAGES.length; i++) {
      const stage = PIPELINE_STAGES[i];
      const handler = this.handlers.get(stage);

      if (!handler) {
        // 没有注册 handler 的阶段自动跳过
        task.currentStage = i + 1;
        continue;
      }

      // 更新当前阶段
      task.currentStage = i;
      task.status = this.stageToStatus(stage);

      // 执行 handler
      await handler.execute(context, task);
    }

    // Pipeline 完成，currentStage 指向 end
    task.currentStage = PIPELINE_STAGES.length;
  }

  /**
   * 将阶段名映射为对应状态
   */
  private stageToStatus(stage: ExecutionPipelineStage): string {
    const map: Record<ExecutionPipelineStage, string> = {
      validate: 'validating',
      plan: 'planning',
      acquire: 'acquiring',
      execute: 'executing',
      persist: 'persisting',
      publish: 'publishing',
    };
    return map[stage];
  }
}

// ============ 默认 Pipeline 实现 ============

/**
 * 默认的 Pipeline Handler — validate
 * 校验请求的有效性
 */
export class DefaultValidateHandler implements PipelineHandler {
  readonly stage: ExecutionPipelineStage = 'validate';

  async execute(context: ExecutionContext, task: ExecutionTask): Promise<void> {
    // 默认校验：检查必要字段
    if (!task.context.projectId) {
      throw Object.assign(new Error('projectId is required'), {
        code: 'VALIDATION_ERROR',
        stage: 'validate',
        retryable: false,
      });
    }
    if (!task.context.userId) {
      throw Object.assign(new Error('userId is required'), {
        code: 'VALIDATION_ERROR',
        stage: 'validate',
        retryable: false,
      });
    }
  }
}

/**
 * 默认的 Pipeline Handler — execute
 * 执行任务主体逻辑
 */
export class DefaultExecuteHandler implements PipelineHandler {
  readonly stage: ExecutionPipelineStage = 'execute';

  async execute(_context: ExecutionContext, _task: ExecutionTask): Promise<void> {
    // 默认无操作 — Workspace 应注册自定义 handler
    // 或通过 Engine 传入自定义 Pipeline
  }
}

/**
 * 默认 Pipeline — 包含 validate 和 execute 阶段
 *
 * Workspace 可以根据需要注册更多 handler：
 * pipeline.registerHandler(new CustomPersistHandler())
 * pipeline.registerHandler(new CustomPublishHandler())
 */
export class DefaultExecutionPipeline extends ExecutionPipeline {
  constructor(
    private readonly eventBus: EventBus,
    private readonly _capabilityRuntime?: CapabilityRuntime
  ) {
    super();

    // 注册默认 handler
    this.registerHandler(new DefaultValidateHandler());

    // If a CapabilityRuntime is provided, use ExecutionCapabilityHandler
    // to bridge Execution → Capability. Otherwise, use the default no-op handler.
    if (_capabilityRuntime) {
      this.registerHandler(new ExecutionCapabilityHandler(_capabilityRuntime));
    } else {
      this.registerHandler(new DefaultExecuteHandler());
    }

    // 包装注册方法，自动发布事件
    const originalRegister = this.registerHandler.bind(this);
    this.registerHandler = (handler: PipelineHandler) => {
      const wrapped = this.createEventEmittingHandler(handler);
      originalRegister(wrapped);
    };
  }

  /**
   * 装饰 handler，自动发布 stage started/completed 事件
   */
  private createEventEmittingHandler(handler: PipelineHandler): PipelineHandler {
    const originalExecute = handler.execute.bind(handler);
    const eventBus = this.eventBus;
    const stage = handler.stage;

    return {
      stage,
      async execute(context: ExecutionContext, task: ExecutionTask): Promise<void> {
        // 发布 stage started 事件
        await eventBus.publishEvent(
          ExecutionEventTypes.STAGE_STARTED,
          {
            taskId: task.id,
            stage,
            status: 'running',
            timestamp: Date.now(),
            traceId: context.traceId,
          },
          {
            source: 'execution',
            userId: context.userId,
            projectId: context.projectId,
          }
        );

        try {
          await originalExecute(context, task);

          // 发布 stage completed 事件
          await eventBus.publishEvent(
            ExecutionEventTypes.STAGE_COMPLETED,
            {
              taskId: task.id,
              stage,
              status: 'completed',
              timestamp: Date.now(),
              traceId: context.traceId,
            },
            {
              source: 'execution',
              userId: context.userId,
              projectId: context.projectId,
            }
          );
        } catch (err) {
          // 发布 stage failed 事件
          await eventBus.publishEvent(
            ExecutionEventTypes.FAILED,
            {
              taskId: task.id,
              stage,
              status: 'failed',
              error: (err as Error).message,
              timestamp: Date.now(),
              traceId: context.traceId,
            },
            {
              source: 'execution',
              userId: context.userId,
              projectId: context.projectId,
            }
          );
          throw err;
        }
      },
    };
  }
}
