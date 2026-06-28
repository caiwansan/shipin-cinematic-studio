// Video Provider Layer v1
// Abstract interface for all video generation backends
// Architecture: Provider Interface → Adapters → Render Queue

// ── Core Types ──

export interface VideoPrompt {
  id: string
  sceneId: string
  projectId: string
  prompt: string
  negativePrompt?: string

  // Video-specific
  duration: number           // seconds
  width: number
  height: number
  fps?: number

  // Motion control
  cameraMotion?: string      // 'static', 'pan_left', 'pan_right', 'zoom_in', 'zoom_out', 'track'
  cameraSpeed?: 'slow' | 'normal' | 'fast'

  // Style
  styleRef?: string          // reference image URL
  characterRefs?: string[]   // character consistency images
  seed?: number

  // Metadata
  model?: string              // specific model override
  priority?: number
  callbackUrl?: string
}

export interface VideoOutput {
  url: string                // URL or file path of the generated video
  duration: number           // actual duration in seconds
  width: number
  height: number
  seed: number
  provider: string
  model: string
  latencyMs: number
  cost?: number
  metadata?: Record<string, any>
}

export interface VideoProviderStatus {
  name: string
  available: boolean
  models: string[]
  rateLimit: { requestsPerMinute: number; remaining: number }
  healthy: boolean
}

// ── Video Provider Interface ──

export interface VideoProvider {
  readonly name: string
  readonly models: string[]

  /** Generate a video from a prompt */
  generate(prompt: VideoPrompt, signal?: AbortSignal): Promise<VideoOutput>

  /** Check provider health and rate limits */
  status(): Promise<VideoProviderStatus>
}

// ── Video Render Job ──

export type VideoJobStatus = 'queued' | 'generating' | 'completed' | 'failed'

export interface VideoRenderJob {
  id: string
  prompt: VideoPrompt
  status: VideoJobStatus
  output?: VideoOutput
  error?: string
  progress?: number           // 0-100
  createdAt: string
  startedAt?: string
  completedAt?: string
  retryCount: number
  maxRetries: number
}

// ── Provider Registry ──

const providers = new Map<string, VideoProvider>()

export function registerVideoProvider(provider: VideoProvider): void {
  providers.set(provider.name, provider)
  console.log(`[video-provider] registered: ${provider.name} (${provider.models.join(', ')})`)
}

export function getVideoProvider(name: string): VideoProvider | undefined {
  return providers.get(name)
}

export function getBestAvailableProvider(): VideoProvider | undefined {
  // Prefer by order of registration
  for (const p of providers.values()) {
    return p  // return first available
  }
  return undefined
}

export function listVideoProviders(): string[] {
  return [...providers.keys()]
}
