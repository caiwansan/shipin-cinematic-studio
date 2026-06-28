/**
 * services/hdz/document-parser.service.ts
 *
 * 文档解析服务 — 上传的 TXT/DOCX 文件 → 章节数组。
 * 纯工程解析，不调 LLM，不作为安全入口。
 */
import * as fs from 'node:fs'
import * as path from 'node:path'

// mammoth CJS — 用 require 避免 ESM 问题
// eslint-disable-next-line @typescript-eslint/no-var-requires
const mammoth = require('mammoth')

export interface ParsedDocument {
  title: string
  chapters: ParsedChapter[]
}

export interface ParsedChapter {
  title: string | null
  content: string
}

// ─── 章节分割规则 ──────────────────────────────

/**
 * 从正文文本中自动识别章节边界。
 * 支持多种标题格式：
 *   "第一章  xxx" / "第1章 xxx" / "第 1 章 xxx"
 *   "Chapter 1" / "Chapter One"
 *   "一、xxx" / "1. xxx" / "（一）"
 *   连续空行分隔
 */
const CHAPTER_HEADER_RE = /^(?:第[一二三四五六七八九十百千万\d\s]+章\s*.*)$/m
const CHAPTER_NUM_RE   = /^第\s*([一二三四五六七八九十百千万\d]+)\s*章\s*(.*)$/
const ENGLISH_CHAP_RE  = /^Chapter\s+(\d+)\s*(.*)$/i

export function splitIntoChapters(fullText: string): ParsedChapter[] {
  const lines = fullText.split('\n')
  const chapters: ParsedChapter[] = []
  let currentTitle: string | null = null
  let currentContent: string[] = []
  let inChapter = false

  for (const line of lines) {
    const trimmed = line.trim()

    // 检测章节标题
    const cnMatch = trimmed.match(CHAPTER_NUM_RE)
    const enMatch = trimmed.match(ENGLISH_CHAP_RE)

    if (cnMatch || enMatch) {
      // 保存上一章
      if (inChapter) {
        chapters.push({
          title: currentTitle,
          content: currentContent.join('\n').trim(),
        })
      }
      currentTitle = cnMatch ? (cnMatch[2]?.trim() || trimmed) : (enMatch![2]?.trim() || trimmed)
      currentContent = []
      inChapter = true
      // 跳过标题行本身（不纳入正文）
      continue
    }

    // 如果是第一章之前的内容（书名/摘要/前言），作为 title 记录但跳过
    if (!inChapter && trimmed.length > 0) {
      // 还没进入正文，可能是书名或空行
      continue
    }

    currentContent.push(line)
  }

  // 最后一章
  if (inChapter) {
    chapters.push({
      title: currentTitle,
      content: currentContent.join('\n').trim(),
    })
  }

  // fallback: 如果完全没有识别到章节标题，整篇作为一章
  if (chapters.length === 0 && fullText.trim().length > 0) {
    chapters.push({
      title: null,
      content: fullText.trim(),
    })
  }

  return chapters
}

// ─── 文件解析 ──────────────────────────────────

export async function parseDocumentFile(filePath: string, originalName?: string): Promise<ParsedDocument> {
  const ext = path.extname(filePath).toLowerCase()

  if (ext === '.txt') {
    return parseTxt(filePath, originalName)
  } else if (ext === '.docx') {
    return parseDocx(filePath, originalName)
  } else {
    throw new Error(`不支持的文件格式: ${ext}，仅支持 .txt 和 .docx`)
  }
}

async function parseTxt(filePath: string, originalName?: string): Promise<ParsedDocument> {
  const fullText = fs.readFileSync(filePath, 'utf-8')
  const title = extractTitle(fullText, originalName)
  const chapters = splitIntoChapters(fullText)
  return { title, chapters }
}

async function parseDocx(filePath: string, originalName?: string): Promise<ParsedDocument> {
  const buffer = fs.readFileSync(filePath)
  const result = await mammoth.extractRawText({ buffer })
  const fullText = result.value
  const title = extractTitle(fullText, originalName)
  const chapters = splitIntoChapters(fullText)
  return { title, chapters }
}

function extractTitle(fullText: string, originalName?: string): string {
  // 取文件第一行作为标题
  const firstLine = fullText.split('\n').find(l => l.trim().length > 0)
  if (firstLine) {
    // 去掉常见的前缀
    const clean = firstLine.replace(/^[《「『【（\[]\s*/, '').replace(/^作品名[：:]\s*/, '').trim()
    if (clean.length > 0 && clean.length < 50) return clean
  }
  // fallback: 用文件名去掉扩展名
  return originalName ? originalName.replace(/\.[^.]+$/, '') : '未命名文档'
}
