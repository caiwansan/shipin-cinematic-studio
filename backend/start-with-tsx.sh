#!/bin/bash
cd /root/shipin-cinematic-studio/backend
exec npx tsx --no-warnings --tsconfig tsconfig.json -r tsconfig-paths/register src/index.ts
