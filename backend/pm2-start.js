const { spawn } = require('child_process');
const path = require('path');

const child = spawn(
  '/www/server/nvm/versions/node/v22.22.2/bin/node',
  [
    '/www/server/nvm/versions/node/v22.22.2/lib/node_modules/tsx/dist/cli.mjs',
    path.join(__dirname, 'src', 'index.ts')
  ],
  {
    cwd: __dirname,
    stdio: ['pipe', 'inherit', 'inherit'],
    env: { ...process.env, PORT: '4002' }
  }
);

process.on('SIGTERM', () => child.kill());
process.on('SIGINT', () => child.kill());
child.on('exit', (code) => process.exit(code));
