@echo off
echo Starting Queue Management System Backend...
cd /d "%~dp0"
npx ts-node-dev --respawn --transpile-only src/index.ts
