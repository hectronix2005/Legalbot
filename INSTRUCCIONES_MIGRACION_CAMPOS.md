# Guía de Migración de Campos de Terceros

Cuando cambias los nombres de campos en `/backend/config/thirdPartyTypes.js`, los terceros que ya están guardados en la base de datos tienen los nombres antiguos y no coinciden con la nueva configuración.

## Herramientas Disponibles

He creado dos herramientas para solucionar este problema:

### 1. Script de Migración por Consola
**Ubicación:** `/backend/migrations/migrate-supplier-field-names.js`

Este script te permite migrar los nombres de campos directamente desde la terminal.

#### Uso Básico:

```bash
# Ver qué cambios se harían SIN aplicarlos (modo dry-run)
node migrations/migrate-supplier-field-names.js --dry-run

# Aplicar los cambios a TODOS los terceros
node migrations/migrate-supplier-field-names.js

# Migrar solo terceros de un tipo específico
node migrations/migrate-supplier-field-names.js --type=proveedor

# Ver cambios solo para un tipo (sin aplicar)
node migrations/migrate-supplier-field-names.js --dry-run --type=proveedor
```

#### Ejemplo de Salida:

```
🔄 INICIANDO MIGRACIÓN DE NOMBRES DE CAMPOS
============================================
Modo: 🔍 DRY RUN (solo lectura)

📝 Tercero: Propiedad Horizontal Example
   ID: 507f1f77bcf86cd799439011
   Tipo: proveedor
   Cambios a realizar:
   - "Nombre de la Propiedad Horizontal" → "razon_social"
     Valor: "PH Los Alamos"
   - "NOMBRE DEL LICENCIATARIO" → "licenciatario"
     Valor: "Juan Pérez"

============================================
📊 RESUMEN DE MIGRACIÓN
============================================
Total terceros revisados: 9
Terceros afectados: 3
Total de campos migrados: 7
```

### 2. API Endpoints para Migración Programática

**Base URL:** `http://localhost:3002/api/data-migration`

Estos endpoints permiten migrar datos desde tu aplicación o con herramientas como Postman.

#### A. Verificar si hay terceros que necesitan migración

```bash
GET /api/data-migration/check-suppliers
Authorization: Bearer <tu_token>
```

**Respuesta:**
```json
{
  "totalSuppliers": 9,
  "needsMigration": 3,
  "requiresMigration": true
}
```

#### B. Previsualizar cambios sin aplicarlos

```bash
POST /api/data-migration/preview-suppliers
Authorization: Bearer <tu_token>
Content-Type: application/json

{
  "supplierType": "proveedor"  // Opcional: filtrar por tipo
}
```

**Respuesta:**
```json
{
  "totalSuppliers": 9,
  "suppliersAffected": 3,
  "totalChanges": 7,
  "preview": [
    {
      "supplierId": "507f1f77bcf86cd799439011",
      "name": "Propiedad Horizontal Example",
      "type": "proveedor",
      "changes": [
        {
          "oldName": "Nombre de la Propiedad Horizontal",
          "newName": "razon_social",
          "value": "PH Los Alamos"
        },
        {
          "oldName": "NOMBRE DEL LICENCIATARIO",
          "newName": "licenciatario",
          "value": "Juan Pérez"
        }
      ]
    }
  ]
}
```

#### C. Ejecutar migración

```bash
POST /api/data-migration/migrate-suppliers
Authorization: Bearer <tu_token>
Content-Type: application/json

{
  "supplierType": "proveedor",  // Opcional: migrar solo este tipo
  "supplierIds": ["507f...", "608f..."]  // Opcional: solo estos IDs
}
```

**Respuesta:**
```json
{
  "success": true,
  "totalSuppliers": 9,
  "suppliersAffected": 3,
  "totalChanges": 7,
  "results": [
    {
      "supplierId": "507f1f77bcf86cd799439011",
      "name": "Propiedad Horizontal Example",
      "type": "proveedor",
      "changesApplied": 2
    }
  ]
}
```

## Mapeo de Campos

El sistema mapea automáticamente estos nombres antiguos a los nuevos:

| Nombre Antiguo | Nombre Nuevo |
|----------------|--------------|
| Nombre / Razón Social | razon_social |
| Razón Social | razon_social |
| Nombre de la Propiedad Horizontal | razon_social |
| NOMBRE DE LA PROPIEDAD HORIZONTAL | razon_social |
| Nombre del Licenciatario | licenciatario |
| NOMBRE DEL LICENCIATARIO | licenciatario |
| Representante Legal | representante_legal |
| Tipo de Identificación | tipo_identificacion |
| Número de Identificación | numero_identificacion |
| Email / Correo | email |
| Teléfono / Celular | telefono |
| ... y más ...

**NOTA:** Si un campo no está en el mapeo, se convierte automáticamente a snake_case:
- "Nombre Largo del Campo" → "nombre_largo_del_campo"
- "MAYÚSCULAS" → "mayusculas"

## Flujo de Trabajo Recomendado

1. **Antes de Cambiar Configuración:**
   ```bash
   # Verificar estado actual
   node migrations/migrate-supplier-field-names.js --dry-run
   ```

2. **Cambiar Configuración:**
   - Edita `/backend/config/thirdPartyTypes.js`
   - Actualiza los labels/names según necesites

3. **Verificar Impacto:**
   ```bash
   # Ver qué se migrará
   node migrations/migrate-supplier-field-names.js --dry-run
   ```

4. **Aplicar Migración:**
   ```bash
   # Aplicar cambios
   node migrations/migrate-supplier-field-names.js
   ```

5. **Verificar Resultado:**
   - Revisa los terceros en la aplicación
   - Verifica que los contratos se generen correctamente

## Agregar Nuevos Mapeos

Si necesitas agregar más mapeos de nombres, edita el archivo:
- `/backend/migrations/migrate-supplier-field-names.js`
- `/backend/routes/data-migration.js`

Y agrega tus mapeos en el objeto `FIELD_MAPPINGS`:

```javascript
const FIELD_MAPPINGS = {
  // ... existentes ...
  'Tu Nombre Antiguo': 'tu_nombre_nuevo',
  'OTRO NOMBRE ANTIGUO': 'otro_nombre_nuevo'
};
```

## Solución de Problemas

### Problema: Los campos no se encuentran después de migrar

**Causa:** El mapeo no incluye algún nombre antiguo específico.

**Solución:**
1. Ejecuta el script en modo dry-run para ver qué campos no coinciden
2. Agrega los mapeos faltantes en `FIELD_MAPPINGS`
3. Vuelve a ejecutar la migración

### Problema: Algunos terceros no se migraron

**Causa:** Puede que tengan `custom_fields` vacío o null.

**Solución:**
1. Verifica con el endpoint `/check-suppliers`
2. Revisa manualmente esos terceros en la base de datos
3. Actualiza manualmente si es necesario

## Contacto y Soporte

Si encuentras problemas o necesitas agregar nuevos mapeos:
1. Revisa los logs del servidor
2. Ejecuta el script en modo dry-run para diagnosticar
3. Contacta al equipo de desarrollo con los detalles del error
