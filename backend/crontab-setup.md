# 🕐 Configuración de Respaldos Automáticos

## Configuración de Cron Jobs

Para configurar respaldos automáticos, puedes usar cron jobs en sistemas Unix/Linux/macOS:

### 1. Respaldo Diario (Recomendado)

```bash
# Editar crontab
crontab -e

# Agregar esta línea para respaldo diario a las 2:00 AM
0 2 * * * cd /Users/hectorneira/Documents/PROGRAMACION\ BACK\ UP/LEGAL-BOT/Legalbot/backend && npm run auto-backup >> /var/log/legalbot-backup.log 2>&1
```

### 2. Verificación de Salud Cada 6 Horas

```bash
# Agregar esta línea para verificación cada 6 horas
0 */6 * * * cd /Users/hectorneira/Documents/PROGRAMACION\ BACK\ UP/LEGAL-BOT/Legalbot/backend && npm run health >> /var/log/legalbot-health.log 2>&1
```

### 3. Monitoreo Continuo (Opcional)

```bash
# Para monitoreo continuo (requiere PM2 o similar)
cd /Users/hectorneira/Documents/PROGRAMACION\ BACK\ UP/LEGAL-BOT/Legalbot/backend
node scripts/monitor.js start
```

## Comandos Disponibles

### Respaldos Manuales

```bash
# Crear respaldo manual
npm run backup

# Verificar salud de la base de datos
npm run health

# Crear respaldo automático
npm run auto-backup
```

### Restauración

```bash
# Listar respaldos disponibles
ls -la backups/

# Restaurar desde respaldo específico
npm run restore backup-2024-01-15T10-30-00-000Z.json
```

## Estructura de Respaldos

```
backend/
├── backups/
│   ├── backup-2024-01-15T10-30-00-000Z.json
│   ├── auto-backup-2024-01-15T14-30-00-000Z.json
│   └── emergency-1705320600000.json
├── logs/
│   ├── critical-operations.log
│   └── health-check.log
└── scripts/
    ├── backup-database.js
    ├── restore-database.js
    ├── health-check.js
    └── auto-backup.js
```

## Alertas y Notificaciones

El sistema incluye:

- ✅ **Logs de operaciones críticas** (DELETE, PUT, PATCH)
- ✅ **Verificación automática de integridad**
- ✅ **Respaldos de emergencia** en caso de problemas
- ✅ **Limpieza automática** de respaldos antiguos
- ✅ **Monitoreo continuo** opcional

## Configuración de Producción

Para producción, considera:

1. **Respaldos en la nube** (AWS S3, Google Cloud Storage)
2. **Notificaciones por email** en caso de errores
3. **Monitoreo con herramientas** como PM2 o Docker
4. **Respaldos en múltiples ubicaciones**

### Ejemplo con PM2

```bash
# Instalar PM2
npm install -g pm2

# Crear archivo ecosystem.config.js
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'legalbot-api',
    script: 'server.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production'
    }
  }, {
    name: 'legalbot-monitor',
    script: 'scripts/monitor.js',
    args: 'start',
    instances: 1,
    autorestart: true,
    watch: false
  }]
};
EOF

# Iniciar aplicaciones
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

