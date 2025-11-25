# 🚀 Guía Rápida - Sistema de Protección de Terceros

## ✅ ¿Qué se ha Implementado?

Tu sistema ahora tiene **protección completa contra pérdida de terceros**:

1. ✅ **Soft Delete** - Los terceros ya NO se borran físicamente
2. ✅ **Backups Automáticos** - Cada 6 horas + semanales
3. ✅ **Auditoría Completa** - Registro de todas las operaciones
4. ✅ **Recuperación Fácil** - Restaurar terceros con un click
5. ✅ **Protección Anti-Masiva** - Limita eliminaciones sospechosas
6. ✅ **Monitoreo 24/7** - Detecta pérdida de datos automáticamente

## 📝 Cambios Importantes

### Antes (PELIGROSO):
```javascript
DELETE /api/suppliers/123
// ❌ Borraba permanentemente el tercero
// ❌ Sin posibilidad de recuperación
// ❌ Sin auditoría
```

### Ahora (SEGURO):
```javascript
DELETE /api/suppliers/123
// ✅ Marca como eliminado (soft delete)
// ✅ Aparece en "terceros eliminados"
// ✅ Puede restaurarse fácilmente
// ✅ Se audita completamente
```

## 🎯 Cómo Usar

### 1. Ver Terceros Eliminados

```bash
# Solo admin/super_admin
GET /api/suppliers/deleted/list

# Respuesta:
{
  "success": true,
  "count": 5,
  "suppliers": [
    {
      "legal_name": "Juan Pérez",
      "deleted": true,
      "deletedAt": "2025-01-20T10:30:00Z",
      "deletedBy": {
        "name": "María González",
        "email": "maria@empresa.com"
      },
      "deletionReason": "Ya no trabaja con nosotros"
    }
  ]
}
```

### 2. Restaurar un Tercero

```bash
POST /api/suppliers/123/restore

# Respuesta:
{
  "success": true,
  "message": "Tercero restaurado exitosamente",
  "supplier": { ... }
}
```

### 3. Ver Historial de Cambios

```bash
GET /api/suppliers/123/audit-history

# Respuesta:
{
  "success": true,
  "count": 12,
  "history": [
    {
      "operation": "DELETE",
      "performedBy": {
        "name": "Juan Pérez",
        "email": "juan@empresa.com"
      },
      "createdAt": "2025-01-20T10:30:00Z",
      "ipAddress": "192.168.1.1",
      "changedFields": [...]
    }
  ]
}
```

### 4. Detectar Operaciones Sospechosas

```bash
# Solo super_admin
GET /api/suppliers/audit/suspicious?hours=24

# Respuesta:
{
  "success": true,
  "count": 2,
  "operations": [
    {
      "isSuspicious": true,
      "suspiciousReason": "Usuario ha eliminado 8 terceros en 5 minutos",
      "performedBy": {
        "name": "Usuario X",
        "email": "usuario@empresa.com"
      }
    }
  ]
}
```

## 🔧 Backups Automáticos

### Ver Backups Disponibles

```bash
# Desde la raíz del proyecto
ls -lh backend/backups/

# Verás archivos como:
backup-hourly-1737380000000.json    # Cada 6 horas
backup-weekly-1737294000000.json    # Cada domingo
backup-startup-1737380000000.json   # Al iniciar servidor
backup-emergency-1737380000000.json # En caso de pérdida
```

### Restaurar desde Backup (Emergencia)

```javascript
// Solo si necesitas restaurar TODO desde un backup
const { restoreFromBackup } = require('./backend/services/robustBackup');

// Primero ver qué contiene (modo simulación)
await restoreFromBackup('backup-hourly-1737380000000.json', { dryRun: true });

// Si todo se ve bien, restaurar de verdad
await restoreFromBackup('backup-hourly-1737380000000.json');
```

## 🛡️ Protecciones Activas

### Límites de Eliminación

**Usuarios normales:**
- Máximo 10 eliminaciones en 5 minutos
- Si se excede: Error 429 (demasiadas peticiones)

**Super Admin:**
- Máximo 50 eliminaciones en 5 minutos

**Si necesitas eliminar más:**
- Espera 5 minutos entre lotes
- O solicita eliminación permanente con confirmación

### Eliminación Permanente (Casos Excepcionales)

```bash
# Solo super_admin
DELETE /api/suppliers/123/permanent
Content-Type: application/json

{
  "confirmation": "DELETE_PERMANENTLY",
  "reason": "Razón válida para eliminación permanente"
}
```

⚠️ **ADVERTENCIA**: Esto SÍ borra permanentemente. Solo usar en casos extremos.

## 📊 Monitoreo del Sistema

El sistema se auto-monitorea cada 15 minutos y alerta si:

- ✅ Se pierden más del 20% de terceros
- ✅ Una colección queda vacía
- ✅ Hay eliminaciones masivas sospechosas
- ✅ Fallan los backups

**Ver estado del sistema:**
```javascript
const { fullSystemCheck } = require('./backend/services/dataLossProtection');
const status = await fullSystemCheck();
console.log(status);
```

## 🎨 Próximos Pasos (Frontend)

### Sugerencias para UI:

1. **Agregar pestaña "Terceros Eliminados"**
   ```typescript
   // En tu componente de terceros
   <Tabs>
     <Tab label="Activos">...</Tab>
     <Tab label="Eliminados">
       {/* GET /api/suppliers/deleted/list */}
       {deletedSuppliers.map(supplier => (
         <SupplierCard
           supplier={supplier}
           onRestore={() => restoreSupplier(supplier._id)}
         />
       ))}
     </Tab>
   </Tabs>
   ```

2. **Modal de Confirmación de Eliminación**
   ```typescript
   const handleDelete = async (supplierId) => {
     const reason = await showReasonDialog();

     await fetch(`/api/suppliers/${supplierId}`, {
       method: 'DELETE',
       body: JSON.stringify({ reason })
     });

     toast.success('Tercero eliminado. Puedes restaurarlo desde "Eliminados"');
   };
   ```

3. **Dashboard de Auditoría**
   ```typescript
   // GET /api/suppliers/audit/suspicious
   const SuspiciousOperations = () => {
     const { data } = useSuspiciousOps();

     return (
       <Alert severity="warning">
         {data.count} operaciones sospechosas en las últimas 24h
       </Alert>
     );
   };
   ```

## 📞 Soporte

### Logs del Sistema

**Ver qué está haciendo el sistema:**
```bash
# Al iniciar el servidor verás:
🛡️  SISTEMA DE PROTECCIÓN DE DATOS ACTIVADO
   ✓ Backups automáticos cada 6 horas
   ✓ Backups semanales los domingos
   ✓ Limpieza automática de backups antiguos
   ✓ Monitoreo de integridad cada 15 minutos
   ✓ Soft delete habilitado para terceros
   ✓ Auditoría completa de operaciones

# Cada 6 horas:
⏰ Ejecutando backup automático programado...
✅ Backup automático completado: backup-hourly-1737380000000.json

# Si detecta problemas:
⚠️  ALERTA: POSIBLE PÉRDIDA DE DATOS DETECTADA
🚨 PÉRDIDA CRÍTICA DETECTADA - REQUIERE INTERVENCIÓN INMEDIATA
```

### Archivos Clave

```
backend/
├── models/
│   ├── Supplier.js              # Modelo con soft delete
│   └── SupplierAuditLog.js      # Auditoría
├── middleware/
│   └── supplierProtection.js    # Protección anti-masiva
├── routes/
│   └── suppliers.js             # Endpoints actualizados
├── services/
│   ├── robustBackup.js          # Sistema de backups
│   └── dataLossProtection.js    # Monitoreo
└── backups/                     # Backups automáticos
```

## ✨ Beneficios Inmediatos

1. **Ya no se pueden perder terceros permanentemente** - Todo es recuperable
2. **Auditoría completa** - Siempre sabes quién hizo qué
3. **Protección automática** - Sin configuración manual
4. **Backups automáticos** - Tu tranquilidad garantizada
5. **Detección temprana** - Alertas antes de que sea problema

---

**¿Preguntas?** Revisa la documentación completa en `docs/SISTEMA_PROTECCION_TERCEROS.md`
