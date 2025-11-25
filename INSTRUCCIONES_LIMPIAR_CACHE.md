# 🔄 INSTRUCCIONES PARA LIMPIAR CACHÉ DEL NAVEGADOR

## ⚠️ PROBLEMA ACTUAL

El navegador tiene en caché la versión ANTIGUA del código JavaScript del frontend.

**Síntomas:**
- Ves logs de "installHook.js" en la consola
- Error dice "fn" en lugar de mostrar debugging detallado
- El sistema muestra errores viejos

## ✅ SOLUCIÓN PASO A PASO

### Opción 1: Hard Refresh (MÁS RÁPIDO)

#### Chrome / Edge / Brave
1. Abre la aplicación en `http://localhost:3002`
2. Abre DevTools (F12)
3. Haz **click derecho** en el botón de recargar del navegador
4. Selecciona **"Vaciar caché y volver a cargar de manera forzada"**

O simplemente:
- Windows/Linux: `Ctrl + Shift + R`
- Mac: `Cmd + Shift + R`

#### Firefox
1. Abre la aplicación
2. Presiona `Ctrl + F5` (Windows/Linux)
3. O `Cmd + Shift + R` (Mac)

#### Safari
1. Presiona `Cmd + Option + E` (vaciar caché)
2. Luego `Cmd + R` (recargar)

### Opción 2: Limpiar Caché Completo (MÁS SEGURO)

#### Chrome / Edge / Brave
1. Presiona `Ctrl + Shift + Delete` (Windows/Linux)
2. O `Cmd + Shift + Delete` (Mac)
3. Selecciona:
   - ✅ **Imágenes y archivos en caché**
   - Tiempo: **Última hora**
4. Click en **"Borrar datos"**
5. Recarga la página (`F5`)

#### Firefox
1. Presiona `Ctrl + Shift + Delete`
2. Selecciona:
   - ✅ **Caché**
   - Intervalo: **Última hora**
3. Click en **"Limpiar ahora"**
4. Recarga la página (`F5`)

#### Safari
1. Menú → Desarrollador → Vaciar cachés
2. O `Cmd + Option + E`
3. Recarga la página (`Cmd + R`)

### Opción 3: Modo Incógnito (PARA PROBAR)

1. Abre una **ventana de incógnito/privada**:
   - Chrome/Edge: `Ctrl + Shift + N`
   - Firefox: `Ctrl + Shift + P`
   - Safari: `Cmd + Shift + N`

2. Ve a `http://localhost:3002`

3. Prueba la funcionalidad

**Nota:** En modo incógnito NO hay caché del navegador.

### Opción 4: Deshabilitar Caché Mientras Desarrollas

1. Abre DevTools (`F12`)
2. Ve a la pestaña **Network**
3. Marca la casilla **"Disable cache"**
4. **Mantén DevTools ABIERTO** mientras trabajas

Ahora el navegador NO usará caché mientras DevTools esté abierto.

## 🔍 VERIFICAR QUE FUNCIONÓ

Después de limpiar el caché, verifica:

### 1. Versión del Archivo JS

1. Abre DevTools (`F12`)
2. Ve a la pestaña **Network**
3. Recarga la página (`F5`)
4. Busca el archivo `main.*.js`
5. Debe ser: **`main.0988559e.js`**

Si ves otro archivo (como `main.d496a0f6.js`), el caché NO se limpió.

### 2. Logs Nuevos en Consola

Al intentar guardar un campo que produce error, deberías ver:

```
❌ ERROR AL GUARDAR CAMPO - DEBUG COMPLETO
  📋 Datos del Campo:
    Nombre: ...
    Valor: ...
  📡 Respuesta del Servidor:
    ...
```

**NO** deberías ver:
```
installHook.js:1 ❌ Error saving field: fn
```

## 🛠️ SI PERSISTE EL PROBLEMA

### Verificación Avanzada

```bash
# En la consola del navegador (F12 → Console), ejecuta:
performance.getEntriesByType("resource")
  .filter(r => r.name.includes("main."))
  .forEach(r => console.log(r.name))
```

Debería mostrar: `http://localhost:3002/static/js/main.0988559e.js`

### Limpiar Caché del Sistema Operativo

#### Windows
```cmd
ipconfig /flushdns
```

#### Mac
```bash
sudo dscacheutil -flushcache
sudo killall -HUP mDNSResponder
```

#### Linux
```bash
sudo systemctl restart nscd
# o
sudo /etc/init.d/dns-clean start
```

### Última Opción: Cerrar TODO y reiniciar

1. **Cierra TODAS** las pestañas del sitio
2. **Cierra completamente** el navegador
3. Espera 5 segundos
4. Abre el navegador nuevamente
5. Ve directamente a `http://localhost:3002`

## ✅ DESPUÉS DE LIMPIAR EL CACHÉ

1. Prueba guardar el campo "C.C. No" nuevamente
2. Deberías ver logs detallados en la consola
3. El campo debería guardarse correctamente como `c_c_no`
4. El análisis debería mostrar 100% de completitud

## 📊 CAMBIOS REALIZADOS EN EL SISTEMA

### Backend
- ✅ Normalización corregida (puntos → guiones bajos)
- ✅ Logs detallados de debugging
- ✅ Headers de no-cache temporales para JS/CSS

### Frontend
- ✅ Console.group() con debugging exhaustivo
- ✅ Alert mejorado con información detallada
- ✅ Nuevo archivo: `main.0988559e.js` (Nov 14 00:09)

### Servidor
- ✅ Corriendo con nodemon (auto-reload)
- ✅ Headers de caché deshabilitados temporalmente
- ✅ Solo archivo JS nuevo disponible (viejos eliminados)

## 🎯 CONFIRMACIÓN FINAL

Después de limpiar el caché, al intentar guardar un campo y producir un error, verás en consola:

- ✅ Grupo expandible "❌ ERROR AL GUARDAR CAMPO - DEBUG COMPLETO"
- ✅ Múltiples secciones con emojis (📋, 📡, 📦, etc.)
- ✅ Stack traces completos
- ✅ JSON formateado del error

**NO** verás:
- ❌ "installHook.js:1"
- ❌ "Error saving field: fn"
- ❌ Logs simples sin estructura
