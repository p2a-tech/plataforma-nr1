# ============================================================================
#  PrevIA - bootstrap do Postgres LOCAL (uso unico, dev)
# ----------------------------------------------------------------------------
#  Cria o usuario/banco `previa` na sua instancia PostgreSQL 18 nativa, usando
#  a senha ja gerada em `.env.local` (DATABASE_URL).
#
#  Passos: backup do pg_hba -> trust temporario em 127.0.0.1 -> reinicia ->
#  cria role+db `previa` -> RESTAURA o pg_hba original (scram) e reinicia.
#  O restore roda no finally (sempre, mesmo se algo falhar).
#
#  Rode UMA vez (PowerShell "Executar como administrador"):
#    powershell -ExecutionPolicy Bypass -File scripts\bootstrap-pg-local.ps1
# ============================================================================
$ErrorActionPreference = 'Stop'

$PgBin   = 'C:\Program Files\PostgreSQL\18\bin'
$psql    = Join-Path $PgBin 'psql.exe'
$hba     = 'C:\Program Files\PostgreSQL\18\data\pg_hba.conf'
$bak     = "$hba.previa.bak"
$svc     = 'postgresql-x64-18'
$proj    = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $proj '.env.local'

# --- le a senha do .env.local (DATABASE_URL=postgres://previa:SENHA@...) ---
if (-not (Test-Path $envFile)) { throw ".env.local nao encontrado em $envFile" }
$line = (Get-Content $envFile | Where-Object { $_ -match '^DATABASE_URL=' })
if (-not $line) { throw 'DATABASE_URL nao encontrada no .env.local' }
if ($line -notmatch 'postgres://previa:([^@]+)@') { throw 'Nao consegui extrair a senha da DATABASE_URL' }
$pwd = $Matches[1]
Write-Host ("Senha lida do .env.local (mascarada): {0}****" -f $pwd.Substring(0,4))

try {
  if (-not (Test-Path $bak)) { Copy-Item $hba $bak -Force }
  $orig  = Get-Content $bak -Raw
  $trust = "# TEMP previa bootstrap`r`nhost all all 127.0.0.1/32 trust`r`nhost all all ::1/128 trust`r`n"
  Set-Content -Path $hba -Value ($trust + $orig) -Encoding ASCII
  Restart-Service $svc -Force
  Start-Sleep -Seconds 4

  $env:PGPASSWORD = ''
  # cria a role (ignora erro se ja existe) e garante senha/atributos
  & $psql -h 127.0.0.1 -U postgres -d postgres -c ("CREATE ROLE previa LOGIN SUPERUSER PASSWORD '{0}';" -f $pwd) 2>$null
  & $psql -h 127.0.0.1 -U postgres -d postgres -v ON_ERROR_STOP=1 -c ("ALTER ROLE previa LOGIN SUPERUSER PASSWORD '{0}';" -f $pwd)

  $exists = (& $psql -h 127.0.0.1 -U postgres -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='previa'")
  if (("$exists").Trim() -ne '1') {
    & $psql -h 127.0.0.1 -U postgres -d postgres -v ON_ERROR_STOP=1 -c 'CREATE DATABASE previa OWNER previa;'
    Write-Host "Banco 'previa' criado."
  } else {
    Write-Host "Banco 'previa' ja existia (senha atualizada)."
  }
}
finally {
  if (Test-Path $bak) {
    Copy-Item $bak $hba -Force
    Restart-Service $svc -Force
    Start-Sleep -Seconds 4
    Write-Host 'pg_hba.conf restaurado (scram-sha-256).'
  }
}

# valida conexao ja com scram + senha
$env:PGPASSWORD = $pwd
$u = ("$(& $psql -h 127.0.0.1 -U previa -d previa -tAc 'select current_user')").Trim()
$d = ("$(& $psql -h 127.0.0.1 -U previa -d previa -tAc 'select current_database()')").Trim()
Write-Host ("OK - conectado como: {0} / banco {1}" -f $u, $d)
Write-Host 'Pronto. Avise o assistente para aplicar schema/seed/migrations.'
