// ════════════════════════════════════════════════════════════
// K4 RC2 Sprint 2 — GitHub Provider
// ════════════════════════════════════════════════════════════
// Handles GitHub-specific auth, repo management, and API interactions.
// ════════════════════════════════════════════════════════════

import { execSync } from 'child_process'
import { GitProvider, GitProviderConfig } from './git-provider'

export class GitHubProvider implements GitProvider {
  readonly name = 'github'

  async authenticate(config: GitProviderConfig): Promise<boolean> {
    try {
      const token = config.auth.token
      const testUrl = `https://api.github.com/user`
      const result = execSync(
        `curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer ${token}" ${testUrl}`,
        { stdio: 'pipe', timeout: 10000 }
      ).toString().trim()
      return result === '200'
    } catch {
      return false
    }
  }

  async repositoryExists(config: GitProviderConfig): Promise<boolean> {
    try {
      const token = config.auth.token
      // Extract owner/repo from URL
      const { owner, repo } = this.parseRepoUrl(config.repoUrl)
      const apiUrl = `https://api.github.com/repos/${owner}/${repo}`
      const result = execSync(
        `curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer ${token}" ${apiUrl}`,
        { stdio: 'pipe', timeout: 10000 }
      ).toString().trim()
      return result === '200'
    } catch {
      return false
    }
  }

  async createRepository(config: GitProviderConfig): Promise<boolean> {
    try {
      const token = config.auth.token
      const { owner, repo } = this.parseRepoUrl(config.repoUrl)
      const apiUrl = `https://api.github.com/user/repos`
      const body = JSON.stringify({ name: repo, private: false, auto_init: false })
      const result = execSync(
        `curl -s -o /dev/null -w "%{http_code}" -X POST -H "Authorization: Bearer ${token}" -H "Content-Type: application/json" -d '${body}' ${apiUrl}`,
        { stdio: 'pipe', timeout: 10000 }
      ).toString().trim()
      return result === '201'
    } catch {
      return false
    }
  }

  buildRemoteUrl(config: GitProviderConfig): string {
    // Use HTTPS with token for push
    const token = config.auth.token
    const { owner, repo } = this.parseRepoUrl(config.repoUrl)
    return `https://x-access-token:${token}@github.com/${owner}/${repo}.git`
  }

  async getDefaultBranch(config: GitProviderConfig): Promise<string> {
    try {
      const token = config.auth.token
      const { owner, repo } = this.parseRepoUrl(config.repoUrl)
      const apiUrl = `https://api.github.com/repos/${owner}/${repo}`
      const result = execSync(
        `curl -s -H "Authorization: Bearer ${token}" ${apiUrl}`,
        { stdio: 'pipe', timeout: 10000 }
      ).toString().trim()
      const parsed = JSON.parse(result)
      return parsed.default_branch || 'main'
    } catch {
      return 'main'
    }
  }

  async health(config: GitProviderConfig): Promise<{ ok: boolean; latencyMs: number; message?: string }> {
    const start = Date.now()
    const ok = await this.authenticate(config)
    return {
      ok,
      latencyMs: Date.now() - start,
      message: ok ? 'GitHub API reachable' : 'GitHub auth failed',
    }
  }

  private parseRepoUrl(url: string): { owner: string; repo: string } {
    // Supports: https://github.com/owner/repo.git, git@github.com:owner/repo.git
    const match = url.match(/(?:github\.com[/:])([\w-]+)\/([\w-]+?)(?:\.git)?$/)
    if (!match) throw new Error(`Cannot parse GitHub repo URL: ${url}`)
    return { owner: match[1], repo: match[2] }
  }
}
