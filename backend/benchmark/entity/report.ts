/**
 * Report generators for benchmark RunResult.
 *
 * Generates:
 *  - HTML (self-contained with Chart.js CDN)
 *  - JSON (full RunResult)
 *  - CSV (one row per sample + summary)
 *  - Baseline (save / compare)
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import type { RunResult, SampleResult } from './evaluator'

// ---------------------------------------------------------------------------
// JSON Report
// ---------------------------------------------------------------------------

export function generateJsonReport(result: RunResult, outputPath: string): void {
  ensureDir(path.dirname(outputPath))
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2), 'utf-8')
  console.log('[report] JSON -> ' + outputPath)
}

// ---------------------------------------------------------------------------
// CSV Report
// ---------------------------------------------------------------------------

export function generateCsvReport(result: RunResult, outputPath: string): void {
  ensureDir(path.dirname(outputPath))

  const header = [
    'sampleId,category,entityCount,relationCount,typeCoverage,expectedFound,expectedTotal,duplicateRate,runtimeMs,promptTokens,completionTokens,totalTokens,estimatedCost,schemaErrorRate,precision,recall,scoreTypeCoverage,efficiency,costEfficiency,overall,grade,error',
  ]
  const rows = result.samples.map((s: SampleResult) => {
    const m = s.metrics
    const sc = s.score.breakdown
    return [
      escapeCsv(m.sampleId),
      escapeCsv(s.sample?.category ?? ''),
      m.entityCount,
      m.relationCount,
      m.typeCoverage,
      m.expectedFound,
      m.expectedTotal,
      m.duplicateRate,
      m.runtimeMs,
      m.promptTokens,
      m.completionTokens,
      m.totalTokens,
      m.estimatedCost,
      m.schemaErrorRate,
      sc.precision,
      sc.recall,
      sc.typeCoverage,
      sc.efficiency,
      sc.costEfficiency,
      s.score.overall,
      s.score.grade,
      escapeCsv(s.error ?? ''),
    ].join(',')
  })

  const sum = result.summary
  const summaryRow = [
    '__SUMMARY__',
    '',
    sum.avgEntityCount,
    sum.avgRelationCount,
    sum.avgTypeCoverage,
    sum.avgExpectedFound,
    '',
    '',
    sum.avgRuntimeMs,
    '',
    '',
    sum.avgTotalTokens,
    sum.avgCost,
    '',
    '',
    '',
    '',
    '',
    '',
    sum.avgScore,
    'A:' + sum.gradeDistribution.A + ' B:' + sum.gradeDistribution.B + ' C:' + sum.gradeDistribution.C + ' D:' + sum.gradeDistribution.D,
    '',
  ].join(',')

  fs.writeFileSync(outputPath, header.join('\n') + '\n' + rows.join('\n') + '\n' + summaryRow + '\n', 'utf-8')
  console.log('[report] CSV -> ' + outputPath)
}

// ---------------------------------------------------------------------------
// HTML Report — uses string concatenation to avoid nested backtick issues
// ---------------------------------------------------------------------------

export function generateHtmlReport(result: RunResult, outputPath: string): void {
  ensureDir(path.dirname(outputPath))

  const sum = result.summary
  const samplesJson = JSON.stringify(result.samples)
  const summaryJson = JSON.stringify(sum)

  // grade distribution bars
  const gradeBarsHtml = ['A', 'B', 'C', 'D'].map(function (g) {
    const count = (sum.gradeDistribution as Record<string, number>)[g]
    if (count > 0) {
      return '<div class="grade-bar grade-' + g + '" style="flex: ' + count + '">' + g + ' (' + count + ')</div>'
    }
    return ''
  }).join('')

  // score color
  var scoreColorClass = 'green'
  if (sum.avgScore < 75) scoreColorClass = 'orange'
  if (sum.avgScore < 60) scoreColorClass = 'red'

  // Build the full HTML document without template literals (use concat to avoid ` issues)
  var buf: string[] = []
  buf.push('<!DOCTYPE html>')
  buf.push('<html lang="en"><head>')
  buf.push('<meta charset="UTF-8">')
  buf.push('<meta name="viewport" content="width=device-width, initial-scale=1.0">')
  buf.push('<title>GEO Entity Benchmark Report &mdash; ' + result.timestamp + '</title>')
  buf.push('<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"><\/script>')
  buf.push('<style>')
  buf.push('*{margin:0;padding:0;box-sizing:border-box}')
  buf.push('body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#f5f7fa;color:#1a1a2e;padding:24px}')
  buf.push('.container{max-width:1200px;margin:0 auto}')
  buf.push('h1{font-size:24px;margin-bottom:4px}')
  buf.push('.subtitle{color:#666;font-size:14px;margin-bottom:24px}')
  buf.push('.summary-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px;margin-bottom:24px}')
  buf.push('.card{background:#fff;border-radius:10px;padding:16px;box-shadow:0 1px 4px rgba(0,0,0,.06)}')
  buf.push('.card .label{font-size:11px;text-transform:uppercase;color:#888;letter-spacing:.5px;margin-bottom:4px}')
  buf.push('.card .value{font-size:22px;font-weight:600}')
  buf.push('.value.green{color:#22c55e}.value.blue{color:#3b82f6}.value.orange{color:#f59e0b}.value.red{color:#ef4444}')
  buf.push('.chart-box{background:#fff;border-radius:10px;padding:16px;box-shadow:0 1px 4px rgba(0,0,0,.06);margin-bottom:24px}')
  buf.push('.grade-dist{display:flex;gap:8px;align-items:center;margin-top:12px}')
  buf.push('.grade-bar{height:24px;border-radius:4px;text-align:center;line-height:24px;font-size:12px;font-weight:600;color:#fff;min-width:40px}')
  buf.push('.grade-A{background:#22c55e}.grade-B{background:#3b82f6}.grade-C{background:#f59e0b}.grade-D{background:#ef4444}')
  buf.push('.badge{display:inline-block;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600}')
  buf.push('.badge-A{background:#dcfce7;color:#166534}.badge-B{background:#dbeafe;color:#1e40af}.badge-C{background:#fef3c7;color:#92400e}.badge-D{background:#fee2e2;color:#991b1b}')
  buf.push('.detail-card{background:#fff;border-radius:10px;padding:16px;box-shadow:0 1px 4px rgba(0,0,0,.06);margin-bottom:12px}')
  buf.push('.detail-card h3{font-size:15px;margin-bottom:8px}')
  buf.push('.detail-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:6px}')
  buf.push('.detail-item{font-size:12px}.detail-item .l{color:#888}.detail-item .v{font-weight:600}')
  buf.push('.meta{font-size:12px;color:#888;margin-top:24px}')
  buf.push('<\/style><\/head><body>')
  buf.push('<div class="container">')
  buf.push('<h1>' + '&#129504; GEO Entity Benchmark' + '</h1>')
  buf.push('<div class="subtitle">' + result.timestamp + ' &middot; ' + result.provider + '/' + result.model + ' &middot; Prompt v' + result.promptVersion + ' &middot; ' + result.totalSamples + ' samples</div>')
  buf.push('<div class="summary-cards">')
  buf.push('<div class="card"><div class="label">Avg Entities</div><div class="value blue">' + sum.avgEntityCount + '</div></div>')
  buf.push('<div class="card"><div class="label">Avg Relations</div><div class="value blue">' + sum.avgRelationCount + '</div></div>')
  buf.push('<div class="card"><div class="label">Type Coverage</div><div class="value blue">' + sum.avgTypeCoverage + '%</div></div>')
  buf.push('<div class="card"><div class="label">Expected Found</div><div class="value blue">' + sum.avgExpectedFound + '</div></div>')
  buf.push('<div class="card"><div class="label">Avg Runtime</div><div class="value orange">' + sum.avgRuntimeMs + 'ms</div></div>')
  buf.push('<div class="card"><div class="label">Avg Tokens</div><div class="value orange">' + sum.avgTotalTokens + '</div></div>')
  buf.push('<div class="card"><div class="label">Avg Cost</div><div class="value red">$' + sum.avgCost + '</div></div>')
  buf.push('<div class="card"><div class="label">Avg Score</div><div class="value ' + scoreColorClass + '">' + sum.avgScore + '</div></div>')
  buf.push('</div>')
  buf.push('<div class="chart-box"><canvas id="scoreChart" height="80"><\/canvas></div>')
  buf.push('<div class="grade-dist">' + gradeBarsHtml + '</div>')
  buf.push('<h2 style="margin:24px 0 12px;font-size:18px">Sample Details</h2>')
  buf.push('<div id="details"></div>')
  buf.push('<div class="meta">Report generated by GEO Benchmark Framework</div>')
  buf.push('</div>')
  buf.push('<script>')
  buf.push('var samples = ' + samplesJson + ';')
  buf.push('var summary = ' + summaryJson + ';')
  buf.push('new Chart(document.getElementById("scoreChart"),{type:"bar",data:{')
  buf.push('labels:samples.map(function(s,i){return(s.sample&&s.sample.id)||(i+1)}),')
  buf.push('datasets:[{label:"Overall",data:samples.map(function(s){return s.score.overall}),backgroundColor:"#3b82f6",borderRadius:4},')
  buf.push('{label:"Precision",data:samples.map(function(s){return s.score.breakdown.precision}),backgroundColor:"#22c55e",borderRadius:4},')
  buf.push('{label:"Recall",data:samples.map(function(s){return s.score.breakdown.recall}),backgroundColor:"#f59e0b",borderRadius:4}]},')
  buf.push('options:{responsive:true,plugins:{legend:{position:"top",labels:{boxWidth:12,padding:8,font:{size:11}}}},')
  buf.push('scales:{y:{min:0,max:100,ticks:{stepSize:20}}}}})')
  buf.push('')
  buf.push('var el=document.getElementById("details");')
  buf.push('samples.forEach(function(s,i){')
  buf.push('var m=s.metrics,b=s.score.breakdown,g=s.score;')
  buf.push('var c=document.createElement("div");c.className="detail-card";')
  buf.push('c.innerHTML="<h3>"+(s.sample&&s.sample.id||"Sample "+(i+1))+" <span class=\\"badge badge-"+g.grade+"\\">"+g.grade+"</span>"')
  buf.push('+" <span style=\\"font-weight:400;font-size:12px;color:#888;margin-left:8px\\">"+(s.sample&&s.sample.category||"")+"</span>"')
  buf.push('+" <span style=\\"float:right;font-size:12px;color:#888\\">Score: <strong>"+g.overall+"</strong></span></h3>"')
  buf.push('+"<div class=\\"detail-grid\\">"')
  buf.push('+"<div class=\\"detail-item\\"><span class=\\"l\\">Entities:</span> <span class=\\"v\\">"+m.entityCount+"</span></div>"')
  buf.push('+"<div class=\\"detail-item\\"><span class=\\"l\\">Relations:</span> <span class=\\"v\\">"+m.relationCount+"</span></div>"')
  buf.push('+"<div class=\\"detail-item\\"><span class=\\"l\\">Types:</span> <span class=\\"v\\">"+m.entityTypes.length+"</span></div>"')
  buf.push('+"<div class=\\"detail-item\\"><span class=\\"l\\">Type Coverage:</span> <span class=\\"v\\">"+m.typeCoverage+"%</span></div>"')
  buf.push('+"<div class=\\"detail-item\\"><span class=\\"l\\">Found:</span> <span class=\\"v\\">"+m.expectedFound+"/"+m.expectedTotal+"</span></div>"')
  buf.push('+"<div class=\\"detail-item\\"><span class=\\"l\\">Duplicates:</span> <span class=\\"v\\">"+(m.duplicateRate*100).toFixed(1)+"%</span></div>"')
  buf.push('+"<div class=\\"detail-item\\"><span class=\\"l\\">Runtime:</span> <span class=\\"v\\">"+m.runtimeMs+"ms</span></div>"')
  buf.push('+"<div class=\\"detail-item\\"><span class=\\"l\\">Tokens:</span> <span class=\\"v\\">"+m.totalTokens+"</span></div>"')
  buf.push('+"<div class=\\"detail-item\\"><span class=\\"l\\">Cost:</span> <span class=\\"v\\">$"+m.estimatedCost+"</span></div>"')
  buf.push('+"<div class=\\"detail-item\\"><span class=\\"l\\">Schema Error:</span> <span class=\\"v\\">"+m.schemaErrorRate+"</span></div>"')
  buf.push('+"<div class=\\"detail-item\\"><span class=\\"l\\">Precision:</span> <span class=\\"v\\">"+b.precision+"</span></div>"')
  buf.push('+"<div class=\\"detail-item\\"><span class=\\"l\\">Recall:</span> <span class=\\"v\\">"+b.recall+"</span></div>"')
  buf.push('+"<div class=\\"detail-item\\"><span class=\\"l\\">Type Score:</span> <span class=\\"v\\">"+b.typeCoverage+"</span></div>"')
  buf.push('+"<div class=\\"detail-item\\"><span class=\\"l\\">Efficiency:</span> <span class=\\"v\\">"+b.efficiency+"</span></div>"')
  buf.push('+"<div class=\\"detail-item\\"><span class=\\"l\\">Cost Eff.:</span> <span class=\\"v\\">"+b.costEfficiency+"</span></div>"')
  buf.push('+"</div>"+(s.error?"<p style=\\"color:#ef4444;font-size:12px;margin-top:6px\\">"+escapeHtml(s.error)+"</p>":"");')
  buf.push('el.appendChild(c);')
  buf.push('})')
  buf.push("function escapeHtml(str){return str.replace(/&/g,\"&amp;\").replace(/</g,\"&lt;\").replace(/>/g,\"&gt;\").replace(/\"/g,\"&quot;\").replace(/'/g,\"&#39;\")}")
  buf.push('<\/script><\/body><\/html>')

  fs.writeFileSync(outputPath, buf.join('\n'), 'utf-8')
  console.log('[report] HTML -> ' + outputPath)
}

// ---------------------------------------------------------------------------
// Baseline
// ---------------------------------------------------------------------------

const BASELINE_PATH = path.resolve(
  (typeof __dirname !== 'undefined' ? __dirname : import.meta.dirname ?? '.'),
  '..',
  'baseline.json',
)

export function saveBaseline(result: RunResult): void {
  const baseline = {
    timestamp: result.timestamp,
    provider: result.provider,
    model: result.model,
    promptVersion: result.promptVersion,
    totalSamples: result.totalSamples,
    summary: result.summary,
    samples: result.samples.map(function (s) {
      return {
        sampleId: s.metrics.sampleId,
        entityCount: s.metrics.entityCount,
        typeCoverage: s.metrics.typeCoverage,
        expectedFound: s.metrics.expectedFound,
        runtimeMs: s.metrics.runtimeMs,
        totalTokens: s.metrics.totalTokens,
        estimatedCost: s.metrics.estimatedCost,
        precision: s.score.breakdown.precision,
        recall: s.score.breakdown.recall,
        overall: s.score.overall,
        grade: s.score.grade,
        error: s.error ?? null,
      }
    }),
  }

  fs.writeFileSync(BASELINE_PATH, JSON.stringify(baseline, null, 2), 'utf-8')
  console.log('[report] Baseline saved -> ' + BASELINE_PATH)
}

export function compareWithBaseline(newResult: RunResult): {
  deltas: Record<string, number | null>
  regression: boolean
} {
  if (!fs.existsSync(BASELINE_PATH)) {
    console.log('[report] No baseline found. Skipping comparison.')
    return { deltas: {}, regression: false }
  }

  const baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf-8'))
  const oldSum = baseline.summary
  const newSum = newResult.summary

  const deltas: Record<string, number | null> = {
    avgEntityCount: delta(oldSum.avgEntityCount, newSum.avgEntityCount),
    avgRelationCount: delta(oldSum.avgRelationCount, newSum.avgRelationCount),
    avgTypeCoverage: delta(oldSum.avgTypeCoverage, newSum.avgTypeCoverage),
    avgExpectedFound: delta(oldSum.avgExpectedFound, newSum.avgExpectedFound),
    avgRuntimeMs: delta(oldSum.avgRuntimeMs, newSum.avgRuntimeMs),
    avgTotalTokens: delta(oldSum.avgTotalTokens, newSum.avgTotalTokens),
    avgCost: delta(oldSum.avgCost, newSum.avgCost),
    avgScore: delta(oldSum.avgScore, newSum.avgScore),
  }

  const oldPrecision = baseline.samples.reduce(function (s: number, r: any) { return s + r.precision; }, 0) / baseline.samples.length
  const newPrecision = newResult.samples.reduce(function (s: number, r: any) { return s + r.score.breakdown.precision; }, 0) / newResult.samples.length
  const oldRecall = baseline.samples.reduce(function (s: number, r: any) { return s + r.recall; }, 0) / baseline.samples.length
  const newRecall = newResult.samples.reduce(function (s: number, r: any) { return s + r.score.breakdown.recall; }, 0) / newResult.samples.length

  deltas.precision = delta(oldPrecision, newPrecision)
  deltas.recall = delta(oldRecall, newRecall)

  const regression =
    (deltas.avgScore != null && deltas.avgScore < -10) ||
    (deltas.precision != null && deltas.precision < -10) ||
    (deltas.recall != null && deltas.recall < -10) ||
    (deltas.avgRuntimeMs != null && deltas.avgRuntimeMs > 10) ||
    (deltas.avgCost != null && deltas.avgCost > 10)

  console.log('[report] Baseline comparison complete. Regression: ' + regression)

  return { deltas, regression }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

function escapeCsv(val: string): string {
  if (val.includes(',') || val.includes('"') || val.includes('\n')) {
    return '"' + val.replace(/"/g, '""') + '"'
  }
  return val
}

function delta(oldVal: number, newVal: number): number {
  if (oldVal === 0) {
    return newVal === 0 ? 0 : 100
  }
  return Number((((newVal - oldVal) / Math.abs(oldVal)) * 100).toFixed(2))
}
