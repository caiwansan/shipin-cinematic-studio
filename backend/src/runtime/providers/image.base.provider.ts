/**
 * Image Generation Provider Interface
 *
 * Abstraction over Flux / SDXL / Midjourney / DALL-E
 */

export interface ImageGenRequest {
  prompt: string
  negative_prompt?: string
  width?: number
  height?: number
  steps?: number
  guidance_scale?: number
  seed?: number
  model?: string  // specific model override
}

export interface ImageGenResponse {
  images: Array<{
    url: string
    width: number
    height: number
    seed?: number
  }>
  metadata: {
    provider: string
    model: string
    latencyMs: number
  }
}

export interface ImageGenProvider {
  name: string
  apiKey: string
  generate(req: ImageGenRequest, signal?: AbortSignal): Promise<ImageGenResponse>
}

export abstract class BaseImageProvider implements ImageGenProvider {
  abstract name: string
  apiKey: string = ''

  abstract generate(req: ImageGenRequest, signal?: AbortSignal): Promise<ImageGenResponse>
}

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "provider.registry",
  "mode": "TOOL"
};

