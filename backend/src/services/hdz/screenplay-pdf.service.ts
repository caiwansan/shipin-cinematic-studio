/**
 * screenplay-pdf.service.ts — 剧本 PDF 导出
 * 使用 Puppeteer + Google Chrome 将剧本 HTML 渲染为 PDF 文件
 */
import puppeteer from 'puppeteer'
import path from 'path'
import fs from 'fs'

const CHROME_PATH = '/usr/bin/google-chrome'

const TEMP_DIR = path.resolve('/tmp/hdz-screenplay-pdf')
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true })

/**
 * 根据剧本数据生成 PDF
 * @param chapterTitle 章节标题
 * @param chapterNo 章节号
 * @param scenes 场景列表
 * @returns PDF 文件路径
 */
export async function generateScreenplayPdf(params: {
  chapterNo: number
  chapterTitle: string
  scenes: Array<{
    sceneNo: number
    location: string
    characters: string[]
    camera: string
    content: string
  }>
}): Promise<string> {
  const { chapterNo, chapterTitle, scenes } = params

  // 构建 HTML
  const html = buildPrintHtml(chapterNo, chapterTitle, scenes)
  const htmlPath = path.join(TEMP_DIR, `screenplay-${chapterNo}.html`)
  fs.writeFileSync(htmlPath, html, 'utf-8')

  const pdfPath = path.join(TEMP_DIR, `screenplay-${chapterNo}-${Date.now()}.pdf`)

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  })

  try {
    const page = await browser.newPage()
    await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle0' })

    await page.pdf({
      path: pdfPath,
      format: 'A4',
      margin: { top: '20mm', right: '25mm', bottom: '20mm', left: '25mm' },
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate: `<div style="font-size:9px;text-align:center;width:100%;color:#888;">第 ${chapterNo} 章「${chapterTitle}」剧本 - 第 <span class="pageNumber"></span> 页</div>`,
    })

    return pdfPath
  } finally {
    await browser.close()
    // 清理临时 HTML
    try { fs.unlinkSync(htmlPath) } catch {}
  }
}

function buildPrintHtml(
  chapterNo: number,
  chapterTitle: string,
  scenes: Array<{
    sceneNo: number
    location: string
    characters: string[]
    camera: string
    content: string
  }>,
): string {
  const title = `第${chapterNo}章_${chapterTitle || '剧本'}`
  let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>
<style>
  @page { margin: 20mm 25mm; }
  body { font-family: 'SimSun','STSong','Noto Serif CJK SC','Source Han Serif SC',serif; font-size: 12pt; line-height: 1.8; color: #222; }
  h1 { text-align: center; font-size: 18pt; margin-bottom: 20pt; }
  .scene { margin-bottom: 16pt; page-break-inside: avoid; }
  .header { font-weight: bold; margin-bottom: 2pt; }
  .no { color: #8b4513; }
  .loc { color: #2e5c8a; }
  .camera { color: #6a6acd; font-size: 10pt; margin-bottom: 4pt; }
  .chars { color: #666; font-size: 10pt; margin-bottom: 4pt; }
  .content { white-space: pre-wrap; font-size: 11pt; line-height: 1.7; }
  .break { border: none; border-top: 1px dashed #ccc; margin: 12pt 0; }
</style></head><body>
<h1>📜 ${chapterTitle || `第${chapterNo}章`} · 剧本</h1>
<hr class="break">`
  for (const sc of scenes) {
    html += `<div class="scene">
  <div class="header"><span class="no">🎬 第${sc.sceneNo}场</span> <span class="loc">${escHtml(sc.location)}</span></div>
  ${sc.camera ? `<div class="camera">🎥 ${escHtml(sc.camera)}</div>` : ''}
  ${sc.characters?.length ? `<div class="chars">👥 ${sc.characters.map(escHtml).join('、')}</div>` : ''}
  <div class="content">${escHtml(sc.content).replace(/\n/g, '<br>')}</div>
</div><hr class="break">`
  }
  html += '</body></html>'
  return html
}

function escHtml(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
