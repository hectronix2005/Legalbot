# Guía de Instalación - Sistema de Auditoría de Vacaciones

## Pre-requisitos

- Node.js v14+
- MongoDB v4.4+
- Proyecto Legalbot funcionando

## Paso 1: Instalar Dependencias

```bash
cd backend
npm install node-cron
```

## Paso 2: Verificar Archivos Creados

Verificar que existen los siguientes archivos:

### Modelos
- ✅ `/backend/models/AuditReport.js`

### Servicios
- ✅ `/backend/services/vacationAuditService.js`

### Jobs
- ✅ `/backend/jobs/vacationAuditJob.js`

### Routes (modificado)
- ✅ `/backend/routes/vacations.js` (agregados endpoints de auditoría)

### Server (modificado)
- ✅ `/backend/server.js` (integración del cron job)

## Paso 3: Verificar Modelos de Vacaciones Existentes

El sistema requiere que existan los siguientes modelos:

```bash
ls backend/models/Vacation*.js
```

Debe mostrar:
- `VacationBalance.js`
- `VacationRequest.js`
- `VacationAuditLog.js`

## Paso 4: Reiniciar el Servidor

```bash
# Modo desarrollo
npm run dev

# O modo producción
node server.js
```

## Paso 5: Verificar Activación

En los logs del servidor debe aparecer:

```
✅ MongoDB listo para backups
✅ Sistema de auditoría de vacaciones activado (2 AM diario)

🛡️  SISTEMA DE PROTECCIÓN DE DATOS ACTIVADO
   ✓ Backups automáticos cada 6 horas
   ✓ Backups semanales los domingos
   ✓ Limpieza automática de backups antiguos
   ✓ Monitoreo de integridad cada 15 minutos
   ✓ Soft delete habilitado para terceros
   ✓ Auditoría completa de operaciones
   ✓ Auditoría automática de vacaciones (2 AM diario)
```

## Paso 6: Test Manual (Opcional)

### Ejecutar auditoría manual (requiere token de super_admin)

```bash
curl -X POST http://localhost:3002/api/vacations/audit/manual \
  -H "Authorization: Bearer <SUPER_ADMIN_TOKEN>" \
  -H "Content-Type: application/json"
```

### Ver estado del sistema

```bash
curl http://localhost:3002/api/vacations/audit/status \
  -H "Authorization: Bearer <SUPER_ADMIN_TOKEN>"
```

Respuesta esperada:

```json
{
  "success": true,
  "data": {
    "totalReports": 0,
    "recentReports24h": 0,
    "lastReportTimestamp": null,
    "lastReportStatus": null,
    "criticalReportsLast7Days": 0,
    "systemHealthy": true
  }
}
```

## Paso 7: Configuración de Zona Horaria (Opcional)

El sistema está configurado para zona horaria `America/Bogota`.

Para cambiar la zona horaria, editar `/backend/jobs/vacationAuditJob.js`:

```javascript
scheduledTask = cron.schedule('0 2 * * *', async () => {
  // ...
}, {
  scheduled: true,
  timezone: "America/New_York" // Cambiar aquí
});
```

Zonas horarias comunes:
- `America/Bogota` (Colombia)
- `America/Mexico_City` (México)
- `America/Lima` (Perú)
- `America/Buenos_Aires` (Argentina)
- `Europe/Madrid` (España)

## Paso 8: Configurar Alertas (Opcional)

Por defecto, las alertas críticas solo se muestran en console.

Para implementar notificaciones por email, editar `/backend/services/vacationAuditService.js`:

```javascript
async sendCriticalAlerts(company, findings) {
  // TODO: Implementar envío de emails
  // Ejemplo con nodemailer:
  // await emailService.sendCriticalAuditAlert(company, criticalErrors);
}
```

## Verificación de Endpoints

### Endpoints disponibles (ver documentación completa):

1. `GET /api/vacations/audit/run` - Ejecutar auditoría
2. `GET /api/vacations/audit/history` - Historial
3. `GET /api/vacations/audit/last` - Última auditoría
4. `GET /api/vacations/audit/metrics` - Métricas
5. `POST /api/vacations/audit/manual` - Auditoría manual
6. `GET /api/vacations/audit/critical` - Reportes críticos
7. `GET /api/vacations/audit/report/:id` - Detalle
8. `GET /api/vacations/audit/status` - Estado del sistema

## Troubleshooting

### Error: "Cannot find module 'node-cron'"

**Solución**:
```bash
cd backend
npm install node-cron
```

### Error: "Cannot find module './jobs/vacationAuditJob'"

**Solución**: Verificar que existe el archivo `/backend/jobs/vacationAuditJob.js`

### Cron no ejecuta a las 2 AM

**Posibles causas**:
1. Servidor no está corriendo 24/7
2. Zona horaria incorrecta
3. Error en la configuración del cron

**Solución**: Revisar logs y ejecutar manualmente para verificar que funciona

### No hay datos en auditoría

**Causa**: No existen registros de vacaciones en la base de datos

**Solución**: Crear datos de prueba primero:
1. Crear empleados
2. Inicializar balances de vacaciones
3. Crear solicitudes de vacaciones

## Siguientes Pasos

1. ✅ Instalar node-cron
2. ✅ Reiniciar servidor
3. ✅ Verificar activación
4. ⏳ Esperar a las 2 AM para primera ejecución automática
5. ⏳ O ejecutar auditoría manual para prueba inmediata

## Soporte

Para problemas o preguntas:
- Revisar `/docs/VACATION_AUDIT_SYSTEM.md` (documentación completa)
- Revisar `/docs/VACATION_AUDIT_IMPLEMENTATION_SUMMARY.md` (resumen de implementación)
- Contactar equipo de desarrollo
