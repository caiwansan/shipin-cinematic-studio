const fs = require('fs');
const file = '/root/shipin-cinematic-studio/backend/src/routes/tea-storage.ts';
let code = fs.readFileSync(file, 'utf8');

// Find the broken ending and fix it
// The issue is that the route ends with }) but should end with }\n);
const oldEnding = `      return reply.status(500).send({ success: false, error: '助记词生成失败: ' + (e.message || '未知错误') })
    }
  })`;

const newEnding = `      return reply.status(500).send({ success: false, error: '助记词生成失败: ' + (e.message || '未知错误') })
    }
  }
);`;

if (code.includes(oldEnding)) {
  code = code.replace(oldEnding, newEnding);
  fs.writeFileSync(file, code);
  console.log('Fixed route ending');
} else {
  console.log('Old ending not found, checking current state...');
  // Show the area around line 345
  const lines = code.split('\n');
  for (let i = 340; i < Math.min(lines.length, 360); i++) {
    console.log((i+1) + ': ' + lines[i]);
  }
}
