#!/bin/bash

# Script para configurar respaldos automáticos
echo "🕐 Configurando respaldos automáticos para LegalBot..."

# Obtener la ruta absoluta del proyecto
PROJECT_PATH="/Users/hectorneira/Documents/PROGRAMACION BACK UP/LEGAL-BOT/Legalbot/backend"

# Crear directorio de logs si no existe
mkdir -p ~/logs/legalbot

# Crear archivo de configuración de cron
cat > /tmp/legalbot-cron << EOF
# Respaldos automáticos de LegalBot
# Respaldo diario a las 2:00 AM
0 2 * * * cd "$PROJECT_PATH" && npm run auto-backup >> ~/logs/legalbot/backup.log 2>&1

# Verificación de salud cada 6 horas
0 */6 * * * cd "$PROJECT_PATH" && npm run health >> ~/logs/legalbot/health.log 2>&1

# Respaldo semanal completo los domingos a las 3:00 AM
0 3 * * 0 cd "$PROJECT_PATH" && npm run backup >> ~/logs/legalbot/weekly-backup.log 2>&1
EOF

echo "📋 Configuración de cron creada:"
cat /tmp/legalbot-cron

echo ""
echo "🔧 Para instalar los cron jobs, ejecuta:"
echo "crontab /tmp/legalbot-cron"
echo ""
echo "📊 Para verificar los cron jobs instalados:"
echo "crontab -l"
echo ""
echo "🗑️  Para eliminar los cron jobs:"
echo "crontab -r"
