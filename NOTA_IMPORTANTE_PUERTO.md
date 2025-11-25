# IMPORTANTE: CONFIGURACIÓN DE PUERTOS

## ⚠️ PUERTOS PROHIBIDOS/OCUPADOS ⚠️

Los siguientes puertos están OCUPADOS y NO deben usarse:
- **Puerto 3000:** ❌ PROHIBIDO - OCUPADO
- **Puerto 3001:** ❌ PROHIBIDO - OCUPADO (Ruby)
- **Puerto 3003:** ❌ PROHIBIDO - OCUPADO (Ruby)

## ✅ SOLUCIÓN: Usar puerto 3002 únicamente

Dado que múltiples puertos están ocupados, la aplicación funciona en modo PRODUCCIÓN desde el backend:

- **Backend + Frontend compilado:** http://localhost:3002 ✅

El backend sirve el frontend compilado desde la carpeta `backend/public`.

## Cómo acceder a la aplicación:

**USA SIEMPRE: http://localhost:3002**

NO intentes usar React en modo desarrollo (puerto 3000, 3001, 3003) ya que están todos ocupados.

## Para iniciar la aplicación:

```bash
cd backend && npm run dev
```

Esto solo inicia el backend en puerto 3002, que sirve el frontend compilado.

## Si necesitas hacer cambios en el frontend:

1. Haz tus cambios en `/frontend/src`
2. Compila el frontend: `cd frontend && npm run build`
3. Copia el build: `cd .. && npm run copy-build`
4. El backend automáticamente servirá la nueva versión

## Archivos de configuración:

1. `backend/.env` - Backend usa puerto 3002
2. Frontend se sirve como estático desde `backend/public`
