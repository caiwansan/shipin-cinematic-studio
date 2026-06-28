#!/usr/bin/env node
/**
 * 图生视频测试：Seedance 语义图生视频
 * 上传一张参考图 → 模型根据人物姿态生成
 */
import { readFileSync } from 'fs'

const envContent = readFileSync('/root/shipin-cinematic-studio/backend/.env', 'utf-8')
for (const line of envContent.split('\n')) {
  const trimmed = line.trim()
  if (trimmed && !trimmed.startsWith('#')) {
    const [key, ...rest] = trimmed.split('=')
    if (key && rest.length) process.env[key.trim()] = rest.join('=').trim()
  }
}

const API_KEY = process.env.VOLCENGINE_API_KEY
const BASE_URL = 'https://ark.cn-beijing.volces.com/api/v3'
const IMG_MODEL = 'doubao-seedream-4-5-251128'
const VIDEO_MODEL = 'doubao-seedance-1-0-pro-250528'

async function main() {
  console.log('🎬 先文生图生成剑客参考图...')

  // 1. 先生成一张剑客参考图
  const imgResp = await fetch(`${BASE_URL}/images/generations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${API_KEY}` },
    body: JSON.stringify({
      model: IMG_MODEL,
      prompt: '一名古代侠客手持长剑站立，全身可见，白色汉服，武侠风格，高清写实，干净背景',
      n: 1,
      size: '1024x1024',
    }),
  })

  if (!imgResp.ok) {
    const err = await imgResp.text()
    throw new Error(`图片生成失败 (${imgResp.status}): ${err}`)
  }

  const imgData = await imgResp.json()
  const refImageUrl = imgData.data?.[0]?.url || imgData.data?.[0]?.b64_json
  if (!refImageUrl) {
    console.log('响应结构:', JSON.stringify(imgData).substring(0, 500))
    // 如果seedream image generation接口不同，尝试另一种方式
  }

  console.log('参考图URL:', refImageUrl)
  console.log('')

  // 2. 图生视频
  console.log('🎬 提交图生视频任务...')
  const submitResp = await fetch(`${BASE_URL}/contents/generations/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${API_KEY}` },
    body: JSON.stringify({
      model: VIDEO_MODEL,
      content: [
        { type: 'image_url', image_url: { url: refImageUrl } },
        { type: 'text', text: '剑客挥剑转身，动作流畅自然，武术姿态，武侠电影风格' },
      ],
      generate_audio: true,
      ratio: '9:16',
      duration: 12,
      watermark: false,
    }),
  })

  if (!submitResp.ok) {
    const err = await submitResp.text()
    throw new Error(`视频提交失败 (${submitResp.status}): ${err}`)
  }

  const submitData = await submitResp.json()
  const taskId = submitData.id
  console.log(`✅ 任务已提交: ${taskId}`)

  // 3. 轮询
  for (let i = 1; i <= 60; i++) {
    const pollResp = await fetch(`${BASE_URL}/contents/generations/tasks/${taskId}`, {
      headers: { 'Authorization': `Bearer ${API_KEY}` },
    })
    const data = await pollResp.json()
    const status = data.status || 'unknown'

    process.stdout.write(`\r⏳ [${i * 5}s] Status: ${status}`)

    if (status === 'succeeded') {
      console.log('\n\n🎉 图生视频成功！')
      console.log(`📹 视频URL: ${data.content?.video_url}`)
      console.log(`📐 分辨率: ${data.resolution}`)
      process.exit(0)
    }
    if (status === 'failed') {
      console.log(`\n❌ 失败: ${data.error}`)
      // 可能seedream不支持这个endpoint，换seedance图生视频直接传图片url
      process.exit(1)
    }
    await new Promise(r => setTimeout(r, 5000))
  }
}

main().catch(err => {
  console.error('❌ 错误:', err.message)
  process.exit(1)
})
