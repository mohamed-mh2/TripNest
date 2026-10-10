$ErrorActionPreference = 'Stop'
$serverRoot = Split-Path -Parent $PSScriptRoot
$nodePath = (Get-Command node.exe -ErrorAction Stop).Source
& $nodePath (Join-Path $PSScriptRoot 'start-db.js')
exit $LASTEXITCODE
