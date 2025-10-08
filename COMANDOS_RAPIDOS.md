# 📝 Comandos Rápidos - Referencia

## 🚀 Instalación y Configuración

```bash
# Instalar todo (recomendado)
npm run install:all

# Inicializar base de datos con datos de prueba
cd backend
npm run init-db

# Volver al directorio raíz
cd ..
```

## ▶️ Ejecución

```bash
# Ejecutar backend + frontend simultáneamente
npm run dev

# Solo backend (puerto 5000)
npm run dev:backend

# Solo frontend (puerto 3000)
npm run dev:frontend
```

## 🔨 Producción

```bash
# Build del frontend
npm run build

# Ejecutar en producción
npm start
```

## 📂 Navegación Rápida

```bash
# Ir al backend
cd backend

# Ir al frontend
cd frontend

# Volver a raíz
cd ..
```

## 🔍 Verificación

```bash
# Verificar backend (debe retornar JSON)
curl http://localhost:5000/api/health

# O abrir en navegador:
# http://localhost:5000/api/health
```

## 🗂️ Estructura de Archivos Clave

```
LEGAL BOT/
├── README.md                    # Documentación principal
├── INICIO_RAPIDO.md            # Guía de inicio rápido
├── GUIA_DE_USO.md              # Manual completo
├── package.json                 # Scripts principales
│
├── backend/
│   ├── .env                    # Variables de entorno
│   ├── server.js               # Servidor principal
│   ├── config/database.js      # Configuración BD
│   ├── routes/                 # API endpoints
│   ├── middleware/auth.js      # Autenticación
│   └── scripts/initDatabase.js # Script de inicialización
│
└── frontend/
    ├── src/
    │   ├── App.jsx             # App principal
    │   ├── pages/              # Páginas del sistema
    │   ├── components/         # Componentes UI
    │   ├── context/AuthContext.jsx  # Autenticación
    │   └── services/api.js     # Servicios API
    └── vite.config.js          # Configuración Vite
```

## 🌐 URLs del Sistema

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000
- **Health Check**: http://localhost:5000/api/health

## 👤 Credenciales Demo

```
Admin:       admin@demo.com       / 123456
Abogado:     abogado@demo.com     / 123456
Solicitante: solicitante@demo.com / 123456
```

## 🛠️ Solución Rápida de Problemas

### Problema: Dependencias faltantes
```bash
npm run install:all
```

### Problema: Base de datos vacía
```bash
cd backend
npm run init-db
cd ..
```

### Problema: Puerto en uso
```bash
# Matar proceso en puerto 5000 (backend)
# Windows PowerShell:
Get-Process -Id (Get-NetTCPConnection -LocalPort 5000).OwningProcess | Stop-Process

# Matar proceso en puerto 3000 (frontend)
Get-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess | Stop-Process
```

### Problema: No aparecen plantillas
```bash
# Verificar que inicializaste la BD
cd backend
npm run init-db
```

### Problema: Error de autenticación
```bash
# Verifica que el backend esté corriendo
# Abre: http://localhost:5000/api/health
```

## 🎯 Tareas Comunes

### Crear Nueva Plantilla
1. Login como admin/abogado
2. Ir a "Plantillas"
3. Click "Nueva Plantilla"
4. Llenar formulario
5. Definir campos dinámicos
6. Guardar

### Solicitar Contrato
1. Login como solicitante
2. Ir a "Solicitudes"
3. Click "Nueva Solicitud"
4. Seleccionar plantilla
5. Completar datos
6. Enviar

### Aprobar Solicitud
1. Login como abogado
2. Ir a "Solicitudes"
3. Abrir solicitud pendiente
4. Asignarte (si no está asignada)
5. Revisar datos
6. Aprobar o Rechazar

### Generar Contrato
1. Login como abogado/admin
2. Ir a solicitud aprobada
3. Click "Generar Contrato"
4. Ver en sección "Contratos"

## 📊 API Endpoints Principales

```
POST   /api/auth/login              # Login
POST   /api/auth/register           # Registro

GET    /api/templates               # Listar plantillas
POST   /api/templates               # Crear plantilla
GET    /api/templates/:id           # Ver plantilla
PUT    /api/templates/:id           # Actualizar plantilla

GET    /api/requests                # Listar solicitudes
POST   /api/requests                # Crear solicitud
GET    /api/requests/:id            # Ver solicitud
PATCH  /api/requests/:id/approve    # Aprobar
PATCH  /api/requests/:id/reject     # Rechazar

GET    /api/contracts               # Listar contratos
POST   /api/contracts/generate/:id  # Generar contrato
GET    /api/contracts/:id           # Ver contrato

GET    /api/companies               # Listar empresas
GET    /api/users                   # Listar usuarios
GET    /api/contract-types          # Tipos de contrato
GET    /api/dashboard/stats         # Estadísticas
```

## 🔐 Roles y Permisos

| Acción | Admin | Abogado | Solicitante |
|--------|-------|---------|-------------|
| Ver plantillas | ✅ | ✅ | ✅ |
| Crear plantillas | ✅ | ✅ | ❌ |
| Crear solicitudes | ✅ | ✅ | ✅ |
| Aprobar solicitudes | ✅ | ✅ | ❌ |
| Generar contratos | ✅ | ✅ | ❌ |
| Gestionar empresas | ✅ | ❌ | ❌ |
| Gestionar usuarios | ✅ | ❌ | ❌ |
| Ver todos los contratos | ✅ | ✅ | Solo propios |

## 💾 Base de Datos

```bash
# Ubicación
backend/database/contracts.db

# Reinicializar (CUIDADO: Borra todos los datos)
cd backend
rm database/contracts.db
npm run init-db
```

## 🔄 Actualizar el Sistema

```bash
# Actualizar dependencias
npm run install:all

# O manualmente:
cd backend && npm install
cd ../frontend && npm install
```

---

**💡 Tip**: Guarda este archivo para referencia rápida durante el desarrollo.

