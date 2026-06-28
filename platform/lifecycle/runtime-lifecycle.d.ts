import { PlatformContext } from '../context/platform-context.js';
/**
 * Unified Runtime lifecycle interface.
 * All platform Runtimes must implement this interface.
 *
 * @template TInput - Input type for the Runtime
 * @template TOutput - Output type for the Runtime
 */
export interface RuntimeLifecycle<TInput = any, TOutput = any> {
    /**
     * Initialize the runtime. Called once at startup.
     * Loads configuration, establishes connections, registers default plugins.
     */
    init(ctx: PlatformContext, config?: Record<string, any>): Promise<void>;
    /**
     * Load input data by identifier.
     * Retrieves the domain entity and prepares it as Runtime input.
     */
    load(ctx: PlatformContext, id: string): Promise<TInput>;
    /**
     * Validate input against domain rules.
     * Returns true if the input is valid for execution.
     */
    validate(ctx: PlatformContext, input: TInput): Promise<boolean>;
    /**
     * Execute the main business logic with validated input.
     * Returns the runtime output.
     */
    execute(ctx: PlatformContext, input: TInput): Promise<TOutput>;
    /**
     * Update a domain entity by ID with partial data.
     * Returns the updated output.
     */
    update(ctx: PlatformContext, id: string, data: Partial<TInput>): Promise<TOutput>;
    /**
     * Dispose the runtime. Called on shutdown.
     * Releases connections, clears caches, unregisters listeners.
     */
    dispose(ctx: PlatformContext): Promise<void>;
}
