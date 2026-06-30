import path from 'path'
import fs from 'fs'
import type { SignalProvider } from '../learning.types'

export class SignalRegistry {
  private providers = new Map<string, SignalProvider>()

  register(provider: SignalProvider): void {
    if (this.providers.has(provider.name)) {
      throw new Error(`Signal provider '${provider.name}' already registered`)
    }
    this.providers.set(provider.name, provider)
  }

  resolve(name: string): SignalProvider {
    const provider = this.providers.get(name)
    if (!provider) throw new Error(`No signal provider found for '${name}'`)
    return provider
  }

  list(): SignalProvider[] {
    return Array.from(this.providers.values())
  }

  findSupports(industry?: string, optimizationType?: string): SignalProvider[] {
    return this.list().filter(p => p.supports(industry, optimizationType))
  }

  getNames(): string[] {
    return Array.from(this.providers.keys())
  }

  /**
   * Auto-discover and register all normalizers in the normalizers/ directory.
   */
  async discover(): Promise<void> {
    const dir = path.join(__dirname)
    if (!fs.existsSync(dir)) return
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.ts') || f.endsWith('.js'))

    for (const file of files) {
      if (file === 'signal-registry.ts' || file === 'signal-registry.js') continue
      try {
        const module = await import(path.join(dir, file))
        if (module.provider && typeof module.provider.name === 'string') {
          this.register(module.provider)
        }
      } catch (err: any) {
        console.warn(`[SignalRegistry] Failed to load provider ${file}: ${err.message}`)
      }
    }
  }
}

export const signalRegistry = new SignalRegistry()
