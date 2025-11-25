# Migration Plan — Database Optimization Legal Bot

## Overview

Este documento detalla el plan de migración seguro para optimizaciones de base de datos, siguiendo el patrón **Expand-Contract** para minimizar downtime y riesgo.

---

## Timeline General

```
Semana 1-2: Índices Críticos (EXPAND)
Semana 3-4: Validación y Monitoreo
Semana 5-7: Consolidación Versionamiento (EXPAND)
Semana 8-9: Dual Write (SWITCH)
Semana 10: Cleanup (CONTRACT)
```

**Total**: 10 semanas (~2.5 meses)

---

## Fase 1: Índices Críticos (Semanas 1-2)

### Objetivo
Crear índices compuestos para optimizar queries más frecuentes **sin afectar código**.

### Pre-requisitos
- [ ] Backup completo de MongoDB Atlas
- [ ] Dry-run de script de índices
- [ ] Ventana de mantenimiento programada (opcional)
- [ ] Rollback plan documentado

### Ejecución

#### Paso 1.1: Dry Run (30 minutos)
```bash
cd backend
node outputs/dbopt/index-proposals.js --dry-run
```

**Validar**:
- Script identifica índices a crear
- No hay errores de conexión
- Estimación de tiempo < 5 minutos

#### Paso 1.2: Backup (15 minutos)
```bash
# Crear backup antes de índices
node scripts/backup-database.js --tag="pre-index-migration"
```

#### Paso 1.3: Crear Índices (5-10 minutos)
```bash
# Ejecutar creación de índices
node outputs/dbopt/index-proposals.js --execute

# Verificar índices creados
node scripts/verify-indexes.js
```

**Monitorear**:
- CPU de MongoDB (debe permanecer < 70%)
- Latencia de queries durante creación
- Logs de errores

#### Paso 1.4: Validación Post-Migración (30 minutos)
```bash
# Verificar performance mejorada
node scripts/benchmark-queries.js --output=outputs/dbopt/bench-post-indexes.csv

# Comparar con baseline
node scripts/compare-benchmarks.js \
  --before=outputs/dbopt/bench-baseline.csv \
  --after=outputs/dbopt/bench-post-indexes.csv
```

**Criterios de Éxito**:
- ✅ Todos los índices creados sin errores
- ✅ Latencia p95 reducida ≥30%
- ✅ No incremento de errores en logs
- ✅ Queries críticas usan nuevos índices (verificar con `.explain()`)

---

### Paso 1.5: Rollback Plan

**Si falla la validación**:
```bash
# Opción 1: Eliminar índices creados (rápido, 2 min)
db.contracts.dropIndex("idx_company_status_date")
db.versionhistories.dropIndex("idx_template_version")
db.contracttemplates.dropIndex("idx_company_active")
# ... resto de índices

# Opción 2: Restaurar desde backup (lento, 10-15 min)
node scripts/restore-database.js --tag="pre-index-migration"
```

---

## Fase 2: Eliminar Índices Redundantes (Semana 2)

### Objetivo
Reducir overhead de escritura eliminando índice redundante en `suppliers`.

### Ejecución

```bash
# Verificar índice redundante
db.suppliers.getIndexes()
# Identificar: "company_1" es redundante con "company_1_identification_number_1"

# Eliminar
db.suppliers.dropIndex("company_1")

# Verificar queries siguen funcionando
node scripts/test-supplier-queries.js
```

**Criterios de Éxito**:
- ✅ Índice eliminado
- ✅ Queries de suppliers funcionan correctamente
- ✅ Latencia de escritura de suppliers mejorada ~10-15%

---

## Fase 3: Preparación de Versionamiento Unificado (Semanas 5-6)

### Objetivo
Desarrollar y probar modelo unificado `ContractVersion` sin afectar producción.

### Tareas

#### 3.1: Desarrollo (1 semana)
- [ ] Crear modelo `ContractVersion` (`backend/models/ContractVersion.js`)
- [ ] Implementar métodos de integridad (hash, chain of trust)
- [ ] Crear índices del nuevo modelo
- [ ] Escribir tests unitarios (>80% coverage)
- [ ] Code review y aprobación

#### 3.2: Backfill Job (1 semana)
- [ ] Escribir script `migrate-versions.js` idempotente
- [ ] Implementar batch processing (100 docs/batch)
- [ ] Agregar logging detallado
- [ ] Dry-run en staging

```javascript
// backend/scripts/migrate-versions.js
const migrateVersionHistory = async (dryRun = true) => {
  const versions = await VersionHistory.find({}).lean();

  for (const v of versions) {
    const newVersion = {
      entity_type: 'template',
      entity_id: v.template,
      entity_type_ref: 'ContractTemplate',
      version: v.version,
      content_hash: sha256(v.content),
      prev_version_hash: await getPrevHash(v.template, v.version),
      storage_strategy: 'full_snapshot',
      content: v.content,
      metadata: {
        change_description: v.changes_description,
        created_by: v.created_by,
        created_at: v.createdAt
      }
    };

    if (dryRun) {
      console.log('[DRY RUN] Would create:', newVersion);
    } else {
      await ContractVersion.create(newVersion);
    }
  }
};
```

---

## Fase 4: Migración de Datos (Semana 7)

### Objetivo
Migrar datos de `VersionHistory` y `DocumentVersion` a `ContractVersion`.

### Pre-requisitos
- [ ] Backup completo
- [ ] Dry-run exitoso en staging
- [ ] Ventana de mantenimiento programada (2-3 horas)
- [ ] Equipo en standby

### Ejecución (Horario de Baja Carga: Domingo 3 AM)

#### 4.1: Backup (15 min)
```bash
node scripts/backup-database.js --tag="pre-version-migration"
```

#### 4.2: Backfill VersionHistory (30 min)
```bash
node scripts/migrate-versions.js \
  --source=versionhistories \
  --entity-type=template \
  --execute \
  --batch-size=100 \
  --log-file=outputs/dbopt/migration-vh.log
```

**Monitorear**:
- Progreso cada 100 registros
- Errores en log
- CPU/memoria de MongoDB

#### 4.3: Backfill DocumentVersion (30 min)
```bash
node scripts/migrate-versions.js \
  --source=documentversions \
  --entity-type=contract \
  --execute \
  --batch-size=100 \
  --log-file=outputs/dbopt/migration-dv.log
```

#### 4.4: Validación (45 min)
```bash
# Verificar conteos
node scripts/compare-version-counts.js

# Verificar integridad de hashes
node scripts/verify-version-integrity.js

# Verificar cadenas de confianza
node scripts/verify-chain-of-trust.js
```

**Criterios de Éxito**:
- ✅ Conteo de versiones coincide (VersionHistory + DocumentVersion = ContractVersion)
- ✅ 100% de hashes válidos
- ✅ 100% de cadenas de confianza válidas
- ✅ Queries de prueba funcionan correctamente

---

### 4.5: Rollback Plan (Si falla validación)

```bash
# Eliminar datos migrados
db.contractversions.drop()

# Restaurar desde backup (no necesario, legacy intacto)
# Los datos legacy nunca se tocan en fase EXPAND
```

---

## Fase 5: Dual Write (Semanas 8-9)

### Objetivo
Cambiar código para escribir en **ambos** modelos (legacy + nuevo) y leer desde nuevo.

### Implementación

#### 5.1: Actualizar Código (Semana 8)

**Ejemplo: Crear Nueva Versión de Template**

```javascript
// ANTES
async function createTemplateVersion(templateId, content, changes, userId) {
  const version = await VersionHistory.create({
    template: templateId,
    version: nextVersion,
    content,
    changes_description: changes,
    created_by: userId
  });
  return version;
}

// DESPUÉS (Dual Write)
async function createTemplateVersion(templateId, content, changes, userId) {
  const prevVersion = await ContractVersion.findOne({
    entity_type: 'template',
    entity_id: templateId
  }).sort({ version: -1 });

  const nextVersion = prevVersion ? prevVersion.version + 1 : 1;
  const contentHash = sha256(content);

  // 1. Escribir en nuevo modelo (PRINCIPAL)
  const newVersion = await ContractVersion.create({
    entity_type: 'template',
    entity_id: templateId,
    entity_type_ref: 'ContractTemplate',
    version: nextVersion,
    content_hash: contentHash,
    prev_version_hash: prevVersion?.content_hash || null,
    storage_strategy: 'full_snapshot',
    content,
    is_current: true,
    metadata: {
      change_description: changes,
      created_by: userId,
      created_at: new Date()
    }
  });

  // 2. Escribir en legacy (FALLBACK)
  try {
    await VersionHistory.create({
      template: templateId,
      version: nextVersion,
      content,
      changes_description: changes,
      created_by: userId
    });
  } catch (error) {
    console.error('[DUAL WRITE] Error escribiendo en VersionHistory:', error);
    // No fallar si legacy falla (nuevo es fuente de verdad)
  }

  return newVersion;
}
```

#### 5.2: Actualizar Queries (Semana 8)

```javascript
// ANTES
const versions = await VersionHistory.find({ template: templateId })
  .sort({ version: -1 });

// DESPUÉS
const versions = await ContractVersion.find({
  entity_type: 'template',
  entity_id: templateId
}).sort({ version: -1 });
```

#### 5.3: Deploy Gradual (Semana 9)
```bash
# Deploy a staging
git push staging main

# Monitorear 24h
# Si OK, deploy a producción
git push production main

# Monitorear 7 días con dual write activo
```

**Monitoreo Crítico**:
- Latencia de escritura (debe ser < 2x baseline)
- Error rate (debe mantenerse < 0.1%)
- Divergencias entre legacy y nuevo (logs)
- Queries usando nuevo modelo correctamente

---

## Fase 6: Cleanup (CONTRACT) (Semana 10)

### Objetivo
Eliminar código legacy y colecciones obsoletas.

### Pre-requisitos
- [ ] 7 días de dual write sin errores
- [ ] 100% de queries usando nuevo modelo
- [ ] Backup final de legacy

### Ejecución

#### 6.1: Backup Final Legacy (15 min)
```bash
node scripts/backup-database.js \
  --tag="final-legacy-backup" \
  --collections="versionhistories,documentversions"
```

#### 6.2: Remover Código Legacy (1 día)
```bash
# Eliminar modelos
git rm backend/models/VersionHistory.js
git rm backend/models/DocumentVersion.js

# Actualizar imports en código
# Remover función de dual write

# Code review + tests
npm run test
```

#### 6.3: Drop Colecciones Legacy (5 min)
```bash
# CUIDADO: Irreversible (backup disponible)
db.versionhistories.drop()
db.documentversions.drop()
```

#### 6.4: Validación Final (30 min)
```bash
# Verificar aplicación funciona sin legacy
npm run test:e2e

# Verificar performance
node scripts/benchmark-queries.js --output=outputs/dbopt/bench-final.csv

# Comparar con baseline
node scripts/compare-benchmarks.js \
  --before=outputs/dbopt/bench-baseline.csv \
  --after=outputs/dbopt/bench-final.csv
```

**Criterios de Éxito**:
- ✅ Aplicación funciona correctamente
- ✅ No referencias a modelos legacy en código
- ✅ Performance igual o mejor que dual write
- ✅ Tests E2E pasan al 100%

---

## Rollback General por Fase

| Fase | Rollback Disponible | Tiempo | Complejidad |
|------|---------------------|--------|-------------|
| 1. Índices | ✅ Sí (drop índice) | 2 min | Baja |
| 2. Eliminar redundantes | ✅ Sí (recrear índice) | 2 min | Baja |
| 3. Desarrollo | N/A (no prod) | - | - |
| 4. Backfill | ✅ Sí (drop ContractVersion) | 5 min | Baja |
| 5. Dual Write | ✅ Sí (revertir código) | 15 min | Media |
| 6. Cleanup | ⚠️ Parcial (restaurar backup) | 30 min | Alta |

---

## Monitoreo y Alertas

### Dashboards a Crear

1. **Migration Progress Dashboard**
   - Documentos migrados vs totales
   - Errores por tipo
   - Tiempo restante estimado

2. **Performance Dashboard**
   - Latencia p95/p99 por query
   - Throughput (ops/sec)
   - CPU/memoria MongoDB

3. **Integrity Dashboard**
   - % de hashes válidos
   - Divergencias legacy vs nuevo
   - Cadenas de confianza rotas

### Alertas Críticas

```yaml
alerts:
  - name: "Migration Job Failed"
    condition: "exit_code != 0"
    severity: CRITICAL
    notify: ["team-lead", "dba"]

  - name: "Hash Mismatch Detected"
    condition: "invalid_hashes > 0"
    severity: CRITICAL
    action: "Pausar migración, investigar"

  - name: "Dual Write Divergence"
    condition: "legacy_vs_new_diff > 10"
    severity: WARNING
    action: "Investigar inconsistencias"

  - name: "Query Latency Spike"
    condition: "p95_latency > 500ms"
    severity: WARNING
    action: "Revisar índices y explain()"
```

---

## Checklist Final

### Pre-Migración
- [ ] Backup completo de producción
- [ ] Dry-run exitoso en staging
- [ ] Scripts validados con tests
- [ ] Equipo briefed sobre plan
- [ ] Rollback plan documentado
- [ ] Ventana de mantenimiento programada

### Durante Migración
- [ ] Monitoreo activo (CPU, latencia, errores)
- [ ] Logs siendo capturados
- [ ] Equipo en standby
- [ ] Go/No-Go checkpoints validados

### Post-Migración
- [ ] Validación de integridad completa
- [ ] Performance igual o mejor
- [ ] No errores en logs de aplicación
- [ ] Backup post-migración creado
- [ ] Documentación actualizada

---

## Contactos y Escalación

| Rol | Nombre | Contacto | Escalación |
|-----|--------|----------|------------|
| DBA Lead | TBD | - | Decisión de rollback |
| Backend Lead | TBD | - | Validación de código |
| DevOps | TBD | - | Infraestructura |
| Product Owner | TBD | - | Aprobación de ventanas |

---

**Preparado por**: DB-Contracts-Optimizer
**Fecha**: 2025-11-12
**Última Revisión**: 2025-11-12
**Estado**: DRAFT — Pendiente de aprobación
