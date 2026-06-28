#!/usr/bin/env node
/**
 * 直接用火山引擎 API 测试视频生成
 * 不依赖项目 env schema，直接读 .env 文件
 */

import { readFileSync } from 'fs'

// 手动加载 .env
const envContent = readFileSync('/root/shipin-cinematic-studio/backend/.env', 'utf-8')
for (const line of envContent.split('\n')) {
  const trimmed = line.trim()
  if (trimmed && !trimmed.startsWith('#')) {
    const [key, ...rest] = trimmed.split('=')
    if (key && rest.length) {
      process.env[key.trim()] = rest.join('=').trim()
    }
  }
}

const API_KEY = process.env.VOLCENGINE_API_KEY
const BASE_URL = process.env.VOLCENGINE_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3'
// 2.0 未开通，手动用 1.0-pro
const MODEL = 'doubao-seedance-1-0-pro-250528'

async function main() {
  console.log('🎬 火山引擎 Seedance 视频生成测试')
  console.log(`API: ${BASE_URL}`)
  console.log(`Model: ${MODEL}`)
  console.log('场景：两名剑客在茂密森林中决斗')
  console.log('时长：12秒 比例：9:16')
  console.log('')

  // 1. 提交
  const submitResp = await fetch(`${BASE_URL}/contents/generations/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${API_KEY}` },
    body: JSON.stringify({
      model: MODEL,
      content: [{ type: 'text', text: '两名古代剑客在茂密森林中决斗，阳光透过树叶洒下斑驳光影，刀光剑影，武侠风格，电影级画质，1080p' }],
      generate_audio: true,
      ratio: '9:16',
      duration: 12,
      watermark: false,
    }),
  })

  if (!submitResp.ok) {
    const err = await submitResp.text()
    throw new Error(`提交失败 (${submitResp.status}): ${err}`)
  }

  const submitData = await submitResp.json()
  const taskId = submitData.id
  console.log(`✅ 任务已提交: ${taskId}`)
  console.log('')

  // 2. 轮询
  for (let i = 1; i <= 60; i++) {
    const pollResp = await fetch(`${BASE_URL}/contents/generations/tasks/${taskId}`, {
      headers: { 'Authorization': `Bearer ${API_KEY}` },
    })
    const data = await pollResp.json()
    const status = data.status || 'unknown'

    process.stdout.write(`\r⏳ [${i * 5}s] Status: ${status}`)

    if (status === 'succeeded') {
      console.log('\n')
      console.log('🎉 生成成功！')
      console.log(`📹 视频URL: ${data.content?.video_url}`)
      console.log(`📐 分辨率: ${data.resolution}`)
      console.log(`⏱️  时长: ${data.duration}s`)
      console.log(`🎞️  帧率: ${data.framespersecond}fps`)
      process.exit(0)
    }

    if (status === 'failed') {
      console.log(`\n❌ 生成失败: ${data.error}`)
      process.exit(1)
    }

    await new Promise(r => setTimeout(r, 5000))
  }

  console.log('\n⏰ 超时')
  process.exit(1)
}

main().catch(err => {
  console.error('❌ 错误:', err.message)
  process.exit(1)
})
