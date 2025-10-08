# 📋 Guía: Carga de Word en Tipos de Contrato

## 🎯 Nueva Funcionalidad

Ahora puedes cargar archivos Word directamente al crear **Tipos de Contrato**. Esto te permite:

✅ Definir una plantilla base para cada tipo de contrato
✅ Detectar automáticamente los campos que se necesitarán
✅ Reutilizar la plantilla al crear contratos de ese tipo
✅ Estandarizar los contratos por tipo

## 🚀 Cómo Usar

### Paso 1: Ir a Tipos de Contrato

1. Inicia sesión como **Administrador** (solo admins pueden crear tipos)
2. Ve a **Tipos de Contrato** en el menú lateral
3. Haz clic en **Nuevo Tipo**

### Paso 2: Cargar Archivo Word

En el formulario verás una sección azul:

```
📄 Cargar Plantilla Word (Opcional)
```

1. Haz clic en **"Seleccionar Archivo Word"**
2. Selecciona tu documento .docx
3. El sistema procesará el archivo automáticamente
4. Verás los campos detectados en badges verdes

### Paso 3: Completar Información del Tipo

Llena los datos básicos:
- **Nombre**: Ej: "Contrato Laboral"
- **Descripción**: "Para contratos de trabajo a plazo fijo e indefinido"
- **Categoría**: "Laboral"

### Paso 4: Guardar

Haz clic en **Guardar** y listo!

## 📄 Ejemplo Práctico

### Crear Tipo "Contrato de Servicios"

**1. Prepara tu Word:**
```
CONTRATO DE PRESTACIÓN DE SERVICIOS

Contratante: {{nombre_contratante}}
RUC: {{ruc_contratante}}
Dirección: {{direccion_contratante}}

Contratista: {{nombre_contratista}}
RUC: {{ruc_contratista}}

Objeto: {{objeto_contrato}}
Monto: S/. {{monto}}
Plazo: {{plazo}} días
Fecha de inicio: {{fecha_inicio}}
```

**2. Carga el archivo en "Nuevo Tipo"**

El sistema detectará 8 campos:
- Nombre Contratante
- RUC Contratante
- Dirección Contratante
- Nombre Contratista
- RUC Contratista
- Objeto Contrato
- Monto
- Plazo
- Fecha Inicio

**3. Completa el formulario:**
- Nombre: "Contrato de Servicios"
- Descripción: "Para servicios profesionales"
- Categoría: "Comercial"

**4. Guarda**

Ahora tienes un tipo de contrato con plantilla Word!

## 🎨 Visualización

Cuando veas la lista de tipos de contrato, verás:

```
┌─────────────────────────────────┐
│ Contrato de Servicios      📄  │
│ [Comercial]                     │
│                                 │
│ 📄 Plantilla: contrato.docx    │
│ ✅ 8 campos detectados          │
│                                 │
│ [Editar] [Eliminar]             │
└─────────────────────────────────┘
```

El ícono 📄 indica que tiene plantilla Word asociada.

## 💡 Ventajas

### 1. **Estandarización**
Todos los contratos del mismo tipo tendrán la misma estructura

### 2. **Reutilización**
Al crear una plantilla de "Contrato de Servicios", heredará los campos

### 3. **Consistencia**
Los campos ya están validados y estandarizados

### 4. **Rapidez**
No necesitas configurar campos cada vez que creas una plantilla

## 🔄 Flujo Completo

```
1. Admin crea "Tipo de Contrato" con archivo Word
          ↓
2. Sistema detecta campos automáticamente
          ↓
3. Campos se guardan con el tipo
          ↓
4. Al crear plantilla de ese tipo, usa los campos base
          ↓
5. Solicitantes ven formulario consistente
```

## 📝 Diferencia: Tipo vs Plantilla

### Tipo de Contrato (con Word)
- Define la **estructura base**
- Es una **categoría general**
- Ejemplo: "Contrato Laboral"
- Los campos son **sugeridos**

### Plantilla (con o sin Word)
- Es una **versión específica** del tipo
- Para un **caso de uso concreto**
- Ejemplo: "Contrato Laboral - Gerentes"
- Los campos son **requeridos**

## 🎯 Casos de Uso

### Caso 1: Empresa con muchos contratos laborales

1. Crea tipo "Contrato Laboral" con Word base
2. Campos detectados: nombre, cargo, salario, fecha, etc.
3. Crea plantillas específicas:
   - "Laboral - Gerentes"
   - "Laboral - Operarios"  
   - "Laboral - Practicantes"

Todas heredan los campos base pero pueden tener condiciones diferentes.

### Caso 2: Bufete Legal

Tipos de contrato con Word:
- Compraventa
- Arrendamiento
- Servicios Profesionales
- Confidencialidad (NDA)

Cada tipo con sus campos específicos pre-configurados.

## ⚙️ Configuración Avanzada

### Editar Tipo con Word

Si ya creaste un tipo y quieres agregar Word:
1. Haz clic en **Editar**
2. ⚠️ **Nota**: No puedes subir Word al editar
3. Debes crear un nuevo tipo si quieres cambiar el Word

### Campos Detectados

Los campos se guardan en el tipo como referencia, pero:
- Son **sugerencias** para nuevas plantillas
- Puedes modificarlos al crear plantillas
- No son obligatorios usar todos

## 🆚 Comparación

| Característica | Cargar en Tipo | Cargar en Plantilla |
|----------------|----------------|---------------------|
| Quién puede | Solo Admin | Admin y Abogados |
| Propósito | Definir base | Crear contrato específico |
| Campos | Sugeridos | Obligatorios |
| Reutilizable | Sí (por tipo) | Sí (por plantilla) |
| Versionamiento | No | Sí |

## 💼 Recomendaciones

### ✅ Mejores Prácticas

1. **Crea tipos con Word** para categorías principales
2. **Usa nombres descriptivos** para los tipos
3. **Revisa campos detectados** antes de guardar
4. **Documenta en descripción** qué casos cubre

### ❌ Evitar

1. No crear muchos tipos similares
2. No usar Word si el tipo es muy simple
3. No poner datos específicos en el tipo (van en plantilla)

## 🔍 Ejemplo Completo

### Paso a Paso: Tipo "Contrato de Arrendamiento"

**1. Crea el Word:**
```
CONTRATO DE ARRENDAMIENTO

ARRENDADOR: {{nombre_arrendador}}
DNI: {{dni_arrendador}}
Dirección: {{direccion_arrendador}}

ARRENDATARIO: {{nombre_arrendatario}}
DNI: {{dni_arrendatario}}

INMUEBLE:
Ubicación: {{direccion_inmueble}}
Área: {{area_m2}} m²

CONDICIONES:
Renta mensual: S/. {{renta_mensual}}
Depósito: S/. {{deposito}}
Plazo: {{plazo_meses}} meses
Fecha de inicio: {{fecha_inicio}}
Servicios incluidos: {{servicios_incluidos}}
```

**2. Ir a Tipos de Contrato → Nuevo Tipo**

**3. Cargar el archivo Word**
- Se detectarán 11 campos

**4. Completar:**
- Nombre: "Contrato de Arrendamiento"
- Descripción: "Para alquiler de inmuebles residenciales y comerciales"
- Categoría: "Inmobiliario"

**5. Guardar**

**6. Resultado:**
Ahora tienes un tipo base que:
- Tiene 11 campos predefinidos
- Puede usarse para múltiples plantillas
- Estandariza arrendamientos en tu sistema

**7. Usar en Plantillas:**
Cuando crees una plantilla de tipo "Arrendamiento":
- Opcionalmente, usa los campos detectados
- O carga otro Word específico
- O escribe contenido manual

## 🆘 Preguntas Frecuentes

**P: ¿Puedo editar el Word después?**
R: No directamente. Deberías crear un nuevo tipo o versión.

**P: ¿Los campos son obligatorios?**
R: No, son sugerencias. Al crear plantillas puedes modificarlos.

**P: ¿Puedo tener un tipo sin Word?**
R: Sí, el Word es opcional.

**P: ¿Cuántos tipos puedo crear?**
R: Ilimitados, pero recomendamos mantener solo los necesarios.

**P: ¿Qué pasa con plantillas ya creadas?**
R: No se afectan. El Word en tipo es solo para nuevas plantillas.

## 📞 Soporte

¿Necesitas ayuda?
1. Revisa la `GUIA_ARCHIVOS_WORD.md` para sintaxis de campos
2. Consulta esta guía
3. Contacta al administrador del sistema

---

**¡Disfruta creando tipos de contrato con plantillas Word! 🎉**

