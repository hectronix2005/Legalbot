# ⚡ Setup MongoDB en 5 Minutos

## 🎯 Objetivo

Configurar MongoDB Atlas (gratis) para el sistema de contratos.

## 📋 Pasos Rápidos

### 1. Crear Cuenta (2 min)

👉 Ir a: https://www.mongodb.com/cloud/atlas/register

- Registrarse con email
- Verificar email
- Login

### 2. Crear Cluster Free (1 min)

- Clic en **"Build a Database"**
- Seleccionar **"M0 FREE"**  
- Provider: AWS
- Region: US East (o más cercano)
- Cluster Name: `legal-contracts`
- Clic en **"Create"**

⏳ Espera 3-5 minutos...

### 3. Crear Usuario (1 min)

- Ve a **"Database Access"** (menú izquierdo)
- Clic **"Add New Database User"**
- Username: `legaladmin`
- Password: `Legal2024!` (o genera una)
- Rol: **"Atlas Admin"** o **"Read and write to any database"**
- Clic **"Add User"**

### 4. Permitir Acceso (30 seg)

- Ve a **"Network Access"** (menú izquierdo)
- Clic **"Add IP Address"**
- Clic **"Allow Access from Anywhere"**
- IP: `0.0.0.0/0`
- Clic **"Confirm"**

### 5. Obtener String de Conexión (30 seg)

- Ve a **"Database"** (menú izquierdo)
- Clic **"Connect"** en tu cluster
- Selecciona **"Connect your application"**
- Driver: **Node.js**
- Copia el string que se ve así:

```
mongodb+srv://legaladmin:<password>@legal-contracts.xxxxx.mongodb.net/
```

### 6. Configurar en el Proyecto (1 min)

Abre: `C:\Users\ASUS 2025\OneDrive\Documentos\CURSOR\LEGAL BOT\backend\.env`

Reemplaza el contenido con:

```env
PORT=5000
JWT_SECRET=legal_contract_secret_key_2024_change_in_production
NODE_ENV=development

# Pega aquí TU string de MongoDB Atlas
# Reemplaza <password> con tu contraseña real
MONGODB_URI=mongodb+srv://legaladmin:Legal2024!@legal-contracts.xxxxx.mongodb.net/legal-contracts?retryWrites=true&w=majority

UPLOAD_PATH=./uploads
```

**⚠️ IMPORTANTE**: 
- Reemplaza `Legal2024!` con tu contraseña
- Reemplaza `legal-contracts.xxxxx` con tu cluster real

### 7. Inicializar Datos (30 seg)

Abre PowerShell en el proyecto:

```powershell
cd "C:\Users\ASUS 2025\OneDrive\Documentos\CURSOR\LEGAL BOT\backend"

# Actualizar PATH para que node funcione
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

# Inicializar MongoDB
npm run init-mongo
```

Deberías ver:
```
✅ Conectado a MongoDB
📊 Base de datos: legal-contracts
✅ Empresa demo creada
✅ Usuarios demo creados
✅ Plantilla de ejemplo creada
```

### 8. Ejecutar el Sistema (30 seg)

```powershell
cd ..
npm run dev
```

**O en dos terminales:**

Terminal 1:
```powershell
cd "C:\Users\ASUS 2025\OneDrive\Documentos\CURSOR\LEGAL BOT\backend"
npm run dev
```

Terminal 2:
```powershell
cd "C:\Users\ASUS 2025\OneDrive\Documentos\CURSOR\LEGAL BOT\frontend"
npm run dev
```

### 9. ¡Probar! (1 min)

Abre: http://localhost:3000

Login con:
- Email: `admin@demo.com`
- Password: `123456`

---

## 🎉 ¡LISTO!

Total de tiempo: **~5-10 minutos**

---

## 📸 Capturas de Referencia (Conceptuales)

### MongoDB Atlas - Crear Cluster:

```
┌─────────────────────────────────────┐
│  Choose a path                      │
│  ○ Serverless                       │
│  ○ Dedicated                        │
│  ● Shared        [FREE]             │
│                                     │
│  Cloud Provider: [AWS ▼]           │
│  Region: [US East (N. Virginia) ▼] │
│                                     │
│  Cluster Name: legal-contracts     │
│                                     │
│  [Create Cluster]                   │
└─────────────────────────────────────┘
```

### Database Access - Crear Usuario:

```
┌─────────────────────────────────────┐
│  Add New Database User              │
│                                     │
│  Authentication Method:             │
│  ● Password                         │
│                                     │
│  Username: legaladmin               │
│  Password: ●●●●●●●●                 │
│  [ Autogenerate ]                   │
│                                     │
│  Database User Privileges:          │
│  ● Atlas Admin                      │
│                                     │
│  [Add User]                         │
└─────────────────────────────────────┘
```

### Network Access - IP:

```
┌─────────────────────────────────────┐
│  Add IP Access List Entry           │
│                                     │
│  Access List Entry:                 │
│  ● Allow access from anywhere       │
│     0.0.0.0/0                       │
│                                     │
│  Comment: Development access        │
│                                     │
│  [Confirm]                          │
└─────────────────────────────────────┘
```

### Connect - String:

```
┌─────────────────────────────────────┐
│  Connect to legal-contracts         │
│                                     │
│  Connect your application           │
│                                     │
│  Driver: Node.js                    │
│  Version: 4.1 or later              │
│                                     │
│  Connection String:                 │
│  ┌─────────────────────────────┐   │
│  │ mongodb+srv://legaladmin:   │   │
│  │ <password>@legal-contracts. │   │
│  │ xxxxx.mongodb.net/          │   │
│  │                             │   │
│  │ [📋 Copy]                   │   │
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘
```

---

## ✅ Verificación

### Verificar Conexión a MongoDB:

```bash
# En backend
node -e "require('./config/mongodb')().then(() => console.log('✅ Conectado')).catch(e => console.log('❌', e.message))"
```

### Verificar API:

```bash
curl http://localhost:5000/api/health
```

Debería retornar:
```json
{"status":"ok","message":"API de contratos funcionando correctamente"}
```

---

## 🔄 Cambiar Entre SQLite y MongoDB

### Usar SQLite (Desarrollo):

En `server.js`, cambia:
```javascript
const authRoutes = require('./routes/auth');
// ... (rutas sin -mongo)
```

### Usar MongoDB (Producción):

En `server.js`, cambia:
```javascript
const authRoutes = require('./routes/auth-mongo');
// ... (rutas con -mongo)
```

**Ya está configurado para MongoDB por defecto** ✅

---

## 🎯 Siguiente Paso

**Ahora mismo**: Completa los 9 pasos arriba (5-10 min)

**Después**: Lee `DEPLOYMENT_GUIDE.md` para deploy a producción

---

## 📞 ¿Problemas?

### No puedo crear cuenta en Atlas
- Usa otro email
- Revisa spam por email de verificación

### Error "MongooseServerSelectionError"
- Verifica string de conexión
- Verifica Network Access (0.0.0.0/0)
- Espera si recién creaste el cluster

### No veo datos en el dashboard
- Ejecutaste `npm run init-mongo`?
- Verifica en MongoDB Atlas → Browse Collections

---

**¡A configurar MongoDB Atlas! ⚡**

Tiempo estimado: **5-10 minutos** ⏱️

