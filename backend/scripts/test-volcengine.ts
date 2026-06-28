#!/usr/bin/env node
/**
 * 测试：通过新系统的 VolcEngine Provider 生成视频
 * 
 * 场景：两名剑客在林中决斗，竖屏9:16，12秒
 * 
 * 先不依赖数据库和 Worker，直接调 provider 测试
 */

import { volcengineVideo } from '../src/services/volcengine-video.provider.js'

async function main() {
  console.log('🎬 开始测试：火山引擎 Seedance 视频生成')
  console.log('========================================')
  console.log('场景：两名剑客在茂密森林中决斗')
  console.log('时长：12秒（最长）')
  console.log('比例：9:16（竖屏）')
  console.log('')

  // 1. 提交任务
  const { taskId } = await volcengineVideo.submit({
    prompt: '两名古代剑客在茂密森林中决斗，阳光透过树叶洒下斑驳光影，刀光剑影，武侠风格，电影级画质，1080p',
    duration: 12,
    ratio: '9:16',
  })

  console.log(`✅ 任务已提交: ${taskId}`)
  console.log('')

  // 2. 轮询
  console.log('⏳ 等待生成完成...')
  const result = await volcengineVideo.waitForCompletion(taskId, 5000)

  if (result.status === 'succeeded') {
    console.log('')
    console.log('🎉 生成成功！')
    console.log(`📹 视频URL: ${result.videoUrl}`)
    console.log(`📐 分辨率: ${result.resolution}`)
    console.log(`⏱️  时长: ${result.duration}s`)
    console.log('')
    console.log('视频链接已在上面，可直接打开查看')
  } else {
    console.error(`❌ 生成失败: ${result.error}`)
  }
}

main().catch(err => {
  console.error('❌ 测试失败:', err)
  process.exit(1)
})
