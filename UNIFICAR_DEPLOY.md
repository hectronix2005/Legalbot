# 🔄 Unificar Todo en legalbot-app

## ✅ Estado Actual

- ✅ **Heroku CLI:** Conectado (hectorn.personal@gmail.com)
- ✅ **MongoDB Atlas:** Conectado (legalbot)
- ✅ **App Backend:** legalbot-app (corriendo)
- ✅ **Frontend:** Configurado para usar rutas relativas (`/api`)
- ✅ **Build del Frontend:** Copiado a `backend/public`

## 🎯 Objetivo

Unificar frontend y backend en una sola app de Heroku: **legalbot-app**

---

## 📋 Pasos para Unificar

### 1. Verificar Configuración Actual

```bash
# Ver variables de entorno
heroku config --app legalbot-app

# Ver estado de la app
heroku ps --app legalbot-app

# Ver logs recientes
heroku logs --tail --num 50 --app legalbot-app
```

### 2. Build y Deploy

```bash
# Desde la raíz del proyecto
npm run build                    # Build frontend y copiar a backend/public
git add .
git commit -m "Unificar frontend y backend en legalbot-app"
git push heroku main
```

### 3. Verificar Deploy

```bash
# Ver logs del deploy
heroku logs --tail --app legalbot-app

# Abrir la app
heroku open --app legalbot-app

# Health check
curl https://legalbot-app-eb98284cb36f.herokuapp.com/api/health
```

---

## 🔧 Configuración Actual

### Variables de Entorno en legalbot-app:

- ✅ `MONGODB_URI`: mongodb+srv://LegalBot:***@cluster0.o16ucum.mongodb.net/legalbot
- ✅ `JWT_SECRET`: Configurado
- ✅ `NODE_ENV`: production

### Frontend API Configuration:

El frontend ya está configurado para usar rutas relativas:
- `API_BASE_URL = process.env.REACT_APP_API_URL || '/api'`

Esto significa que en producción usará `/api` automáticamente, que es perfecto para una app unificada.

---

## 🚀 Deploy Automatizado

Puedes usar el script de deploy:

**Linux/Mac:**
```bash
./scripts/deploy.sh "Unificar frontend y backend en legalbot-app"
```

**Windows:**
```powershell
.\scripts\deploy.ps1 "Unificar frontend y backend en legalbot-app"
```

---

## ✅ Verificación Post-Deploy

Después del deploy, verifica:

1. **Frontend carga correctamente:**
   ```bash
   curl https://legalbot-app-eb98284cb36f.herokuapp.com/
   ```

2. **API funciona:**
   ```bash
   curl https://legalbot-app-eb98284cb36f.herokuapp.com/api/health
   ```

3. **Rutas del frontend funcionan (SPA):**
   - Abre en navegador: https://legalbot-app-eb98284cb36f.herokuapp.com/
   - Navega a diferentes rutas
   - Verifica que todas funcionen

---

## 🗑️ Limpieza (Opcional)

Si quieres eliminar o desactivar la otra app frontend:

```bash
# Ver apps
heroku apps

# Eliminar app (CUIDADO: esto elimina la app permanentemente)
# heroku apps:destroy legal-bot-frontend-prod --confirm legal-bot-frontend-prod
```

**Nota:** Solo elimina la app si estás seguro de que no la necesitas.

---

## 📊 Estructura Unificada

```
legalbot-app (Heroku)
├── Backend (Express)
│   ├── API Routes (/api/*)
│   ├── Static Files (backend/public/*)
│   └── Uploads (backend/uploads/*)
└── Frontend (React SPA)
    └── Servido desde backend/public/*
```

**URLs:**
- Frontend: `https://legalbot-app-eb98284cb36f.herokuapp.com/`
- API: `https://legalbot-app-eb98284cb36f.herokuapp.com/api/*`

---

## 🎉 Ventajas de la Unificación

1. ✅ **Una sola app** - Más fácil de gestionar
2. ✅ **Una sola URL** - No hay problemas de CORS
3. ✅ **Menor costo** - Solo pagas por una app
4. ✅ **Deploy simplificado** - Un solo comando
5. ✅ **Rutas relativas** - Funciona automáticamente

---

## ⚠️ Notas Importantes

1. **No necesitas configurar `REACT_APP_API_URL`** en Heroku porque el frontend usa rutas relativas (`/api`)

2. **El build del frontend se hace automáticamente** durante `heroku-postbuild`

3. **El servidor ya está configurado** para servir archivos estáticos desde `backend/public`

4. **Todas las rutas del frontend funcionan** gracias al catch-all route (`app.get('*', ...)`)

---

## 🔄 Deploys Futuros

Cada vez que hagas cambios:

```bash
npm run build
git add .
git commit -m "Descripción de los cambios"
git push heroku main
```

O usa el script automatizado:
```bash
./scripts/deploy.sh "Descripción de los cambios"
```

---

¡Todo listo para unificar! 🚀

