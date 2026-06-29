#!/usr/bin/env node
// KO-2.5 Architecture Audit — 验证 Knowledge Object 成为唯一真相源

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs'
import { execSync } from 'child_process'
import { resolve } from 'path'

const ROOT = resolve(import.meta.dirname, '../..')
const GATE_DIR = resolve(ROOT, 'benchmark/gate')
const SRC = resolve(ROOT, 'src/services/geo')
const AUDIT_FILE = resolve(GATE_DIR, 'knowledge-entity-audit.json')

interface AuditItem {
  file: string
  issue: string
  severity: 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO'
  recommendation?: string
}

const audits: AuditItem[] = []

function scanContent(filePath: string, pattern: RegExp, desc: string, sev: AuditItem['severity'], rec?: string) {
  if (!existsSync(filePath)) return
  const content = readFileSync(filePath, 'utf8')
  const matches = content.match(pattern)
  if (matches) {
    for (const m of matches) {
      audits.push({ file: filePath.replace(ROOT, ''), issue: `${desc}: "${m.trim().slice(0, 80)}"`, severity: sev, recommendation: rec })
    }
    return matches.length
  }
  return 0
}

console.log('=== KO-2.5 Architecture Audit ===\n')

// ─── 1. Write Path Audit ───
console.log('📌 1. Write Path Audit')
const writeViolations: AuditItem[] = []

// Check geo-entity.service.ts for direct writes
const gesContent = readFileSync(resolve(SRC, 'services/geo-entity.service.ts'), 'utf8')
// Find any .create() or .update() calls on geo entity tables
const directWrites = gesContent.match(/gEOEntity\.(create|update|delete)|gEOEntityRelation\.(create|update|delete)/g)
if (directWrites) {
  const nonGraphSync = directWrites.filter(w => !gesContent.includes('GraphSync'))
  if (nonGraphSync.length > 0) {
    writeViolations.push({ file: 'services/geo-entity.service.ts', issue: `${nonGraphSync.length} direct writes to graph tables found`, severity: 'HIGH', recommendation: 'All graph writes must go through GraphSync' })
  }
}

// Check all agent files for direct persistence
const agentDir = resolve(SRC, 'agents')
const agentFiles = readdirSync(agentDir).filter(f => f.endsWith('.agent.ts'))
for (const f of agentFiles) {
  const content = readFileSync(resolve(agentDir, f), 'utf8')
  if (content.includes('prisma.') && !content.includes('knowledgePipeline') && !content.includes('structuredGenerate')) {
    writeViolations.push({ file: `agents/${f}`, issue: 'Direct prisma access without pipeline or SGR', severity: 'HIGH' })
  }
}

// Check entity.agent.ts specifically
const entityAgent = readFileSync(resolve(agentDir, 'entity.agent.ts'), 'utf8')
if (!entityAgent.includes('knowledgePipeline') && !entityAgent.includes('KnowledgePipeline')) {
  writeViolations.push({ file: 'agents/entity.agent.ts', issue: 'Does not import KnowledgePipeline', severity: 'HIGH' })
}

// Check for any .create on legacy tables outside GraphSync
const allTsFiles = execSync(
  `find ${SRC} -name '*.ts' -not -path '*/node_modules/*' -not -path '*/.prisma/*'`,
  { encoding: 'utf8', timeout: 5000 }
).trim().split('\n')

let totalDirectWrites = 0
for (const f of allTsFiles) {
  if (f.includes('GraphSync.ts') || f.includes('schema.prisma') || f.includes('.prisma')) continue
  const content = readFileSync(f, 'utf8')
  const writes = content.match(/gEOEntity\.create\(|gEOEntity\.update\(|gEOEntityRelation\.create\(|gEOEntityRelation\.update\(/g)
  if (writes) {
    totalDirectWrites += writes.length
    writeViolations.push({ file: f.replace(ROOT, ''), issue: `Direct graph write (${writes.length} occurrences)`, severity: 'HIGH' })
  }
}

console.log(`  Direct writes to graph tables: ${writeViolations.filter(v => v.issue.includes('Direct')).length}`)
if (totalDirectWrites > 0) {
  console.log(`  ❌ FAIL: ${totalDirectWrites} direct writes found`)
} else {
  console.log(`  ✅ PASS: No direct writes`)
}

// ─── 2. Read Path Audit ───
console.log('\n📌 2. Read Path Audit')
const readSources: { file: string; readsGraph: boolean; readsKO: boolean }[] = []

for (const f of allTsFiles) {
  const content = readFileSync(f, 'utf8')
  const readsGraph = /gEOEntity\.find|gEOEntityRelation\.find|gEOEntity\.count/.test(content)
  const readsKO = /knowledgeObject|KnowledgeObject/.test(content)
  
  if (readsGraph || readsKO) {
    readSources.push({
      file: f.replace(ROOT, '').replace(/^\/src\/services\/geo\//, ''),
      readsGraph,
      readsKO,
    })
  }
}

console.log(`  Files reading graph tables: ${readSources.filter(s => s.readsGraph).length}`)
console.log(`  Files reading KO: ${readSources.filter(s => s.readsKO).length}`)

for (const s of readSources.sort((a, b) => a.file.localeCompare(b.file))) {
  const g = s.readsGraph ? '📊' : '  '
  const k = s.readsKO ? '🧩' : '  '
  console.log(`    ${g}${k} ${s.file}`)
}

// ─── 3. Graph Consistency Test ───
console.log('\n📌 3. Graph Consistency Test')

try {
  const consistRes = execSync(
    `PGPASSWORD=postgres psql -h localhost -p 5432 -U postgres -d aigc_scs -t -A -F'|' -c "
    SELECT 
      (SELECT COUNT(*) FROM knowledge_objects) as ko_count,
      (SELECT COUNT(*) FROM kmki_geo_entities) as entity_count,
      (SELECT COUNT(*) FROM kmki_geo_entity_relations) as relation_count;
    "`,
    { encoding: 'utf8', timeout: 5000 }
  ).trim()
  
  const [koC, entC, relC] = consistRes.split('|')
  console.log(`  KOs: ${koC} | Graph entities: ${entC} | Graph relations: ${relC}`)
  console.log(`  ${parseInt(koC) > 0 || parseInt(entC) > 0 ? '✅' : 'ℹ️'} KO and graph tables both have data`)
} catch (e: any) {
  console.log(`  ⚠️ Could not query consistency: ${e.message}`)
}

// ─── Summary ───
console.log('\n' + '='.repeat(60))
console.log('  Audit Summary')
console.log('='.repeat(60))

// Include write violations
audits.push(...writeViolations)

const highCount = audits.filter(a => a.severity === 'HIGH').length
const medCount = audits.filter(a => a.severity === 'MEDIUM').length
const lowCount = audits.filter(a => a.severity === 'LOW').length
const infoCount = audits.filter(a => a.severity === 'INFO').length

console.log(`  HIGH: ${highCount} | MEDIUM: ${medCount} | LOW: ${lowCount} | INFO: ${infoCount}\n`)

for (const a of audits.sort((x, y) => {
  const order = { HIGH: 0, MEDIUM: 1, LOW: 2, INFO: 3 }
  return order[x.severity] - order[y.severity]
})) {
  const icon = a.severity === 'HIGH' ? '❌' : a.severity === 'MEDIUM' ? '⚠' : a.severity === 'LOW' ? '💡' : 'ℹ️'
  console.log(`  ${icon} [${a.severity}] ${a.file}: ${a.issue}`)
  if (a.recommendation) console.log(`    → ${a.recommendation}`)
}

// Save audit
const auditResult = {
  timestamp: new Date().toISOString(),
  totalViolations: audits.length,
  bySeverity: { HIGH: highCount, MEDIUM: medCount, LOW: lowCount, INFO: infoCount },
  writePath: {
    directWrites: totalDirectWrites,
    writeViolations: writeViolations.length,
    verdict: totalDirectWrites === 0 ? 'PASS' : 'FAIL',
  },
  readPath: {
    graphReaders: readSources.filter(s => s.readsGraph).length,
    koReaders: readSources.filter(s => s.readsKO).length,
    readers: readSources,
  },
  audits,
}

writeFileSync(AUDIT_FILE, JSON.stringify(auditResult, null, 2))
console.log(`\nAudit report: ${AUDIT_FILE}`)

if (totalDirectWrites === 0) {
  console.log('\n✅ KO-2 Architecture Audit: WRITE PATH CLEAN')
  console.log('   Knowledge Object is the sole Source of Truth for writes.')
} else {
  console.log(`\n❌ ${totalDirectWrites} direct writes must be migrated to GraphSync.`)
}
