# 🔄 Sistema de Plantillas Compartidas

## 📋 Descripción General

El sistema permite dos tipos de plantillas:

1. **Plantillas de Empresa**: Específicas de cada empresa, solo visibles por esa empresa
2. **Plantillas Compartidas**: Creadas por el super admin, visibles por TODAS las empresas

## 🔒 Permisos y Roles

### Super Admin (`super_admin`)
- ✅ Puede crear plantillas compartidas
- ✅ Puede editar plantillas compartidas
- ✅ Puede eliminar plantillas compartidas
- ✅ Puede crear plantillas de empresa
- ✅ Ve plantillas de todas las empresas + plantillas compartidas

### Admin de Empresa (`admin`)
- ❌ NO puede crear plantillas compartidas
- ✅ Puede crear plantillas de su empresa
- ✅ Puede editar plantillas de su empresa
- ❌ NO puede editar plantillas compartidas
- ✅ Puede eliminar plantillas de su empresa
- ❌ NO puede eliminar plantillas compartidas
- ✅ Ve plantillas de su empresa + plantillas compartidas

### Lawyer
- ❌ NO puede crear plantillas compartidas
- ✅ Puede crear plantillas de su empresa
- ✅ Puede editar plantillas de su empresa
- ❌ NO puede editar plantillas compartidas
- ✅ Puede eliminar plantillas de su empresa
- ❌ NO puede eliminar plantillas compartidas
- ✅ Ve plantillas de su empresa + plantillas compartidas

## 🔧 Implementación Técnica

### Modelo ContractTemplate

```javascript
{
  name: String,
  description: String,
  category: String,
  content: String,
  fields: Array,
  version: Number,
  is_current: Boolean,

  // NUEVO: Campo para plantillas compartidas
  is_shared: {
    type: Boolean,
    default: false  // Por defecto, plantillas NO son compartidas
  },

  company: {
    type: ObjectId,
    ref: 'Company',
    required: function() {
      // Company es requerido SOLO si NO es plantilla compartida
      return !this.is_shared;
    }
  },

  created_by: ObjectId,
  active: Boolean
}
```

### API Endpoints

#### GET /api/templates
Retorna plantillas de la empresa + plantillas compartidas

**Query Filter:**
```javascript
{
  active: true,
  $or: [
    { company: req.companyId },    // Plantillas de la empresa
    { is_shared: true }            // Plantillas compartidas
  ]
}
```

#### POST /api/templates
Crear plantilla (compartida solo para super_admin)

**Request Body:**
```json
{
  "name": "Nombre de plantilla",
  "description": "Descripción",
  "category": "Categoría",
  "content": "Contenido",
  "fields": [],
  "is_shared": true   // Solo funciona si req.user.role === 'super_admin'
}
```

**Validación:**
```javascript
if (is_shared && req.user.role !== 'super_admin') {
  return res.status(403).json({
    error: 'Solo el super administrador puede crear plantillas compartidas'
  });
}
```

#### PUT /api/templates/:id
Actualizar plantilla

**Permisos:**
- Si `is_shared === true`: Solo `super_admin` puede editar
- Si `is_shared === false`: Solo usuarios de la empresa propietaria pueden editar

```javascript
if (template.is_shared) {
  if (req.user.role !== 'super_admin') {
    return res.status(403).json({
      error: 'Solo el super administrador puede editar plantillas compartidas'
    });
  }
} else {
  if (template.company.toString() !== req.companyId.toString()) {
    return res.status(403).json({
      error: 'No tiene acceso a esta plantilla'
    });
  }
}
```

#### DELETE /api/templates/:id
Desactivar plantilla

**Permisos:** Misma lógica que PUT

## 🎯 Casos de Uso

### Caso 1: Super Admin crea plantilla compartida
```javascript
POST /api/templates
Headers: {
  Authorization: "Bearer <super_admin_token>",
  X-Company-Id: "<any_company_id>"
}
Body: {
  "name": "NDA Estándar Global",
  "description": "Plantilla de NDA para todas las empresas",
  "category": "Confidencialidad",
  "content": "...",
  "is_shared": true  // ✅ Permitido para super_admin
}

Resultado:
- Plantilla creada con is_shared: true
- company: null
- Visible para TODAS las empresas
```

### Caso 2: Admin de empresa intenta crear plantilla compartida
```javascript
POST /api/templates
Headers: {
  Authorization: "Bearer <admin_token>",
  X-Company-Id: "empresa123"
}
Body: {
  "name": "Mi plantilla",
  "is_shared": true  // ❌ NO permitido para admin
}

Resultado:
❌ 403 Forbidden
Error: "Solo el super administrador puede crear plantillas compartidas"
```

### Caso 3: Admin de empresa crea plantilla normal
```javascript
POST /api/templates
Headers: {
  Authorization: "Bearer <admin_token>",
  X-Company-Id: "empresa123"
}
Body: {
  "name": "Plantilla Específica",
  "description": "Solo para mi empresa",
  "is_shared": false  // o no enviar el campo
}

Resultado:
- Plantilla creada con is_shared: false
- company: "empresa123"
- Visible SOLO para empresa123
```

### Caso 4: Usuario de empresa lista plantillas
```javascript
GET /api/templates
Headers: {
  Authorization: "Bearer <user_token>",
  X-Company-Id: "empresa123"
}

Resultado:
[
  {
    "_id": "1",
    "name": "NDA Estándar Global",
    "is_shared": true,
    "company": null  // Plantilla compartida
  },
  {
    "_id": "2",
    "name": "Plantilla Específica",
    "is_shared": false,
    "company": "empresa123"  // Plantilla de la empresa
  }
  // NO incluye plantillas de otras empresas
]
```

## 📊 Base de Datos

### Plantillas Compartidas
```javascript
{
  _id: ObjectId("..."),
  name: "NDA Estándar Global",
  is_shared: true,
  company: null,  // Sin empresa asignada
  created_by: ObjectId("super_admin_user_id"),
  active: true
}
```

### Plantillas de Empresa
```javascript
{
  _id: ObjectId("..."),
  name: "Plantilla Específica de TechCorp",
  is_shared: false,
  company: ObjectId("techcorp_company_id"),
  created_by: ObjectId("admin_user_id"),
  active: true
}
```

## ⚠️ Consideraciones Importantes

1. **Plantillas compartidas NO tienen empresa**: `company: null`
2. **Solo super_admin puede gestionar plantillas compartidas**
3. **Las plantillas compartidas son de solo lectura para empresas**
4. **Cada empresa ve**: sus plantillas + plantillas compartidas
5. **Las empresas NO ven plantillas de otras empresas**
6. **El campo is_shared NO puede ser modificado** después de la creación

## 🔄 Migración de Plantillas Existentes

Si necesitas convertir una plantilla de empresa en compartida:

```javascript
// Solo super_admin puede hacer esto directamente en MongoDB
db.contracttemplates.updateOne(
  { _id: ObjectId("template_id") },
  {
    $set: { is_shared: true },
    $unset: { company: "" }
  }
)
```

## ✅ Resumen

| Acción | Admin Empresa | Lawyer | Super Admin |
|--------|---------------|--------|-------------|
| Ver plantillas de su empresa | ✅ | ✅ | ✅ |
| Ver plantillas compartidas | ✅ | ✅ | ✅ |
| Crear plantilla de empresa | ✅ | ✅ | ✅ |
| Crear plantilla compartida | ❌ | ❌ | ✅ |
| Editar plantilla de su empresa | ✅ | ✅ | ✅ |
| Editar plantilla compartida | ❌ | ❌ | ✅ |
| Eliminar plantilla de su empresa | ✅ | ✅ | ✅ |
| Eliminar plantilla compartida | ❌ | ❌ | ✅ |
| Ver plantillas de otras empresas | ❌ | ❌ | ✅* |

*Super admin puede ver todas las plantillas pero solo desde el contexto de una empresa específica.
