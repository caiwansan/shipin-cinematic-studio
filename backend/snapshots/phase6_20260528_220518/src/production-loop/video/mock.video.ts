// Mock Video Provider
// For development/demo when no GPU or API key available

import { VideoProvider, type VideoPrompt, type VideoOutput, type VideoProviderStatus, registerVideoProvider } from './video-provider.js'

export class MockVideoProvider implements VideoProvider {
  name = 'mock'
  models = ['mock-video-01']

  async generate(prompt: VideoPrompt, signal?: AbortSignal): Promise<VideoOutput> {
    // Simulate video generation delay
    const durationMs = 2000 + Math.random() * 2000
    await new Promise((resolve, reject) => {
      const timer = setTimeout(resolve, durationMs)
      if (signal) {
        signal.addEventListener('abort', () => {
          clearTimeout(timer)
          reject(new Error('aborted'))
        })
      }
    })

    const seed = prompt.seed || Math.floor(Math.random() * 1000000)

    return {
      url: `https://picsum.photos/seed/${seed}/1280/720`,  // placeholder
      duration: prompt.duration || 5,
      width: prompt.width || 1280,
      height: prompt.height || 720,
      seed,
      provider: 'mock',
      model: 'mock-video-01',
      latencyMs: durationMs,
    }
  }

  async status(): Promise<VideoProviderStatus> {
    return {
      name: 'mock',
      available: true,
      models: this.models,
      rateLimit: { requestsPerMinute: 60, remaining: 60 },
      healthy: true,
    }
  }
}
