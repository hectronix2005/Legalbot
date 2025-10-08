# 🚀 Desplegar Frontend en Heroku

## ⚠️ Nota Importante: Heroku ya no es Gratis

Desde noviembre 2022, Heroku eliminó su tier gratuito. Ahora cobra **$5-7/mes** mínimo.

### 💡 Alternativas GRATIS Recomendadas:

| Servicio | Costo | Mejor Para | Límites |
|----------|-------|------------|---------|
| **Vercel** ⭐ | Gratis | React/Next.js | 100GB bandwidth |
| **Netlify** ⭐ | Gratis | Frontend estático | 100GB bandwidth |
| **Railway** | Gratis | Full-stack | $5 crédito/mes |
| **Render** | Gratis | Full-stack | 750 hrs/mes |
| **Heroku** | $5-7/mes | Full-stack | Sin tier gratis |

---

## 🎯 Opción 1: Deploy a Vercel (GRATIS - Recomendado)

### Ventajas:
- ✅ Gratis ilimitado
- ✅ Especializado en React
- ✅ Deploy automático desde Git
- ✅ SSL gratis
- ✅ CDN global
- ✅ Dominio gratis (.vercel.app)

### Pasos:

#### A. Instalar Vercel CLI:
```bash
npm install -g vercel
```

#### B. Desde la carpeta frontend:
```bash
cd frontend
vercel login
```

#### C. Deploy:
```bash
vercel
```

Sigue las preguntas:
- Setup and deploy? **Y**
- Which scope? (tu cuenta)
- Link to existing project? **N**
- Project name? `legal-contracts-frontend`
- Directory? `./`
- Override settings? **N**

#### D. Configurar Variables:
```bash
vercel env add VITE_API_URL
```
Valor: URL de tu backend (ej: `https://tu-backend.herokuapp.com/api`)

#### E. Deploy a Producción:
```bash
vercel --prod
```

✅ ¡Listo! Te dará una URL: `https://legal-contracts-frontend.vercel.app`

---

## 🎯 Opción 2: Deploy a Netlify (GRATIS)

### Ventajas:
- ✅ Gratis ilimitado
- ✅ Muy fácil de usar
- ✅ Deploy desde Git
- ✅ SSL gratis

### Pasos:

#### A. Instalar Netlify CLI:
```bash
npm install -g netlify-cli
```

#### B. Build el proyecto:
```bash
cd frontend
npm run build
```

#### C. Deploy:
```bash
netlify login
netlify deploy
```

#### D. Deploy a producción:
```bash
netlify deploy --prod
```

---

## 🎯 Opción 3: Deploy a Heroku (PAGO $5-7/mes)

### Si decides pagar por Heroku:

#### A. Instalar Heroku CLI:
```bash
# Descargar de: https://devcenter.heroku.com/articles/heroku-cli
# O con npm:
npm install -g heroku
```

#### B. Login:
```bash
heroku login
```

#### C. Crear App:
```bash
cd frontend
heroku create legal-contracts-frontend
```

#### D. Configurar Variables:
```bash
heroku config:set VITE_API_URL=https://tu-backend.herokuapp.com/api
```

#### E. Deploy:
```bash
git init
git add .
git commit -m "Deploy to Heroku"
git push heroku main
```

#### F. Abrir:
```bash
heroku open
```

---

## 🎯 MI RECOMENDACIÓN ⭐

### Para Frontend React:

**1. Vercel** (Primera opción)
- Gratis ilimitado
- Mejor para React
- Deploy en 2 minutos

**2. Netlify** (Segunda opción)
- Gratis ilimitado
- Interface web fácil
- Deploy drag & drop

### Para Backend:

**1. Railway** (Recomendado)
- $5 crédito gratis/mes
- Soporta MongoDB
- Muy fácil

**2. Render**
- Tier gratis
- Bueno para Node.js

---

## ✅ Setup Completo con Vercel (GRATIS)

### Preparación (Ya hecha):
- ✅ server.js creado
- ✅ package.json actualizado
- ✅ Scripts de build listos

### Deploy en 3 comandos:

```bash
# 1. Instalar Vercel
npm install -g vercel

# 2. Login
vercel login

# 3. Deploy
cd "C:\Users\ASUS 2025\OneDrive\Documentos\CURSOR\LEGAL BOT\frontend"
vercel --prod
```

### Configurar Backend URL:

Una vez desplegado, configura la variable de entorno en Vercel dashboard:

- Key: `VITE_API_URL`
- Value: `http://localhost:5000/api` (temporal) o URL de tu backend en producción

---

## 🎊 Resumen de Costos

| Opción | Costo Frontend | Costo Backend | Total/mes |
|--------|----------------|---------------|-----------|
| **Vercel + Railway** | $0 | $5* | $5 |
| **Netlify + Render** | $0 | $0 | $0 |
| **Heroku (ambos)** | $7 | $7 | $14 |

*Railway da $5 crédito gratis/mes

---

## 🚀 ¿Qué Quieres Hacer?

**A) Vercel (GRATIS - Recomendado)**
- Dime y te guío paso a paso

**B) Netlify (GRATIS)**
- Dime y te ayudo

**C) Heroku (PAGO)**
- Si estás dispuesto a pagar, te ayudo

**D) Ver mi frontend localmente por ahora**
- Ya funciona en http://localhost:3000

---

**Mi recomendación**: Usa **Vercel para el frontend** (gratis, fácil, rápido) 🚀

¿Qué opción prefieres?

