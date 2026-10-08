# instalar-ponte.ps1 — instala a ponte de impressao (print-server.js) como
# tarefa agendada do logon do Windows, inicia agora e testa a porta 3001.
# A ponte precisa rodar NO computador que envia as impressoes.
#
# Uso:     powershell -ExecutionPolicy Bypass -File instalar-ponte.ps1
# Remover: powershell -ExecutionPolicy Bypass -File instalar-ponte.ps1 -Remover

param([switch]$Remover)

$ErrorActionPreference = 'Stop'
$dir    = Split-Path -Parent $MyInvocation.MyCommand.Path
$ponte  = Join-Path $dir 'print-server.js'
$tarefa = 'CanalQbPonteZebra'

if ($Remover) {
  Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -like '*print-server.js*' } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
  Unregister-ScheduledTask -TaskName $tarefa -Confirm:$false -ErrorAction SilentlyContinue
  Write-Output "Tarefa '$tarefa' removida (se existia) e ponte encerrada."
  exit 0
}

if (-not (Test-Path -LiteralPath $ponte)) {
  Write-Output "ERRO: print-server.js nao encontrado em: $ponte"
  exit 1
}

$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
  Write-Output "ERRO: Node.js nao encontrado no PATH. Instale em https://nodejs.org"
  exit 1
}

# Encerra uma ponte anterior para nao deixar duas instancias na mesma porta
Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction SilentlyContinue |
  Where-Object { $_.CommandLine -like '*print-server.js*' } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }

# powershell -WindowStyle Hidden envolve o node: sem janela de console no logon
$argumento = '-NoProfile -WindowStyle Hidden -Command "& ''{0}'' ''{1}''"' -f $node.Source, $ponte
$acao    = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $argumento -WorkingDirectory $dir
$gatilho = New-ScheduledTaskTrigger -AtLogOn
$config  = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
             -ExecutionTimeLimit ([TimeSpan]::Zero) -Hidden
Register-ScheduledTask -TaskName $tarefa -Action $acao -Trigger $gatilho -Settings $config -Force | Out-Null
Start-ScheduledTask -TaskName $tarefa

# Testa a porta 3001 (ate ~15s)
$ok = $false
for ($i = 0; $i -lt 30; $i++) {
  Start-Sleep -Milliseconds 500
  try {
    $tcp = New-Object Net.Sockets.TcpClient
    $tcp.Connect('127.0.0.1', 3001)
    $tcp.Close(); $ok = $true; break
  } catch { }
}

Write-Output ""
if ($ok) {
  Write-Output "OK! Ponte instalada e respondendo em http://localhost:3001"
} else {
  Write-Output "ATENCAO: tarefa criada, mas a porta 3001 nao respondeu em 15s."
  Write-Output "         Rode manualmente para ver mensagens: node `"$ponte`""
}
Write-Output ""
Write-Output "A tarefa '$tarefa' inicia a ponte sozinha em cada logon do Windows."
Write-Output "No app publicado no GitHub, na primeira impressao o navegador pergunta"
Write-Output "'acesso a rede local' — clique PERMITIR (uma unica vez)."
Write-Output "Para remover depois: powershell -ExecutionPolicy Bypass -File instalar-ponte.ps1 -Remover"
