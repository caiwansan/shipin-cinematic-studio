const fs = require('fs');
const file = '/root/shipin-cinematic-studio/backend/src/routes/tea-storage.ts';
let code = fs.readFileSync(file, 'utf8');

// Find the broken ending: `    }\n  }\n\n  // POST /api/tea/storage/mnemonic/reset`
// and fix it to: `    }\n  })\n\n  // POST /api/tea/storage/mnemonic/reset`

const oldPattern = `      return reply.status(500).send({ success: false, error: '助记词生成失败: ' + (e.message || '未知错误') })
    }
  }

  // POST /api/tea/storage/mnemonic/reset`;

const newPattern = `      return reply.status(500).send({ success: false, error: '助记词生成失败: ' + (e.message || '未知错误') })
    }
  })

  // POST /api/tea/storage/mnemonic/reset`;

if (code.includes(oldPattern)) {
  code = code.replace(oldPattern, newPattern);
  fs.writeFileSync(file, code);
  console.log('Fixed missing )');
} else {
  console.log('Pattern not found');
}
