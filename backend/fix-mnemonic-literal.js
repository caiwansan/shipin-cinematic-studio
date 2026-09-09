const fs = require('fs');
const file = '/root/shipin-cinematic-studio/backend/src/routes/tea-storage.ts';
let code = fs.readFileSync(file, 'utf8');

// Find and fix the broken mnemonic route
const brokenPattern = /fastify\.post\('\/api\/tea\/storage\/mnemonic', auth, async \(request: any, reply: any\) => \{\\n    try \{\\n/;
const replacement = "fastify.post('/api/tea/storage/mnemonic', auth, async (request: any, reply: any) => {\n    try {\n";

code = code.replace(brokenPattern, replacement);

fs.writeFileSync(file, code);
console.log('Fixed');
