# Sistema de Fusión de Campos Duplicados

## Descripción General

El Sistema de Fusión de Campos Duplicados es una funcionalidad que permite identificar y fusionar campos personalizados con nombres similares o duplicados en los terceros. Esto ayuda a mantener la información organizada y evita redundancia de datos.

## Componentes Creados

### 1. Frontend

#### FieldMerger.tsx
**Ubicación:** `/frontend/src/components/FieldMerger.tsx`

**Características:**
- Detección automática de campos duplicados por normalización de nombres
- Interfaz intuitiva para seleccionar qué valor mantener
- Fusión individual o masiva de campos
- Integración completa con React y TypeScript
- Sin dependencias externas (solo React + API)

**Funcionalidades:**
1. **Análisis Automático:** Detecta campos con nombres similares al normalizar:
   - Convierte a minúsculas
   - Elimina acentos
   - Reemplaza espacios y caracteres especiales por guiones bajos

2. **Agrupación Inteligente:** Agrupa campos que se normalizan al mismo nombre:
   ```
   "cedula_rep_legal" → cedula_rep_legal
   "Cedula Rep Legal" → cedula_rep_legal
   "cédula-rep-legal" → cedula_rep_legal
   ```

3. **Sugerencias de Nombres:** Mapeo inteligente a nombres estándar:
   - `cedula_rep_legal` → `cedula_representante_legal`
   - `tel` → `telefono`
   - `mail` → `email`
   - Y más...

4. **Selección de Valores:**
   - Interfaz con radio buttons
   - Selecciona automáticamente el valor no vacío
   - Permite elegir manualmente cualquier valor

5. **Fusión:**
   - Individual: Fusionar un grupo a la vez
   - Masiva: Fusionar todos los grupos detectados
   - Confirmación antes de fusionar múltiples campos

#### FieldMerger.css
**Ubicación:** `/frontend/src/components/FieldMerger.css`

**Características:**
- Diseño moderno y profesional
- Totalmente responsivo
- Animaciones suaves
- Colores por estado (amarillo para duplicados)
- Compatible con el diseño existente

### 2. Backend

#### Endpoint: POST /api/field-management/supplier/:id/merge-fields
**Ubicación:** `/backend/routes/field-management.js` (líneas 345-429)

**Parámetros:**
```typescript
{
  fieldsToMerge: string[];         // Array de nombres de campos a fusionar
  targetFieldName: string;         // Nombre del campo fusionado resultante
  targetValue: any;                // Valor del campo fusionado
  removeOriginals?: boolean;       // Si eliminar los campos originales (default: true)
}
```

**Respuesta:**
```typescript
{
  success: boolean;
  message: string;
  result: {
    mergedFields: string[];        // Campos que fueron fusionados
    targetFieldName: string;       // Nombre del campo resultante
    targetValue: any;              // Valor guardado
    fieldsRemoved: boolean;        // Si se eliminaron los originales
    totalFieldsNow: number;        // Total de campos después de fusionar
  }
}
```

**Validaciones:**
- Verifica que el tercero existe y pertenece a la empresa
- Valida que se proporcionen al menos 2 campos para fusionar
- Verifica que todos los campos a fusionar existen
- Requiere permisos: admin, super_admin, o lawyer

**Seguridad:**
- Usa middleware `authenticate` para JWT
- Usa middleware `verifyTenant` para multi-tenant
- Usa middleware `authorize` para roles específicos
- Valida pertenencia del tercero a la empresa

## Integración en Suppliers.tsx

El componente se integró en el formulario de edición de terceros:

**Línea 5:** Import del componente
```typescript
import FieldMerger from './FieldMerger';
```

**Líneas 1389-1400:** Renderizado en el modal
```typescript
{/* Fusionador de Campos Duplicados */}
{editingSupplier._id && editingSupplier.custom_fields && Object.keys(editingSupplier.custom_fields).length > 0 && (
  <div className="form-section" style={{ marginTop: '1rem' }}>
    <FieldMerger
      supplierId={editingSupplier._id}
      customFields={editingSupplier.custom_fields}
      onMergeComplete={() => {
        fetchSuppliers();
      }}
    />
  </div>
)}
```

## Flujo de Usuario

### 1. Detección Automática

Cuando el usuario edita un tercero que tiene campos duplicados:

```
┌─────────────────────────────────────────────────────┐
│ 🔄 2 grupo(s) de campos duplicados detectados      │
│                                      [Ver y Fusionar]│
└─────────────────────────────────────────────────────┘
```

### 2. Visualización de Duplicados

Al hacer clic en "Ver y Fusionar":

```
┌─────────────────────────────────────────────────────┐
│                 Fusionar Campos Duplicados         ×│
├─────────────────────────────────────────────────────┤
│ ⚠️ Campos duplicados detectados                     │
│ Se encontraron campos con nombres similares...      │
├─────────────────────────────────────────────────────┤
│ Grupo: cedula_rep_legal             [2 campos]      │
│ Nombre sugerido: cedula_representante_legal         │
│                                                      │
│ ○ cedula_rep_legal                                  │
│   Valor: 123456789                                  │
│                                                      │
│ ● Cedula Rep Legal                                  │
│   Valor: 987654321                                  │
│                                      [Fusionar Campos]│
├─────────────────────────────────────────────────────┤
│ Grupo: telefono                     [3 campos]      │
│ Nombre sugerido: telefono                           │
│                                                      │
│ ● telefono          [Vacío]                         │
│   Valor: (vacío)                                    │
│                                                      │
│ ○ tel                                               │
│   Valor: 3001234567                                 │
│                                                      │
│ ○ phone                                             │
│   Valor: 3007654321                                 │
│                                      [Fusionar Campos]│
├─────────────────────────────────────────────────────┤
│         [Fusionar Todos (2 grupos)]                 │
└─────────────────────────────────────────────────────┘
```

### 3. Selección y Fusión

1. Usuario selecciona el radio button del valor que desea mantener
2. Click en "Fusionar Campos" para fusionar ese grupo
3. O click en "Fusionar Todos" para fusionar todos los grupos
4. Confirmación de éxito
5. Los campos se actualizan automáticamente

## Ejemplos de Uso

### Ejemplo 1: Fusionar campos de cédula

**Antes:**
```javascript
custom_fields: {
  "cedula_rep_legal": "123456789",
  "Cedula Rep Legal": "",
  "cédula-representante": "987654321"
}
```

**Después de fusionar:**
```javascript
custom_fields: {
  "cedula_representante_legal": "987654321"
}
```

### Ejemplo 2: Fusionar campos de teléfono

**Antes:**
```javascript
custom_fields: {
  "tel": "3001234567",
  "telefono": "",
  "phone": "3007654321"
}
```

**Después de fusionar:**
```javascript
custom_fields: {
  "telefono": "3001234567"
}
```

## API Request Example

```bash
curl -X POST http://localhost:3002/api/field-management/supplier/SUPPLIER_ID/merge-fields \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "X-Company-Id: YOUR_COMPANY_ID" \
  -d '{
    "fieldsToMerge": ["cedula_rep_legal", "Cedula Rep Legal"],
    "targetFieldName": "cedula_representante_legal",
    "targetValue": "123456789",
    "removeOriginals": true
  }'
```

**Respuesta:**
```json
{
  "success": true,
  "message": "Campos fusionados exitosamente",
  "result": {
    "mergedFields": ["cedula_rep_legal", "Cedula Rep Legal"],
    "targetFieldName": "cedula_representante_legal",
    "targetValue": "123456789",
    "fieldsRemoved": true,
    "totalFieldsNow": 15
  }
}
```

## Algoritmo de Normalización

```javascript
function normalizeFieldName(name: string): string {
  return name
    .toLowerCase()                      // "CEDULA" → "cedula"
    .normalize('NFD')                   // Preparar para quitar acentos
    .replace(/[\u0300-\u036f]/g, '')   // "é" → "e"
    .replace(/[^a-z0-9]/g, '_')        // " " → "_", "-" → "_"
    .replace(/_+/g, '_')                // "___" → "_"
    .replace(/^_|_$/g, '');             // Quitar _ al inicio/fin
}

// Ejemplos:
normalizeFieldName("Cédula Rep. Legal")  // "cedula_rep_legal"
normalizeFieldName("TELEFONO")           // "telefono"
normalizeFieldName("E-mail Address")     // "e_mail_address"
```

## Beneficios

1. **Organización:** Mantiene los datos ordenados y sin duplicados
2. **Eficiencia:** Reduce redundancia en la base de datos
3. **Consistencia:** Estandariza nombres de campos
4. **Usabilidad:** Interfaz intuitiva sin conocimiento técnico requerido
5. **Automatización:** Detección automática de duplicados
6. **Flexibilidad:** Permite fusión individual o masiva

## Casos de Uso

### 1. Migración de Datos Antiguos
Si importaste terceros de un sistema antiguo con diferentes convenciones de nombres.

### 2. Entrada Manual Inconsistente
Usuarios que agregaron campos manualmente con diferentes nombres.

### 3. Limpieza Periódica
Mantenimiento regular para eliminar campos duplicados acumulados.

### 4. Estandarización
Normalizar todos los campos a una convención única.

## Testing

### Manual Testing

1. **Crear tercero con campos duplicados:**
   - Agregar campo "telefono" = "3001234567"
   - Agregar campo "tel" = ""
   - Agregar campo "phone" = "3007654321"

2. **Editar el tercero:**
   - Debe aparecer banner amarillo: "3 grupo(s) de campos duplicados detectados"

3. **Click en "Ver y Fusionar":**
   - Debe abrir diálogo modal
   - Debe mostrar grupo "telefono" con 3 campos
   - Debe tener seleccionado el campo con valor no vacío

4. **Fusionar:**
   - Seleccionar valor deseado
   - Click en "Fusionar Campos"
   - Debe mostrar confirmación
   - El tercero debe actualizarse automáticamente

### Backend Testing

```bash
# 1. Verificar que endpoint existe
curl -X GET http://localhost:3002/api/field-management/stats \
  -H "Authorization: Bearer TOKEN" \
  -H "X-Company-Id: COMPANY_ID"

# 2. Probar fusión
curl -X POST http://localhost:3002/api/field-management/supplier/SUPPLIER_ID/merge-fields \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -H "X-Company-Id: COMPANY_ID" \
  -d '{"fieldsToMerge": ["tel", "phone"], "targetFieldName": "telefono", "targetValue": "3001234567"}'
```

## Logs y Debugging

### Frontend Logs

```
🔄 Merging fields: {
  group: "cedula_rep_legal",
  fields: ["cedula_rep_legal", "Cedula Rep Legal"],
  selectedField: "cedula_rep_legal",
  selectedValue: "123456789",
  suggestedName: "cedula_representante_legal"
}
✅ Fields merged successfully
```

### Backend Logs

```
🔄 [FIELD-MERGER] Merge request: {
  supplierId: '690f7d25500832cce7da54ef',
  fieldsToMerge: ['cedula_rep_legal', 'Cedula Rep Legal'],
  targetFieldName: 'cedula_representante_legal',
  targetValue: '123456789',
  removeOriginals: true,
  userId: '690a...'
}
✅ [FIELD-MERGER] Fields merged successfully: {
  supplierId: '690f7d25500832cce7da54ef',
  mergedInto: 'cedula_representante_legal',
  removedFields: ['cedula_rep_legal', 'Cedula Rep Legal']
}
```

## Archivos del Sistema

```
Legalbot/
├── frontend/src/components/
│   ├── FieldMerger.tsx           (320 líneas) - Componente principal
│   ├── FieldMerger.css           (430 líneas) - Estilos
│   └── Suppliers.tsx             (modificado) - Integración
│
└── backend/routes/
    └── field-management.js       (modificado) - Endpoint de fusión
```

## Estado del Sistema

### Frontend
- ✅ FieldMerger.tsx creado
- ✅ FieldMerger.css creado
- ✅ Integrado en Suppliers.tsx
- ✅ TypeScript interfaces definidas
- ✅ Manejo de errores implementado
- ⚠️ Pendiente build para deploy

### Backend
- ✅ Endpoint POST /merge-fields creado
- ✅ Validaciones implementadas
- ✅ Multi-tenant seguro
- ✅ Logs de debugging
- ✅ Servidor corriendo en puerto 3002

## Próximos Pasos

### Para Desarrollo
1. Compilar frontend: `npm run build`
2. Copiar build a `/backend/public/`
3. Probar en navegador

### Para Testing
1. Crear terceros con campos duplicados
2. Probar detección automática
3. Probar fusión individual
4. Probar fusión masiva
5. Verificar actualización automática

### Para Deploy
1. Build del frontend
2. Copiar a producción
3. Reiniciar backend
4. Verificar en producción

## Notas Técnicas

- **Compatibilidad:** React 17+, TypeScript 4+
- **Navegadores:** Chrome, Firefox, Safari, Edge (últimas 2 versiones)
- **Performance:** Análisis de campos O(n) donde n = número de campos
- **Memoria:** Ligero, solo mantiene estado de grupos duplicados
- **Red:** Solo hace request al fusionar, no en análisis

## Soporte

Si encuentras problemas:
1. Verificar logs en DevTools Console (F12)
2. Verificar logs del backend
3. Verificar que el tercero tiene `custom_fields`
4. Verificar permisos del usuario (admin, super_admin, lawyer)

---

**Fecha de creación:** 2025-11-11
**Versión:** 1.0
**Estado:** ✅ FUNCIONAL - Pendiente testing en UI
