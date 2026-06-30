// ════════════════════════════════════════════════════════════
// K4 RC2 Sprint 2 — Git Provider Interface
// ════════════════════════════════════════════════════════════
// Each Git Provider implements this.
// GitAdapter orchestrates the common workflow (clone/commit/push).
// Provider only implements the platform-specific differences.
// ════════════════════════════════════════════════════════════

export interface GitProviderConfig {
  repoUrl: string
  defaultBranch: string
  workDir: string              // Local directory for clone
  auth: {
    type: 'ssh_key' | 'token' | 'basic_auth'
    username?: string
    token?: string
    privateKey?: string
  }
}

export interface GitProvider {
  readonly name: string    // 'github' | 'gitlab' | 'gitea'

  /** Authenticate and verify access */
  authenticate(config: GitProviderConfig): Promise<boolean>

  /** Check if repository exists (remote) */
  repositoryExists(config: GitProviderConfig): Promise<boolean>

  /** Create repository if it doesn't exist */
  createRepository(config: GitProviderConfig): Promise<boolean>

  /** Build the remote URL with embedded auth */
  buildRemoteUrl(config: GitProviderConfig): string

  /** Get default branch name */
  getDefaultBranch(config: GitProviderConfig): Promise<string>

  /** Health check: verify Provider API is reachable */
  health(config: GitProviderConfig): Promise<{ ok: boolean; latencyMs: number; message?: string }>
}

// ─── FR-K17 compliance ───
// Git Adapter = type, GitHub/GitLab/Gitea = provider.
// GitAdapter only calls GitProvider methods.
// Platform differences are isolated in the provider implementation.
