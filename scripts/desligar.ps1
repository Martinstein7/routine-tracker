# Desliga o Routine Tracker com segurança (usado por "Desligar Routine Tracker.vbs"):
# primeiro o banco, do jeito certo, depois o servidor.

$root = Split-Path $PSScriptRoot -Parent
$popup = New-Object -ComObject WScript.Shell

$port = 3000
$envFile = Join-Path $root 'server\.env'
if (Test-Path $envFile) {
  $line = Select-String -Path $envFile -Pattern '^PORT=(\d+)' | Select-Object -First 1
  if ($line) { $port = [int]$line.Matches[0].Groups[1].Value }
}

$server = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
$pgCtl = Join-Path $root 'node_modules\@embedded-postgres\windows-x64\native\bin\pg_ctl.exe'
$dataDir = Join-Path $root 'server\.pgdata'
$dbRunning = Test-Path (Join-Path $dataDir 'postmaster.pid')

if (-not $server -and -not $dbRunning) {
  $popup.Popup('O Routine Tracker já está desligado.', 6, 'Routine Tracker', 64) | Out-Null
  exit
}

if ($dbRunning -and (Test-Path $pgCtl)) { & $pgCtl stop -D $dataDir -m fast -w | Out-Null }
foreach ($id in ($server.OwningProcess | Sort-Object -Unique)) { Stop-Process -Id $id -Force -ErrorAction SilentlyContinue }

$popup.Popup('Routine Tracker desligado.', 6, 'Routine Tracker', 64) | Out-Null
