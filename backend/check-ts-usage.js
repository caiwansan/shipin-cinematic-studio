const fs = require('fs');
const file = '/root/shipin-cinematic-studio/backend/src/routes/tea-storage.ts';
let code = fs.readFileSync(file, 'utf8');

// Show current state
const lines = code.split('\n');
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('Date.now()') || lines[i].includes('updated_at') || lines[i].includes('backup_at')) {
    console.log((i+1) + ': ' + lines[i]);
  }
}
