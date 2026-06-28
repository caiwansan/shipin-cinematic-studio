module.exports = {
  apps: [
    {
      name: 'frontend',
      script: '.output/server/index.mjs',
      env: {
        PORT: '4001',
        NITRO_PORT: '4001',
        HOST: '0.0.0.0',
      },
    },
  ],
}
