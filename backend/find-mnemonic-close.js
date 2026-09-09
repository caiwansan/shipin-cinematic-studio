const fs = require('fs');
const file = '/root/shipin-cinematic-studio/backend/src/routes/tea-storage.ts';
let lines = fs.readFileSync(file, 'utf8').split('\n');

// Find the line with `  }` that closes the mnemonic route (around line 347)
// and check if the next non-empty line is a comment (meaning missing `)`)
for (let i = 340; i < 360 && i < lines.length; i++) {
  console.log((i+1) + ': ' + JSON.stringify(lines[i]));
}
