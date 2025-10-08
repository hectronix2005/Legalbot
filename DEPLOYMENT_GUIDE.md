# 🚀 Guía de Deployment - MongoDB

## 📌 Resumen de Cambios

Tu sistema de gestión de contratos legales ahora está listo para **producción** con MongoDB.

## ✅ Lo que Se Ha Actualizado

### 1. **Base de Datos: SQLite → MongoDB**
- ✅ 6 Modelos de Mongoose creados
- ✅ Todas las rutas migradas
- ✅ Soporte para MongoDB Atlas (cloud)
- ✅ Soporte para MongoDB local
- ✅ Script de inicialización

### 2. **Sistema Unificado: Plantillas = Tipos de Contrato**
- ✅ Eliminada redundancia
- ✅ Menú simplificado
- ✅ Una sola sección para gestión

### 3. **Carga de Archivos Word**
- ✅ Detección automática de campos `{{variables}}`
- ✅ Procesamiento de documentos .docx
- ✅ Generación de contratos en Word
- ✅ Descarga de contratos editables

---

## 🎯 Opciones de Deployment

### Opción 1: MongoDB Atlas + Vercel/Netlify (Recomendado)

**Backend**: Railway, Render, Heroku
**Frontend**: Vercel, Netlify  
**Base de Datos**: MongoDB Atlas (gratis)

**Ventajas**:
- ✅ Gratis para empezar
- ✅ Escalable automáticamente
- ✅ SSL incluido
- ✅ CI/CD integrado

### Opción 2: VPS (Digital Ocean, AWS, etc.)

**Servidor**: Ubuntu 22.04 LTS
**MongoDB**: Atlas o instalado en el servidor
**Web Server**: Nginx como proxy

**Ventajas**:
- ✅ Control total
- ✅ Más económico a escala
- ✅ Customizable

### Opción 3: Docker + MongoDB Atlas

**Contenedores**:
- Backend en Docker
- Frontend en Docker o estático

**Base de Datos**: MongoDB Atlas

**Ventajas**:
- ✅ Portátil
- ✅ Fácil despliegue
- ✅ Reproducible

---

## 📋 Checklist para Producción

### 🔐 Seguridad

- [ ] Cambiar `JWT_SECRET` a una clave segura aleatoria
- [ ] Configurar CORS para dominios específicos
- [ ] Habilitar HTTPS
- [ ] Configurar rate limiting
- [ ] Validar todos los inputs
- [ ] Configurar helmet.js

### 🗄️ Base de Datos

- [ ] Crear cuenta MongoDB Atlas
- [ ] Crear cluster (Free o Paid)
- [ ] Configurar usuario y contraseña segura
- [ ] Configurar Network Access (IPs permitidas)
- [ ] Habilitar backups automáticos
- [ ] Configurar índices para optimización

### 🌐 Frontend

- [ ] Build de producción: `npm run build`
- [ ] Configurar variables de entorno de producción
- [ ] Optimizar assets
- [ ] Configurar CDN (opcional)

### 🔧 Backend

- [ ] Configurar variables de entorno
- [ ] Setup de logs (Winston, Morgan)
- [ ] Configurar PM2 para proceso
- [ ] Setup de monitoreo
- [ ] Configurar límites de archivos

### 📧 Features Adicionales (Opcional)

- [ ] Email notifications (SendGrid, Mailgun)
- [ ] SMS notifications (Twilio)
- [ ] Almacenamiento cloud (AWS S3, Cloudinary)
- [ ] Firma digital de contratos
- [ ] Audit logs completos

---

## 🚀 Deploy Rápido a Railway (Gratis)

### Backend en Railway:

1. **Instalar Railway CLI:**
```bash
npm install -g @railway/cli
```

2. **Login:**
```bash
railway login
```

3. **Iniciar proyecto:**
```bash
cd backend
railway init
```

4. **Configurar variables:**
```bash
railway variables set MONGODB_URI=tu_string_de_atlas
railway variables set JWT_SECRET=tu_secret_aleatorio
railway variables set NODE_ENV=production
```

5. **Deploy:**
```bash
railway up
```

6. **Obtén tu URL:**
```bash
railway domain
```

### Frontend en Vercel:

1. **Instalar Vercel CLI:**
```bash
npm install -g vercel
```

2. **Deploy:**
```bash
cd frontend
vercel
```

3. **Configurar variables:**
- En el dashboard de Vercel
- Agregar `VITE_API_URL` con tu URL de Railway

---

## 🔧 Configuraciones de Producción

### backend/.env (Producción):

```env
PORT=5000
JWT_SECRET=GENERA_UNA_CLAVE_ALEATORIA_LARGA_Y_SEGURA
NODE_ENV=production

# MongoDB Atlas
MONGODB_URI=mongodb+srv://usuario:password@cluster.mongodb.net/legal-contracts-prod

# Archivos (usar S3 en producción)
UPLOAD_PATH=./uploads
```

### frontend/.env.production:

```env
VITE_API_URL=https://tu-backend.railway.app/api
```

---

## 📊 Monitoreo y Mantenimiento

### MongoDB Atlas Dashboard:

- **Metrics**: CPU, Memory, Connections
- **Real-time**: Operaciones en tiempo real
- **Alerts**: Notificaciones automáticas
- **Logs**: Logs de queries lentas

### Herramientas Recomendadas:

- **Uptime Monitoring**: UptimeRobot (gratis)
- **Error Tracking**: Sentry
- **Analytics**: Google Analytics
- **Logs**: Papertrail, Loggly

---

## 💰 Costos Estimados

### Configuración Gratis (Ideal para empezar):

| Servicio | Costo | Límites |
|----------|-------|---------|
| MongoDB Atlas Free | $0/mes | 512MB |
| Railway | $0/mes | 500 hrs/mes |
| Vercel | $0/mes | 100GB bandwidth |
| **Total** | **$0/mes** | Suficiente para 100-1000 usuarios |

### Configuración Profesional:

| Servicio | Costo Aprox | Capacidad |
|----------|-------------|-----------|
| MongoDB Atlas M10 | $57/mes | 10GB |
| Railway Pro | $5/mes | Ilimitado |
| Vercel Pro | $20/mes | 1TB bandwidth |
| **Total** | **~$82/mes** | Miles de usuarios |

---

## 🎓 Tutoriales Recomendados

### MongoDB Atlas Setup:
https://www.mongodb.com/docs/atlas/getting-started/

### Railway Deployment:
https://docs.railway.app/

### Vercel Deploy:
https://vercel.com/docs

---

## 🆘 Troubleshooting Común

### Error: "Connection refused"
**Solución**: Verifica que MongoDB esté corriendo o que el string de Atlas sea correcto

### Error: "Authentication failed"
**Solución**: Verifica usuario y contraseña en MongoDB Atlas

### Error: "IP not whitelisted"
**Solución**: Agrega tu IP en Network Access de Atlas (o usa 0.0.0.0/0)

### Error: "Module not found"
**Solución**: Ejecuta `npm install` en backend y frontend

---

## 📞 Soporte

**Documentación Completa**:
- `MONGODB_SETUP.md` - Setup detallado de MongoDB
- `MIGRACION_MONGODB.md` - Guía de migración
- `README.md` - Documentación general

**MongoDB Support**:
- Atlas Docs: https://www.mongodb.com/docs/atlas/
- Community Forums: https://www.mongodb.com/community/forums/

---

## ✨ Próximos Pasos Sugeridos

1. ✅ Configurar MongoDB Atlas
2. ✅ Inicializar datos
3. ✅ Probar localmente
4. 📦 Deploy a Railway/Render
5. 🌐 Deploy frontend a Vercel
6. 🔐 Configurar dominio y SSL
7. 📧 Agregar notificaciones por email
8. 📱 App móvil (opcional)

---

**¡Tu sistema está listo para producción! 🎉**

