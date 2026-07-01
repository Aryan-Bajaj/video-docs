@echo off
REM VideoDoc desktop launcher.
REM Starts the bundled AI engine (llama.cpp) which also hosts the app itself,
REM then opens your browser. Everything runs on this machine. No cloud, no
REM account, nothing leaves the device.
setlocal
cd /d "%~dp0"

if not exist "llama\llama-server.exe" (
  echo [VideoDoc] AI engine not found. Run the one-time setup first:
  echo   powershell -ExecutionPolicy Bypass -File get-engine.ps1
  pause
  exit /b 1
)
if not exist "models\gemma-3-4b-it-qat-Q4_0.gguf" (
  echo [VideoDoc] Model not found. Run the one-time setup first:
  echo   powershell -ExecutionPolicy Bypass -File get-engine.ps1
  pause
  exit /b 1
)

echo [VideoDoc] Starting on http://localhost:8080 ... keep this window open.
start "" http://localhost:8080
llama\llama-server.exe ^
  -m models\gemma-3-4b-it-qat-Q4_0.gguf ^
  --mmproj models\mmproj-model-f16.gguf ^
  --path app ^
  --host 127.0.0.1 --port 8080 ^
  -ngl 99 -c 8192
