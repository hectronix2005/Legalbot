# Propuesta: Sistema de Terceros Basado en Plantillas

**Fecha**: 2025-11-12
**Tipo**: Cambio Arquitectónico Mayor
**Estado**: Propuesta para Aprobación

---

## Requisito del Usuario

> "Deseo que según cada plantilla se cree un formato de tercero según las variables que se requieren. Es decir, tipo de tercero creado según cada plantilla. Puede existir el mismo tercero pero según cada plantilla."

---

## Problema Actual

**Sistema Actual**:
```
Tercero (Juan Pérez)
└── Tipo: "Proveedor" (genérico)
    └── Campos fijos: legal_name, identification_number, etc.
    └── custom_fields: { cualquier_campo: "valor" }

Plantilla "Contrato de Arrendamiento"
└── Variables requeridas: {{arrendador_nombre}}, {{arrendador_cedula}}, {{direccion_inmueble}}

Problema:
- El tercero tiene campos genéricos
- La plantilla requiere campos específicos
- No hay relación formal entre campos del tercero y variables de plantilla
- Mismo tercero no puede tener diferentes perfiles para diferentes plantillas
```

**Limitaciones**:
1. Campos de tercero no se mapean automáticamente a variables de plantilla
2. No hay validación de que un tercero tenga los campos requeridos por una plantilla
3. Mismo tercero físico (Juan Pérez) no puede tener perfil de "arrendador" para una plantilla y "arrendatario" para otra

---

## Soluciones Propuestas

### Opción 1: Perfiles de Tercero por Plantilla (RECOMENDADA)

**Concepto**: Mantener terceros base, pero crear "perfiles" específicos por plantilla.

```
Tercero Base (Juan Pérez)
├── Datos básicos: ID, nombre legal, cédula
├── company: 507f1f77bcf86cd799439011
└── Perfiles por Plantilla:
    ├── Perfil para "Contrato Arrendamiento"
    │   ├── template_id: 690f7d25500832cce7da54ef
    │   ├── role_in_template: "arrendador"
    │   └── template_specific_fields: {
    │       arrendador_nombre: "Juan Pérez Gómez",
    │       arrendador_cedula: "123456789",
    │       direccion_inmueble: "Calle 123 #45-67",
    │       cuenta_banco: "1234567890"
    │   }
    └── Perfil para "Contrato de Servicios"
        ├── template_id: 690d77adf5074e92f792d9d5
        ├── role_in_template: "contratista"
        └── template_specific_fields: {
            contratista_nombre: "Juan Pérez",
            contratista_nit: "123456789-1",
            servicio_descripcion: "Servicios de consultoría"
        }
```

**Ventajas**:
- ✅ Mantiene compatibilidad con sistema actual
- ✅ Un tercero puede tener múltiples perfiles (roles) por plantilla
- ✅ Validación específica por plantilla
- ✅ Mapeo claro entre campos y variables de plantilla
- ✅ Migración incremental posible

**Nuevo Modelo**:
```javascript
ThirdPartyProfile Schema:
{
  supplier_id: ObjectId,          // Referencia al Tercero base
  template_id: ObjectId,          // Plantilla específica
  company: ObjectId,              // Multi-tenant
  role_in_template: String,       // "arrendador", "arrendatario", "contratista", etc.
  template_specific_fields: Object, // Campos mapeados a variables de plantilla
  field_mappings: [{              // Mapeo explícito
    template_variable: String,    // {{arrendador_nombre}}
    field_name: String,           // "legal_name" o custom field
    value: Mixed
  }],
  is_complete: Boolean,           // Si tiene todos los campos requeridos
  last_used: Date,
  created_by: ObjectId,
  updated_at: Date
}
```

**Flujo de Uso**:
1. Usuario selecciona plantilla "Contrato de Arrendamiento"
2. Sistema analiza variables: {{arrendador_*}}, {{arrendatario_*}}
3. Usuario selecciona tercero base "Juan Pérez"
4. Sistema pregunta: "¿Rol en este contrato?" → Arrendador
5. Sistema crea/carga ThirdPartyProfile(Juan Pérez, Arrendamiento, "arrendador")
6. Si no existe, sistema sugiere campos basados en variables de plantilla
7. Usuario completa campos específicos
8. Perfil guardado y reutilizable para próximos contratos del mismo tipo

---

### Opción 2: Tipos Dinámicos de Tercero desde Plantillas

**Concepto**: Auto-generar tipos de tercero basados en variables de cada plantilla.

```
Plantilla "Contrato de Arrendamiento"
└── Variables detectadas: {{arrendador_*}}, {{arrendatario_*}}
    └── Auto-genera ThirdPartyTypeConfig:
        ├── code: "template_690f7d25_arrendador"
        ├── label: "Arrendador (Contrato Arrendamiento)"
        ├── linked_template: 690f7d25500832cce7da54ef
        └── fields: [
            { name: "arrendador_nombre", required: true },
            { name: "arrendador_cedula", required: true },
            { name: "direccion_inmueble", required: true }
          ]

Tercero (Juan Pérez)
├── third_party_type: "template_690f7d25_arrendador"
└── custom_fields: {
    arrendador_nombre: "Juan Pérez",
    arrendador_cedula: "123456789",
    direccion_inmueble: "Calle 123"
}
```

**Ventajas**:
- ✅ Tipos específicos por plantilla
- ✅ Validación automática de campos requeridos
- ✅ Reutiliza sistema actual de ThirdPartyTypeConfig

**Desventajas**:
- ❌ Proliferación de tipos (1 tipo por rol por plantilla)
- ❌ Mismo tercero físico necesitaría múltiples registros
- ❌ Migración compleja
- ❌ No refleja que "Juan Pérez" es la misma entidad

---

### Opción 3: Híbrida (Perfiles + Tipos Sugeridos)

**Concepto**: Combinar perfiles por plantilla con sugerencias de tipo base.

```
Sistema sugiere tipo base según análisis de plantilla:
- Si variables contienen "arrendador" → Tipo sugerido: "arrendador"
- Si variables contienen "empleado" → Tipo sugerido: "empleado"

Pero además crea perfil específico para esa plantilla.
```

**Ventajas**:
- ✅ Lo mejor de ambos mundos
- ✅ Sugerencias inteligentes de tipo
- ✅ Perfiles específicos por plantilla

**Complejidad**: Mayor

---

## Comparación de Opciones

| Aspecto | Opción 1: Perfiles | Opción 2: Tipos Dinámicos | Opción 3: Híbrida |
|---------|-------------------|---------------------------|-------------------|
| **Complejidad Implementación** | Media | Alta | Muy Alta |
| **Compatibilidad Backward** | ✅ Alta | ⚠️ Media | ✅ Alta |
| **Escalabilidad** | ✅ Excelente | ⚠️ Limitada | ✅ Excelente |
| **Claridad Conceptual** | ✅ Clara | ❌ Confusa | ⚠️ Media |
| **Reuso de Terceros** | ✅ Sí | ❌ No | ✅ Sí |
| **Validación por Plantilla** | ✅ Sí | ✅ Sí | ✅ Sí |
| **Tiempo Implementación** | 2-3 días | 3-4 días | 5-7 días |

---

## Recomendación: Opción 1 (Perfiles)

### Justificación

1. **Refleja la realidad del negocio**: Juan Pérez es una persona, pero puede actuar como arrendador en un contrato y arrendatario en otro
2. **Flexibilidad máxima**: Mismo tercero, múltiples roles, múltiples plantillas
3. **Migración suave**: No rompe sistema actual, se agrega encima
4. **Performance**: No proliferación de registros redundantes

### Implementación Propuesta

#### Fase 1: Modelo y API (Día 1)

```javascript
// backend/models/ThirdPartyProfile.js
const thirdPartyProfileSchema = new mongoose.Schema({
  supplier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Supplier',
    required: true
  },
  template: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ContractTemplate',
    required: true
  },
  company: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true
  },
  role_in_template: {
    type: String,
    required: true,
    // "arrendador", "arrendatario", "contratista", "cliente", etc.
  },
  template_specific_fields: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: {}
  },
  field_mappings: [{
    template_variable: String,    // "{{arrendador_nombre}}"
    source_field: String,         // "legal_name" o custom field
    value: mongoose.Schema.Types.Mixed,
    is_auto_filled: Boolean       // Si se llenó automáticamente
  }],
  completeness: {
    required_fields_count: Number,
    filled_fields_count: Number,
    percentage: Number,
    missing_fields: [String]
  },
  last_used_in_contract: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Contract'
  },
  usage_count: {
    type: Number,
    default: 0
  },
  created_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updated_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Índices
thirdPartyProfileSchema.index({ supplier: 1, template: 1, role_in_template: 1 }, { unique: true });
thirdPartyProfileSchema.index({ company: 1, template: 1 });
thirdPartyProfileSchema.index({ supplier: 1, company: 1 });
```

**API Endpoints**:
```
POST   /api/third-party-profiles              - Crear perfil
GET    /api/third-party-profiles              - Listar perfiles
GET    /api/third-party-profiles/:id          - Obtener perfil
PUT    /api/third-party-profiles/:id          - Actualizar perfil
DELETE /api/third-party-profiles/:id          - Eliminar perfil

GET    /api/third-party-profiles/by-supplier/:supplierId  - Perfiles de un tercero
GET    /api/third-party-profiles/by-template/:templateId  - Perfiles para una plantilla

POST   /api/third-party-profiles/analyze-template/:templateId  - Analizar variables de plantilla
POST   /api/third-party-profiles/auto-fill                     - Auto-llenar desde tercero base
```

#### Fase 2: Análisis de Variables de Plantilla (Día 1-2)

**Servicio**: `templateVariableAnalyzer.js`

```javascript
// Analiza contenido de plantilla y extrae:
// 1. Variables únicas: {{arrendador_nombre}}, {{arrendatario_nombre}}
// 2. Roles detectados: "arrendador", "arrendatario" (por prefijo)
// 3. Campos requeridos por rol
// 4. Sugerencias de mapeo a campos estándar

Example Output:
{
  template_id: "690f7d25500832cce7da54ef",
  roles_detected: [
    {
      role: "arrendador",
      variables: [
        "{{arrendador_nombre}}",
        "{{arrendador_cedula}}",
        "{{arrendador_direccion}}"
      ],
      suggested_mappings: [
        { variable: "{{arrendador_nombre}}", source: "legal_name" },
        { variable: "{{arrendador_cedula}}", source: "identification_number" }
      ]
    },
    {
      role: "arrendatario",
      variables: ["{{arrendatario_nombre}}", "{{arrendatario_cedula}}"]
    }
  ],
  all_variables: [...],
  variable_count: 15
}
```

#### Fase 3: UI - Selector de Perfil (Día 2-3)

**Componente**: `ThirdPartyProfileSelector.tsx`

**Flujo UX**:
```
1. Usuario genera contrato con plantilla "Arrendamiento"
2. Sistema muestra:
   ┌─────────────────────────────────────────────┐
   │ Esta plantilla requiere 2 terceros:        │
   │                                             │
   │ 🏠 Arrendador (propietario)                 │
   │   [Seleccionar Tercero ▼]                  │
   │   ├─ Usar perfil existente                 │
   │   ├─ Crear nuevo perfil                    │
   │   └─ Crear nuevo tercero + perfil          │
   │                                             │
   │ 👤 Arrendatario (inquilino)                 │
   │   [Seleccionar Tercero ▼]                  │
   └─────────────────────────────────────────────┘

3. Usuario selecciona "Juan Pérez"
4. Sistema busca: ThirdPartyProfile(Juan Pérez, Arrendamiento, "arrendador")
   - Si existe: Cargar y mostrar
   - Si no existe: Crear nuevo perfil con sugerencias

5. Auto-fill inteligente:
   ┌─────────────────────────────────────────────┐
   │ Perfil: Juan Pérez como Arrendador         │
   │                                             │
   │ ✅ arrendador_nombre: "Juan Pérez Gómez"    │
   │    (auto-llenado desde legal_name)         │
   │                                             │
   │ ✅ arrendador_cedula: "123456789"           │
   │    (auto-llenado desde identification)     │
   │                                             │
   │ ⚠️  direccion_inmueble: [Completar]         │
   │    Específico para esta plantilla          │
   │                                             │
   │ [Guardar Perfil para Reutilizar]           │
   └─────────────────────────────────────────────┘
```

#### Fase 4: Integración con Generación de Contratos (Día 3)

**Cambios en ContractGenerator**:
```typescript
// Antes:
const selectedSuppliers = [supplierId1, supplierId2];

// Después:
const selectedProfiles = [
  {
    profile_id: "profile_123",
    supplier_id: "supplier_456",
    role: "arrendador",
    fields: { arrendador_nombre: "Juan", ... }
  },
  {
    profile_id: "profile_789",
    supplier_id: "supplier_101",
    role: "arrendatario",
    fields: { arrendatario_nombre: "María", ... }
  }
];

// Al generar contrato:
// 1. Reemplazar variables con valores de profile.fields
// 2. Registrar usage_count++
// 3. Actualizar last_used_in_contract
```

#### Fase 5: Migración de Datos Existentes (Día 3-4)

**Script**: `migrate-to-profiles.js`

```javascript
// Para cada Supplier existente:
// 1. Buscar contratos donde se usó
// 2. Identificar plantilla y rol
// 3. Crear ThirdPartyProfile retrospectivo
// 4. Copiar custom_fields relevantes

// Estrategia:
// - Mantener Supplier.custom_fields como está (backward compat)
// - Crear perfiles para plantillas más usadas
// - Migración lazy: crear perfil cuando se use
```

---

## Impacto y Riesgos

### Impacto

| Componente | Cambio | Severidad |
|------------|--------|-----------|
| **Base de Datos** | Nuevo modelo ThirdPartyProfile | Media |
| **API Backend** | Nuevas rutas, servicio de análisis | Media |
| **Frontend - ContractGenerator** | Cambio selector de terceros | Alta |
| **Frontend - Suppliers** | Agregar gestión de perfiles | Media |
| **Contratos Existentes** | No afectados | Baja |

### Riesgos

1. **Performance**: Queries adicionales al generar contrato
   - **Mitigación**: Índices en ThirdPartyProfile, caching

2. **Complejidad UX**: Usuario debe entender concepto de "perfiles"
   - **Mitigación**: UX clara, auto-fill inteligente, tutoriales

3. **Migración**: Datos históricos sin perfiles
   - **Mitigación**: Migración lazy, sistema funciona sin perfiles

---

## Timeline

### Fase 1: MVP (3 días)
- ✅ Día 1: Modelo + API básica
- ✅ Día 2: Análisis de variables + Auto-fill
- ✅ Día 3: UI selector básico

### Fase 2: Integración (2 días)
- ✅ Día 4: Integrar con ContractGenerator
- ✅ Día 5: Testing + Bug fixes

### Fase 3: Mejoras (2 días)
- ✅ Día 6: Gestión de perfiles en Suppliers
- ✅ Día 7: Migración de datos existentes

**Total**: ~7 días (1.5 semanas)

---

## Decisión Requerida

¿Apruebas la **Opción 1: Perfiles de Tercero por Plantilla**?

- [ ] **Sí, proceder con implementación completa**
- [ ] Sí, pero empezar con MVP simplificado
- [ ] No, considerar Opción 2 o 3
- [ ] No, necesito aclaraciones sobre: ___________

---

## Próximos Pasos (Si se Aprueba)

1. Crear modelo ThirdPartyProfile
2. Implementar API de perfiles
3. Crear servicio de análisis de variables
4. Implementar auto-fill inteligente
5. Adaptar ContractGenerator
6. Testing exhaustivo
7. Migración de datos

---

**Esperando aprobación para proceder...**
