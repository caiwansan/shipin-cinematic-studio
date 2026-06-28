/**
 * services/export-runtime.ts — 导出运行时
 *
 * 负责: 收集项目资产 → 打包 → 存储 → 更新 DB
 */
import { prisma } from '../utils/index.js'
import { artifactStorage, ArtifactMeta } from '../storage/artifact-storage.js'
import { createTrace, addSpan, completeTrace } from '../observability/trace.js'
import { taskEventEmitter } from '../utils/index.js'
import { join } from 'path'
import { mkdir, writeFile, readFile, copyFile, access } from 'fs/promises'
import { createWriteStream, existsSync } from 'fs'
import { tmpdir } from 'os'
import { randomUUID } from 'crypto'

interface CollectResult {
  storyboardImages: any[]
  frameImages: any[]
  sceneImages: any[]
  voiceFiles: { name: string; path: string }[]
  segments: any[]
  metadata: {
    projectName: string
    description: string
    createdAt: string
    totalAssets: number
  }
}

export class ExportRuntime {
  /**
   * 创建导出任务
   */
  async createExportTask(params: {
    userId: string
    projectId: string
    exportType?: string
  }): Promise<any> {
    const traceId = createTrace({ userId: params.userId, projectId: params.projectId, taskType: 'export' })

    const task = await prisma.exportTask.create({
      data: {
        userId: params.userId,
        projectId: params.projectId,
        status: 'queued',
        exportType: params.exportType || 'zip',
        traceId,
      },
    })

    taskEventEmitter.emit('task:progress', {
      taskId: task.id,
      status: 'queued',
      progress: 0,
      traceId,
    })

    // 使用统一队列入队
    const { enqueueTask } = await import('../queue/queue-manager.js')
    await enqueueTask({
      taskType: 'export',
      projectId: params.projectId,
      userId: params.userId,
      input: { taskId: task.id, exportType: params.exportType },
      taskId: task.id,
    })

    // 异步开始处理
    this.processExport(task.id, traceId).catch(err => {
      console.error(`[Export] Task ${task.id} failed:`, err)
    })

    return { id: task.id, status: 'queued', traceId }
  }

  /**
   * 获取导出任务状态
   */
  async getTask(taskId: string): Promise<any> {
    return prisma.exportTask.findUnique({ where: { id: taskId } })
  }

  /**
   * 处理导出（异步）
   */
  private async processExport(taskId: string, traceId: string): Promise<void> {
    let task = await prisma.exportTask.findUnique({ where: { id: taskId } })
    if (!task) return

    try {
      // 1. Collecting
      await this.updateTask(taskId, { status: 'collecting', progress: 10 })
      addSpan(traceId, 'collect_assets', 'ok')
      const assets = await this.collectAssets(task.projectId)
      taskEventEmitter.emit('task:progress', { taskId, status: 'collecting', progress: 30, traceId })

      // 2. Packaging
      await this.updateTask(taskId, { status: 'packaging', progress: 40 })
      const workDir = join(tmpdir(), `export-${taskId}`)
      await mkdir(workDir, { recursive: true })

      const packagePath = await this.buildPackage(workDir, assets)
      addSpan(traceId, 'build_package', 'ok')
      taskEventEmitter.emit('task:progress', { taskId, status: 'packaging', progress: 70, traceId })

      // 3. Upload
      await this.updateTask(taskId, { status: 'uploading', progress: 80 })
      const readStream = await import('fs').then(fs => fs.createReadStream(packagePath))
      const result = await artifactStorage.store(readStream, `project-${task.projectId}.zip`)
      addSpan(traceId, 'store_artifact', 'ok')

      // 4. Complete
      await this.updateTask(taskId, {
        status: 'completed',
        progress: 100,
        outputUrl: result.url,
        packageSize: result.meta.size,
        completedAt: new Date(),
      })

      completeTrace(traceId)
      taskEventEmitter.emit('task:progress', {
        taskId, status: 'completed', progress: 100, traceId,
        outputUrl: result.url, packageSize: result.meta.size,
      })

      // 清理临时目录
      this.cleanupTempDir(workDir)

    } catch (err: any) {
      console.error(`[Export] Error processing ${taskId}:`, err)
      await this.updateTask(taskId, { status: 'failed', error: err.message })
      completeTrace(traceId, err.message)
      taskEventEmitter.emit('task:progress', { taskId, status: 'failed', error: err.message, traceId })
    }
  }

  /**
   * 收集项目所有资产
   */
  private async collectAssets(projectId: string): Promise<CollectResult> {
    const [project, storyboardImages, frameImages, sceneImages, segments] = await Promise.all([
      prisma.project.findUnique({ where: { id: projectId } }),
      prisma.storyboardImage.findMany({ where: { projectId }, orderBy: { sortOrder: 'asc' } }),
      prisma.frameImage.findMany({ where: { projectId } }),
      prisma.sceneImage.findMany({ where: { projectId } }),
      prisma.videoSegment.findMany({
        where: { task: { projectId } },
        include: { task: true },
      }),
    ])

    // 收集语音文件
    const voiceFiles: { name: string; path: string }[] = []
    // 从数据库找 voice 相关字段 - 实际上 VoiceConfig 可能在 project 的 designSpec 里
    // 现阶段尝试收集已生成的视频片段文件
    for (const seg of segments) {
      if (seg.filePath && existsSync(seg.filePath)) {
        voiceFiles.push({ name: `segment_${seg.shotIndex}.mp4`, path: seg.filePath })
      }
    }

    return {
      storyboardImages,
      frameImages,
      sceneImages,
      voiceFiles,
      segments,
      metadata: {
        projectName: project?.name || 'unknown',
        description: project?.description || '',
        createdAt: project?.createdAt?.toISOString() || new Date().toISOString(),
        totalAssets: storyboardImages.length + frameImages.length + sceneImages.length + segments.length,
      },
    }
  }

  /**
   * 构建导出包
   */
  private async buildPackage(workDir: string, assets: CollectResult): Promise<string> {
    const baseDir = join(workDir, 'project')
    await mkdir(join(baseDir, 'assets'), { recursive: true })
    await mkdir(join(baseDir, 'audio'), { recursive: true })
    await mkdir(join(baseDir, 'frames'), { recursive: true })
    await mkdir(join(baseDir, 'storyboard'), { recursive: true })

    // 写入 manifest.json
    await writeFile(join(baseDir, 'manifest.json'), JSON.stringify({
      version: '1.0',
      exportDate: new Date().toISOString(),
      project: assets.metadata,
      assetCounts: {
        storyboardImages: assets.storyboardImages.length,
        frameImages: assets.frameImages.length,
        sceneImages: assets.sceneImages.length,
        segments: assets.segments.length,
        voiceFiles: assets.voiceFiles.length,
      },
    }, null, 2))

    // 写入 timeline.json
    await writeFile(join(baseDir, 'timeline.json'), JSON.stringify({
      segments: assets.segments.map(s => ({
        index: s.shotIndex,
        status: s.status,
        duration: s.duration,
      })),
    }, null, 2))

    // 写入 metadata.json
    await writeFile(join(baseDir, 'metadata.json'), JSON.stringify(assets.metadata, null, 2))

    // 写入 assets 索引
    await writeFile(join(baseDir, 'assets', 'storyboard.json'), JSON.stringify(assets.storyboardImages, null, 2))
    await writeFile(join(baseDir, 'assets', 'frames.json'), JSON.stringify(assets.frameImages, null, 2))
    await writeFile(join(baseDir, 'assets', 'scenes.json'), JSON.stringify(assets.sceneImages, null, 2))

    // 打包为 ZIP
    const outputPath = join(workDir, 'export.zip')

    const archiverMod = await import('archiver')
    const archiver = archiverMod.default || archiverMod
    const output = createWriteStream(outputPath)
    const archive = archiver('zip', { zlib: { level: 6 } })

    return new Promise((resolve, reject) => {
      output.on('close', () => resolve(outputPath))
      archive.on('error', reject)
      archive.pipe(output)
      archive.directory(baseDir, 'project')
      // 添加语音文件
      for (const vf of assets.voiceFiles) {
        try {
          archive.file(vf.path, { name: `project/audio/${vf.name}` })
        } catch { /* skip missing */ }
      }
      archive.finalize()
    })
  }

  private async updateTask(taskId: string, data: any): Promise<void> {
    await prisma.exportTask.update({ where: { id: taskId }, data })
  }

  private async cleanupTempDir(dir: string): Promise<void> {
    try {
      const { rm } = await import('fs/promises')
      await rm(dir, { recursive: true, force: true })
    } catch { /* ignore */ }
  }
}

export const exportRuntime = new ExportRuntime()
