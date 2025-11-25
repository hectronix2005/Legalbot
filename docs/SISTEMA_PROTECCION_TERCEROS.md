# Sistema Robusto de Protección de Terceros

## 🚨 Problema Identificado

Los terceros estaban desapareciendo de la base de datos porque el sistema usaba **eliminación física** (`Supplier.deleteOne()`), borrando permanentemente los registros sin posibilidad de recuperación.

## ✅ Solución Implementada

Se ha implementado un sistema completo de protección de datos que incluye:

### 1. Soft Delete (Eliminación Lógica)

En lugar de borrar los registros físicamente, ahora se marcan como eliminados:

**Modelo Supplier actualizado** (`backend/models/Supplier.js`):
```javascript
{
  deleted: Boolean,           // Marca si está eliminado
  deletedAt: Date,           // Cuándo se eliminó
  deletedBy: ObjectId,       // Quién lo eliminó
  deletionReason: String     // Por qué se eliminó
}
```

**Métodos agregados:**
- `supplier.softDelete(userId, reason)` - Marca como eliminado
- `supplier.restore()` - Restaura un tercero eliminado
- Query helper `.notDeleted()` - Filtra eliminados en consultas

### 2. Sistema de Auditoría Completo

**Nuevo modelo SupplierAuditLog** (`backend/models/SupplierAuditLog.js`):

Registra TODAS las operaciones sobre terceros:
- CREATE, UPDATE, DELETE, RESTORE
- Estado anterior y posterior
- Campos modificados
- Usuario, IP, navegador
- Detección automática de operaciones sospechosas

**Ejemplo de log de auditoría:**
```javascript
{
  supplier: ObjectId,
  operation: "DELETE",
  performedBy: ObjectId,
  company: ObjectId,
  stateBefore: { /* datos completos antes */ },
  stateAfter: { /* datos completos después */ },
  changedFields: [
    { field: "deleted", oldValue: false, newValue: true }
  ],
  ipAddress: "192.168.1.1",
  userAgent: "Mozilla/5.0...",
  isSuspicious: false,
  createdAt: Date
}
```

### 3. Middleware de Protección

**Nuevo middleware** (`backend/middleware/supplierProtection.js`):

#### a) Prevención de Eliminaciones Masivas
- Límite: 10 eliminaciones en 5 minutos (usuarios normales)
- Límite: 50 eliminaciones en 5 minutos (super_admin)
- Bloqueo automático si se excede

#### b) Backup Antes de Operaciones Críticas
- Crea backup automático antes de operaciones masivas
- Almacena referencia del backup en los logs

#### c) Auditoría Automática
- Intercepta respuestas exitosas
- Registra automáticamente en SupplierAuditLog
- Detecta patrones sospechosos

#### d) Validación de Uso
- Verifica que el tercero no esté en contratos activos
- Advierte pero permite soft delete

### 4. Endpoints de Recuperación

#### GET /api/suppliers/deleted/list
Obtener terceros eliminados (solo admin/super_admin):
```javascript
GET /api/suppliers/deleted/list
Response: {
  success: true,
  count: 5,
  suppliers: [/* terceros eliminados */]
}
```

#### POST /api/suppliers/:id/restore
Restaurar un tercero eliminado:
```javascript
POST /api/suppliers/123/restore
Response: {
  success: true,
  message: "Tercero restaurado exitosamente",
  supplier: { /* tercero restaurado */ }
}
```

#### GET /api/suppliers/:id/audit-history
Obtener historial completo de un tercero:
```javascript
GET /api/suppliers/123/audit-history?limit=50
Response: {
  success: true,
  count: 12,
  history: [
    {
      operation: "DELETE",
      performedBy: { name: "Juan Pérez" },
      createdAt: "2025-01-20T10:30:00Z",
      changedFields: [...]
    }
  ]
}
```

#### GET /api/suppliers/audit/suspicious
Operaciones sospechosas (solo super_admin):
```javascript
GET /api/suppliers/audit/suspicious?hours=24
Response: {
  success: true,
  count: 2,
  operations: [
    {
      isSuspicious: true,
      suspiciousReason: "Usuario ha eliminado 8 terceros en los últimos 5 minutos",
      performedBy: { name: "Usuario X" }
    }
  ]
}
```

#### DELETE /api/suppliers/:id/permanent
Eliminación permanente (solo super_admin con confirmación):
```javascript
DELETE /api/suppliers/123/permanent
Body: {
  "confirmation": "DELETE_PERMANENTLY",
  "reason": "Razón de eliminación permanente"
}
```

### 5. Sistema de Backups Automáticos

Configurado en `backend/server.js`:

#### Backups Horarios
- Cada 6 horas automáticamente
- Tipo: 'HOURLY'
- Retención: últimos 7 días (168 backups)

#### Backups Semanales
- Cada domingo a las 2am
- Promoción del backup horario más reciente
- Retención: 12 semanas

#### Backup Inicial
- Al iniciar el servidor
- Tipo: 'STARTUP'

#### Backup de Emergencia
- Cuando se detecta pérdida de datos
- Tipo: 'EMERGENCY'

#### Limpieza Automática
- Cada 24 horas
- Elimina backups que exceden retención
- Elimina backups corruptos

### 6. Monitoreo de Integridad

**Monitoreo continuo cada 15 minutos:**
- Detecta pérdida masiva de datos (>20%)
- Compara con conteos conocidos buenos
- Alerta automática en consola
- Crea backup de emergencia si es crítico

**Verificación de salud:**
```javascript
fullSystemCheck() retorna:
{
  lossDetection: {
    hasLoss: false,
    criticalLoss: false,
    currentCounts: {
      suppliers: 45,
      contracts: 120,
      ...
    },
    alerts: []
  },
  backupsCount: 25,
  mongoConnected: true
}
```

### 7. Modificaciones en Rutas

#### GET /api/suppliers
Ahora **filtra eliminados por defecto**:
```javascript
// Ver solo terceros activos
GET /api/suppliers

// Ver terceros incluyendo eliminados (admin)
GET /api/suppliers?includeDeleted=true
```

#### DELETE /api/suppliers/:id
Ahora hace **soft delete** en lugar de eliminación física:
```javascript
DELETE /api/suppliers/123
Body: { reason: "Ya no trabaja con nosotros" }

Response: {
  success: true,
  message: "Tercero eliminado exitosamente",
  recoverable: true,
  info: "El tercero puede ser restaurado desde la sección de terceros eliminados"
}
```

## 🛡️ Protecciones Activas

### Nivel 1: Prevención
- ✅ Soft delete en lugar de eliminación física
- ✅ Límite de eliminaciones por tiempo
- ✅ Confirmación explícita para eliminaciones permanentes

### Nivel 2: Detección
- ✅ Auditoría completa de todas las operaciones
- ✅ Detección de patrones sospechosos
- ✅ Monitoreo continuo de integridad

### Nivel 3: Recuperación
- ✅ Backups automáticos cada 6 horas
- ✅ Backups semanales
- ✅ Restauración fácil de terceros eliminados
- ✅ Historial completo de cambios

## 📊 Casos de Uso

### Caso 1: Usuario elimina tercero por error
1. Usuario hace DELETE /api/suppliers/123
2. Sistema marca como deleted=true (soft delete)
3. Tercero desaparece de la lista normal
4. Admin puede ir a "Terceros Eliminados"
5. Admin hace POST /api/suppliers/123/restore
6. Tercero vuelve a aparecer sin pérdida de datos

### Caso 2: Usuario intenta eliminar 20 terceros rápidamente
1. Usuario elimina 10 terceros en 3 minutos
2. En el intento #11, el middleware bloquea la operación
3. Respuesta: "Límite de eliminaciones excedido"
4. Sistema crea alerta de operación sospechosa
5. Admin puede revisar GET /api/suppliers/audit/suspicious

### Caso 3: Pérdida masiva de datos detectada
1. Monitoreo detecta que suppliers bajó de 50 a 5
2. Sistema crea backup de emergencia
3. Alerta en consola: "PÉRDIDA CRÍTICA DETECTADA"
4. Admin puede restaurar desde backup más reciente

### Caso 4: Investigación de quién eliminó un tercero
1. Admin nota que falta un tercero importante
2. Admin consulta GET /api/suppliers/deleted/list
3. Encuentra el tercero eliminado
4. Consulta GET /api/suppliers/123/audit-history
5. Ve quién, cuándo, desde dónde y por qué se eliminó
6. Puede restaurarlo o investigar más

## 🔧 Configuración y Mantenimiento

### Variables de Entorno
No requiere configuración adicional. Usa:
- `MONGODB_URI` - URI de MongoDB existente
- Directorio `backend/backups/` se crea automáticamente

### Directorios
```
backend/
├── backups/          # Backups automáticos (auto-gestionado)
├── logs/             # Logs de operaciones críticas
├── models/
│   ├── Supplier.js               # Actualizado con soft delete
│   └── SupplierAuditLog.js       # Nuevo modelo de auditoría
├── middleware/
│   └── supplierProtection.js     # Nuevo middleware de protección
└── routes/
    └── suppliers.js              # Actualizado con nuevos endpoints
```

### Limpieza Manual de Backups
```bash
# Listar backups
ls -lh backend/backups/

# Backups automáticos se limpian solos según retención
# Backups manuales (MANUAL) se mantienen indefinidamente
```

### Crear Backup Manual
```javascript
const { createFullBackup } = require('./services/robustBackup');
await createFullBackup('MANUAL');
```

### Restaurar desde Backup
```javascript
const { restoreFromBackup } = require('./services/robustBackup');

// Modo dry-run (solo ver qué haría)
await restoreFromBackup('backup-hourly-1234567890.json', { dryRun: true });

// Restauración real
await restoreFromBackup('backup-hourly-1234567890.json');
```

## 🚀 Próximos Pasos Recomendados

### Implementación en Frontend
1. **Panel de Terceros Eliminados**
   - Mostrar lista de terceros eliminados
   - Botón "Restaurar" para cada uno
   - Filtros por fecha de eliminación

2. **Confirmación de Eliminación**
   - Modal que explique que es recuperable
   - Campo para razón de eliminación
   - Mostrar advertencia si tiene contratos activos

3. **Dashboard de Auditoría**
   - Gráfica de operaciones por día
   - Lista de operaciones recientes
   - Alertas de operaciones sospechosas

### Notificaciones
1. Email cuando se detectan operaciones sospechosas
2. Email cuando hay pérdida crítica de datos
3. Reporte semanal de backups y salud del sistema

### Testing
1. Pruebas de soft delete
2. Pruebas de restauración
3. Pruebas de límites de eliminación
4. Pruebas de backups y recuperación

## ⚠️ Notas Importantes

1. **Los terceros eliminados NO aparecen en listados normales** a menos que se use `includeDeleted=true`

2. **Solo admin y super_admin pueden ver y restaurar eliminados**

3. **Los backups se acumulan** - el sistema limpia automáticamente según políticas de retención

4. **Eliminaciones permanentes requieren confirmación explícita** con el texto `DELETE_PERMANENTLY`

5. **Todas las operaciones son auditadas** - hay registro completo de quién hizo qué y cuándo

6. **El sistema es automático** - no requiere intervención manual una vez configurado

## 📞 Soporte

En caso de problemas:
1. Revisar logs de consola para alertas
2. Consultar GET /api/suppliers/audit/suspicious
3. Verificar integridad con fullSystemCheck()
4. Revisar backups disponibles en backend/backups/

---

**Sistema implementado el**: 2025-01-20
**Última actualización**: 2025-01-20
**Estado**: ✅ Activo y Operacional
