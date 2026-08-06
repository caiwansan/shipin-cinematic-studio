/**
 * S3.4.1-BLOCKED Task 02 — Skill Asset Delivery 管道
 * 输入: resume.parse / candidate report 结果（真实数据）
 * 输出: candidate-analysis.json + candidate-report.pdf → Asset + UserAsset
 * 原则:
 *  - 零 LLM：只渲染真实结构化数据（profile/quality），禁止假造 AI 分析内容
 *  - 零新表：复用 Asset / UserAsset
 *  - D4 冻结: 每任务一个资产目录（Task → Asset → UserAsset → Workspace）
 *  - 中文字体: SimHei.ttf（/opt/kunlun/assets/fonts/，不入 git）; PDF 生成用 pdfkit（原生 fontkit）
 */
import { prisma } from '../utils/index.js'
import fs from 'node:fs'
import path from 'node:path'

const UPLOADS_ROOT = path.resolve(process.cwd(), 'public', 'uploads')
const ASSET_DIR = path.join(UPLOADS_ROOT, 'skill-assets')
const FONT_PATH = process.env.KUNLUN_FONT_PATH || '/opt/kunlun/assets/fonts/SimHei.ttf'

export interface SkillAssetInput {
  userId: string
  taskId?: string
  title?: string
  profile: any
  quality?: any
  /** S3.4.2-C: 面试评估结果（存在则额外生成 interview-report.pdf, IE4） */
  interview?: any
}

export interface SkillAssetResult {
  taskId: string
  files: { fileName: string; url: string; mimeType: string; size: number }[]
  assets: any[]
  userAssets: any[]
}

/** 生成 candidate-report.pdf（骨架：仅真实结构化数据; pdfkit 自动换行 + CJK 字体） */
async function buildReportPdf(analysis: any): Promise<Buffer> {
  const PDFDocument = (await import('pdfkit')).default
  const doc = new PDFDocument({ size: 'A4', margin: 40 })
  const chunks: Buffer[] = []
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on('data', (c: Buffer) => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
  })

  let useAsciiOnly = false
  try {
    doc.font(FONT_PATH)
  } catch {
    useAsciiOnly = true // 无中文字体时降级（非 ASCII 替换为 _）
  }
  const clean = (s: string) => (useAsciiOnly ? s.replace(/[^\x00-\x7F]/g, '_') : s)

  const profile = analysis.profile || {}
  const quality = analysis.quality || {}
  const cleanArr = (arr: string[]) => (Array.isArray(arr) ? arr.map(clean) : [])

  doc.fontSize(18).fillColor('#1a1a59').text('Candidate Report (S3.4.1-blocked)')
  doc.fontSize(9).fillColor('#666666').text(`Task: ${analysis.taskId} | GeneratedAt: ${analysis.generatedAt}`)
  doc.moveDown()

  const sections: [string, string[]][] = [
    ['Basic Info', [
      clean(`Name: ${profile.name || '-'}   Email: ${profile.email || '-'}   Phone: ${profile.phone || '-'}`),
      clean(`Education: ${profile.education || '-'}   Major: ${profile.major || '-'}   City: ${profile.city || '-'}`),
      clean(`Experience: ${profile.experienceYears != null ? profile.experienceYears + ' years' : '-'}   Salary: ${profile.salaryMin ?? '-'}k - ${profile.salaryMax ?? '-'}k`),
      clean(`Goal: ${profile.careerGoal || '-'}`),
    ]],
    ['Skills', cleanArr(Array.isArray(profile.skills) ? profile.skills.map((s: string) => `- ${s}`) : ['-'])],
    ['Experience Detail', [clean(profile.experience || '-')]],
    ['Projects', [clean(profile.projects || '-')]],
    ['Resume Quality', [
      clean(`Score: ${quality.score ?? '-'} / 100`),
      ...cleanArr(Array.isArray(quality.strengths) ? quality.strengths.map((s: string) => `Strength: ${s}`) : []),
      ...cleanArr(Array.isArray(quality.weaknesses) ? quality.weaknesses.map((s: string) => `Weakness: ${s}`) : []),
      ...cleanArr(Array.isArray(quality.suggestions) ? quality.suggestions.map((s: string) => `Suggestion: ${s}`) : []),
    ]],
  ]

  for (const [title, lines] of sections) {
    doc.fontSize(13).fillColor('#1a1a59').text(title)
    doc.fontSize(11).fillColor('#000000')
    for (const line of lines) doc.text('  ' + line)
    doc.moveDown()
  }

  doc.fontSize(8).fillColor('#888888').text('-- Kunlun AI Employee Alice Screening Report (S3.4.1-blocked real data pipeline) --')
  doc.end()
  return done
}

/** 生成 interview-report.pdf（S3.4.2-C, IE4; 仅真实结构化数据） */
async function buildInterviewReportPdf(analysis: any): Promise<Buffer> {
  const PDFDocument = (await import('pdfkit')).default
  const doc = new PDFDocument({ size: 'A4', margin: 40 })
  const chunks: Buffer[] = []
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on('data', (c: Buffer) => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
  })
  let useAsciiOnly = false
  try {
    doc.font(FONT_PATH)
  } catch {
    useAsciiOnly = true
  }
  const clean = (s: string) => (useAsciiOnly ? s.replace(/[^\x00-\x7F]/g, '_') : s)
  const iv = analysis.interview || {}
  const cleanArr = (arr: string[]) => (Array.isArray(arr) ? arr.map(clean) : [])

  doc.fontSize(18).fillColor('#1a1a59').text('Interview Report (S3.4.2-C)')
  doc.fontSize(9).fillColor('#666666').text(`Task: ${analysis.taskId} | GeneratedAt: ${analysis.generatedAt}`)
  doc.moveDown()
  const sections: [string, string[]][] = [
    ['Overall', [clean(`Overall Score: ${iv.overallScore ?? '-'} / 100`), clean(`Hiring Recommendation: ${iv.hiringRecommendation || '-'}`)]],
    ['Strengths', cleanArr(Array.isArray(iv.strengths) ? iv.strengths.map((s: string) => `- ${s}`) : ['-'])],
    ['Concerns', cleanArr(Array.isArray(iv.concerns) ? iv.concerns.map((c: string) => `- ${c}`) : ['-'])],
  ]
  for (const [title, lines] of sections) {
    doc.fontSize(13).fillColor('#1a1a59').text(title)
    doc.fontSize(11).fillColor('#000000')
    for (const line of lines) doc.text('  ' + line)
    doc.moveDown()
  }
  doc.fontSize(8).fillColor('#888888').text('-- Kunlun AI Employee Alice Interview Evaluation (S3.4.2-C real pipeline) --')
  doc.end()
  return done
}

/**
 * 交付任务资产（Task 02）:
 * 1. candidate-analysis.json（真实结构化数据）
 * 2. candidate-report.pdf（骨架渲染, 零 AI 内容）
 * 3. Asset + UserAsset 记录（D4: 每任务）
 */
export async function deliverSkillAssets(input: SkillAssetInput): Promise<SkillAssetResult> {
  const taskId = input.taskId || 'task-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5)
  const dir = path.join(ASSET_DIR, taskId)
  fs.mkdirSync(dir, { recursive: true })

  const analysis = {
    taskId,
    title: input.title || '候选人分析',
    generatedAt: new Date().toISOString(),
    pipeline: 'S3.4.1-blocked',
    llmInvolved: false,
    profile: input.profile,
    quality: input.quality || null,
    interview: input.interview || null,
  }

  // 1. JSON 资产
  const jsonName = 'candidate-analysis.json'
  fs.writeFileSync(path.join(dir, jsonName), JSON.stringify(analysis, null, 2))
  // 2. PDF 资产（骨架）
  const pdfName = 'candidate-report.pdf'
  const pdfBytes = await buildReportPdf(analysis)
  fs.writeFileSync(path.join(dir, pdfName), pdfBytes)

  const files = [
    { fileName: jsonName, url: `/uploads/skill-assets/${taskId}/${jsonName}`, mimeType: 'application/json', size: fs.statSync(path.join(dir, jsonName)).size },
    { fileName: pdfName, url: `/uploads/skill-assets/${taskId}/${pdfName}`, mimeType: 'application/pdf', size: fs.statSync(path.join(dir, pdfName)).size },
  ]

  // S3.4.2-C: 面试报告（IE4）
  if (input.interview) {
    const ivName = 'interview-report.pdf'
    const ivBytes = await buildInterviewReportPdf(analysis)
    fs.writeFileSync(path.join(dir, ivName), ivBytes)
    files.push({ fileName: ivName, url: `/uploads/skill-assets/${taskId}/${ivName}`, mimeType: 'application/pdf', size: fs.statSync(path.join(dir, ivName)).size })
  }

  // 3. Asset + UserAsset（复用现有模型, 零新表）
  // 注意: UserAsset.userId 外键指向 membership.userId（userasset_membership_fkey）→ 需先确认会员关系
  const membership = await prisma.membership.findUnique({ where: { userId: input.userId } }).catch(() => null)
  if (!membership) {
    throw new Error('USER_NO_MEMBERSHIP: 用户无会员关系, UserAsset 无法创建')
  }
  const assets: any[] = []
  const userAssets: any[] = []
  for (const f of files) {
    const asset = await prisma.asset.create({
      data: { type: 'other', fileName: f.fileName, filePath: f.url, mimeType: f.mimeType, fileSize: f.size },
    })
    assets.push(asset)
    const ua = await prisma.userAsset.create({
      data: { userId: input.userId, title: `${input.title || '候选人'}-${f.fileName}`, type: 'document', url: f.url, fileSize: f.size, source: 'skill_task' },
    })
    userAssets.push(ua)
  }

  return { taskId, files, assets, userAssets }
}

/**
 * S5.1: 短剧导演资产交付（3 JSON, 复用 Asset/UserAsset, 零新表）
 * 输入: scriptAnalysis / storyboardPlan / promptOptimize（真实 LLM 结构化输出）
 * 输出: script-analysis.json + storyboard-plan.json + optimized-prompts.json → Asset + UserAsset
 */
export async function deliverShortDramaAssets(input: {
  userId: string
  taskId?: string
  title?: string
  scriptAnalysis?: any
  storyboardPlan?: any
  promptOptimize?: any
}): Promise<SkillAssetResult> {
  const taskId = input.taskId || 'task-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5)
  const dir = path.join(ASSET_DIR, taskId)
  fs.mkdirSync(dir, { recursive: true })

  const payload = {
    taskId,
    title: input.title || '短剧创作分析',
    generatedAt: new Date().toISOString(),
    pipeline: 'S5.1-shortdrama',
    llmInvolved: true,
    scriptAnalysis: input.scriptAnalysis || null,
    storyboardPlan: input.storyboardPlan || null,
    promptOptimize: input.promptOptimize || null,
  }
  const entries: { fileName: string; data: string }[] = []
  if (input.scriptAnalysis) entries.push({ fileName: 'script-analysis.json', data: JSON.stringify(payload.scriptAnalysis, null, 2) })
  if (input.storyboardPlan) entries.push({ fileName: 'storyboard-plan.json', data: JSON.stringify(payload.storyboardPlan, null, 2) })
  if (input.promptOptimize) entries.push({ fileName: 'optimized-prompts.json', data: JSON.stringify(payload.promptOptimize, null, 2) })
  if (!entries.length) throw new Error('SHORTDRAMA_ASSET_EMPTY: 无资产内容')

  const files: SkillAssetResult['files'] = []
  for (const e of entries) {
    fs.writeFileSync(path.join(dir, e.fileName), e.data)
    files.push({ fileName: e.fileName, url: `/uploads/skill-assets/${taskId}/${e.fileName}`, mimeType: 'application/json', size: fs.statSync(path.join(dir, e.fileName)).size })
  }

  const membership = await prisma.membership.findUnique({ where: { userId: input.userId } }).catch(() => null)
  if (!membership) {
    throw new Error('USER_NO_MEMBERSHIP: 用户无会员关系, UserAsset 无法创建')
  }
  const assets: any[] = []
  const userAssets: any[] = []
  for (const f of files) {
    const asset = await prisma.asset.create({
      data: { type: 'other', fileName: f.fileName, filePath: f.url, mimeType: f.mimeType, fileSize: f.size },
    })
    assets.push(asset)
    const ua = await prisma.userAsset.create({
      data: { userId: input.userId, title: `${input.title || '短剧创作'}-${f.fileName}`, type: 'document', url: f.url, fileSize: f.size, source: 'skill_task' },
    })
    userAssets.push(ua)
  }
  return { taskId, files, assets, userAssets }
}

/**
 * S5.2: 新媒体运营资产交付（3 JSON, 复用 Asset/UserAsset, 零新表）
 * 输入: contentStrategy / contentDraft / opsAnalysis（真实 LLM 结构化输出）
 * 输出: content-plan.json + content-drafts.json + ops-analysis.json → Asset + UserAsset
 */
export async function deliverNewMediaAssets(input: {
  userId: string
  taskId?: string
  title?: string
  contentStrategy?: any
  contentDraft?: any
  opsAnalysis?: any
}): Promise<SkillAssetResult> {
  const taskId = input.taskId || 'task-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5)
  const dir = path.join(ASSET_DIR, taskId)
  fs.mkdirSync(dir, { recursive: true })

  const entries: { fileName: string; data: string }[] = []
  if (input.contentStrategy) entries.push({ fileName: 'content-plan.json', data: JSON.stringify(input.contentStrategy, null, 2) })
  if (input.contentDraft) entries.push({ fileName: 'content-drafts.json', data: JSON.stringify(input.contentDraft, null, 2) })
  if (input.opsAnalysis) entries.push({ fileName: 'ops-analysis.json', data: JSON.stringify(input.opsAnalysis, null, 2) })
  if (!entries.length) throw new Error('NEWMEDIA_ASSET_EMPTY: 无资产内容')

  const files: SkillAssetResult['files'] = []
  for (const e of entries) {
    fs.writeFileSync(path.join(dir, e.fileName), e.data)
    files.push({ fileName: e.fileName, url: `/uploads/skill-assets/${taskId}/${e.fileName}`, mimeType: 'application/json', size: fs.statSync(path.join(dir, e.fileName)).size })
  }

  const membership = await prisma.membership.findUnique({ where: { userId: input.userId } }).catch(() => null)
  if (!membership) {
    throw new Error('USER_NO_MEMBERSHIP: 用户无会员关系, UserAsset 无法创建')
  }
  const assets: any[] = []
  const userAssets: any[] = []
  for (const f of files) {
    const asset = await prisma.asset.create({
      data: { type: 'other', fileName: f.fileName, filePath: f.url, mimeType: f.mimeType, fileSize: f.size },
    })
    assets.push(asset)
    const ua = await prisma.userAsset.create({
      data: { userId: input.userId, title: `${input.title || '新媒体运营'}-${f.fileName}`, type: 'document', url: f.url, fileSize: f.size, source: 'skill_task' },
    })
    userAssets.push(ua)
  }
  return { taskId, files, assets, userAssets }
}
