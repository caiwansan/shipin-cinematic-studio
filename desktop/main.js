/**
 * 昆仑镜桌面版 - 主进程 v2
 *
 * Phase 2 升级：
 * - Electron API 暴露到渲染进程 → 检测是否为桌面环境
 * - 本地 Ollama 服务检测
 * - 本地后端启动（SQLite + Fastify）
 * - 自动更新
 * - 本地模型配置持久化
 */

const { app, BrowserWindow, Menu, dialog, ipcMain, shell } = require('electron')
const path = require('path')
const { spawn, execSync } = require('child_process')
const http = require('http')
const fs = require('fs')
const { autoUpdater } = require('electron-updater')

// ─── 全局状态 ───
let mainWindow = null
let backendProcess = null
const isDev = process.argv.includes('--dev')
const isPackaged = app.isPackaged
const APP_NAME = '昆仑镜'

// ─── 用户数据目录（用于本地存储） ───
const userDataPath = app.getPath('userData')
const localDbPath = path.join(userDataPath, 'local.db')
const localConfigPath = path.join(userDataPath, 'config.json')

// ─── 窗口配置 ───
const WINDOW_CONFIG = {
  width: 1400,
  height: 900,
  minWidth: 1024,
  minHeight: 700,
  title: `${APP_NAME} - AI 短剧制作平台`,
  icon: path.join(__dirname, 'web', 'logo.png'),
  webPreferences: {
    preload: path.join(__dirname, 'preload.js'),
    contextIsolation: true,
    nodeIntegration: false,
    webSecurity: false,
  },
}

// ─── 创建主窗口 ───
async function createWindow() {
  mainWindow = new BrowserWindow(WINDOW_CONFIG)

  // 加载页面
  if (isDev) {
    await mainWindow.loadURL('http://localhost:3333')
    mainWindow.webContents.openDevTools()
  } else {
    const indexPath = path.join(__dirname, 'web', 'index.html')
    await mainWindow.loadFile(indexPath)
  }

  mainWindow.on('closed', () => { mainWindow = null })
  setupMenu()
  setupIpcHandlers()
}

// ─── 应用菜单 ───
function setupMenu() {
  const template = [
    {
      label: APP_NAME,
      submenu: [
        { label: `关于${APP_NAME}`, role: 'about' },
        { type: 'separator' },
        { label: '检查更新', click: () => checkForUpdates() },
        { type: 'separator' },
        { label: '退出', accelerator: 'CmdOrCtrl+Q', role: 'quit' },
      ],
    },
    {
      label: '视图',
      submenu: [
        { label: '重新加载', accelerator: 'CmdOrCtrl+R', role: 'reload' },
        { label: '开发者工具', accelerator: 'F12', role: 'toggleDevTools' },
        { type: 'separator' },
        { label: '放大', accelerator: 'CmdOrCtrl+=', role: 'zoomIn' },
        { label: '缩小', accelerator: 'CmdOrCtrl+-', role: 'zoomOut' },
        { label: '重置缩放', accelerator: 'CmdOrCtrl+0', role: 'resetZoom' },
      ],
    },
    {
      label: '帮助',
      submenu: [
        {
          label: '大模型设置',
          click: () => mainWindow?.webContents.send('navigate', '/user/center'),
        },
        { label: '客服支持', click: () => mainWindow?.webContents.send('navigate', '/customer-service') },
        { type: 'separator' },
        { label: 'Ollama 官网', click: () => shell.openExternal('https://ollama.ai') },
      ],
    },
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

// ─── IPC 处理器（Phase 2 升级） ───
function setupIpcHandlers() {
  // 基础信息
  ipcMain.handle('get-app-info', () => ({
    version: app.getVersion(),
    electronVersion: process.versions.electron,
    platform: process.platform,
    isDev,
    isDesktop: true,
    userDataPath,
  }))

  // 检查更新
  ipcMain.handle('check-for-updates', () => checkForUpdates())

  // Phase 2: 检测本地 Ollama
  ipcMain.handle('ollama-check', async () => {
    return new Promise((resolve) => {
      const req = http.get('http://127.0.0.1:11434/api/tags', { timeout: 3000 }, (res) => {
        let data = ''
        res.on('data', (chunk) => { data += chunk })
        res.on('end', () => {
          try {
            const json = JSON.parse(data)
            resolve({ running: true, models: (json.models || []).map((m) => m.name) })
          } catch {
            resolve({ running: false, models: [] })
          }
        })
      })
      req.on('error', () => resolve({ running: false, models: [] }))
      req.on('timeout', () => { req.destroy(); resolve({ running: false, models: [] }) })
    })
  })

  // Phase 2: Ollama 安装检测（各平台）
  ipcMain.handle('ollama-install-check', async () => {
    return engineInstallCheck('ollama')
  })

  // Phase 3: 通用引擎检测（ollama / comfyui / wan2.1）
  ipcMain.handle('engine-check', async (_event, engine) => {
    return engineCheck(engine)
  })

  // Phase 3: 引擎安装引导（打开下载页）
  ipcMain.handle('engine-install', async (_event, engine) => {
    return engineInstall(engine)
  })

  // Phase 3: 浏览器下载页
  ipcMain.handle('engine-browse', async (_event, engine) => {
    const urls = {
      ollama: 'https://ollama.com/download',
      comfyui: 'https://github.com/comfyanonymous/ComfyUI/releases',
      'wan2.1': 'https://github.com/Wan-Video/Wan2.1',
    }
    const url = urls[engine] || 'https://github.com'
    shell.openExternal(url)
  })

  // Phase 3: 打开本地目录
  ipcMain.handle('open-path', (_event, dirPath) => {
    if (fs.existsSync(dirPath)) {
      shell.openPath(dirPath)
    }
  })

  // 打开本地文件/目录
  ipcMain.handle('open-external', (_event, url) => {
    shell.openExternal(url)
  })
}

// ─── 三引擎检测 & 安装工具 ───

/** 检测可执行文件是否在 PATH 中 */
function binaryExists(name) {
  try {
    if (process.platform === 'win32') {
      return !!execSync(`where ${name} 2>nul`, { encoding: 'utf-8', timeout: 3000 }).trim()
    } else {
      return !!execSync(`which ${name} 2>/dev/null`, { encoding: 'utf-8', timeout: 3000 }).trim()
    }
  } catch { return false }
}

/** ComfyUI 是否运行：检查 8188 端口 */
function isComfyRunning() {
  try {
    const result = execSync(`curl -s -o /dev/null -w "%{http_code}" --connect-timeout 3 --max-time 3 http://127.0.0.1:8188/queue`, { timeout: 5000, encoding: 'utf-8', stdio: 'pipe' })
    return result.trim() === '200'
  } catch { return false }
}

/** ComfyUI 安装检测（检查几个常见路径） */
function comfyuiInstallCheck() {
  const home = require('os').homedir()
  const commonPaths = process.platform === 'win32'
    ? ['C:\\ComfyUI', 'C:\\Users\\' + require('os').userInfo().username + '\\ComfyUI']
    : [require('path').join(home, 'ComfyUI'), '/opt/ComfyUI']
  for (const p of commonPaths) {
    if (fs.existsSync(require('path').join(p, 'main.py'))) return { installed: true, path: p }
    if (fs.existsSync(require('path').join(p, 'comfyui.py'))) return { installed: true, path: p }
  }
  return { installed: false }
}

/** Wan2.1 安装检测 */
function wanInstallCheck() {
  const home = require('os').homedir()
  const commonPaths = [
    require('path').join(home, 'Wan2.1'),
    '/opt/Wan2.1',
    require('path').join(home, 'Wan-Video', 'Wan2.1'),
  ]
  for (const p of commonPaths) {
    if (fs.existsSync(require('path').join(p, 'infer.py')) || fs.existsSync(require('path').join(p, 'inference.py'))) {
      return { installed: true, path: p }
    }
  }
  return { installed: false }
}

/** 引擎安装检测 */
function engineInstallCheck(engine) {
  switch (engine) {
    case 'ollama': return { installed: binaryExists('ollama') }
    case 'comfyui': return comfyuiInstallCheck()
    case 'wan2.1': return wanInstallCheck()
    default: return { installed: false }
  }
}

/** 引擎运行状态检测 */
function engineCheck(engine) {
  const install = engineInstallCheck(engine)
  let running = false
  let info = {}

  switch (engine) {
    case 'ollama':
      running = false
      try {
        const req = http.get('http://127.0.0.1:11434/api/tags', { timeout: 3000 }, (res) => { /* no-op */ })
        req.on('response', (res) => {
          let data = ''
          res.on('data', (chunk) => { data += chunk })
          res.on('end', () => {
            try {
              const json = JSON.parse(data)
              info.models = (json.models || []).map(m => m.name)
            } catch {}
          })
        })
        req.on('error', () => {})
        req.end()
        running = true
      } catch {}
      break

    case 'comfyui':
      running = isComfyRunning()
      if (install.installed) {
        // 扫描 ComfyUI 模型目录
        const modelDir = require('path').join(install.path, 'models', 'checkpoints')
        if (fs.existsSync(modelDir)) {
          try {
            info.models = fs.readdirSync(modelDir).filter(f => f.endsWith('.safetensors') || f.endsWith('.ckpt'))
          } catch {}
        }
      }
      break

    case 'wan2.1':
      // Wan2.1 是 Python 脚本，通过检查脚本判断
      if (install.installed) {
        info.scriptExists = true
      }
      break
  }

  return { ...install, running, info }
}

/** 引擎安装（打开下载页面/显示安装说明） */
function engineInstall(engine) {
  const platform = process.platform === 'darwin' ? 'macOS'
    : process.platform === 'win32' ? 'Windows'
    : 'Linux'

  const installInfo = {
    ollama: {
      name: 'Ollama',
      url: platform === 'macOS' ? 'https://ollama.com/download/Ollama-darwin.zip'
        : platform === 'Windows' ? 'https://ollama.com/download/OllamaSetup.exe'
        : 'https://ollama.com/download/ollama-linux-amd64.tgz',
      instructions: platform === 'macOS' ? '下载后解压 Ollama-darwin.zip，将 Ollama.app 拖入 Applications'
        : platform === 'Windows' ? '下载 OllamaSetup.exe 后双击运行安装'
        : '下载后解压: tar -xzf ollama-linux-amd64.tgz && sudo mv ollama /usr/local/bin/',
    },
    comfyui: {
      name: 'ComfyUI',
      url: 'https://github.com/comfyanonymous/ComfyUI/releases',
      instructions: `安装步骤：
1. 安装 Python 3.10+：https://www.python.org/downloads/
2. 下载 ComfyUI：git clone https://github.com/comfyanonymous/ComfyUI
3. cd ComfyUI && pip install -r requirements.txt
4. 启动：python main.py (默认 8188 端口)`,
    },
    'wan2.1': {
      name: 'Wan2.1',
      url: 'https://github.com/Wan-Video/Wan2.1',
      instructions: `安装步骤：
1. 安装 Python 3.10+ 和 CUDA
2. git clone https://github.com/Wan-Video/Wan2.1
3. cd Wan2.1 && pip install -r requirements.txt
4. 下载模型权重（~14GB）：python download.py`,
    },
  }

  shell.openExternal(installInfo[engine]?.url || 'https://github.com')
  return installInfo[engine] || { name: engine, url: '', instructions: '' }
}

// ─── 自动更新 ───
function checkForUpdates() {
  if (isDev) {
    dialog.showMessageBox(mainWindow, {
      type: 'info', title: '检查更新',
      message: '开发模式不检查更新',
    })
    return
  }
  autoUpdater.checkForUpdatesAndNotify()
}

autoUpdater.on('update-available', ({ version }) => {
  dialog.showMessageBox(mainWindow, {
    type: 'info', title: '发现新版本',
    message: `${APP_NAME} ${version} 正在下载中…`,
  })
})

autoUpdater.on('update-downloaded', ({ version }) => {
  dialog.showMessageBox(mainWindow, {
    type: 'question', title: '更新就绪',
    message: `${APP_NAME} ${version} 已下载完成，是否现在安装？`,
    buttons: ['立即重启安装', '稍后'],
  }).then(({ response }) => {
    if (response === 0) autoUpdater.quitAndInstall()
  })
})

// ─── 应用生命周期 ───
app.whenReady().then(async () => {
  console.log(`[desktop] ${APP_NAME} v${app.getVersion()} 启动`)
  console.log(`[desktop] 用户数据目录: ${userDataPath}`)
  console.log(`[desktop] 平台: ${process.platform}`)

  await createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (mainWindow === null) createWindow()
})
