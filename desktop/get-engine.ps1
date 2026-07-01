# VideoDoc desktop, one time setup.
# Downloads the llama.cpp server (Vulkan build: NVIDIA, AMD and Intel graphics,
# CPU fallback) and the gemma 3 4B vision model (QAT quant, about 3.2 GB).
# Sources are official: github.com/ggml-org and huggingface.co/ggml-org.
# Run from this folder:  powershell -ExecutionPolicy Bypass -File get-engine.ps1
$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $here

New-Item -ItemType Directory -Force "$here\llama"  | Out-Null
New-Item -ItemType Directory -Force "$here\models" | Out-Null

# 1) llama.cpp server, latest release, Windows Vulkan x64 build
if (-not (Test-Path "$here\llama\llama-server.exe")) {
    Write-Host "[1/3] Finding the latest llama.cpp release..."
    $rel = Invoke-RestMethod "https://api.github.com/repos/ggml-org/llama.cpp/releases/latest"
    $asset = $rel.assets | Where-Object { $_.name -match "bin-win-vulkan-x64\.zip$" } | Select-Object -First 1
    if (-not $asset) { throw "No win-vulkan-x64 asset found. Check https://github.com/ggml-org/llama.cpp/releases" }
    Write-Host "      Downloading $($asset.name) ($([math]::Round($asset.size/1MB)) MB)..."
    Invoke-WebRequest $asset.browser_download_url -OutFile "$here\llama.zip"
    Expand-Archive "$here\llama.zip" -DestinationPath "$here\llama" -Force
    Remove-Item "$here\llama.zip"
    # some releases nest the binaries in a subfolder, flatten if so
    $exe = Get-ChildItem "$here\llama" -Recurse -Filter "llama-server.exe" | Select-Object -First 1
    if ($exe -and $exe.DirectoryName -ne "$here\llama") {
        Move-Item "$($exe.DirectoryName)\*" "$here\llama" -Force
    }
    Write-Host "      Engine ready."
} else { Write-Host "[1/3] Engine already present, skipping." }

# 2) gemma 3 4B model (QAT Q4_0, quality close to full precision at a quarter of the size)
$model = "$here\models\gemma-3-4b-it-qat-Q4_0.gguf"
if (-not (Test-Path $model)) {
    Write-Host "[2/3] Downloading the gemma 3 4B model (about 3.2 GB, this takes a while)..."
    Invoke-WebRequest "https://huggingface.co/ggml-org/gemma-3-4b-it-qat-GGUF/resolve/main/gemma-3-4b-it-qat-Q4_0.gguf" -OutFile $model
} else { Write-Host "[2/3] Model already present, skipping." }

# 3) vision projector, required so the model can see screenshots
$mmproj = "$here\models\mmproj-model-f16.gguf"
if (-not (Test-Path $mmproj)) {
    Write-Host "[3/3] Downloading the vision projector (about 850 MB)..."
    Invoke-WebRequest "https://huggingface.co/ggml-org/gemma-3-4b-it-qat-GGUF/resolve/main/mmproj-model-f16.gguf" -OutFile $mmproj
} else { Write-Host "[3/3] Vision projector already present, skipping." }

Write-Host ""
Write-Host "Setup complete. Start VideoDoc with VideoDoc.bat"
