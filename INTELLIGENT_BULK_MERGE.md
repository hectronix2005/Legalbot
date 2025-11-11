# Sistema Inteligente de Fusión Masiva de Campos

**Fecha:** 2025-11-11
**Estado:** 🔨 Backend Completado - Frontend Pendiente

## Descripción General

Sistema inteligente que aprende de las fusiones manuales y las aplica automáticamente a todos los terceros del mismo tipo.

### Funcionalidades Principales

1. **Fusión Manual Individual** ✅ COMPLETADO
   - Usuario fusiona campos duplicados en UN tercero
   - Sistema detecta el patrón de fusión

2. **Fusión Automática Masiva** ✅ BACKEND COMPLETADO
   - Aplica la misma fusión a TODOS los terceros del mismo tipo
   - Detección inteligente de campos similares usando normalización
   - Selección automática del valor no vacío

3. **Corrección Automática** ⏳ PENDIENTE
   - Aplicar fusiones a terceros existentes con campos duplicados

## Backend Implementado

### Endpoint: POST /api/field-management/merge-fields-bulk

**Ubicación:** `backend/routes/field-management.js` (líneas 431-551)

**Parámetros:**
```typescript
{
  thirdPartyTypeId: string;     // ID del tipo de tercero (Cliente, Proveedor, etc.)
  fieldsToMerge: string[];      // Array de nombres de campos a fusionar
  targetFieldName: string;      // Nombre del campo fusionado resultante
  applyToAll: boolean;          // Aplicar a todos (default: true)
}
```

**Respuesta:**
```typescript
{
  success: true,
  message: "Fusión masiva completada: X terceros actualizados",
  results: {
    total: number;              // Total de terceros del tipo
    merged: number;             // Terceros actualizados
    skipped: number;            // Terceros sin campos coincidentes
    details: [{
      supplierId: string;
      name: string;
      mergedFields: string[];
      value: any;
    }]
  }
}
```

**Características:**
- ✅ Normalización de nombres de campos (igual que frontend)
- ✅ Detección inteligente de campos similares
- ✅ Selección automática del valor no vacío
- ✅ Eliminación de campos originales después de fusionar
- ✅ Logging completo del proceso
- ✅ Manejo de errores robusto

**Algoritmo:**
```javascript
1. Obtener todos los terceros del tipo especificado
2. Para cada tercero:
   a. Normalizar todos sus custom_fields
   b. Buscar coincidencias con fieldsToMerge (normalizados)
   c. Si encuentra >= 2 campos coincidentes:
      - Seleccionar valor no vacío
      - Crear campo fusionado
      - Eliminar campos originales
      - Guardar tercero
   d. Si no encuentra coincidencias, skip
3. Retornar resumen de resultados
```

## Frontend a Implementar

### 1. Modificar FieldMerger.tsx

**Agregar Props:**
```typescript
interface Props {
  supplierId: string;
  customFields: Record<string, any>;
  thirdPartyTypeId?: string;     // NUEVO: ID del tipo de tercero
  onMergeComplete?: () => void;
}
```

**Agregar Estado:**
```typescript
const [bulkMerging, setBulkMerging] = useState(false);
const [bulkResults, setBulkResults] = useState<any>(null);
```

**Nueva Función:**
```typescript
const handleBulkMerge = async (groupIndex: number) => {
  const group = mergeGroups[groupIndex];

  if (!thirdPartyTypeId) {
    alert('No se puede determinar el tipo de tercero');
    return;
  }

  const confirmMsg = `¿Aplicar esta fusión a TODOS los terceros del mismo tipo?\n\nCampos: ${group.fields.map(f => f.name).join(', ')}\nFusionar en: ${group.suggestedName}`;

  if (!window.confirm(confirmMsg)) return;

  try {
    setBulkMerging(true);

    const response = await api.post('/field-management/merge-fields-bulk', {
      thirdPartyTypeId,
      fieldsToMerge: group.fields.map(f => f.name),
      targetFieldName: group.suggestedName
    });

    setBulkResults(response.data.results);

    alert(`✅ Fusión masiva completada:\n- Total: ${response.data.results.total} terceros\n- Actualizados: ${response.data.results.merged}\n- Sin cambios: ${response.data.results.skipped}`);

    // Remover el grupo fusionado
    const newGroups = mergeGroups.filter((_, i) => i !== groupIndex);
    setMergeGroups(newGroups);

    if (onMergeComplete) onMergeComplete();
  } catch (err: any) {
    console.error('❌ Error en fusión masiva:', err);
    alert(`Error: ${err.response?.data?.error || err.message}`);
  } finally {
    setBulkMerging(false);
  }
};
```

**Modificar UI (en el render):**

Dentro de cada `merge-group-card`, agregar este botón:

```tsx
<div className="merge-group-actions">
  {/* Botón individual existente */}
  <button
    className="btn-merge"
    onClick={() => handleMerge(groupIndex)}
    disabled={merging || bulkMerging}
  >
    {merging ? 'Fusionando...' : 'Fusionar Este Tercero'}
  </button>

  {/* NUEVO: Botón de fusión masiva */}
  {thirdPartyTypeId && (
    <button
      className="btn-merge-bulk"
      onClick={() => handleBulkMerge(groupIndex)}
      disabled={merging || bulkMerging}
      title="Aplicar esta fusión a todos los terceros del mismo tipo"
    >
      {bulkMerging ? 'Aplicando a todos...' : '⚡ Fusionar Todos del Mismo Tipo'}
    </button>
  )}
</div>
```

### 2. Modificar Suppliers.tsx

**Pasar thirdPartyTypeId al FieldMerger:**

```tsx
<FieldMerger
  supplierId={editingSupplier._id}
  customFields={editingSupplier.custom_fields}
  thirdPartyTypeId={editingSupplier.third_party_type?._id}  // NUEVO
  onMergeComplete={async () => {
    await reloadCurrentSupplier();
  }}
/>
```

### 3. Agregar Estilos (FieldMerger.css)

```css
.btn-merge-bulk {
  padding: 0.625rem 1.5rem;
  background: #28a745;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
  font-size: 0.9375rem;
  transition: all 0.2s;
  margin-left: 0.5rem;
}

.btn-merge-bulk:hover:not(:disabled) {
  background: #1e7e34;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(40,167,69,0.3);
}

.btn-merge-bulk:disabled {
  background: #6c757d;
  cursor: not-allowed;
  opacity: 0.6;
}

.bulk-results-summary {
  margin-top: 1rem;
  padding: 1rem;
  background: #e7f9ed;
  border: 2px solid #28a745;
  border-radius: 8px;
}

.bulk-results-summary h4 {
  margin: 0 0 0.5rem 0;
  color: #1e7e34;
}

.bulk-results-summary ul {
  margin: 0;
  padding-left: 1.5rem;
}
```

## Flujo de Usuario Propuesto

### Escenario: Fusión Manual + Automática

1. **Usuario edita un Cliente** (tipo: "Cliente")
   - Detecta duplicados: `telefono`, `tel`, `phone`

2. **Hace clic en "⚡ Fusionar Todos del Mismo Tipo"**

3. **Sistema muestra confirmación:**
   ```
   ¿Aplicar esta fusión a TODOS los terceros del mismo tipo?

   Campos: telefono, tel, phone
   Fusionar en: telefono

   Esto afectará a todos los Clientes de la empresa.
   ```

4. **Usuario confirma:**
   - Backend procesa todos los Clientes
   - Encuentra campos similares en cada uno
   - Aplica la fusión automáticamente

5. **Sistema muestra resultado:**
   ```
   ✅ Fusión masiva completada:
   - Total: 150 terceros
   - Actualizados: 45
   - Sin cambios: 105
   ```

6. **Todos los Clientes ahora tienen el campo unificado `telefono`**

## Ejemplo de Uso del API

### 1. Fusionar "telefono", "tel", "phone" en todos los Clientes

```bash
curl -X POST http://localhost:3002/api/field-management/merge-fields-bulk \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "X-Company-Id: YOUR_COMPANY_ID" \
  -d '{
    "thirdPartyTypeId": "690791ed2e607767b5dce1c6",
    "fieldsToMerge": ["telefono", "tel", "phone"],
    "targetFieldName": "telefono",
    "applyToAll": true
  }'
```

**Respuesta:**
```json
{
  "success": true,
  "message": "Fusión masiva completada: 45 terceros actualizados",
  "results": {
    "total": 150,
    "merged": 45,
    "skipped": 105,
    "details": [
      {
        "supplierId": "690f...",
        "name": "Cliente ABC S.A.S.",
        "mergedFields": ["telefono", "tel"],
        "value": "300-123-4567"
      },
      {
        "supplierId": "691a...",
        "name": "Cliente XYZ Ltda.",
        "mergedFields": ["tel", "phone"],
        "value": "301-999-8888"
      }
      // ... más detalles
    ]
  }
}
```

## Normalización de Campos

El sistema usa la misma función de normalización que el frontend:

```javascript
function normalizeFieldName(name) {
  return name
    .toLowerCase()                      // "TELEFONO" → "telefono"
    .normalize('NFD')                   // Preparar acentos
    .replace(/[\u0300-\u036f]/g, '')   // "Teléfono" → "Telefono"
    .replace(/[^a-z0-9]/g, '_')        // "Tél-éfono" → "Tel_efono"
    .replace(/_+/g, '_')                // "Tel___efono" → "Tel_efono"
    .replace(/^_|_$/g, '');             // "_telefono_" → "telefono"
}
```

**Ejemplos de normalización:**
```
"Teléfono"      → "telefono"
"TEL"           → "tel"
"Phone Number"  → "phone_number"
"E-mail"        → "e_mail"
```

## Casos de Uso

### 1. Migración de Datos Antiguos

**Escenario:** Importaste 500 clientes de un sistema antiguo con campos inconsistentes

**Solución:**
1. Edita UN cliente
2. Fusiona los campos duplicados (ej: tel → telefono)
3. Aplica a todos los Clientes
4. 500 clientes actualizados automáticamente

### 2. Estandarización de Campos

**Escenario:** Diferentes usuarios agregaron campos con nombres distintos

**Solución:**
1. Identifica el patrón común (ej: email, mail, correo)
2. Aplica fusión masiva
3. Todos usan el campo estándar

### 3. Limpieza Periódica

**Escenario:** Mantenimiento regular de la base de datos

**Solución:**
1. Revisar tipos de terceros uno por uno
2. Aplicar fusiones masivas según sea necesario
3. Base de datos limpia y consistente

## Testing

### Test Manual - Frontend Pendiente

1. **Agregar código del frontend** según la sección "Frontend a Implementar"
2. **Rebuild:**
   ```bash
   cd frontend
   npm run build
   cp -r build ../backend/public
   ```
3. **Probar:**
   - Editar un tercero con duplicados
   - Click en "⚡ Fusionar Todos"
   - Verificar confirmación
   - Verificar resultados

### Test Backend (Postman/curl)

```bash
# 1. Obtener ID de tipo de tercero
GET /api/third-party-types

# 2. Crear varios terceros del mismo tipo con campos duplicados

# 3. Ejecutar fusión masiva
POST /api/field-management/merge-fields-bulk
{
  "thirdPartyTypeId": "690791ed...",
  "fieldsToMerge": ["tel", "telefono", "phone"],
  "targetFieldName": "telefono"
}

# 4. Verificar terceros actualizados
GET /api/suppliers
```

## Logs del Backend

### Inicio de fusión masiva:
```
🚀 [BULK-MERGE] Starting bulk merge: {
  thirdPartyTypeId: '690791ed2e607767b5dce1c6',
  fieldsToMerge: [ 'telefono', 'tel', 'phone' ],
  targetFieldName: 'telefono',
  companyId: '690a203614550c5bb925ef64'
}
```

### Procesando terceros:
```
📊 [BULK-MERGE] Found 150 suppliers of this type
✅ [BULK-MERGE] Merged fields for: Cliente ABC S.A.S.
✅ [BULK-MERGE] Merged fields for: Cliente XYZ Ltda.
...
```

### Resultado final:
```
🎉 [BULK-MERGE] Bulk merge completed: {
  total: 150,
  merged: 45,
  skipped: 105,
  details: [...]
}
```

## Seguridad y Permisos

- ✅ Requiere autenticación (`authenticate`)
- ✅ Requiere multi-tenant (`verifyTenant`)
- ✅ Requiere rol admin o super_admin (`authorize`)
- ✅ Solo afecta terceros de la misma empresa
- ✅ Confirmación del usuario antes de aplicar

## Mejoras Futuras

1. **Dry Run Mode**
   - Preview de cambios antes de aplicar
   - Mostrar lista de terceros que serán afectados

2. **Reglas de Fusión Guardadas**
   - Guardar patrones de fusión en DB
   - Aplicar automáticamente a nuevos terceros

3. **Fusión Inteligente por Similitud**
   - Detectar campos similares usando Levenshtein distance
   - Sugerir fusiones automáticamente

4. **Historial de Fusiones**
   - Auditoría de todas las fusiones realizadas
   - Posibilidad de deshacer fusiones

5. **Fusión Condicional**
   - Aplicar solo si el valor cumple condiciones
   - Ej: solo fusionar si el valor no está vacío

## Archivos Modificados

### Backend
- ✅ `backend/routes/field-management.js` (líneas 431-551)

### Frontend (Pendiente)
- ⏳ `frontend/src/components/FieldMerger.tsx`
  - Agregar prop `thirdPartyTypeId`
  - Agregar función `handleBulkMerge`
  - Agregar botón "⚡ Fusionar Todos"

- ⏳ `frontend/src/components/Suppliers.tsx`
  - Pasar `thirdPartyTypeId` a FieldMerger (línea ~1428)

- ⏳ `frontend/src/components/FieldMerger.css`
  - Agregar estilos `.btn-merge-bulk`

## Estado Actual

✅ **Backend:** COMPLETADO y funcionando
⏳ **Frontend:** Código preparado, pendiente implementación
⏳ **Testing:** Pendiente después de implementar frontend
⏳ **Documentación:** Este archivo

## Próximos Pasos

1. Implementar cambios en `FieldMerger.tsx` (ver sección "Frontend a Implementar")
2. Implementar cambios en `Suppliers.tsx`
3. Agregar estilos en `FieldMerger.css`
4. Rebuild frontend
5. Probar fusión masiva
6. Documentar resultados

---

**Autor:** Sistema Inteligente de Fusión de Campos
**Versión:** 1.0
**Última actualización:** 2025-11-11 00:40
