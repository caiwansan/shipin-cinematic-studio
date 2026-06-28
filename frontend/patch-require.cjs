const fs = require('fs');
const path = require('path');

const nuxtDir = process.argv[2];
if (!nuxtDir) {
  console.error('Usage: node patch-require.js <nuxt-dir>');
  process.exit(1);
}

const files = fs.readdirSync(nuxtDir).filter(f => f.endsWith('.js'));
let patched = 0;

for (const file of files) {
  const fp = path.join(nuxtDir, file);
  let c = fs.readFileSync(fp, 'utf-8');
  const o = c;

  // Pattern 1: const { key1, key2 } = require('~/utils/token-cache')
  // or: const { key1, key2 } = require("~/utils/token-cache")
  c = c.replace(/const\{([^}]+)\}=require\(['"](~\/utils\/token-cache)['"]\)/g, (m, exports) => {
    const parts = exports.split(',').map(p => p.trim());
    return parts.map(p => {
      const colonIdx = p.indexOf(':');
      if (colonIdx > -1) {
        const key = p.substring(0, colonIdx).trim();
        const alias = p.substring(colonIdx + 1).trim();
        return 'const ' + alias + '=window.__tc.' + key;
      }
      return 'const ' + p + '=window.__tc.' + p;
    }).join(';');
  });

  // Pattern 2: require('~/utils/token-cache').getToken() 
  c = c.replace(/require\(['"]~\/utils\/token-cache['"]\)\.getToken\(\)/g, '(window.__tc&&window.__tc.getToken&&window.__tc.getToken()||"")');

  // Pattern 3: standalone require('~/utils/token-cache') as a value
  c = c.replace(/require\(['"]~\/utils\/token-cache['"]\)/g, '(window.__tc||{})');

  if (c !== o) {
    fs.writeFileSync(fp, c, 'utf-8');
    patched++;
    console.log('  Patched: ' + file);
  }
}

console.log('Total patched: ' + patched);
console.log('Residual require: ' + files.filter(f => {
  const content = fs.readFileSync(path.join(nuxtDir, f), 'utf-8');
  return /require\(['"]~\/utils\/token-cache['"]\)/.test(content);
}).length);
