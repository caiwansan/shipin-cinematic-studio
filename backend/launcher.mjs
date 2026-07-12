// Use the tsx loader to handle TypeScript
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
spawn('npx', ['tsx', '--no-warnings', 'src/index.ts'], {
  cwd: __dirname,
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_OPTIONS: '',  // Clear any overrides
    TSX_TSCONFIG_PATH: resolve(__dirname, 'tsconfig.json')
  }
});
