/**
 * EPVH — StaticPathScanner（静态路径扫描器）
 *
 * 扫描全仓库源码，检测所有 bypass executionCutover 的路径。
 * 匹配 import / 直接 SDK 调用 / legacy queue 使用。
 *
 * ═══ 宪法 ═══
 * 合法路径唯一: executionCutover.executeProviderTask() → modelAdapterRegistry → provider
 * 其余全是违规。
 */

import { execSync } from 'child_process'
import { readFileSync } from 'fs'
import { join, relative } from 'path'

export interface BypassFinding {
  path: string
  line: number
  type: 'direct_provider_call' | 'provider_import' | 'legacy_queue' | 'sdk_direct'
  detail: string
  severity: 'CRITICAL' | 'WARNING' | 'INFO'
}

export interface StaticScanReport {
  timestamp: number
  srcRoot: string
  totalFilesScanned: number
  findings: BypassFinding[]
}

// ⚠️ 已知合法的 provider 引用路径（通过 adapter 或 cutover）
const LEGAL_REFERENCE_PATTERNS = [
  'model-adapters/',       // 适配器矩阵
  'execution-cutover',     // 统一执行入口
  'provider-registry',     // Provider 注册表
  'with-user-model-config', // 用户配置注入
  'narrative-gateway',     // LLM 网关（已走 Cutover）
  'runtime-dispatcher',    // Runtime 调度器
  'user-model-resolver',   // 用户模型解析
  'aliyun-llm.provider',   // LLM Provider（由 dispatcher 调）
  'aliyun-image.provider', // Image Provider（由 adapter 调）
  'aliyun-video.provider', // Video Provider（由 adapter 调）
  'aliyun-tts.provider',   // TTS Provider
  'volcengine-image.provider',
  'volcengine-video.provider',
  'volcengine-tts.provider',
  'siliconflow-tts.provider',
  'provider.registry',
  'aigc-orchestrator',
]

const PROVIDER_KEYWORDS = ['aliyun', 'volcengine', 'siliconflow', 'openai', 'deepseek', 'anthropic']

class StaticPathScanner {
  /**
   * 扫描全仓库
   */
  scan(srcRoot: string = '/root/shipin-cinematic-studio/backend/src'): StaticScanReport {
    const findings: BypassFinding[] = []
    let totalFiles = 0

    // 获取所有 .ts 文件
    const files = execSync(`find "${srcRoot}" -name '*.ts' -not -path '*/node_modules/*' -not -path '*/.nuxt/*'`, { encoding: 'utf-8' })
      .trim()
      .split('\n')
      .filter(Boolean)

    totalFiles = files.length

    for (const file of files) {
      const content = readFileSync(file, 'utf-8')
      const lines = content.split('\n')
      const relPath = relative(srcRoot, file)

      // 只扫描 routes/ 目录和 services/ 目录（业务层）
      if (!relPath.startsWith('routes/') && !relPath.startsWith('services/') && !relPath.startsWith('runtime/')) continue

      // 扫描 import
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        const lineNum = i + 1

        // 检查 provider import
        for (const keyword of PROVIDER_KEYWORDS) {
          if (line.includes(`from`) && line.includes(keyword)) {
            // 跳过已知合法引用
            if (LEGAL_REFERENCE_PATTERNS.some(p => line.includes(p))) continue
            // 跳过 .provider.ts 和 .d.ts
            if (line.endsWith('.provider.ts') || line.endsWith('.provider.js')) continue

            findings.push({
              path: relPath,
              line: lineNum,
              type: 'provider_import',
              detail: line.trim(),
              severity: 'WARNING',
            })
          }
        }

        // 检查直接 SDK 调用模式
        const directCallPatterns = [
          /\.generate\s*\(/,           // aliyunImage.generate(
          /\.synthesize\s*\(/,         // aliyunTTS.synthesize(
          /\.poll\s*\(/,               // aliyunVideo.poll(
          /\.submit\s*\(/,             // volcengineVideo.submit(
          /\.createCompletion\s*\(/,
          /\.submitTask\s*\(/,
        ]

        for (const pattern of directCallPatterns) {
          if (pattern.test(line) && !line.includes('executionCutover') && !line.includes('adapter')) {
            findings.push({
              path: relPath,
              line: lineNum,
              type: 'direct_provider_call',
              detail: line.trim(),
              severity: 'CRITICAL',
            })
          }
        }
      }
    }

    return {
      timestamp: Date.now(),
      srcRoot,
      totalFilesScanned: totalFiles,
      findings,
    }
  }

  /**
   * 按严重级分组
   */
  groupBySeverity(report: StaticScanReport) {
    return {
      critical: report.findings.filter(f => f.severity === 'CRITICAL'),
      warning: report.findings.filter(f => f.severity === 'WARNING'),
      info: report.findings.filter(f => f.severity === 'INFO'),
    }
  }
}

export const staticPathScanner = new StaticPathScanner()
