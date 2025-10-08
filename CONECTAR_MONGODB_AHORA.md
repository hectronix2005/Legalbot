# ⚡ Conectar a MongoDB AHORA - Paso a Paso

## 🎯 Tienes 2 Opciones:

---

## Opción 1: Ya tengo cuenta de MongoDB Atlas

Si ya tienes una cuenta en MongoDB Atlas:

1. **Ir a**: https://cloud.mongodb.com
2. **Login** con tu cuenta
3. **Ir a** tu cluster
4. **Clic en "Connect"**
5. **Seleccionar** "Connect your application"
6. **Copiar** el string de conexión

**Luego dame ese string y lo configuro automáticamente**

---

## Opción 2: Crear cuenta MongoDB Atlas AHORA (5 min - GRATIS)

### Paso 1: Crear Cuenta ⏱️ 1 minuto

1. Abre: https://www.mongodb.com/cloud/atlas/register
2. Completa el formulario:
   - Email
   - Contraseña
   - Nombre
3. Acepta términos
4. Clic **"Get started free"**
5. Verifica tu email

### Paso 2: Crear Cluster Free ⏱️ 30 segundos + 3 min espera

1. Te preguntará "What brings you here?" → Selecciona cualquiera
2. Clic **"Build a Database"**
3. Selecciona **"M0 - FREE"** (el primero que dice FREE)
4. Configuración:
   - Provider: **AWS**
   - Region: **us-east-1** (N. Virginia) o el más cercano
   - Cluster Name: `legal-contracts`
5. Clic **"Create Deployment"**

⏳ **Espera 3-5 minutos** mientras se crea el cluster...

### Paso 3: Crear Usuario de BD ⏱️ 30 segundos

Mientras se crea el cluster, te pedirá crear un usuario:

1. Username: `legaladmin`
2. **Password**: `Legal2024!` (GUARDA ESTA PASSWORD!)
3. Clic **"Create Database User"**

### Paso 4: Configurar IP ⏱️ 30 segundos

1. Te preguntará "Where would you like to connect from?"
2. Selecciona **"My Local Environment"**
3. Clic **"Add My Current IP Address"**
4. O mejor: Clic **"Add a Different IP Address"**
   - IP Address: `0.0.0.0/0`
   - Description: `Allow all`
5. Clic **"Add Entry"**
6. Clic **"Finish and Close"**

### Paso 5: Obtener String de Conexión ⏱️ 30 segundos

1. Clic **"Go to Database"**
2. En tu cluster, clic **"Connect"**
3. Selecciona **"Drivers"**
4. Driver: **Node.js**
5. Version: **4.1 or later**
6. **COPIA** el string que aparece:

```
mongodb+srv://legaladmin:<password>@legal-contracts.xxxxx.mongodb.net/?retryWrites=true&w=majority
```

7. **REEMPLAZA** `<password>` con `Legal2024!`
8. **AGREGA** `/legal-contracts` antes de `?`

**String Final**:
```
mongodb+srv://legaladmin:Legal2024!@legal-contracts.xxxxx.mongodb.net/legal-contracts?retryWrites=true&w=majority
```

(Reemplaza `xxxxx` con tu cluster real que aparecerá)

---

## ✅ Una vez que tengas tu String de Conexión

**DÍMELO** y yo lo configuraré automáticamente en el sistema.

O configúralo tú mismo:

1. Abre: `backend\.env`
2. Busca la línea: `MONGODB_URI=...`
3. Reemplaza con tu string de Atlas
4. Guarda

Luego ejecuta:
```powershell
cd backend
npm run init-mongo
```

---

## ❓ ¿Cuál Opción Prefieres?

**A)** Ya tengo Atlas → Dame el string

**B)** Voy a crear cuenta ahora → Sigue Opción 2 arriba (5 min)

**C)** Prefiero usar SQLite (más simple, sin MongoDB) → Dime y revierte

---

**Esperando tu respuesta...** 🎯

