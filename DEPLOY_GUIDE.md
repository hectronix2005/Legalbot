# 🚀 Guía Completa de Deploy a MongoDB Atlas y Heroku

Esta guía te llevará paso a paso para desplegar tu aplicación Legal Bot en producción.

## 📋 Prerequisitos

1. Cuenta en [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) (gratis)
2. Cuenta en [Heroku](https://www.heroku.com) (requiere tarjeta de crédito, $5-7/mes mínimo)
3. [Heroku CLI](https://devcenter.heroku.com/articles/heroku-cli) instalado
4. [Git](https://git-scm.com/) instalado

---

## 🔵 Paso 1: Configurar MongoDB Atlas

### 1.1 Crear Cluster en MongoDB Atlas

1. Ve a https://www.mongodb.com/cloud/atlas/register
2. Crea una cuenta gratuita
3. Selecciona el plan **FREE (M0 Sandbox)**
4. Elige tu región (recomendado: AWS - US East o South America - São Paulo)
5. Nombre del cluster: `legal-contracts-cluster`
6. Haz clic en **"Create Cluster"**
7. Espera 3-5 minutos mientras se crea

### 1.2 Configurar Usuario de Base de Datos

1. En el menú lateral, ve a **"Database Access"**
2. Haz clic en **"Add New Database User"**
3. Configura:
   - **Authentication Method**: Password
   - **Username**: `legaladmin` (o el que prefieras)
   - **Password**: Genera una contraseña segura (¡GUÁRDALA!)
   - **Database User Privileges**: "Read and write to any database"
4. Haz clic en **"Add User"**

### 1.3 Configurar Acceso de Red

1. En el menú lateral, ve a **"Network Access"**
2. Haz clic en **"Add IP Address"**
3. Para desarrollo/producción, haz clic en **"Allow Access from Anywhere"** (0.0.0.0/0)
4. Haz clic en **"Confirm"**

### 1.4 Obtener String de Conexión

1. Ve a **"Database"** (ícono de base de datos en el menú lateral)
2. Haz clic en **"Connect"** en tu cluster
3. Selecciona **"Connect your application"**
4. Driver: **Node.js**
5. Version: **5.5 or later**
6. Copia el string de conexión, se verá así:

```
mongodb+srv://legaladmin:<password>@legal-contracts-cluster.xxxxx.mongodb.net/?retryWrites=true&w=majority
```

7. **Reemplaza `<password>`** con la contraseña que creaste
8. **Agrega el nombre de la base de datos** al final:

```
mongodb+srv://legaladmin:TU_PASSWORD@legal-contracts-cluster.xxxxx.mongodb.net/legal-contracts?retryWrites=true&w=majority
```

**⚠️ IMPORTANTE**: Guarda este string de conexión, lo necesitarás para Heroku.

---

## 🟣 Paso 2: Preparar el Proyecto para Heroku

### 2.1 Verificar que el Frontend esté Buildado

```bash
cd frontend
npm run build
cd ..
```

Esto creará la carpeta `frontend/build` con los archivos estáticos.

### 2.2 Copiar Build del Frontend al Backend

```bash
# Desde la raíz del proyecto
cp -r frontend/build backend/public
```

O en Windows:
```bash
xcopy /E /I frontend\build backend\public
```

### 2.3 Verificar Procfile

El `Procfile` en la raíz debe contener:

```
web: cd backend && node server.js
```

---

## 🟢 Paso 3: Configurar Heroku

### 3.1 Login en Heroku

```bash
heroku login
```

Esto abrirá tu navegador para autenticarte.

### 3.2 Crear App en Heroku

```bash
heroku create legal-bot-app
```

O si prefieres un nombre específico:
```bash
heroku create tu-nombre-app
```

### 3.3 Configurar Variables de Entorno

```bash
# MongoDB Atlas Connection String
heroku config:set MONGODB_URI="mongodb+srv://legaladmin:TU_PASSWORD@legal-contracts-cluster.xxxxx.mongodb.net/legal-contracts?retryWrites=true&w=majority"

# JWT Secret (genera uno seguro)
heroku config:set JWT_SECRET="tu_jwt_secret_super_seguro_aqui_cambiar_en_produccion"

# Node Environment
heroku config:set NODE_ENV="production"

# Port (Heroku lo asigna automáticamente, pero por si acaso)
heroku config:set PORT=3002

# Upload Path
heroku config:set UPLOAD_PATH="./uploads"
```

### 3.4 Verificar Variables Configuradas

```bash
heroku config
```

Deberías ver todas las variables que configuraste.

---

## 🚀 Paso 4: Deploy a Heroku

### 4.1 Inicializar Git (si no está inicializado)

```bash
git init
git add .
git commit -m "Initial commit for Heroku deploy"
```

### 4.2 Agregar Heroku como Remote

```bash
heroku git:remote -a legal-bot-app
```

### 4.3 Deploy

```bash
git push heroku main
```

O si tu rama principal es `master`:
```bash
git push heroku master
```

### 4.4 Ver Logs del Deploy

```bash
heroku logs --tail
```

Espera a ver el mensaje: `🚀 Servidor corriendo en http://localhost:XXXX`

---

## 🔧 Paso 5: Inicializar Base de Datos en Producción

### 5.1 Ejecutar Script de Inicialización

```bash
heroku run npm run init-mongo --prefix backend
```

O si prefieres ejecutar directamente:
```bash
heroku run "cd backend && node scripts/initMongoDB.js"
```

Esto creará:
- ✅ Empresa demo
- ✅ Usuarios de prueba (admin, abogado, solicitante)
- ✅ Plantillas de ejemplo

### 5.2 Verificar que Funciona

```bash
heroku open
```

Esto abrirá tu aplicación en el navegador.

O visita: `https://tu-app.herokuapp.com`

---

## 📝 Paso 6: Verificar el Deploy

### 6.1 Health Check

```bash
curl https://tu-app.herokuapp.com/api/health
```

Deberías recibir:
```json
{"status":"ok","message":"API de contratos funcionando correctamente"}
```

### 6.2 Ver Logs en Tiempo Real

```bash
heroku logs --tail
```

### 6.3 Abrir la Aplicación

```bash
heroku open
```

O visita directamente: `https://tu-app.herokuapp.com`

---

## 🔄 Actualizar el Deploy (cuando hagas cambios)

### 1. Build del Frontend

```bash
cd frontend
npm run build
cd ..
cp -r frontend/build backend/public
```

### 2. Commit y Push

```bash
git add .
git commit -m "Descripción de los cambios"
git push heroku main
```

### 3. Ver Logs

```bash
heroku logs --tail
```

---

## 🛠️ Comandos Útiles de Heroku

```bash
# Ver logs
heroku logs --tail

# Abrir aplicación
heroku open

# Ver variables de entorno
heroku config

# Ejecutar comando en el servidor
heroku run "cd backend && node scripts/initMongoDB.js"

# Reiniciar la aplicación
heroku restart

# Ver información de la app
heroku info

# Escalar dynos (cambiar plan)
heroku ps:scale web=1
```

---

## ⚠️ Troubleshooting

### Error: "MongoServerSelectionError"

**Problema**: No puede conectar a MongoDB Atlas

**Soluciones**:
1. Verifica que tu IP esté en la whitelist de MongoDB Atlas (Network Access)
2. Verifica que el string de conexión sea correcto en Heroku: `heroku config:get MONGODB_URI`
3. Verifica que el usuario y contraseña sean correctos
4. Espera unos minutos si recién creaste el cluster

### Error: "Frontend build no encontrado"

**Solución**:
```bash
cd frontend
npm run build
cd ..
cp -r frontend/build backend/public
git add backend/public
git commit -m "Add frontend build"
git push heroku main
```

### Error: "Cannot find module"

**Solución**:
```bash
# Verificar que todas las dependencias estén en package.json
cd backend
npm install
cd ..
git add .
git commit -m "Fix dependencies"
git push heroku main
```

### Error: "Port already in use"

**Solución**: Heroku asigna el puerto automáticamente. Asegúrate de usar `process.env.PORT` en tu código (ya está configurado).

---

## 📊 Monitoreo y Mantenimiento

### Ver Logs en Tiempo Real

```bash
heroku logs --tail
```

### Ver Métricas

Ve al dashboard de Heroku: https://dashboard.heroku.com/apps/tu-app

### Backups Automáticos

El sistema ya tiene configurado backups automáticos en MongoDB Atlas. Los backups se crean automáticamente cada hora.

---

## 💰 Costos Estimados

| Servicio | Plan | Costo Mensual |
|----------|------|---------------|
| MongoDB Atlas | Free Tier | $0 (512MB) |
| Heroku | Basic | $5-7/mes |
| **Total** | | **$5-7/mes** |

---

## ✅ Checklist de Deploy

- [ ] MongoDB Atlas cluster creado
- [ ] Usuario de base de datos configurado
- [ ] IP whitelist configurada (0.0.0.0/0)
- [ ] String de conexión obtenido
- [ ] Frontend buildado (`npm run build`)
- [ ] Build copiado a `backend/public`
- [ ] Heroku CLI instalado y login hecho
- [ ] App creada en Heroku
- [ ] Variables de entorno configuradas
- [ ] Git inicializado y commit hecho
- [ ] Deploy a Heroku exitoso
- [ ] Base de datos inicializada
- [ ] Health check funcionando
- [ ] Aplicación accesible en el navegador

---

## 🎉 ¡Listo!

Tu aplicación debería estar funcionando en producción. Si tienes problemas, revisa los logs con `heroku logs --tail` y verifica las variables de entorno con `heroku config`.

---

## 📞 Soporte

Si necesitas ayuda:
1. Revisa los logs: `heroku logs --tail`
2. Verifica variables: `heroku config`
3. Revisa el estado de MongoDB Atlas en su dashboard
4. Verifica que el frontend esté buildado correctamente

¡Feliz deploy! 🚀

