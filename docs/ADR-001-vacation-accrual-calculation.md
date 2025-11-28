# ADR-001: Cálculo de Causación de Vacaciones

## Estado
**Aceptado** - 2024-11-25

## Contexto
El módulo de vacaciones de Legalbot debe implementar causación diaria conforme a la legislación laboral colombiana (Código Sustantivo del Trabajo, Art. 186). Se requiere definir:

1. Base de cálculo: 365 días vs 360 días
2. Tipo de días: hábiles vs calendario
3. Fórmula de causación diaria
4. Manejo de años bisiestos
5. Precisión decimal

## Decisión

### 1. Base de Cálculo: 365 días (año calendario)

**Seleccionado:** `15 días / 365 días del año = 0.04109589041 días por día trabajado`

**Alternativa rechazada:** `15 días / 360 días = 0.04166666667 días por día trabajado`

**Razón:**
- El año calendario de 365 días es el estándar legal en Colombia para cálculos de prestaciones laborales
- La base 360 se usa principalmente para intereses bancarios, no para derechos laborales
- Usar 365 días evita sobre-causación que resultaría en más de 15 días por año

### 2. Tipo de Días: Días hábiles causados, almacenados en calendario

**Seleccionado:** Causación de 15 días hábiles por año, pero el cálculo interno usa días calendario

**Conversión:**
- La fórmula `15/365` causa días que representan "días hábiles de derecho"
- Al solicitar vacaciones, las fechas son calendario pero los días descontados son los solicitados
- El empleado puede solicitar 5 días de vacaciones (representan 1 semana hábil)

**Razón:**
- El CST Art. 186 especifica "15 días hábiles"
- La causación diaria en calendario simplifica el cálculo
- La gestión operativa (solicitud/aprobación) usa días calendario naturalmente

### 3. Fórmula de Causación Diaria

```javascript
// Año regular (365 días)
DAILY_ACCRUAL = 15 / 365 = 0.04109589041095890

// Año bisiesto (366 días)
LEAP_DAILY_ACCRUAL = 15 / 366 = 0.04098360655737705
```

**Implementación:**
```javascript
function calculateAccruedVacationDays(hireDate, currentDate) {
  let accruedDays = 0;

  // Iterar año por año
  for (year in range(hireDate.year, currentDate.year)) {
    const daysInYear = isLeapYear(year) ? 366 : 365;
    const dailyRate = 15 / daysInYear;
    const daysWorkedInYear = calculateDaysInYear(year, hireDate, currentDate);
    accruedDays += daysWorkedInYear * dailyRate;
  }

  return round(accruedDays, 4);
}
```

### 4. Manejo de Años Bisiestos

**Decisión:** Ajustar la tasa diaria según el año específico

- Años regulares: `15 / 365 = 0.04109589`
- Años bisiestos: `15 / 366 = 0.04098361`

**Razón:** Garantiza que exactamente 15 días se acumulen por cada año completo trabajado, sin importar si es bisiesto o no.

### 5. Precisión Decimal

**Decisión:** 4 decimales para cálculos internos

**Razón:**
- Permite acumulación precisa sin pérdida significativa
- Evita acumulación de errores de redondeo en empleados antiguos
- Al presentar al usuario, se puede redondear a 2 decimales

## Fórmulas Clave

### Días Disponibles
```
availableDays = accruedDays - enjoyedDays - approvedPendingDays
```

### Validación de Solicitud
```
isValid = requestedDays <= availableDays
```

### Ejemplo de Cálculo

**Empleado contratado:** 2023-01-01
**Fecha actual:** 2024-11-25
**Días trabajados:** 694 días

```
2023 (365 días trabajados): 365 × 0.04109589 = 15.0000 días
2024 (329 días trabajados): 329 × 0.04098361 = 13.4836 días
Total acumulado: 28.4836 días
```

## Casos Especiales

### Licencias No Remuneradas
- **Decisión:** Suspender causación durante licencias no remuneradas
- **Implementación:** Registrar períodos de suspensión y excluirlos del cálculo

### Ausencias Injustificadas
- **Decisión:** No causar vacaciones durante ausencias injustificadas
- **Implementación:** Campo `suspensionPeriods` en VacationBalance

### Vacaciones Anticipadas
- **Decisión:** Permitir solicitar días aún no causados si política de empresa lo permite
- **Implementación:** Campo `allowAdvance` en configuración de empresa (no implementado actualmente)

## Estado Máquina de Solicitudes

```
requested → approved → scheduled → enjoyed
    ↓           ↓
rejected    cancelled
```

**Transiciones válidas:**
- `requested` → `approved` (por admin/talento_humano)
- `requested` → `rejected` (por admin/talento_humano, requiere razón)
- `approved` → `scheduled` (programación de fechas)
- `approved` → `cancelled` (por solicitante o admin)
- `scheduled` → `enjoyed` (al finalizar el período, automático o manual)
- `scheduled` → `cancelled` (con política de empresa)

## Impacto en Balance

| Estado | accruedDays | approvedPendingDays | enjoyedDays | availableDays |
|--------|-------------|---------------------|-------------|---------------|
| requested | Sin cambio | Sin cambio | Sin cambio | Sin cambio |
| approved | Sin cambio | +requestedDays | Sin cambio | -requestedDays |
| scheduled | Sin cambio | Sin cambio | Sin cambio | Sin cambio |
| enjoyed | Sin cambio | -requestedDays | +requestedDays | Sin cambio |
| rejected | Sin cambio | Sin cambio | Sin cambio | Sin cambio |
| cancelled | Sin cambio | -requestedDays | Sin cambio | +requestedDays |

## Consecuencias

### Positivas
- Cálculo preciso conforme a legislación colombiana
- Manejo correcto de años bisiestos
- Trazabilidad completa mediante logs de auditoría
- Validación automática previene sobregiro de días

### Negativas
- Complejidad en cálculo año por año
- Posible confusión entre "días hábiles" y "días calendario"
- Necesidad de job diario/semanal para mantener causación actualizada

## Referencias

- Código Sustantivo del Trabajo, Artículo 186
- Ministerio de Trabajo Colombia - Cartilla Laboral
- `backend/services/vacationAccrualService.js` - Implementación

## Changelog

| Fecha | Cambio | Autor |
|-------|--------|-------|
| 2024-11-25 | Documento inicial | Sistema |
