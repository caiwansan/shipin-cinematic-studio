import path from 'path'
import fs from 'fs'
import type { Probe } from '../monitor.types'

export class ProbeRegistry {
  private probes = new Map<string, Probe>()

  register(probe: Probe): void {
    if (this.probes.has(probe.name)) {
      throw new Error(`Probe '${probe.name}' already registered`)
    }
    this.probes.set(probe.name, probe)
  }

  resolve(name: string): Probe {
    const probe = this.probes.get(name)
    if (!probe) throw new Error(`No probe found for '${name}'`)
    return probe
  }

  list(): Probe[] {
    return Array.from(this.probes.values())
  }

  findSupports(targetType: string): Probe[] {
    return this.list().filter(p => p.supports(targetType))
  }

  getNames(): string[] {
    return Array.from(this.probes.keys())
  }

  /**
   * Auto-discover and register all probes in the probes/ directory.
   */
  async discover(): Promise<void> {
    const probesDir = path.join(__dirname)
    if (!fs.existsSync(probesDir)) return
    const files = fs.readdirSync(probesDir).filter(f => f.endsWith('.ts') || f.endsWith('.js'))

    for (const file of files) {
      if (file === 'probe-registry.ts' || file === 'probe-registry.js') continue
      try {
        const module = await import(path.join(probesDir, file))
        if (module.probe && typeof module.probe.name === 'string') {
          this.register(module.probe)
        }
      } catch (err: any) {
        console.warn(`[ProbeRegistry] Failed to load probe ${file}: ${err.message}`)
      }
    }
  }
}

export const probeRegistry = new ProbeRegistry()
