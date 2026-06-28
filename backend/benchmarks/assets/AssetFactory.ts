/**
 * Capability Asset 工厂 — 标准化 Dataset 生成器
 *
 * P1.4.2: 每个 Dataset 按固定模板生成，包含 failureModes + evaluationCriteria + Gold Reference。
 * 不允许直接手写 YAML 绕过模板。
 */

import * as fs from 'fs'
import * as path from 'path'
// @ts-ignore
const yaml = require('js-yaml') as any
import type { CapabilityAsset, AssetMetadata, FailureMode, EvaluationCriterion, GoldReference } from './AssetTypes.js'
import { CapabilityRegistry } from '../capabilities/registry.js'

const ASSETS_DIR = path.resolve(process.cwd(), 'benchmarks', 'assets', 'datasets')

/**
 * 生成一个完整的 CapabilityAsset
 *
 * 所有字段都必须明确提供。
 * failureModes 和 evaluationCriteria 是必选项（不能为空数组——至少有一个）。
 */
export function createAsset(
  metadata: AssetMetadata,
  failureModes: FailureMode[],
  evaluationCriteria: EvaluationCriterion[],
  goldReference?: GoldReference,
): CapabilityAsset {
  // 校验 primaryCapability 必须在 Registry 中
  if (!CapabilityRegistry.exists(metadata.primaryCapability)) {
    throw new Error(`Unknown primaryCapability: ${metadata.primaryCapability}`)
  }

  // 校验 secondaryCapabilities 都在 Registry 中
  for (const cap of metadata.secondaryCapabilities) {
    if (!CapabilityRegistry.exists(cap)) {
      throw new Error(`Unknown secondaryCapability: ${cap}`)
    }
  }

  // failureModes 不能为空
  if (failureModes.length === 0) {
    throw new Error('failureModes must not be empty')
  }

  // evaluationCriteria 不能为空
  if (evaluationCriteria.length === 0) {
    throw new Error('evaluationCriteria must not be empty')
  }

  return {
    metadata,
    failureModes,
    evaluationCriteria,
    goldReference,
  }
}

/**
 * 写出 Asset 到文件系统
 */
export function writeAsset(asset: CapabilityAsset): string {
  const dir = path.join(ASSETS_DIR, asset.metadata.id)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  const metaPath = path.join(dir, 'metadata.yaml')
  fs.writeFileSync(metaPath, yaml.dump(asset.metadata, { indent: 2, lineWidth: 120 }), 'utf-8')

  const failurePath = path.join(dir, 'failure-modes.yaml')
  fs.writeFileSync(failurePath, yaml.dump(asset.failureModes, { indent: 2 }), 'utf-8')

  const criteriaPath = path.join(dir, 'evaluation-criteria.yaml')
  fs.writeFileSync(criteriaPath, yaml.dump(asset.evaluationCriteria, { indent: 2 }), 'utf-8')

  if (asset.goldReference) {
    const goldPath = path.join(dir, 'gold-reference.json')
    fs.writeFileSync(goldPath, JSON.stringify(asset.goldReference, null, 2), 'utf-8')
  }

  const inputPath = path.join(dir, 'input')
  if (!fs.existsSync(inputPath)) {
    fs.mkdirSync(inputPath)
  }

  return dir
}

/**
 * 读取 Asset
 */
export function readAsset(id: string): CapabilityAsset | null {
  const dir = path.join(ASSETS_DIR, id)
  if (!fs.existsSync(dir)) return null

  const metaPath = path.join(dir, 'metadata.yaml')
  const failurePath = path.join(dir, 'failure-modes.yaml')
  const criteriaPath = path.join(dir, 'evaluation-criteria.yaml')
  const goldPath = path.join(dir, 'gold-reference.json')

  if (!fs.existsSync(metaPath)) return null

  try {
    const metadata = yaml.load(fs.readFileSync(metaPath, 'utf-8')) as AssetMetadata
    const failureModes = fs.existsSync(failurePath)
      ? yaml.load(fs.readFileSync(failurePath, 'utf-8')) as FailureMode[]
      : []
    const evaluationCriteria = fs.existsSync(criteriaPath)
      ? yaml.load(fs.readFileSync(criteriaPath, 'utf-8')) as EvaluationCriterion[]
      : []
    const goldReference = fs.existsSync(goldPath)
      ? JSON.parse(fs.readFileSync(goldPath, 'utf-8')) as GoldReference
      : undefined

    return { metadata, failureModes, evaluationCriteria, goldReference }
  } catch {
    return null
  }
}

/**
 * 资产验证（Dataset Quality Gate）
 */
export function validateAsset(asset: CapabilityAsset): string[] {
  const errors: string[] = []

  // 必须有唯一 primaryCapability
  if (!asset.metadata.primaryCapability) {
    errors.push('Missing primaryCapability')
  }

  // primaryCapability 必须在 Registry
  if (asset.metadata.primaryCapability && !CapabilityRegistry.exists(asset.metadata.primaryCapability)) {
    errors.push(`Unknown primaryCapability: ${asset.metadata.primaryCapability}`)
  }

  // failureModes 不能为空
  if (asset.failureModes.length === 0) {
    errors.push('failureModes is empty')
  }

  // 每个 failureMode 必须有 description
  for (const fm of asset.failureModes) {
    if (!fm.description) {
      errors.push(`failureMode ${fm.id} missing description`)
    }
    if (!fm.expectedBehavior) {
      errors.push(`failureMode ${fm.id} missing expectedBehavior`)
    }
  }

  // evaluationCriteria 不能为空
  if (asset.evaluationCriteria.length === 0) {
    errors.push('evaluationCriteria is empty')
  }

  // weight 之和应接近 1
  const weightSum = asset.evaluationCriteria.reduce((s, c) => s + (c.weight ?? 0), 0)
  if (Math.abs(weightSum - 1) > 0.01 && asset.evaluationCriteria.length > 0) {
    errors.push(`evaluationCriteria weights sum to ${weightSum}, expected 1`)
  }

  return errors
}
