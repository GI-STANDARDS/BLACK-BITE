@echo off
cd /d "%~dp0"
if not exist "node_modules\" npm install
echo Starting Investigation Graph Server...
node server.js
pause
