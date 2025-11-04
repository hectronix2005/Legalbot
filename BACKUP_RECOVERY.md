# Sistema de Respaldo y Recuperación de Datos 🛡️

## Resumen

Este sistema robusto de respaldo automático protege tus datos contra pérdidas accidentales o fallas del sistema.

### Características Principales

✅ **Backups Automáticos cada Hora** - Nunca pierdas más de 60 minutos de trabajo
✅ **Validación de Contenido** - Solo se guardan backups con datos reales
✅ **Rotación Inteligente** - Mantiene 7 días de backups horarios + 12 semanas de backups semanales
✅ **Múltiples Colecciones** - Respalda templates, contratos, usuarios, empresas, proveedores y configuraciones
✅ **Recuperación Fácil** - Scripts simples para restaurar datos en minutos
✅ **Alertas Automáticas** - Te avisa si detecta problemas de integridad

---

## 📦 Tipos de Backup

| Tipo | Frecuencia | Retención | Descripción |
|------|------------|-----------|-------------|
| **STARTUP** | Al iniciar servidor | Permanente | Backup al arrancar el servidor |
| **HOURLY** | Cada hora | 7 días (168 backups) | Backups automáticos horarios |
| **WEEKLY** | Domingos 3 AM | 12 semanas | Backups semanales consolidados |
| **MANUAL** | Cuando ejecutes | Permanente | Backups creados manualmente |
| **SHUTDOWN** | Al cerrar servidor | Permanente | Backup antes de apagar |

---

## 🔧 Comandos Principales

### 1. Crear Backup Manual

```bash
cd backend
node scripts/createBackup.js
```

**Cuándo usar:** Antes de hacer cambios importantes, migraciones, o actualizaciones.

### 2. Listar Backups Disponibles

```bash
cd backend
node scripts/restoreBackup.js --dry-run
```

Muestra todos los backups con:
- Fecha de creación
- Tamaño del archivo
- Cantidad de documentos por colección

### 3. Restaurar Backup (Modo Prueba)

```bash
cd backend
node scripts/restoreBackup.js <nombre-archivo> --dry-run
```

**Ejemplo:**
```bash
node scripts/restoreBackup.js backup-hourly-1762096399937.json --dry-run
```

Muestra qué se restauraría SIN modificar la base de datos.

### 4. Restaurar Backup (Real)

```bash
cd backend
node scripts/restoreBackup.js <nombre-archivo>
```

⚠️ **ADVERTENCIA:** Esto eliminará TODOS los datos actuales y los reemplazará con el backup.

---

## 🚨 Escenarios de Recuperación

### Escenario 1: Pérdida Parcial de Datos (última hora)

Si perdiste datos en la última hora:

```bash
cd backend
node scripts/restoreBackup.js
# Seleccionar el backup HOURLY más reciente
```

### Escenario 2: Pérdida Total de Datos

Si la base de datos está completamente vacía:

```bash
cd backend
node scripts/restoreBackup.js
# Revisar la lista de backups
# Seleccionar el más reciente con datos completos
```

### Escenario 3: Recuperar Estado de Ayer

```bash
cd backend
node scripts/restoreBackup.js
# Buscar backup de 24 horas atrás
# Ejemplo: backup-hourly-1762010000000.json
```

### Escenario 4: Recuperar Semana Anterior

```bash
cd backend
node scripts/restoreBackup.js
# Seleccionar backup WEEKLY más cercano a la fecha deseada
```

---

## 📍 Ubicación de Backups

**Directorio:** `backend/backups/`

### Estructura de Archivos

```
backend/backups/
├── backup-startup-1762096399937.json  (Backup al iniciar)
├── backup-hourly-1762100000000.json   (Backup horario)
├── backup-hourly-1762103600000.json   (Backup horario)
├── backup-weekly-1762099200000.json   (Backup semanal)
└── backup-manual-1762096500000.json   (Backup manual)
```

**Formato del nombre:** `backup-{tipo}-{timestamp}.json`

---

## 🔍 Verificar Integridad

El sistema verifica automáticamente la integridad al iniciar. Para verificar manualmente:

```bash
cd backend
node -e "
const mongoose = require('mongoose');
const { verifyDataIntegrity } = require('./services/robustBackup');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const integrity = await verifyDataIntegrity();
  console.log(JSON.stringify(integrity, null, 2));
  process.exit(0);
});
"
```

---

## 💾 Contenido del Backup

Cada backup incluye:

```json
{
  "timestamp": "2025-10-24T00:17:56.471Z",
  "type": "HOURLY",
  "collections": {
    "templates": [...],      // Plantillas de contratos
    "contracts": [...],      // Contratos generados
    "companies": [...],      // Empresas
    "users": [...],          // Usuarios
    "suppliers": [...],      // Terceros (proveedores, clientes, etc.)
    "thirdpartytypeconfigs": [...]  // Configuración de tipos
  },
  "stats": {
    "templates": 5,
    "contracts": 20,
    "companies": 4,
    "users": 4,
    "suppliers": 2,
    "thirdpartytypeconfigs": 8
  }
}
```

---

## ⏰ Automatización

### Backups Horarios

Se ejecutan automáticamente cada hora mientras el servidor esté corriendo. **No requiere acción manual.**

### Backups Semanales

Se crean automáticamente los domingos a las 3 AM. **No requiere acción manual.**

### Limpieza Automática

El sistema elimina automáticamente:
- Backups horarios más antiguos de 7 días
- Backups semanales más antiguos de 12 semanas
- Backups vacíos o corruptos

---

## 🎯 Mejores Prácticas

### ✅ Recomendado

1. **Backup Manual antes de Cambios Importantes**
   ```bash
   node scripts/createBackup.js
   ```

2. **Verificar Backups Periódicamente**
   ```bash
   ls -lh backend/backups/ | head -20
   ```

3. **Probar Restauración en Modo Dry-Run**
   ```bash
   node scripts/restoreBackup.js <archivo> --dry-run
   ```

4. **Mantener Copias Externas**
   - Copia periódicamente la carpeta `backend/backups/` a otro disco o servicio en la nube

### ❌ Evitar

1. ❌ No elimines manualmente archivos de backup sin revisar
2. ❌ No restaures sin verificar primero en modo dry-run
3. ❌ No dependas únicamente de backups automáticos para cambios críticos
4. ❌ No ignores las advertencias de integridad al iniciar el servidor

---

## 📊 Monitoreo

### Ver Logs del Sistema de Backup

Los logs del servidor muestran:
- ✅ Backups exitosos con tamaño y cantidad de documentos
- ⚠️ Advertencias de integridad
- ❌ Errores durante backup o restauración

Ejemplo de log exitoso:
```
✅ Backup completado: backup-hourly-1762096399937.json
   📊 Total documentos: 38
   💾 Tamaño: 0.15 MB
```

### Estadísticas en Tiempo Real

Al iniciar el servidor verás:
```
📊 Estado actual:
   - templates: 5 documentos
   - contracts: 20 documentos
   - companies: 4 documentos
   - users: 4 documentos
   - suppliers: 2 documentos
   - thirdpartytypeconfigs: 8 documentos
```

---

## 🆘 Soporte

### Problema: El servidor no crea backups

**Solución:**
1. Verifica que MongoDB esté corriendo
2. Revisa los logs del servidor para errores
3. Verifica permisos de escritura en `backend/backups/`

### Problema: Backup vacío

El sistema automáticamente **NO guardará** backups vacíos. Verás:
```
⚠️  ADVERTENCIA: Backup vacío - no se guardará
```

Esto es **normal** si la base de datos está vacía.

### Problema: Restauración falla

1. Verifica que el archivo de backup exista
2. Verifica que el archivo no esté corrupto (debe ser JSON válido)
3. Prueba primero con `--dry-run`
4. Verifica que MongoDB esté conectado

---

## 📝 Notas Adicionales

- Los backups se comprimen automáticamente usando JSON compacto
- El sistema detecta automáticamente si MongoDB no está conectado y omite el backup
- Los backups MANUAL y SHUTDOWN no se eliminan automáticamente
- Puedes tener múltiples copias del mismo backup (útil para histórico)

---

## 🔐 Seguridad

- Los backups contienen **TODOS** los datos, incluyendo contraseñas hasheadas
- Protege la carpeta `backend/backups/` con permisos adecuados
- No subas backups a repositorios públicos
- Considera encriptar backups si contienen datos sensibles

---

**Última actualización:** Octubre 2025
**Versión del sistema:** 2.0
