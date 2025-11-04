# Solución Robusta - Dashboard No Muestra Datos

## Estado Actual del Sistema ✅

### Backend (v12)
- **URL**: https://legal-bot-backend-prod-7df4b18ba0f7.herokuapp.com/
- **Estado**: FUNCIONANDO CORRECTAMENTE
- **Cambios**: UserCompany records creados, multi-tenant funcionando

### Frontend (v5)
- **URL**: https://legal-bot-frontend-prod-61613cf280b0.herokuapp.com/
- **Estado**: DESPLEGADO CORRECTAMENTE
- **Cambios**: selectedCompanyId se guarda automáticamente al hacer login

### Base de Datos (MongoDB Atlas)
```
✓ 4 usuarios (admin, lawyer, requester, super_admin)
✓ 1 empresa (Empresa Demo S.A.)
✓ 1 template (Plantilla Estándar de Servicios Profesionales)
✓ 3 UserCompany records (asociaciones correctas)
✓ 0 contratos
✓ 0 suppliers/terceros
```

## PROBLEMA IDENTIFICADO: Caché del Navegador 🎯

El navegador está mostrando la **versión ANTIGUA del frontend** que no guarda el `selectedCompanyId`.

## SOLUCIÓN PASO A PASO

### Opción 1: Limpiar Caché del Navegador (RECOMENDADO)

#### En Chrome/Edge:
1. Abre la aplicación: https://legal-bot-frontend-prod-61613cf280b0.herokuapp.com/
2. Presiona `Ctrl + Shift + Del` (Windows) o `Cmd + Shift + Delete` (Mac)
3. Selecciona:
   - ✓ Cookies y otros datos de sitios
   - ✓ Imágenes y archivos almacenados en caché
4. Click en "Borrar datos"
5. Cierra TODAS las pestañas del sitio
6. Abre una nueva pestaña en modo incógnito: `Ctrl + Shift + N`
7. Ve a: https://legal-bot-frontend-prod-61613cf280b0.herokuapp.com/

#### En Firefox:
1. Presiona `Ctrl + Shift + Del`
2. Selecciona:
   - ✓ Cookies
   - ✓ Caché
3. Click en "Limpiar ahora"
4. Abre ventana privada: `Ctrl + Shift + P`
5. Ve a: https://legal-bot-frontend-prod-61613cf280b0.herokuapp.com/

### Opción 2: Hard Refresh (MÁS RÁPIDO)

1. Abre: https://legal-bot-frontend-prod-61613cf280b0.herokuapp.com/
2. Presiona:
   - **Windows**: `Ctrl + F5` o `Ctrl + Shift + R`
   - **Mac**: `Cmd + Shift + R`
3. Espera a que la página se recargue completamente

### Opción 3: Modo Incógnito (PARA PROBAR)

1. Abre una ventana de incógnito/privada
2. Ve a: https://legal-bot-frontend-prod-61613cf280b0.herokuapp.com/
3. Haz login normalmente

## Cómo Verificar que Funciona ✓

### Paso 1: Login
```
Email: admin@demo.com
Password: 123456
```

### Paso 2: Abrir Consola del Navegador
1. Presiona `F12` o click derecho → "Inspeccionar"
2. Ve a la pestaña "Console"
3. Deberías ver:
   ```
   ✅ Company ID guardado: 69090d57f4d516e941088c64
   ```

### Paso 3: Verificar localStorage
1. En la consola del navegador, ve a la pestaña "Application" o "Almacenamiento"
2. Expande "Local Storage" → tu dominio
3. Verifica que existan:
   - `token`: (un JWT largo)
   - `user`: (objeto JSON con datos del usuario)
   - `selectedCompanyId`: **69090d57f4d516e941088c64**  ← ESTO ES CRÍTICO

### Paso 4: Verificar Dashboard
El dashboard debería mostrar:
- **Contratos**: 0
- **Plantillas**: 1
- **Empresas**: 1 (solo si eres admin/super_admin)

## Si AÚN NO FUNCIONA

### Solución 1: Verificar Request en Network

1. Abre DevTools (F12)
2. Ve a la pestaña "Network"
3. Recarga la página
4. Busca la request a `/api/dashboard/stats`
5. Click en ella
6. Ve a la pestaña "Headers"
7. Verifica que exista el header:
   ```
   X-Company-Id: 69090d57f4d516e941088c64
   ```

Si el header NO está presente:
- El frontend no está guardando el selectedCompanyId
- Verifica que no tengas extensiones del navegador bloqueando localStorage
- Prueba en modo incógnito

### Solución 2: Establecer manualmente selectedCompanyId

1. Abre la consola del navegador (F12)
2. Ejecuta este comando:
   ```javascript
   localStorage.setItem('selectedCompanyId', '69090d57f4d516e941088c64');
   ```
3. Recarga la página
4. El dashboard debería funcionar

### Solución 3: Probar las APIs Directamente

Abre la consola y ejecuta:
```javascript
fetch('https://legal-bot-backend-prod-7df4b18ba0f7.herokuapp.com/api/dashboard/stats', {
  headers: {
    'Authorization': 'Bearer ' + localStorage.getItem('token'),
    'X-Company-Id': '69090d57f4d516e941088c64'
  }
})
.then(r => r.json())
.then(d => console.log('Stats:', d));
```

Deberías ver:
```json
{
  "totalCompanies": 1,
  "totalUsers": 4,
  "totalTemplates": 1,
  "totalRequests": 0,
  "totalContracts": 0,
  "requestsByStatus": []
}
```

## Datos Perdidos - IMPORTANTE ⚠️

Según el POST_MORTEM.md, **todos los datos de producción fueron borrados el 3 de noviembre 2025** al ejecutar accidentalmente el script `initMongoDB.js`.

**Datos que se perdieron** (irrecuperables):
- Todos los terceros/suppliers creados anteriormente
- Todas las plantillas creadas anteriormente
- Todos los contratos generados anteriormente
- Todos los usuarios personalizados
- Todas las empresas personalizadas

**Datos actuales** (demo):
- 1 plantilla demo: "Plantilla Estándar de Servicios Profesionales"
- 0 contratos
- 0 terceros/suppliers
- 4 usuarios demo
- 1 empresa demo

**SI ESPERAS VER DATOS QUE CREASTE ANTES**: Esos datos fueron eliminados y **NO son recuperables**. Necesitarás recrearlos.

## Verificación Final del Sistema

### Test 1: Login
```bash
curl -X POST https://legal-bot-backend-prod-7df4b18ba0f7.herokuapp.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@demo.com","password":"123456"}'
```

Debería retornar `companyRoles` con la empresa.

### Test 2: Dashboard Stats
```bash
curl -X GET https://legal-bot-backend-prod-7df4b18ba0f7.herokuapp.com/api/dashboard/stats \
  -H "Authorization: Bearer TU_TOKEN_AQUI" \
  -H "X-Company-Id: 69090d57f4d516e941088c64"
```

Debería retornar las estadísticas.

### Test 3: Templates
```bash
curl -X GET https://legal-bot-backend-prod-7df4b18ba0f7.herokuapp.com/api/templates \
  -H "Authorization: Bearer TU_TOKEN_AQUI" \
  -H "X-Company-Id: 69090d57f4d516e941088c64"
```

Debería retornar 1 template.

## Resumen de Cambios Implementados

### Backend (v12)
1. ✓ Creados 3 UserCompany records
2. ✓ Multi-tenant funcionando correctamente
3. ✓ Endpoint `/api/dashboard/stats` funcionando
4. ✓ Endpoint `/api/templates` funcionando
5. ✓ Protecciones agregadas a `initMongoDB.js`

### Frontend (v5)
1. ✓ `selectedCompanyId` se guarda automáticamente al login
2. ✓ Se establece al recargar la página si falta
3. ✓ Se limpia al hacer logout
4. ✓ Header `X-Company-Id` se envía en todas las requests

## Soporte

Si después de seguir TODOS estos pasos el problema persiste:

1. Captura de pantalla de:
   - La consola del navegador (F12 → Console)
   - El localStorage (F12 → Application → Local Storage)
   - El Network tab mostrando la request a `/api/dashboard/stats`

2. Verifica:
   - ¿Qué navegador estás usando?
   - ¿Estás usando extensiones que bloquean localStorage?
   - ¿Estás en modo incógnito?
   - ¿Has limpiado el caché completamente?

---

**Fecha**: 3 de Noviembre 2025
**Última actualización**: 3 de Noviembre 2025, 21:30 UTC
