/**
 * Dataset Capability Validator
 *
 * 检查每个 Dataset 的 capability 引用是否合法：
 *   ① primaryCapability 必须存在
 *   ② primaryCapability 必须属于 capabilities 列表
 *   ③ capability 必须存在于 Registry
 *   ④ capability 不允许重复
 *   ⑤ Dataset 至少拥有一个 capability
 *   ⑥ Stage Consistency：Dataset 的 stage 标签 vs Capability Registry 的 stage
 *   ⑦ Difficulty Consistency：Dataset 的 level vs Capability Registry 的 difficulty
 */

import * as fs from 'fs'
import * as path from 'path'
import yaml from 'js-yaml'
import type { ValidationItem } from './ValidationReport.js'
import { CapabilityRegistry } from '../capabilities/registry.js'

export const DATASETS_DIR = path.resolve(process.cwd(), 'benchmarks', 'datasets')

export interface LoadedDataset {
  id: string
  level: string
  metadata: {
    primaryCapability?: string
    capabilities?: string[]
    stage?: string
    [key: string]: any
  }
}

/**
 * 加载所有 Dataset（metadata.yaml 扫描）
 */
export function loadAllDatasets(): LoadedDataset[] {
  const datasets: LoadedDataset[] = []
  if (!fs.existsSync(DATASETS_DIR)) return datasets

  const entries = fs.readdirSync(DATASETS_DIR, { withFileTypes: true })
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const metaPath = path.join(DATASETS_DIR, entry.name, 'metadata.yaml')
    if (!fs.existsSync(metaPath)) continue

    try {
      const raw = yaml.load(fs.readFileSync(metaPath, 'utf-8')) as any
      datasets.push({
        id: entry.name,
        level: raw?.level ?? 'L0',
        metadata: {
          primaryCapability: raw?.primaryCapability,
          capabilities: raw?.capabilities ?? [],
          stage: raw?.stage,
          ...raw,
        },
      })
    } catch {
      // skip malformed
    }
  }

  return datasets
}

/**
 * 验证单个 Dataset 的 Capability 引用。
 */
export function validateDatasetCapabilities(ds: LoadedDataset): ValidationItem[] {
  const items: ValidationItem[] = []
  const caps: string[] = ds.metadata.capabilities ?? []
  const primary: string | undefined = ds.metadata.primaryCapability

  // ① primaryCapability 必须存在
  if (!primary) {
    items.push({
      type: 'MissingPrimaryCapability',
      severity: 'error',
      dataset: ds.id,
      message: `Dataset "${ds.id}": metadata.primaryCapability is missing`,
    })
  }

  // ⑤ Dataset 至少拥有一个 capability
  if (!caps || caps.length === 0) {
    items.push({
      type: 'EmptyCapabilitySet',
      severity: 'error',
      dataset: ds.id,
      message: `Dataset "${ds.id}": capabilities list is empty`,
    })
  }

  // 检查每个 capability
  const seen = new Set<string>()
  for (const cap of caps) {
    // ④ capability 不允许重复
    if (seen.has(cap)) {
      items.push({
        type: 'DuplicateCapability',
        severity: 'error',
        dataset: ds.id,
        capability: cap,
        message: `Dataset "${ds.id}": duplicate capability "${cap}"`,
      })
      continue
    }
    seen.add(cap)

    // ③ capability 必须存在于 Registry
    if (!CapabilityRegistry.exists(cap)) {
      items.push({
        type: 'UnknownCapability',
        severity: 'error',
        dataset: ds.id,
        capability: cap,
        message: `Dataset "${ds.id}": unknown capability "${cap}" (not in Registry)`,
      })
    } else {
      // ⑥ Stage Consistency
      const def = CapabilityRegistry.byId(cap)!
      if (ds.metadata.stage && def.stage !== ds.metadata.stage) {
        items.push({
          type: 'StageMismatch',
          severity: 'warning',
          dataset: ds.id,
          capability: cap,
          message: `Dataset "${ds.id}": stage "${ds.metadata.stage}" but capability "${cap}" requires stage "${def.stage}"`,
        })
      }

      // ⑦ Difficulty Consistency
      if (ds.level && def.difficulty !== ds.level) {
        items.push({
          type: 'DifficultyMismatch',
          severity: 'warning',
          dataset: ds.id,
          capability: cap,
          message: `Dataset "${ds.id}": level "${ds.level}" but capability "${cap}" is difficulty "${def.difficulty}"`,
        })
      }
    }
  }

  // ② primaryCapability 必须属于 capabilities 列表
  if (primary && caps.length > 0 && !caps.includes(primary)) {
    items.push({
      type: 'PrimaryCapabilityNotIncluded',
      severity: 'error',
      dataset: ds.id,
      capability: primary,
      message: `Dataset "${ds.id}": primaryCapability "${primary}" is not in capabilities list`,
    })
  }

  return items
}

/**
 * 验证所有 Dataset
 */
export function validateAllDatasets(): ValidationItem[] {
  const items: ValidationItem[] = []
  const datasets = loadAllDatasets()

  for (const ds of datasets) {
    items.push(...validateDatasetCapabilities(ds))
  }

  return items
}
