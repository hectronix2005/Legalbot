# Implementación de Sugerencias Inteligentes de Campos para Terceros

## Objetivo
Permitir que administradores y super admin editen etiquetas de campos y reciban sugerencias inteligentes de campos faltantes al editar un tercero, basándose en las plantillas existentes.

## Archivos Ya Creados

### 1. Backend API
**Archivo:** `/backend/routes/supplier-field-suggestions.js` ✅ CREADO

Este archivo contiene 3 endpoints:

#### A. Analizar Campos Faltantes
```
GET /api/supplier-field-suggestions/:supplierId/missing-fields?templateId=xxx
```
- Analiza qué campos le faltan a un tercero para completar plantillas
- Compara campos del tercero con campos requeridos en plantillas
- Devuelve porcentaje de completitud por plantilla
- Si `templateId` se especifica, analiza solo esa plantilla

**Respuesta:**
```json
{
  "supplier": {
    "id": "...",
    "name": "Propiedad Horizontal Los Alamos",
    "type": "proveedor"
  },
  "current_fields": ["razon_social", "licenciatario", "email", ...],
  "templates_analyzed": 5,
  "templates_needing_fields": 2,
  "suggestions": [
    {
      "template_id": "...",
      "template_name": "Contrato PH",
      "template_category": "Confidencialidad",
      "completion_percentage": 75,
      "missing_fields": [
        {
          "field_name": "banco",
          "field_label": "Banco",
          "field_type": "text",
          "required": true,
          "description": "Campo requerido por la plantilla Contrato PH"
        }
      ],
      "matched_fields": [...]
    }
  ]
}
```

#### B. Sugerencias Genéricas por Tipo
```
GET /api/supplier-field-suggestions/:supplierId/field-suggestions
```
- Sugiere campos comunes según el tipo de tercero
- Filtra campos que ya tiene

**Respuesta:**
```json
{
  "supplier": {...},
  "suggested_fields": [
    {
      "name": "banco",
      "label": "Banco",
      "type": "text"
    },
    {
      "name": "cuenta_bancaria",
      "label": "Cuenta Bancaria",
      "type": "text"
    }
  ]
}
```

#### C. Agregar Campos al Tercero
```
PATCH /api/supplier-field-suggestions/:supplierId/add-fields
Body: {
  "fields": [
    { "name": "banco", "value": "Bancolombia" },
    { "name": "cuenta_bancaria", "value": "123456789" }
  ]
}
```

**Respuesta:**
```json
{
  "message": "Campos actualizados exitosamente",
  "fields_added": 2,
  "fields_updated": 0,
  "supplier": {...}
}
```

## Pasos para Implementar

### PASO 1: Registrar la Ruta en el Servidor

Editar `/backend/server.js`:

```javascript
// En la sección de imports (alrededor de la línea 102)
const supplierFieldSuggestionsRoutes = require('./routes/supplier-field-suggestions');

// En la sección de rutas (alrededor de la línea 126)
app.use('/api/supplier-field-suggestions', supplierFieldSuggestionsRoutes);
```

### PASO 2: Reiniciar el Servidor

```bash
cd backend
# Matar procesos existentes
pkill -9 -f "node.*server"
# Iniciar servidor
node server.js
```

### PASO 3: Crear Componente Frontend (Nuevo)

Crear `/frontend/src/components/SupplierFieldSuggestions.tsx`:

```typescript
import React, { useState, useEffect } from 'react';
import axios from 'axios';

interface MissingField {
  field_name: string;
  field_label: string;
  field_type: string;
  required: boolean;
  description: string;
}

interface TemplateSuggestion {
  template_id: string;
  template_name: string;
  template_category: string;
  completion_percentage: number;
  missing_fields: MissingField[];
  matched_fields: any[];
}

interface Props {
  supplierId: string;
  onFieldsAdded?: () => void;
}

export const SupplierFieldSuggestions: React.FC<Props> = ({ supplierId, onFieldsAdded }) => {
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<TemplateSuggestion[]>([]);
  const [newFieldValues, setNewFieldValues] = useState<{ [key: string]: string }>({});
  const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadSuggestions();
  }, [supplierId]);

  const loadSuggestions = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `http://localhost:3002/api/supplier-field-suggestions/${supplierId}/missing-fields`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSuggestions(response.data.suggestions || []);
    } catch (error) {
      console.error('Error cargando sugerencias:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFieldChange = (fieldName: string, value: string) => {
    setNewFieldValues(prev => ({
      ...prev,
      [fieldName]: value
    }));
  };

  const handleFieldToggle = (fieldName: string) => {
    const newSelected = new Set(selectedFields);
    if (newSelected.has(fieldName)) {
      newSelected.delete(fieldName);
    } else {
      newSelected.add(fieldName);
    }
    setSelectedFields(newSelected);
  };

  const handleAddFields = async () => {
    const fieldsToAdd = Array.from(selectedFields)
      .filter(fieldName => newFieldValues[fieldName])
      .map(fieldName => ({
        name: fieldName,
        value: newFieldValues[fieldName]
      }));

    if (fieldsToAdd.length === 0) {
      alert('Selecciona al menos un campo con valor');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.patch(
        `http://localhost:3002/api/supplier-field-suggestions/${supplierId}/add-fields`,
        { fields: fieldsToAdd },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      alert(`✅ ${fieldsToAdd.length} campos agregados exitosamente`);
      setSelectedFields(new Set());
      setNewFieldValues({});
      loadSuggestions();

      if (onFieldsAdded) {
        onFieldsAdded();
      }
    } catch (error) {
      console.error('Error agregando campos:', error);
      alert('Error al agregar campos');
    }
  };

  if (loading) {
    return <div>Cargando sugerencias...</div>;
  }

  if (suggestions.length === 0) {
    return (
      <div className="field-suggestions-empty">
        ✅ Este tercero tiene todos los campos necesarios para las plantillas actuales
      </div>
    );
  }

  return (
    <div className="field-suggestions-container">
      <h3>📋 Sugerencias de Campos Faltantes</h3>
      <p className="suggestions-intro">
        Estos campos son requeridos por las plantillas de tu empresa. Agrégalos para poder generar contratos completos.
      </p>

      {suggestions.map(template => (
        <div key={template.template_id} className="template-suggestion">
          <div className="template-header">
            <h4>{template.template_name}</h4>
            <span className="completion-badge">
              {template.completion_percentage}% completo
            </span>
          </div>

          <div className="missing-fields-list">
            {template.missing_fields.map(field => (
              <div key={field.field_name} className="missing-field-item">
                <label>
                  <input
                    type="checkbox"
                    checked={selectedFields.has(field.field_name)}
                    onChange={() => handleFieldToggle(field.field_name)}
                  />
                  <strong>{field.field_label}</strong>
                  {field.required && <span className="required-badge">Requerido</span>}
                </label>

                <input
                  type={field.field_type}
                  placeholder={`Ingrese ${field.field_label}`}
                  value={newFieldValues[field.field_name] || ''}
                  onChange={(e) => handleFieldChange(field.field_name, e.target.value)}
                  disabled={!selectedFields.has(field.field_name)}
                  className="field-input"
                />

                <small className="field-description">{field.description}</small>
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="suggestions-actions">
        <button
          onClick={handleAddFields}
          disabled={selectedFields.size === 0}
          className="btn-primary"
        >
          ➕ Agregar {selectedFields.size} Campo(s) Seleccionado(s)
        </button>

        <button onClick={loadSuggestions} className="btn-secondary">
          🔄 Recargar Sugerencias
        </button>
      </div>
    </div>
  );
};
```

### PASO 4: Integrar en el Formulario de Edición

Editar `/frontend/src/components/Suppliers.tsx` para agregar el componente de sugerencias cuando se está editando un tercero.

Buscar la sección de edición (modal o formulario) y agregar:

```typescript
import { SupplierFieldSuggestions } from './SupplierFieldSuggestions';

// Dentro del formulario de edición, después de los campos existentes:
{editingSupplier && (
  <div className="supplier-suggestions-section">
    <SupplierFieldSuggestions
      supplierId={editingSupplier._id}
      onFieldsAdded={() => {
        // Recargar el tercero para mostrar los nuevos campos
        fetchSuppliers();
      }}
    />
  </div>
)}
```

### PASO 5: Agregar Estilos CSS

Agregar a tu archivo CSS principal:

```css
.field-suggestions-container {
  margin-top: 2rem;
  padding: 1.5rem;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #dee2e6;
}

.field-suggestions-container h3 {
  margin-top: 0;
  color: #495057;
}

.suggestions-intro {
  color: #6c757d;
  margin-bottom: 1.5rem;
}

.template-suggestion {
  background: white;
  padding: 1rem;
  margin-bottom: 1rem;
  border-radius: 6px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.template-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 2px solid #e9ecef;
}

.template-header h4 {
  margin: 0;
  color: #212529;
}

.completion-badge {
  background: #28a745;
  color: white;
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.875rem;
  font-weight: 600;
}

.missing-fields-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.missing-field-item {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.75rem;
  background: #f8f9fa;
  border-radius: 4px;
}

.missing-field-item label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 500;
  cursor: pointer;
}

.missing-field-item input[type="checkbox"] {
  cursor: pointer;
}

.required-badge {
  background: #dc3545;
  color: white;
  padding: 0.125rem 0.5rem;
  border-radius: 8px;
  font-size: 0.75rem;
  margin-left: 0.5rem;
}

.field-input {
  padding: 0.5rem;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 0.875rem;
  transition: border-color 0.15s ease-in-out;
}

.field-input:focus {
  outline: none;
  border-color: #80bdff;
  box-shadow: 0 0 0 0.2rem rgba(0,123,255,.25);
}

.field-input:disabled {
  background-color: #e9ecef;
  opacity: 0.6;
}

.field-description {
  color: #6c757d;
  font-size: 0.75rem;
  font-style: italic;
}

.suggestions-actions {
  display: flex;
  gap: 1rem;
  margin-top: 1.5rem;
  padding-top: 1rem;
  border-top: 1px solid #dee2e6;
}

.field-suggestions-empty {
  padding: 2rem;
  text-align: center;
  color: #28a745;
  background: #d4edda;
  border-radius: 8px;
  border: 1px solid #c3e6cb;
}
```

### PASO 6: Rebuild del Frontend

```bash
cd frontend
npm run build
cd ..
cp -r frontend/build backend/public
```

## Funcionalidades Implementadas

1. **Análisis Inteligente:** Compara campos del tercero con plantillas y muestra qué falta
2. **Matching Flexible:** Usa normalización para encontrar coincidencias (ignora acentos, espacios, etc.)
3. **Porcentaje de Completitud:** Muestra qué tan completo está un tercero para cada plantilla
4. **Sugerencias Contextuales:** Solo muestra campos que realmente faltan
5. **Agregar Múltiples Campos:** Selecciona varios campos y agrégalos de una vez
6. **Actualización en Tiempo Real:** Recarga sugerencias después de agregar campos

## Uso

1. Editar un tercero existente
2. Scroll hasta la sección "Sugerencias de Campos Faltantes"
3. Ver qué plantillas necesitan campos adicionales
4. Seleccionar los campos que quieres agregar
5. Ingresar los valores
6. Click en "Agregar X Campo(s) Seleccionado(s)"
7. Los campos se agregan a `custom_fields` del tercero
8. Las sugerencias se actualizan automáticamente

## Testing

```bash
# 1. Ver qué campos faltan
curl -H "Authorization: Bearer TOKEN" \
  http://localhost:3002/api/supplier-field-suggestions/SUPPLIER_ID/missing-fields

# 2. Agregar campos
curl -X PATCH \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"fields": [{"name": "banco", "value": "Bancolombia"}]}' \
  http://localhost:3002/api/supplier-field-suggestions/SUPPLIER_ID/add-fields
```

## Próximos Pasos (Opcional)

- [ ] Permitir editar etiquetas (labels) de campos existentes
- [ ] Validación de datos según tipo de campo
- [ ] Autocompletado inteligente basado en otros terceros
- [ ] Exportar/Importar configuraciones de campos
- [ ] Historial de cambios en campos
