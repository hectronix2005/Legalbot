# Sistema de Gestión de Contratos Legales

Sistema completo de administración de plantillas de contratos con versionamiento, flujo de aprobación y gestión multi-empresa.

## 🚀 Características

- **Gestión de Plantillas**: Crea y administra plantillas de contratos con campos dinámicos
- **🆕 Carga de Archivos Word**: Sube documentos .docx y detecta automáticamente campos variables
- **Versionamiento**: Control completo de versiones de plantillas con historial de cambios
- **Multi-Empresa**: Soporte para múltiples empresas y tipos de contratos
- **Flujo de Aprobación**: Sistema de solicitudes con aprobación del área legal
- **Roles de Usuario**: 3 roles diferenciados (Administrador, Abogado, Solicitante)
- **Interfaz Moderna**: UI intuitiva y responsiva con Tailwind CSS
- **Generación de Contratos**: Creación automática de contratos en PDF y Word
- **Descarga en Word**: Los contratos se pueden descargar en formato Word editable

## 🎯 Roles del Sistema

### Administrador
- Gestión completa de empresas y usuarios
- Administración de tipos de contratos
- Creación y edición de plantillas
- Vista completa de todas las solicitudes y contratos

### Abogado
- Creación y edición de plantillas
- Revisión y aprobación de solicitudes
- Generación de contratos
- Asignación de solicitudes

### Solicitante
- Creación de solicitudes de contratos
- Seguimiento del estado de solicitudes
- Visualización de contratos aprobados

## 📋 Requisitos Previos

- Node.js (v16 o superior)
- npm o yarn

## 🛠️ Instalación

### Instalación Completa (Backend + Frontend)

```bash
# Instalar todas las dependencias
npm run install:all
```

### Instalación Manual

**Backend:**
```bash
cd backend
npm install
```

**Frontend:**
```bash
cd frontend
npm install
```

## 🚦 Inicialización de la Base de Datos

### Opción 1: MongoDB (Recomendado para Producción)

**Importante**: El sistema ahora usa MongoDB. Configuración rápida:

1. **Crea una cuenta en MongoDB Atlas** (gratis): https://www.mongodb.com/cloud/atlas/register
2. **Crea un cluster Free** (M0 - 512MB gratis)
3. **Obtén tu string de conexión**
4. **Configura `backend/.env`:**
   ```env
   MONGODB_URI=mongodb+srv://usuario:password@cluster.mongodb.net/legal-contracts
   ```
5. **Inicializa la BD:**
   ```bash
   cd backend
   npm run init-mongo
   ```

📖 **Guía detallada**: Lee `MONGODB_SETUP.md`

### Opción 2: SQLite (Solo Desarrollo Local)

```bash
cd backend
npm run init-db
```

Ambas opciones crean:
- ✅ Una empresa demo
- ✅ Usuarios de prueba (admin, abogado, solicitante)
- ✅ Plantilla de ejemplo con campos

## 🏃 Ejecución

### Modo Desarrollo (Todo el stack)

```bash
# Ejecutar backend y frontend simultáneamente
npm run dev
```

El sistema estará disponible en:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000

### Ejecución Individual

**Solo Backend:**
```bash
cd backend
npm run dev
```

**Solo Frontend:**
```bash
cd frontend
npm run dev
```

## 👤 Usuarios de Prueba

Después de inicializar la base de datos, puedes usar estas credenciales:

| Rol | Email | Contraseña |
|-----|-------|-----------|
| Administrador | admin@demo.com | 123456 |
| Abogado | abogado@demo.com | 123456 |
| Solicitante | solicitante@demo.com | 123456 |

## 📁 Estructura del Proyecto

```
LEGAL BOT/
├── backend/                 # API REST (Node.js + Express)
│   ├── config/             # Configuración de BD
│   ├── middleware/         # Autenticación y autorización
│   ├── routes/             # Rutas de la API
│   ├── scripts/            # Scripts de inicialización
│   ├── database/           # Base de datos SQLite
│   └── server.js           # Servidor principal
│
├── frontend/               # Aplicación React
│   ├── public/            # Archivos estáticos
│   ├── src/
│   │   ├── components/    # Componentes reutilizables
│   │   ├── context/       # Context API (Auth)
│   │   ├── pages/         # Páginas de la aplicación
│   │   ├── services/      # Servicios API
│   │   └── App.jsx        # Componente principal
│   └── package.json
│
└── package.json           # Scripts principales
```

## 🔐 Seguridad

- Autenticación basada en JWT
- Passwords hasheados con bcrypt
- Autorización por roles
- Validación de datos en backend

## 🎨 Tecnologías Utilizadas

### Backend
- Node.js
- Express.js
- SQLite3
- JWT para autenticación
- bcrypt para encriptación

### Frontend
- React 18
- React Router DOM
- Tailwind CSS
- Axios
- React Icons

## 📝 Flujo de Trabajo

1. **Administrador** crea tipos de contratos y plantillas
2. **Solicitante** crea una solicitud de contrato llenando los campos
3. **Abogado** revisa y aprueba/rechaza la solicitud
4. **Abogado** genera el contrato final una vez aprobado
5. El contrato queda disponible para visualización e impresión

## 🌟 Características Destacadas

### Gestión de Plantillas
- Editor de plantillas con variables dinámicas
- Campos personalizables (texto, número, fecha, email, select, textarea)
- Control de versiones automático
- Historial completo de cambios

### Sistema de Solicitudes
- Formularios dinámicos basados en plantillas
- Vista previa del contrato antes de aprobar
- Asignación de abogados
- Notas legales y motivos de rechazo

### Generación de Contratos
- Sustitución automática de variables
- Formato de impresión profesional
- Numeración única de contratos
- Estados de contrato (activo, terminado, expirado)

## 🔧 Configuración

Las variables de entorno se pueden configurar en `backend/.env`:

```env
PORT=5000
JWT_SECRET=tu_clave_secreta
NODE_ENV=development
DB_PATH=./database/contracts.db
```

## 📦 Build para Producción

```bash
# Build del frontend
npm run build

# Iniciar en producción
npm start
```

## 🤝 Contribución

Este es un proyecto de demostración. Para uso en producción, considera:

- Migrar a una base de datos más robusta (PostgreSQL, MySQL)
- Implementar envío de emails para notificaciones
- Agregar generación de PDFs con firmas digitales
- Implementar almacenamiento de archivos en la nube
- Agregar tests unitarios e integración

## 📄 Licencia

MIT License

## 👨‍💻 Autor

Desarrollado como sistema de gestión de contratos legales con tecnologías modernas.

---

**¿Necesitas ayuda?** Revisa la documentación en el código o contacta al equipo de desarrollo.

