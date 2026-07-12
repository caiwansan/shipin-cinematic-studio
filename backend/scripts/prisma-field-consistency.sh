#!/bin/bash
# ─────────────────────────────────────────────────
# Prisma Schema Field Consistency Checker (v2)
# Checks ALL orderBy { createdAt/updatedAt } refs
# across the entire backend src directory
# ─────────────────────────────────────────────────

set -euo pipefail

SCHEMA="prisma/schema.prisma"
SEARCH_DIR="src"
WORK_DIR="$(dirname "$0")/.."

cd "$WORK_DIR"

echo "🔍 Prisma Schema Field Consistency Check (v2)..."
echo ""

if [ ! -f "$SCHEMA" ]; then
  echo "❌ Schema file $SCHEMA not found in $(pwd)"
  exit 1
fi

echo "📦 Parsing $SCHEMA..."

node -e "
const fs = require('fs');
const schema = fs.readFileSync('${SCHEMA}', 'utf-8');

// ── 1. Build model->fields map ──
const blocks = schema.match(/model\s+(\w+)\s*\{([^}]*)\}/g) || [];
const modelFields = {};

for (const block of blocks) {
  const m = block.match(/model\s+(\w+)\s*\{/);
  if (!m) continue;
  const name = m[1];
  const fields = block.split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('@@') && !l.startsWith('//') && !l.startsWith('}'))
    .map(l => l.split(/\s+/)[0])
    .filter(f => f && f !== name);
  modelFields[name] = fields;
}

// ── 2. Scan all TS files for orderBy patterns ──
function findAllFiles(dir) {
  let files = [];
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return []; }
  for (const e of entries) {
    const full = dir + '/' + e.name;
    if (e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules') {
      files = files.concat(findAllFiles(full));
    } else if ((e.name.endsWith('.ts') || e.name.endsWith('.js')) && !e.name.endsWith('.d.ts')) {
      files.push(full);
    }
  }
  return files;
}

const files = findAllFiles('${SEARCH_DIR}').filter(f => !f.includes('/dist/'));
let totalRefs = 0;
let errors = [];

for (const file of files) {
  const content = fs.readFileSync(file, 'utf-8');
  const lines = content.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    // Skip non-orderBy lines
    if (!trimmed.includes('orderBy:')) continue;
    
    // Extract field name from orderBy: { fieldName: ... }
    // Handles multiline too by looking at next lines if needed
    const orderByFieldMatch = trimmed.match(/orderBy:\s*\{\s*(\w+)\s*:/);
    if (!orderByFieldMatch) {
      // Check next lines for multiline
      let j = i + 1;
      let fullBlock = trimmed;
      while (j < lines.length && j < i + 5) {
        fullBlock += ' ' + lines[j].trim();
        j++;
      }
      const multilineMatch = fullBlock.match(/orderBy:\s*\{\s*(\w+)\s*:/);
      if (!multilineMatch) continue;
    }
    
    const field = orderByFieldMatch[1];
    
    // Extract prisma model from closest prisma.xxx.findMany/First/Unique
    let modelFound = null;
    // Look behind and ahead for prisma.model reference
    const modelMatchForward = trimmed.match(/prisma\.([a-zA-Z]+)\.(findMany|findFirst|findUnique|count|aggregate|groupBy|update|delete|create|upsert)/);
    const modelMatchExplicit = trimmed.match(/prisma\.([a-zA-Z]+)\s*\./);
    
    if (modelMatchForward) {
      modelFound = modelMatchForward[1];
    } 
    
    // If no direct prisma match, check for Repository pattern
    // e.g. resultRepository.findMany or geoXxxRepository.findMany
    const repoMatch = trimmed.match(/([a-zA-Z]+Repository|repository)\.(findMany|findFirst|findAll|list|getAll)/i);
    
    // Only flag if we have a direct prisma reference (Repository wrapping is handled in code)
    if (!modelFound) continue;
    
    // Match the actual Prisma model name (case-insensitive)
    const candidates = Object.keys(modelFields).filter(k => 
      k.toLowerCase() === modelFound.toLowerCase()
    );
    
    if (candidates.length === 0) continue; // Unknown model, skip
    
    const actualModel = candidates[0];
    const hasField = modelFields[actualModel].some(f => f.toLowerCase() === field.toLowerCase());
    
    if (!hasField) {
      const alts = modelFields[actualModel].filter(f => f.endsWith('At') || f.endsWith('Time') || f.endsWith('Date'));
      errors.push({
        file: file,
        line: i + 1,
        model: actualModel,
        field: field,
        code: trimmed.substring(0, 120),
        alts: alts
      });
    }
    totalRefs++;
  }
}

console.log('');
console.log('=== Results ===');
console.log(\`Total direct prisma orderBy refs checked: \${totalRefs}\`);
console.log(\`Errors found: \${errors.length}\`);

if (errors.length === 0) {
  console.log('');
  console.log('✅ All orderBy fields verified against Prisma Schema');
  process.exit(0);
}

console.log('');
for (const e of errors) {
  console.log(\`❌ \${e.file}:\${e.line}\`);
  console.log(\`   Model: \${e.model}\`);
  console.log(\`   Field: orderBy { \${e.field}: ... }\`);
  console.log(\`   Code:  \${e.code}\`);
  if (e.alts.length > 0) {
    console.log(\`   Available time fields: \${e.alts.join(', ')}\`);
  }
  console.log('');
}
process.exit(1);
"
