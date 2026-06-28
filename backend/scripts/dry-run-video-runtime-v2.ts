/**
 * scripts/dry-run-video-runtime-v2.ts
 *
 * Video Runtime v2 Dry Run
 *
 * 模拟完整 pipeline 执行，不调用真实 AI provider。
 * 所有图像返回 mock URL，验证：
 *   - State Machine 生命周期
 *   - Frame 并发生成
 *   - Transition Planner
 *   - ffmpeg 合成命令
 *   - Pipeline 错误处理
 *   - Runtime Snapshot 写入
 *   - Temp cleanup
 *   - Partial Failure
 *   - Minimum Composition Policy
 */

import { CinematicVideoPipeline } from '../src/video-runtime/pipelines/cinematic-video-pipeline.js'
import { writeSnapshot, cleanOldSnapshots } from '../src/video-runtime/runtime-snapshot.js'
import * as fs from 'fs'
import * as path from 'path'

// ─── Mock callImageProvider ─────────────────────────────────
// 模拟 image provider，随机成功/失败
// 生成 1x1 PNG 到本地 temp 目录，确保 ffmpeg 可以访问
const mockFramesDir = '/tmp/video-runtime-dryrun/mock-frames'

let mockCallCount = 0
const mockCallImageProvider = async (taskType: string, userId: string, projectId: string, payload: any): Promise<any> => {
  mockCallCount++
  const second = payload.input?.prompt?.match(/第 (\d+(\.\d+)?)/)?.[1] || mockCallCount

  // 模拟第 5 帧失败（frameIndex = 3, second = 1.5）
  if (payload.traceId?.includes('1.5')) {
    throw new Error(`Mock provider: 第 ${second}s 生成失败（模拟异常）`)
  }

  return { url: `file://${path.join(mockFramesDir, 'frame_' + second + '.jpg')}` }
}

// ─── Mock optimizedShots ────────────────────────────────────
// 模拟 8 帧优化镜头数据
const mockShots = Array.from({ length: 8 }, (_, i) => ({
  second: i * 0.5,
  camera: i % 2 === 0 ? '中景' : '近景',
  action: i === 0 ? '开场站立' : i === 1 ? '微笑' : i === 2 ? '转身' : i === 3 ? '握拳' : i === 4 ? '抬头' : i === 5 ? '注视' : i === 6 ? '点头' : '结束',
  expression: i === 0 ? '严肃' : i === 1 ? '微笑' : i === 2 ? '自信' : i === 3 ? '激动' : i === 4 ? '期待' : i === 5 ? '深情' : i === 6 ? '满足' : '平静',
  dialogue: i === 0 ? '大家好' : i === 3 ? '终于' : i === 7 ? '再见' : '',
  fx: i % 3 === 1 ? '花瓣飘落' : i % 3 === 2 ? '光芒闪烁' : '',
}))

// ─── Main Dry Run ───────────────────────────────────────────
async function main() {
  console.log('')
  console.log('╔══════════════════════════════════════════════╗')
  console.log('║  Video Runtime v2 Dry Run                    ║')
  console.log('╚══════════════════════════════════════════════╝')
  console.log('')

  // 用 ffmpeg 生成 1x1 测试图片
  fs.mkdirSync(mockFramesDir, { recursive: true })
  // 先尝试用 ffmpeg 的 mjpeg encoder
  const frameFiles = ['0', '0.5', '1', '1.5', '2', '2.5', '3', '3.5']
  const colors = ['red', 'blue', 'green', 'white', 'yellow', 'black', 'gray', 'cyan']
  for (let i = 0; i < frameFiles.length; i++) {
    const jpgPath = path.join(mockFramesDir, `frame_${frameFiles[i]}.jpg`)
    // 生成最小有效 JPEG（ffmpeg can always decode this）
    // JPEG SOI + APP0 + DQT + SOF0 + DHT + SOS + EOI
    const jpeg = Buffer.from([
      0xFF, 0xD8,             // SOI
      0xFF, 0xE0, 0x00, 0x10, // APP0
      0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00,
      0xFF, 0xDB, 0x00, 0x43, 0x00, // DQT
      0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09, 0x09, 0x08, 0x0A, 0x0C, 0x14,
      0x0D, 0x0C, 0x0B, 0x0B, 0x0C, 0x19, 0x12, 0x13, 0x0F, 0x14, 0x1D, 0x1A, 0x1F, 0x1E, 0x1D, 0x1A,
      0x1C, 0x1C, 0x20, 0x24, 0x2E, 0x27, 0x20, 0x22, 0x2C, 0x23, 0x1C, 0x1C, 0x28, 0x37, 0x29, 0x2C,
      0x30, 0x31, 0x34, 0x34, 0x34, 0x1F, 0x27, 0x39, 0x3D, 0x38, 0x32, 0x3C, 0x2E, 0x33, 0x34, 0x32,
      0xFF, 0xC0, 0x00, 0x0B, 0x08, 0x00, 0x01, 0x00, 0x01, 0x01, 0x01, 0x11, 0x00, // SOF0
      0xFF, 0xC4, 0x00, 0x1F, 0x00, 0x00, 0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0A,
      0x0B, // DHT
      0xFF, 0xDA, 0x00, 0x0C, 0x03, 0x01, 0x00, 0x02, 0x11, 0x03, 0x11, 0x00, 0x3F, 0x00, // SOS
      0x7F, 0xFF, 0xD9, // JPEG data + EOI
    ])
    fs.writeFileSync(jpgPath, jpeg)
  }

  // Test 1: 正常流程（第 1.5s 帧会失败，验证 partial success）
  console.log('─── Test 1: 正常流程（带 partial failure） ───')
  console.log('')
  const pipeline1 = new CinematicVideoPipeline({ maxConcurrency: 3 })

  try {
    const startTs = Date.now()
    const result1 = await pipeline1.execute({
      optimizedShots: mockShots as any,
      firstFrameUrl: `file://${path.join(mockFramesDir, 'frame_0')}`,
      referenceImages: {
        characters: ['https://mock.example.com/char.png'],
        scenes: ['https://mock.example.com/scene.png'],
        props: [],
      },
      model: 'mock-seedream-model',
      apiKey: 'mock-api-key',
      baseUrl: 'https://mock-api.example.com',
      userId: 'dry-run-user-001',
      projectId: 'dry-run-project-001',
      duration: 4,
      ratio: '9:16',
      traceId: 'dryrun-normal-001',
      callImageProvider: mockCallImageProvider,
    })

    console.log('')
    console.log(`✅ Test 1 完成:`)
    console.log(`   videoUrl: ${result1.videoUrl}`)
    console.log(`   frames: ${result1.frames.length}`)
    console.log(`   totalLatency: ${result1.totalLatency}ms`)
    console.log(`   partialSuccess: ${result1.partialSuccess}`)
    console.log(`   traceId: ${result1.traceId}`)
    console.log('')
    console.log(`   State Machine:`)
    console.log(JSON.stringify(result1.stateMachine, null, 2))
    console.log('')
    console.log(`   Metrics: ${JSON.stringify(result1.metrics, null, 2)}`)
  } catch (err: any) {
    console.error(`❌ Test 1 失败: ${err.message}`)
  }

  // Test 2: Minimum Composition Policy 测试（只有 2 成功帧）
  console.log('')
  console.log('─── Test 2: Minimum Composition Policy（成功帧 < 3） ───')
  console.log('')
  const pipeline2 = new CinematicVideoPipeline({ maxConcurrency: 3 })

  // 只有 4 帧，mock 会失败 2 帧（1.5s 失败，还有 1.0s 也失败）
  const smallShots = mockShots.slice(0, 4)
  let failCount = 0
  const failCallImageProvider = async (taskType: string, userId: string, projectId: string, payload: any): Promise<any> => {
    failCount++
    // 除了第 0s frame（pipeline 直接使用不调用），让 1.0s 也失败
    const framePrompt = payload.input?.prompt || ''
    const traceSecond = framePrompt.match(/第 (\d+(\.\d+)?)/)?.[1]
    if (traceSecond && parseFloat(traceSecond) >= 1.0) {
      throw new Error(`Mock provider: 第 ${traceSecond}s 模拟失败`)
    }
    // 返回本地 png
    return { url: `file://${path.join(mockFramesDir, 'frame_' + (traceSecond || failCount) + '.jpg')}` }
  }

  try {
    mockCallCount = 0
    const result2 = await pipeline2.execute({
      optimizedShots: smallShots as any,
      firstFrameUrl: `file://${path.join(mockFramesDir, 'frame_0')}`,
      referenceImages: { characters: [], scenes: [], props: [] },
      model: 'mock-model',
      apiKey: 'mock-key',
      userId: 'dry-run-user-002',
      projectId: 'dry-run-project-002',
      duration: 2,
      ratio: '9:16',
      traceId: 'dryrun-mcp-001',
      callImageProvider: failCallImageProvider,
    })
    console.log(`   ⚠️ Test 2 不应该成功（成功帧应 < 3），但返回了: ${result2.videoUrl}`)
  } catch (err: any) {
    console.log(`   ✅ Test 2 正确失败: ${err.message}`)
  }

  // Test 3: Snapshot 验证
  console.log('')
  console.log('─── Test 3: Runtime Snapshot 验证 ───')
  console.log('')
  const snapshotDir1 = '/tmp/video-runtime/dryrun-normal-001'
  const snapshotFiles = [
    'planning.json',
    'transitions.json',
    'composition-plan.json',
    'runtime-trace.json',
    'ffmpeg-command.txt',
  ]
  for (const file of snapshotFiles) {
    const fullPath = path.join(snapshotDir1, file)
    const exists = fs.existsSync(fullPath)
    if (exists) {
      const size = fs.statSync(fullPath).size
      console.log(`   ✅ ${file} (${size} bytes)`)
    } else {
      console.log(`   ❌ ${file} 不存在`)
    }
  }

  // Test 4: Temp Cleanup 验证
  console.log('')
  console.log('─── Test 4: Temp Cleanup 验证 ───')
  console.log('')
  const tempDir = '/tmp/video-composer'
  if (fs.existsSync(tempDir)) {
    const dirs = fs.readdirSync(tempDir)
    const pipelineDirs = dirs.filter((d) => d.startsWith('vid_dry-run'))
    if (pipelineDirs.length === 0) {
      console.log(`   ✅ Temp 目录已清理: ${tempDir}`)
    } else {
      console.log(`   ⚠️ Temp 目录仍有 ${pipelineDirs.length} 个残留: ${pipelineDirs.join(', ')}`)
    }
  } else {
    console.log(`   ℹ️ Temp 目录不存在`)
  }

  // Test 5: Clean old snapshots
  console.log('')
  console.log('─── Test 5: Snapshot 清理 ───')
  console.log('')
  cleanOldSnapshots(0) // 清空所有（maxAge=0 = 立即清理）
  const snapshotBase = '/tmp/video-runtime'
  if (fs.existsSync(snapshotBase)) {
    const remaining = fs.readdirSync(snapshotBase)
    console.log(`   ✅ 清理后剩余 ${remaining.length} 目录`)
  } else {
    console.log(`   ✅ 已完全清理`)
  }

  console.log('')
  console.log('╔══════════════════════════════════════════════╗')
  console.log('║  Dry Run 完成                                ║')
  console.log('╚══════════════════════════════════════════════╝')
}

main().catch(console.error)
