/**
 * 昆仑镜 AI 短剧平台 - PM2 进程管理配置
 * 
 * 管理两个进程:
 *   - api-server-aigc: 后端 Fastify 服务器 (端口 4002)
 *   - frontend: 前端 Nuxt SPA 服务器 (端口 4001)
 * 
 * 使用:
 *   pm2 start ecosystem.config.cjs
 *   pm2 save              # 保存进程列表（重启后自动恢复）
 *   pm2 logs              # 查看日志
 *   pm2 restart all       # 重启全部
 */

module.exports = {
  apps: [
    {
      name: 'api-server-aigc',
      cwd: '/root/shipin-cinematic-studio/backend',
      script: 'src/index.ts',
      interpreter: 'npx',
      interpreter_args: 'tsx --no-warnings',
      env: {
        PORT: '4002',
        NITRO_PORT: '4002',
        HOST: '0.0.0.0',
      },
      max_restarts: 50,
      min_uptime: '10s',
      restart_delay: 2000,
      error_file: '/root/.pm2/logs/api-server-aigc-error.log',
      out_file: '/root/.pm2/logs/api-server-aigc-out.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },
    {
      name: 'frontend',
      cwd: '/root/shipin-cinematic-studio/frontend',
      script: '.output/server/index.mjs',
      env: {
        PORT: '4001',
        NITRO_PORT: '4001',
        HOST: '0.0.0.0',
      },
      max_restarts: 50,
      min_uptime: '10s',
      restart_delay: 2000,
      error_file: '/root/.pm2/logs/frontend-error.log',
      out_file: '/root/.pm2/logs/frontend-out.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },
  ],
}
