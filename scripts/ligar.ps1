# Liga o Routine Tracker em segundo plano, sem janela (usado por "Ligar Routine Tracker.vbs").
# O que o servidor escreveria na tela vai para server\servidor.log.

$root = Split-Path $PSScriptRoot -Parent
$log = Join-Path $root 'server\servidor.log'
$popup = New-Object -ComObject WScript.Shell

$port = 3000
$envFile = Join-Path $root 'server\.env'
if (Test-Path $envFile) {
  $line = Select-String -Path $envFile -Pattern '^PORT=(\d+)' | Select-Object -First 1
  if ($line) { $port = [int]$line.Matches[0].Groups[1].Value }
}

if (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue) {
  $popup.Popup("O Routine Tracker já está ligado.`n`nhttp://localhost:$port", 8, 'Routine Tracker', 64) | Out-Null
  exit
}

Start-Process powershell.exe -WindowStyle Hidden -WorkingDirectory $root -ArgumentList '-NoProfile', '-Command', "npm start *> '$log'"

# Espera o servidor responder (o banco leva alguns segundos para subir).
$ready = $false
for ($i = 0; $i -lt 120 -and -not $ready; $i++) {
  Start-Sleep -Seconds 1
  try {
    Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 "http://localhost:$port/api/health" | Out-Null
    $ready = $true
  } catch {}
}

if ($ready) {
  $network = ''
  $match = Select-String -Path $log -Pattern 'Acesso na rede: (http[^"]+)' -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($match) { $network = "`nNa rede: " + $match.Matches[0].Groups[1].Value }
  $popup.Popup("Routine Tracker ligado.`n`nNesta máquina: http://localhost:$port$network`n`nPara desligar, use ""Desligar Routine Tracker"".", 10, 'Routine Tracker', 64) | Out-Null
} else {
  $popup.Popup("O Routine Tracker não respondeu depois de 2 minutos.`n`nVeja o que aconteceu em:`n$log", 0, 'Routine Tracker', 48) | Out-Null
}
