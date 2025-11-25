# Guía de Variantes de Perfiles de Terceros

## Descripción General

El sistema de **Variantes de Perfiles** permite que un mismo tercero tenga múltiples configuraciones para la misma plantilla y rol, adaptadas a diferentes contextos o escenarios de uso.

### Concepto

- **Perfil Base**: Representa la relación entre un tercero, una plantilla y un rol (ej: Juan Pérez como "Arrendador" en "Contrato de Arriendo")
- **Variantes**: Diferentes configuraciones del mismo perfil con distintos valores para las variables de la plantilla

### Ejemplo de Uso

**Caso**: Juan Pérez es arrendador de propiedades residenciales y comerciales

- **Perfil**: Juan Pérez - Arrendador - Contrato de Arriendo
  - **Variante 1**: "Arriendo Residencial"
    - Dirección: Av. Providencia 123, Apt 45
    - Tipo propiedad: Residencial
    - Plazo estándar: 12 meses
  - **Variante 2**: "Arriendo Comercial Centro"
    - Dirección: Huérfanos 1234, Local 5
    - Tipo propiedad: Comercial
    - Plazo estándar: 24 meses
  - **Variante 3**: "Arriendo Comercial Mall"
    - Dirección: Mall Parque Arauco, Local 234
    - Tipo propiedad: Comercial - Retail
    - Plazo estándar: 36 meses

## Arquitectura

### Modelo de Datos

```javascript
ThirdPartyProfile {
  supplier: ObjectId,        // Referencia al tercero
  template: ObjectId,        // Referencia a la plantilla
  role_in_template: String,  // Rol en la plantilla

  variants: [{               // Array de variantes
    variant_name: String,             // Nombre descriptivo
    variant_description: String,      // Descripción del contexto
    context_tags: [String],          // Etiquetas de clasificación
    field_mappings: [FieldMapping],  // Valores específicos
    is_default: Boolean,             // Si es la variante predeterminada
    active: Boolean,                 // Si está activa
    usage_count: Number,             // Veces que se ha usado
    last_used_at: Date,              // Última vez que se usó
    last_used_in_contract: ObjectId  // Último contrato donde se usó
  }]
}
```

### Métodos del Modelo

#### Gestión de Variantes

```javascript
// Crear nueva variante
profile.createVariant(variantData, userId)

// Actualizar variante existente
profile.updateVariant(variantId, variantData, userId)

// Eliminar (desactivar) variante
profile.deleteVariant(variantId)

// Registrar uso de variante en contrato
profile.recordVariantUsage(variantId, contractId)

// Obtener variante por defecto
profile.getDefaultVariant()

// Exportar datos para contrato (con variante específica)
profile.toContractData(variantId)
```

## API Endpoints

### Crear Variante

```http
POST /api/third-party-profiles/:profileId/variants
Content-Type: application/json

{
  "variant_name": "Arriendo Residencial",
  "variant_description": "Para propiedades de uso habitacional",
  "context_tags": ["residencial", "corto_plazo"],
  "field_mappings": [...],
  "is_default": true
}
```

### Listar Variantes

```http
GET /api/third-party-profiles/:profileId/variants?active_only=true
```

### Obtener Variante Específica

```http
GET /api/third-party-profiles/:profileId/variants/:variantId
```

### Actualizar Variante

```http
PUT /api/third-party-profiles/:profileId/variants/:variantId
Content-Type: application/json

{
  "variant_name": "Nuevo nombre",
  "variant_description": "Nueva descripción",
  "context_tags": ["tag1", "tag2"],
  "field_mappings": [...]
}
```

### Eliminar Variante

```http
DELETE /api/third-party-profiles/:profileId/variants/:variantId
```

**Nota**: No se puede eliminar la única variante activa de un perfil.

### Establecer Variante como Predeterminada

```http
POST /api/third-party-profiles/:profileId/variants/:variantId/set-default
```

### Clonar Variante

```http
POST /api/third-party-profiles/:profileId/variants/:variantId/clone
Content-Type: application/json

{
  "variant_name": "Nombre para el clon"
}
```

### Registrar Uso

```http
POST /api/third-party-profiles/:profileId/variants/:variantId/record-usage
Content-Type: application/json

{
  "contract_id": "64abc123..."
}
```

## Componentes Frontend

### ProfileVariantManager

Componente React para gestionar variantes de un perfil.

```tsx
import ProfileVariantManager from './components/ProfileVariantManager';

<ProfileVariantManager
  profileId={profileId}
  onVariantSelect={(variantId) => console.log('Selected:', variantId)}
  showCreateButton={true}
/>
```

#### Props

- `profileId` (string, requerido): ID del perfil
- `onVariantSelect` (función, opcional): Callback cuando se selecciona una variante
- `showCreateButton` (boolean, opcional): Si mostrar botón de crear variante (default: true)

#### Características

- Visualización en grid de todas las variantes
- Crear nueva variante con modal
- Editar variantes existentes
- Clonar variantes
- Establecer variante predeterminada
- Eliminar variantes (con protección)
- Indicadores visuales de completitud y uso
- Etiquetas de contexto

### Integración en SupplierProfilesManager

El componente `SupplierProfilesManager` ya está integrado con el sistema de variantes:

- Muestra badge con número de variantes activas
- Botón "Gestionar Variantes" en cada tarjeta de perfil
- Modal completo con `ProfileVariantManager` embebido

## Flujo de Uso

### 1. Crear Perfil de Tercero

```javascript
// Al generar un contrato, se crea automáticamente el perfil
const profile = await ThirdPartyProfile.findOrCreateProfile(
  supplierId,
  templateId,
  roleInTemplate,
  companyId,
  userId
);
```

### 2. Crear Primera Variante

```javascript
// Al crear el perfil, crear una variante inicial
const variant = profile.createVariant({
  variant_name: "Configuración Principal",
  variant_description: "Variante por defecto",
  context_tags: ["default"],
  field_mappings: [...],  // Campos auto-llenados
  is_default: true
}, userId);

await profile.save();
```

### 3. Crear Variantes Adicionales

```javascript
// Usuario crea variantes para diferentes contextos
const variantResidencial = profile.createVariant({
  variant_name: "Arriendo Residencial",
  variant_description: "Para propiedades habitacionales",
  context_tags: ["residencial", "corto_plazo"],
  field_mappings: [...],  // Valores específicos residenciales
  is_default: false
}, userId);

await profile.save();
```

### 4. Usar Variante en Generación de Contrato

```javascript
// Al generar contrato, seleccionar variante específica
const contractData = profile.toContractData(variantId);

// O usar variante por defecto
const contractData = profile.toContractData();
```

### 5. Registrar Uso

```javascript
// Después de generar contrato
await profile.recordVariantUsage(variantId, contractId);
```

## Reglas de Negocio

### Variante Predeterminada

- Siempre debe haber **una y solo una** variante predeterminada activa
- Al crear la primera variante, automáticamente es predeterminada
- Al establecer una nueva variante como predeterminada, la anterior pierde el estado
- La variante predeterminada se usa automáticamente si no se especifica una

### Eliminación de Variantes

- No se puede eliminar la **única variante activa** de un perfil
- Al eliminar una variante, se hace soft-delete (`active: false`)
- Si se elimina la variante predeterminada, automáticamente se asigna otra como predeterminada

### Completitud del Perfil

- La completitud del perfil se calcula como el **promedio** de todas las variantes activas
- Cada variante tiene su propia completitud individual basada en sus `field_mappings`

### Tracking de Uso

- Cada variante mantiene contador de usos (`usage_count`)
- Se registra el último contrato donde se usó (`last_used_in_contract`)
- Se registra la fecha del último uso (`last_used_at`)
- El perfil también mantiene estadísticas globales de uso

## Casos de Uso Reales

### 1. Arrendador con Múltiples Propiedades

Un arrendador tiene diferentes tipos de propiedades:

```
Perfil: María González - Arrendadora - Contrato de Arriendo

Variantes:
- "Departamento Centro" → Dirección, metros², amoblado, servicios incluidos
- "Casa Suburbana" → Dirección, jardín, estacionamientos, bodega
- "Local Comercial" → Dirección, patente comercial, horario permitido
```

### 2. Proveedor con Diferentes Servicios

Un proveedor ofrece varios niveles de servicio:

```
Perfil: TechSupport SpA - Proveedor - Contrato de Servicios

Variantes:
- "Soporte Básico" → Horario 9-18, email only, SLA 48h
- "Soporte Premium" → 24/7, teléfono + email, SLA 4h
- "Soporte Enterprise" → Dedicado, on-site, SLA 1h
```

### 3. Empleado con Diferentes Modalidades

Un empleado puede tener diferentes configuraciones contractuales:

```
Perfil: Pedro Ramírez - Empleado - Contrato de Trabajo

Variantes:
- "Jornada Completa Presencial" → 45h/sem, oficina, beneficios full
- "Jornada Parcial" → 20h/sem, mixto, beneficios proporcionales
- "Full Remote" → 45h/sem, home office, beneficios digitales
```

## Mejores Prácticas

### 1. Nomenclatura de Variantes

- Usar nombres descriptivos y concisos
- Incluir el contexto principal en el nombre
- Ejemplo: "Arriendo Comercial - Centro" mejor que "Variante 2"

### 2. Etiquetas de Contexto

- Usar etiquetas consistentes en minúsculas
- Separar palabras con guion bajo: `corto_plazo`, `residencial`
- Reutilizar etiquetas entre perfiles similares

### 3. Descripción de Variantes

- Explicar claramente en qué contexto usar la variante
- Mencionar diferencias clave con otras variantes
- Incluir casos de uso específicos

### 4. Gestión de Variantes

- Mantener el número de variantes manejable (3-5 por perfil típicamente)
- Eliminar variantes obsoletas o no utilizadas
- Revisar y actualizar variantes periódicamente
- Usar la función de clonado para crear variantes similares

### 5. Variante Predeterminada

- La variante predeterminada debe ser la más utilizada
- Debe tener todos los campos básicos completos
- Revisar periódicamente si la variante predeterminada sigue siendo apropiada

## Migración desde Sistema Anterior

Si tienes perfiles sin variantes (usando `field_mappings` directamente):

### Opción 1: Migración Automática

El sistema mantiene retrocompatibilidad:
- Si un perfil no tiene variantes, usa los `field_mappings` directos
- Los métodos como `toContractData()` funcionan en ambos casos

### Opción 2: Migración Manual

Script para convertir perfiles existentes a variantes:

```javascript
const profiles = await ThirdPartyProfile.find({
  variants: { $size: 0 }
});

for (const profile of profiles) {
  // Crear variante desde datos existentes
  profile.createVariant({
    variant_name: "Configuración Principal",
    variant_description: "Migrado desde perfil original",
    context_tags: ["default", "migrated"],
    field_mappings: profile.field_mappings,
    template_specific_fields: profile.template_specific_fields,
    is_default: true
  }, adminUserId);

  await profile.save();
}
```

## Troubleshooting

### Error: "No se puede eliminar la única variante activa"

**Causa**: Intentas eliminar la última variante activa del perfil.

**Solución**: Crea otra variante antes de eliminar la última, o desactiva el perfil completo.

### Error: "Variante no encontrada"

**Causa**: El ID de la variante no existe o fue eliminada.

**Solución**: Verifica que estás usando el ID correcto con `profile.variants.id(variantId)`.

### La completitud del perfil no se actualiza

**Causa**: No estás llamando a `calculateCompleteness()` después de modificar variantes.

**Solución**:
```javascript
profile.updateVariant(variantId, data, userId);
profile.calculateCompleteness();
await profile.save();
```

### No aparece la variante en el frontend

**Causa**: La variante puede estar marcada como `active: false`.

**Solución**: Filtra solo variantes activas o reactiva la variante.

## Performance

### Índices

El modelo usa índices compuestos para queries eficientes:

```javascript
{ supplier: 1, template: 1, role_in_template: 1 }  // Único
{ company: 1, template: 1 }
{ supplier: 1, company: 1 }
```

### Consideraciones

- Las variantes se almacenan como subdocumentos, eficientes para lectura
- Límite recomendado: 10 variantes por perfil
- Para perfiles con muchas variantes, considerar paginación en frontend

## Seguridad

### Autorización

Los endpoints de variantes requieren roles:
- Crear/Editar: `admin`, `super_admin`, `lawyer`
- Listar/Ver: Todos los usuarios autenticados
- Eliminar: `admin`, `super_admin`

### Validación

- Nombres de variantes son requeridos
- No se permite eliminar la única variante activa
- Los cambios se auditan con `created_by` y `updated_by`

## Monitoreo

### Métricas Útiles

```javascript
// Variantes más utilizadas
const topVariants = await ThirdPartyProfile.aggregate([
  { $unwind: '$variants' },
  { $sort: { 'variants.usage_count': -1 } },
  { $limit: 10 }
]);

// Perfiles sin variantes
const profilesWithoutVariants = await ThirdPartyProfile.countDocuments({
  'variants': { $size: 0 }
});

// Promedio de variantes por perfil
const avgVariants = await ThirdPartyProfile.aggregate([
  { $project: { variantCount: { $size: '$variants' } } },
  { $group: { _id: null, avg: { $avg: '$variantCount' } } }
]);
```

## Roadmap Futuro

Posibles mejoras:

1. **Versionado de variantes**: Mantener historial de cambios
2. **Plantillas de variantes**: Crear variantes desde templates predefinidos
3. **Importación/Exportación**: Compartir variantes entre perfiles
4. **Validaciones personalizadas**: Reglas específicas por variante
5. **Análisis predictivo**: Sugerir variante basada en parámetros del contrato

---

**Última actualización**: 2025-01-13
**Versión del sistema**: 2.0.0
