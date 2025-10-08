# ⚡ Inicio Rápido - 3 Pasos

## 1️⃣ Instalar Dependencias

Abre una terminal en la carpeta del proyecto y ejecuta:

```bash
npm run install:all
```

Esto instalará todas las dependencias necesarias para el backend y frontend.

## 2️⃣ Inicializar Base de Datos

```bash
cd backend
npm run init-db
```

Esto creará:
- ✅ Base de datos SQLite
- ✅ Empresa demo
- ✅ 3 usuarios de prueba
- ✅ Tipos de contratos
- ✅ Plantilla de ejemplo

## 3️⃣ Ejecutar el Sistema

Vuelve a la raíz del proyecto y ejecuta:

```bash
cd ..
npm run dev
```

Esto iniciará:
- 🔧 Backend en http://localhost:5000
- 🌐 Frontend en http://localhost:3000

## 🎉 ¡Listo!

Abre tu navegador en: **http://localhost:3000**

### Credenciales de Prueba

| Rol | Email | Contraseña |
|-----|-------|-----------|
| 👨‍💼 Administrador | admin@demo.com | 123456 |
| ⚖️ Abogado | abogado@demo.com | 123456 |
| 📝 Solicitante | solicitante@demo.com | 123456 |

## 🚦 ¿Qué Puedo Hacer?

### Como Administrador (admin@demo.com)
- ➕ Crear nuevas empresas
- 👥 Gestionar usuarios
- 📋 Crear tipos de contratos
- 📄 Crear plantillas de contratos
- 👀 Ver todas las solicitudes y contratos

### Como Abogado (abogado@demo.com)
- 📄 Crear plantillas
- ✅ Aprobar/Rechazar solicitudes
- 📝 Generar contratos
- 📊 Ver dashboard de solicitudes

### Como Solicitante (solicitante@demo.com)
- 📨 Crear solicitudes de contratos
- 👁️ Ver estado de mis solicitudes
- 📑 Acceder a mis contratos aprobados

## 🎯 Prueba Esto Primero

1. **Inicia sesión como Solicitante**
   - Email: solicitante@demo.com
   - Contraseña: 123456

2. **Crea una Nueva Solicitud**
   - Ve a "Solicitudes" → "Nueva Solicitud"
   - Selecciona la plantilla disponible
   - Completa los campos
   - Envía la solicitud

3. **Cambia a Abogado**
   - Cierra sesión
   - Inicia sesión con abogado@demo.com

4. **Revisa y Aprueba**
   - Ve a "Solicitudes"
   - Abre la solicitud que acabas de crear
   - Asígnate como abogado
   - Aprueba la solicitud

5. **Genera el Contrato**
   - Desde la misma solicitud aprobada
   - Haz clic en "Generar Contrato"

6. **Visualiza el Contrato**
   - Ve a "Contratos"
   - Abre el contrato generado
   - Puedes imprimirlo o descargarlo

## ❓ ¿Problemas?

### El comando `npm run install:all` no funciona
```bash
# Instala manualmente:
npm install
cd backend && npm install
cd ../frontend && npm install
```

### Error: "ENOENT: no such file or directory, open './database/contracts.db'"
```bash
# Asegúrate de ejecutar:
cd backend
npm run init-db
```

### Puerto 3000 o 5000 en uso
```bash
# Edita los puertos en:
# - backend/.env (PORT=5000)
# - frontend/vite.config.js (port: 3000)
```

### No puedo iniciar sesión
- Verifica que ejecutaste `npm run init-db`
- Revisa que el backend esté corriendo (http://localhost:5000/api/health)

## 📚 Siguiente Paso

Lee la **GUIA_DE_USO.md** para aprender todas las funcionalidades del sistema.

---

**¿Todo funcionando?** ¡Excelente! Ya puedes empezar a gestionar contratos. 🎊

