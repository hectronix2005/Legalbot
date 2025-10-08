# Guía de Uso - Sistema de Gestión de Contratos Legales

## 📖 Introducción

Esta guía te ayudará a aprovechar al máximo el sistema de gestión de contratos legales.

## 🚀 Inicio Rápido

### 1. Primera Configuración

```bash
# Paso 1: Instalar dependencias
npm run install:all

# Paso 2: Inicializar base de datos
cd backend
npm run init-db

# Paso 3: Ejecutar el sistema
cd ..
npm run dev
```

### 2. Acceso al Sistema

Abre tu navegador en: http://localhost:3000

Usa las credenciales de prueba según tu rol:
- **Admin**: admin@demo.com / 123456
- **Abogado**: abogado@demo.com / 123456
- **Solicitante**: solicitante@demo.com / 123456

## 👨‍💼 Guía por Rol

### Para Administradores

#### 1. Gestionar Empresas
1. Ve a **Empresas** en el menú lateral
2. Haz clic en **Nueva Empresa**
3. Completa: Nombre, RUC/NIT, Dirección, Teléfono
4. Guarda la empresa

#### 2. Gestionar Usuarios
1. Navega a **Usuarios**
2. Filtra por rol o empresa
3. Puedes desactivar usuarios si es necesario

#### 3. Crear Tipos de Contrato
1. Ve a **Tipos de Contrato**
2. Clic en **Nuevo Tipo**
3. Ingresa: Nombre, Descripción, Categoría
4. Guarda el tipo

#### 4. Crear Plantillas
1. Ve a **Plantillas** → **Nueva Plantilla**
2. Completa información básica:
   - Nombre
   - Descripción
   - Tipo de contrato
   - Empresa (opcional)
3. Escribe el contenido usando variables: `{{nombreVariable}}`
4. Define campos dinámicos:
   - Nombre del campo (debe coincidir con la variable)
   - Etiqueta visible
   - Tipo de campo
   - Requerido o no
5. Guarda la plantilla

**Ejemplo de contenido de plantilla:**
```
CONTRATO DE SERVICIOS

Entre {{nombre_cliente}} y {{nombre_proveedor}},
acordamos lo siguiente:

Monto: {{monto}}
Fecha de inicio: {{fecha_inicio}}
```

### Para Abogados

#### 1. Crear Plantillas
- Mismos pasos que el administrador

#### 2. Revisar Solicitudes
1. Ve a **Solicitudes**
2. Filtra por estado (pendientes, en revisión)
3. Haz clic en una solicitud para ver detalles
4. Opciones disponibles:
   - **Asignar abogado** (si está sin asignar)
   - **Aprobar** con notas legales
   - **Rechazar** con motivo

#### 3. Generar Contratos
1. Abre una solicitud aprobada
2. Revisa la vista previa del contrato
3. Haz clic en **Generar Contrato**
4. El contrato aparecerá en la sección **Contratos**

#### 4. Gestionar Contratos
1. Ve a **Contratos**
2. Visualiza o imprime contratos
3. Cambia estado: Activo, Terminado, Expirado

### Para Solicitantes

#### 1. Crear Solicitud de Contrato
1. Ve a **Solicitudes** → **Nueva Solicitud**
2. Ingresa un título descriptivo
3. Selecciona una plantilla
4. Completa todos los campos obligatorios (marcados con *)
5. Revisa la información
6. Haz clic en **Enviar Solicitud**

#### 2. Seguimiento de Solicitudes
1. Ve a **Solicitudes**
2. Verás el estado de tus solicitudes:
   - **Pendiente**: Esperando asignación
   - **En Revisión**: Un abogado está revisando
   - **Aprobada**: Solicitud aprobada, generando contrato
   - **Rechazada**: Ver motivo de rechazo
   - **Completada**: Contrato generado

#### 3. Ver Contratos
1. Ve a **Contratos**
2. Visualiza tus contratos aprobados
3. Imprime o descarga según necesites

## 📋 Ejemplos Prácticos

### Ejemplo 1: Crear Plantilla de Contrato Laboral

**Paso 1: Información básica**
- Nombre: "Contrato Laboral Estándar"
- Tipo: "Contrato Laboral"
- Descripción: "Plantilla para contratos de trabajo a plazo indefinido"

**Paso 2: Contenido**
```
CONTRATO DE TRABAJO

Conste por el presente documento el Contrato de Trabajo que celebran:

EMPLEADOR: {{nombre_empresa}}, RUC {{ruc_empresa}}, domiciliado en {{direccion_empresa}}.

TRABAJADOR: {{nombre_trabajador}}, identificado con DNI {{dni_trabajador}}, domiciliado en {{direccion_trabajador}}.

PRIMERA.- CARGO
El TRABAJADOR desempeñará el cargo de {{cargo}} en el área de {{area}}.

SEGUNDA.- REMUNERACIÓN
El TRABAJADOR percibirá una remuneración mensual de S/. {{salario}}.

TERCERA.- JORNADA
La jornada laboral será de {{horas_semanales}} horas semanales.

CUARTA.- INICIO
El presente contrato inicia el {{fecha_inicio}}.
```

**Paso 3: Campos dinámicos**
- `nombre_empresa` - Texto - Requerido
- `ruc_empresa` - Texto - Requerido
- `direccion_empresa` - Área de texto - Requerido
- `nombre_trabajador` - Texto - Requerido
- `dni_trabajador` - Texto - Requerido
- `direccion_trabajador` - Área de texto - Requerido
- `cargo` - Texto - Requerido
- `area` - Texto - Requerido
- `salario` - Número - Requerido
- `horas_semanales` - Número - Requerido
- `fecha_inicio` - Fecha - Requerido

### Ejemplo 2: Solicitar Contrato de Servicios

**Como Solicitante:**

1. Nueva Solicitud
2. Título: "Contrato Consultoría - Proyecto Web"
3. Plantilla: "Contrato de Servicios Profesionales"
4. Completar datos:
   - Ciudad: Lima
   - Fecha actual
   - Datos del cliente
   - Datos del proveedor
   - Descripción del servicio
   - Monto y forma de pago

5. Enviar y esperar aprobación

## 🔄 Flujo Completo del Proceso

```
1. ADMINISTRADOR crea plantilla
        ↓
2. SOLICITANTE crea solicitud usando plantilla
        ↓
3. Sistema notifica al área legal
        ↓
4. ABOGADO se asigna la solicitud
        ↓
5. ABOGADO revisa datos
        ↓
6. ABOGADO aprueba (o rechaza con motivo)
        ↓
7. ABOGADO genera contrato final
        ↓
8. Contrato disponible para todos los involucrados
```

## 💡 Consejos y Mejores Prácticas

### Para Crear Plantillas

1. **Usa nombres descriptivos** para las variables
   - ✅ Bien: `{{fecha_inicio_contrato}}`
   - ❌ Mal: `{{fecha1}}`

2. **Organiza los campos** en orden lógico
   - Primero datos del contratante
   - Luego datos del contratista
   - Después términos del contrato

3. **Incluye validaciones**
   - Marca campos como requeridos
   - Usa tipos apropiados (email, fecha, número)

4. **Documenta cambios**
   - Al actualizar, describe qué modificaste
   - Útil para el historial de versiones

### Para Solicitar Contratos

1. **Título claro**: Identifica fácilmente el propósito
   - ✅ "Contrato Servicios - Desarrollo Web - Cliente XYZ"
   - ❌ "Nuevo contrato"

2. **Datos completos**: Verifica toda la información antes de enviar

3. **Revisa la vista previa**: Asegúrate que todo se vea correcto

### Para Abogados

1. **Revisa cuidadosamente** todos los datos antes de aprobar

2. **Usa notas legales** para documentar observaciones importantes

3. **Motivos claros** al rechazar una solicitud

## ❓ Preguntas Frecuentes

**¿Puedo editar una solicitud después de enviarla?**
- Solo si está en estado "Pendiente" y eres el solicitante

**¿Cómo actualizo una plantilla?**
- Edita la plantilla, describe los cambios. El sistema creará una nueva versión automáticamente

**¿Puedo usar una plantilla para múltiples empresas?**
- Sí, deja el campo "Empresa" vacío al crear la plantilla

**¿Qué pasa si rechazan mi solicitud?**
- Puedes ver el motivo y crear una nueva solicitud con los datos corregidos

**¿Puedo imprimir los contratos?**
- Sí, desde la vista de detalle del contrato usa el botón "Imprimir/Descargar"

## 🆘 Solución de Problemas

**Error al iniciar sesión**
- Verifica que hayas ejecutado `npm run init-db`
- Revisa las credenciales de prueba

**No veo plantillas**
- Verifica tu rol (solicitantes ven solo plantillas de su empresa)
- Un admin o abogado debe crear plantillas primero

**Error al generar contrato**
- La solicitud debe estar en estado "Aprobada"
- Solo admin y abogados pueden generar contratos

## 📞 Soporte

Para reportar problemas o sugerencias:
1. Revisa esta guía
2. Consulta el README.md
3. Contacta al administrador del sistema

---

¡Gracias por usar el Sistema de Gestión de Contratos Legales!

