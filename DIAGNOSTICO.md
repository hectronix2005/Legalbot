# Script de Diagnóstico - Dashboard Vacío

## El código está correctamente desplegado ✓
He verificado que el frontend v5 contiene todos mis cambios.

## Necesito que ejecutes este diagnóstico

### Paso 1: Abre la consola del navegador

1. Ve a: https://legal-bot-frontend-prod-61613cf280b0.herokuapp.com/
2. Presiona `F12` o click derecho → "Inspeccionar"
3. Ve a la pestaña "Console"

### Paso 2: Ejecuta este script completo

Copia y pega ESTO en la consola (presiona Enter después):

```javascript
console.log("=== DIAGNÓSTICO COMPLETO ===\n");

// 1. Verificar localStorage
console.log("1. LOCALSTORAGE:");
console.log("  - token:", localStorage.getItem('token') ? "✓ Existe" : "✗ NO existe");
console.log("  - user:", localStorage.getItem('user') ? "✓ Existe" : "✗ NO existe");
console.log("  - selectedCompanyId:", localStorage.getItem('selectedCompanyId') || "✗ NO EXISTE");

// 2. Ver datos del usuario
if (localStorage.getItem('user')) {
  try {
    const user = JSON.parse(localStorage.getItem('user'));
    console.log("\n2. DATOS DEL USUARIO:");
    console.log("  - email:", user.email);
    console.log("  - role:", user.role);
    console.log("  - company_id:", user.company_id);
    console.log("  - companyRoles:", user.companyRoles);

    if (user.companyRoles) {
      console.log("  - Companies IDs:", Object.keys(user.companyRoles));
    }
  } catch (e) {
    console.error("  Error parseando user:", e);
  }
}

// 3. Probar API directamente
console.log("\n3. PROBANDO API...");
const token = localStorage.getItem('token');
const companyId = localStorage.getItem('selectedCompanyId') || '69090d57f4d516e941088c64';

if (token) {
  // Probar dashboard stats
  fetch('https://legal-bot-backend-prod-7df4b18ba0f7.herokuapp.com/api/dashboard/stats', {
    headers: {
      'Authorization': 'Bearer ' + token,
      'X-Company-Id': companyId,
      'Content-Type': 'application/json'
    }
  })
  .then(r => {
    console.log("  - Status dashboard/stats:", r.status, r.statusText);
    return r.json();
  })
  .then(data => {
    console.log("  - Datos del dashboard:", data);
  })
  .catch(err => {
    console.error("  - Error en dashboard/stats:", err);
  });

  // Probar templates
  fetch('https://legal-bot-backend-prod-7df4b18ba0f7.herokuapp.com/api/templates', {
    headers: {
      'Authorization': 'Bearer ' + token,
      'X-Company-Id': companyId,
      'Content-Type': 'application/json'
    }
  })
  .then(r => {
    console.log("  - Status templates:", r.status, r.statusText);
    return r.json();
  })
  .then(data => {
    console.log("  - Templates encontrados:", data.length || 0);
    if (data.length > 0) {
      console.log("  - Primer template:", data[0].name);
    }
  })
  .catch(err => {
    console.error("  - Error en templates:", err);
  });
} else {
  console.log("  ✗ NO hay token, necesitas hacer login primero");
}

console.log("\n=== FIN DEL DIAGNÓSTICO ===");
console.log("Por favor copia TODA la salida y envíamela");
```

### Paso 3: Envíame la salida completa

Copia TODO lo que aparece en la consola después de ejecutar el script y envíamelo.

## Si no has hecho login todavía

1. Primero haz login en la aplicación con:
   - Email: `admin@demo.com`
   - Password: `123456`
2. LUEGO ejecuta el script de diagnóstico arriba

## Lo que busco en el diagnóstico

1. ¿Se guardó el `selectedCompanyId`?
2. ¿El user tiene `companyRoles`?
3. ¿Las llamadas al API están funcionando?
4. ¿Qué errores exactos está devolviendo el backend?

---

**IMPORTANTE**: Si ves algún error en rojo en la consola (incluso antes de ejecutar mi script), también cópialo y envíamelo.
