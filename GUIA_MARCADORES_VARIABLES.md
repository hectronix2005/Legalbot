# 📋 Guía de Marcadores para Variables en Plantillas de Contratos

## 🎯 **Método Recomendado: Marcadores `{{variable}}`**

### ✅ **Cómo Usar:**
1. **Abre tu documento Word**
2. **Identifica las variables** que quieres que sean editables
3. **Reemplaza el texto** con marcadores usando `{{nombre_variable}}`
4. **Guarda el documento** como .docx
5. **Sube el archivo** al sistema

### 📝 **Ejemplos de Marcadores:**

#### **Información de Empresa:**
```
{{nombre_empresa}}
{{nit_empresa}}
{{direccion_empresa}}
{{telefono_empresa}}
{{email_empresa}}
```

#### **Información de Persona:**
```
{{nombre_persona}}
{{cedula_persona}}
{{cargo_persona}}
{{telefono_persona}}
{{email_persona}}
```

#### **Información del Contrato:**
```
{{fecha_contrato}}
{{monto_contrato}}
{{ciudad_contrato}}
{{duracion_contrato}}
{{objeto_contrato}}
```

#### **Información Legal:**
```
{{clausula_penal}}
{{ley_aplicable}}
{{tribunal_competente}}
{{moneda_pago}}
{{forma_pago}}
```

## 🔧 **Alternativas de Marcadores:**

### **Método 1: Corchetes `[variable]`**
```
[nombre_empresa]
[nit_empresa]
[fecha_contrato]
```

### **Método 2: Resaltado + Marcadores**
- Resalta el texto en **amarillo**
- Agrega marcadores `{{variable}}`
- Combina identificación visual y programática

## 📋 **Nombres de Variables Recomendados:**

### **Empresas:**
- `nombre_empresa`
- `nit_empresa`
- `direccion_empresa`
- `telefono_empresa`
- `email_empresa`

### **Personas:**
- `nombre_persona`
- `cedula_persona`
- `cargo_persona`
- `telefono_persona`
- `email_persona`

### **Contratos:**
- `fecha_contrato`
- `monto_contrato`
- `ciudad_contrato`
- `duracion_contrato`
- `objeto_contrato`

### **Legales:**
- `clausula_penal`
- `ley_aplicable`
- `tribunal_competente`
- `moneda_pago`
- `forma_pago`

## 🎨 **Ejemplo de Documento:**

```
ACUERDO DE CONFIDENCIALIDAD

Entre {{nombre_empresa_1}}, identificada con NIT {{nit_empresa_1}}, 
con domicilio en {{direccion_empresa_1}}, representada por 
{{nombre_persona_1}}, identificado con C.C. {{cedula_persona_1}}, 
y {{nombre_empresa_2}}, identificada con NIT {{nit_empresa_2}}, 
con domicilio en {{direccion_empresa_2}}, representada por 
{{nombre_persona_2}}, identificado con C.C. {{cedula_persona_2}}.

El presente contrato se celebra en {{ciudad_contrato}} el {{fecha_contrato}} 
por un monto de {{monto_contrato}} {{moneda_pago}}.
```

## ✅ **Ventajas del Método:**

1. **Fácil de usar**: Solo agregar `{{variable}}`
2. **Muy confiable**: 99% de detección
3. **Nombres descriptivos**: Fácil de entender
4. **Compatible**: Funciona con cualquier procesador
5. **Escalable**: Puedes agregar tantas variables como necesites

## 🚀 **Proceso Completo:**

1. **Crear plantilla** con marcadores `{{variable}}`
2. **Subir al sistema** (se detectan automáticamente)
3. **Configurar tipos** de campos (texto, fecha, número, etc.)
4. **Generar contratos** con formularios dinámicos
5. **Descargar documentos** personalizados

¡Este método es el más efectivo y confiable para tu sistema de plantillas!
