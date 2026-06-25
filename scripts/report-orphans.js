#!/usr/bin/env node
/**
 * RC-2 Orphan Report — 仅展示非保护路径下的零引用文件
 * 用法: node scripts/report-orphans.js --orphans ./tmp/orphans-frontend.json --dir ./frontend
 */
const fs = require('fs')
const path = require('path')

const args = {}
process.argv.slice(2).forEach((a, i, arr) => {
  if (a.startsWith('--')) args[a.slice(2)] = arr[i + 1]
})

const orphansPath = args.orphans || ''
const srcDir = path.resolve(args.dir || '.')
const outPath = args.out || ''
const protectPaths = (args.protected || 'runtime/').split(',').map(p => p.replace(/\/?$/, '/'))

if (!orphansPath) {
  console.error('--orphans required'); process.exit(1)
}

const data = JSON.parse(fs.readFileSync(orphansPath, 'utf-8'))
const allOrphans = data.orphans || []

function isProtected(relPath) {
  return protectPaths.some(pp => relPath.startsWith(pp))
}

const cleanable = []
const protectedFiles = []

for (const o of allOrphans) {
  if (isProtected(o.relative)) {
    protectedFiles.push(o)
  } else {
    cleanable.push(o)
  }
}

// 按目录分组
const byDir = {}
for (const o of cleanable) {
  const dir = path.dirname(o.relative)
  if (!byDir[dir]) byDir[dir] = []
  byDir[dir].push(path.basename(o.file))
}

// 输出
const report = {
  total: allOrphans.length,
  protected: protectedFiles.length,
  cleanable: cleanable.length,
  protectedFiles: protectedFiles.map(o => o.relative),
  byDirectory: byDir,
}

const json = JSON.stringify(report, null, 2)
console.log(json)
if (outPath) fs.writeFileSync(outPath, json, 'utf-8')
