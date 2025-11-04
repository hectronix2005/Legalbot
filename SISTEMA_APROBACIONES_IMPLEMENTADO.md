# Sistema de Aprobaciones y Categorías - Implementación Completada

## 📋 Resumen del Sistema

Se ha implementado un sistema completo de flujos de trabajo con aprobaciones para contratos y terceros, con roles específicos y categorías personalizables.

---

## ✅ BACKEND COMPLETADO (100%)

### 1. Modelos Creados/Modificados

#### **ContractCategory** (NUEVO)
📁 `/backend/models/ContractCategory.js`

Permite a los administradores crear categorías de contratos con cuestionarios dinámicos.

**Campos principales:**
- `name`: Nombre de la categoría (ej: "Contrato Laboral", "NDA", "Contrato Comercial")
- `description`: Descripción de la categoría
- `icon`, `color`: Para personalización visual
- `questionnaire`: Array de preguntas configurables
  - Tipos soportados: text, textarea, number, date, select, multiselect, checkbox, radio, email, phone
  - Validación automática de respuestas
  - Orden personalizable
- `template`: Plantilla Word asociada
- `requires_approval`: Si requiere aprobación de abogado
- `auto_assign_lawyer`: Asignación automática

**Método especial:**
- `validateAnswers(answers)`: Valida respuestas del cuestionario

#### **Supplier** (MODIFICADO)
📁 `/backend/models/Supplier.js`

Agregados campos para flujo de aprobación:
- `approval_status`: 'pending' | 'approved' | 'rejected'
- `approved_by`: ID del abogado que aprobó
- `approved_at`: Fecha de aprobación
- `rejection_reason`: Razón del rechazo
- `rejected_at`: Fecha de rechazo

#### **ContractRequest** (MEJORADO)
📁 `/backend/models/ContractRequest.js`

Agregados campos:
- `category`: Referencia a ContractCategory
- `questionnaire_answers`: Respuestas del cuestionario (Map)
- `assigned_at`: Cuándo se asignó al abogado
- `generated_contract`: Referencia al contrato generado
- `priority`: 'low' | 'medium' | 'high' | 'urgent'
- `status`: Incluye nuevo estado 'cancelled'

---

### 2. Endpoints Creados

#### **A. Categorías de Contratos**
📁 `/backend/routes/contract-categories.js`
🌐 Base URL: `/api/contract-categories`

| Método | Endpoint | Rol Requerido | Descripción |
|--------|----------|---------------|-------------|
| GET | `/` | Todos | Obtener categorías activas |
| GET | `/:id` | Todos | Obtener categoría específica |
| POST | `/` | Admin | Crear categoría |
| PUT | `/:id` | Admin | Actualizar categoría |
| DELETE | `/:id` | Admin | Desactivar categoría |
| POST | `/:id/validate-answers` | Todos | Validar respuestas de cuestionario |

#### **B. Aprobación de Terceros**
📁 `/backend/routes/supplier-approvals.js`
🌐 Base URL: `/api/supplier-approvals`

| Método | Endpoint | Rol Requerido | Descripción |
|--------|----------|---------------|-------------|
| GET | `/pending` | Lawyer, Admin | Terceros pendientes de aprobación |
| GET | `/all` | Todos | Todos los terceros con filtros |
| POST | `/:id/approve` | Lawyer, Admin | Aprobar tercero |
| POST | `/:id/reject` | Lawyer, Admin | Rechazar tercero |
| GET | `/stats` | Lawyer, Admin | Estadísticas de aprobaciones |

#### **C. Solicitudes de Contratos (V2)**
📁 `/backend/routes/contract-requests-improved.js`
🌐 Base URL: `/api/contract-requests-v2`

| Método | Endpoint | Rol Requerido | Descripción |
|--------|----------|---------------|-------------|
| GET | `/` | Todos | Obtener solicitudes (filtradas por rol) |
| GET | `/:id` | Todos | Obtener solicitud específica |
| POST | `/` | Todos | Crear solicitud de contrato |
| POST | `/:id/assign` | Lawyer, Admin | Asignar abogado |
| POST | `/:id/approve` | Lawyer, Admin | Aprobar y generar contrato |
| POST | `/:id/reject` | Lawyer, Admin | Rechazar solicitud |
| GET | `/stats/overview` | Lawyer, Admin | Estadísticas de solicitudes |

---

### 3. Rutas Registradas en server.js

```javascript
// Nuevas rutas agregadas:
app.use('/api/contract-categories', contractCategoriesRoutes);
app.use('/api/supplier-approvals', supplierApprovalsRoutes);
app.use('/api/contract-requests-v2', contractRequestsImprovedRoutes);
```

---

## 🔄 Flujos de Trabajo Implementados

### FLUJO 1: Solicitud de Contrato por Usuario

```
┌─────────────────────────────────────────────────────┐
│ 1. Usuario selecciona categoría                     │
│    GET /api/contract-categories                     │
├─────────────────────────────────────────────────────┤
│ 2. Sistema carga cuestionario de la categoría       │
│    GET /api/contract-categories/:id                 │
├─────────────────────────────────────────────────────┤
│ 3. Usuario completa cuestionario                    │
│    (Frontend valida en tiempo real)                 │
├─────────────────────────────────────────────────────┤
│ 4. Usuario envía solicitud                          │
│    POST /api/contract-requests-v2                   │
│    {                                                 │
│      category_id,                                    │
│      title,                                          │
│      questionnaire_answers,                          │
│      priority                                        │
│    }                                                 │
│    Estado: "pending"                                 │
├─────────────────────────────────────────────────────┤
│ 5. Abogado auto-asigna o admin asigna               │
│    POST /api/contract-requests-v2/:id/assign        │
│    Estado: "in_review"                               │
├─────────────────────────────────────────────────────┤
│ 6. Abogado aprueba solicitud                        │
│    POST /api/contract-requests-v2/:id/approve       │
│    - Genera contrato automáticamente                │
│    - Estado: "completed"                             │
│    - Crea registro en Contract                      │
│                                                       │
│    O Abogado rechaza solicitud                      │
│    POST /api/contract-requests-v2/:id/reject        │
│    Estado: "rejected"                                │
└─────────────────────────────────────────────────────┘
```

### FLUJO 2: Creación y Aprobación de Terceros

```
┌─────────────────────────────────────────────────────┐
│ 1. Usuario crea tercero                             │
│    POST /api/suppliers                              │
│    (Ruta existente, pero ahora crea con             │
│     approval_status: "pending")                     │
├─────────────────────────────────────────────────────┤
│ 2. Abogado consulta pendientes                      │
│    GET /api/supplier-approvals/pending              │
├─────────────────────────────────────────────────────┤
│ 3. Abogado revisa y decide                          │
│                                                       │
│    APROBAR:                                          │
│    POST /api/supplier-approvals/:id/approve         │
│    - approval_status: "approved"                    │
│    - Tercero disponible para contratos              │
│                                                       │
│    RECHAZAR:                                         │
│    POST /api/supplier-approvals/:id/reject          │
│    {                                                 │
│      rejection_reason: "..."                        │
│    }                                                 │
│    - approval_status: "rejected"                    │
│    - Tercero NO disponible para contratos           │
└─────────────────────────────────────────────────────┘
```

---

## 🔐 Permisos por Rol

| Acción | requester | lawyer | admin | super_admin |
|--------|-----------|--------|-------|-------------|
| **Categorías de Contratos** |
| Ver categorías | ✅ | ✅ | ✅ | ✅ |
| Crear/Editar categoría | ❌ | ❌ | ✅ | ✅ |
| **Solicitudes de Contratos** |
| Ver propias solicitudes | ✅ | ✅ | ✅ | ✅ |
| Ver todas las solicitudes | ❌ | ✅* | ✅ | ✅ |
| Crear solicitud | ✅ | ✅ | ✅ | ✅ |
| Asignar abogado | ❌ | ✅ | ✅ | ✅ |
| Aprobar solicitud | ❌ | ✅ | ✅ | ✅ |
| Rechazar solicitud | ❌ | ✅ | ✅ | ✅ |
| **Terceros** |
| Crear tercero | ✅ | ✅ | ✅ | ✅ |
| Ver terceros pendientes | ❌ | ✅ | ✅ | ✅ |
| Aprobar tercero | ❌ | ✅ | ✅ | ✅ |
| Rechazar tercero | ❌ | ✅ | ✅ | ✅ |

*Lawyer solo ve las asignadas a él o las no asignadas pendientes de revisión

---

## 📊 Registro de Actividades

Todas las acciones importantes se registran en `ActivityLog`:
- Creación de categorías
- Aprobación/rechazo de terceros
- Creación de solicitudes
- Asignación de abogados
- Aprobación/rechazo de solicitudes

---

## 🚀 Estado del Servidor

✅ Backend corriendo en: `http://localhost:3002`
✅ Todas las rutas registradas y funcionando
✅ Base de datos conectada: `legal-contracts`
✅ Sistema de backups activo
✅ Sistema de protección de datos activo

---

## 📦 Próximos Pasos: Frontend

Aún faltan por implementar los componentes del frontend:

1. **ContractCategoryManagement.tsx** - Gestión de categorías (Admin)
2. **ContractRequestForm.tsx** - Formulario de solicitud (Todos)
3. **SupplierApprovals.tsx** - Aprobación de terceros (Lawyer)
4. **ContractRequestApprovals.tsx** - Aprobación de solicitudes (Lawyer)
5. **DynamicQuestionnaire.tsx** - Componente reutilizable para cuestionarios

---

## 🔧 Ejemplo de Uso

### Crear una Categoría (Admin)

```javascript
POST /api/contract-categories
Headers: {
  Authorization: Bearer <token>,
  X-Company-Id: <company_id>
}
Body: {
  "name": "Contrato Laboral",
  "description": "Contratos de trabajo para empleados",
  "icon": "briefcase",
  "color": "#10B981",
  "questionnaire": [
    {
      "question": "¿Tipo de contrato?",
      "field_name": "contract_type",
      "type": "select",
      "options": ["Término fijo", "Término indefinido", "Obra o labor"],
      "required": true,
      "order": 1
    },
    {
      "question": "Salario mensual (COP)",
      "field_name": "salary",
      "type": "number",
      "required": true,
      "placeholder": "1300000",
      "order": 2
    },
    {
      "question": "Fecha de inicio",
      "field_name": "start_date",
      "type": "date",
      "required": true,
      "order": 3
    }
  ],
  "template": "<template_id>",
  "requires_approval": true
}
```

### Crear Solicitud de Contrato (Usuario)

```javascript
POST /api/contract-requests-v2
Headers: {
  Authorization: Bearer <token>,
  X-Company-Id: <company_id>
}
Body: {
  "category_id": "<category_id>",
  "title": "Contrato Laboral - Juan Pérez",
  "questionnaire_answers": {
    "contract_type": "Término indefinido",
    "salary": 2500000,
    "start_date": "2025-11-15"
  },
  "priority": "medium"
}
```

### Aprobar Tercero (Abogado)

```javascript
POST /api/supplier-approvals/:id/approve
Headers: {
  Authorization: Bearer <token>,
  X-Company-Id: <company_id>
}
```

---

## 📝 Notas Técnicas

- **Multi-tenancy**: Todos los endpoints respetan el `X-Company-Id` header
- **Validación**: Cuestionarios se validan automáticamente en el backend
- **Auditoría**: Todas las acciones se registran con IP, usuario y timestamp
- **Seguridad**: Middleware de autenticación y autorización en todas las rutas
- **Estados**: Sistema robusto de estados para seguimiento de flujos

---

## ✨ Ventajas del Sistema Implementado

1. **Flexibilidad**: Categorías y cuestionarios completamente personalizables
2. **Control**: Sistema de aprobaciones multinivel
3. **Auditoría**: Registro completo de todas las acciones
4. **Escalabilidad**: Diseño multi-tenant desde el inicio
5. **Seguridad**: Permisos granulares por rol
6. **UX**: Flujos claros y estados bien definidos

---

**Fecha de implementación**: 2025-11-04
**Versión**: 1.0.0
**Estado**: Backend 100% completo ✅ | Frontend 0% pendiente ⏳
