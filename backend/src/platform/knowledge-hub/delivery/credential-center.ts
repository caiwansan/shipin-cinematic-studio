// ════════════════════════════════════════════════════════════
// K4 RC2 Sprint 1 — Credential Center
// ════════════════════════════════════════════════════════════
// Unified credential management for all DeliveryAdapters.
// Adapters never handle raw credentials directly.
// CredentialCenter resolves credential IDs → resolved values.
// ════════════════════════════════════════════════════════════

export interface CredentialRecord {
  id: string
  name: string
  type: string                // 'token' | 'basic_auth' | 'ssh_key' | 'oauth' | 'api_key'
  provider: string            // 'github' | 'gitlab' | 'aws' | 'aliyun' | etc.
  values: Record<string, string>   // e.g., { token: 'xxx' }, { accessKey: 'xxx', secretKey: 'xxx' }
  masked: Record<string, string>   // Masked values for display
  createdAt: string
  updatedAt: string
}

export interface CredentialResolveResult {
  success: boolean
  credentials: Record<string, string>
  error?: string
}

export class CredentialCenter {
  private secrets = new Map<string, CredentialRecord>()

  /**
   * Store a credential.
   */
  store(record: CredentialRecord): void {
    this.secrets.set(record.id, record)
    const masked: Record<string, string> = {}
    for (const [k, v] of Object.entries(record.values)) {
      masked[k] = v.length > 8 ? v.substring(0, 4) + '...' + v.substring(v.length - 4) : '****'
    }
    record.masked = masked
    console.log(`[CredentialCenter] Stored: ${record.name} (${record.type} / ${record.provider})`)
  }

  /**
   * Resolve a credential ID to actual values.
   * This is the only way adapters get credentials.
   */
  resolve(credentialId: string): CredentialResolveResult {
    const record = this.secrets.get(credentialId)
    if (!record) {
      return { success: false, credentials: {}, error: `Credential not found: ${credentialId}` }
    }
    return { success: true, credentials: { ...record.values } }
  }

  /**
   * Resolve credentials from an adapter config (which uses credential IDs).
   */
  resolveFromConfig(config: Record<string, any>): CredentialResolveResult {
    const result: Record<string, string> = {}

    for (const [key, value] of Object.entries(config)) {
      // Values that look like credential references
      if (typeof value === 'string' && value.startsWith('cred:')) {
        const credId = value.substring(5)
        const resolved = this.resolve(credId)
        if (!resolved.success) {
          return { success: false, credentials: {}, error: resolved.error }
        }
        Object.assign(result, resolved.credentials)
      } else if (typeof value === 'string') {
        result[key] = value
      }
    }

    return { success: true, credentials: result }
  }

  /**
   * List all stored credentials (masked).
   */
  list(): CredentialRecord[] {
    return Array.from(this.secrets.values()).map(r => ({
      ...r,
      values: { ...r.masked },
    }))
  }

  /**
   * Delete a credential.
   */
  delete(id: string): boolean {
    return this.secrets.delete(id)
  }
}
