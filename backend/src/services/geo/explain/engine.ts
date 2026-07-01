// ============================================================
// ExplainEngine — Platform layer Explain entry point
// RC1-T004: Explain Everywhere
//
// SSOT: All explain data comes from registered ExplainProviders.
// No page-level explanation, no switch/if-else on type.
// ============================================================

import type { ExplainResult, ExplainProvider } from './types.js';
import { ExplainRegistry } from './registry.js';

export class ExplainEngine {
  constructor(
    private registry: ExplainRegistry,
    private projectRepo: any,
  ) {}

  async explain(type: string, id: string): Promise<ExplainResult> {
    const provider = this.registry.getProvider(type);
    if (!provider) {
      throw new Error(`No ExplainProvider found for type: ${type}`);
    }
    return provider.getExplain(type, id);
  }
}
