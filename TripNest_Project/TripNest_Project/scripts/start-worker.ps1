param(
    [Parameter(Mandatory = $true)][ValidateSet('api', 'web')][string]$Worker,
    [Parameter(Mandatory = $true)][string]$NodePath
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$serverRoot = Join-Path $projectRoot 'server'

if ($Worker -eq 'api') {
    $workingDirectory = $serverRoot
    $workerArguments = '--env-file-if-exists=.env src/index.js'
} else {
    $workingDirectory = Join-Path $projectRoot 'client'
    $workerArguments = 'node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5173 --strictPort'
}

# #explain_notes: A hidden independent process keeps the demo available when
# the launching terminal closes, without opening a new terminal window.
$workerProcess = Start-Process -FilePath $NodePath -ArgumentList $workerArguments `
    -WorkingDirectory $workingDirectory -WindowStyle Hidden -PassThru `
    -RedirectStandardOutput (Join-Path $serverRoot "$Worker-dev.log") `
    -RedirectStandardError (Join-Path $serverRoot "$Worker-dev-error.log")

Write-Output "$Worker started in the background (PID $($workerProcess.Id))."
