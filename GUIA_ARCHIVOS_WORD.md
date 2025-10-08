# 📄 Guía: Carga de Archivos Word para Plantillas

## 🎯 Nueva Funcionalidad

Ahora puedes crear plantillas de contratos cargando directamente archivos de Microsoft Word (.docx). El sistema automáticamente detectará los campos variables y creará el formulario de solicitud.

## 🚀 Cómo Usar

### Paso 1: Preparar tu Documento Word

1. Abre Microsoft Word
2. Escribe tu contrato con el formato que desees
3. **Para los campos que quieres que sean variables** (que el solicitante pueda llenar), usa la siguiente sintaxis:

```
{{nombre_del_campo}}
```

#### Ejemplo de Documento Word:

```
CONTRATO DE PRESTACIÓN DE SERVICIOS

En {{ciudad}}, a {{fecha}} del mes de {{mes}} de {{anio}}.

Entre:
- CONTRATANTE: {{nombre_contratante}}, con documento {{tipo_documento}} N° {{numero_documento}}
- CONTRATISTA: {{nombre_contratista}}, con RUC {{ruc_contratista}}

PRIMERA: OBJETO DEL CONTRATO
El contratista se compromete a realizar: {{descripcion_servicios}}

SEGUNDA: MONTO
El monto total es de S/. {{monto}} ({{monto_letras}})

TERCERA: PLAZO
El plazo de ejecución es de {{plazo}} días calendario, iniciando el {{fecha_inicio}}.
```

### Paso 2: Cargar el Archivo en el Sistema

1. **Inicia sesión** como Admin o Abogado
2. Ve a **Plantillas** → **Nueva Plantilla**
3. En la sección azul "**Nuevo: Cargar Archivo Word**", haz clic en **Seleccionar Archivo Word**
4. Selecciona tu archivo .docx
5. El sistema procesará automáticamente el archivo

### Paso 3: El Sistema Detectará los Campos

El sistema buscará todos los campos entre `{{}}` y automáticamente:

✅ Extraerá el nombre del campo
✅ Generará una etiqueta legible
✅ Detectará el tipo de campo (texto, número, fecha, etc.)
✅ Los marcará como obligatorios

**Ejemplo de detección automática:**

| Campo en Word | Nombre | Etiqueta Generada | Tipo Detectado |
|--------------|--------|-------------------|----------------|
| `{{nombre_contratante}}` | nombre_contratante | Nombre Contratante | texto |
| `{{fecha}}` | fecha | Fecha | fecha |
| `{{monto}}` | monto | Monto | número |
| `{{email_contacto}}` | email_contacto | Email Contacto | email |
| `{{descripcion_servicios}}` | descripcion_servicios | Descripción Servicios | área de texto |

### Paso 4: Revisar y Ajustar Campos

Después de procesar el archivo, verás:

- ✅ Número de campos detectados
- 📝 Lista de todos los campos con sus tipos

Puedes:
- Editar las etiquetas para hacerlas más descriptivas
- Cambiar el tipo de campo si es necesario
- Marcar campos como opcionales
- Agregar opciones para campos tipo "select"
- Reorganizar el orden de los campos

### Paso 5: Guardar la Plantilla

Completa la información básica:
- Nombre de la plantilla
- Descripción
- Tipo de contrato
- Empresa (opcional)

Haz clic en **Crear Plantilla**

## 📝 Convenciones de Nombres

Para una mejor detección automática, usa nombres descriptivos:

### ✅ Buenos nombres:
- `{{nombre_completo}}`
- `{{fecha_nacimiento}}`
- `{{email_principal}}`
- `{{monto_total}}`
- `{{direccion_domicilio}}`

### ❌ Evita:
- `{{campo1}}` - No es descriptivo
- `{{x}}` - Muy corto
- `{{NombreCompleto}}` - Mayúsculas en medio (usa snake_case)

## 🎨 Detección Automática de Tipos de Campo

El sistema detecta automáticamente el tipo según el nombre:

| Palabras Clave | Tipo Detectado |
|----------------|----------------|
| email, correo | Email |
| fecha, date | Fecha |
| monto, precio, cantidad, numero | Número |
| descripcion, observacion, notas, comentario | Área de texto |
| tipo, categoria | Selección (lista) |
| *otros* | Texto |

## 💾 Generación de Contratos

Cuando un solicitante complete el formulario:

1. El sistema tomará el archivo Word original
2. Reemplazará todos los `{{campos}}` con los datos ingresados
3. El contrato se podrá **descargar en formato Word** (.docx)
4. También estará disponible en formato PDF para imprimir

## 🔄 Flujo Completo

```
1. Admin/Abogado carga archivo Word con {{campos}}
          ↓
2. Sistema detecta campos automáticamente
          ↓
3. Se revisan y ajustan campos si es necesario
          ↓
4. Se guarda la plantilla
          ↓
5. Solicitante crea solicitud y llena el formulario
          ↓
6. Abogado revisa y aprueba
          ↓
7. Se genera contrato con datos llenos
          ↓
8. Contrato disponible en Word y PDF
```

## 📋 Ejemplo Práctico

### Archivo Word de Entrada:

```
CONTRATO LABORAL

Empleador: {{nombre_empresa}}
RUC: {{ruc_empresa}}

Trabajador: {{nombre_trabajador}}
DNI: {{dni_trabajador}}
Cargo: {{cargo}}

Remuneración mensual: S/. {{salario}}
Fecha de inicio: {{fecha_inicio}}
```

### Campos Generados Automáticamente:

1. **Nombre Empresa** (texto)
2. **RUC Empresa** (texto)
3. **Nombre Trabajador** (texto)
4. **DNI Trabajador** (texto)
5. **Cargo** (texto)
6. **Salario** (número)
7. **Fecha Inicio** (fecha)

### Formulario que Verá el Solicitante:

```
┌─────────────────────────────────┐
│ Nombre Empresa: [_____________] │
│ RUC Empresa: [________________] │
│ Nombre Trabajador: [__________] │
│ DNI Trabajador: [_____________] │
│ Cargo: [______________________] │
│ Salario: [____________________] │
│ Fecha Inicio: [____/____/____]  │
└─────────────────────────────────┘
```

## ⚡ Ventajas

✅ **Rápido**: No necesitas escribir manualmente el contenido de la plantilla
✅ **Automático**: Los campos se detectan sin configuración manual
✅ **Formato Profesional**: Usa el formato de Word que ya tienes
✅ **Editable**: Los contratos generados son archivos Word editables
✅ **Flexible**: Puedes ajustar los campos detectados

## ⚠️ Limitaciones Actuales

- Solo archivos .docx y .doc (no .pdf)
- Los campos deben estar entre `{{}}` dobles llaves
- Tamaño máximo: 10 MB
- No se preservan imágenes complejas ni macros

## 🆘 Solución de Problemas

**Problema: No se detectan los campos**
- Verifica que uses dobles llaves: `{{campo}}`
- Asegúrate de no tener espacios: `{{ campo }}` ❌ vs `{{campo}}` ✅

**Problema: El tipo de campo no es correcto**
- Puedes cambiarlo manualmente después de la carga
- O renombra el campo para que se detecte mejor (ej: `{{fecha_inicio}}` en lugar de `{{inicio}}`)

**Problema: Error al subir el archivo**
- Verifica que sea un archivo .docx o .doc
- Asegúrate de que no supere los 10 MB
- Cierra el archivo si lo tienes abierto en Word

## 📞 Soporte

Si necesitas ayuda:
1. Revisa esta guía
2. Consulta los ejemplos incluidos
3. Contacta al administrador del sistema

---

**¡Disfruta de la nueva funcionalidad! 🎉**

