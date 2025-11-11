# Sugerencias Automáticas de Campos en Edición de Terceros

## Descripción General

El sistema ahora incluye **sugerencias automáticas de campos faltantes** directamente en el endpoint de obtención de terceros. Esto permite que al editar un tercero, el frontend reciba automáticamente información sobre qué campos le faltan para completar las plantillas de su tipo.

## Cómo Funciona

### Backend - Endpoint Mejorado

**Endpoint:** `GET /api/suppliers/:id?includeSuggestions=true`

Cuando se solicita un tercero con el parámetro `includeSuggestions=true`, el endpoint:

1. Obtiene el tercero normalmente
2. Identifica todos los campos actuales del tercero (estándar + custom_fields)
3. Busca todas las plantillas activas que usan el tipo de tercero
4. Para cada plantilla, compara los campos requeridos con los campos actuales
5. Calcula el porcentaje de completitud
6. Retorna las sugerencias junto con los datos del tercero

### Respuesta del Endpoint

```json
{
  "success": true,
  "supplier": {
    "_id": "...",
    "legal_name": "Propiedad Horizontal Los Alamos",
    "third_party_type": {
      "code": "propiedad_horizontal",
      "label": "Propiedad Horizontal"
    },
    "custom_fields": {
      "razon_social": "PH Los Alamos",
      "email": "ph@example.com"
    }
  },
  "field_suggestions": {
    "current_fields": [
      "razon_social",
      "email",
      "telefono",
      "direccion"
    ],
    "templates_analyzed": 3,
    "templates_needing_fields": 2,
    "suggestions": [
      {
        "template_id": "abc123",
        "template_name": "Contrato PH - Administración",
        "template_category": "Administración",
        "completion_percentage": 75,
        "missing_fields": [
          {
            "field_name": "licenciatario",
            "field_label": "Nombre del Licenciatario",
            "field_type": "text",
            "required": true,
            "description": "Campo requerido por la plantilla Contrato PH - Administración"
          },
          {
            "field_name": "banco",
            "field_label": "Banco",
            "field_type": "text",
            "required": false,
            "description": "Campo requerido por la plantilla Contrato PH - Administración"
          }
        ],
        "matched_fields": [
          {
            "field_name": "razon_social",
            "field_label": "Razón Social"
          },
          {
            "field_name": "email",
            "field_label": "Email"
          }
        ]
      }
    ]
  }
}
```

## Ventajas de Esta Implementación

### 1. Automático y Contextual
- Las sugerencias se generan automáticamente basándose en las plantillas reales de la empresa
- Solo muestra campos que realmente se necesitan
- Se adapta dinámicamente cuando se crean/modifican plantillas

### 2. Filtrado Inteligente por Tipo de Tercero
- Solo analiza plantillas que usan el tipo de tercero específico
- Evita sugerencias irrelevantes
- Mantiene la relación tipo-plantilla coherente

### 3. Matching Flexible de Campos
- Normaliza nombres de campos (sin acentos, espacios, mayúsculas)
- Detecta coincidencias parciales ("razon_social" coincide con "razon social corta")
- Previene duplicados y falsos negativos

### 4. Porcentaje de Completitud
- Muestra visualmente qué tan completo está el tercero para cada plantilla
- Ayuda a priorizar qué campos agregar primero
- Ordenado por completitud (más completos primero)

### 5. No Invasivo
- Solo se activa con `includeSuggestions=true`
- No afecta el rendimiento cuando no se necesita
- Si hay error en sugerencias, no falla la petición principal

## Integración con Frontend

### Opción 1: Cargar Sugerencias Automáticamente al Editar

```typescript
// En Suppliers.tsx o componente de edición
const fetchSupplierWithSuggestions = async (supplierId: string) => {
  try {
    const token = localStorage.getItem('token');
    const response = await axios.get(
      `http://localhost:3002/api/suppliers/${supplierId}?includeSuggestions=true`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    setSupplier(response.data.supplier);

    if (response.data.field_suggestions) {
      setFieldSuggestions(response.data.field_suggestions);
      setShowSuggestions(response.data.field_suggestions.templates_needing_fields > 0);
    }
  } catch (error) {
    console.error('Error al cargar tercero:', error);
  }
};
```

### Opción 2: Usar el Componente de Sugerencias Independiente

Si prefieres mantener las sugerencias como una feature separada, puedes seguir usando el componente `SupplierFieldSuggestions` del archivo `IMPLEMENTAR_SUGERENCIAS_CAMPOS.md`.

### Opción 3: Combinación Híbrida (Recomendado)

```typescript
// Al abrir el modal de edición:
const handleEditSupplier = async (supplierId: string) => {
  setEditMode(true);

  // Cargar datos básicos sin sugerencias (más rápido)
  await fetchSupplier(supplierId);

  // Cargar sugerencias en segundo plano
  fetchSuggestionsInBackground(supplierId);
};

const fetchSuggestionsInBackground = async (supplierId: string) => {
  try {
    const token = localStorage.getItem('token');
    const response = await axios.get(
      `http://localhost:3002/api/suppliers/${supplierId}?includeSuggestions=true`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (response.data.field_suggestions?.templates_needing_fields > 0) {
      setFieldSuggestions(response.data.field_suggestions);
      // Mostrar badge o notificación de campos faltantes
      setShowSuggestionsBadge(true);
    }
  } catch (error) {
    console.error('Error al cargar sugerencias:', error);
  }
};
```

## Ejemplo de UI Sugerida

```tsx
{editingSupplier && (
  <div className="supplier-edit-form">
    {/* Formulario normal de edición */}
    <SupplierEditForm supplier={editingSupplier} />

    {/* Sección de sugerencias (solo si hay campos faltantes) */}
    {fieldSuggestions?.templates_needing_fields > 0 && (
      <div className="suggestions-panel">
        <div className="suggestions-header">
          <h3>📋 Campos Recomendados</h3>
          <p>
            Este tercero le faltan {fieldSuggestions.templates_needing_fields} campos
            para completar {fieldSuggestions.templates_analyzed} plantillas disponibles
          </p>
        </div>

        {fieldSuggestions.suggestions.map(template => (
          <div key={template.template_id} className="template-suggestion-card">
            <div className="template-info">
              <h4>{template.template_name}</h4>
              <span className="category-badge">{template.template_category}</span>
              <div className="completion-bar">
                <div
                  className="completion-fill"
                  style={{ width: `${template.completion_percentage}%` }}
                />
                <span>{template.completion_percentage}% completo</span>
              </div>
            </div>

            <div className="missing-fields">
              {template.missing_fields.map(field => (
                <div key={field.field_name} className="missing-field">
                  <label>
                    <input
                      type="checkbox"
                      onChange={(e) => handleFieldSelection(field, e.target.checked)}
                    />
                    {field.field_label}
                    {field.required && <span className="required">*</span>}
                  </label>

                  <input
                    type={field.field_type}
                    placeholder={`Ingrese ${field.field_label}`}
                    onChange={(e) => handleFieldValueChange(field.field_name, e.target.value)}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}

        <button onClick={handleAddSelectedFields}>
          Agregar Campos Seleccionados
        </button>
      </div>
    )}
  </div>
)}
```

## Flujo Completo de Usuario

1. **Usuario abre edición de tercero**
   - Sistema carga datos básicos inmediatamente
   - En segundo plano, analiza plantillas y genera sugerencias

2. **Si hay campos faltantes**
   - Muestra panel de sugerencias con plantillas agrupadas
   - Cada plantilla muestra porcentaje de completitud
   - Campos faltantes listados con descripción

3. **Usuario selecciona campos**
   - Checkbox para seleccionar múltiples campos
   - Input para ingresar valor de cada campo
   - Validación según tipo de campo

4. **Usuario guarda**
   - Campos se agregan a `custom_fields` del tercero
   - Sugerencias se actualizan automáticamente
   - Si ya no faltan campos, el panel desaparece

## Casos de Uso Específicos

### Caso 1: Tercero Nuevo con Datos Mínimos
```
Usuario crea tercero "PH Los Alamos" con solo nombre y NIT.
→ Al editar, ve que necesita 8 campos adicionales para 3 plantillas.
→ Agrega licenciatario, email, teléfono.
→ Ahora solo le faltan 5 campos para 2 plantillas.
```

### Caso 2: Plantilla Nueva que Requiere Campos Adicionales
```
Admin crea nueva plantilla "Contrato PH - Seguro" que requiere campos de póliza.
→ Terceros existentes automáticamente muestran estos nuevos campos como faltantes.
→ No se requiere migración manual.
```

### Caso 3: Tipo de Tercero con Múltiples Plantillas
```
Tipo "Proveedor" tiene 5 plantillas diferentes.
→ Sistema analiza las 5 y muestra solo campos únicos faltantes.
→ Evita duplicados entre plantillas.
→ Prioriza campos requeridos.
```

## Diferencias con el Sistema de Sugerencias Independiente

| Aspecto | Endpoint Integrado | Componente Independiente |
|---------|-------------------|-------------------------|
| **Cuándo se usa** | Al cargar tercero para edición | Llamada separada cuando usuario quiere sugerencias |
| **Rendimiento** | Opcional con query param | Siempre se ejecuta al llamar |
| **Datos retornados** | Supplier + suggestions en una llamada | Solo suggestions |
| **Casos de uso** | Edición normal con hints automáticos | Análisis detallado bajo demanda |
| **Complejidad frontend** | Más simple (1 llamada) | Más control (2 llamadas) |

## Recomendación de Implementación

**Usa el endpoint integrado** (`?includeSuggestions=true`) cuando:
- Quieres sugerencias automáticas siempre que se edita
- Prefieres simplicidad en el frontend
- Las sugerencias son parte esencial de la UX de edición

**Usa el componente independiente** cuando:
- Las sugerencias son una feature "premium" u opcional
- Quieres control granular sobre cuándo cargar sugerencias
- Necesitas análisis más profundo con estadísticas adicionales

**Usa ambos** cuando:
- Carga básica usa endpoint sin sugerencias (rápido)
- Botón "Ver sugerencias" usa componente independiente (bajo demanda)
- Mejor balance entre rendimiento y features

## Testing

```bash
# Obtener tercero SIN sugerencias (normal)
curl -H "Authorization: Bearer TOKEN" \
  http://localhost:3002/api/suppliers/SUPPLIER_ID

# Obtener tercero CON sugerencias automáticas
curl -H "Authorization: Bearer TOKEN" \
  "http://localhost:3002/api/suppliers/SUPPLIER_ID?includeSuggestions=true"
```

## Archivos Modificados

- `/backend/routes/suppliers.js` (líneas 153-306)
  - Endpoint GET `/:id` mejorado
  - Funciones auxiliares `fieldsMatch()` y `normalizeFieldName()`
  - Análisis automático de plantillas cuando `includeSuggestions=true`

## Próximos Pasos Opcionales

- [ ] Caché de sugerencias para mejor rendimiento
- [ ] Webhook para notificar cuando plantillas cambian
- [ ] Análisis de tendencias (campos más faltantes en todos los terceros)
- [ ] Sugerencias de valores basadas en otros terceros similares
- [ ] Exportar reporte de completitud de todos los terceros
