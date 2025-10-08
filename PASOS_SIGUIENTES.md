# 🎯 TUS PRÓXIMOS PASOS - Sistema de Contratos v2.0

## ✅ Lo que YA está Listo

- ✅ Sistema completo desarrollado
- ✅ Backend con MongoDB preparado
- ✅ Frontend con React moderno
- ✅ Carga de archivos Word funcionando
- ✅ Sistema unificado (plantillas = tipos)
- ✅ Node.js instalado en tu PC
- ✅ Código completamente funcional

---

## ⚡ Lo que FALTA (Solo configuración - 5 minutos)

### 🎯 SOLO necesitas configurar MongoDB

**Por qué**: El sistema ahora usa MongoDB en lugar de SQLite para ser más profesional y escalable.

---

## 🚀 HAZ ESTO AHORA (5 minutos):

### Opción A: MongoDB Atlas (FÁCIL Y GRATIS) ⭐ Recomendado

#### Paso 1: Crear Cuenta (2 min)
1. Abre: https://www.mongodb.com/cloud/atlas/register
2. Regístrate con tu email
3. Verifica tu email
4. Login

#### Paso 2: Crear Cluster Free (1 min)
1. Clic en **"Build a Database"**
2. Selecciona **"M0 FREE"** (el primero)
3. Provider: **AWS**
4. Region: **US East** (o el más cercano)
5. Cluster Name: `legal-contracts`
6. Clic **"Create"** (espera 3-5 min mientras se crea)

#### Paso 3: Crear Usuario de BD (30 seg)
1. Menú izquierdo → **"Database Access"**
2. Clic **"Add New Database User"**
3. Username: `legaladmin`
4. Password: `Legal2024` (o la que prefieras - apúntala!)
5. Privileges: **"Read and write to any database"**
6. Clic **"Add User"**

#### Paso 4: Permitir Acceso (30 seg)
1. Menú izquierdo → **"Network Access"**
2. Clic **"Add IP Address"**
3. Clic **"Allow Access from Anywhere"**
4. Confirmar (dejará 0.0.0.0/0)
5. Clic **"Confirm"**

#### Paso 5: Copiar String de Conexión (30 seg)
1. Menú izquierdo → **"Database"**
2. En tu cluster, clic **"Connect"**
3. Selecciona **"Connect your application"**
4. Copia el string (se ve así):

```
mongodb+srv://legaladmin:<password>@legal-contracts.xxxxx.mongodb.net/
```

5. **REEMPLAZA** `<password>` con tu contraseña (ej: `Legal2024`)

Resultado final:
```
mongodb+srv://legaladmin:Legal2024@legal-contracts.xxxxx.mongodb.net/legal-contracts
```

#### Paso 6: Configurar en Tu Proyecto (1 min)

**Abre un editor de texto** y edita:
```
C:\Users\ASUS 2025\OneDrive\Documentos\CURSOR\LEGAL BOT\backend\.env
```

Cambia esta línea:
```env
MONGODB_URI=mongodb://localhost:27017/legal-contracts
```

Por tu string de Atlas:
```env
MONGODB_URI=mongodb+srv://legaladmin:TU_PASSWORD@legal-contracts.xxxxx.mongodb.net/legal-contracts
```

**Guarda el archivo**

#### Paso 7: Inicializar MongoDB (30 seg)

Abre **PowerShell** y ejecuta:

```powershell
cd "C:\Users\ASUS 2025\OneDrive\Documentos\CURSOR\LEGAL BOT\backend"

# Actualizar PATH (para que funcione npm)
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

# Inicializar MongoDB con datos de prueba
npm run init-mongo
```

Deberías ver:
```
✅ Conectado a MongoDB
✅ Empresa demo creada
✅ Usuarios demo creados
✅ Plantilla de ejemplo creada
```

#### Paso 8: Ejecutar el Sistema (30 seg)

**Detén los servidores actuales** si están corriendo (cierra las ventanas de PowerShell que abrimos antes)

Luego abre **DOS nuevas terminales**:

**Terminal 1 - Backend:**
```powershell
cd "C:\Users\ASUS 2025\OneDrive\Documentos\CURSOR\LEGAL BOT\backend"
npm run dev
```

**Terminal 2 - Frontend:**
```powershell
cd "C:\Users\ASUS 2025\OneDrive\Documentos\CURSOR\LEGAL BOT\frontend"
npm run dev
```

#### Paso 9: ¡USAR! 🎉

Abre tu navegador en: **http://localhost:3000**

Login con:
- **Email**: `admin@demo.com`
- **Password**: `123456`

---

## 🎊 ¡Ya está!

Ahora tienes un sistema profesional de contratos con:

✅ MongoDB Atlas (base de datos cloud profesional)
✅ Carga de archivos Word
✅ Detección automática de campos
✅ Generación de contratos
✅ Sistema de aprobaciones
✅ Todo funcionando

---

## 📝 Lo que Puedes Hacer Ahora

### 1. **Crear Tu Primera Plantilla con Word**:

1. Crea un documento Word simple:
```
CONTRATO DE PRUEBA

Nombre: {{nombre}}
Empresa: {{empresa}}
Monto: {{monto}}
Fecha: {{fecha}}
```

2. Guárdalo como `contrato-prueba.docx`

3. En el sistema:
   - Login como admin
   - Ve a **Plantillas**
   - Clic **Nueva Plantilla**
   - **Cargar Archivo Word** (selecciona tu archivo)
   - Espera que detecte los 4 campos
   - Selecciona categoría: "Otro"
   - Guardar

4. ¡Listo! Tienes tu primera plantilla con Word

### 2. **Crear una Solicitud**:

1. Logout y login como `solicitante@demo.com`
2. Ve a **Solicitudes** → **Nueva Solicitud**
3. Selecciona tu plantilla
4. Llena los campos
5. Enviar

### 3. **Aprobar como Abogado**:

1. Logout y login como `abogado@demo.com`
2. Ve a **Solicitudes**
3. Abre la solicitud
4. Asignarte como abogado
5. Aprobar
6. Generar contrato
7. Ir a **Contratos** y descargar en Word

---

## ❓ Si Tienes Problemas

### No puedo conectar a MongoDB:
- Verifica que el string en `.env` sea correcto
- Verifica que reemplazaste `<password>`
- Espera unos minutos si recién creaste el cluster

### Error "npm no se reconoce":
```powershell
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
```

### El login no funciona:
- Verifica que ejecutaste `npm run init-mongo`
- Verifica que el backend esté corriendo
- Prueba con: http://localhost:5000/api/health

---

## 📖 Más Información

- **Setup MongoDB**: `SETUP_MONGODB_RAPIDO.md`
- **Uso del Sistema**: `GUIA_DE_USO.md`
- **Archivos Word**: `GUIA_ARCHIVOS_WORD.md`

---

## 🎯 TL;DR (Muy Rápido)

```bash
# 1. Crear cuenta en https://www.mongodb.com/cloud/atlas/register
# 2. Crear cluster FREE
# 3. Copiar string de conexión
# 4. Pegar en backend/.env (línea MONGODB_URI)
# 5. Ejecutar:

cd backend
npm run init-mongo
cd ..
npm run dev

# 6. Abrir http://localhost:3000
# 7. Login: admin@demo.com / 123456
```

---

**¿Necesitas ayuda con MongoDB Atlas?**

📖 Lee: `SETUP_MONGODB_RAPIDO.md` - Todo explicado paso a paso

**¿Ya tienes MongoDB configurado?**

🚀 Solo ejecuta: `npm run init-mongo` y luego `npm run dev`

---

**¡Tu sistema está a 5 minutos de estar completamente operativo! ⚡**

