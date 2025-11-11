# Integración del Panel de Sugerencias de Campos

## Componente Creado

Se ha creado el componente `FieldSuggestionsPanel.tsx` en `/frontend/src/components/`

Este componente muestra:
- ✅ Porcentaje de completitud del tercero con barra de progreso
- ✅ Estadísticas: campos requeridos, completos y faltantes
- ✅ Lista detallada de campos faltantes con plantillas donde se necesitan
- ✅ Botones para agregar campos individuales o múltiples
- ✅ Accordion con campos actuales del tercero
- ✅ Alerts visuales según el estado de completitud

## Cómo Integrar en el Modal de Edición

### Opción 1: Agregar dentro del Modal Existente (Recomendado)

Edita `/frontend/src/components/Suppliers.tsx`:

**1. Importa el componente al inicio del archivo:**

```typescript
import FieldSuggestionsPanel from './FieldSuggestionsPanel';
```

**2. Busca la línea 1057 donde dice `<div className="modal-content">` dentro del modal de edición**

**3. Agrega una nueva sección DESPUÉS de los botones del formulario pero ANTES de cerrar el modal:**

```typescript
{/* Modal para editar tercero */}
{showEditModal && editingSupplier && (
  <div className="modal-overlay">
    <div className="modal modal-large">
      <h3>Editar Tercero</h3>

      <div className="modal-content">
        {/* ... Formulario existente ... */}

        {/* AGREGAR ESTA SECCIÓN AQUÍ */}
        {editingSupplier._id && (
          <div className="form-section" style={{ marginTop: '2rem', borderTop: '2px solid #e0e0e0', paddingTop: '2rem' }}>
            <h4>Sugerencias de Campos</h4>
            <FieldSuggestionsPanel
              supplierId={editingSupplier._id}
              onFieldsAdded={() => {
                // Recargar la lista de terceros cuando se agreguen campos
                fetchSuppliers();
              }}
            />
          </div>
        )}
        {/* FIN DE LA SECCIÓN */}

        {/* Botones del modal */}
        <div className="modal-actions">
          {/* ... botones existentes ... */}
        </div>
      </div>
    </div>
  </div>
)}
```

### Opción 2: Como Tab/Pestaña Separada

Si prefieres tenerlo como pestaña separada, necesitarás:

1. Instalar un componente de tabs (o usar HTML/CSS nativo)
2. Crear dos pestañas: "Datos Básicos" y "Sugerencias"
3. Poner el formulario en la primera pestaña
4. Poner el `FieldSuggestionsPanel` en la segunda pestaña

### Opción 3: Como Modal Independiente

Agregar un botón en la tabla de terceros que abra un modal solo para sugerencias:

```typescript
// En la tabla de terceros, agregar botón
<button
  className="action-button"
  onClick={() => {
    setSelectedSupplierId(supplier._id);
    setShowSuggestionsModal(true);
  }}
  title="Ver sugerencias de campos"
>
  💡 Sugerencias
</button>

// Luego agregar el modal
{showSuggestionsModal && selectedSupplierId && (
  <div className="modal-overlay">
    <div className="modal modal-large">
      <h3>Sugerencias de Campos</h3>
      <FieldSuggestionsPanel
        supplierId={selectedSupplierId}
        onFieldsAdded={() => fetchSuppliers()}
      />
      <div className="modal-actions">
        <button
          className="cancel-button"
          onClick={() => setShowSuggestionsModal(false)}
        >
          Cerrar
        </button>
      </div>
    </div>
  </div>
)}
```

## Requisitos

### Dependencias Necesarias

El componente usa Material-UI. Si no está instalado:

```bash
cd frontend
npm install @mui/material @mui/icons-material @emotion/react @emotion/styled
```

### Variable de Entorno

Asegúrate de tener configurada la variable de entorno:

```
REACT_APP_API_URL=http://localhost:3002
```

O el componente usará `http://localhost:3002` por defecto.

## Características del Componente

### 1. Barra de Completitud Visual

```
━━━━━━━━━━━━━━━━━━━━━━━━ 41%
```

Con colores según el porcentaje:
- Verde: ≥ 80%
- Amarillo: 50-79%
- Rojo: < 50%

### 2. Estadísticas en Tarjetas

```
┌──────────────┬──────────────┬──────────────┐
│   Campos     │    Campos    │    Campos    │
│  requeridos  │   completos  │   faltantes  │
│      22      │       9      │      13      │
└──────────────┴──────────────┴──────────────┘
```

### 3. Lista de Campos Faltantes

Para cada campo muestra:
- ⚠️  Icono (rojo si requerido, azul si opcional)
- Nombre legible del campo
- Chip "Requerido" si aplica
- Nombre técnico del campo (`nombre_del_licenciatario`)
- Tipo de dato (text, email, number, etc.)
- Lista de plantillas donde se necesita (hasta 3 + contador)
- Botón "Agregar" para agregar el campo directamente

### 4. Dialog de Agregar Campo

Al hacer clic en "Agregar":
- Abre un dialog modal
- Muestra el nombre del campo
- Lista las plantillas donde se usa
- Input con validación según el tipo
- Botones Cancelar/Guardar

### 5. Accordion con Campos Actuales

Lista colapsable que muestra:
- ✅ Todos los campos que ya tiene el tercero
- Valor actual de cada campo
- Fuente: "Campo estándar" o "Campo personalizado"
- Campo original del modelo si aplica

### 6. Recarga Automática

Después de agregar campos:
- ✅ Recarga el análisis automáticamente
- ✅ Actualiza el porcentaje de completitud
- ✅ Remueve los campos agregados de "Faltantes"
- ✅ Los agrega a "Campos Actuales"
- ✅ Llama al callback `onFieldsAdded()` para refrescar la lista principal

## Flujo de Usuario

1. Usuario abre editar tercero
2. Ve inmediatamente el porcentaje de completitud
3. Scroll down hasta "Sugerencias de Campos"
4. Ve que le faltan X campos
5. Click en "Agregar" en un campo faltante
6. Se abre dialog con input
7. Ingresa el valor
8. Click en "Guardar"
9. Campo se guarda en backend
10. Panel se recarga mostrando nuevo porcentaje
11. Campo desaparece de "Faltantes" y aparece en "Actuales"

## Estilos

El componente usa Material-UI por lo que tiene un diseño moderno y responsivo automáticamente. No necesita CSS adicional.

Si quieres personalizarlo, puedes usar el prop `sx` de Material-UI:

```typescript
<FieldSuggestionsPanel
  supplierId={supplierId}
  sx={{
    '& .MuiCard-root': {
      boxShadow: 3
    }
  }}
/>
```

## Manejo de Errores

El componente maneja automáticamente:
- ✅ Error de red/timeout
- ✅ Error 404 (tercero no encontrado)
- ✅ Error 401 (no autenticado)
- ✅ Tercero sin tipo asignado
- ✅ Loading states con spinners
- ✅ Estados vacíos (tercero 100% completo)

## Testing Rápido

Para probar el componente sin integrarlo todavía, puedes crear una página de prueba:

```typescript
// /frontend/src/pages/TestSuggestions.tsx
import React from 'react';
import FieldSuggestionsPanel from '../components/FieldSuggestionsPanel';

const TestSuggestions: React.FC = () => {
  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <h1>Test - Panel de Sugerencias</h1>
      <FieldSuggestionsPanel
        supplierId="690817ce2e607767b5dce28c" // ID del tercero Lucitania PH
        onFieldsAdded={() => console.log('Campos agregados')}
      />
    </div>
  );
};

export default TestSuggestions;
```

Luego agregar la ruta en tu router y navegar a `/test-suggestions`.

## Próximos Pasos

1. ✅ Componente creado y documentado
2. ⚠️  Integrar en modal de edición de Suppliers.tsx
3. ⚠️  Rebuild del frontend
4. ⚠️  Deploy
5. ⚠️  Testing con usuarios reales

## Notas Importantes

- El componente es completamente independiente y reutilizable
- Solo necesita el `supplierId` para funcionar
- El callback `onFieldsAdded` es opcional
- Si el backend no está corriendo, mostrará error elegantemente
- Compatible con el sistema de autenticación existente (usa localStorage token)
- Funciona con el endpoint `/api/field-management/supplier/:id/analysis` que ya está operativo

## Soporte

Si tienes problemas:
1. Verifica que el backend esté corriendo en puerto 3002
2. Verifica que el tercero tenga un `third_party_type` asignado
3. Abre la consola del navegador para ver errores
4. Verifica que Material-UI esté instalado
5. Verifica que la variable REACT_APP_API_URL esté configurada
