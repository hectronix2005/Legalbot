# Script de deploy automatizado para Heroku (Windows PowerShell)
# Uso: .\scripts\deploy.ps1 [mensaje de commit]

$ErrorActionPreference = "Stop"

Write-Host "🚀 Iniciando proceso de deploy a Heroku..." -ForegroundColor Green
Write-Host ""

# Verificar que estamos en la raíz del proyecto
if (-not (Test-Path "package.json")) {
    Write-Host "❌ Error: Debes ejecutar este script desde la raíz del proyecto" -ForegroundColor Red
    exit 1
}

# Verificar que Heroku CLI está instalado
try {
    heroku --version | Out-Null
} catch {
    Write-Host "❌ Error: Heroku CLI no está instalado" -ForegroundColor Red
    Write-Host "   Instala desde: https://devcenter.heroku.com/articles/heroku-cli" -ForegroundColor Yellow
    exit 1
}

# Verificar que estamos logueados en Heroku
try {
    heroku auth:whoami | Out-Null
} catch {
    Write-Host "⚠️  No estás logueado en Heroku" -ForegroundColor Yellow
    Write-Host "   Ejecutando: heroku login" -ForegroundColor Yellow
    heroku login
}

# Paso 1: Build del frontend
Write-Host "📦 Paso 1: Construyendo frontend..." -ForegroundColor Green
Set-Location frontend
npm run build
Set-Location ..

# Paso 2: Copiar build al backend
Write-Host "📦 Paso 2: Copiando build al backend..." -ForegroundColor Green
npm run copy-build

# Paso 3: Verificar que el build existe
if (-not (Test-Path "backend/public")) {
    Write-Host "❌ Error: No se encontró el build en backend/public" -ForegroundColor Red
    exit 1
}

# Paso 4: Verificar cambios en Git
Write-Host "📝 Paso 3: Verificando cambios en Git..." -ForegroundColor Green
$gitStatus = git status --porcelain
if ([string]::IsNullOrWhiteSpace($gitStatus)) {
    Write-Host "⚠️  No hay cambios para commitear" -ForegroundColor Yellow
} else {
    # Mensaje de commit
    if ($args.Count -gt 0) {
        $commitMsg = $args[0]
    } else {
        $commitMsg = "Deploy to Heroku - $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
    }
    
    Write-Host "📝 Agregando cambios..." -ForegroundColor Green
    git add .
    
    Write-Host "💾 Creando commit: $commitMsg" -ForegroundColor Green
    git commit -m $commitMsg 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "   (No hay cambios nuevos para commitear)" -ForegroundColor Yellow
    }
}

# Paso 5: Deploy a Heroku
Write-Host "🚀 Paso 4: Desplegando a Heroku..." -ForegroundColor Green
git push heroku main 2>&1
if ($LASTEXITCODE -ne 0) {
    git push heroku master 2>&1
}

# Paso 6: Verificar deploy
Write-Host "✅ Paso 5: Verificando deploy..." -ForegroundColor Green
Start-Sleep -Seconds 3
heroku logs --tail --num 50

Write-Host ""
Write-Host "🎉 ¡Deploy completado!" -ForegroundColor Green
Write-Host ""
Write-Host "Para ver la aplicación:"
Write-Host "  heroku open"
Write-Host ""
Write-Host "Para ver logs en tiempo real:"
Write-Host "  heroku logs --tail"
Write-Host ""

