/**
 * CoverageScanner — 扫描所有 Dataset，建立原始覆盖关系
 *
 * 直接扫描文件系统，不依赖 DatasetValidator。
 * 一次性扫描，输出 CoverageEntry[]，供 CoverageIndex 构建。
 */

import * as fs from 'fs'
import * as path from 'path'
import { CapabilityRegistry } from '../capabilities/registry.js'
import type { CoverageEntry } from './CoverageIndex.js'

const DATASETS_DIR = path.resolve(process.cwd(), 'benchmarks', 'datasets')

/**
 * 使用 CJS require 加载 js-yaml（规避 vitest ESM import 问题）
 */
function loadYaml(filePath: string): any {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const yaml = require('js-yaml')
  return yaml.load(fs.readFileSync(filePath, 'utf-8'))
}

function readAllDatasets(): { id: string; capabilities: string[]; primaryCapability?: string }[] {
  const results: { id: string; capabilities: string[]; primaryCapability?: string }[] = []
  if (!fs.existsSync(DATASETS_DIR)) return results

  const entries = fs.readdirSync(DATASETS_DIR, { withFileTypes: true })
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const metaPath = path.join(DATASETS_DIR, entry.name, 'metadata.yaml')
    if (!fs.existsSync(metaPath)) continue

    try {
      const raw = loadYaml(metaPath)
      if (raw?.capabilities) {
        results.push({
          id: entry.name,
          capabilities: Array.isArray(raw.capabilities) ? raw.capabilities : [],
          primaryCapability: raw.primaryCapability,
        })
      }
    } catch {
      // skip malformed
    }
  }

  return results
}

export function scanAllDatasets(): CoverageEntry[] {
  const datasets = readAllDatasets()
  const allCapIds = CapabilityRegistry.listIds()
  const entries: Map<string, CoverageEntry> = new Map()

  for (const id of allCapIds) {
    const def = CapabilityRegistry.byId(id)
    entries.set(id, {
      capability: id,
      primaryDatasets: [],
      secondaryDatasets: [],
      totalCoverage: 0,
      stage: def?.stage ?? 'unknown',
      difficulty: def?.difficulty ?? 'L0',
      gap: true,
      evidence: [],
      metrics: {},
    })
  }

  for (const ds of datasets) {
    for (const cap of ds.capabilities) {
      const entry = entries.get(cap)
      if (!entry) continue
      if (cap === ds.primaryCapability) {
        entry.primaryDatasets.push(ds.id)
      } else {
        entry.secondaryDatasets.push(ds.id)
      }
    }
  }

  for (const entry of entries.values()) {
    entry.totalCoverage = entry.primaryDatasets.length + entry.secondaryDatasets.length
    entry.gap = entry.totalCoverage === 0
  }

  return Array.from(entries.values())
}

export function computeSummary(entries: CoverageEntry[]): import('./CoverageIndex.js').CoverageSummary {
  let covered = 0
  let missing = 0
  let weak = 0
  let sparse = 0

  for (const entry of entries) {
    if (!entry.gap) {
      covered++
    } else {
      const level = entry.primaryDatasets.length === 0 && entry.secondaryDatasets.length === 0 ? 'P0'
        : entry.primaryDatasets.length === 0 ? 'P1'
        : 'P2'
      if (level === 'P0') missing++
      else if (level === 'P1') weak++
      else if (level === 'P2') sparse++
    }
  }

  return {
    total: entries.length,
    covered,
    missing,
    weak,
    sparse,
    coverageScore: entries.length > 0 ? Math.round((covered / entries.length) * 100) : 0,
  }
}
