# Prueba Local con Datos de Producción

## Estado Actual

Tu entorno local ahora está conectado a **MongoDB Atlas** (misma base de datos que Heroku):

**Local Environment:**
- Frontend: http://localhost:3000
- Backend: http://localhost:5001
- Database: MongoDB Atlas (`legal_bot`)

**Datos en MongoDB Atlas:**
- 1 empresa (Empresa Demo S.A.)
- 4 usuarios
- 0 templates (API reporta 1 - investigar)
- 0 contratos
- 0 suppliers/terceros

## Pasos para Probar

### 1. Limpiar localStorage del navegador

Abre la consola del navegador (F12) y ejecuta:
```javascript
localStorage.clear();
console.log('✅ localStorage limpiado');
```

### 2. Recargar la página

Presiona `Ctrl + R` o `Cmd + R`

### 3. Hacer Login

```
Email: admin@demo.com
Password: 123456
```

### 4. Verificar en la Consola

Deberías ver:
```
✅ Company ID guardado: [algún ID]
```

### 5. Verificar localStorage

En la consola, ejecuta:
```javascript
console.log('selectedCompanyId:', localStorage.getItem('selectedCompanyId'));
console.log('user:', JSON.parse(localStorage.getItem('user')));
```

Deberías ver:
- `selectedCompanyId`: NO debe ser null
- `user.companyRoles`: Debe contener el ID de la empresa

### 6. Verificar Dashboard

El dashboard debería mostrar:
- Plantillas: 1 (o 0, según el conteo)
- Contratos: 0
- Empresas: 1

## Problema Identificado Anteriormente

**Los datos que creaste (terceros, plantillas, contratos) están en tu MongoDB LOCAL** (mongodb://localhost:27017/legal-contracts), NO en MongoDB Atlas.

**Opciones:**

### Opción A: Migrar Datos de Local a Atlas
Exportar datos de tu MongoDB local e importarlos a Atlas.

### Opción B: Recrear Datos en Producción
Crear nuevamente los terceros, plantillas y contratos directamente en la aplicación de Heroku o local (ahora que está conectado a Atlas).

### Opción C: Usar MongoDB Local para Desarrollo
Cambiar el .env de vuelta a `mongodb://localhost:27017/legal-contracts` para trabajar con tus datos locales.

## Datos Perdidos el 3 de Noviembre 2025

Según POST_MORTEM.md, **todos los datos de producción fueron borrados** al ejecutar accidentalmente `initMongoDB.js` en producción. Esos datos son **irrecuperables**.

Datos actuales en Atlas son datos demo creados por el script de inicialización.

---

**Siguiente Paso:** Prueba el login local y verifica si el dashboard carga correctamente. Esto confirmará si el problema es específico de Heroku o del código en general.
