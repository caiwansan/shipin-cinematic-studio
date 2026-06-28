/**
 * update-aliyun-models.ts — 更新阿里百炼模型配置
 * 将已有的 aliyun_video / aliyun_llm 等模型更新为最新版本
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // 更新 aliyun_video
  const video = await prisma.modelProvider.findUnique({ where: { provider: 'aliyun_video' } })
  if (video && video.modelName === 'wanx2.1-video-pro') {
    await prisma.modelProvider.update({
      where: { provider: 'aliyun_video' },
      data: { modelName: 'wan2.7-t2v', label: '阿里百炼·万相视频' },
    })
    console.log('✅ Updated aliyun_video → wan2.7-t2v')
  } else {
    console.log('⏭️  aliyun_video already up-to-date:', video?.modelName)
  }

  // 更新 aliyun_llm
  const llm = await prisma.modelProvider.findUnique({ where: { provider: 'aliyun_llm' } })
  if (llm && !llm.modelName.includes('qwen3.6')) {
    await prisma.modelProvider.update({
      where: { provider: 'aliyun_llm' },
      data: { modelName: 'qwen3.6-max-preview', label: '阿里百炼·千问' },
    })
    console.log('✅ Updated aliyun_llm → qwen3.6-max-preview')
  } else {
    console.log('⏭️  aliyun_llm already up-to-date:', llm?.modelName)
  }

  // 更新 aliyun_tts 标签
  const tts = await prisma.modelProvider.findUnique({ where: { provider: 'aliyun_tts' } })
  if (tts && tts.label === '阿里百炼·语音合成') {
    await prisma.modelProvider.update({
      where: { provider: 'aliyun_tts' },
      data: { label: '阿里百炼·CosyVoice' },
    })
    console.log('✅ Updated aliyun_tts label')
  } else {
    console.log('⏭️  aliyun_tts label already correct:', tts?.label)
  }

  await prisma.$disconnect()
  console.log('✨ Done')
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
