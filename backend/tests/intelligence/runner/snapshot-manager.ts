/**
 * Snapshot Manager
 *
 * Versioned snapshot management for golden test results.
 * Handles save/load/diff across versions.
 */

import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'
import type { DiffResult } from './diff-engine'
import { computeDiff } from './diff-engine'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const BASE_DIR = path.resolve(__dirname, '../golden')

export interface SnapshotManager {
  save(domain: string, version: string, results: any): Promise<void>
  load(domain: string, version: string): Promise<any>
  diff(domain: string, oldVersion: string, newVersion: string): Promise<DiffResult>
}

function getSnapshotPath(domain: string, version: string): string {
  return path.join(BASE_DIR, domain, 'snapshots', `${version}.json`)
}

export const snapshotManager: SnapshotManager = {
  async save(domain: string, version: string, results: any): Promise<void> {
    const filePath = getSnapshotPath(domain, version)
    const dir = path.dirname(filePath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    const data = JSON.stringify(
      {
        version,
        domain,
        timestamp: new Date().toISOString(),
        results,
      },
      null,
      2,
    )
    fs.writeFileSync(filePath, data, 'utf-8')
  },

  async load(domain: string, version: string): Promise<any> {
    const filePath = getSnapshotPath(domain, version)
    if (!fs.existsSync(filePath)) {
      throw new Error(`Snapshot not found: ${domain}/${version} (${filePath})`)
    }
    const raw = fs.readFileSync(filePath, 'utf-8')
    return JSON.parse(raw)
  },

  async diff(domain: string, oldVersion: string, newVersion: string): Promise<DiffResult> {
    const oldSnap = await this.load(domain, oldVersion)
    const newSnap = await this.load(domain, newVersion)
    return computeDiff(oldSnap.results, newSnap.results)
  },
}

export default snapshotManager
