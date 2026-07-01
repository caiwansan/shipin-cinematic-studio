// ============================================================
// ExplainRegistry — Register all ExplainProviders
// RC1-T004: Explain Everywhere
// ============================================================

import type { ExplainProvider } from './types.js';

export class ExplainRegistry {
  private providers: Map<string, ExplainProvider> = new Map();

  register(provider: ExplainProvider): void {
    this.providers.set(provider.type, provider);
  }

  getProvider(type: string): ExplainProvider | undefined {
    return this.providers.get(type);
  }

  getAllProviders(): ExplainProvider[] {
    return Array.from(this.providers.values());
  }
}
