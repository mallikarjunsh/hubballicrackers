# Run in PowerShell:  cd C:\repo ; .\setup.ps1
Set-Location $PSScriptRoot
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Write-Error "Install Node.js LTS from https://nodejs.org first."; exit 1 }
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
npm install
code .          # opens VS Code (the folder-open task then starts the dev server)
npm run dev     # also run here so it is up immediately
