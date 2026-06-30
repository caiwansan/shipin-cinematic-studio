// ════════════════════════════════════════════════════════════
// K4 RC2 Sprint 4A — Generic HTTP Provider
// ════════════════════════════════════════════════════════════
// Universal HTTP client for delivering KnowledgePackages.
// Supports basic auth, bearer token, API key auth.
// CMS providers (WordPress, Ghost, Strapi) extend this pattern.
// ════════════════════════════════════════════════════════════

import { execSync } from 'child_process'
import {
  HTTPProvider, HTTPProviderConfig,
  HTTPRequestOptions, HTTPResponse,
} from './http-provider'

export class GenericHTTPProvider implements HTTPProvider {
  readonly name = 'generic'

  async authenticate(config: HTTPProviderConfig): Promise<boolean> {
    try {
      const curl = this.buildCurl(config, { method: 'GET', path: '/' })
      const result = execSync(curl + ' -o /dev/null -w "%{http_code}"', { stdio: 'pipe', timeout: 10000 }).toString().trim()
      const code = parseInt(result, 10)
      return code >= 200 && code < 500
    } catch {
      return false
    }
  }

  async send(config: HTTPProviderConfig, opts: HTTPRequestOptions): Promise<HTTPResponse> {
    const curl = this.buildCurl(config, opts)

    try {
      const fullCmd = `${curl} -s -D -`
      const raw = execSync(fullCmd, { stdio: 'pipe', timeout: config.timeout || 30000 }).toString()

      // Split headers from body
      const parts = raw.split('\r\n\r\n')
      const headerLines = parts[0].split('\r\n')
      const body = parts.slice(1).join('\r\n\r\n').trim()

      // Parse status code
      const statusLine = headerLines[0]
      const statusCode = parseInt(statusLine.split(' ')[1], 10) || 0

      // Parse headers
      const headers: Record<string, string> = {}
      const etag = headerLines
        .find((h: string) => h.toLowerCase().startsWith('etag:'))
        ?.split(':')[1]?.trim()

      for (const line of headerLines.slice(1)) {
        const colonIdx = line.indexOf(':')
        if (colonIdx > 0) {
          headers[line.substring(0, colonIdx).toLowerCase()] = line.substring(colonIdx + 1).trim()
        }
      }

      const response: HTTPResponse = {
        statusCode,
        headers,
        body,
        bodyJson: undefined,
        etag,
      }

      // Try JSON parse
      const ct = (headers['content-type'] || '').toLowerCase()
      if (ct.includes('application/json') && body.length > 0) {
        try { response.bodyJson = JSON.parse(body) } catch {}
      }

      return response
    } catch (err: any) {
      return {
        statusCode: 0,
        headers: {},
        body: '',
        bodyJson: null,
      }
    }
  }

  async verifyResponse(response: HTTPResponse, expected?: any): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = []

    if (response.statusCode === 0) {
      errors.push('No response received (connection failed)')
      return { valid: false, errors }
    }

    if (response.statusCode >= 400) {
      errors.push(`HTTP ${response.statusCode}: ${response.body.substring(0, 200)}`)
    }

    if (expected?.contentSha256 && response.etag) {
      // Some platforms return etag = SHA256
      const cleanEtag = response.etag.replace(/"/g, '')
      if (cleanEtag !== expected.contentSha256) {
        errors.push(`ETag mismatch: expected ${expected.contentSha256}, got ${cleanEtag}`)
      }
    }

    return { valid: errors.length === 0, errors }
  }

  async health(config: HTTPProviderConfig): Promise<{ ok: boolean; latencyMs: number; message?: string }> {
    const start = Date.now()
    const ok = await this.authenticate(config)
    return {
      ok,
      latencyMs: Date.now() - start,
      message: ok ? `HTTP endpoint reachable: ${config.baseUrl}` : `Cannot reach: ${config.baseUrl}`,
    }
  }

  supportsStreaming(): boolean {
    return false
  }

  supportsMultipart(): boolean {
    return true
  }

  // ─── Private ───

  private buildCurl(config: HTTPProviderConfig, opts: HTTPRequestOptions): string {
    let curl = `curl -X ${opts.method}`

    // Auth headers
    if (config.auth) {
      switch (config.auth.type) {
        case 'basic':
          curl += ` -u "${config.auth.username}:${config.auth.password}"`
          break
        case 'bearer':
          curl += ` -H "Authorization: Bearer ${config.auth.token}"`
          break
        case 'api_key':
          const headerName = config.auth.apiKeyHeader || 'X-Api-Key'
          curl += ` -H "${headerName}: ${config.auth.apiKey}"`
          break
      }
    }

    // Custom headers
    if (config.headers) {
      for (const [k, v] of Object.entries(config.headers)) {
        curl += ` -H "${k}: ${v}"`
      }
    }

    // Request headers
    if (opts.headers) {
      for (const [k, v] of Object.entries(opts.headers)) {
        curl += ` -H "${k}: ${v}"`
      }
    }

    // Content type
    const ct = opts.contentType || 'application/json'
    curl += ` -H "Content-Type: ${ct}"`

    // Query params
    let path = opts.path
    if (opts.queryParams && Object.keys(opts.queryParams).length > 0) {
      const qs = Object.entries(opts.queryParams)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join('&')
      path += (path.includes('?') ? '&' : '?') + qs
    }

    // Body
    if (opts.body) {
      const bodyStr = typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body)
      curl += ` -d '${bodyStr.replace(/'/g, "'\\''")}'`
    }

    curl += ` "${config.baseUrl}${path}"`

    return curl
  }
}
