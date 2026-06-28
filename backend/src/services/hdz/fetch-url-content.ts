/**
 * fetch-url-content.ts — 抓取线上小说正文内容
 *
 * 接收一个 URL，尝试提取正文（HTML → 纯文本），供文曲星 agent 分析。
 * 不使用外部依赖，纯原生 fetch + 正则。
 */

export interface FetchedContent {
  success: boolean
  title?: string
  content: string
  error?: string
}

/**
 * 抓取并提取指定 URL 的正文内容
 */
export async function fetchUrlContent(url: string): Promise<FetchedContent> {
  try {
    const resp = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(15000),
    })

    if (!resp.ok) {
      return { success: false, content: '', error: `HTTP ${resp.status}` }
    }

    const html = await resp.text()

    // 尝试提取 title
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
    const title = titleMatch ? titleMatch[1].trim() : undefined

    // 提取正文：先找 <article>，否则找所有 <p>，否则去掉 script/style 后取文本
    let bodyText = ''

    // 尝试 <article>
    const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i)
    if (articleMatch) {
      bodyText = articleMatch[1]
    }

    if (!bodyText) {
      // 尝试 <div class="content" / <div id="content" / <div class="chapter-content" 等常见中文小说容器
      const contentDivMatch = html.match(
        /<div[^>]*(?:class|id)\s*=\s*["'](?:content|chapter-content|article-content|read-content|txt|book-content)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i
      )
      if (contentDivMatch) {
        bodyText = contentDivMatch[1]
      }
    }

    if (!bodyText) {
      // 提取所有 <p> 标签
      const pTags = html.match(/<p[^>]*>([\s\S]*?)<\/p>/gi) || []
      bodyText = pTags
        .map((p) => p.replace(/<[^>]+>/g, ''))
        .join('\n')
    }

    if (!bodyText) {
      // 回退：去掉 script/style，取 body 文本
      bodyText = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, '')
        .replace(/&[a-z]+;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    }

    // 清理 HTML 实体
    const clean = bodyText
      .replace(/&nbsp;/gi, ' ')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&amp;/gi, '&')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/g, "'")
      .replace(/&#x27;/g, "'")
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/\s*\n\s*/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim()

    // 限制长度
    const maxLen = 8000
    const content = clean.slice(0, maxLen)

    return { success: true, title, content }
  } catch (err: any) {
    return { success: false, content: '', error: err?.message || '请求失败' }
  }
}
