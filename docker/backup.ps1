$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
New-Item -ItemType Directory -Force "$PSScriptRoot\..\backups" | Out-Null
docker compose -f "$PSScriptRoot\docker-compose.yml" exec -T db pg_dump -U invoices invoices |
  Out-File -Encoding utf8 "$PSScriptRoot\..\backups\invoices-$stamp.sql"
Write-Host "OK: backups\invoices-$stamp.sql"
