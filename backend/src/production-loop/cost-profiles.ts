// Render Cost & Quality Profile
// Defines cost/latency/quality metadata for each provider
// Used by the Intelligence Layer to make routing decisions

export interface CostProfile {
  provider: string
  model: string
  costPerSecond: number      // USD per second of output video
  avgLatencyMs: number       // average end-to-end latency
  qualityScore: number       // 1-10, subjective quality rating
  maxConcurrent: number      // max parallel requests
  rateLimitPerMinute: number
}

// Known provider cost profiles
// These should be updated as pricing changes
export const COST_PROFILES: CostProfile[] = [
  {
    provider: 'replicate',
    model: 'minimax-video',
    costPerSecond: 0.006,     // ~$0.03 for 5s video
    avgLatencyMs: 30_000,     // ~30s for video
    qualityScore: 7,
    maxConcurrent: 3,
    rateLimitPerMinute: 10,
  },
  {
    provider: 'replicate',
    model: 'stable-video-diffusion',
    costPerSecond: 0.003,     // cheaper but shorter
    avgLatencyMs: 15_000,
    qualityScore: 5,
    maxConcurrent: 3,
    rateLimitPerMinute: 20,
  },
  {
    provider: 'mock',
    model: 'mock-video-01',
    costPerSecond: 0,
    avgLatencyMs: 2_000,
    qualityScore: 2,
    maxConcurrent: 10,
    rateLimitPerMinute: 60,
  },
  {
    provider: 'volcengine',
    model: 'doubao-seedance-2-0-260128',
    costPerSecond: 0.002,     // ~$0.01 for 5s
    avgLatencyMs: 30_000,     // ~30s for video generation
    qualityScore: 8,          // doubao-seedance 2.0 quality
    maxConcurrent: 3,
    rateLimitPerMinute: 10,
  },
  {
    provider: 'volcengine',
    model: 'doubao-seedance-2-0-fast-260128',
    costPerSecond: 0.003,
    avgLatencyMs: 15_000,
    qualityScore: 7,
    maxConcurrent: 5,
    rateLimitPerMinute: 20,
  },
  {
    provider: 'volcengine',
    model: 'doubao-seedance-1-5-pro-251215',
    costPerSecond: 0.004,
    avgLatencyMs: 45_000,
    qualityScore: 7,
    maxConcurrent: 3,
    rateLimitPerMinute: 10,
  },
  {
    provider: 'volcengine',
    model: 'doubao-seedance-1-0-pro-fast-251015',
    costPerSecond: 0.002,
    avgLatencyMs: 20_000,
    qualityScore: 6,
    maxConcurrent: 5,
    rateLimitPerMinute: 30,
  },
  {
    provider: 'bailian',
    model: 'wan-aigc-video',
    costPerSecond: 0.004,     // ~$0.02 for 5s
    avgLatencyMs: 60_000,     // 阿里百炼视频生成约1分钟
    qualityScore: 7,
    maxConcurrent: 3,
    rateLimitPerMinute: 10,
  },
  {
    provider: 'bailian',
    model: 'qwen-video-plus',
    costPerSecond: 0.008,
    avgLatencyMs: 90_000,
    qualityScore: 8,
    maxConcurrent: 2,
    rateLimitPerMinute: 5,
  },
  {
    provider: 'bailian',
    model: 'qwen-video-turbo',
    costPerSecond: 0.003,
    avgLatencyMs: 30_000,
    qualityScore: 6,
    maxConcurrent: 5,
    rateLimitPerMinute: 20,
  },
]

export function getProfile(provider: string, model?: string): CostProfile | undefined {
  return COST_PROFILES.find(p => p.provider === provider && (!model || p.model === model))
}

export function listProfiles(): CostProfile[] {
  return [...COST_PROFILES]
}
