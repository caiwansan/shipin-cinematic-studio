const fs = require('fs');
const file = '/root/shipin-cinematic-studio/backend/src/routes/tea-storage.ts';
let code = fs.readFileSync(file, 'utf8');

// Find the route and add try-catch
const searchStr = "fastify.post('/api/tea/storage/mnemonic', auth, async (request: any) => {";
const idx = code.indexOf(searchStr);

if (idx === -1) {
  console.log('Route not found');
  process.exit(1);
}

// Find the closing of the route (next fastify. or end)
const routeStart = idx;
let braceCount = 0;
let inString = false;
let stringChar = '';
let routeEnd = routeStart;

for (let i = routeStart; i < code.length; i++) {
  const ch = code[i];
  const prev = code[i-1] || '';
  
  if (!inString) {
    if (ch === '"' || ch === "'" || ch === '`') {
      inString = true;
      stringChar = ch;
    } else if (ch === '{') {
      braceCount++;
    } else if (ch === '}') {
      braceCount--;
      if (braceCount === 0) {
        routeEnd = i + 1;
        break;
      }
    }
  } else {
    if (ch === stringChar && prev !== '\\') {
      inString = false;
    }
  }
}

const oldRoute = code.substring(routeStart, routeEnd);

// Replace the route handler signature
const newRoute = oldRoute.replace(
  "fastify.post('/api/tea/storage/mnemonic', auth, async (request: any) => {",
  "fastify.post('/api/tea/storage/mnemonic', auth, async (request: any, reply: any) => {\\n    try {"
);

// Add catch block before the closing
const finalRoute = newRoute.replace(
  /\}\s*\n\s*(?=\n\s*\n\s*(?:fastify|}))/,
  `} catch (e: any) {\\n      console.error('[mnemonic] error:', e.message);\\n      return reply.status(500).send({ success: false, error: '助记词生成失败: ' + (e.message || '未知错误') });\\n    }\\n  `
);

code = code.substring(0, routeStart) + finalRoute + code.substring(routeEnd);
fs.writeFileSync(file, code);
console.log('Added try-catch to mnemonic route');
