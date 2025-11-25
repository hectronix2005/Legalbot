# ADR-001: Estrategia Unificada de Versionamiento de Contratos

## Status
**PROPUESTO** — Pendiente de aprobación

## Context

El sistema Legal Bot actualmente utiliza **dos modelos separados** para versionamiento:

1. **VersionHistory** — Para versiones de plantillas (ContractTemplate)
2. **DocumentVersion** — Para versiones de contratos (Contract)

Ambos modelos implementan un patrón **append-only** con snapshots completos, pero tienen diferencias clave:

| Característica | VersionHistory | DocumentVersion |
|----------------|----------------|-----------------|
| Almacena archivos | ❌ No | ✅ Sí (Word/PDF paths) |
| Índices | ❌ Ninguno | ✅ 2 índices compuestos |
| Marca versión actual | ❌ No | ✅ `is_current` flag |
| Hash de integridad | ❌ No | ❌ No |
| Cadena de confianza | ❌ No | ❌ No |

### Problemas Identificados

1. **Duplicación de Lógica**: Dos modelos hacen esencialmente lo mismo
2. **Complejidad de Mantenimiento**: Cambios deben aplicarse en dos lugares
3. **Inconsistencia de Features**: VersionHistory no tiene las optimizaciones de DocumentVersion
4. **Sin Integridad Criptográfica**: Ninguno implementa hashing o firma digital
5. **Almacenamiento Ineficiente**: Full snapshots → duplicación masiva de contenido
6. **Storage Local**: Archivos en disco local → no escalable para Heroku/AWS

---

## Decision

Implementar **modelo unificado de versionamiento** con las siguientes características:

### 1. Nuevo Modelo: `ContractVersion`

```javascript
const contractVersionSchema = new mongoose.Schema({
  // Identificación del documento versionado
  entity_type: {
    type: String,
    enum: ['contract', 'template'],
    required: true,
    index: true
  },
  entity_id: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    refPath: 'entity_type_ref',  // Ref dinámica
    index: true
  },
  entity_type_ref: {
    type: String,
    enum: ['Contract', 'ContractTemplate']
  },

  // Información de la versión
  version: {
    type: Number,
    required: true,
    min: 1
  },
  is_current: {
    type: Boolean,
    default: false,
    index: true
  },

  // Integridad criptográfica
  content_hash: {
    type: String,
    required: true,
    index: true,
    validate: {
      validator: v => /^[a-f0-9]{64}$/.test(v),  // SHA-256
      message: 'content_hash debe ser SHA-256 válido'
    }
  },
  prev_version_hash: {
    type: String,
    default: null,
    description: 'Hash de la versión anterior (chain of trust)'
  },

  // Contenido
  storage_strategy: {
    type: String,
    enum: ['full_snapshot', 'delta_compressed'],
    default: 'full_snapshot'
  },
  content: {
    type: String,
    required: function() {
      return this.storage_strategy === 'full_snapshot';
    }
  },
  content_delta: {
    type: String,  // Base64 encoded compressed delta
    required: function() {
      return this.storage_strategy === 'delta_compressed';
    }
  },

  // Archivos asociados (para contratos)
  files: {
    word: {
      storage_type: { type: String, enum: ['local', 's3', 'azure'], default: 'local' },
      path: String,           // Local: /uploads/...  S3: s3://bucket/...
      url: String,            // Signed URL temporal
      url_expires_at: Date,
      size_bytes: Number,
      mime_type: String
    },
    pdf: {
      storage_type: { type: String, enum: ['local', 's3', 'azure'], default: 'local' },
      path: String,
      url: String,
      url_expires_at: Date,
      size_bytes: Number,
      mime_type: String
    }
  },

  // Metadatos
  metadata: {
    change_description: {
      type: String,
      default: ''
    },
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    created_at: {
      type: Date,
      default: Date.now,
      index: true
    },
    tags: [String],  // Para búsqueda semántica futura
    approvals: [{
      approved_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      approved_at: Date,
      role: String
    }]
  }
}, {
  timestamps: true
});

// Índices compuestos
contractVersionSchema.index(
  { entity_type: 1, entity_id: 1, version: -1 },
  { name: 'idx_entity_version' }
);

contractVersionSchema.index(
  { entity_type: 1, entity_id: 1, is_current: 1 },
  { name: 'idx_entity_current' }
);

contractVersionSchema.index(
  { content_hash: 1 },
  { name: 'idx_content_hash', unique: true }
);

contractVersionSchema.index(
  { 'metadata.created_at': 1 },
  { name: 'idx_created_date' }  // Para archivado
);

// Constraint: Solo una versión puede ser is_current=true por documento
contractVersionSchema.index(
  { entity_type: 1, entity_id: 1, is_current: 1 },
  { unique: true, partialFilterExpression: { is_current: true } }
);
```

### 2. Funciones de Integridad

```javascript
// Calcular hash de contenido
contractVersionSchema.methods.calculateContentHash = function() {
  const crypto = require('crypto');
  const content = this.storage_strategy === 'full_snapshot'
    ? this.content
    : this.content_delta;
  return crypto.createHash('sha256').update(content).digest('hex');
};

// Verificar cadena de confianza
contractVersionSchema.methods.verifyChainOfTrust = async function() {
  if (this.version === 1) {
    // Primera versión no tiene prev_version_hash
    return { valid: true, message: 'Primera versión' };
  }

  const prevVersion = await this.constructor.findOne({
    entity_type: this.entity_type,
    entity_id: this.entity_id,
    version: this.version - 1
  });

  if (!prevVersion) {
    return { valid: false, message: 'Versión anterior no encontrada' };
  }

  if (prevVersion.content_hash !== this.prev_version_hash) {
    return {
      valid: false,
      message: 'Hash de versión anterior no coincide',
      expected: prevVersion.content_hash,
      actual: this.prev_version_hash
    };
  }

  return { valid: true, message: 'Cadena de confianza válida' };
};

// Marcar como versión actual
contractVersionSchema.statics.setAsCurrent = async function(entityType, entityId, version) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Desmarcar todas las versiones anteriores
    await this.updateMany(
      { entity_type: entityType, entity_id: entityId },
      { $set: { is_current: false } },
      { session }
    );

    // Marcar nueva versión como actual
    await this.updateOne(
      { entity_type: entityType, entity_id: entityId, version },
      { $set: { is_current: true } },
      { session }
    );

    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};
```

---

## Consequences

### ✅ Ventajas

1. **Modelo Único**: Una sola fuente de verdad para versionamiento
2. **Integridad Criptográfica**: SHA-256 + chain of trust previene alteraciones
3. **Auditable**: Cada cambio es trazable e inmutable
4. **Escalable**: Preparado para delta storage y compresión
5. **Flexible Storage**: Soporta local, S3, Azure (migración incremental)
6. **Índices Optimizados**: Queries eficientes desde el diseño
7. **Compliance**: GDPR/CCPA compatible (PII en metadata separado)

### ⚠️ Desventajas y Mitigaciones

| Desventaja | Impacto | Mitigación |
|------------|---------|------------|
| Migración compleja | Alto | Plan expand/contract con backfill idempotente |
| Storage inicial mayor | Bajo | Full snapshots solo para versión 1, luego deltas |
| Validación de hash | Bajo | Async job de validación nocturno |
| Refactor de código | Alto | Dual-write temporal durante migración |

---

## Alternatives Considered

### Alternativa 1: Mantener Modelos Separados + Optimizar
**Pros**: Sin migración compleja
**Cons**: Duplicación continua, no resuelve problemas de integridad
**Decisión**: ❌ Rechazado — No resuelve problemas fundamentales

### Alternativa 2: Event Sourcing Completo
**Pros**: Auditabilidad total, replay de estado
**Cons**: Complejidad masiva, overhead de infraestructura
**Decisión**: ❌ Rechazado — Over-engineering para el caso de uso actual

### Alternativa 3: Git-like Delta Storage
**Pros**: Almacenamiento ultra eficiente
**Cons**: Complejidad de diff/patch, latencia de reconstrucción
**Decisión**: 🟡 Fase 2 — Implementar después de consolidación

---

## Migration Strategy

### Fase 1: EXPAND (Sin Downtime)

#### Semana 1-2: Preparación
1. ✅ Crear modelo `ContractVersion`
2. ✅ Implementar funciones de integridad
3. ✅ Escribir tests unitarios (>80% coverage)
4. ✅ Backfill job idempotente con dry-run

#### Semana 3: Backfill (Horario de Baja Carga)
```bash
# Migrar VersionHistory → ContractVersion
node scripts/migrate-versions.js \
  --source=versionhistories \
  --entity-type=template \
  --dry-run

# Verificar resultados
node scripts/migrate-versions.js \
  --source=versionhistories \
  --entity-type=template \
  --execute \
  --batch-size=100

# Migrar DocumentVersion → ContractVersion
node scripts/migrate-versions.js \
  --source=documentversions \
  --entity-type=contract \
  --execute \
  --batch-size=100
```

#### Semana 4: Validación
```bash
# Verificar integridad de hashes
node scripts/verify-version-integrity.js

# Verificar cadenas de confianza
node scripts/verify-chain-of-trust.js

# Comparar conteos
node scripts/compare-version-counts.js
```

### Fase 2: SWITCH (Switchover Gradual)

#### Semana 5-6: Dual Write
- Código escribe en **ambos** modelos (legacy + nuevo)
- Lecturas desde **nuevo modelo**
- Monitorear errores y latencia

#### Semana 7: Validación en Producción
- 7 días de observación sin errores
- Verificar integridad diaria
- Comparar queries legacy vs nuevo

### Fase 3: CONTRACT (Retirar Legacy)

#### Semana 8: Cleanup
```bash
# Backup final de modelos legacy
node scripts/backup-legacy-models.js

# Drop colecciones legacy
db.versionhistories.drop()
db.documentversions.drop()

# Remover código legacy
git rm backend/models/VersionHistory.js
git rm backend/models/DocumentVersion.js
```

---

## Implementation Checklist

### Backend
- [ ] Crear modelo `ContractVersion` con esquema completo
- [ ] Implementar métodos de integridad (hash, chain of trust)
- [ ] Crear índices optimizados
- [ ] Escribir tests unitarios (>80% coverage)
- [ ] Implementar backfill job idempotente
- [ ] Crear script de verificación de integridad
- [ ] Actualizar rutas para usar nuevo modelo (dual-write)
- [ ] Implementar rollback plan

### Storage Migration (Fase 2)
- [ ] Configurar AWS S3 bucket con lifecycle policies
- [ ] Implementar upload a S3 con signed URLs
- [ ] Migrar archivos locales → S3 (incremental)
- [ ] Actualizar modelo para usar S3 paths
- [ ] Configurar CDN (CloudFront)

### Monitoring
- [ ] Dashboard de integridad de versiones
- [ ] Alertas de hash mismatch
- [ ] Métricas de latencia de queries
- [ ] Storage usage por entity_type

---

## Timeline

| Fase | Duración | Entregables |
|------|----------|-------------|
| **Diseño y Aprobación** | 1 semana | Este ADR, aprobación stakeholders |
| **Desarrollo** | 2 semanas | Modelo, tests, backfill job |
| **Migración (Expand)** | 1 semana | Datos migrados, validados |
| **Dual Write** | 2 semanas | Switchover gradual, monitoreo |
| **Contract** | 1 semana | Legacy eliminado, cleanup |
| **Total** | **7 semanas** | Versionamiento unificado en producción |

---

## Success Metrics

| Métrica | Baseline | Target | Medición |
|---------|----------|--------|----------|
| Modelos de versionamiento | 2 | 1 | Code review |
| Cobertura de tests | 0% | >80% | Jest coverage report |
| Queries con integridad verificada | 0% | 100% | Hash validation logs |
| Latencia p95 historial | 10ms | <5ms | MongoDB profiler |
| Redundancia de archivos | 0x | 99.99% | S3 metrics |

---

## References

- [MongoDB Best Practices - Document Versioning](https://www.mongodb.com/blog/post/building-with-patterns-the-document-versioning-pattern)
- [Event Sourcing Pattern](https://martinfowler.com/eaaDev/EventSourcing.html)
- [Git Internals - Packfiles](https://git-scm.com/book/en/v2/Git-Internals-Packfiles)
- [SHA-256 Hash Function](https://en.wikipedia.org/wiki/SHA-2)

---

**Autor**: DB-Contracts-Optimizer
**Fecha**: 2025-11-12
**Última Actualización**: 2025-11-12
