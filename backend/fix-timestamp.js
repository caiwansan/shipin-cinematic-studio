const fs = require('fs');
const file = '/root/shipin-cinematic-studio/backend/src/routes/tea-storage.ts';
let code = fs.readFileSync(file, 'utf8');

// Fix: change Math.floor(Date.now() / 1000) to new Date() for timestamp columns
code = code.replace(/const ts = Math\.floor\(Date\.now\(\) \/ 1000\)/g, 'const ts = new Date()');
code = code.replace(/Math\.floor\(Date\.now\(\) \/ 1000\)/g, 'new Date()');

fs.writeFileSync(file, code);
console.log('Fixed timestamp type casting');
