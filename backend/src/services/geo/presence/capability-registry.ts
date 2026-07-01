// ============================================================
// AI Presence Engine — CapabilityRegistry
// P0-T005.1: 12 Platform Extension
//
// Registry pattern: All platforms register their capabilities here.
// CapabilityRegistry acts as a queryable catalog of what each
// AI platform can do (presence detection, verification, publishing, citation).
// ============================================================

export interface CapabilityInfo {
  provider: string
  supportsPresence: boolean
  supportsVerification: boolean
  supportsPublishing: boolean
  supportsCitation: boolean
}

export class CapabilityRegistry {
  private capabilities: Map<string, CapabilityInfo> = new Map()

  register(provider: string, info: Partial<CapabilityInfo>): void {
    const existing = this.capabilities.get(provider) || {
      provider,
      supportsPresence: false,
      supportsVerification: false,
      supportsPublishing: false,
      supportsCitation: false,
    }
    this.capabilities.set(provider, {
      ...existing,
      provider,
      supportsPresence: info.supportsPresence ?? existing.supportsPresence,
      supportsVerification: info.supportsVerification ?? existing.supportsVerification,
      supportsPublishing: info.supportsPublishing ?? existing.supportsPublishing,
      supportsCitation: info.supportsCitation ?? existing.supportsCitation,
    })
  }

  get(provider: string): CapabilityInfo {
    return this.capabilities.get(provider) || {
      provider,
      supportsPresence: false,
      supportsVerification: false,
      supportsPublishing: false,
      supportsCitation: false,
    }
  }

  getAll(): CapabilityInfo[] {
    return Array.from(this.capabilities.values())
  }

  getWithCapability(cap: keyof CapabilityInfo): string[] {
    return this.getAll()
      .filter((info) => info[cap] === true)
      .map((info) => info.provider)
  }
}

// Singleton
export const capabilityRegistry = new CapabilityRegistry()

// Register all 12 platforms with their capabilities
capabilityRegistry.register('chatgpt', {
  supportsPresence: true,
  supportsVerification: false,
  supportsPublishing: false,
  supportsCitation: true,
})

capabilityRegistry.register('gemini', {
  supportsPresence: true,
  supportsVerification: false,
  supportsPublishing: false,
  supportsCitation: true,
})

capabilityRegistry.register('claude', {
  supportsPresence: true,
  supportsVerification: false,
  supportsPublishing: false,
  supportsCitation: true,
})

capabilityRegistry.register('deepseek', {
  supportsPresence: true,
  supportsVerification: false,
  supportsPublishing: false,
  supportsCitation: false,
})

capabilityRegistry.register('perplexity', {
  supportsPresence: true,
  supportsVerification: false,
  supportsPublishing: false,
  supportsCitation: true,
})

capabilityRegistry.register('copilot', {
  supportsPresence: true,
  supportsVerification: false,
  supportsPublishing: false,
  supportsCitation: true,
})

capabilityRegistry.register('doubao', {
  supportsPresence: true,
  supportsVerification: false,
  supportsPublishing: false,
  supportsCitation: false,
})

capabilityRegistry.register('tongyi', {
  supportsPresence: true,
  supportsVerification: false,
  supportsPublishing: false,
  supportsCitation: false,
})

capabilityRegistry.register('wenxin', {
  supportsPresence: true,
  supportsVerification: false,
  supportsPublishing: false,
  supportsCitation: false,
})

capabilityRegistry.register('yuanbao', {
  supportsPresence: true,
  supportsVerification: false,
  supportsPublishing: false,
  supportsCitation: false,
})

capabilityRegistry.register('kimi', {
  supportsPresence: true,
  supportsVerification: false,
  supportsPublishing: false,
  supportsCitation: false,
})

capabilityRegistry.register('xinghuo', {
  supportsPresence: true,
  supportsVerification: false,
  supportsPublishing: false,
  supportsCitation: false,
})
