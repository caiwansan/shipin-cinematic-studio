// ============================================================
// Prompt Registry — KMKI-RUNTIME-006
// 通用 Prompt Registry + Loader + Renderer
// 升级自 geo-prompt-registry.ts，支持版本化 + 文件加载
// ============================================================

/** Prompt 定义 */
export interface PromptSpec {
  key: string
  version: string
  system: string
  user?: string
  metadata?: {
    description?: string
    capabilities?: string[]
    author?: string
    updatedAt?: string
  }
}

/** 渲染参数 */
export interface PromptRenderContext {
  [key: string]: string | number | boolean | string[] | undefined | null
}

class PromptRegistry {
  private prompts = new Map<string, PromptSpec>()

  /** 注册 Prompt */
  register(spec: PromptSpec): void {
    const key = `${spec.key}@${spec.version}`
    this.prompts.set(key, spec)

    // 同时保留最新版本的无版本号 key
    this.prompts.set(spec.key, spec)
    console.log(`[PromptRegistry] Registered: ${key}`)
  }

  /** 获取 Prompt */
  get(key: string, version?: string): PromptSpec | undefined {
    const lookupKey = version ? `${key}@${version}` : key
    return this.prompts.get(lookupKey)
  }

  /** 获取最新版本号 */
  getLatestVersion(key: string): string | undefined {
    // 查找以 key@ 开头的所有条目，取最新
    let latest: { version: string; updatedAt?: string } | undefined
    for (const [k, spec] of this.prompts) {
      if (k.startsWith(`${key}@`)) {
        if (!latest || (spec.metadata?.updatedAt && spec.metadata.updatedAt > latest.updatedAt!)) {
          latest = { version: spec.version, updatedAt: spec.metadata?.updatedAt }
        }
      }
    }
    return latest?.version
  }

  /**
   * 渲染 Prompt：替换 {variable} 占位符
   * 支持 Fallback：{key} 未提供时替换为空字符串
   */
  render(key: string, ctx: PromptRenderContext, version?: string): { system: string; user?: string } {
    const spec = this.get(key, version)
    if (!spec) {
      throw new Error(`[PromptRegistry] Unknown prompt key: ${key}${version ? `@${version}` : ''}`)
    }

    const render = (template: string): string => {
      return template.replace(/\{(\w+)\}/g, (_, vKey: string) => {
        const val = ctx[vKey]
        if (val === undefined || val === null) return ''
        if (Array.isArray(val)) return val.join('\n')
        return String(val)
      })
    }

    return {
      system: render(spec.system),
      user: spec.user ? render(spec.user) : undefined,
    }
  }

  /** 列出所有已注册的 prompt key */
  listKeys(): string[] {
    return Array.from(this.prompts.keys()).filter((k) => !k.includes('@'))
  }

  /** 列出某个 key 的所有版本 */
  listVersions(key: string): string[] {
    return Array.from(this.prompts.keys())
      .filter((k) => k.startsWith(`${key}@`))
      .map((k) => k.split('@')[1])
  }
}

export const promptRegistry = new PromptRegistry()
