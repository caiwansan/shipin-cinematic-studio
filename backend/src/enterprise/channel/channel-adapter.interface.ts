/**
 * P4.2.5.2-IMP-01.1 — WeCom SDK Client Foundation
 * 
 * ChannelAdapter<TConfig> 接口冻结 (ARCH-01)
 * WeCom 适配器基础结构
 * 
 * CTO Frozen:
 * - Channel ≠ Business Logic
 * - Provider Isolation
 * - External Data Must Enter Envelope
 */

// ─── Channel Domain Types ──────────────────────────────────

export interface ChannelMessage {
  id: string
  channel: string
  sender: string
  receiver: string
  content: string
  contentType: string
  createdAt: string
  raw?: any
}

export interface InteractionEvent {
  id: string
  channel: string
  type: string
  actor: string
  customer: CustomerIdentity
  payload: any
  timestamp: string
}

export interface CustomerIdentity {
  id: string
  channel: string
  externalId: string
  enterpriseCustomerId?: string
  mappingStatus: 'mapped' | 'pending' | 'unknown'
  displayName?: string
}

export interface ChannelConnection {
  channelAccountId: string
  connected: boolean
  connectedAt?: string
}

export interface ChannelSyncResult {
  channelAccountId: string
  syncedCount: number
  failedCount: number
  startedAt: string
  finishedAt: string
  status: 'success' | 'partial' | 'failed'
}

export interface MessageResult {
  messageId: string
  status: 'sent' | 'failed'
  error?: string
}

export interface ChannelHealth {
  channel: string
  channelAccountId: string
  status: 'connected' | 'expired' | 'rate_limited' | 'error' | 'disconnected'
  expiresAt?: string
  rateLimitRemaining?: number
  errorMessage?: string
  lastSyncAt?: string
}

export enum SyncStatus {
  CONNECTED = 'connected',
  SYNCING = 'syncing',
  FAILED = 'failed',
  DISCONNECTED = 'disconnected',
}

// ─── External Channel Event (raw from WeCom) ───────────────

export interface ExternalChannelEvent {
  channel: string
  eventType: string
  payload: any
  receivedAt: string
}

// ─── ChannelAdapter Interface (ARCH-01 Frozen) ─────────────

export interface ChannelAdapter<TConfig> {
  readonly platform: string

  connect(config: TConfig): Promise<ChannelConnection>
  disconnect(): Promise<void>
  sync(): Promise<ChannelSyncResult>
  send(message: ChannelMessage): Promise<MessageResult>
  receive(event: ExternalChannelEvent): Promise<void>
  health(): Promise<ChannelHealth>
}

// ─── WeCom Config ──────────────────────────────────────────

export interface WeComConfig {
  corpId: string
  corpSecret: string
  agentId: string
  token: string
  encodingAESKey: string
  callbackUrl?: string
}

export interface WeComAccessToken {
  token: string
  expiresAt: number // epoch ms
}
