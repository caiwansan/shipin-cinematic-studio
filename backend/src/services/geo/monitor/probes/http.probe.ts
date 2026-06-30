import type { Probe, ProbeTarget, ProbeResult } from '../monitor.types'
import http from 'http'
import https from 'https'

export const probe: Probe = {
  name: 'http',
  type: 'reachability',

  supports(targetType: string): boolean {
    return targetType === 'url' || targetType === 'website' || targetType === 'endpoint'
  },

  async execute(target: ProbeTarget): Promise<ProbeResult> {
    const url = target.url
    if (!url) return { success: false, error: 'No URL provided', checkedAt: new Date() }

    const start = Date.now()

    try {
      const { protocol } = new URL(url)
      const client = protocol === 'https:' ? https : http

      return new Promise((resolve) => {
        const req = client.get(url, { timeout: 10000 }, (res) => {
          const latency = Date.now() - start
          resolve({
            success: res.statusCode! >= 200 && res.statusCode! < 400,
            statusCode: res.statusCode,
            latency,
            checkedAt: new Date(),
          })
        })

        req.on('error', (err) => {
          resolve({ success: false, error: err.message, latency: Date.now() - start, checkedAt: new Date() })
        })

        req.on('timeout', () => {
          req.destroy()
          resolve({ success: false, error: 'Request timeout', latency: Date.now() - start, checkedAt: new Date() })
        })
      })
    } catch (err: any) {
      return { success: false, error: err.message, checkedAt: new Date() }
    }
  },
}
