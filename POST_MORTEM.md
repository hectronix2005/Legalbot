# Post-Mortem: Pérdida de Datos en Producción - 3 de Noviembre 2025

## Resumen Ejecutivo

**Fecha del Incidente**: 3 de Noviembre 2025, 20:46 UTC
**Severidad**: CRÍTICA
**Impacto**: Pérdida total de datos en producción (templates y contratos)
**Causa Raíz**: Ejecución accidental de script de inicialización en producción
**Estado**: Datos no recuperables - Protecciones implementadas

## ¿Qué Sucedió?

### Cronología del Incidente

1. **20:46 UTC** - Usuario reporta que la aplicación de producción está vacía (no hay templates ni contratos)
2. **20:46-20:50 UTC** - Investigación inicial: verificación de logs de frontend y backend
3. **20:50 UTC** - **Descubrimiento crítico**: El script `initMongoDB.js` fue ejecutado en producción
4. **20:51 UTC** - Verificación de backups en Heroku: **directorio vacío** (filesystem efímero)
5. **20:52 UTC** - Revisión de backups locales: **1146 archivos pero TODOS vacíos**
6. **21:00 UTC** - **Conclusión**: Datos irrecuperables

### Causa Raíz

El script `backend/scripts/initMongoDB.js` contiene las siguientes líneas destructivas:

```javascript
// Limpiar datos existentes
await Promise.all([
  User.deleteMany({}),
  Company.deleteMany({}),
  ContractTemplate.deleteMany({}),
  VersionHistory.deleteMany({})
]);
```

Este script fue ejecutado en producción sin ninguna protección, borrando TODOS los datos existentes en MongoDB Atlas.

### Factores Contribuyentes

1. **Falta de Protección en el Script**
   - No había validación de NODE_ENV
   - No había verificación de cantidad de datos antes de borrar
   - No había confirmación interactiva

2. **Sistema de Backups Inefectivo**
   - Los backups se guardaban en Heroku's filesystem efímero
   - Se pierden cada vez que el dyno se reinicia
   - MongoDB Atlas M0 (tier gratuito) NO tiene backups automáticos

3. **Backups Locales Sin Datos**
   - Los backups locales solo respaldaban una base de datos local vacía
   - Los datos reales solo existían en producción (MongoDB Atlas)

## Datos Perdidos

- **Templates**: Número desconocido (mínimo 1, probablemente más)
- **Contratos**: Número desconocido
- **Usuarios personalizados**: Cantidad desconocida
- **Empresas**: Cantidad desconocida

**Estado actual de la base de datos**:
- 4 usuarios demo
- 1 empresa demo
- 1 template demo
- 0 contratos

## Acciones Correctivas Implementadas

### 1. Protección del Script de Inicialización ✅

Modificado `backend/scripts/initMongoDB.js` con:

```javascript
// PROTECCIÓN 1: Bloquear ejecución en producción
if (process.env.NODE_ENV === 'production') {
  console.error('❌ ERROR: Este script NO puede ejecutarse en producción');
  process.exit(1);
}

// PROTECCIÓN 2: Verificar cantidad de datos
const userCount = await User.countDocuments();
const templateCount = await ContractTemplate.countDocuments();

if (userCount > 10 || templateCount > 5) {
  console.error('❌ ERROR: La base de datos tiene muchos datos');
  console.error('❌ No se borrarán datos por seguridad');
  process.exit(1);
}
```

**Deploy**: ✅ Desplegado a producción (v11)

### 2. Recomendaciones para Backups (PENDIENTE)

**Urgente - Implementar**:

1. **MongoDB Atlas Backups**
   - Actualizar a tier M2+ ($9/mes) que incluye backups automáticos
   - Configurar snapshots diarios
   - Habilitar Point-in-Time Recovery

2. **Backups Externos**
   - Configurar backups automáticos a AWS S3 o Google Cloud Storage
   - Usar addon de Heroku para backups persistentes
   - Implementar backup incremental cada hora

3. **Backup Manual Pre-Deploy**
   - Antes de cualquier deploy crítico, ejecutar backup manual
   - Guardar backups localmente Y en la nube
   - Verificar que el backup contiene datos

## Lecciones Aprendidas

### Lo que Salió Mal

1. ❌ **Scripts destructivos sin protección**
2. ❌ **Backups en filesystem efímero**
3. ❌ **Sin verificación de backups**
4. ❌ **No se probó el proceso de restauración**
5. ❌ **Falta de ambiente de staging**

### Lo que Hay que Hacer

1. ✅ **Proteger todos los scripts destructivos**
2. ⏳ **Implementar sistema de backups robusto**
3. ⏳ **Crear ambiente de staging**
4. ⏳ **Probar regularmente la restauración de backups**
5. ⏳ **Documentar procedimientos de emergencia**

## Plan de Acción Inmediato

### Crítico (Hacer HOY)

- [x] Proteger script `initMongoDB.js`
- [x] Desplegar protecciones a producción
- [ ] **URGENTE**: Decidir plan de backups (MongoDB Atlas M2+ vs AWS S3)
- [ ] **URGENTE**: Implementar backups persistentes

### Alta Prioridad (Esta Semana)

- [ ] Crear ambiente de staging
- [ ] Probar proceso de backup y restauración
- [ ] Agregar protecciones a otros scripts destructivos
- [ ] Configurar alertas de cambios en producción

### Media Prioridad (Este Mes)

- [ ] Implementar audit logs
- [ ] Crear procedimientos de disaster recovery
- [ ] Configurar CI/CD con tests antes de deploy
- [ ] Revisar todos los scripts del proyecto

## Contacto y Preguntas

Si tienes preguntas sobre este incidente o las medidas correctivas, por favor documenta tus preguntas para futuras referencias.

## Notas Adicionales

**Estado de la Aplicación**: La aplicación está funcionando con datos demo. El frontend y backend están operativos, pero se perdieron todos los datos de producción anteriores.

**Próximos Pasos Recomendados**:
1. Decidir si actualizar MongoDB Atlas a tier M2+ ($9/mes) para backups automáticos
2. O implementar solución de backups externa (AWS S3, etc.)
3. Comenzar a recrear templates y datos necesarios

---

**Fecha de este documento**: 3 de Noviembre 2025
**Última actualización**: 3 de Noviembre 2025, 21:15 UTC
