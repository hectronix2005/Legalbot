# 🚀 Configuración de MongoDB para el Sistema

El sistema ahora usa **MongoDB** en lugar de SQLite para mayor escalabilidad y funcionalidades avanzadas.

## ⚡ Opción Recomendada: MongoDB Atlas (Cloud - GRATIS)

La forma más fácil y rápida de usar MongoDB es con **MongoDB Atlas**, el servicio cloud gratuito de MongoDB.

### 📋 Pasos para Configurar MongoDB Atlas:

#### 1. Crear Cuenta Gratis

1. Ve a: https://www.mongodb.com/cloud/atlas/register
2. Regístrate con tu email
3. Selecciona el plan **FREE** (M0 Sandbox - Gratis para siempre)
4. Elige tu región (recomendado: AWS - São Paulo o US East)

#### 2. Crear un Cluster

1. Haz clic en **"Build a Database"**
2. Selecciona **FREE (Shared)**
3. Selecciona proveedor y región
4. Nombre del cluster: `legal-contracts` (o el que prefieras)
5. Haz clic en **"Create"**
6. Espera 3-5 minutos mientras se crea

#### 3. Configurar Acceso

**A. Crear Usuario de Base de Datos:**
1. Ve a **"Database Access"** en el menú lateral
2. Clic en **"Add New Database User"**
3. Username: `legaladmin` (o el que prefieras)
4. Password: Genera una contraseña segura (guárdala!)
5. Database User Privileges: **"Read and write to any database"**
6. Clic en **"Add User"**

**B. Configurar Acceso a Red:**
1. Ve a **"Network Access"** en el menú lateral
2. Clic en **"Add IP Address"**
3. Clic en **"Allow Access from Anywhere"** (0.0.0.0/0)
   - Para desarrollo está bien
   - Para producción, usa tu IP específica
4. Clic en **"Confirm"**

#### 4. Obtener String de Conexión

1. Ve a **"Database"** (ícono de base de datos)
2. En tu cluster, haz clic en **"Connect"**
3. Selecciona **"Connect your application"**
4. Driver: **Node.js**
5. Version: **4.1 or later**
6. Copia el string de conexión, se verá así:

```
mongodb+srv://legaladmin:<password>@legal-contracts.xxxxx.mongodb.net/?retryWrites=true&w=majority
```

7. **Reemplaza `<password>`** con la contraseña que creaste

#### 5. Configurar en el Proyecto

Actualiza el archivo `backend/.env`:

```env
PORT=5000
JWT_SECRET=legal_contract_secret_key_2024_change_in_production
NODE_ENV=development

# MongoDB Atlas (reemplaza con tu string de conexión)
MONGODB_URI=mongodb+srv://legaladmin:TU_PASSWORD_AQUI@legal-contracts.xxxxx.mongodb.net/legal-contracts?retryWrites=true&w=majority

UPLOAD_PATH=./uploads
```

**⚠️ IMPORTANTE**: Reemplaza:
- `legaladmin` con tu usuario
- `TU_PASSWORD_AQUI` con tu contraseña
- `legal-contracts.xxxxx` con tu cluster real

#### 6. Inicializar la Base de Datos

```bash
cd backend
npm run init-mongo
```

Esto creará:
- ✅ Empresa demo
- ✅ 3 usuarios (admin, abogado, solicitante)
- ✅ Plantilla de ejemplo

#### 7. Iniciar el Sistema

```bash
cd ..
npm run dev
```

¡Listo! El sistema ahora usa MongoDB Atlas.

---

## 🖥️ Opción 2: MongoDB Local (Avanzado)

Si prefieres instalar MongoDB localmente:

### Windows:

1. **Descargar MongoDB:**
   - Ve a: https://www.mongodb.com/try/download/community
   - Selecciona: Windows, MSI
   - Descarga e instala

2. **Instalar MongoDB:**
   - Ejecuta el instalador
   - Selecciona "Complete"
   - Marca "Install MongoDB as a Service"
   - Marca "Install MongoDB Compass" (GUI opcional)

3. **Verificar Instalación:**
```bash
mongod --version
```

4. **Iniciar MongoDB:**
```bash
# MongoDB debería iniciarse automáticamente como servicio
# Para verificar:
net start MongoDB
```

5. **Configurar .env:**
```env
MONGODB_URI=mongodb://localhost:27017/legal-contracts
```

6. **Inicializar:**
```bash
cd backend
npm run init-mongo
```

---

## 🔧 Troubleshooting

### Error: "MongooseServerSelectionError"

**Problema**: No puede conectar a MongoDB

**Soluciones**:
1. Verifica que tu string de conexión sea correcto
2. Verifica que tu IP esté en la whitelist (Network Access en Atlas)
3. Verifica que el usuario y contraseña sean correctos
4. Espera unos minutos si recién creaste el cluster

### Error: "Authentication failed"

**Solución**:
1. Verifica usuario y contraseña en MongoDB Atlas
2. Asegúrate de reemplazar `<password>` en el string de conexión
3. No uses caracteres especiales en la contraseña (o encodifica)

### Error: "ECONNREFUSED"

**Solución**:
- Si usas MongoDB local, asegúrate de que el servicio esté corriendo:
  ```bash
  net start MongoDB
  ```

---

## ✅ Verificar que Funciona

1. **Health Check del Backend:**
```bash
curl http://localhost:5000/api/health
```

Deberías ver:
```json
{"status":"ok","message":"API de contratos funcionando correctamente"}
```

2. **Login de Prueba:**
Ve a http://localhost:3000
- Email: `admin@demo.com`
- Password: `123456`

Si puedes iniciar sesión, ¡MongoDB está funcionando!

---

## 📊 Ventajas de MongoDB vs SQLite

| Característica | SQLite | MongoDB |
|----------------|--------|---------|
| Escalabilidad | Limitada | Alta |
| Concurrencia | Básica | Excelente |
| Cloud Ready | No | Sí |
| Replicación | No | Sí |
| Búsquedas Complejas | Limitadas | Avanzadas |
| Transacciones | Básicas | Completas |
| Producción | Solo apps pequeñas | Empresarial |

---

## 🎯 Recomendación

Para este sistema de gestión de contratos:

**Desarrollo**: MongoDB Atlas Free Tier
**Producción**: MongoDB Atlas Paid Tier o Dedicated Cluster

---

## 📞 ¿Necesitas Ayuda?

1. **MongoDB Atlas Free Tier**: 512MB gratis para siempre
2. **No requiere tarjeta de crédito**
3. **Setup en 5 minutos**
4. **Incluye backups automáticos**

---

**¡Comienza con MongoDB Atlas ahora!** 🚀

