#!/bin/bash
export PORT=4002
exec /www/server/nvm/versions/node/v22.22.2/bin/node --experimental-default-type=commonjs /root/shipin-cinematic-studio/backend/dist/index.js
