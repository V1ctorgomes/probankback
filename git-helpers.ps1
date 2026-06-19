# Probank Backend - helpers de Git
# Uso no terminal: . .\git-helpers.ps1

$env:GIT_AUTHOR_NAME = "V1ctorgomes"
$env:GIT_AUTHOR_EMAIL = "V1ctorgomes@users.noreply.github.com"
$env:GIT_COMMITTER_NAME = "V1ctorgomes"
$env:GIT_COMMITTER_EMAIL = "V1ctorgomes@users.noreply.github.com"

function pb-status {
  Write-Host "`n=== probankback (backend) ===" -ForegroundColor Cyan
  git status
  Write-Host "`nUltimo commit:" -ForegroundColor DarkGray
  git log -1 --oneline
  Write-Host "Remote: $(git remote get-url origin)`n" -ForegroundColor DarkGray
}

function pb-commit {
  param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string]$Message
  )

  git add -A
  git status --short
  git commit -m $Message
}

function pb-push {
  param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string]$Message
  )

  pb-commit -Message $Message
  git push origin main
}

function pb-sync {
  git pull origin main
}

Set-Location $PSScriptRoot

Write-Host ""
Write-Host "Probank BACKEND pronto" -ForegroundColor Green
Write-Host "Repo: https://github.com/V1ctorgomes/probankback" -ForegroundColor DarkGray
Write-Host ""
Write-Host "Comandos:" -ForegroundColor Yellow
Write-Host "  pb-status              -> ver status"
Write-Host "  pb-commit 'mensagem'   -> add + commit"
Write-Host "  pb-push 'mensagem'     -> add + commit + push"
Write-Host "  pb-sync                -> git pull"
Write-Host ""

pb-status
