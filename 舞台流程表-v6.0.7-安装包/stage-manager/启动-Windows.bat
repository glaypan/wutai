@echo off
setlocal EnableExtensions
chcp 65001 >nul 2>&1
title Stage Manager - Windows

set "SCRIPT_DIR=%~dp0"
set "SERVER_JS=%SCRIPT_DIR%server-standalone.js"
set "RUNTIME_DIR=%SCRIPT_DIR%.runtime"
set "NODE_DIR=%RUNTIME_DIR%\node-v20.18.1-win-x64"
set "NODE_EXE="
set "NODE_ZIP=%TEMP%\stage-manager-node-%RANDOM%.zip"

if not exist "%SERVER_JS%" (
  echo [ERROR] server-standalone.js was not found next to this launcher.
  pause
  exit /b 1
)

where node >nul 2>&1
if %errorlevel%==0 set "NODE_EXE=node"
if not defined NODE_EXE if exist "%NODE_DIR%\node.exe" set "NODE_EXE=%NODE_DIR%\node.exe"

if not defined NODE_EXE (
  echo [1/2] Downloading local Node.js runtime...
  if not exist "%RUNTIME_DIR%" mkdir "%RUNTIME_DIR%"
  powershell -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -UseBasicParsing -Uri 'https://nodejs.org/dist/v20.18.1/node-v20.18.1-win-x64.zip' -OutFile '%NODE_ZIP%'"
  if errorlevel 1 goto :NODE_FAIL
  powershell -NoProfile -ExecutionPolicy Bypass -Command "Expand-Archive -LiteralPath '%NODE_ZIP%' -DestinationPath '%RUNTIME_DIR%' -Force"
  if errorlevel 1 goto :NODE_FAIL
  del "%NODE_ZIP%" >nul 2>&1
  set "NODE_EXE=%NODE_DIR%\node.exe"
)

echo [2/2] Starting Stage Manager...
cd /d "%SCRIPT_DIR%"
set "AUTO_OPEN=1"
"%NODE_EXE%" "%SERVER_JS%"
pause
exit /b 0

:NODE_FAIL
echo Failed to prepare Node.js. Install Node.js manually from https://nodejs.org/ and run this launcher again.
pause
exit /b 1
