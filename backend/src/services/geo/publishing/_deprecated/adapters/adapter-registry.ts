import path from 'path'
import fs from 'fs'
import type { PublishingAdapter } from '../publishing.types'

export class PublishingAdapterRegistry {
  private adapters = new Map<string, PublishingAdapter>()

  register(adapter: PublishingAdapter): void {
    if (this.adapters.has(adapter.platform)) {
      throw new Error(`Adapter '${adapter.platform}' already registered`)
    }
    this.adapters.set(adapter.platform, adapter)
  }

  resolve(platform: string): PublishingAdapter {
    const adapter = this.adapters.get(platform)
    if (!adapter) {
      throw new Error(`No adapter found for platform '${platform}'`)
    }
    return adapter
  }

  list(): PublishingAdapter[] {
    return Array.from(this.adapters.values())
  }

  findSupports(contentType: string): PublishingAdapter[] {
    return this.list().filter(a => a.supports(contentType))
  }

  getPlatforms(): string[] {
    return Array.from(this.adapters.keys())
  }

  /**
   * Auto-discover and register all adapters in the adapters/ directory.
   * Each adapter file should export an `adapter` object that implements PublishingAdapter.
   */
  async discover(): Promise<void> {
    const adaptersDir = path.join(__dirname, 'adapters')
    if (!fs.existsSync(adaptersDir)) return

    const files = fs.readdirSync(adaptersDir).filter(f => f.endsWith('.ts') || f.endsWith('.js'))

    for (const file of files) {
      try {
        const module = await import(path.join(adaptersDir, file))
        if (module.adapter && typeof module.adapter.platform === 'string') {
          this.register(module.adapter)
        }
        if (module.default && typeof module.default.platform === 'string') {
          this.register(module.default)
        }
      } catch (err: any) {
        console.warn(`[PublishingAdapterRegistry] Failed to load adapter ${file}: ${err.message}`)
      }
    }
  }
}

export const publishingAdapterRegistry = new PublishingAdapterRegistry()
