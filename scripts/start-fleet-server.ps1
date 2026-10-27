# CPM Fleet — always-on background production server.
#
# Starts the Next.js production build on 0.0.0.0:3457 (the phone reaches it
# over the tailnet), hidden. Idempotent: exits 0 if the port is already
# bound, so a double-click or a boot race can never double-start it.
#
# Node path is pinned. The box has a broken PATH node wrapper (it fails with
# "stdin is not a tty" on every invocation), so the real node is used by full
# path. Same reason the .bat launcher pins it.

[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"

$repo = "C:\Users\ojuni\Documents\GAMES\cpm2"
$node = "C:\Program Files\nodejs\node.exe"
$next = "$repo\node_modules\next\dist\bin\next"
$log  = "$env:LOCALAPPDATA\Temp\cpm2-fleet-server.log"

function Wait-Ready {
    param([int]$Port, [int]$TimeoutSeconds = 30)

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        $listening = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
        if ($listening) { return $true }
        Start-Sleep -Milliseconds 700
    }
    return $false
}

# Already running? Leave it alone — never double-bind the port.
$existing = Get-NetTCPConnection -LocalPort 3457 -State Listen -ErrorAction SilentlyContinue
if ($existing) { exit 0 }

$p = Start-Process -FilePath $node `
    -ArgumentList $next, "start", "-H", "0.0.0.0", "-p", "3457" `
    -WorkingDirectory $repo `
    -RedirectStandardOutput $log `
    -RedirectStandardError "$log.err" `
    -WindowStyle Hidden `
    -PassThru

if (-not (Wait-Ready -Port 3457 -TimeoutSeconds 30)) {
    $body = "Server failed to bind 3457 within 30s.`nLog tail:`n" +
            ((Get-Content $log -Tail 10 -ErrorAction SilentlyContinue) -join "`n")
    $body | Out-File "$log.warn" -Append
    exit 1
}

$p.Id | Set-Content "$repo\data\fleet-server.pid" -ErrorAction SilentlyContinue
exit 0
