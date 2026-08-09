#!/usr/bin/env node
// 转换 ai-articles/batch1-5 的 50 篇 md → 社区发帖 JSON（5 个批次文件）
import fs from 'fs'
import path from 'path'

const SRC = '/root/.openclaw/workspace/ai-articles'
const OUT = '/root/shipin-cinematic-studio/community-batch'

const batches = ['batch1', 'batch2', 'batch3', 'batch4', 'batch5']
const outFiles = ['ai-trends-01.json', 'ai-trends-02.json', 'ai-trends-03.json', 'ai-trends-04.json', 'ai-trends-05.json']

let total = 0
const problems = []

batches.forEach((batchDir, bi) => {
  const dir = path.join(SRC, batchDir)
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.md')).sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))
  const posts = []

  for (const f of files) {
    const raw = fs.readFileSync(path.join(dir, f), 'utf8')
    const lines = raw.split('\n')
    // 去除首部空行
    let i = 0
    while (i < lines.length && !lines[i].trim()) i++

    // 第一行 # 标题
    const titleLine = lines[i] || ''
    if (!titleLine.startsWith('# ')) { problems.push(`${batchDir}/${f}: 首行非标题`); continue }
    const title = titleLine.replace(/^#\s+/, '').trim()

    // 第二行 summary
    i++
    let summary = ''
    while (i < lines.length && !lines[i].trim()) i++
    if (lines[i] && lines[i].trim().startsWith('> summary:')) {
      summary = lines[i].replace(/^>\s*summary:\s*/, '').trim()
      i++
    } else {
      problems.push(`${batchDir}/${f}: 缺 summary 行`)
      summary = title
    }

    // 第三行 tags
    while (i < lines.length && !lines[i].trim()) i++
    let tags = ''
    if (lines[i] && lines[i].trim().startsWith('> tags:')) {
      tags = lines[i].replace(/^>\s*tags:\s*/, '').trim()
      i++
    } else {
      problems.push(`${batchDir}/${f}: 缺 tags 行`)
    }

    // 正文：剩余全部（去掉后续可能的空行开头）
    let content = lines.slice(i).join('\n').trim()
    if (!content) { problems.push(`${batchDir}/${f}: 正文为空`); continue }

    // 校验
    if (title.length > 100) problems.push(`${batchDir}/${f}: 标题超 100 字 (${title.length})`)
    if (summary.length > 180) problems.push(`${batchDir}/${f}: summary 超 180 字 (${summary.length})`)
    const tagCount = tags.split(',').filter(t => t.trim()).length
    if (tagCount < 1) problems.push(`${batchDir}/${f}: tags 为空`)

    posts.push({ title, summary, category: 'general', tags, content })
    total++
  }

  fs.writeFileSync(path.join(OUT, outFiles[bi]), JSON.stringify(posts, null, 2), 'utf8')
  console.log(`${outFiles[bi]}: ${posts.length} 篇`)
})

console.log(`\n总计 ${total} 篇`)
if (problems.length) {
  console.log('⚠️ 问题:')
  problems.forEach(p => console.log(' -', p))
} else {
  console.log('✅ 无格式问题')
}
