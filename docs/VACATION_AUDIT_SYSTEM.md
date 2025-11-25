# Sistema de Auditoría Automática del Módulo de Vacaciones

## Descripción General

Sistema completo de auditoría automática que valida la integridad de datos y reglas de negocio del módulo de vacaciones. Detecta inconsistencias, errores críticos y violaciones de políticas de manera proactiva.

## Arquitectura

### Componentes Principales

1. **VacationAuditService** (`/backend/services/vacationAuditService.js`)
   - Servicio principal de auditoría
   - 7 validaciones de integridad
   - Generación de reportes detallados

2. **AuditReport Model** (`/backend/models/AuditReport.js`)
   - Modelo de datos para almacenar hallazgos
   - Índices optimizados para consultas rápidas
   - Métodos estáticos para reportes críticos

3. **Vacation Audit Job** (`/backend/jobs/vacationAuditJob.js`)
   - Cron job programado (diario a las 2 AM)
   - Ejecución manual disponible
   - Manejo de errores y logging

4. **API Endpoints** (`/backend/routes/vacations.js`)
   - 8 endpoints REST para gestión de auditorías
   - Control de acceso por roles
   - Métricas y estadísticas

## Validaciones Implementadas

### 1. Balance Integrity Validation
**Objetivo**: Verificar que la fórmula de saldo sea correcta

```
availableDays = accruedDays - enjoyedDays - approvedPendingDays
```

**Severidad**: HIGH
**Tolerancia**: 0.01 días (por redondeo)

### 2. Negative Balance Detection
**Objetivo**: Detectar saldos negativos (datos corruptos)

**Campos validados**:
- `availableDays < 0`
- `accruedDays < 0`
- `enjoyedDays < 0`
- `approvedPendingDays < 0`

**Severidad**: CRITICAL

### 3. Request State Machine Validation
**Objetivo**: Validar que las solicitudes estén en estados válidos

**Estados válidos**:
- `requested`
- `approved`
- `scheduled`
- `enjoyed`
- `rejected`
- `cancelled`

**Severidad**: HIGH

### 4. Approved Pending Consistency Check
**Objetivo**: Verificar consistencia entre días aprobados pendientes y solicitudes

```
approvedPendingDays = SUM(requestedDays WHERE status IN ['approved', 'scheduled'])
```

**Severidad**: MEDIUM
**Tolerancia**: 0.01 días

### 5. Unaccounted Enjoyment Detection
**Objetivo**: Detectar solicitudes disfrutadas sin log de auditoría

**Validación**:
- Toda solicitud con `status = 'enjoyed'` debe tener log con `action = 'enjoy'`

**Severidad**: MEDIUM

### 6. Audit Logs Privacy Validation
**Objetivo**: Verificar que logs NO contengan PII (datos personales)

**Campos prohibidos en logs**:
- `name`
- `email`
- `firstName`
- `lastName`
- `personalInfo`

**Severidad**: CRITICAL (VIOLACIÓN DE PRIVACIDAD)

### 7. Accrual Up-to-Date Validation
**Objetivo**: Verificar que la causación esté actualizada

**Thresholds**:
- Advertencia (LOW): > 2 días sin causación
- Advertencia (MEDIUM): > 7 días sin causación

## API Endpoints

### 1. GET /api/vacations/audit/run
Ejecutar auditoría completa para una compañía

**Roles**: `admin`, `talento_humano`

**Response**:
```json
{
  "success": true,
  "data": {
    "timestamp": "2025-11-20T10:30:00.000Z",
    "companyId": "507f1f77bcf86cd799439011",
    "checks": [
      "balance_integrity",
      "negative_balances",
      "request_states",
      "approved_pending_consistency",
      "unaccounted_enjoyments",
      "audit_logs_privacy",
      "accrual_up_to_date"
    ],
    "errors": [],
    "warnings": [],
    "summary": {
      "totalChecks": 7,
      "totalErrors": 0,
      "totalWarnings": 0,
      "criticalErrors": 0,
      "highErrors": 0,
      "employeesAudited": 125,
      "requestsAudited": 342,
      "executionTimeMs": 1250
    }
  }
}
```

### 2. GET /api/vacations/audit/history
Obtener historial de auditorías

**Query Params**:
- `limit` (default: 10): Número de reportes
- `status`: Filtrar por estado (PASSED, FAILED, WARNING)
- `daysBack` (default: 30): Días hacia atrás

**Roles**: `admin`, `talento_humano`

### 3. GET /api/vacations/audit/last
Obtener última auditoría ejecutada

**Roles**: `admin`, `talento_humano`

### 4. GET /api/vacations/audit/metrics
Obtener métricas de auditoría

**Query Params**:
- `daysBack` (default: 30)

**Response**:
```json
{
  "success": true,
  "data": {
    "totalAudits": 30,
    "passed": 28,
    "failed": 2,
    "warnings": 5,
    "lastAudit": {
      "timestamp": "2025-11-20T02:00:00.000Z",
      "status": "PASSED",
      "errors": 0,
      "warnings": 0
    },
    "criticalIssues": 0,
    "averageExecutionTime": 1150
  }
}
```

**Roles**: `admin`, `talento_humano`

### 5. POST /api/vacations/audit/manual
Ejecutar auditoría manual inmediata (todas las compañías)

**Roles**: `super_admin`

**Response**:
```json
{
  "success": true,
  "message": "Auditoría manual completada",
  "data": {
    "totalCompanies": 15,
    "successful": 14,
    "failed": 1,
    "criticalAlerts": 2
  }
}
```

### 6. GET /api/vacations/audit/critical
Obtener reportes con errores críticos

**Query Params**:
- `daysBack` (default: 7)

**Roles**: `admin`, `talento_humano`

### 7. GET /api/vacations/audit/report/:reportId
Obtener detalle de un reporte específico

**Roles**: `admin`, `talento_humano`

### 8. GET /api/vacations/audit/status
Verificar estado del sistema de auditoría

**Roles**: `super_admin`

**Response**:
```json
{
  "success": true,
  "data": {
    "totalReports": 450,
    "recentReports24h": 15,
    "lastReportTimestamp": "2025-11-20T02:00:00.000Z",
    "lastReportStatus": "PASSED",
    "criticalReportsLast7Days": 0,
    "systemHealthy": true
  }
}
```

## Cron Job - Programación Automática

### Daily Audit (Diario)
**Horario**: 2:00 AM (zona horaria configurada: America/Bogota)
**Función**: `initDailyAudit()`

```javascript
// Se ejecuta automáticamente cada día a las 2 AM
// Audita todas las compañías activas
// Envía alertas en caso de errores críticos
```

### Weekly Audit (Semanal - Opcional)
**Horario**: Domingos 3:00 AM
**Función**: `initWeeklyAudit()`

### Manual Execution
```javascript
const { runManualAudit } = require('./jobs/vacationAuditJob');
await runManualAudit();
```

## Niveles de Severidad

| Severidad | Descripción | Acción Requerida |
|-----------|-------------|------------------|
| **CRITICAL** | Error crítico de integridad o seguridad | Acción inmediata, notificación automática |
| **HIGH** | Error importante de datos | Revisión urgente |
| **MEDIUM** | Inconsistencia moderada | Revisión en 24-48 horas |
| **LOW** | Advertencia menor | Revisión rutinaria |

## Sistema de Alertas

### Alertas Críticas
Se envían automáticamente cuando:
- Se detectan errores con severidad CRITICAL
- Saldos negativos
- PII en logs de auditoría
- Datos corruptos

**Canales** (configurables):
- Console logging (implementado)
- Email (por implementar)
- Slack (por implementar)
- Webhook (por implementar)

## Métricas Reportadas

### Por Auditoría
- Total de empleados auditados
- Total de solicitudes auditadas
- Errores críticos encontrados
- Advertencias
- Tiempo de ejecución (ms)

### Históricas
- Total de auditorías ejecutadas
- Tasa de éxito/fallo
- Tiempo promedio de ejecución
- Tendencias de errores

## Base de Datos

### Colección: `auditreports`

**Índices**:
- `{ companyId: 1, timestamp: -1 }`
- `{ status: 1, timestamp: -1 }`
- `{ 'findings.summary.criticalErrors': 1 }` (parcial)

**TTL**: No configurado (mantener histórico completo)

**Estimación de crecimiento**:
- 1 reporte/día/compañía
- ~30 KB por reporte
- 15 compañías = ~450 KB/día = ~13.5 MB/mes

## Integración con Server.js

El sistema se inicializa automáticamente al arrancar el servidor:

```javascript
// backend/server.js
const { initDailyAudit } = require('./jobs/vacationAuditJob');

connectDB().then(() => {
  // ... otros sistemas ...

  // Sistema de auditoría de vacaciones
  initDailyAudit();
  console.log('✅ Sistema de auditoría de vacaciones activado (2 AM diario)');
});
```

## Testing

### Manual Testing
```bash
# Ejecutar auditoría manual desde API
curl -X POST http://localhost:3002/api/vacations/audit/manual \
  -H "Authorization: Bearer <super_admin_token>"

# Ver último reporte
curl http://localhost:3002/api/vacations/audit/last \
  -H "Authorization: Bearer <token>" \
  -H "X-Company-Id: <companyId>"

# Ver métricas
curl http://localhost:3002/api/vacations/audit/metrics?daysBack=30 \
  -H "Authorization: Bearer <token>" \
  -H "X-Company-Id: <companyId>"
```

### Programmatic Testing
```javascript
const vacationAuditService = require('./services/vacationAuditService');

// Ejecutar auditoría para una compañía
const findings = await vacationAuditService.runFullAudit(companyId);
console.log('Errors:', findings.errors.length);
console.log('Warnings:', findings.warnings.length);

// Ver historial
const history = await vacationAuditService.getAuditHistory(companyId, {
  limit: 10,
  daysBack: 30
});

// Ver métricas
const metrics = await vacationAuditService.getAuditMetrics(companyId, 30);
```

## Mantenimiento

### Logs
Los logs del sistema se encuentran en:
- Console output del servidor
- Colección `auditreports` en MongoDB

### Limpieza
```javascript
// Eliminar reportes antiguos (ejemplo: > 1 año)
await AuditReport.deleteMany({
  timestamp: { $lt: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) }
});
```

### Monitoreo
Verificar diariamente:
- `/api/vacations/audit/status` para estado del sistema
- `/api/vacations/audit/critical` para errores críticos recientes

## Resolución de Problemas

### Auditoría no ejecuta automáticamente
1. Verificar que el cron job esté inicializado en server.js
2. Revisar logs del servidor para errores
3. Verificar zona horaria configurada

### Errores CRITICAL detectados
1. Revisar `/api/vacations/audit/critical` para detalles
2. Identificar compañía y empleados afectados
3. Ejecutar `/api/vacations/audit/run` para auditoría completa
4. Corregir datos manualmente si es necesario

### Performance lenta
1. Verificar índices en MongoDB
2. Revisar `executionTimeMs` en métricas
3. Considerar ejecutar auditoría en horarios de baja carga

## Próximas Mejoras

- [ ] Implementar notificaciones por email
- [ ] Integración con Slack
- [ ] Dashboard de visualización de métricas
- [ ] Auto-corrección de errores menores
- [ ] Exportación de reportes a PDF/Excel
- [ ] Webhooks para integración con sistemas externos
- [ ] Auditoría en tiempo real (triggers)

## Soporte

Para issues o preguntas:
- Revisar logs del servidor
- Ejecutar `/api/vacations/audit/status` para diagnóstico
- Contactar equipo de desarrollo con detalles del error
