// ════════════════════════════════════════════════════════════
// K4 RC2 Sprint 2 — GitLab Provider
// ════════════════════════════════════════════════════════════
// Handles GitLab-specific auth, repo management, and API interactions.
// Supports both gitlab.com and self-hosted GitLab instances.
// ════════════════════════════════════════════════════════════

import { execSync } from 'child_process'
import { GitProvider, GitProviderConfig } from './git-provider'

export class GitLabProvider implements GitProvider {
  readonly name = 'gitlab'

  async authenticate(config: GitProviderConfig): Promise<boolean> {
    try {
      const token = config.auth.token
      const baseUrl = this.getBaseUrl(config.repoUrl)
      const apiUrl = `${baseUrl}/api/v4/user`
      const result = execSync(
        `curl -s -o /dev/null -w "%{http_code}" -H "PRIVATE-TOKEN: ${token}" ${apiUrl}`,
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
      const baseUrl = this.getBaseUrl(config.repoUrl)
      const { projectPath } = this.parseRepoUrl(config.repoUrl)
      const encodedPath = encodeURIComponent(projectPath)
      const apiUrl = `${baseUrl}/api/v4/projects/${encodedPath}`
      const result = execSync(
        `curl -s -o /dev/null -w "%{http_code}" -H "PRIVATE-TOKEN: ${token}" ${apiUrl}`,
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
      const baseUrl = this.getBaseUrl(config.repoUrl)
      const { projectPath } = this.parseRepoUrl(config.repoUrl)
      const name = projectPath.split('/').pop() || 'brand-site'
      const apiUrl = `${baseUrl}/api/v4/projects`
      const body = JSON.stringify({ name, visibility: 'public' })
      const result = execSync(
        `curl -s -o /dev/null -w "%{http_code}" -X POST -H "PRIVATE-TOKEN: ${token}" -H "Content-Type: application/json" -d '${body}' ${apiUrl}`,
        { stdio: 'pipe', timeout: 10000 }
      ).toString().trim()
      return result === '201'
    } catch {
      return false
    }
  }

  buildRemoteUrl(config: GitProviderConfig): string {
    const token = config.auth.token
    const baseUrl = this.getBaseUrl(config.repoUrl).replace('https://', '')
    const { projectPath } = this.parseRepoUrl(config.repoUrl)
    return `https://oauth2:${token}@${baseUrl}/${projectPath}.git`
  }

  async getDefaultBranch(config: GitProviderConfig): Promise<string> {
    try {
      const token = config.auth.token
      const baseUrl = this.getBaseUrl(config.repoUrl)
      const { projectPath } = this.parseRepoUrl(config.repoUrl)
      const encodedPath = encodeURIComponent(projectPath)
      const apiUrl = `${baseUrl}/api/v4/projects/${encodedPath}`
      const result = execSync(
        `curl -s -H "PRIVATE-TOKEN: ${token}" ${apiUrl}`,
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
      message: ok ? 'GitLab API reachable' : 'GitLab auth failed',
    }
  }

  private getBaseUrl(url: string): string {
    // Supports: https://gitlab.com/owner/repo.git, git@gitlab.com:owner/repo.git
    const match = url.match(/(https?:\/\/)?([^\/:]+)/)
    if (!match) return 'https://gitlab.com'
    const host = match[2]
    // If it's a raw hostname (git@...), prepend https
    if (host.includes('@')) {
      const cleanHost = host.split('@').pop() || host
      return `https://${cleanHost}`
    }
    // If match[1] is empty, prepend https
    if (!match[1]) return `https://${host}`
    return `https://${host}`
  }

  private parseRepoUrl(url: string): { projectPath: string } {
    // Supports:
    //   https://gitlab.com/group/subgroup/repo.git
    //   git@gitlab.com:group/subgroup/repo.git
    const match = url.match(/(?:gitlab\.com[\s\S]*?[/:])|(?:[\w.-]+\/)((?:\w[\w.-]*\/)*\w[\w.-]*?)(?:\.git)?$/)
    const parts = url.split(/\/\/|@|:/)
    const pathPart = url.split(/github\.com[/:]|gitlab\.com[/:]|gitea\.com[/:]/)
    if (pathPart.length < 2) throw new Error(`Cannot parse GitLab repo URL: ${url}`)
    const projectPath = pathPart[1].replace(/\.git$/, '')
    return { projectPath }
  }
}
