import { PlatformContext } from '../context/platform-context.js'

/**
 * Unified Runtime lifecycle interface.
 */
export interface RuntimeLifecycle<TInput = any, TOutput = any> {
  init(ctx: PlatformContext, config?: Record<string, any>): Promise<void>
  load(ctx: PlatformContext, id: string): Promise<TInput>
  validate(ctx: PlatformContext, input: TInput): Promise<boolean>
  execute(ctx: PlatformContext, input: TInput): Promise<TOutput>
  update(ctx: PlatformContext, id: string, data: Partial<TInput>): Promise<TOutput>
  dispose(ctx: PlatformContext): Promise<void>
}
