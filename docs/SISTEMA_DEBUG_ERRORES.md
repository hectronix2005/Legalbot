# Sistema de Debugging Detallado de Errores

## 📋 Implementación Completa

Se ha implementado un sistema completo de debugging que proporciona información detallada cuando ocurre cualquier error al guardar campos.

## 🔍 Frontend - Consola del Navegador

### Información Capturada

Cuando ocurre un error, la consola del navegador (F12) mostrará:

```
❌ ERROR AL GUARDAR CAMPO - DEBUG COMPLETO
  📋 Datos del Campo:
    Nombre: c_c_no
    Valor: 1032429112
    Label: C.C. No
    Supplier ID: 69129b32375817af67e6163e

  📡 Respuesta del Servidor:
    Status: 500
    Status Text: Internal Server Error
    Error Message: [mensaje del error]

  📦 Data Completa del Error:
    Error Type: ValidationError
    Error: [mensaje específico]
    Validation Errors: [array de campos con error]

  🔍 Stack Trace del Servidor:
    [stack trace completo del backend]

  📄 JSON Completo:
    {
      "error": "...",
      "errorType": "...",
      "details": "...",
      ...
    }

  🌐 Detalles de la Request:
    URL: /field-management/supplier/xxx/fields
    Method: POST
    Headers: {...}
    Data enviada: {...}

  💬 Error del Cliente:
    Message: Request failed with status code 500
    Name: Error
    Code: ERR_BAD_REQUEST

  📚 Stack Trace del Cliente:
    [stack trace del frontend]

  🔧 Error Object Completo:
    [objeto de error serializado]
```

### Alert para el Usuario

Además de los logs en consola, el usuario verá un alert con información resumida:

```
❌ Error al guardar campo "C.C. No"

Mensaje: [mensaje del error]
HTTP Status: 500
Tipo: ValidationError

Errores de validación:
  - custom_fields
  - [otros campos]

💡 Revisa la consola del navegador (F12) para más detalles técnicos.
```

## 🖥️ Backend - Logs del Servidor

### En la Terminal/Archivo de Log

El backend registra información completa en `/tmp/legalbot-backend.log`:

```
╔════════════════════════════════════════════════════════════════╗
║ ❌ ERROR AL ACTUALIZAR CAMPOS - DEBUG COMPLETO                 ║
╚════════════════════════════════════════════════════════════════╝

📋 Contexto de la Request:
  Supplier ID: 69129b32375817af67e6163e
  User ID: 507f1f77bcf86cd799439011
  Company ID: 507f191e810c19729de860ea
  Campos a actualizar: [
    {
      name: "c.c._no",
      value: "1032429112",
      label: "C.C. No"
    }
  ]

🔴 Información del Error:
  Name: ValidationError
  Message: Validation failed: custom_fields
  Code: undefined

🔍 Error de Mongoose Detectado:
  Type: ValidationError

  Errores de Validación:
    - custom_fields:
      Message: Mongoose maps do not support keys that contain "."
      Value: Map { "c.c._no" => "1032429112" }
      Kind: user defined
      Path: custom_fields

📚 Stack Trace Completo:
  [stack trace completo con archivos y líneas]

🔧 Error Object Serializado:
  [objeto de error con todos los detalles]

╔════════════════════════════════════════════════════════════════╗
║ FIN DEL DEBUG                                                  ║
╚════════════════════════════════════════════════════════════════╝
```

### Detección Específica de Errores

El sistema detecta y proporciona información específica para:

#### 1. Errores de Validación de Mongoose
```javascript
🔍 Error de Mongoose Detectado:
  Type: ValidationError

  Errores de Validación:
    - [campo]:
      Message: [mensaje]
      Value: [valor que causó el error]
      Kind: [tipo de validación]
      Path: [ruta del campo]
```

#### 2. Errores de Cast de Mongoose
```javascript
🔍 Error de Mongoose Detectado:
  Type: CastError

  Razón del CastError:
    Message: [mensaje del error]
    Value: [valor que no se pudo castear]
```

#### 3. Errores de Duplicado de MongoDB
```javascript
🔍 Error de Duplicado de MongoDB (11000):
  Index: { email: 1 }
  Value: { email: "test@example.com" }
```

## 📡 Respuesta HTTP del Backend

### Estructura en Modo Desarrollo

```json
{
  "error": "Mensaje principal del error",
  "errorType": "ValidationError",
  "timestamp": "2025-11-14T05:30:00.000Z",
  "details": "Stack trace completo...",
  "supplierId": "69129b32375817af67e6163e",
  "validationErrors": ["custom_fields", "email"],
  "validationDetails": [
    {
      "field": "custom_fields",
      "message": "Mongoose maps do not support keys that contain \".\"",
      "value": "Map { ... }",
      "kind": "user defined"
    }
  ],
  "mongoCode": 11000,
  "castErrorReason": "Cast to ObjectId failed"
}
```

### Estructura en Modo Producción

```json
{
  "error": "Mensaje principal del error",
  "errorType": "ValidationError",
  "timestamp": "2025-11-14T05:30:00.000Z"
}
```

## 🛠️ Cómo Usar el Sistema de Debug

### Para Desarrolladores

1. **Abrir Consola del Navegador:**
   - Presionar F12
   - Ir a la pestaña "Console"

2. **Reproducir el Error:**
   - Intentar la operación que falla
   - Observar los logs agrupados bajo "❌ ERROR AL GUARDAR CAMPO"

3. **Revisar Logs del Backend:**
   ```bash
   tail -f /tmp/legalbot-backend.log
   ```

4. **Copiar Información:**
   - Click derecho en el grupo de consola
   - "Save as..." para guardar todos los logs
   - O copiar secciones específicas

### Para Usuarios Finales

El alert mostrará información básica del error con instrucciones para contactar al equipo técnico con los detalles de la consola.

## 📊 Ejemplos de Debugging

### Ejemplo 1: Error de Puntos en Map

**Frontend Console:**
```
❌ ERROR AL GUARDAR CAMPO - DEBUG COMPLETO
  📋 Datos del Campo:
    Nombre: c.c._no
    Valor: 1032429112

  📡 Respuesta del Servidor:
    Status: 500
    Error Message: Mongoose maps do not support keys that contain "."

  📦 Data Completa del Error:
    validationDetails: [
      {
        field: "custom_fields",
        message: "Mongoose maps do not support keys that contain \".\"",
        kind: "user defined"
      }
    ]
```

**Solución Identificada:** El campo contiene puntos que no están permitidos en Mongoose Maps.

### Ejemplo 2: Error de Campo Requerido

**Backend Log:**
```
🔍 Error de Mongoose Detectado:
  Type: ValidationError

  Errores de Validación:
    - email:
      Message: Path `email` is required.
      Value: undefined
      Kind: required
      Path: email
```

**Solución:** El campo email es requerido pero no se proporcionó.

### Ejemplo 3: Error de Cast a ObjectId

**Backend Log:**
```
🔍 Error de Mongoose Detectado:
  Type: CastError

  Razón del CastError:
    Message: Cast to ObjectId failed for value "invalid-id"
    Value: "invalid-id"
```

**Solución:** El ID proporcionado no es un ObjectId válido de MongoDB.

## 🎯 Beneficios del Sistema

1. **Diagnóstico Rápido:**
   - Información completa en un solo lugar
   - No necesidad de agregar console.logs adicionales

2. **Información Estructurada:**
   - Logs agrupados y organizados
   - Fácil de leer y entender

3. **Contexto Completo:**
   - Datos de la request
   - Estado del servidor
   - Detalles del error
   - Stack traces completos

4. **Modo Desarrollo vs Producción:**
   - Detalles completos en desarrollo
   - Información limitada en producción (seguridad)

5. **Detección Automática:**
   - Identifica tipos de error automáticamente
   - Proporciona información específica según el tipo

## 🔧 Archivos Modificados

1. **Frontend:**
   - `/frontend/src/components/FieldSuggestionsPanel.tsx` (líneas 131-205)

2. **Backend:**
   - `/backend/routes/field-management.js` (líneas 153-248)
   - `/backend/services/fieldManagementService-v2.js` (líneas 254-271)

## ✅ Estado

- [x] Frontend con debugging detallado
- [x] Backend con logging completo
- [x] Detección específica de errores de Mongoose
- [x] Detección de errores de MongoDB
- [x] Respuestas HTTP estructuradas
- [x] Modo desarrollo vs producción
- [x] Documentación completa
