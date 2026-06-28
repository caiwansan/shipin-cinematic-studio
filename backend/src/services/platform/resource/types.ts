// ============================================================
// Resource Types — AI Resource Runtime
// KMKI-PLAT-008: Provider Runtime → Resource Orchestration Layer
// ============================================================

import type { PlatformContext } from '@platform/context/platform-context'

// ─── Resource Type Enum ───

export enum ResourceType {
  LLM = 'LLM',
  Embedding = 'Embedding',
  Image = 'Image',
  Video = 'Video',
  Speech = 'Speech',
  Tool = 'Tool',
  MCP = 'MCP',
  Browser = 'Browser',
  Human = 'Human',
  Webhook = 'Webhook',
}

// ─── Health Status ───

export type HealthStatus = 'healthy' | 'degraded' | 'down' | 'unknown'

// ─── Resource Contract ───

export interface ResourceContract {
  id: string
  name: string
  type: string          // LLM, Embedding, Image, Video, Speech, Tool, MCP, Browser, Human, Webhook
  vendor: string        // openai, deepseek, qwen, volcengine, gemini, ollama, etc.
  description?: string
  capabilities?: string // JSON — capability matrix entries
  models?: string       // JSON — supported model list
  endpoints?: string    // JSON — endpoint configuration
  authentication?: string // JSON — auth type (apiKey, oauth, none)
  pricing?: string      // JSON — pricing model
  limits?: string       // JSON — rate limits, quota
  metadata?: string     // JSON
  schemaVersion: number
  status: string
  createdAt: Date
  updatedAt: Date
}

// ─── Resource Credential ───

export interface ResourceCredential {
  id: string
  resourceId: string
  tenantId: string
  workspaceId?: string
  name: string
  encryptedKey: string
  endpoint?: string
  models?: string       // JSON — override supported models
  status: string
  rotationPolicy?: string // JSON
  lastRotated?: Date
  expiresAt?: Date
  metadata?: string     // JSON
  schemaVersion: number
  createdAt: Date
  updatedAt: Date
}

// ─── Resource Health ───

export interface ResourceHealth {
  id: string
  resourceId: string
  credentialId?: string
  status: HealthStatus
  latencyMs?: number
  errorRate?: number
  rateLimitRemaining?: number
  quotaRemaining?: number
  lastSuccessAt?: Date
  lastFailureAt?: Date
  failureReason?: string
  metadata?: string     // JSON
  checkedAt: Date
}

// ─── Resource Capability Matrix ───

export interface ResourceCapabilityMatrix {
  id: string
  resourceId: string
  capabilityId: string
  supported: boolean
  qualityScore?: number    // 0-1
  costMultiplier?: number  // relative cost
  metadata?: string        // JSON
  createdAt: Date
  updatedAt: Date
}

// ─── Resource Usage ───

export interface ResourceUsage {
  id: string
  credentialId: string
  tenantId: string
  workspaceId?: string
  resourceType: string
  model?: string
  promptTokens?: number
  completionTokens?: number
  totalTokens?: number
  latencyMs?: number
  estimatedCost?: number
  actualCost?: number
  currency: string
  status: string       // success, failed, rate_limited
  executionId?: string
  metadata?: string    // JSON
  createdAt: Date
}

// ─── Resource Cost ───

export interface ResourceCost {
  id: string
  resourceId: string
  tenantId: string
  workspaceId?: string
  billingPeriod: string   // daily, monthly
  totalCost: number
  currency: string
  metadata?: string       // JSON
  periodStart: Date
  periodEnd: Date
  createdAt: Date
  updatedAt: Date
}

// ─── Resolve Request / Response ───

export interface ResolveRequest {
  capabilityName: string
  strategy: string         // quality-first, cost-first, latency-first, balanced
  tenantId: string
  workspaceId?: string
  context?: Partial<PlatformContext>
  options?: {
    maxCost?: number
    maxLatencyMs?: number
    minQuality?: number     // 0-1
    preferredVendors?: string[]
    preferredModels?: string[]
  }
}

export interface ResolveResponse {
  resource: ResourceContract
  credential: ResourceCredential
  resolvedStrategy: string
  resolveTimeMs: number
  confidence: number       // 0-1
  alternatives?: Array<{
    resource: ResourceContract
    reason: string
  }>
}

// ─── Streaming Interface ───

export interface StreamingChunk {
  id: string
  type: 'text' | 'json' | 'error' | 'done'
  data: any
  timestamp: string
  metadata?: Record<string, any>
}

export interface StreamingInterface {
  /**
   * Start streaming from the given resource and credential.
   * Returns an async generator of chunks.
   */
  stream(
    resource: ResourceContract,
    credential: ResourceCredential,
    input: Record<string, any>,
    ctx?: PlatformContext
  ): AsyncGenerator<StreamingChunk, void, undefined>

  /**
   * Cancel an active stream by session ID.
   */
  cancel(sessionId: string, ctx?: PlatformContext): Promise<void>

  /**
   * Resume a cancelled/paused stream by session ID.
   */
  resume(sessionId: string, ctx?: PlatformContext): Promise<AsyncGenerator<StreamingChunk, void, undefined> | null>
}

// ─── Resource Registry Interface ───

export interface ResourcePlugin {
  name: string
  type: 'resource'
  resourceType: string
  vendor: string
  execute(input: any, ctx?: any): Promise<any>
}

// ─── Resolver Strategy ───

export interface ResolverStrategy {
  name: string
  description: string
  score(
    resource: ResourceContract,
    matrix: ResourceCapabilityMatrix | null,
    health: ResourceHealth | null,
    context: ResolveRequest
  ): number
}
