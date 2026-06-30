import type { Probe, ProbeTarget, ProbeResult } from '../monitor.types'

export const probe: Probe = {
  name: 'sitemap',
  type: 'structure',

  supports(targetType: string): boolean {
    return targetType === 'sitemap' || targetType === 'seo'
  },

  async execute(target: ProbeTarget): Promise<ProbeResult> {
    const url = target.url
    if (!url) return { success: false, error: 'No URL provided', checkedAt: new Date() }

    // Phase 1: Check if sitemap URL is reachable
    // Phase 2: Parse sitemap and validate entries
    try {
      const response = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(10000) })
      const isXML = response.headers.get('content-type')?.includes('xml')
      return {
        success: response.ok && !!isXML,
        statusCode: response.status,
        details: { isXML, contentType: response.headers.get('content-type') },
        checkedAt: new Date(),
      }
    } catch (err: any) {
      return { success: false, error: err.message, checkedAt: new Date() }
    }
  },
}
