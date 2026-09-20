$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$portableNode = Get-ChildItem -LiteralPath (Join-Path $PSScriptRoot '.tools') -Directory -Filter 'node-*-win-x64' -ErrorAction SilentlyContinue | Select-Object -First 1
if ($portableNode) { $env:PATH = $portableNode.FullName + ';' + $env:PATH }
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Install Node.js 24 LTS, then run this script again.' }
$env:npm_config_cache = Join-Path $PSScriptRoot '.tools\npm-cache'
if (-not (Test-Path -LiteralPath 'node_modules')) {
    & npm.cmd ci
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
& npm.cmd start
exit $LASTEXITCODE
