param([switch]$Production)
$ErrorActionPreference = "Stop"
Set-Location -LiteralPath $PSScriptRoot
$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
$nodeRuntime = if ($nodeCommand) { $nodeCommand.Source } else {
    Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
}
if (-not (Test-Path -LiteralPath $nodeRuntime)) { throw "Please install Node.js 24 LTS first." }
if (-not (Test-Path -LiteralPath ".env")) { throw "Create .env and follow README initialization instructions first." }
if (-not (Test-Path -LiteralPath "node_modules/next/dist/bin/next")) { throw "Run pnpm install first." }
$env:PATH = (Split-Path -Parent $nodeRuntime) + ";" + $env:PATH
$mode = if ($Production) { "start" } else { "dev" }
& $nodeRuntime "node_modules/next/dist/bin/next" $mode --hostname 127.0.0.1
exit $LASTEXITCODE
