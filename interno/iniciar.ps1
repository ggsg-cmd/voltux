$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$voltuxNode = Join-Path $PSScriptRoot '..\..\..\.tools\node-v24.14.0-win-x64\node.exe'
if (-not (Test-Path -LiteralPath $voltuxNode)) {
    $voltuxNode = (Get-Command node -ErrorAction Stop).Source
}
Write-Host 'Voltux: http://127.0.0.1:3100 - mantenha esta janela aberta.'
& $voltuxNode --env-file-if-exists=.env server.mjs
