#!/bin/bash

echo "================================================"
echo "Instalación Sistema de Auditoría de Vacaciones"
echo "================================================"
echo ""

# Verificar que estamos en el directorio correcto
if [ ! -f "backend/package.json" ]; then
    echo "❌ Error: Ejecutar desde el directorio raíz del proyecto"
    exit 1
fi

echo "✓ Directorio correcto"
echo ""

# Instalar node-cron
echo "📦 Instalando node-cron..."
cd backend
npm install node-cron

if [ $? -eq 0 ]; then
    echo "✅ node-cron instalado correctamente"
else
    echo "❌ Error instalando node-cron"
    exit 1
fi

echo ""

# Verificar archivos
echo "📁 Verificando archivos del sistema..."

FILES=(
    "models/AuditReport.js"
    "services/vacationAuditService.js"
    "jobs/vacationAuditJob.js"
)

MISSING=0
for file in "${FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "  ✅ $file"
    else
        echo "  ❌ $file (FALTA)"
        MISSING=1
    fi
done

echo ""

if [ $MISSING -eq 1 ]; then
    echo "❌ Faltan archivos. Por favor revisar la implementación."
    exit 1
fi

echo "✅ Todos los archivos verificados"
echo ""
echo "================================================"
echo "Instalación completada exitosamente"
echo "================================================"
echo ""
echo "Próximos pasos:"
echo "1. Reiniciar el servidor: npm run dev"
echo "2. Verificar logs para mensaje de activación"
echo "3. Ejecutar auditoría manual (opcional)"
echo ""
echo "Documentación completa:"
echo "- docs/VACATION_AUDIT_SYSTEM.md"
echo "- docs/VACATION_AUDIT_INSTALLATION.md"
echo ""
