# Componentes Frontend Pendientes de Implementación

## Estado Actual
✅ **Backend**: 100% completo y funcionando
✅ **ContractCategoryManagement.tsx**: Creado (gestión de categorías para admins)
⏳ **Componentes restantes**: Pendientes (código de referencia abajo)

---

## Componentes que Faltan Crear

### 1. **ContractRequestForm.tsx** - Formulario de Solicitud de Contratos
**Ubicación**: `/frontend/src/components/ContractRequestForm.tsx`

**Funcionalidad**:
- Permitir a TODOS los usuarios solicitar contratos
- Listar categorías disponibles
- Cargar cuestionario dinámico de la categoría seleccionada
- Validar respuestas en tiempo real
- Enviar solicitud al backend

**Endpoints a usar**:
```javascript
GET /api/contract-categories  // Listar categorías
GET /api/contract-categories/:id  // Obtener cuestionario
POST /api/contract-requests-v2  // Crear solicitud
```

**Estructura sugerida**:
```typescript
interface ContractRequestFormProps {}

const ContractRequestForm: React.FC = () => {
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [answers, setAnswers] = useState({});
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState('medium');

  // 1. Cargar categorías
  // 2. Seleccionar categoría
  // 3. Renderizar cuestionario dinámico
  // 4. Validar y enviar
}
```

---

### 2. **DynamicQuestionnaire.tsx** - Cuestionario Reutilizable
**Ubicación**: `/frontend/src/components/DynamicQuestionnaire.tsx`

**Funcionalidad**:
- Componente reutilizable para renderizar cuestionarios
- Soportar todos los tipos de pregunta:
  - text, textarea, number, date
  - email, phone
  - select, multiselect, radio, checkbox
- Validación en tiempo real
- Mostrar errores de validación

**Props**:
```typescript
interface DynamicQuestionnaireProps {
  questions: Question[];
  answers: Record<string, any>;
  onChange: (fieldName: string, value: any) => void;
  errors?: Record<string, string>;
}
```

---

### 3. **SupplierApprovals.tsx** - Aprobación de Terceros (Abogados)
**Ubicación**: `/frontend/src/components/SupplierApprovals.tsx`

**Funcionalidad**:
- Listar terceros pendientes de aprobación
- Ver detalles del tercero
- Aprobar tercero (un clic)
- Rechazar tercero (con razón obligatoria)
- Filtrar por estado: pending, approved, rejected
- Mostrar estadísticas

**Endpoints a usar**:
```javascript
GET /api/supplier-approvals/pending  // Pendientes
GET /api/supplier-approvals/all?status=...  // Filtrados
POST /api/supplier-approvals/:id/approve  // Aprobar
POST /api/supplier-approvals/:id/reject  // Rechazar
GET /api/supplier-approvals/stats  // Estadísticas
```

**Vista sugerida**:
```
┌─────────────────────────────────────────────┐
│ Terceros Pendientes de Aprobación          │
│ [Pendientes: 5] [Aprobados: 12] [...]     │
├─────────────────────────────────────────────┤
│ 📋 Proveedor XYZ                            │
│ NIT: 900123456-7                            │
│ Representante: Juan Pérez                   │
│ Creado por: María García                    │
│ [✅ Aprobar] [❌ Rechazar] [👁️ Ver Detalles]│
├─────────────────────────────────────────────┤
│ ... más terceros ...                        │
└─────────────────────────────────────────────┘
```

---

### 4. **ContractRequestApprovals.tsx** - Aprobación de Solicitudes (Abogados)
**Ubicación**: `/frontend/src/components/ContractRequestApprovals.tsx`

**Funcionalidad**:
- Listar solicitudes pendientes y en revisión
- Ver detalles completos de la solicitud
- Ver respuestas del cuestionario
- Auto-asignarse solicitud
- Aprobar solicitud (genera contrato automáticamente)
- Rechazar solicitud (con razón)
- Filtrar por estado y prioridad
- Dashboard con estadísticas

**Endpoints a usar**:
```javascript
GET /api/contract-requests-v2  // Listar solicitudes (filtradas por rol)
GET /api/contract-requests-v2/:id  // Ver detalles
POST /api/contract-requests-v2/:id/assign  // Auto-asignarse
POST /api/contract-requests-v2/:id/approve  // Aprobar
POST /api/contract-requests-v2/:id/reject  // Rechazar
GET /api/contract-requests-v2/stats/overview  // Estadísticas
```

**Vista sugerida**:
```
┌──────────────────────────────────────────────────┐
│ Solicitudes de Contratos                         │
│ [Pendientes: 8] [En revisión: 3] [...]          │
├──────────────────────────────────────────────────┤
│ Filtros: [Estado▾] [Prioridad▾] [Categoría▾]   │
├──────────────────────────────────────────────────┤
│ 📋 Contrato Laboral - Juan Pérez                 │
│ Categoría: Contrato Laboral | Prioridad: Alta   │
│ Solicitante: María García                        │
│ Fecha: 2025-11-04                                │
│ Estado: pending                                   │
│ [👤 Asignarme] [👁️ Ver Detalles]                 │
├──────────────────────────────────────────────────┤
│ ... más solicitudes ...                          │
└──────────────────────────────────────────────────┘

Modal de Detalles:
┌──────────────────────────────────────────────────┐
│ Detalles de la Solicitud                         │
├──────────────────────────────────────────────────┤
│ Título: Contrato Laboral - Juan Pérez            │
│ Categoría: Contrato Laboral                      │
│ Solicitante: María García                        │
│                                                   │
│ Respuestas del Cuestionario:                     │
│ • Tipo de contrato: Término indefinido           │
│ • Salario: $2,500,000 COP                        │
│ • Fecha inicio: 2025-11-15                       │
│ • Cargo: Desarrollador Senior                    │
│                                                   │
│ [✅ Aprobar y Generar Contrato]                  │
│ [❌ Rechazar Solicitud]                          │
│ [📝 Agregar Notas Legales]                       │
└──────────────────────────────────────────────────┘
```

---

## Integración en la Aplicación

### Actualizar Navbar.tsx
Agregar enlaces según el rol:

```typescript
// Para Admin
{user.role === 'super_admin' || companyRole === 'admin' && (
  <NavLink to="/contract-categories">
    Categorías de Contratos
  </NavLink>
)}

// Para Todos los usuarios
<NavLink to="/contract-request">
  Solicitar Contrato
</NavLink>

// Para Lawyer y Admin
{(companyRole === 'lawyer' || companyRole === 'admin') && (
  <>
    <NavLink to="/supplier-approvals">
      Aprobar Terceros
    </NavLink>
    <NavLink to="/contract-approvals">
      Aprobar Solicitudes
    </NavLink>
  </>
)}
```

### Actualizar App.tsx
Agregar rutas:

```typescript
import ContractCategoryManagement from './components/ContractCategoryManagement';
import ContractRequestForm from './components/ContractRequestForm';
import SupplierApprovals from './components/SupplierApprovals';
import ContractRequestApprovals from './components/ContractRequestApprovals';

// Dentro de Routes:
<Route
  path="/contract-categories"
  element={<ProtectedRoute><ContractCategoryManagement /></ProtectedRoute>}
/>
<Route
  path="/contract-request"
  element={<ProtectedRoute><ContractRequestForm /></ProtectedRoute>}
/>
<Route
  path="/supplier-approvals"
  element={<ProtectedRoute><SupplierApprovals /></ProtectedRoute>}
/>
<Route
  path="/contract-approvals"
  element={<ProtectedRoute><ContractRequestApprovals /></ProtectedRoute>}
/>
```

---

## Estilos Compartidos Sugeridos

Crear `/frontend/src/styles/shared.css` con clases comunes:

```css
/* Cards */
.approval-card {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  margin-bottom: 1rem;
}

/* Badges de estado */
.status-badge {
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 600;
}

.status-pending {
  background: #fef3c7;
  color: #92400e;
}

.status-approved {
  background: #d1fae5;
  color: #065f46;
}

.status-rejected {
  background: #fee2e2;
  color: #991b1b;
}

.status-in-review {
  background: #dbeafe;
  color: #1e40af;
}

/* Prioridades */
.priority-urgent {
  background: #fecaca;
  color: #991b1b;
}

.priority-high {
  background: #fed7aa;
  color: #9a3412;
}

.priority-medium {
  background: #fef3c7;
  color: #92400e;
}

.priority-low {
  background: #e5e7eb;
  color: #374151;
}

/* Dashboard stats */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
}

.stat-card {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.stat-number {
  font-size: 2rem;
  font-weight: 700;
  color: #1e293b;
}

.stat-label {
  color: #64748b;
  font-size: 0.875rem;
  margin-top: 0.5rem;
}
```

---

## Pruebas Recomendadas

### 1. Flujo Completo: Usuario Requester
```
1. Login como usuario con rol 'requester'
2. Navegar a "Solicitar Contrato"
3. Seleccionar categoría "Contrato Laboral"
4. Completar cuestionario
5. Enviar solicitud
6. Verificar que aparece en estado "pending"
```

### 2. Flujo Completo: Abogado
```
1. Login como usuario con rol 'lawyer'
2. Navegar a "Aprobar Solicitudes"
3. Ver solicitud pendiente
4. Auto-asignarse solicitud (estado → "in_review")
5. Ver detalles completos
6. Aprobar solicitud
7. Verificar que se generó el contrato automáticamente
```

### 3. Flujo de Terceros
```
1. Cualquier usuario crea un tercero
2. Login como abogado
3. Navegar a "Aprobar Terceros"
4. Ver tercero pendiente
5. Aprobar tercero
6. Verificar que ahora está disponible para contratos
```

---

## Notas de Implementación

1. **Validación Frontend**: Usar el endpoint `/api/contract-categories/:id/validate-answers` para validar antes de enviar

2. **Manejo de Errores**: Todos los endpoints retornan mensajes descriptivos en `error.response.data.error`

3. **Loading States**: Implementar indicadores de carga en todas las operaciones async

4. **Notificaciones**: Usar toast/alerts para feedback al usuario

5. **Responsive**: Todos los componentes deben ser responsive (móvil, tablet, desktop)

6. **Accesibilidad**: Labels apropiados, navegación por teclado, ARIA labels

---

## Comandos para Compilar

```bash
# Compilar frontend
cd frontend
npm run build

# El servidor backend automáticamente servirá el nuevo build
```

---

## Endpoints de Prueba con Postman/Insomnia

### Crear Categoría de Prueba
```http
POST http://localhost:3002/api/contract-categories
Headers:
  Authorization: Bearer YOUR_TOKEN
  X-Company-Id: YOUR_COMPANY_ID
  Content-Type: application/json

Body:
{
  "name": "Contrato Laboral",
  "description": "Contratos de trabajo para empleados",
  "color": "#10B981",
  "questionnaire": [
    {
      "question": "Tipo de contrato",
      "field_name": "contract_type",
      "type": "select",
      "options": ["Término fijo", "Término indefinido"],
      "required": true,
      "order": 1
    }
  ],
  "template": "TEMPLATE_ID",
  "requires_approval": true
}
```

---

**Fecha**: 2025-11-04
**Estado**: Backend 100% | Frontend 25% (1 de 4 componentes principales)
**Próximo paso**: Implementar los 3 componentes restantes según esta guía
