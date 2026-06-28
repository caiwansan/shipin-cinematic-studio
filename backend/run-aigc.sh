#!/bin/bash
# wrapper for pm2 - keeps process in foreground
cd /root/shipin-cinematic-studio/backend
exec node --experimental-default-type=commonjs dist/index.js
