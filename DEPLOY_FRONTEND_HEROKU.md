# 🚀 Deploy Frontend a Heroku - 3 Comandos

## ✅ Preparación Completada

Ya se configuró todo:
- ✅ Heroku CLI instalado
- ✅ Git instalado
- ✅ Repositorio Git inicializado
- ✅ `server.js` para servir archivos estáticos
- ✅ `Procfile` configurado
- ✅ package.json actualizado con scripts

## 🎯 Desplegar en 3 Pasos (5 minutos)

### Paso 1: Login en Heroku (1 min)

Abre PowerShell en la carpeta frontend y ejecuta:

```powershell
cd "C:\Users\ASUS 2025\OneDrive\Documentos\CURSOR\LEGAL BOT\frontend"

# Actualizar PATH
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

# Login (abrirá tu navegador)
heroku login
```

Presiona **cualquier tecla** cuando te lo pida, se abrirá tu navegador.
Haz login con tu cuenta de Heroku.

### Paso 2: Crear App en Heroku (30 seg)

```powershell
# Crear la app con un nombre único
heroku create legal-contracts-front

# O deja que Heroku genere un nombre aleatorio:
# heroku create
```

Anota la URL que te dará, algo como:
`https://legal-contracts-front.herokuapp.com`

### Paso 3: Configurar y Desplegar (2 min)

```powershell
# Configurar variable de entorno para el backend
heroku config:set VITE_API_URL=http://localhost:5000/api

# Agregar archivos a Git
git add .
git commit -m "Deploy frontend to Heroku"

# ¡Desplegar!
git push heroku main
```

**⏳ Espera 2-3 minutos mientras Heroku:**
1. Recibe el código
2. Instala dependencias
3. Ejecuta `npm run build` (genera el build de Vite)
4. Inicia el servidor

### Paso 4: Abrir la App 🎉

```powershell
heroku open
```

¡Tu frontend estará en línea!

---

## 🔧 Configuración de API URL

Una vez desplegado, necesitas apuntar al backend.

### Si tu backend está en Heroku también:

```powershell
# Reemplaza con la URL real de tu backend
heroku config:set VITE_API_URL=https://tu-backend-app.herokuapp.com/api
```

### Si tu backend está local:

Por ahora quedará apuntando a localhost. Necesitarás desplegar el backend también.

---

## 📋 Comandos Completos (Copia y Pega)

Abre PowerShell y ejecuta TODO esto:

```powershell
# Ir al frontend
cd "C:\Users\ASUS 2025\OneDrive\Documentos\CURSOR\LEGAL BOT\frontend"

# Actualizar PATH
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

# Login en Heroku (abrirá navegador)
heroku login

# Crear app
heroku create legal-contracts-front

# Configurar backend URL (temporal - localhost)
heroku config:set VITE_API_URL=http://localhost:5000/api

# Commit del código
git add .
git commit -m "Deploy frontend to Heroku"

# ¡DEPLOY!
git push heroku main

# Abrir en navegador
heroku open
```

---

## ⚠️ Importante: Backend

El frontend se desplegará, pero apuntará a `localhost:5000` que **no funcionará** porque el backend está en tu PC.

### Opciones:

**A) Desplegar backend también a Heroku** ($7/mes)
- Te puedo ayudar a hacerlo

**B) Usar el frontend solo localmente**
- Ya funciona en http://localhost:3000

**C) Backend en Railway (GRATIS)**
- Deploy el backend a Railway (gratis)
- Configura `VITE_API_URL` con la URL de Railway

---

## 🎯 Próximo Paso Recomendado

### Deploy Backend a Railway (GRATIS):

```bash
# Instalar Railway CLI
npm install -g @railway/cli

# Login
railway login

# Desde backend:
cd ../backend
railway init

# Configurar variables
railway variables set MONGODB_URI=tu_string_mongodb
railway variables set JWT_SECRET=tu_secret

# Deploy
railway up

# Obtener URL
railway domain
```

Luego actualiza el frontend:
```bash
heroku config:set VITE_API_URL=https://tu-backend.railway.app/api
```

---

## 📞 ¿Necesitas Ayuda?

**Ejecuta** los comandos de la sección "Comandos Completos" y si hay algún error, avísame.

**¿Quieres que también despliegue el backend?**
- Railway (GRATIS) 
- Heroku (PAGO $7/mes)
- Render (GRATIS con límites)

---

**¡Los archivos ya están preparados! Solo ejecuta los comandos y estarás en línea! 🚀**

