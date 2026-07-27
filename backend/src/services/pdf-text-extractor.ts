/**
 * pdf-text-extractor.ts — PDF 文本提取服务
 * 
 * Beta 0.3 Slice B: 简历解析
 * 使用 pdftotext (poppler-utils) 从 PDF 文件中提取纯文本
 */

import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

export interface PdfExtractResult {
  text: string
  pageCount: number
  charCount: number
}

/**
 * 从 PDF Buffer 中提取文本
 */
export async function extractTextFromPdf(pdfBuffer: Buffer): Promise<PdfExtractResult> {
  // 使用 pdftotext 提取文本（- 表示从 stdin 读取）
  const { stdout } = await execFileAsync('pdftotext', ['-layout', '-', '-'], {
    input: pdfBuffer,
    maxBuffer: 10 * 1024 * 1024, // 10MB
    timeout: 30000,
  })

  const text = stdout.trim()
  const pageCount = estimatePageCount(text)

  return {
    text,
    pageCount,
    charCount: text.length,
  }
}

/**
 * 从文件路径提取文本
 */
export async function extractTextFromPdfFile(filePath: string): Promise<PdfExtractResult> {
  const { stdout } = await execFileAsync('pdftotext', ['-layout', filePath, '-'], {
    maxBuffer: 10 * 1024 * 1024,
    timeout: 30000,
  })

  const text = stdout.trim()
  const pageCount = estimatePageCount(text)

  return {
    text,
    pageCount,
    charCount: text.length,
  }
}

/**
 * 估算页数（基于换页符或文本长度）
 */
function estimatePageCount(text: string): number {
  // PDF 换页符 \f 分隔页面
  const formFeeds = (text.match(/\f/g) || []).length
  if (formFeeds > 0) return formFeeds + 1
  // 估算：每页约 3000 字符
  return Math.max(1, Math.ceil(text.length / 3000))
}
