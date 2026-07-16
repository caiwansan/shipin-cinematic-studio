#!/usr/bin/env node
/**
 * Snapshot Inspector CLI
 * 
 * ⚠️ 无循环依赖：直接操作 Runtime JSON 文件 + 调用 API，不通过 narrativeRuntime 门面
 * 
 * 用法：
 *   npx tsx src/runtime/narrative/snapshot/inspector.ts inspect <projectId> <chapterNo>
 *   npx tsx src/runtime/narrative/snapshot/inspector.ts diff <projectId> <chapterNo-A> <chapterNo-B>
 *   npx tsx src/runtime/narrative/snapshot/inspector.ts explain <projectId> <characterName>
 *   npx tsx src/runtime/narrative/snapshot/inspector.ts budget <projectId> <chapterNo>
 *   npx tsx src/runtime/narrative/snapshot/inspector.ts deterministic <projectId> <chapterNo>
 */

import { narrativeRepository } from '../narrative-repository.js'
import { snapshotEngine } from './index.js'

const command = process.argv[2]
const projectId = process.argv[3]

async function main() {
  if (!command || !projectId) {
    printUsage()
    return
  }

  switch (command) {
    case 'inspect':
      return inspect(projectId, parseInt(process.argv[4]) || 1)
    case 'diff':
      return diff(projectId, parseInt(process.argv[4]) || 1, parseInt(process.argv[5]) || 1)
    case 'explain':
      return explainCharacter(projectId, process.argv[4])
    case 'budget':
      return budget(projectId, parseInt(process.argv[4]) || 1)
    case 'deterministic':
      return deterministic(projectId, parseInt(process.argv[4]) || 1)
    default:
      printUsage()
  }
}

function printUsage() {
  console.log(`
Snapshot Inspector — NOS Runtime Fact View Debugger

USAGE:
  npx tsx inspector.ts inspect <projectId> <chapterNo>      查看 Snapshot
  npx tsx inspector.ts diff <projectId> <a> <b>             对比两章 Snapshot
  npx tsx inspector.ts explain <projectId> <characterName>  追踪角色 Fact 来源
  npx tsx inspector.ts budget <projectId> <chapterNo>       检查 Snapshot 大小预算
  npx tsx inspector.ts deterministic <projectId> <chapterNo>检查确定性（连续3次）
`)
}

async function inspect(projectId: string, chapterNo: number) {
  console.log(`\n═══════════ Snapshot Inspector ═══════════`)
  console.log(`  Project:  ${projectId.substring(0, 12)}...`)
  console.log(`  Chapter:  ${chapterNo}\n`)

  const snapshot = await snapshotEngine.buildWriterSnapshot(projectId, { chapterNo })

  // ── Characters ──
  console.log(`👥 Characters (${snapshot.characters.length})`)
  for (const c of snapshot.characters) {
    const flags = c.statusFlags.map((f: any) => `${f.flag}=${f.value}`).join(', ')
    console.log(`  ${c.name} [${c.lifecycle}] ${c.role}${flags ? ' | ' + flags : ''}`)
  }
  console.log()

  // ── Events ──
  console.log(`📅 Events (${snapshot.events.length})`)
  for (const e of snapshot.events) {
    console.log(`  Ch.${e.chapterNo} ${e.title} [${e.category}]`)
    console.log(`    参与者: ${e.participants.map(p => p.characterName).join(', ')}`)
    if (e.consequences.length > 0) {
      console.log(`    后果: ${e.consequences.slice(0, 2).join('; ')}`)
    }
  }
  console.log()

  // ── Timeline ──
  console.log(`📋 Timeline (${snapshot.timeline.length} entries)`)
  for (const t of snapshot.timeline) {
    console.log(`  Ch.${t.chapterNo}: ${(t.summary || '').slice(0, 100)}`)
  }
  console.log()

  // ── Relationships ──
  console.log(`🔗 Relationships (${snapshot.relationships.length})`)
  for (const r of snapshot.relationships.slice(0, 10)) {
    console.log(`  ${r.characterA} ↔ ${r.characterB} [${r.bondType}] trust=${r.trustLevel}`)
  }
  if (snapshot.relationships.length > 10) {
    console.log(`  ... and ${snapshot.relationships.length - 10} more`)
  }
  console.log()

  // ── Foreshadows ──
  console.log(`🔮 Foreshadows (${snapshot.foreshadows.length})`)
  for (const f of snapshot.foreshadows) {
    console.log(`  [${f.status}] Ch.${f.plantedChapterNo}: ${f.description.slice(0, 80)}`)
  }
  console.log()

  // ── Knowledge ──
  console.log(`🧠 Knowledge (${snapshot.knowledge.length})`)
  for (const k of snapshot.knowledge) {
    console.log(`  ${k.description.slice(0, 80)} (known by: ${k.knownBy.join(', ') || 'N/A'})`)
  }
  console.log()

  // ── Inventory ──
  console.log(`📦 Inventory (${snapshot.inventory.length})`)
  for (const i of snapshot.inventory) {
    console.log(`  ${i.itemName} → ${i.ownerCharacterName}`)
  }
  console.log()

  // ── World ──
  console.log(`🌍 World State:`)
  console.log(`  ${(snapshot.world || 'N/A').slice(0, 200)}`)
  console.log()

  // ── Constraints ──
  console.log(`🔒 Constraints:`)
  console.log(`  Outline Locked: ${snapshot.constraints.outlineLocked}`)
  console.log(`  Logic Locked: ${snapshot.constraints.logicLocked}`)
  console.log(`  Style Locked: ${snapshot.constraints.styleLocked}`)
  if (snapshot.constraints.styleReference) {
    console.log(`  Style Ref: ${snapshot.constraints.styleReference.slice(0, 60)}`)
  }
  console.log()

  // ── Writing Context ──
  console.log(`📝 Writing Context:`)
  console.log(`  Chapter: ${snapshot.writingContext.currentChapterNo}`)
  console.log(`  Title: ${snapshot.writingContext.chapterTitle}`)
  console.log(`  Outline: ${snapshot.writingContext.outline.slice(0, 100)}`)
  console.log(`  Recent Summaries: ${snapshot.writingContext.recentChapterSummaries.length} chapters`)
  console.log(`  Word Target: ${snapshot.writingContext.wordTarget}`)

  // ── Budget ──
  printBudget(snapshot)
}

async function diff(projectId: string, chapterA: number, chapterB: number) {
  const snapA = await snapshotEngine.buildWriterSnapshot(projectId, { chapterNo: chapterA })
  const snapB = await snapshotEngine.buildWriterSnapshot(projectId, { chapterNo: chapterB })

  console.log(`\n═══════════ Snapshot Diff: Ch.${chapterA} ↔ Ch.${chapterB} ═══════════\n`)

  const charANames = new Set(snapA.characters.map(c => c.name))
  const charBNames = new Set(snapB.characters.map(c => c.name))

  const newChars = snapB.characters.filter(c => !charANames.has(c.name))
  const removedChars = snapA.characters.filter(c => !charBNames.has(c.name))

  if (newChars.length > 0) {
    console.log(`🆕 新增角色: ${newChars.map(c => c.name).join(', ')}`)
  }
  if (removedChars.length > 0) {
    console.log(`🗑️ 离开角色: ${removedChars.map(c => c.name).join(', ')})`)
  }

  // Lifecycle changes
  for (const cb of snapB.characters) {
    const ca = snapA.characters.find(c => c.name === cb.name)
    if (ca && ca.lifecycle !== cb.lifecycle) {
      console.log(`⚰️ 角色状态变化: ${cb.name} ${ca.lifecycle} → ${cb.lifecycle}`)
    }
  }

  const newEvents = snapB.events.filter((e: any) => !snapA.events.find((ea: any) => ea.id === e.id))
  if (newEvents.length > 0) {
    console.log(`🆕 新增事件 (${newEvents.length}): ${newEvents.slice(0, 5).map(e => e.title).join(', ')}`)
  }

  const newForeshadows = snapB.foreshadows.filter(f => !snapA.foreshadows.find(fa => fa.id === f.id))
  const resolvedForeshadows = snapA.foreshadows.filter(fa => fa.status !== 'planted' && fa.status !== 'active')
  if (newForeshadows.length > 0) console.log(`🆕 新增伏笔 (${newForeshadows.length})`)
  if (resolvedForeshadows.length > 0) console.log(`✅ 回收伏笔 (${resolvedForeshadows.length})`)
}

async function explainCharacter(projectId: string, characterName?: string) {
  if (!characterName) {
    console.log('请指定角色名: npx tsx inspector.ts explain <projectId> <characterName>')
    return
  }

  const snapshot = await snapshotEngine.buildWriterSnapshot(projectId)
  const char = snapshot.characters.find(c => c.name === characterName)
  if (!char) {
    console.log(`❌ 角色 "${characterName}" 不在 Snapshot 中`)
    return
  }

  console.log(`\n═══════════ Explain: ${characterName} ═══════════\n`)
  console.log(`  状态: ${char.lifecycle}`)
  console.log(`  角色: ${char.role}`)
  console.log(`  标记: ${char.statusFlags.map(f => `${f.flag}=${f.value}`).join(', ') || '无'}`)

  // 该角色参与的事件
  const events = snapshot.events.filter(e =>
    e.participants.some(p => p.characterName === characterName)
  )
  console.log(`\n📅 参与事件 (${events.length}):`)
  for (const e of events) {
    const role = e.participants.find(p => p.characterName === characterName)?.role || 'participant'
    console.log(`  Ch.${e.chapterNo} [${role}] ${e.title}`)
  }

  // 该角色的关系
  const rels = snapshot.relationships.filter(r =>
    r.characterA === characterName || r.characterB === characterName
  )
  console.log(`\n🔗 关系 (${rels.length}):`)
  for (const r of rels) {
    const other = r.characterA === characterName ? r.characterB : r.characterA
    console.log(`  ${other} [${r.bondType}] trust=${r.trustLevel}`)
  }

  // 该角色知道的秘密
  const known = snapshot.knowledge.filter(k => k.knownBy.includes(characterName))
  if (known.length > 0) {
    console.log(`\n🧠 知道的秘密:`)
    for (const k of known) {
      console.log(`  ${k.description.slice(0, 80)}`)
    }
  }

  // 该角色拥有的物品
  const items = snapshot.inventory.filter(i => i.ownerCharacterName === characterName)
  if (items.length > 0) {
    console.log(`\n📦 物品:`)
    for (const i of items) console.log(`  ${i.itemName}`)
  }
}

async function budget(projectId: string, chapterNo: number) {
  const snapshot = await snapshotEngine.buildWriterSnapshot(projectId, { chapterNo })
  console.log(`\n═══════════ Snapshot Budget: Ch.${chapterNo} ═══════════\n`)

  const limits = {
    characters: { max: 30, actual: snapshot.characters.length },
    events: { max: 20, actual: snapshot.events.length },
    timeline: { max: 20, actual: snapshot.timeline.length },
    relationships: { max: 50, actual: snapshot.relationships.length },
    knowledge: { max: 20, actual: snapshot.knowledge.length },
    foreshadows: { max: 20, actual: snapshot.foreshadows.length },
    inventory: { max: 20, actual: snapshot.inventory.length },
    organizations: { max: 10, actual: (snapshot as any).organizations?.length || 0 },
  }

  let allPass = true
  for (const [key, val] of Object.entries(limits)) {
    const ok = val.actual <= val.max
    if (!ok) allPass = false
    console.log(`  ${ok ? '✅' : '❌'} ${key}: ${val.actual} / ${val.max}`)
  }

  // 估算 Token 消耗
  const jsonLen = JSON.stringify(snapshot).length
  const estTokens = Math.ceil(jsonLen / 4)
  console.log(`\n  📏 JSON 大小: ${(jsonLen / 1024).toFixed(1)} KB`)
  console.log(`  🪙 估计 Token: ~${estTokens.toLocaleString()} tokens`)
  console.log(`\n  ${allPass ? '✅ Budget 全部通过' : '❌ 有超出预算的项目'}`)
}

async function deterministic(projectId: string, chapterNo: number) {
  console.log(`\n═══════════ Deterministic Check: Ch.${chapterNo} ═══════════\n`)

  const runs: string[] = []
  for (let i = 0; i < 3; i++) {
    const snapshot = await snapshotEngine.buildWriterSnapshot(projectId, { chapterNo })
    // 用 key 字段作为指纹（排除 id = uuid 的变化）
    const fingerprint = JSON.stringify({
      chars: snapshot.characters.map(c => `${c.name}:${c.lifecycle}:${c.role}:${c.statusFlags.map(f=>`${f.flag}=${f.value}`).join('|')}`).sort(),
      events: snapshot.events.map(e => `${e.chapterNo}:${e.title}`).sort(),
      foreshadows: snapshot.foreshadows.map(f => `${f.id}:${f.status}`).sort(),
      timeline: snapshot.timeline.map(t => `${t.chapterNo}:${(t.summary||'').slice(0,30)}`).sort(),
      rels: snapshot.relationships.map(r => `${r.characterA}:${r.characterB}:${r.bondType}`).sort(),
    })
    runs.push(fingerprint)
    console.log(`  Run ${i + 1}: fingerprint = ${fingerprint.length} chars`)
  }

  const allSame = runs.every(r => r === runs[0])
  console.log(`\n  ${allSame ? '✅ 确定性通过 — 3 次运行完全一致' : '❌ 确定性失败 — Snapshot 输出不一致'}`)

  if (!allSame) {
    for (let i = 1; i < runs.length; i++) {
      if (runs[i] !== runs[0]) {
        console.log(`  Run 1 ↔ Run ${i + 1}: 不一致`)
      }
    }
  }
}

function printBudget(snapshot: any) {
  const items = [
    ['characters', snapshot.characters.length, 30],
    ['events', snapshot.events.length, 20],
    ['timeline', snapshot.timeline.length, 20],
    ['relationships', snapshot.relationships.length, 50],
    ['knowledge', snapshot.knowledge.length, 20],
    ['foreshadows', snapshot.foreshadows.length, 20],
    ['inventory', snapshot.inventory.length, 20],
    ['organizations', snapshot.organizations?.length || 0, 10],
  ] as const

  console.log(`\n📊 Budget:`)
  for (const [name, actual, max] of items) {
    const ok = actual <= max
    console.log(`  ${ok ? '✅' : '❌'} ${name}: ${actual}/${max}`)
  }
}

main().catch(err => {
  console.error('❌ Inspector failed:', err.message)
  process.exit(1)
})
