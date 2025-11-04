# Entorno de Desarrollo Local - ENTORNO PRINCIPAL

## Fecha: 3 de Noviembre 2025

## ⚠️ IMPORTANTE: Este es tu entorno PRINCIPAL de desarrollo

Tu entorno local en **http://localhost:3002** es ahora tu entorno principal y protegido para desarrollo.

## Configuración Actual

### Frontend Local
```
URL:      http://localhost:3002
Puerto:   3002
Estado:   🟢 ACTIVO Y PROTEGIDO
```

### Backend Local
```
URL:      http://localhost:5001
Puerto:   5001
Estado:   🟢 ACTIVO Y PROTEGIDO
```

### Base de Datos
```
MongoDB Local:  mongodb://localhost:27017/legal-contracts
Estado:         🟢 ACTIVO - TUS DATOS PRINCIPALES
```

## Seguridad Implementada 🔒

### 1. Restricción de Acceso
- ✅ Solo accesible desde localhost (127.0.0.1)
- ✅ Rechaza conexiones externas automáticamente
- ✅ No expuesto a la red local ni internet

### 2. Verificación de Origen
- ✅ Solo acepta peticiones de http://localhost:3002
- ✅ Rechaza orígenes externos
- ✅ CORS configurado restrictivamente

### 3. Logging de Seguridad
- ✅ Todos los accesos son registrados
- ✅ Alertas de intentos de acceso no autorizado
- ✅ Monitoreo de IPs y orígenes

### 4. Protección de Datos
- ✅ Sistema de backups automático
- ✅ Verificación de integridad
- ✅ Backups en shutdown/startup

## Datos en tu Entorno Local

```
✓ 21 contratos generados
✓ 10 plantillas de contratos
✓ 3 suppliers/terceros
✓ 4 empresas
✓ 4 usuarios
✓ 9 configuraciones de tipos
✓ 6 asociaciones usuario-empresa
━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total: 57 documentos
```

## Cómo Iniciar tu Entorno Local

### Opción 1: Inicio Rápido (Todo en Uno)

```bash
# Desde la raíz del proyecto
npm run dev:all
```

### Opción 2: Inicio Manual

#### Terminal 1 - Backend:
```bash
cd backend
node server.js
```

#### Terminal 2 - Frontend:
```bash
cd frontend
PORT=3002 npm run dev
```

## Credenciales de Acceso

### Usuario Admin
```
Email:    admin@demo.com
Password: 123456
Empresas: 3 (TechCorp, Legal Solutions, Innovate Inc.)
```

### Usuario Abogado
```
Email:    abogado@demo.com
Password: 123456
```

### Usuario Solicitante
```
Email:    solicitante@demo.com
Password: 123456
```

### Super Admin
```
Email:    super_admin@demo.com
Password: admin123
```

## URLs Importantes

### Desarrollo Local (PRINCIPAL)
- Frontend: http://localhost:3002
- Backend API: http://localhost:5001/api
- MongoDB: mongodb://localhost:27017/legal-contracts

### Producción (Heroku - SOLO PARA DEPLOYMENT)
- Frontend: https://legal-bot-frontend-prod-61613cf280b0.herokuapp.com/
- Backend: https://legal-bot-backend-prod-7df4b18ba0f7.herokuapp.com/
- MongoDB: MongoDB Atlas

## Flujo de Trabajo Recomendado

### 1. Desarrollo
```
1. Trabaja en localhost:3002
2. Todos tus datos persisten en MongoDB local
3. Prueba exhaustivamente
```

### 2. Deployment a Producción
```
1. Asegúrate que todo funciona localmente
2. Commit cambios a Git
3. Push a Heroku solo cuando estés listo
4. Verifica producción
```

### 3. Sincronización de Datos
```
# Si necesitas migrar datos locales a producción:
cd backend
node scripts/migrate-to-atlas.js
```

## Variables de Entorno

### .env.local (DESARROLLO - NO COMMITEAR)
```bash
LOCAL_DEV_MODE=true
FRONTEND_PORT=3002
BACKEND_PORT=5001
MONGODB_URI=mongodb://localhost:27017/legal-contracts
NODE_ENV=development
```

### .env (PRODUCCIÓN - EN HEROKU)
```bash
NODE_ENV=production
MONGODB_URI=mongodb+srv://...@cluster0.mongodb.net/legal_bot
PORT=5001 (auto en Heroku)
```

## Sistema de Backups

Tu entorno local crea backups automáticos en:
```
backend/backups/
  ├── backup-startup-*.json     (Al iniciar el servidor)
  ├── backup-shutdown-*.json    (Al detener el servidor)
  ├── backup-hourly-*.json      (Cada hora)
  └── backup-weekly-*.json      (Semanales)
```

## Protección Adicional

### Firewall (Opcional)
Si quieres protección adicional de firewall:

**macOS:**
```bash
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --add /usr/local/bin/node
```

**Linux:**
```bash
sudo ufw allow from 127.0.0.1 to any port 3002
sudo ufw allow from 127.0.0.1 to any port 5001
```

### Hosts File
Para asegurar que solo resuelve localhost:
```bash
# /etc/hosts
127.0.0.1 legalbot.local
```

Luego accede vía: http://legalbot.local:3002

## Verificación de Seguridad

### Probar que está protegido:
```bash
# Desde otra máquina en tu red (debería fallar):
curl http://[TU_IP]:3002
# Resultado esperado: Connection refused o timeout

# Desde localhost (debería funcionar):
curl http://localhost:3002
# Resultado esperado: HTML del frontend
```

## Troubleshooting

### Puerto ocupado
```bash
# Verificar qué usa el puerto
lsof -i :3002
lsof -i :5001

# Matar proceso si es necesario
kill -9 <PID>
```

### MongoDB no inicia
```bash
# Iniciar MongoDB manualmente
mongod --dbpath /data/db

# O usar el servicio del sistema
brew services start mongodb-community  # macOS
sudo systemctl start mongod            # Linux
```

### Frontend no conecta con backend
```bash
# Verificar que backend esté corriendo
curl http://localhost:5001/api/health

# Verificar configuración
cat frontend/.env
# Debe tener: REACT_APP_API_URL=http://localhost:5001/api
```

## Scripts Útiles

### package.json (añadir estos scripts):
```json
{
  "scripts": {
    "dev:backend": "cd backend && node server.js",
    "dev:frontend": "cd frontend && PORT=3002 npm run dev",
    "dev:all": "concurrently \"npm run dev:backend\" \"npm run dev:frontend\"",
    "backup": "cd backend && node scripts/backup-database.js",
    "migrate": "cd backend && node scripts/migrate-to-atlas.js"
  }
}
```

## Archivos Importantes

```
.
├── .env.local                          # Configuración local (NO COMMITEAR)
├── backend/
│   ├── .env                            # Config backend
│   ├── server.js                       # Servidor principal
│   ├── middleware/
│   │   └── localDevSecurity.js         # 🔒 Seguridad local
│   ├── backups/                        # Backups automáticos
│   └── scripts/
│       ├── backup-database.js          # Script de backup
│       └── migrate-to-atlas.js         # Migración a producción
└── frontend/
    ├── .env                            # Config frontend
    └── src/
        ├── services/api.ts             # Cliente API
        └── context/AuthContext.tsx     # Autenticación
```

## Comandos Rápidos

```bash
# Iniciar todo
npm run dev:all

# Solo backend
npm run dev:backend

# Solo frontend
npm run dev:frontend

# Crear backup manual
npm run backup

# Migrar a producción
npm run migrate

# Ver logs del backend local
tail -f backend/logs/server.log
```

## Notas de Seguridad

1. **NUNCA** expongas tu puerto 3002/5001 a internet
2. **NUNCA** compartas tu .env.local
3. **SIEMPRE** usa localhost, no tu IP local
4. **SIEMPRE** verifica que los backups se están creando
5. **REVISA** regularmente los logs de acceso

## Soporte

Si encuentras problemas:

1. Revisa los logs del servidor
2. Verifica que MongoDB esté corriendo
3. Confirma que los puertos no estén ocupados
4. Verifica las variables de entorno

---

**Estado**: 🟢 ENTORNO LOCAL PROTEGIDO Y OPERATIVO
**Última actualización**: 3 de Noviembre 2025
**Puerto Frontend**: 3002
**Puerto Backend**: 5001
**Base de Datos**: MongoDB Local (legal-contracts)
