// ════════════════════════════════════════════════════════════
// P3 Service: ArtifactRenderer — Claim → Artifact
// ════════════════════════════════════════════════════════════
// Phase 3 — No Vue, no CMS, no UI

import { PublishableClaim, Artifact, ValidationResult } from '../types'
import crypto from 'crypto'

export interface ChannelAdapter {
  readonly name: string
  readonly formats: string[]
  render(claim: PublishableClaim): Artifact
  validate(artifact: Artifact): ValidationResult
  preview(artifact: Artifact): string
  export(artifact: Artifact): string | Buffer
}

// ── Markdown Adapter ──
class MarkdownAdapter implements ChannelAdapter {
  readonly name = 'markdown'
  readonly formats = ['markdown']

  render(claim: PublishableClaim): Artifact {
    return {
      format: 'markdown',
      content: claim.content,
      metadata: {
        title: claim.title,
        contentType: claim.contentType,
        claimId: claim.id,
        version: claim.version,
      },
    }
  }

  validate(artifact: Artifact): ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    if (!artifact.content || artifact.content.trim().length === 0) {
      errors.push('Content is empty')
    }
    if (!artifact.metadata?.title) {
      warnings.push('No title in metadata')
    }

    return { valid: errors.length === 0, errors, warnings }
  }

  preview(artifact: Artifact): string {
    return artifact.content
  }

  export(artifact: Artifact): string {
    const header = `---\ntitle: "${artifact.metadata?.title || ''}"\nversion: "${artifact.metadata?.version || ''}"\n---\n\n`
    return header + artifact.content
  }
}

// ── HTML Preview Adapter ──
class HtmlPreviewAdapter implements ChannelAdapter {
  readonly name = 'html_preview'
  readonly formats = ['html']

  render(claim: PublishableClaim): Artifact {
    const html = this.markdownToHtml(claim.content)
    const fullHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${claim.title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 2rem; line-height: 1.6; color: #333; }
    h1, h2, h3 { color: #1a1a1a; line-height: 1.3; }
    code { background: #f4f4f4; padding: 0.2em 0.4em; border-radius: 3px; font-size: 0.9em; }
    pre { background: #f4f4f4; padding: 1rem; border-radius: 6px; overflow-x: auto; }
    blockquote { border-left: 4px solid #ddd; margin: 0; padding: 0.5em 1em; color: #666; }
    ul, ol { padding-left: 1.5em; }
    img { max-width: 100%; }
  </style>
</head>
<body>
  <h1>${claim.title}</h1>
  ${html}
  <hr>
  <footer style="margin-top: 2rem; font-size: 0.8em; color: #999;">
    <p>Claim: ${claim.id} | Version: ${claim.version} | ${new Date().toLocaleDateString('zh-CN')}</p>
  </footer>
</body>
</html>`

    return {
      format: 'html',
      content: fullHtml,
      metadata: {
        title: claim.title,
        contentType: claim.contentType,
        claimId: claim.id,
        version: claim.version,
      },
    }
  }

  validate(artifact: Artifact): ValidationResult {
    const errors: string[] = []
    if (!artifact.content || !artifact.content.includes('<!DOCTYPE html>')) {
      errors.push('Invalid HTML: missing doctype')
    }
    return { valid: errors.length === 0, errors, warnings: [] }
  }

  preview(artifact: Artifact): string {
    return artifact.content
  }

  export(artifact: Artifact): string {
    return artifact.content
  }

  private markdownToHtml(md: string): string {
    // Basic markdown → HTML for preview
    let html = md
      // Headers
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      // Bold / Italic
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      // Code blocks
      .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      // Links
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
      // Unordered lists
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      // Paragraphs (double newlines)
      .replace(/\n\n/g, '</p><p>')
      // Line breaks
      .replace(/\n/g, '<br>')

    return `<p>${html}</p>`
  }
}

// ── Registry ──
export class ChannelRegistry {
  private adapters: Map<string, ChannelAdapter> = new Map()

  register(adapter: ChannelAdapter): void {
    this.adapters.set(adapter.name, adapter)
  }

  resolve(channel: string): ChannelAdapter {
    const adapter = this.adapters.get(channel)
    if (!adapter) throw new Error(`Unknown channel: ${channel}`)
    return adapter
  }

  list(): ChannelAdapter[] {
    return Array.from(this.adapters.values())
  }

  has(channel: string): boolean {
    return this.adapters.has(channel)
  }
}

// ── Singleton registry with built-in adapters ──
export const channelRegistry = new ChannelRegistry()
channelRegistry.register(new MarkdownAdapter())
channelRegistry.register(new HtmlPreviewAdapter())

// ── Artifact hashing helper ──
export function computeArtifactHash(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex').substring(0, 16)
}
