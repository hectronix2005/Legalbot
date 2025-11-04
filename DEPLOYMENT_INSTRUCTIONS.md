# Instrucciones de Deployment a Heroku

## Estado Actual ✅

1. ✅ Backend preparado para Heroku (Procfile, .gitignore, engines)
2. ✅ Aplicación creada en Heroku: `legal-bot-backend-prod`
3. ✅ Variables de entorno configuradas (NODE_ENV, JWT_SECRET, MONGODB_URI)
4. ✅ Cambios comiteados a Git
5. ✅ MongoDB Atlas configurado y conectado
6. ✅ Backend desplegado y funcionando (v10)
7. ✅ Sistema de backups automáticos activado
8. ✅ Frontend preparado para Heroku (Procfile, package.json, static.json)
9. ✅ Frontend desplegado en Heroku: `legal-bot-frontend-prod`
10. ✅ Frontend conectado al backend de producción

**URLs de la aplicación**:
- **Frontend**: https://legal-bot-frontend-prod-61613cf280b0.herokuapp.com/
- **Backend API**: https://legal-bot-backend-prod-7df4b18ba0f7.herokuapp.com/

**Estado del deployment**: ACTIVO Y FUNCIONANDO
**Base de datos**: MongoDB Atlas - legal_bot
**Última versión**: Backend v10, Frontend v4 (2025-11-03)

## Usuarios de Prueba Creados

La base de datos en producción ha sido inicializada con los siguientes usuarios:

- **Super Admin**: superadmin@legalbot.com / 123456
- **Admin**: admin@demo.com / 123456
- **Abogado**: abogado@demo.com / 123456
- **Solicitante**: solicitante@demo.com / 123456

## Frontend Configurado

El frontend ha sido configurado para usar variables de entorno:

- **Desarrollo**: `frontend/.env` → http://localhost:5001/api
- **Producción**: `frontend/.env.production` → https://legal-bot-backend-prod-7df4b18ba0f7.herokuapp.com/api

## Pasos Pendientes 📋

### 1. Configurar MongoDB Atlas (Base de datos en la nube - GRATIS)

MongoDB Atlas ofrece 512MB gratis, perfecto para empezar.

**Paso a paso:**

1. Ve a https://www.mongodb.com/cloud/atlas/register
2. Crea una cuenta gratuita con Google o email
3. Crea un nuevo proyecto (ej: "LegalBot")
4. Crea un cluster:
   - Click en "Build a Database"
   - Selecciona "M0 Sandbox" (FREE)
   - Selecciona región más cercana (ej: AWS - us-east-1)
   - Click en "Create"
5. Configurar acceso:
   - **Database Access**:
     - Click en "Add New Database User"
     - Username: `legalbot-admin`
     - Password: Genera una contraseña segura (GUÁRDALA)
     - Database User Privileges: "Read and write to any database"
     - Click "Add User"
   - **Network Access**:
     - Click en "Add IP Address"
     - Click en "Allow Access from Anywhere" (0.0.0.0/0)
     - Click "Confirm"
6. Obtener cadena de conexión:
   - Ve a "Database" → "Connect"
     - Selecciona "Connect your application"
   - Copia la cadena de conexión:
     ```
     mongodb+srv://legalbot-admin:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
     ```
   - **IMPORTANTE**: Reemplaza `<password>` con la contraseña que generaste
   - Cambia el nombre de la base de datos al final: `...mongodb.net/legal-contracts?retryWrites=true&w=majority`

### 2. Configurar MongoDB en Heroku

Una vez que tengas la cadena de conexión de MongoDB Atlas:

```bash
cd "/Users/hectorneira/Documents/PROGRAMACION BACK UP/LEGAL-BOT/Legalbot/backend"

# Configurar MongoDB URI (reemplaza con tu URL real)
heroku config:set MONGODB_URI="mongodb+srv://legalbot-admin:TU_PASSWORD@cluster0.xxxxx.mongodb.net/legal-contracts?retryWrites=true&w=majority" -a legal-bot-backend-prod
```

### 3. Desplegar Backend a Heroku

```bash
# Ir al directorio raíz del proyecto
cd "/Users/hectorneira/Documents/PROGRAMACION BACK UP/LEGAL-BOT/Legalbot"

# Crear un subtree del backend para Heroku
git subtree push --prefix backend heroku main

# O si prefieres, crear un nuevo branch específico para el backend
git push heroku main:main
```

**Nota**: Como tu repositorio tiene tanto frontend como backend, Heroku necesita saber que debe desplegar solo la carpeta `backend`. Usamos `git subtree` para esto.

### 4. Verificar el Deployment

```bash
# Ver logs en tiempo real
heroku logs --tail -a legal-bot-backend-prod

# Ver el estado de la app
heroku ps -a legal-bot-backend-prod

# Abrir la app en el navegador
heroku open -a legal-bot-backend-prod
```

### 5. Inicializar la Base de Datos (Primera vez solamente)

Una vez desplegado, necesitas inicializar la base de datos con los datos iniciales:

```bash
# Ejecutar script de inicialización
heroku run node scripts/initMongoDB.js -a legal-bot-backend-prod

# Verificar que se crearon los datos
heroku run node scripts/health-check.js -a legal-bot-backend-prod
```

### 6. Configurar CORS para el Frontend

Cuando despliegues el frontend, necesitarás actualizar el CORS del backend:

```bash
# Agregar la URL del frontend a las variables de entorno
heroku config:set FRONTEND_URL="https://tu-frontend-url.vercel.app" -a legal-bot-backend-prod
```

## Frontend Deployment (Vercel - Recomendado)

El frontend React se despliega mejor en Vercel (gratis):

### 1. Instalar Vercel CLI

```bash
npm install -g vercel
```

### 2. Desplegar Frontend

```bash
cd "/Users/hectorneira/Documents/PROGRAMACION BACK UP/LEGAL-BOT/Legalbot/frontend"

# Login en Vercel
vercel login

# Desplegar
vercel

# Configurar variables de entorno en Vercel dashboard:
# REACT_APP_API_URL=https://legal-bot-backend-prod-7df4b18ba0f7.herokuapp.com
```

### 3. Actualizar API URL en Frontend

Antes de desplegar, asegúrate de que el frontend apunte al backend de Heroku:

En `frontend/.env.production`:
```
REACT_APP_API_URL=https://legal-bot-backend-prod-7df4b18ba0f7.herokuapp.com
```

## Comandos Útiles de Heroku

```bash
# Ver todas las apps
heroku apps

# Ver configuración de variables
heroku config -a legal-bot-backend-prod

# Reiniciar la app
heroku restart -a legal-bot-backend-prod

# Escalar dynos (si necesitas más recursos)
heroku ps:scale web=1 -a legal-bot-backend-prod

# Ver métricas
heroku logs --tail -a legal-bot-backend-prod

# Abrir dashboard de Heroku
heroku dashboard -a legal-bot-backend-prod
```

## Troubleshooting

### Error: "Application error"
```bash
heroku logs --tail -a legal-bot-backend-prod
```
Revisa los logs para ver el error específico.

### Error: "bad auth : Authentication failed" ⚠️ COMÚN

Este es el error más común al configurar MongoDB Atlas. Sigue estos pasos **EXACTAMENTE**:

#### Paso 1: Obtener las credenciales correctas desde MongoDB Atlas

1. Ve a https://cloud.mongodb.com/
2. Inicia sesión con tu cuenta (hectorn.personal@gmail.com)
3. Selecciona tu proyecto y cluster
4. En el menú izquierdo, haz clic en **"Database Access"**
5. Verás una lista de usuarios de base de datos

**IMPORTANTE**: El usuario de la base de datos NO es tu email. Es un nombre de usuario específico que creaste.

#### Paso 2: Crear un nuevo usuario de base de datos (Recomendado)

Si tienes dudas sobre las credenciales actuales, es mejor crear un usuario nuevo:

1. En "Database Access", haz clic en **"+ ADD NEW DATABASE USER"**
2. Selecciona **"Password"** como método de autenticación
3. Configura:
   - **Username**: `legalbot-admin` (sin @ ni caracteres especiales)
   - **Password**: Haz clic en "Autogenerate Secure Password" y **CÓPIALA INMEDIATAMENTE**
   - **Database User Privileges**: Selecciona "Atlas admin"
4. Haz clic en **"Add User"**

#### Paso 3: Verificar Network Access

1. En el menú izquierdo, haz clic en **"Network Access"**
2. Verifica que exista una entrada con IP: `0.0.0.0/0` (permitir desde cualquier lugar)
3. Si no existe, haz clic en **"+ ADD IP ADDRESS"**
4. Selecciona **"ALLOW ACCESS FROM ANYWHERE"**
5. Haz clic en **"Confirm"**

#### Paso 4: Obtener la cadena de conexión correcta

1. Ve a **"Database"** en el menú izquierdo
2. Haz clic en el botón **"Connect"** de tu cluster
3. Selecciona **"Connect your application"**
4. Copia la cadena de conexión. Debe verse así:
   ```
   mongodb+srv://legalbot-admin:<password>@cluster0.o16ucum.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0
   ```
5. **IMPORTANTE**: Reemplaza `<password>` con la contraseña que copiaste en el Paso 2
6. Agrega el nombre de la base de datos al final: `/legal_bot?retryWrites=true&w=majority&appName=Cluster0`

La URL final debe verse así:
```
mongodb+srv://legalbot-admin:TU_PASSWORD_AQUI@cluster0.o16ucum.mongodb.net/legal_bot?retryWrites=true&w=majority&appName=Cluster0
```

#### Paso 5: Configurar en Heroku

```bash
# Reemplaza TU_PASSWORD_AQUI con la contraseña real (sin < >)
heroku config:set MONGODB_URI="mongodb+srv://legalbot-admin:TU_PASSWORD_AQUI@cluster0.o16ucum.mongodb.net/legal_bot?retryWrites=true&w=majority&appName=Cluster0" -a legal-bot-backend-prod

# Reiniciar la app
heroku restart -a legal-bot-backend-prod

# Verificar logs
heroku logs --tail -a legal-bot-backend-prod
```

#### Paso 6: Verificar que funcione

Si ves este mensaje en los logs, ¡funcionó!:
```
✅ MongoDB conectado exitosamente
```

Si aún ves "bad auth", verifica:
1. Copiaste la contraseña EXACTAMENTE como la generó MongoDB Atlas (sin espacios)
2. No hay caracteres < > en la URL
3. El nombre de usuario es exactamente el que creaste (case-sensitive)

### Error: "Cannot connect to MongoDB"
Verifica que:
1. La cadena de conexión sea correcta
2. La contraseña no tenga caracteres especiales sin escapar
3. El IP 0.0.0.0/0 esté permitido en MongoDB Atlas

### Error: "Port already in use"
Heroku asigna el puerto automáticamente. Asegúrate de que `server.js` use:
```javascript
const PORT = process.env.PORT || 5001;
```

## Costos

- **Heroku**: Plan gratuito (dyno duerme después de 30 min de inactividad)
- **MongoDB Atlas**: 512MB gratis
- **Vercel**: Gratis para proyectos personales

## Seguridad

🔒 **IMPORTANTE**: Nunca subas el archivo `.env` a Git. Ya está en `.gitignore`.

## Próximos Pasos Después del Deployment

1. ✅ Probar la API en producción
2. ✅ Crear usuario super_admin inicial
3. ✅ Configurar backups automáticos en MongoDB Atlas
4. ✅ Configurar dominio personalizado (opcional)
5. ✅ Configurar SSL/HTTPS (Heroku lo hace automáticamente)

## Comandos Rápidos de Deployment

```bash
# Backend (desde raíz del proyecto)
cd "/Users/hectorneira/Documents/PROGRAMACION BACK UP/LEGAL-BOT/Legalbot"
git add .
git commit -m "feat: Actualización de backend"
git subtree push --prefix backend heroku main

# Frontend (desde frontend folder)
cd frontend
vercel --prod
```
