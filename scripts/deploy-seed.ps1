# ============================================================================
#  GPSPrevIA - provisiona o banco (schema + seed + migrations + dados Grupo GPS)
#  Versao PowerShell do scripts/deploy-seed.sh. Idempotente.
#
#  Uso (na raiz do repo):
#    $env:DATABASE_URL='postgres://user:pwd@host:5432/db'
#    powershell -ExecutionPolicy Bypass -File scripts\deploy-seed.ps1
#    # opcional: micro-pulsos do piloto via API:
#    powershell -ExecutionPolicy Bypass -File scripts\deploy-seed.ps1 -AppUrl https://seu-dominio
# ============================================================================
param([string]$AppUrl = "")
$ErrorActionPreference = "Stop"

$DbUrl = $env:DATABASE_URL
if (-not $DbUrl) { throw "Defina DATABASE_URL antes de rodar (ex.: `$env:DATABASE_URL='postgres://...')" }
$env:PGCLIENTENCODING = "UTF8"

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

# Localiza o psql (PATH -> instalacao padrao do Windows)
$psql = $env:PSQL
if (-not $psql) { $psql = (Get-Command psql -ErrorAction SilentlyContinue).Source }
if (-not $psql) { $psql = (Get-ChildItem "C:\Program Files\PostgreSQL\*\bin\psql.exe" -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty FullName) }
if (-not $psql) { throw "psql nao encontrado. Defina `$env:PSQL com o caminho do psql.exe" }

function PsqlFile($file) { & $psql $DbUrl -v ON_ERROR_STOP=1 -q -f $file; if ($LASTEXITCODE -ne 0) { throw "psql falhou em $file" } }

Write-Host "» 1/4  schema + seed (db/init)"
Get-ChildItem db/init/*.sql | Sort-Object Name | ForEach-Object {
  Write-Host "   - $($_.Name)"
  PsqlFile $_.FullName
}

Write-Host "» 2/4  migrations"
if (-not (Test-Path node_modules/postgres)) { npm install --no-save postgres@3 | Out-Null }
$env:DATABASE_URL = $DbUrl
node scripts/migrate.mjs
if ($LASTEXITCODE -ne 0) { throw "migrate.mjs falhou" }

Write-Host "» 3/4  dados do Grupo GPS (180k colaboradores, ~147k respostas, segmentos)"
PsqlFile "db/seed-grupo-gps.sql"
PsqlFile "db/seed-diretoria-user.sql"

if ($AppUrl) {
  Write-Host "» 4/4  micro-pulsos recentes do piloto via $AppUrl"
  node scripts/simular-pulsos.mjs 60 --url $AppUrl
} else {
  Write-Host "» 4/4  (pulado) use -AppUrl https://seu-dominio para gerar micro-pulsos do piloto"
}

Write-Host ""
Write-Host "OK. Login (senha previa123): diretoria@gps.com.br / gestor@translog.com.br / clinica@translog.com.br / admin@p2a.tech"
