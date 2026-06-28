/**
 * 昆仑镜桌面版 - 预加载脚本 v3
 * Phase 2 升级：完整的本地引擎安装引导 API
 */

const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  // 检测是否为桌面环境（关键！前端用这个判断）
  isDesktop: true,

  // 基础信息
  getAppInfo: () => ipcRenderer.invoke('get-app-info'),
  getVersion: () => ipcRenderer.invoke('get-app-info').then(info => info.version),

  // == 平台信息 ==
  platform: process.platform,  // 'darwin' | 'win32' | 'linux'
  platformName: process.platform === 'darwin' ? 'macOS'
    : process.platform === 'win32' ? 'Windows'
    : 'Linux',

  // == 更新 ==
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),

  // == Ollama 引擎 ==
  checkEngine: (engine) => ipcRenderer.invoke('engine-check', engine),
  installEngine: (engine) => ipcRenderer.invoke('engine-install', engine),
  browseEngine: (engine) => ipcRenderer.invoke('engine-browse', engine),  // 打开下载页

  // == 兼容旧版 ==
  ollamaCheck: () => ipcRenderer.invoke('ollama-check'),
  ollamaInstallCheck: () => ipcRenderer.invoke('ollama-install-check'),

  // 打开外部链接
  openExternal: (url) => ipcRenderer.invoke('open-external', url),

  // 打开本地目录
  openPath: (dirPath) => ipcRenderer.invoke('open-path', dirPath),

  // 导航监听（菜单触发）
  onNavigate: (callback) => {
    ipcRenderer.on('navigate', (_event, path) => callback(path))
  },
})
