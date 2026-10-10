param([Parameter(Mandatory = $true)][string]$NodePath)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$launcherPath = Join-Path $PSScriptRoot 'start-dev.cjs'
if (-not (Test-Path -LiteralPath $NodePath)) { throw 'Node.js could not be found.' }

# #explain_notes: WMI creates an independent local process. It is hidden and
# does not inherit the launching terminal's lifetime or closing signals.
$startup = New-CimInstance -ClassName Win32_ProcessStartup -ClientOnly -Property @{ ShowWindow = [uint16]0 }
$result = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{
    CommandLine = '"' + $NodePath + '" "' + $launcherPath + '" --background --independent'
    CurrentDirectory = $projectRoot
    ProcessStartupInformation = $startup
}
if ($result.ReturnValue -ne 0) { throw "Independent startup failed with Windows code $($result.ReturnValue)." }
