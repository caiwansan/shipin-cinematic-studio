const fs = require('fs');
const file = '/root/shipin-cinematic-studio/backend/src/routes/tea-storage.ts';
let lines = fs.readFileSync(file, 'utf8').split('\n');

// Insert `  )` after line 347 (index 346) which is `  }`
lines.splice(347, 0, '  )');

fs.writeFileSync(file, lines.join('\n'));
console.log('Inserted missing )');
