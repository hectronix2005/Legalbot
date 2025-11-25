# SOLUCIÓN: Network Error (ERR_NETWORK)

## PROBLEMA IDENTIFICADO

Los errores de "Network Error" que estás viendo en el navegador ocurren porque:

### Causa Raíz: Frontend Dev Server NO Está Corriendo

Cuando ejecutas `npm run dev`, intenta iniciar dos servidores:
1. Backend en puerto 3002 ✅
2. Frontend en puerto 3003 ❌ **FALLA INMEDIATAMENTE**

```
[1] Something is already running on port 3003.
[1] npm run dev:frontend exited with code 0
```

### Estado Actual de Puertos

```
Puerto 3000: NO usado
Puerto 3001: BLOQUEADO (Ruby proceso PID 17456)
Puerto 3002: ✅ BACKEND CORRIENDO (Node.js PID 91698)
Puerto 3003: BLOQUEADO (Ruby proceso PID 87474)
```

El frontend dev server se cierra porque el puerto 3003 está ocupado.

## ✅ SOLUCIÓN

**NO necesitas un servidor de desarrollo separado para el frontend.**

El backend en el puerto 3002 **YA ESTÁ SIRVIENDO** el frontend compilado desde:
```
backend/public/
```

### Pasos para Acceder a la Aplicación

1. **Cierra TODAS las pestañas** del navegador que tengan la aplicación abierta

2. **Abre una nueva pestaña** y navega a:
   ```
   http://localhost:3002
   ```
   **IMPORTANTE**: NO uses 3003, 3000, o 3001. Solo **3002**.

3. **Realiza un Hard Refresh**:
   - **macOS**: `Cmd + Shift + R` o `Cmd + Option + R`
   - **Windows/Linux**: `Ctrl + Shift + R` o `Ctrl + F5`

4. **Inicia sesión** normalmente

## Por Qué Esto Funciona

El archivo de configuración de la API (`frontend/src/services/api.ts`) usa:
```typescript
const API_BASE_URL = process.env.REACT_APP_API_URL || '/api';
```

Con rutas **relativas** (`/api`), el frontend hace peticiones al mismo origen donde se carga:

- ✅ Cargas desde `http://localhost:3002` → API calls a `http://localhost:3002/api`
- ❌ Intentas cargar desde otro puerto → API calls fallan con ERR_NETWORK

## Estado del Servidor

```
✅ Backend: http://localhost:3002
✅ MongoDB: Conectado
✅ Frontend: Servido desde backend/public
✅ APIs funcionando:
   - /api/auth
   - /api/companies
   - /api/templates
   - /api/contracts
   - /api/suppliers
   - /api/third-party-types
   - /api/dashboard
   - /api/users
```

## Si el Problema Persiste

### 1. Verifica la URL
Asegúrate de que la barra de direcciones muestre exactamente:
```
http://localhost:3002
```

### 2. Inspecciona Network
1. Abre **DevTools** (F12)
2. Ve a la pestaña **Network**
3. Recarga la página
4. Verifica que:
   - `main.21cd0df9.js` se carga correctamente
   - Las peticiones a `/api/*` van a `localhost:3002`

### 3. Modo Incógnito
Usa una ventana de incógnito para evitar problemas de caché:
- **macOS**: `Cmd + Shift + N`
- **Windows/Linux**: `Ctrl + Shift + N`

Luego ve a `http://localhost:3002`

### 4. Limpia localStorage
Si ves errores de autenticación:
1. Abre DevTools → Consola
2. Ejecuta:
   ```javascript
   localStorage.clear()
   location.reload()
   ```

### 5. Limpia Caché del Navegador
1. Chrome: Configuración → Privacidad y seguridad → Borrar datos de navegación
2. Selecciona "Imágenes y archivos en caché"
3. Rango: "Desde siempre"
4. Haz clic en "Borrar datos"

## Verificación de Éxito

Después de acceder a `http://localhost:3002` y hacer hard refresh, deberías ver:

✅ NO errores de "Network Error" en la consola
✅ La página carga correctamente
✅ Puedes iniciar sesión
✅ Los datos de empresas, plantillas y contratos se cargan
✅ La navegación funciona sin problemas

## Información Técnica

### Archivos Relevantes
- Frontend compilado: `backend/public/index.html`
- JavaScript principal: `backend/public/static/js/main.21cd0df9.js`
- CSS: `backend/public/static/css/main.08f7cbd0.css`
- API config: `frontend/src/services/api.ts`
- Server config: `backend/server.js` (líneas 158-204)

### Configuración del Server
El backend sirve archivos estáticos con cache control (server.js:178-191):
- HTML: No caché
- JS/CSS: Caché de 5 minutos
- SPA routing: Todas las rutas no-API devuelven index.html

## Comandos Útiles

### Ver Procesos en Puertos
```bash
lsof -i :3002  # Ver qué está en puerto 3002
lsof -i :3003  # Ver qué está en puerto 3003
```

### Liberar Puerto 3003 (Opcional)
Si quieres usar el frontend dev server en el futuro:
```bash
# Encontrar el proceso
lsof -i :3003

# Matar el proceso (reemplaza PID con el número real)
kill -9 PID
```

### Reiniciar Backend
```bash
cd backend
npm run dev
```

## Resumen

**NO necesitas un servidor frontend separado.**

**Accede directamente a: http://localhost:3002**

El backend sirve tanto la API como el frontend compilado en el mismo puerto.
