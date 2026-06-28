module.exports = {
  apps: [{
    name: 'api-server-aigc',
    script: '/root/shipin-cinematic-studio/backend/start-aigc.sh',
    interpreter: 'bash',
    env: {
      PORT: '4002',
    },
  }]
}
