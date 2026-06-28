/**
 * search.agent.ts — Phase AG-2.3: Intent-aware + Evidence Clustering
 *
 * ═══════════════════════════════════════════════════════════════
 * 接入 Intent Router + Query Expansion
 *
 * 流程:
 *   SearchRequirement
 *     → routeIntent(query) → RouterDecision + ExpansionPolicy
 *     → expandQuery(query, policy) → query variants
 *     → 并行 Bing 搜索所有 variant
 *     → flatten → dedup → UniversalEvidence[]
 *
 * 铁律:
 *   1. 不引入新 source（不接高德/天眼查）
 *   2. 不修改 scoring
 *   3. 不改变 UniversalEvidence schema
 *   4. router 仅控制 expansion + bias，不参与 ranking
 *
 * @phase decision-runtime / ag-2.2
 */

import type { SearchRequirement } from '../../cognition/agent-contract.js'
import { UniversalEvidence } from './universal-evidence.js'
import { routeIntent } from './intent-router.js'
import { expandQuery } from './query-expander.js'
import { clusterEvidence, EvidenceCluster } from './evidence-cluster.js'

export class SearchAgent {
  async search(requirement: SearchRequirement): Promise<UniversalEvidence[]> {
    const allEvidence: UniversalEvidence[] = []
    const seenUrls = new Set<string>()
    const seenTitleSnippet = new Set<string>()

    for (const query of requirement.searchQueries) {
      // Step 1: Intent Router
      const routerDecision = routeIntent(query)
      console.log(`[SearchAgent] route: "${query}" → ${routerDecision.intent} (${routerDecision.reason})`)

      // Step 2: Query Expansion（按 policy 组合模板）
      const variants = expandQuery(query, routerDecision.policy)
      console.log(`[SearchAgent] ${variants.length} variants: ${variants.join(', ')}`)

      // Step 3: 并行搜索所有 variant（最大并发 3，避免 Bing 限流）
      const variantResults = await this.batchSearch(variants, 3)

      for (const result of variantResults) {
        if (result.status !== 'fulfilled') {
          console.warn(`[SearchAgent] variant 搜索失败: ${(result.reason as Error)?.message}`)
          continue
        }
        for (const ev of result.value) {
          const dedupKey = `${ev.title}|${ev.snippet.slice(0, 80)}`
          if (seenUrls.has(ev.url || '') || seenTitleSnippet.has(dedupKey)) continue
          seenUrls.add(ev.url || '')
          seenTitleSnippet.add(dedupKey)
          allEvidence.push(ev)
        }
      }

      // 总证据上限 50 条，防止过度膨胀
      if (allEvidence.length >= 50) break
    }

    // Step 4: Evidence Clustering（AG-2.3）
    const clusters = clusterEvidence(allEvidence)
    console.log(`[SearchAgent] 聚类: ${allEvidence.length} 条 → ${clusters.length} 簇`)
    for (const c of clusters) {
      console.log(`  [${c.clusterId}] ${c.evidenceCount} 条 | intent=${c.intent} | 占比=${(c.confidence * 100).toFixed(0)}%`)
    }

    console.log(`[SearchAgent] 完成: ${requirement.searchQueries.length} 个查询, ${allEvidence.length} 条证据`)
    return allEvidence
  }

  private async searchBing(query: string): Promise<UniversalEvidence[]> {
    const url = `https://cn.bing.com/search?q=${encodeURIComponent(query)}&count=10`

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      },
      signal: AbortSignal.timeout(8000),
    })

    if (!res.ok) throw new Error(`Bing HTTP ${res.status}`)

    const html = await res.text()
    return this.parseBingResults(html)
  }

  private parseBingResults(html: string): UniversalEvidence[] {
    const results: UniversalEvidence[] = []
    const algoBlocks = html.match(/<li[^>]*class="b_algo"[^>]*>.*?<\/li>/gs) || []

    for (const block of algoBlocks) {
      const urlMatch = block.match(/href="(https?:\/\/[^"]+?)"/)
      if (!urlMatch) continue
      const url = urlMatch[1]

      if (url.includes('bing.com') || url.includes('microsoft.com') ||
          url.includes('ad.doubleclick') || url.includes('msn.com')) continue

      const titleMatch = block.match(/<a[^>]*>(.*?)<\/a>/)
      let title = ''
      if (titleMatch) {
        title = titleMatch[1].replace(/<[^>]*>/g, '').trim()
      }
      if (!title) continue

      let snippet = ''
      const pMatch = block.match(/<p[^>]*class="b_lineclamp[^"]*"[^>]*>(.*?)<\/p>/s)
      if (pMatch) {
        snippet = pMatch[1].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
      }
      if (!snippet) {
        const captionMatch = block.match(/<div[^>]*class="b_caption"[^>]*>.*?<p[^>]*>(.*?)<\/p>/s)
        if (captionMatch) {
          snippet = captionMatch[1].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
        }
      }

      if (snippet.length > 300) snippet = snippet.substring(0, 297) + '...'

      results.push({
        sourceType: 'web',
        title,
        snippet: snippet || title,
        url,
      })
    }
    return results
  }

  /**
   * 批量搜索（最大并发 3，避免 Bing 限流）
   */
  private async batchSearch(queries: string[], concurrency: number): Promise<PromiseSettledResult<UniversalEvidence[]>[]> {
    const results: PromiseSettledResult<UniversalEvidence[]>[] = []
    let index = 0

    const worker = async () => {
      while (index < queries.length) {
        const i = index++
        try {
          const value = await this.searchBing(queries[i])
          results[i] = { status: 'fulfilled' as const, value }
        } catch (reason) {
          results[i] = { status: 'rejected' as const, reason }
        }
      }
    }

    const workers = Array.from({ length: Math.min(concurrency, queries.length) }, () => worker())
    await Promise.all(workers)

    return results
  }
}

export const searchAgent = new SearchAgent()
