// ════════════════════════════════════════════════════════════
// K4 RC2 Sprint 4A — HTTP Provider Interface
// ════════════════════════════════════════════════════════════
// Generic HTTP communication layer.
// CMS Adapters (WordPress, Ghost, Strapi) extend this.
//
// HTTPAdapter handles: request, auth, retry, timeout, multipart
// CMSAdapter (future) handles: content model (pages, posts, media)
// Provider handles: platform API differences
// ════════════════════════════════════════════════════════════

export interface HTTPProviderConfig {
  baseUrl: string
  auth?: {
    type: 'basic' | 'bearer' | 'api_key' | 'oauth2'
    username?: string
    password?: string
    token?: string
    apiKey?: string
    apiKeyHeader?: string
  }
  headers?: Record<string, string>
  timeout?: number          // ms
  retryMax?: number         // max retries
  retryDelay?: number       // ms between retries
}

export interface HTTPRequestOptions {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  path: string
  body?: string | Buffer | object
  contentType?: string
  headers?: Record<string, string>
  queryParams?: Record<string, string>
}

export interface HTTPResponse {
  statusCode: number
  headers: Record<string, string>
  body: string
  bodyJson?: any
  etag?: string
}

export interface HTTPProvider {
  readonly name: string    // 'generic' | 'wordpress' | 'ghost' | 'strapi' | 'contentful'

  /** Authenticate and verify endpoint reachable */
  authenticate(config: HTTPProviderConfig): Promise<boolean>

  /** Build and send an HTTP request */
  send(config: HTTPProviderConfig, opts: HTTPRequestOptions): Promise<HTTPResponse>

  /** Verify a previous response (checksum, etag, status) */
  verifyResponse(response: HTTPResponse, expected?: any): Promise<{ valid: boolean; errors: string[] }>

  /** Health check */
  health(config: HTTPProviderConfig): Promise<{ ok: boolean; latencyMs: number; message?: string }>

  /** Check if provider supports streaming */
  supportsStreaming(): boolean
  /** Check if provider supports multipart */
  supportsMultipart(): boolean
}

// ─── Capability Negotiation (Sprint 4) ───
// Runtime can check adapter capabilities before executing any step.
// No hardcoded platform checks. All discovery is via AdapterCapability enum.
//
// Example:
//   if (adapter.meta.capabilities.includes(AdapterCapability.Preview)) {
//     const url = await adapter.preview(pkg)
//   }
//
// This is already supported via the `meta.capabilities` field on DeliveryAdapter.
// New capabilities added to AdapterCapability enum above are automatically discovered.
