// ─── 社区贴文 Markdown 工具 ───
// GEO-REVIEW-01.1 掌柜需求：过滤 AI 生成内容里的 # * 等符号
// stripMarkdown  : 纯文本清洗（卡片摘要/meta 等纯文本场景）
// renderMarkdown : 完整渲染（详情页，含表格/任务清单/有序列表，符号全部转排版）
// sanitizeHtml   : DOM 净化（移除危险标签/属性）

const SAFE_TAGS = new Set(['a','img','video','source','br','p','b','i','strong','em','del','ul','ol','li','table','thead','tbody','tr','th','td','div','span','h1','h2','h3','h4','h5','h6','pre','code','blockquote'])
const SAFE_ATTR = new Set(['href','src','target','rel','class','controls','alt','title','width','height','loading','preload'])
const DANGEROUS_ATTR_PREFIX = /^on/i

export function sanitizeHtml(html: string): string {
  if (!html) return ''
  if (typeof document === 'undefined') return html
  const div = document.createElement('div')
  div.innerHTML = html
  function clean(node: Element): void {
    if (node.nodeType === 1) {
      const tag = node.tagName.toLowerCase()
      if (!SAFE_TAGS.has(tag)) {
        const fragment = document.createDocumentFragment()
        while (node.firstChild) fragment.appendChild(node.firstChild)
        node.parentNode?.replaceChild(fragment, node)
        return
      }
      for (let i = node.attributes.length - 1; i >= 0; i--) {
        const attrName = node.attributes[i].name.toLowerCase()
        const attrVal = node.attributes[i].value
        if (!SAFE_ATTR.has(attrName) || DANGEROUS_ATTR_PREFIX.test(attrName) || attrVal.trim().startsWith('javascript:')) {
          node.removeAttribute(attrName)
        }
      }
    }
    for (let i = node.childNodes.length - 1; i >= 0; i--) {
      const child = node.childNodes[i]
      if (child.nodeType === 1) clean(child as Element)
    }
  }
  for (let i = div.childNodes.length - 1; i >= 0; i--) {
    const child = div.childNodes[i]
    if (child.nodeType === 1) clean(child as Element)
  }
  return div.innerHTML
}

// ─── 纯文本清洗：去掉 # * ` | > - 等 markdown 符号，保留可读文本 ───
export function stripMarkdown(text: string): string {
  if (!text) return ''
  let t = text
  // 代码块整体剔除（内部符号不属于正文）
  t = t.replace(/```[\s\S]*?```/g, ' ')
  const lines = t.split('\n')
  const out: string[] = []
  for (const raw of lines) {
    let line = raw.trim()
    if (!line) { out.push(''); continue }
    // 表格分隔线行（|---|---|）整行删除
    if (/^\|[\s:|-]+\|[\s:|-]*$/.test(line) && line.includes('-') && line.includes('|')) continue
    // 表格数据行：| a | b | → a · b
    if (line.startsWith('|') && line.endsWith('|')) {
      const cells = line.split('|').slice(1, -1).map(c => c.trim()).filter(Boolean)
      if (cells.length > 0) { out.push(cells.join(' · ')); continue }
    }
    // 标题 / 引用 / 任务清单 / 无序列表 / 有序列表符号
    line = line.replace(/^#{1,6}\s+/, '')
    line = line.replace(/^>\s?/, '')
    line = line.replace(/^[-*+]\s*\[[ xX]\]\s*/, '')
    line = line.replace(/^[-*+]\s+/, '')
    line = line.replace(/^\d+[.)]\s+/, '')
    // 链接/图片语法 → 保留文字
    line = line.replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    line = line.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    line = line.replace(/\[(?:img|video):[^\]]+\]/g, '')
    // 行内强调符号 → 保留文字
    line = line.replace(/\*\*([^*]+)\*\*/g, '$1')
    line = line.replace(/\*([^*]+)\*/g, '$1')
    line = line.replace(/~~([^~]+)~~/g, '$1')
    line = line.replace(/`([^`]+)`/g, '$1')
    line = line.replace(/_([^_]+)_/g, '$1')
    // 行内 #话题 保留文字、去掉井号
    line = line.replace(/(^|\s)#(\S+)/g, '$1$2')
    // 兜底：残余的 markdown 符号直接删除（AI 生成内容的常见残留）
    line = line.replace(/[#*_~|]/g, '')
    out.push(line)
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

// ─── 行内格式（供渲染器复用）───
function inlineFormat(s: string): string {
  return s
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/~~([^~]+)~~/g, '<del>$1</del>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
}

// ─── 完整渲染：符号全部转为排版（标题/列表/任务清单/表格/引用/链接等）───
export function renderMarkdown(text: string): string {
  if (!text) return ''
  const codeBlocks: string[] = []
  text = text.replace(/```(\w*)\n?([\s\S]*?)```/g, (_m: string, lang: string, code: string) => {
    const idx = codeBlocks.length
    const langClass = lang ? ` language-${lang}` : ''
    codeBlocks.push(`<pre><code class="${langClass}">${escapeHtml(code.trim())}</code></pre>`)
    return `\x00CODEBLOCK${idx}\x00`
  })
  const inlineCodes: string[] = []
  text = text.replace(/`([^`]+)`/g, (_m: string, code: string) => {
    const idx = inlineCodes.length
    inlineCodes.push(`<code>${escapeHtml(code)}</code>`)
    return `\x00INLINECODE${idx}\x00`
  })

  const lines = text.split('\n')
  const blocks: string[] = []
  let listType: '' | 'ul' | 'ol' | 'task' = ''
  let tableRows: string[][] = []   // 原始单元格
  let tableIsHeader = false

  const flushList = () => {
    if (listType === 'task') { blocks.push('</ul>'); listType = '' }
    else if (listType) { blocks.push(`</${listType}>`); listType = '' }
  }
  const flushTable = () => {
    if (tableRows.length === 0) return
    let html = '<table class="md-table">'
    const isSep = (r: string[]) => r.length === 1 && /^[\s:|-]+$/.test(r[0]) && r[0].includes('-')
    if (tableIsHeader) {
      html += '<thead><tr>' + tableRows[0].map(c => `<th>${inlineFormat(c)}</th>`).join('') + '</tr></thead>'
      tableRows = tableRows.slice(1)
    }
    const body = tableRows.filter(r => !isSep(r))
    if (body.length) html += '<tbody>' + body.map(r => `<tr>${r.map(c => `<td>${inlineFormat(c)}</td>`).join('')}</tr>`).join('') + '</tbody>'
    html += '</table>'
    blocks.push(html)
    tableRows = []
    tableIsHeader = false
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()
    if (!trimmed) { flushList(); flushTable(); continue }

    // 表格行（以 | 开头结尾，且含 ≥2 个 |）
    if (trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.split('|').length >= 3) {
      flushList()
      const cells = trimmed.split('|').slice(1, -1).map(c => c.trim())
      // 分隔行判定：所有单元格都是纯分隔符（|---|:--|）
      if (cells.length > 0 && cells.every(c => /^[\s:|-]+$/.test(c) && c.includes('-'))) {
        tableIsHeader = tableRows.length > 0 && !tableIsHeader
        continue
      }
      tableRows.push(cells)
      continue
    }

    flushTable()
    const headerMatch = trimmed.match(/^(#{1,6})\s+(.*)$/)
    if (headerMatch) {
      flushList()
      const level = headerMatch[1].length
      blocks.push(`<h${level}>${headerMatch[2]}</h${level}>`)
      continue
    }
    const quoteMatch = trimmed.match(/^>\s*(.*)$/)
    if (quoteMatch) {
      flushList()
      blocks.push(`<blockquote>${quoteMatch[1]}</blockquote>`)
      continue
    }
    const taskMatch = trimmed.match(/^[-*+]\s*\[([ xX])\]\s+(.*)$/)
    if (taskMatch) {
      if (listType !== 'task') { flushList(); blocks.push('<ul class="task-list">'); listType = 'task' }
      const done = /[xX]/.test(taskMatch[1])
      blocks.push(`<li class="task-item${done ? ' done' : ''}">${done ? '☑' : '☐'} ${taskMatch[2]}</li>`)
      continue
    }
    const ulMatch = trimmed.match(/^[-*]\s+(.*)$/)
    if (ulMatch) {
      if (listType !== 'ul') { flushList(); blocks.push('<ul>'); listType = 'ul' }
      blocks.push(`<li>${ulMatch[1]}</li>`)
      continue
    }
    const olMatch = trimmed.match(/^\d+[.)]\s+(.*)$/)
    if (olMatch) {
      if (listType !== 'ol') { flushList(); blocks.push('<ol>'); listType = 'ol' }
      blocks.push(`<li>${olMatch[1]}</li>`)
      continue
    }
    flushList()
    blocks.push(`<p>${line}</p>`)
  }
  flushList()
  flushTable()

  let html = blocks.join('\n')
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>')
  html = html.replace(/~~([^~]+)~~/g, '<del>$1</del>')
  html = html.replace(/\x00INLINECODE(\d+)\x00/g, (_m: string, idx: string) => inlineCodes[parseInt(idx)])
  html = html.replace(/\x00CODEBLOCK(\d+)\x00/g, (_m: string, idx: string) => codeBlocks[parseInt(idx)])
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_m: string, alt: string, url: string) => {
    return `<div class="inline-media"><img src="${url}" alt="${alt}" class="inline-img" loading="lazy" /></div>`
  })
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m: string, linkText: string, url: string) => {
    return `<a href="${url}" target="_blank" rel="noopener" class="post-link">${linkText}</a>`
  })
  html = html.replace(/\[img:([^\]]+)\]/g, (_m: string, url: string) => {
    return `<div class="inline-media"><a href="${url}" target="_blank" rel="noopener" class="post-link"><img src="${url}" class="inline-img" loading="lazy" /></a></div>`
  })
  html = html.replace(/\[video:([^\]]+)\]/g, (_m: string, url: string) => {
    return `<div class="inline-media"><video src="${url}" class="inline-video" controls preload="none"></video></div>`
  })
  // URL 链接化：保护已生成标签内的 URL（href/src 属性值），防止二次匹配嵌套损坏
  const tagUrls: string[] = []
  html = html.replace(/((?:href|src)=")(https?:\/\/[^"\s]+)"/g, (_m: string, prefix: string, url: string) => {
    const idx = tagUrls.length
    tagUrls.push(url)
    return `${prefix}\x00TAGURL${idx}\x00"`
  })
  html = html.replace(/(https?:\/\/[^\s<"'）)\]]+)/g, (_m: string, url: string) => {
    return `<a href="${url}" target="_blank" rel="noopener" class="post-link">${url}</a>`
  })
  html = html.replace(/\x00TAGURL(\d+)\x00/g, (_m: string, idx: string) => tagUrls[parseInt(idx)])
  return sanitizeHtml(html)
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
