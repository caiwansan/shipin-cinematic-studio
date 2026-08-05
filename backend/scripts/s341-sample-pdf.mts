/**
 * S3.4.1-BLOCKED — 生成样例中文简历 PDF（RP1: 真实 PDF 输入素材）
 * 使用 pdfkit + SimHei.ttf（/opt/kunlun/assets/fonts/SimHei.ttf）
 * 输出: /opt/kunlun/assets/resume-sample.pdf
 * 内容为真实文本（正则 Agent 可提取: 姓名/邮箱/电话/教育/专业/技能/经验/薪资/目标/项目）
 */
import fs from 'node:fs'
import path from 'node:path'
import PDFDocument from 'pdfkit'

const FONT_PATH = process.env.KUNLUN_FONT_PATH || '/opt/kunlun/assets/fonts/SimHei.ttf'
const OUT_PATH = process.env.KUNLUN_RESUME_SAMPLE || '/opt/kunlun/assets/resume-sample.pdf'

const RESUME_TEXT = [
  '姓名：张伟',
  '邮箱：zhangwei@example.com',
  '电话：13812345678',
  '城市：北京',
  '教育：北京大学',
  '专业：计算机科学与技术',
  '技能：Java、Spring Boot、MySQL、Redis、Kafka、Docker、微服务',
  '工作经验：5年',
  '期望薪资：25k-35k',
  '职业目标：资深Java工程师',
  '工作经历：5年工作经验，2019-2023 就职于某互联网公司，负责订单系统开发与架构优化',
  '项目经验：主导高并发订单平台重构，QPS 从 800 提升至 5000',
].join('\n')

const doc = new PDFDocument({ size: 'A4', margin: 40 })
const chunks: Buffer[] = []
const done = new Promise<void>((resolve) => {
  doc.on('data', (c: Buffer) => chunks.push(c))
  doc.on('end', () => resolve())
})
doc.font(FONT_PATH)
doc.fontSize(16).text('个人简历（样例）')
doc.moveDown()
doc.fontSize(12)
for (const line of RESUME_TEXT.split('\n')) {
  doc.text(line)
}
doc.end()
await done
fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true })
fs.writeFileSync(OUT_PATH, Buffer.concat(chunks))
console.log(`sample resume pdf -> ${OUT_PATH} (${Buffer.concat(chunks).length} bytes)`)
