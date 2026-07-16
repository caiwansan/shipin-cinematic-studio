/**
 * narrative-config.ts — NOS Runtime 全局配置
 *
 * 只控制 **消费路径**（Writer/Planner 用什么数据源）。
 * 不影响 Runtime / Story Librarian / Snapshot Engine / Integrity Checker 的运行。
 *
 * 生命周期：LEGACY → DUAL → SNAPSHOT → Deprecated → Delete
 *
 * 环境变量：NOS_RUNTIME_CONFIG=writer:DUAL,planner:SNAPSHOT,librarian:ENABLED
 * 配置文件：data/runtime/narrative/config.json
 */

export type WriterMode = 'LEGACY' | 'DUAL' | 'SNAPSHOT'
export type PlannerMode = 'LEGACY' | 'DUAL' | 'SNAPSHOT'
export type LibrarianMode = 'ENABLED' | 'DISABLED'

export interface NarrativeRuntimeConfig {
  /** Writer 消费模式 */
  writerMode: WriterMode
  /** Planner 消费模式（预留 Phase 3.3） */
  plannerMode: PlannerMode
  /** Story Librarian 开关（预留） */
  librarianMode: LibrarianMode
  /** Snapshot 验证开关 */
  snapshotVerification: boolean
}

const DEFAULT_CONFIG: NarrativeRuntimeConfig = {
  writerMode: 'DUAL',
  plannerMode: 'LEGACY',
  librarianMode: 'ENABLED',
  snapshotVerification: true,
}

class NarrativeConfigManager {
  private config: NarrativeRuntimeConfig = { ...DEFAULT_CONFIG }
  private loaded = false

  get writerMode(): WriterMode {
    this.ensureLoaded()
    return this.config.writerMode
  }

  set writerMode(mode: WriterMode) {
    this.config.writerMode = mode
  }

  get plannerMode(): PlannerMode {
    this.ensureLoaded()
    return this.config.plannerMode
  }

  get librarianMode(): LibrarianMode {
    this.ensureLoaded()
    return this.config.librarianMode
  }

  get snapshotVerification(): boolean {
    this.ensureLoaded()
    return this.config.snapshotVerification
  }

  /**
   * 获取完整配置对象（调试/日志用）
   */
  getConfig(): NarrativeRuntimeConfig {
    this.ensureLoaded()
    return { ...this.config }
  }

  /**
   * 确保配置已加载（供外部 await 使用）
   * bootstrap 调用此方法后再调 getStartupLog 保证拿到真实值
   */
  async ensureConfigLoaded(): Promise<void> {
    await this.ensureLoaded()
  }

  /**
   * 输出启动时的配置摘要
   * ⚠️ 调用方必须先 await ensureConfigLoaded()，否则可能看到默认值
   * ⚠️ 内部不能调 ensureLoaded() — 否则 ensureLoaded 里调 getStartupLog 形成无限递归
   */
  getStartupLog(): string {
    const c = this.config
    return `writer=${c.writerMode} | planner=${c.plannerMode} | librarian=${c.librarianMode} | verification=${c.snapshotVerification}`
  }

  private async ensureLoaded(): Promise<void> {
    if (this.loaded) return

    // 1. 环境变量优先 (NOS_RUNTIME_CONFIG=writer:SNAPSHOT,planner:LEGACY,librarian:ENABLED)
    const envStr = process.env.NOS_RUNTIME_CONFIG
    if (envStr) {
      const parts = envStr.split(',').map(s => s.trim())
      for (const part of parts) {
        const [key, val] = part.split(':').map(s => s.trim().toUpperCase())
        switch (key) {
          case 'WRITER':
            if (['LEGACY', 'DUAL', 'SNAPSHOT'].includes(val)) this.config.writerMode = val as WriterMode
            break
          case 'PLANNER':
            if (['LEGACY', 'DUAL', 'SNAPSHOT'].includes(val)) this.config.plannerMode = val as PlannerMode
            break
          case 'LIBRARIAN':
            if (['ENABLED', 'DISABLED'].includes(val)) this.config.librarianMode = val as LibrarianMode
            break
          case 'VERIFICATION':
            if (val === 'TRUE') this.config.snapshotVerification = true
            if (val === 'FALSE') this.config.snapshotVerification = false
            break
        }
      }
      console.log(`[NOS/Config] loaded from env: ${this.getStartupLog()}`)
    }

    // 2. 尝试从 data 目录加载配置文件（运行时更新，无需重启）
    const pathName = 'data/runtime/narrative/config.json'
    try {
      const fs = await import('fs')
      if (fs.existsSync(pathName)) {
        const raw = JSON.parse(fs.readFileSync(pathName, 'utf-8'))
        if (raw.writerMode && ['LEGACY', 'DUAL', 'SNAPSHOT'].includes(raw.writerMode)) this.config.writerMode = raw.writerMode
        if (raw.plannerMode && ['LEGACY', 'DUAL', 'SNAPSHOT'].includes(raw.plannerMode)) this.config.plannerMode = raw.plannerMode
        if (raw.librarianMode && ['ENABLED', 'DISABLED'].includes(raw.librarianMode)) this.config.librarianMode = raw.librarianMode
        if (typeof raw.snapshotVerification === 'boolean') this.config.snapshotVerification = raw.snapshotVerification
        console.log(`[NOS/Config] loaded from ${pathName}: ${this.getStartupLog()}`)
      }
    } catch {
      // 配置文件不存在或不合法 — 使用环境变量或默认值
    }

    this.loaded = true
  }

  /**
   * 检查是否允许使用旧路径（Writer 构建完整 Memory/Summary/Character 旧值）
   */
  shouldBuildLegacy(): boolean {
    return this.writerMode !== 'SNAPSHOT'
  }

  /**
   * 检查是否处于 Dual Read 模式（Snapshot 与 Legacy 同时构建，仅对比）
   */
  isDual(): boolean {
    return this.writerMode === 'DUAL'
  }

  /**
   * 检查是否只使用 Snapshot
   */
  isSnapshotOnly(): boolean {
    return this.writerMode === 'SNAPSHOT'
  }
}

export const narrativeConfig = new NarrativeConfigManager()
