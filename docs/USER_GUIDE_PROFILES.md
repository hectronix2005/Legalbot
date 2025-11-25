# Guía de Usuario - Sistema de Perfiles por Plantilla

## Introducción

El **Sistema de Perfiles por Plantilla** te permite crear perfiles específicos de terceros para cada plantilla de contrato. Esto significa que el mismo tercero (por ejemplo, una empresa) puede tener diferentes perfiles según su rol en distintos tipos de contratos.

### Beneficios

- **Auto-llenado inteligente**: El sistema detecta automáticamente qué información necesita cada plantilla
- **Reutilización de datos**: Aprovecha la información existente del tercero
- **Múltiples roles**: El mismo tercero puede ser arrendador en un contrato y arrendatario en otro
- **Completitud visual**: Sabes exactamente qué campos faltan por llenar
- **Historial de uso**: Registra cuántas veces se ha usado cada perfil

---

## Cómo Usar el Sistema

### Paso 1: Ir al Generador de Contratos

1. Navega al **Generador de Contratos** desde el menú principal
2. Selecciona una **plantilla de contrato** de la lista disponible

### Paso 2: Análisis Automático

Una vez selecciones la plantilla, el sistema:

- ✅ Analiza automáticamente las variables de la plantilla
- ✅ Detecta los roles necesarios (ej: arrendador, contratista, cliente)
- ✅ Identifica qué campos pueden auto-llenarse

Verás un panel que muestra:
- Número de roles detectados
- Total de variables encontradas
- Porcentaje de variables clasificadas

**Ejemplo:**
```
┌─────────────────────────────────────┐
│ 2 rol(es) detectado(s)              │
│ 15 variables                         │
│ 93% clasificadas                     │
└─────────────────────────────────────┘
```

### Paso 3: Seleccionar Rol (si aplica)

Si la plantilla tiene múltiples roles:

1. Verás un selector desplegable **"Rol del Tercero en este Contrato"**
2. Selecciona el rol apropiado (ej: "Arrendador (Propietario)")

**Nota:** Si solo hay un rol, se selecciona automáticamente.

### Paso 4: Seleccionar Tercero

1. En el selector **"Tercero"**, elige el tercero de la lista
2. Muestra: Nombre completo (Número de identificación)
3. Al seleccionar, el sistema automáticamente:
   - Busca si ya existe un perfil para este tercero + plantilla + rol
   - Si no existe, crea uno nuevo auto-llenando los campos posibles
   - Si existe, carga el perfil guardado

### Paso 5: Ver el Perfil Auto-llenado

Verás un panel con el perfil creado que muestra:

#### Encabezado del Perfil
- **Rol**: Ej: "Arrendador (Propietario)"
- **Tercero**: Nombre del tercero seleccionado

#### Indicador de Completitud
- Barra de progreso con colores:
  - 🟢 Verde (≥80%): Perfil casi completo
  - 🟡 Amarillo (≥50%): Faltan algunos campos
  - 🔴 Rojo (<50%): Muchos campos faltantes
- Porcentaje de completitud

#### Estadísticas
- **Auto-llenados**: Número de campos llenados automáticamente
- **Llenos**: Campos completados / Total de campos
- **Usado**: Veces que se ha usado este perfil

**Ejemplo de perfil:**
```
┌────────────────────────────────────────┐
│ Perfil: Arrendador (Propietario)      │
│ Personal Financial Dreams SAS          │
│                                        │
│ Completitud: [███████████░░░] 73%    │
│                                        │
│ 5 auto-llenados | 8/11 llenos | 2 veces │
└────────────────────────────────────────┘
```

### Paso 6: Completar Campos Faltantes

Si el perfil no está 100% completo:

1. Verás una sección **"Campos Faltantes"**
2. Muestra los primeros 5 campos vacíos
3. Puedes editarlos directamente escribiendo en las cajas de texto
4. Los cambios se envían automáticamente al generar el contrato

**Ejemplo:**
```
Campos Faltantes
┌─────────────────────────────────────┐
│ nombre_representante                │
│ [_____________________________]     │
│                                     │
│ cedula_representante                │
│ [_____________________________]     │
│                                     │
│ ciudad_expedicion                   │
│ [_____________________________]     │
└─────────────────────────────────────┘
```

### Paso 7: Generar el Contrato

1. Completa los campos restantes del formulario (si los hay)
2. Click en **"Generar Contrato"**
3. El sistema:
   - Usa los datos del perfil para llenar la plantilla
   - Registra el uso del perfil
   - Genera el contrato final

---

## Gestión de Perfiles Existentes

### Ver Perfiles de un Tercero

Para ver todos los perfiles de un tercero específico, puedes usar el componente `SupplierProfilesManager` (si está integrado en tu interfaz).

Este muestra:
- **Lista de perfiles** por plantilla
- **Completitud** de cada perfil
- **Uso histórico** (cuántas veces se ha usado)
- **Fecha de creación** y último uso

### Tarjeta de Perfil

Cada perfil muestra:

```
┌──────────────────────────────────────┐
│ Contrato de Arrendamiento            │
│ [Servicios]                          │
│ [Arrendador (Propietario)]           │
│                                      │
│ Completitud: 85% [████████████░░░]  │
│                                      │
│ Campos llenos: 12 / 14               │
│ Uso: 3 veces                         │
│                                      │
│ Creado: 12 nov 2025                  │
│ Último uso: 12 nov 2025              │
└──────────────────────────────────────┘
```

### Ver Detalles de un Perfil

Click en cualquier tarjeta para ver:

- **Información general**: Plantilla, categoría, rol, completitud
- **Lista de campos** (primeros 10):
  - ✓ Lleno / ○ Vacío
  - Badge "Auto" si fue auto-llenado
- **Campos faltantes**: Lista de campos vacíos
- **Ayuda**: Indica que se editan desde el Generador de Contratos

---

## Preguntas Frecuentes

### ¿Se guardan automáticamente los perfiles?

**Sí.** Los perfiles se guardan automáticamente cuando:
- Seleccionas un tercero por primera vez para una plantilla+rol
- Generas un contrato usando ese perfil

### ¿Puedo tener el mismo tercero con diferentes roles?

**Sí.** Ese es el propósito principal del sistema. Por ejemplo:
- **Juan Pérez** puede ser:
  - Arrendador en un "Contrato de Arrendamiento"
  - Cliente en un "Contrato de Servicios"
  - Empleador en un "Contrato Laboral"

Cada uno será un perfil separado con su propia información.

### ¿Qué pasa si cambio información del tercero base?

Los perfiles **NO se actualizan automáticamente**. Esto es intencional porque:
- Los perfiles pueden tener información específica del contexto
- Evita sobrescribir datos personalizados
- Mantiene historial consistente

Si quieres usar la nueva información:
1. Elimina el perfil existente (futuro feature)
2. Crea uno nuevo seleccionando el tercero nuevamente

### ¿Qué es el "auto-llenado"?

El auto-llenado es cuando el sistema detecta que una variable de la plantilla coincide con un campo del tercero base.

**Ejemplo:**
- Variable plantilla: `{{arrendador_nombre}}`
- Campo tercero: `legal_name = "ABC Company SAS"`
- Resultado: Auto-llena `arrendador_nombre` con "ABC Company SAS"

El sistema es inteligente y reconoce variaciones:
- `nombre`, `name`, `razon_social` → `legal_name`
- `cedula`, `nit`, `rut`, `documento` → `identification_number`
- `email`, `correo` → `email`
- `telefono`, `phone`, `tel` → `phone`

### ¿Cómo sé qué campos faltan?

La barra de completitud te indica visualmente:
- **Verde (≥80%)**: Solo faltan 1-2 campos opcionales
- **Amarillo (≥50%)**: Faltan algunos campos importantes
- **Rojo (<50%)**: Muchos campos requeridos vacíos

Además, la sección "Campos Faltantes" lista específicamente cuáles campos necesitas llenar.

### ¿Se puede editar un perfil después de crearlo?

**Sí, pero indirectamente.** Los perfiles se editan cuando:
1. Vas al Generador de Contratos
2. Seleccionas la misma plantilla
3. Seleccionas el mismo tercero y rol
4. El sistema carga el perfil existente
5. Modificas los campos que necesites
6. Al generar el contrato, se guardan los cambios

**Nota:** En futuras versiones habrá un editor directo de perfiles.

### ¿Cuántos perfiles puedo crear?

**Ilimitados.** Puedes crear tantos perfiles como necesites:
- Cada combinación de Tercero + Plantilla + Rol es un perfil único
- No hay límite en la cantidad

### ¿Los perfiles afectan el rendimiento?

**No.** Los perfiles están optimizados para:
- Consultas rápidas con índices en base de datos
- Solo se cargan cuando se necesitan
- Se cachean en el navegador durante la sesión

### ¿Qué pasa con los contratos antiguos?

**El sistema es retrocompatible.** Los contratos generados antes del sistema de perfiles:
- Siguen funcionando normalmente
- No requieren migración
- Pueden seguir editándose

Los perfiles son un **agregado opcional** que mejora la experiencia sin romper funcionalidad existente.

---

## Mejores Prácticas

### 1. Usa Nomenclatura Estándar en Plantillas

Para mejor auto-detección, usa prefijos estándar en las variables:
- ✅ `{{arrendador_nombre}}`, `{{arrendador_cedula}}`
- ✅ `{{contratista_direccion}}`, `{{contratista_email}}`
- ✅ `{{cliente_telefono}}`, `{{cliente_ciudad}}`

Evita:
- ❌ `{{nombre_1}}`, `{{campo_a}}`
- ❌ `{{x}}`, `{{dato}}`

### 2. Mantén Terceros Base Actualizados

Asegúrate que la información básica del tercero esté completa:
- Nombre legal / Razón social
- Número de identificación
- Email y teléfono
- Dirección

Esto maximiza el auto-llenado de perfiles.

### 3. Revisa la Completitud Antes de Generar

Aunque puedes generar contratos con perfiles incompletos:
- Verifica la barra de completitud
- Completa campos críticos antes de generar
- Evita campos vacíos en contratos importantes

### 4. Reutiliza Perfiles

Si vas a generar múltiples contratos similares:
- El perfil se reutiliza automáticamente
- Ahorras tiempo en cada nuevo contrato
- Mantiene consistencia en la información

---

## Soporte Técnico

### Problemas Comunes

#### No se detectan roles

**Causa:** La plantilla no usa prefijos estándar en las variables.

**Solución:**
- El sistema seguirá funcionando, pero sin auto-detección de roles
- Puedes usar el selector de terceros normalmente
- Los campos se llenarán según coincidencias de nombres

#### Campos no se auto-llenan

**Causa:** Los nombres de las variables no coinciden con campos del tercero.

**Solución:**
- Completa los campos manualmente
- Revisa que el tercero base tenga la información
- Considera renombrar variables en la plantilla para futuros contratos

#### El perfil no se guarda

**Causa:** Error de conexión o permisos insuficientes.

**Solución:**
- Verifica tu conexión a internet
- Asegúrate de tener permisos para crear contratos
- Contacta al administrador si persiste

### Contacto

Para soporte adicional o reportar bugs:
- Email: [Configurar email de soporte]
- Sistema de tickets: [Configurar URL]
- Documentación técnica: `/docs/IMPLEMENTATION_PROGRESS.md`

---

**Última actualización:** 2025-11-12
**Versión del sistema:** 1.0.0
