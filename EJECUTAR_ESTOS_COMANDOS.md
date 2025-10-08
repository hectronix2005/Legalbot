# ⚡ Ejecuta Estos Comandos Para Desplegar a Heroku

## 📋 Copia y Pega Estos Comandos en PowerShell

### Paso 1: Abrir PowerShell en el Frontend

Abre PowerShell y ejecuta:

```powershell
cd "C:\Users\ASUS 2025\OneDrive\Documentos\CURSOR\LEGAL BOT\frontend"

# Actualizar PATH
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
```

---

### Paso 2: Login en Heroku

```powershell
heroku login
```

**Presiona ENTER** cuando te lo pida.
Se abrirá tu navegador → Haz login con `hectorn.personal@gmail.com`
Cierra el navegador después de login exitoso.

---

### Paso 3: Crear App en Heroku

```powershell
heroku create legal-contracts-frontend
```

Verás algo como:
```
Creating legal-contracts-frontend... done
https://legal-contracts-frontend.herokuapp.com/ | https://git.heroku.com/legal-contracts-frontend.git
```

---

### Paso 4: Configurar Variable de Entorno

```powershell
heroku config:set VITE_API_URL=http://localhost:5000/api
```

*Nota: Esto es temporal. Cuando despliegues el backend, lo cambiarás.*

---

### Paso 5: Agregar Archivos a Git

```powershell
git add .
git commit -m "Deploy frontend to Heroku"
```

---

### Paso 6: ¡DESPLEGAR!

```powershell
git push heroku main
```

⏳ **Espera 2-3 minutos** mientras Heroku:
1. Recibe el código
2. Instala dependencias (npm install)
3. Construye el proyecto (npm run build)
4. Inicia el servidor

Verás algo como:
```
remote: -----> Build succeeded!
remote: -----> Discovering process types
remote:        Procfile declares types -> web
remote: -----> Compressing...
remote: -----> Launching...
remote:        Released v1
remote:        https://legal-contracts-frontend.herokuapp.com/ deployed to Heroku
```

---

### Paso 7: Abrir Tu App 🎉

```powershell
heroku open
```

Se abrirá tu navegador con: `https://legal-contracts-frontend.herokuapp.com`

---

## ⚠️ IMPORTANTE Después del Deploy

### El frontend estará en línea PERO:

❌ **No funcionará completamente** porque el backend está en `localhost:5000` (tu PC)

### Para que funcione 100%:

Necesitas **desplegar el backend también**. Opciones:

**A) Railway (GRATIS)** ⭐ Recomendado
```powershell
npm install -g @railway/cli
cd ../backend
railway login
railway init
railway up
```

**B) Heroku (PAGO $7/mes)**
```powershell
cd ../backend
heroku create legal-contracts-backend
heroku config:set MONGODB_URI=tu_string_mongodb
git add .
git commit -m "Deploy backend"
git push heroku main
```

Luego actualizar el frontend:
```powershell
cd ../frontend
heroku config:set VITE_API_URL=https://legal-contracts-backend.herokuapp.com/api
```

---

## 🎯 Resumen de URLs

Una vez desplegado todo:

| Componente | URL | Estado |
|------------|-----|--------|
| **Frontend** | https://legal-contracts-frontend.herokuapp.com | ⏳ Por desplegar |
| **Backend** | http://localhost:5000 | ✅ Local (funciona) |
| **MongoDB** | MongoDB Atlas | ✅ Conectado |

Para que funcione en internet:
- Frontend: ✅ Se desplegará a Heroku
- Backend: ⏳ Necesita deployment (Railway gratis o Heroku $7)

---

## 🚀 ¿Quieres que También Despliegue el Backend?

Si quieres el sistema **completamente en línea**, puedo ayudarte a:

**Opción 1**: Desplegar backend a **Railway** (GRATIS)
**Opción 2**: Desplegar backend a **Heroku** (PAGO $7/mes)

Dime qué prefieres y lo hago por ti.

---

## 📝 Ejecuta AHORA:

**Abre PowerShell** y copia estos comandos **UNO POR UNO**:

```powershell
cd "C:\Users\ASUS 2025\OneDrive\Documentos\CURSOR\LEGAL BOT\frontend"
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
heroku login
heroku create legal-contracts-frontend
heroku config:set VITE_API_URL=http://localhost:5000/api
git add .
git commit -m "Deploy frontend to Heroku"
git push heroku main
heroku open
```

---

**¿Algún error? Avísame y te ayudo. ¿Todo bien? ¡Disfruta tu app en línea! 🎉**

