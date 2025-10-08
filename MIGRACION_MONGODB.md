# ⚡ Migración Rápida a MongoDB - 3 Pasos

## ✅ Ya Completado

El código del sistema ya está actualizado para usar MongoDB. Solo necesitas configurar la base de datos.

## 🚀 Pasos para Completar la Migración

### Paso 1: Crear Base de Datos MongoDB (5 minutos)

**Opción A - MongoDB Atlas (Recomendado - Cloud Gratis):**

1. Ve a https://www.mongodb.com/cloud/atlas/register
2. Crea cuenta gratis
3. Crea cluster Free (M0)
4. Crea usuario de base de datos
5. Permite acceso desde cualquier IP (0.0.0.0/0)
6. Copia tu string de conexión

**String de ejemplo:**
```
mongodb+srv://usuario:password@cluster.mongodb.net/legal-contracts
```

**Opción B - MongoDB Local:**

```bash
# Instalar MongoDB Community Server
# https://www.mongodb.com/try/download/community

# String de conexión local:
mongodb://localhost:27017/legal-contracts
```

### Paso 2: Configurar Variables de Entorno

Edita el archivo `backend/.env`:

```env
PORT=5000
JWT_SECRET=legal_contract_secret_key_2024_change_in_production
NODE_ENV=development

# Pega aquí tu string de MongoDB
MONGODB_URI=mongodb+srv://TU_USUARIO:TU_PASSWORD@cluster.mongodb.net/legal-contracts

UPLOAD_PATH=./uploads
```

### Paso 3: Inicializar y Ejecutar

```bash
# Terminal en: C:\Users\ASUS 2025\OneDrive\Documentos\CURSOR\LEGAL BOT\backend

# 1. Inicializar MongoDB con datos de prueba
npm run init-mongo

# 2. Volver a raíz
cd ..

# 3. Ejecutar el sistema
npm run dev
```

## 🎉 ¡Listo!

El sistema ahora usa MongoDB y estará disponible en:
- Frontend: http://localhost:3000
- Backend: http://localhost:5000

---

## 📊 Cambios Realizados

### ✅ Backend Actualizado:

- ✅ Mongoose instalado
- ✅ 6 modelos MongoDB creados:
  - User
  - Company
  - ContractTemplate (unificado con tipos)
  - ContractRequest
  - Contract
  - VersionHistory
  - ActivityLog

- ✅ 7 rutas actualizadas para MongoDB:
  - auth-mongo.js
  - companies-mongo.js
  - templates-mongo.js
  - requests-mongo.js
  - contracts-mongo.js
  - users-mongo.js
  - dashboard-mongo.js

- ✅ Configuración MongoDB
- ✅ Script de inicialización

### ✅ Frontend:

- ✅ Sin cambios necesarios
- ✅ API compatible 100%
- ✅ Mismas funcionalidades

---

## 🔄 Migración de Datos Existentes

Si tenías datos en SQLite y quieres migrarlos:

### Opción 1: Empezar desde Cero (Recomendado)

```bash
npm run init-mongo
```

Esto crea datos de prueba frescos en MongoDB.

### Opción 2: Migrar Datos de SQLite (Manual)

Los datos de SQLite están en: `backend/database/contracts.db`

Para migrar manualmente:
1. Exporta datos de SQLite
2. Usa un script personalizado para importar a MongoDB
3. O recrea los datos importantes manualmente

---

## 💡 Ventajas de MongoDB

### 🚀 Rendimiento:
- Consultas más rápidas
- Mejor manejo de concurrencia
- Escalabilidad horizontal

### 🔧 Funcionalidades:
- Búsquedas de texto completo
- Agregaciones complejas
- Índices geo-espaciales
- Transacciones ACID

### ☁️ Cloud-Ready:
- MongoDB Atlas incluido
- Backups automáticos
- Monitoreo en tiempo real
- Escalado automático

### 🔐 Seguridad:
- Encriptación en tránsito
- Encriptación en reposo
- Autenticación SCRAM-SHA
- Role-based access control

---

## 🌐 MongoDB Atlas Free Tier

**Incluye:**
- ✅ 512 MB de almacenamiento
- ✅ Conexiones compartidas
- ✅ Suficiente para 1000s de contratos
- ✅ Backups automáticos
- ✅ No requiere tarjeta de crédito
- ✅ Gratis para siempre

**Perfecto para:**
- ✅ Desarrollo
- ✅ MVPs
- ✅ Demos
- ✅ Empresas pequeñas

---

## 📝 Comparación de Configuración

### SQLite (Antes):
```bash
npm run init-db
npm run dev
```

### MongoDB (Ahora):
```bash
# 1. Configurar MONGODB_URI en .env
# 2. Inicializar
npm run init-mongo
# 3. Ejecutar
npm run dev
```

Solo 1 paso extra: configurar el string de conexión.

---

## 🎯 Siguiente Paso

**Lee el archivo `MONGODB_SETUP.md`** para instrucciones detalladas paso a paso con capturas de pantalla conceptuales.

---

## ❓ Preguntas Frecuentes

**P: ¿Necesito instalar MongoDB en mi computadora?**
R: No, con MongoDB Atlas funciona 100% en la nube.

**P: ¿Es gratis MongoDB Atlas?**
R: Sí, el Free Tier es gratis para siempre (hasta 512MB).

**P: ¿Pierdo mis datos de SQLite?**
R: Los datos de SQLite siguen en `backend/database/contracts.db` pero el sistema usará MongoDB.

**P: ¿Puedo volver a SQLite?**
R: Sí, solo cambia las importaciones de rutas en `server.js`.

**P: ¿Cuánto tarda configurar Atlas?**
R: 5-10 minutos total.

---

## 🎊 Beneficios Inmediatos

Una vez configurado MongoDB:

✅ Sistema más robusto
✅ Mejor rendimiento
✅ Listo para producción
✅ Backups automáticos
✅ Escalable a millones de contratos

---

**¿Listo para migrar?** Sigue las instrucciones en `MONGODB_SETUP.md` 🚀

