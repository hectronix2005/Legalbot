# Sistema de Protección Contra Pérdida de Datos

## Resumen

Este sistema robusto fue implementado para prevenir la pérdida de datos en la aplicación Legal Bot. Incluye monitoreo continuo, backups automáticos, detección de anomalías y capacidad de restauración automática.

## Componentes del Sistema

### 1. Sistema de Backups Automáticos (`services/robustBackup.js`)

**Características principales:**
- Backups automáticos cada hora
- Backups semanales (domingos a las 3 AM)
- Backup al iniciar y cerrar el servidor
- Rotación automática (mantiene 7 días de backups horarios + 12 semanas de backups semanales)
- Validación de integridad antes de guardar

**Colecciones respaldadas:**
```javascript
- contracttemplates  // Plantillas de contratos
- contracts          // Contratos generados
- companies          // Empresas
- users              // Usuarios
- suppliers          // Terceros/Proveedores
- thirdpartytypeconfigs  // Configuraciones de tipos de terceros
- usercompanies      // Relaciones usuario-empresa
```

**Ubicación de backups:**
`backend/backups/`

**Formato de archivos:**
- `backup-hourly-[timestamp].json` - Backups horarios
- `backup-weekly-[timestamp].json` - Backups semanales
- `backup-startup-[timestamp].json` - Backup al iniciar
- `backup-shutdown-[timestamp].json` - Backup al cerrar
- `backup-emergency-[timestamp].json` - Backup de emergencia (ante pérdida crítica)

### 2. Sistema de Detección de Pérdida de Datos (`services/dataLossProtection.js`)

**Monitoreo continuo:**
- Ejecuta verificaciones cada 15 minutos
- Compara conteos actuales con conteos conocidos buenos
- Detecta pérdida significativa de datos (>20% de documentos)

**Umbrales mínimos esperados:**
```javascript
contracttemplates: 5 documentos
contracts: 10 documentos
companies: 2 documentos
users: 2 documentos
suppliers: 1 documento
thirdpartytypeconfigs: 5 documentos
usercompanies: 2 documentos
```

**Niveles de alerta:**
- `HIGH`: Pérdida del 20-50% de datos o debajo del mínimo esperado
- `CRITICAL`: Pérdida >50% de datos o error accediendo colecciones

## Operaciones Manuales

### Crear Backup Manual

Desde la consola de Node.js del servidor en ejecución:

```javascript
const { createFullBackup } = require('./services/robustBackup');
await createFullBackup('MANUAL');
```

O usando curl (si se implementa endpoint):

```bash
curl -X POST http://localhost:5001/api/admin/backup \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### Listar Backups Disponibles

```javascript
const { listBackups } = require('./services/robustBackup');
const backups = await listBackups();
console.log(backups);
```

### Verificar Estado del Sistema

```javascript
const { fullSystemCheck } = require('./services/dataLossProtection');
await fullSystemCheck();
```

Esto mostrará:
- Estado de detección de pérdida de datos
- Número de backups disponibles
- Estado de conexión a MongoDB
- Comparación de conteos actuales vs conocidos

### Restaurar desde Backup

**PRECAUCIÓN: Esta operación eliminará todos los datos actuales y los reemplazará con los del backup**

1. Primero, ejecutar en modo DRY-RUN para ver qué se restauraría:

```javascript
const { restoreFromBackup } = require('./services/robustBackup');
await restoreFromBackup('backup-hourly-1762208852324.json', { dryRun: true });
```

2. Si está seguro, ejecutar la restauración real:

```javascript
await restoreFromBackup('backup-hourly-1762208852324.json');
```

3. Para restaurar solo colecciones específicas:

```javascript
await restoreFromBackup('backup-hourly-1762208852324.json', {
  collections: ['contracttemplates', 'contracts']
});
```

### Restauración Automática

El sistema puede restaurar automáticamente desde el backup más reciente válido:

```javascript
const { autoRestore } = require('./services/dataLossProtection');
const result = await autoRestore();
console.log(result);
```

El sistema:
1. Busca el backup más reciente que cumpla los umbrales mínimos
2. Crea un backup de emergencia del estado actual
3. Restaura los datos desde el backup válido
4. Actualiza los conteos conocidos buenos

## Interpretación de Alertas

### Alerta: BELOW_MINIMUM

```
type: 'BELOW_MINIMUM',
collection: 'contracttemplates',
current: 3,
expected: 5,
severity: 'HIGH'
```

**Significado:** El número de documentos está por debajo del mínimo esperado.

**Acción recomendada:**
1. Verificar si hubo eliminaciones intencionales
2. Si no fueron intencionales, revisar logs de la aplicación
3. Considerar restaurar desde backup

### Alerta: SIGNIFICANT_LOSS

```
type: 'SIGNIFICANT_LOSS',
collection: 'contracts',
current: 5,
previous: 25,
lossPercent: '80.00',
severity: 'CRITICAL'
```

**Significado:** Se perdió el 80% de los contratos comparado con el último conteo conocido.

**Acción recomendada:**
1. Verificar inmediatamente qué causó la pérdida
2. Revisar logs de aplicación y base de datos
3. Si fue no intencional, ejecutar `autoRestore()` o restaurar manualmente

### Alerta: ERROR

```
type: 'ERROR',
collection: 'users',
error: 'Collection not found',
severity: 'CRITICAL'
```

**Significado:** No se pudo acceder a la colección.

**Acción recomendada:**
1. Verificar estado de MongoDB
2. Revisar logs de conexión a base de datos
3. Reiniciar servidor si es necesario

## Configuración

### Ajustar Intervalo de Monitoreo

En `server.js`, línea 212:

```javascript
// Cambiar de 15 minutos a otro intervalo
startMonitoring(30);  // Ahora cada 30 minutos
```

### Ajustar Umbral de Pérdida

En `services/dataLossProtection.js`, línea 15:

```javascript
// Cambiar umbral de 20% a otro valor
const LOSS_THRESHOLD_PERCENT = 30;  // Ahora alerta solo si pérdida >30%
```

### Ajustar Mínimos Esperados

En `services/dataLossProtection.js`, líneas 18-26:

```javascript
const MINIMUM_EXPECTED_COUNTS = {
  contracttemplates: 10,  // Aumentar mínimo esperado
  contracts: 20,
  companies: 5,
  // ...
};
```

### Ajustar Retención de Backups

En `services/robustBackup.js`, líneas 16-17:

```javascript
const HOURLY_RETENTION = 24 * 14;  // 14 días en vez de 7
const WEEKLY_RETENTION = 24;       // 24 semanas en vez de 12
```

## Logs del Sistema

### Durante Inicialización

```
✅ MongoDB listo para backups
🔍 Verificando integridad de datos...
✅ Integridad de datos verificada
📊 Estado actual:
   - contracttemplates: 10 documentos
   - contracts: 21 documentos
   [...]
📦 Creando backup inicial...
   ✓ contracttemplates: 10 documentos
   ✓ contracts: 21 documentos
✅ Backup completado: backup-startup-1762208852324.json
   📊 Total documentos: 57
   💾 Tamaño: 0.25 MB
🔍 Iniciando monitoreo de datos cada 15 minutos...
✅ Monitoreo de protección de datos iniciado
```

### Durante Backup Horario

```
⏰ Ejecutando backup automático horario...
📦 Iniciando backup HOURLY...
   ✓ contracttemplates: 10 documentos
   ✓ contracts: 21 documentos
   [...]
✅ Backup completado: backup-hourly-1762209452324.json
   📊 Total documentos: 57
   💾 Tamaño: 0.25 MB
🧹 Limpiando backups antiguos...
✅ Limpieza completada: 3 backups eliminados
```

### Durante Detección de Pérdida

```
⚠️  ALERTA: POSIBLE PÉRDIDA DE DATOS DETECTADA

📊 Alertas: [
  {
    "type": "SIGNIFICANT_LOSS",
    "collection": "contracttemplates",
    "current": 2,
    "previous": 10,
    "lossPercent": "80.00",
    "severity": "CRITICAL"
  }
]

🚨 PÉRDIDA CRÍTICA DETECTADA - REQUIERE INTERVENCIÓN INMEDIATA
💡 Considere ejecutar restauración automática
📦 Creando backup de emergencia...
```

### Durante Restauración

```
🚨 INICIANDO RESTAURACIÓN AUTOMÁTICA...

📦 Restaurando desde: backup-hourly-1762208852324.json
📅 Fecha del backup: 2025-11-03T10:30:52.324Z
📊 Datos en el backup: {
  contracttemplates: 10,
  contracts: 21,
  companies: 4,
  users: 4,
  suppliers: 3,
  thirdpartytypeconfigs: 9,
  usercompanies: 6
}
   ✅ contracttemplates: 2 eliminados, 10 restaurados
   ✅ contracts: 5 eliminados, 21 restaurados
   [...]
✅ RESTAURACIÓN COMPLETADA EXITOSAMENTE
```

## Troubleshooting

### Problema: Backups no se están creando

**Posibles causas:**
1. MongoDB no conectado
2. Directorio `backend/backups/` no existe
3. Permisos de escritura

**Solución:**
```bash
# Verificar MongoDB
mongosh --eval "db.adminCommand('ping')"

# Crear directorio de backups
mkdir -p backend/backups
chmod 755 backend/backups

# Revisar logs del servidor
```

### Problema: Monitoreo reporta pérdida pero los datos están ahí

**Posibles causas:**
1. Nombres de colecciones incorrectos en configuración
2. Conteos mínimos mal configurados

**Solución:**
```bash
# Verificar nombres de colecciones en MongoDB
mongosh legal-contracts --eval "db.getCollectionNames()"

# Actualizar CRITICAL_COLLECTIONS en robustBackup.js si es necesario
# Actualizar MINIMUM_EXPECTED_COUNTS en dataLossProtection.js
```

### Problema: Servidor no inicia después de cambios

**Solución:**
```bash
# Verificar sintaxis de archivos modificados
node -c backend/services/robustBackup.js
node -c backend/services/dataLossProtection.js
node -c backend/server.js

# Revisar logs de Node.js
```

### Problema: Restauración falla

**Posibles causas:**
1. Archivo de backup corrupto
2. MongoDB sin espacio en disco
3. Permisos insuficientes

**Solución:**
```bash
# Verificar integridad del backup
cat backend/backups/backup-hourly-*.json | python3 -m json.tool > /dev/null

# Verificar espacio en disco
df -h

# Ejecutar restauración en modo dry-run primero
```

## Mejores Prácticas

1. **Monitorear los logs regularmente** para detectar alertas tempranas
2. **No modificar archivos de backup manualmente** - pueden corromperse
3. **Mantener al menos 7 días de backups horarios** para recuperación rápida
4. **Probar el proceso de restauración periódicamente** en entorno de desarrollo
5. **Exportar backups importantes fuera del servidor** para redundancia
6. **Documentar cualquier restauración realizada** con fecha y razón
7. **Ajustar los umbrales según el crecimiento de datos** de la aplicación

## Soporte

Para problemas no cubiertos en esta documentación:
1. Revisar logs completos del servidor
2. Verificar estado de MongoDB con `mongosh`
3. Ejecutar `fullSystemCheck()` para diagnóstico completo
4. Contactar al administrador del sistema si el problema persiste

## Historial de Cambios

**2025-11-03:**
- Implementación inicial del sistema de protección
- Corrección de nombres de colecciones (templates → contracttemplates)
- Agregada colección usercompanies a backups
- Sistema de monitoreo continuo cada 15 minutos
- Capacidad de restauración automática
