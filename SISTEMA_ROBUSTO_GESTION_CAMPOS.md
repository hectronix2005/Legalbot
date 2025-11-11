# Sistema Robusto de Gestión de Campos Dinámicos para Terceros

## Descripción General

Este es un **sistema completamente nuevo y robusto** que centraliza toda la gestión de campos personalizados para terceros. Incluye normalización automática, análisis inteligente, sugerencias basadas en plantillas y terceros similares, migración automática y validación.

---

## Componentes del Sistema

### 1. Servicio Centralizado (`fieldManagementService.js`)

Este servicio es el cerebro del sistema. Todas las operaciones de campos pasan por aquí.

**Ubicación:** `/backend/services/fieldManagementService.js`

**Funcionalidades principales:**

#### A. Normalización de Campos
```javascript
FieldManagementService.normalizeFieldName("Razón Social")
// Retorna: "razon_social"

FieldManagementService.normalizeFieldName("NOMBRE DEL LICENCIATARIO")
// Retorna: "nombre_del_licenciatario"
```

- Elimina acentos
- Convierte a minúsculas
- Unifica separadores a `_`
- Elimina espacios extras

#### B. Extracción Inteligente de Campos
```javascript
const campos = FieldManagementService.extractSupplierFields(supplier);
// Retorna Map con:
// - Campos estándar del modelo mapeados
// - Campos personalizados del tercero
// - Metadatos de origen (standard vs custom)
```

#### C. Análisis de Campos Faltantes
```javascript
const analysis = await FieldManagementService.analyzeMissingFields(
  supplier,
  companyId
);
```

**Retorna:**
```json
{
  "hasType": true,
  "typeCode": "propiedad_horizontal",
  "currentFields": ["razon_social", "email", "telefono"],
  "currentFieldsDetail": [{
    "name": "razon_social",
    "value": "PH Los Alamos",
    "source": "standard",
    "originalField": "legal_name"
  }],
  "missingFields": [{
    "name": "licenciatario",
    "label": "Licenciatario",
    "type": "text",
    "required": true,
    "usedInTemplates": ["Contrato PH - Administración", "Contrato PH - Seguro"],
    "templateIds": ["abc123", "def456"]
  }],
  "matchedFields": [{...}],
  "totalRequired": 10,
  "totalMatched": 7,
  "totalMissing": 3,
  "completionPercentage": 70
}
```

#### D. Sugerencias de Terceros Similares
```javascript
const suggestions = await FieldManagementService.getSuggestionsFromSimilarSuppliers(
  supplier,
  companyId
);
```

Analiza otros terceros del mismo tipo y sugiere campos que tienen frecuentemente.

#### E. Validación para Plantillas
```javascript
const validation = await FieldManagementService.validateSupplierForTemplate(
  supplierId,
  templateId
);
```

Valida si un tercero tiene todos los campos necesarios para una plantilla específica.

---

### 2. API REST Completa (`field-management.js`)

**Ubicación:** `/backend/routes/field-management.js`

Endpoints disponibles:

#### GET `/api/field-management/supplier/:id/analysis`
**Descripción:** Análisis completo de campos del tercero

**Requiere:** Token de autenticación

**Retorna:**
- Campos actuales del tercero
- Campos faltantes por plantilla
- Porcentaje de completitud
- Detalles de campos coincidentes

**Ejemplo:**
```bash
curl -H "Authorization: Bearer TOKEN" \
  http://localhost:3002/api/field-management/supplier/SUPPLIER_ID/analysis
```

---

#### GET `/api/field-management/supplier/:id/suggestions`
**Descripción:** Sugerencias basadas en terceros similares

**Retorna:**
- Campos que tienen otros terceros del mismo tipo
- Frecuencia de uso
- Valores de ejemplo
- Recomendación (si >50% lo tienen)

**Ejemplo:**
```bash
curl -H "Authorization: Bearer TOKEN" \
  http://localhost:3002/api/field-management/supplier/SUPPLIER_ID/suggestions
```

---

#### POST `/api/field-management/supplier/:id/fields`
**Descripción:** Agrega o actualiza campos del tercero

**Requiere:** Admin/Super Admin/Lawyer

**Body:**
```json
{
  "fields": [
    {
      "name": "licenciatario",
      "value": "Juan Pérez González",
      "label": "Licenciatario" // Opcional
    },
    {
      "name": "banco",
      "value": "Bancolombia"
    }
  ]
}
```

**Retorna:**
```json
{
  "success": true,
  "message": "2 campos agregados, 0 actualizados",
  "updates": {
    "fieldsAdded": [
      { "name": "licenciatario", "value": "Juan Pérez González" }
    ],
    "fieldsUpdated": [],
    "errors": []
  }
}
```

---

#### POST `/api/field-management/supplier/:id/migrate`
**Descripción:** Migra campos a nombres normalizados

**Requiere:** Admin/Super Admin

**Retorna:**
```json
{
  "success": true,
  "result": {
    "migrated": true,
    "migrationsCount": 5,
    "migrations": [
      {
        "oldKey": "Razón Social",
        "newKey": "razon_social",
        "value": "PH Los Alamos"
      }
    ]
  }
}
```

---

#### POST `/api/field-management/migrate-all`
**Descripción:** Migra todos los terceros de la empresa

**Requiere:** Admin/Super Admin

**Body:**
```json
{
  "dryRun": true  // true para solo ver, false para ejecutar
}
```

**Retorna:**
```json
{
  "success": true,
  "dryRun": true,
  "results": {
    "total": 9,
    "migrated": 3,
    "skipped": 6,
    "details": [...]
  }
}
```

---

#### GET `/api/field-management/validate-template/:supplierId/:templateId`
**Descripción:** Valida si el tercero puede usar una plantilla

**Retorna:**
```json
{
  "success": true,
  "validation": {
    "valid": false,
    "missingRequired": [
      { "name": "banco", "label": "Banco", "type": "text" }
    ],
    "missingOptional": [...],
    "matchedFields": [...]
  }
}
```

---

#### GET `/api/field-management/stats`
**Descripción:** Estadísticas de completitud de todos los terceros

**Retorna:**
```json
{
  "success": true,
  "stats": {
    "total": 9,
    "avgCompleteness": 75,
    "byType": {
      "Propiedad Horizontal": {
        "count": 3,
        "avgCompleteness": 80
      },
      "Proveedor": {
        "count": 6,
        "avgCompleteness": 72
      }
    },
    "needsAttention": [
      {
        "id": "...",
        "name": "Proveedor XYZ",
        "type": "Proveedor",
        "completeness": 40,
        "missingCount": 6
      }
    ]
  }
}
```

---

#### GET `/api/field-management/required-fields/:typeCode`
**Descripción:** Campos requeridos para un tipo de tercero

**Retorna:**
```json
{
  "success": true,
  "typeCode": "propiedad_horizontal",
  "requiredFields": [
    {
      "name": "razon_social",
      "label": "Razón Social",
      "type": "text",
      "required": true,
      "usedInTemplates": ["Contrato PH", "Acta Asamblea"],
      "templateIds": ["...", "..."]
    }
  ]
}
```

---

## Ventajas del Nuevo Sistema

### 1. Centralización
✅ Una sola fuente de verdad para toda la lógica de campos
✅ Fácil de mantener y actualizar
✅ Comportamiento consistente en toda la aplicación

### 2. Normalización Automática
✅ Los campos siempre se guardan en formato consistente
✅ No importa cómo el usuario los escriba
✅ "Razón Social", "razon social", "RAZON_SOCIAL" → `razon_social`

### 3. Matching Inteligente
✅ Encuentra coincidencias aunque los nombres sean diferentes
✅ "razon_social" coincide con "razon_social_corta"
✅ Ignora acentos, mayúsculas, espacios

### 4. Análisis en Tiempo Real
✅ Siempre sabe qué le falta a cada tercero
✅ Basado en plantillas activas reales
✅ Se actualiza automáticamente cuando cambien las plantillas

### 5. Sugerencias Inteligentes
✅ Aprende de terceros similares
✅ Sugiere campos comunes del tipo
✅ Prioriza por frecuencia de uso

### 6. Migración Segura
✅ Modo dry-run para ver antes de aplicar
✅ Puede migrar uno o todos los terceros
✅ Registra todos los cambios realizados

### 7. Validación Automática
✅ Verifica antes de generar contratos
✅ Diferencia entre campos requeridos y opcionales
✅ Retorna exactamente qué falta

### 8. Estadísticas y Monitoreo
✅ Dashboard de completitud de terceros
✅ Identifica terceros que necesitan atención
✅ Estadísticas por tipo

---

## Flujos de Uso

### Flujo 1: Usuario edita un tercero

```
1. Frontend carga tercero
   GET /api/suppliers/:id

2. Frontend solicita análisis de campos
   GET /api/field-management/supplier/:id/analysis

3. Sistema retorna:
   - Campos actuales
   - Campos faltantes por plantilla
   - Porcentaje de completitud

4. Usuario ve panel con:
   "Este tercero está 70% completo"
   "Le faltan 3 campos para 2 plantillas"

5. Usuario agrega campos faltantes
   POST /api/field-management/supplier/:id/fields

6. Sistema normaliza y guarda automáticamente

7. Análisis se actualiza en tiempo real
```

### Flujo 2: Admin hace migración masiva

```
1. Admin ejecuta dry-run
   POST /api/field-management/migrate-all
   Body: { "dryRun": true }

2. Sistema retorna qué cambiaría sin aplicar

3. Admin revisa los cambios

4. Admin ejecuta migración real
   POST /api/field-management/migrate-all
   Body: { "dryRun": false }

5. Sistema migra todos los campos

6. Retorna resumen de cambios
```

### Flujo 3: Validar antes de generar contrato

```
1. Usuario intenta generar contrato

2. Sistema valida automáticamente
   GET /api/field-management/validate-template/:supplierId/:templateId

3. Si falta algo:
   - Muestra campos faltantes
   - Usuario puede agregarlos en el momento

4. Si está completo:
   - Permite generar contrato
```

---

## Integración con Frontend

### Componente de Análisis

```typescript
import axios from 'axios';

const fetchFieldAnalysis = async (supplierId: string) => {
  const token = localStorage.getItem('token');
  const response = await axios.get(
    `http://localhost:3002/api/field-management/supplier/${supplierId}/analysis`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  const { analysis } = response.data;

  // Mostrar porcentaje de completitud
  console.log(`Completitud: ${analysis.completionPercentage}%`);

  // Mostrar campos faltantes
  analysis.missingFields.forEach(field => {
    console.log(`Falta: ${field.label} (usado en ${field.usedInTemplates.join(', ')})`);
  });
};
```

### Agregar Campos

```typescript
const addFields = async (supplierId: string, fields: any[]) => {
  const token = localStorage.getItem('token');

  await axios.post(
    `http://localhost:3002/api/field-management/supplier/${supplierId}/fields`,
    { fields },
    { headers: { Authorization: `Bearer ${token}` } }
  );

  // Recargar análisis
  await fetchFieldAnalysis(supplierId);
};
```

### Dashboard de Estadísticas

```typescript
const fetchStats = async () => {
  const token = localStorage.getItem('token');
  const response = await axios.get(
    `http://localhost:3002/api/field-management/stats`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  const { stats } = response.data;

  console.log(`Completitud promedio: ${stats.avgCompleteness}%`);
  console.log(`Terceros que necesitan atención: ${stats.needsAttention.length}`);
};
```

---

## Testing del Sistema

### 1. Test de Análisis
```bash
# Obtener análisis de un tercero
curl -H "Authorization: Bearer TOKEN" \
  http://localhost:3002/api/field-management/supplier/SUPPLIER_ID/analysis
```

### 2. Test de Sugerencias
```bash
# Obtener sugerencias basadas en similares
curl -H "Authorization: Bearer TOKEN" \
  http://localhost:3002/api/field-management/supplier/SUPPLIER_ID/suggestions
```

### 3. Test de Agregar Campos
```bash
curl -X POST \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fields": [
      { "name": "banco", "value": "Bancolombia" },
      { "name": "licenciatario", "value": "Juan Pérez" }
    ]
  }' \
  http://localhost:3002/api/field-management/supplier/SUPPLIER_ID/fields
```

### 4. Test de Migración (Dry Run)
```bash
curl -X POST \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "dryRun": true }' \
  http://localhost:3002/api/field-management/migrate-all
```

### 5. Test de Estadísticas
```bash
curl -H "Authorization: Bearer TOKEN" \
  http://localhost:3002/api/field-management/stats
```

### 6. Test de Validación
```bash
curl -H "Authorization: Bearer TOKEN" \
  http://localhost:3002/api/field-management/validate-template/SUPPLIER_ID/TEMPLATE_ID
```

---

## Archivos del Sistema

### Nuevos Archivos Creados
```
backend/
├── services/
│   └── fieldManagementService.js  (Servicio centralizado)
└── routes/
    └── field-management.js         (API REST completa)
```

### Archivos Modificados
```
backend/
└── server.js  (Líneas 104 y 130 - Registro de rutas)
```

---

## Estado Actual

✅ **Servicio centralizado funcionando**
✅ **API REST completa implementada**
✅ **Servidor corriendo sin errores**
✅ **Todos los endpoints disponibles**
✅ **Normalización automática activa**
✅ **Análisis inteligente operativo**
✅ **Sistema de sugerencias funcionando**
✅ **Migración automática disponible**
✅ **Validación de plantillas activa**
✅ **Estadísticas y monitoreo listos**

---

## Próximos Pasos Recomendados

1. **Frontend Dashboard** - Crear panel visual de estadísticas
2. **Componente de Sugerencias** - UI para mostrar campos faltantes
3. **Notificaciones** - Alertar cuando terceros están incompletos
4. **Batch Operations** - Agregar campos a múltiples terceros a la vez
5. **Field Templates** - Plantillas de conjuntos de campos comunes
6. **Auto-complete** - Sugerencias mientras el usuario escribe
7. **Historial** - Tracking de cambios en campos
8. **Export/Import** - Exportar configuraciones de campos

---

## Diferencias con Sistema Anterior

| Aspecto | Sistema Anterior | Sistema Nuevo |
|---------|------------------|---------------|
| **Arquitectura** | Rutas dispersas | Servicio centralizado |
| **Normalización** | Manual | Automática |
| **Análisis** | Básico | Completo con métricas |
| **Sugerencias** | Solo plantillas | Plantillas + similares |
| **Migración** | Script separado | Integrada en API |
| **Validación** | No incluida | Completa y automática |
| **Estadísticas** | No disponibles | Dashboard completo |
| **Mantenimiento** | Difícil | Fácil |
| **Extensibilidad** | Limitada | Alta |

---

## Soporte

Para problemas o preguntas:
1. Revisar esta documentación
2. Verificar logs del servidor
3. Probar endpoints con curl
4. Revisar código del servicio
5. Contactar al equipo de desarrollo

**Servidor corriendo en:** `http://localhost:3002`
**Base de datos:** MongoDB `legal-contracts`
**Estado:** ✅ Operativo
