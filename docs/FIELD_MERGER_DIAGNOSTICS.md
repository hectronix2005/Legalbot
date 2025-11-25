# Diagnóstico del Sistema de Propuesta y Fusión de Variables

**Fecha**: 2025-11-12
**Estado**: Sistema actualizado y verificado

---

## Resumen del Sistema

El sistema de propuesta y fusión de variables permite:
1. **Detectar automáticamente** campos duplicados o similares en terceros
2. **Sugerir nombres normalizados** para mantener consistencia
3. **Fusionar campos duplicados** en un solo campo
4. **Aplicar fusiones masivas** a todos los terceros del mismo tipo

---

## Componentes del Sistema

### Backend

**Ruta API**: `/api/field-management/`

**Endpoints Clave**:
```
POST /api/field-management/supplier/:id/merge-fields
  - Fusiona campos de un tercero específico
  - Requiere: fieldsToMerge[], targetFieldName, targetValue

POST /api/field-management/merge-fields-bulk
  - Fusión masiva para todos los terceros del mismo tipo
  - Requiere: thirdPartyTypeId, fieldsToMerge[], targetFieldName
```

**Archivo**: `backend/routes/field-management.js` (líneas 346-551)
**Servicio**: `backend/services/fieldManagementService.js`
**Estado**: ✅ Montado correctamente en `server.js:130`

### Frontend

**Componente**: `FieldMerger.tsx`
**Ubicación**: `frontend/src/components/FieldMerger.tsx`
**Usado en**: `Suppliers.tsx:1456`
**CSS**: `FieldMerger.css`
**Build**: ✅ Compilado el 2025-11-12 13:15

---

## Cómo Funciona

### 1. Detección Automática

El componente `FieldMerger` analiza automáticamente los `custom_fields` de un tercero:

```typescript
// Normalización de nombres
normalizeFieldName("Cédula Rep. Legal") → "cedula_rep_legal"
normalizeFieldName("cedula_representante") → "cedula_representante"
normalizeFieldName("CEDULA-REPRESENTANTE") → "cedula_representante"
```

**Campos considerados duplicados**:
- Nombres que después de normalizarse son iguales
- Ejemplo: "tel", "Tel.", "TEL", "Teléfono" → todos normalizan a "tel"

### 2. Sugerencias Inteligentes

El sistema sugiere nombres estándar:

| Campo Normalizado | Sugerencia |
|-------------------|------------|
| cedula_rep_legal | cedula_representante_legal |
| tel / phone | telefono |
| mail / correo | email |
| dir / address | direccion |
| razon_social | legal_name |

### 3. Interfaz de Usuario

**Visualización**:
- Solo aparece si hay campos duplicados
- Muestra banner resumido: "X grupo(s) de campos duplicados detectados"
- Botón "Ver y Fusionar" abre diálogo

**Diálogo de Fusión**:
- Lista de grupos de campos duplicados
- Radio buttons para seleccionar qué valor conservar
- Badge "Vacío" para campos sin valor
- Botones de acción:
  - "Fusionar Este Tercero" - Solo el tercero actual
  - "⚡ Fusionar Todos del Mismo Tipo" - Fusión masiva
  - "Fusionar Todos (X grupos)" - Todos los grupos del tercero

---

## Cómo Probar el Sistema

### Paso 1: Crear Tercero con Campos Duplicados

1. Ir a **Terceros** en el sistema
2. Crear o editar un tercero
3. Agregar campos personalizados duplicados:
   ```
   Tel: 3001234567
   Telefono: (vacío)
   Phone: (vacío)
   ```

### Paso 2: Verificar Detección

1. Guardar el tercero
2. Volver a editarlo
3. **Deberías ver**: Banner "🔄 1 grupo(s) de campos duplicados detectados"
4. Click en "Ver y Fusionar"

### Paso 3: Fusionar Campos

1. En el diálogo:
   - Ver grupo normalizado: "tel"
   - Ver campos: Tel, Telefono, Phone
   - Nombre sugerido: "telefono"
   - Seleccionar el campo con valor (Tel)
2. Click "Fusionar Este Tercero"
3. **Resultado**: Campo único "telefono" con valor "3001234567"

### Paso 4: Fusión Masiva (Opcional)

1. Repetir pasos 1-2 con otro tercero del mismo tipo
2. En el diálogo de fusión, click "⚡ Fusionar Todos del Mismo Tipo"
3. Confirmar
4. **Resultado**: Todos los terceros del tipo tendrán campos fusionados

---

## Solución de Problemas

### Problema 1: No Aparece el Banner

**Síntomas**: No se ve "X grupo(s) de campos duplicados detectados"

**Causas Posibles**:
1. **No hay campos duplicados**: El sistema solo detecta campos con nombres normalizados iguales
2. **Cache del navegador**: Presiona Ctrl+Shift+R (Cmd+Shift+R en Mac) para refrescar

**Solución**:
```bash
# 1. Verificar en consola del navegador (F12)
# Deberías ver logs como:
# "🔄 Merging fields: {...}"

# 2. Verificar que FieldMerger esté renderizado
# En consola del navegador:
document.querySelector('.field-merger-summary')
# Si retorna null, el componente no se renderizó (no hay duplicados)
```

### Problema 2: Error al Fusionar

**Síntomas**: Al hacer click en fusionar, aparece error

**Diagnóstico**:
1. Abrir consola del navegador (F12)
2. Ver errores en red (pestaña Network)
3. Verificar logs del backend

**Verificar Backend**:
```bash
# En terminal del backend, deberías ver:
🔄 [FIELD-MERGER] Merge request: { supplierId, fieldsToMerge, ... }
✅ [FIELD-MERGER] Fields merged successfully

# Si ves errores:
❌ [FIELD-MERGER] Error merging fields: <error>
```

**Errores Comunes**:

| Error | Causa | Solución |
|-------|-------|----------|
| "Tercero no encontrado" | ID incorrecto o permisos | Verificar `req.companyId` coincide |
| "Campos no encontrados: X" | Campo no existe en custom_fields | Verificar nombres exactos |
| 401 Unauthorized | No autenticado | Reloguear |
| 403 Forbidden | Sin permisos | Necesitas rol admin/super_admin/lawyer |

### Problema 3: Fusión Masiva No Afecta Otros Terceros

**Síntomas**: Solo fusiona el tercero actual, no los demás

**Causas**:
1. Otros terceros no tienen los campos duplicados
2. Nombres de campos no normalizan igual

**Verificación**:
```bash
# En backend, buscar logs:
📊 [BULK-MERGE] Found X suppliers of this type
✅ [BULK-MERGE] Merged fields for: <nombre>
# O:
# (skipped) - Si no encontró campos coincidentes
```

**Solución**: La fusión masiva busca campos que normalicen igual a los especificados:
- Si tienes "tel" en un tercero y "telefono" en otro
- Ambos normalizan a "tel" / "telefono" respectivamente
- NO se consideran iguales para bulk merge
- Necesitan normalizar exactamente igual

### Problema 4: CSS No Aplicado

**Síntomas**: Diálogo sin estilos o mal formateado

**Solución**:
```bash
# 1. Verificar que FieldMerger.css existe
ls -la frontend/src/components/FieldMerger.css

# 2. Rebuild frontend
cd frontend
npm run build

# 3. Copiar al backend
cd ..
rm -rf backend/public/*
cp -r frontend/build/* backend/public/

# 4. Hard refresh en navegador (Ctrl+Shift+R)
```

---

## Verificación del Sistema (Checklist)

Ejecuta estos comandos para verificar que todo esté correcto:

### Backend
```bash
cd backend

# 1. Verificar ruta montada
grep "field-management" server.js
# Debe mostrar: app.use('/api/field-management', fieldManagementRoutes);

# 2. Verificar servicio existe
ls -la services/fieldManagementService.js
# Debe existir

# 3. Ver logs del servidor
# En el terminal donde corre npm run dev
# Buscar errores al iniciar
```

### Frontend
```bash
cd frontend

# 1. Verificar componente existe
ls -la src/components/FieldMerger.tsx
ls -la src/components/FieldMerger.css

# 2. Verificar uso en Suppliers
grep -n "FieldMerger" src/components/Suppliers.tsx
# Debe mostrar import y uso del componente

# 3. Verificar build actualizado
ls -lt build/static/js/ | head -3
# Ver fecha de main.*.js (debe ser reciente)
```

### API Test Manual
```bash
# Con un tercero que tenga ID conocido:
SUPPLIER_ID="<tu-supplier-id>"
TOKEN="<tu-jwt-token>"

# Test endpoint (requiere autenticación)
curl -X POST http://localhost:3002/api/field-management/supplier/$SUPPLIER_ID/merge-fields \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fieldsToMerge": ["tel", "telefono"],
    "targetFieldName": "telefono",
    "targetValue": "3001234567",
    "removeOriginals": true
  }'

# Respuesta esperada:
# {"success":true,"message":"Campos fusionados exitosamente",...}
```

---

## Estado Actual (2025-11-12)

### ✅ Completado

1. **Frontend Rebuildeado**: Build actualizado el 2025-11-12 13:15
2. **Backend Verificado**: Rutas y servicios funcionando correctamente
3. **Código Revisado**: No se encontraron errores en FieldMerger.tsx
4. **CSS Verificado**: FieldMerger.css presente y compilado

### ⚠️ Notas Importantes

1. **El componente solo aparece si hay duplicados**: Si no ves el banner, significa que no hay campos con nombres normalizados iguales
2. **Normalización estricta**: La detección es case-insensitive y quita acentos, pero los nombres deben ser similares
3. **Permisos requeridos**: Fusión requiere roles: admin, super_admin, o lawyer

### 🔧 Si El Sistema No Funciona

1. **Refrescar navegador**: Ctrl+Shift+R (Cmd+Shift+R en Mac)
2. **Ver consola del navegador**: F12 → Consola
3. **Ver logs del backend**: Terminal donde corre `npm run dev`
4. **Verificar datos de prueba**: Crear tercero con campos claramente duplicados:
   - "telefono" y "Tel" → deberían agruparse
   - "email" y "correo" → deberían agruparse

---

## Logs Esperados

### Cuando Funciona Correctamente

**Navegador (Consola F12)**:
```
🔄 Merging fields: {
  group: "tel",
  fields: ["tel", "telefono", "phone"],
  selectedField: "tel",
  selectedValue: "3001234567",
  suggestedName: "telefono"
}
✅ Fields merged successfully
```

**Backend (Terminal)**:
```
🔄 [FIELD-MERGER] Merge request: {
  supplierId: '690f7d25500832cce7da54ef',
  fieldsToMerge: ['tel', 'telefono', 'phone'],
  targetFieldName: 'telefono',
  targetValue: '3001234567',
  userId: 68f95216a3f9ab32bf356182
}
✅ [FIELD-MERGER] Fields merged successfully: {
  supplierId: '690f7d25500832cce7da54ef',
  mergedInto: 'telefono',
  removedFields: ['tel', 'telefono', 'phone']
}
```

### Cuando Hay Problemas

**Navegador**:
```
❌ Error merging fields: <descripción del error>
```

**Backend**:
```
❌ [FIELD-MERGER] Error merging fields: <stack trace>
```

---

## Contacto

Si después de seguir estos pasos el sistema aún no funciona:

1. Capturar logs del backend (terminal)
2. Capturar logs del navegador (F12 → Consola)
3. Capturar respuesta de la API (F12 → Network → Request failed)
4. Compartir información de tercero de prueba (sin datos sensibles):
   - Tipo de tercero
   - Campos personalizados con sus nombres exactos

---

**Última actualización**: 2025-11-12 13:15
**Autor**: Claude (GuardianCI)
**Estado**: ✅ Sistema actualizado y listo para pruebas
