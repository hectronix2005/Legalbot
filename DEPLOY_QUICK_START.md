# ⚡ Deploy Rápido - MongoDB Atlas + Heroku

## 🚀 Comandos Rápidos

### 1. Configurar MongoDB Atlas (Primera vez)

1. Ve a https://www.mongodb.com/cloud/atlas/register
2. Crea cuenta y cluster FREE
3. Configura usuario y contraseña
4. Whitelist IP: `0.0.0.0/0` (Allow Access from Anywhere)
5. Obtén el connection string y agrégalo al nombre de la BD:
   ```
   mongodb+srv://usuario:password@cluster.xxxxx.mongodb.net/legal-contracts?retryWrites=true&w=majority
   ```

### 2. Configurar Heroku (Primera vez)

```bash
# Login
heroku login

# Crear app
heroku create tu-app-name

# Configurar variables de entorno
heroku config:set MONGODB_URI="tu_connection_string_aqui"
heroku config:set JWT_SECRET="tu_jwt_secret_super_seguro"
heroku config:set NODE_ENV="production"
heroku config:set UPLOAD_PATH="./uploads"

# Agregar remote
heroku git:remote -a tu-app-name
```

### 3. Deploy (Cada vez que hagas cambios)

**Opción A: Script Automatizado (Recomendado)**

**Linux/Mac:**
```bash
./scripts/deploy.sh "Mensaje del commit"
```

**Windows PowerShell:**
```powershell
.\scripts\deploy.ps1 "Mensaje del commit"
```

**Opción B: Manual**

```bash
# 1. Build frontend
npm run build

# 2. Commit cambios
git add .
git commit -m "Tu mensaje"

# 3. Deploy
git push heroku main
```

### 4. Inicializar Base de Datos (Primera vez)

```bash
heroku run "cd backend && node scripts/initMongoDB.js"
```

### 5. Verificar

```bash
# Abrir app
heroku open

# Ver logs
heroku logs --tail

# Health check
curl https://tu-app.herokuapp.com/api/health
```

---

## 📋 Checklist Rápido

- [ ] MongoDB Atlas configurado
- [ ] Connection string obtenido
- [ ] Heroku app creada
- [ ] Variables de entorno configuradas
- [ ] Frontend buildado (`npm run build`)
- [ ] Deploy hecho (`git push heroku main`)
- [ ] Base de datos inicializada
- [ ] App funcionando

---

## 🔧 Comandos Útiles

```bash
# Ver variables de entorno
heroku config

# Ver logs
heroku logs --tail

# Reiniciar app
heroku restart

# Ejecutar comando en servidor
heroku run "cd backend && node scripts/initMongoDB.js"

# Ver información de la app
heroku info

# Abrir app
heroku open
```

---

## ⚠️ Troubleshooting Rápido

**Error de conexión a MongoDB:**
- Verifica IP whitelist en Atlas (debe incluir 0.0.0.0/0)
- Verifica connection string: `heroku config:get MONGODB_URI`

**Frontend no aparece:**
- Build frontend: `npm run build`
- Verifica que `backend/public` existe

**Error en deploy:**
- Ver logs: `heroku logs --tail`
- Verifica Node version en `backend/package.json` (engines)

---

## 💡 Tips

1. **Siempre builda el frontend antes de deploy:**
   ```bash
   npm run build
   ```

2. **Verifica logs después de cada deploy:**
   ```bash
   heroku logs --tail
   ```

3. **MongoDB Atlas Free Tier:**
   - 512MB gratis
   - Perfecto para desarrollo y apps pequeñas
   - No requiere tarjeta de crédito

4. **Heroku:**
   - Requiere tarjeta de crédito (pero hay tier básico)
   - $5-7/mes mínimo
   - Auto-scaling disponible

---

¡Listo para deploy! 🚀

