/**
 * Runtime — Barrel export
 */

// Provider Layer
export { BaseProvider, type LLMProvider, type LLMRequest, type LLMResponse, type LLMMessage } from './providers/base.provider.js'
export { DeepSeekProvider } from './providers/deepseek.provider.js'
export { OpenAIProvider } from './providers/openai.provider.js'
export { registerProvider, getProvider, getProviderForModel, listProviders } from './providers/provider.registry.js'

// Executor Interface
export { type IExecutor, type ExecutorInput, type ExecutorResult } from './executors/base.executor.js'
export { BaseLLMExecutor } from './executors/base-llm.executor.js'

// Built-in Executors
export { PromptBuilderExecutor } from './executors/prompt-builder.executor.js'
export { ScriptWriterExecutor } from './executors/script-writer.executor.js'
export { StoryboardExecutor } from './executors/storyboard.executor.js'
export { ShotSplitExecutor } from './executors/shot-split.executor.js'
export { ImagePromptExecutor } from './executors/image-prompt.executor.js'

// Registry bridge
export { registerRealExecutors } from './executors/executor.registry.js'

// Image Providers
export { type ImageGenProvider, type ImageGenRequest, type ImageGenResponse, BaseImageProvider } from './providers/image.base.provider.js'
export { ReplicateImageProvider } from './providers/replicate.image.provider.js'

// Image Executor
export { ImageGenExecutor } from './executors/image-gen.executor.js'
