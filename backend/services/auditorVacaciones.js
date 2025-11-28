/**
 * AuditorVacaciones - Servicio de auditoría continua
 * Detecta y previene incoherencias entre días disponibles vs solicitados/aprobados/disfrutados
 *
 * NO modifica saldos, solo reporta y recomienda
 * Logs sin PII (solo IDs)
 */

const fs = require('fs').promises;
const path = require('path');
const { calcularCausacion, saldoDisponible, floorDecimals } = require('./motorVacaciones');

// ============================================================================
// CONSTANTES Y CONFIGURACIÓN
// ============================================================================

const SEVERIDAD = {
  CRITICA: 'CRITICA',  // Excedentes de saldo
  ALTA: 'ALTA',        // Fechas inválidas
  MEDIA: 'MEDIA',      // Datos faltantes
  BAJA: 'BAJA'         // Redondeos/precisión
};

const TIPO_ALERTA = {
  SALDO_NEGATIVO: 'SALDO_NEGATIVO',
  REQUESTED_EXCEDE_SALDO: 'REQUESTED_EXCEDE_SALDO',
  APPROVED_EXCEDE_SALDO: 'APPROVED_EXCEDE_SALDO',
  ENJOYED_EXCEDE_ACCRUED: 'ENJOYED_EXCEDE_ACCRUED',
  FECHA_FIN_ANTERIOR_INICIO: 'FECHA_FIN_ANTERIOR_INICIO',
  PERIODOS_SUPERPUESTOS: 'PERIODOS_SUPERPUESTOS',
  DATOS_SUSPENSION_FALTANTES: 'DATOS_SUSPENSION_FALTANTES',
  DATOS_CONTRATO_FALTANTES: 'DATOS_CONTRATO_FALTANTES',
  PRECISION_REDONDEO: 'PRECISION_REDONDEO',
  CAUSACION_INCONSISTENTE: 'CAUSACION_INCONSISTENTE'
};

const CONFIG_AUDITOR = {
  TOLERANCIA_REDONDEO: 0.0001,
  MAX_ALERTAS_POR_EMPLEADO: 50,
  INTERVALO_EJECUCION_MS: 60 * 60 * 1000, // 1 hora por defecto
  DIRECTORIO_REPORTES: 'auditoria',
  HABILITAR_ISSUES: false // Por defecto deshabilitado
};

// ============================================================================
// CLASE PRINCIPAL DEL AUDITOR
// ============================================================================

class AuditorVacaciones {
  constructor(db, opciones = {}) {
    this.db = db;
    this.config = { ...CONFIG_AUDITOR, ...opciones };
    this.alertas = [];
    this.todos = [];
    this.estadisticas = {
      empleadosAuditados: 0,
      empleadosConAlerta: 0,
      alertasPorSeveridad: { CRITICA: 0, ALTA: 0, MEDIA: 0, BAJA: 0 },
      alertasPorTipo: {},
      saldoPromedio: 0,
      tiempoEjecucion: 0
    };
    this.ejecucionActiva = false;
    this.intervaloId = null;
  }

  // --------------------------------------------------------------------------
  // MÉTODOS DE EJECUCIÓN CONTINUA
  // --------------------------------------------------------------------------

  /**
   * Inicia la ejecución continua del auditor
   */
  iniciar() {
    if (this.intervaloId) {
      console.log(`[AuditorVacaciones] Ya está en ejecución`);
      return;
    }

    console.log(`[AuditorVacaciones] Iniciando auditoría continua (intervalo: ${this.config.INTERVALO_EJECUCION_MS}ms)`);

    // Ejecutar inmediatamente la primera vez
    this.ejecutarAuditoria();

    // Programar ejecuciones periódicas
    this.intervaloId = setInterval(() => {
      this.ejecutarAuditoria();
    }, this.config.INTERVALO_EJECUCION_MS);
  }

  /**
   * Detiene la ejecución continua
   */
  detener() {
    if (this.intervaloId) {
      clearInterval(this.intervaloId);
      this.intervaloId = null;
      console.log(`[AuditorVacaciones] Auditoría continua detenida`);
    }
  }

  /**
   * Ejecuta una auditoría completa
   */
  async ejecutarAuditoria(companyId = null) {
    if (this.ejecucionActiva) {
      console.log(`[AuditorVacaciones] Auditoría en progreso, omitiendo ejecución`);
      return null;
    }

    this.ejecucionActiva = true;
    const inicioEjecucion = Date.now();

    // Reset estado
    this.alertas = [];
    this.todos = [];
    this.estadisticas = {
      empleadosAuditados: 0,
      empleadosConAlerta: 0,
      alertasPorSeveridad: { CRITICA: 0, ALTA: 0, MEDIA: 0, BAJA: 0 },
      alertasPorTipo: {},
      saldoPromedio: 0,
      tiempoEjecucion: 0
    };

    try {
      console.log(`[AuditorVacaciones] Iniciando auditoría ${companyId ? `para empresa ${companyId}` : 'global'}`);

      // 1. Obtener lista de empleados
      const empleados = await this.obtenerEmpleadosConSaldos(companyId);
      this.estadisticas.empleadosAuditados = empleados.length;

      // 2. Auditar cada empleado
      let sumaSaldos = 0;
      const empleadosConAlerta = new Set();

      for (const empleado of empleados) {
        const alertasEmpleado = await this.auditarEmpleado(empleado);

        if (alertasEmpleado.length > 0) {
          empleadosConAlerta.add(empleado.empleadoId);
        }

        sumaSaldos += empleado.saldoCalculado || 0;
      }

      // 3. Auditoría cruzada (superposiciones entre empleados del mismo equipo)
      await this.auditarSuperposicionesEquipo(empleados);

      // 4. Calcular estadísticas
      this.estadisticas.empleadosConAlerta = empleadosConAlerta.size;
      this.estadisticas.saldoPromedio = empleados.length > 0
        ? floorDecimals(sumaSaldos / empleados.length, 2)
        : 0;
      this.estadisticas.tiempoEjecucion = Date.now() - inicioEjecucion;

      // 5. Generar reportes
      const reportes = await this.generarReportes();

      // 6. Crear issues si está habilitado
      if (this.config.HABILITAR_ISSUES) {
        await this.crearIssuesAutomaticos();
      }

      console.log(`[AuditorVacaciones] Auditoría completada en ${this.estadisticas.tiempoEjecucion}ms`);
      console.log(`[AuditorVacaciones] Empleados: ${this.estadisticas.empleadosAuditados}, Con alertas: ${this.estadisticas.empleadosConAlerta}`);
      console.log(`[AuditorVacaciones] Alertas - CRITICA: ${this.estadisticas.alertasPorSeveridad.CRITICA}, ALTA: ${this.estadisticas.alertasPorSeveridad.ALTA}`);

      return {
        estadisticas: this.estadisticas,
        alertas: this.alertas,
        todos: this.todos,
        reportes
      };

    } catch (error) {
      console.error(`[AuditorVacaciones] Error en auditoría:`, error.message);
      throw error;
    } finally {
      this.ejecucionActiva = false;
    }
  }

  // --------------------------------------------------------------------------
  // OBTENCIÓN DE DATOS
  // --------------------------------------------------------------------------

  /**
   * Obtiene empleados con sus saldos de vacaciones
   */
  async obtenerEmpleadosConSaldos(companyId = null) {
    if (!this.db) {
      return []; // Para pruebas sin DB
    }

    const query = companyId ? { companyId, activo: true } : { activo: true };

    const empleados = await this.db.collection('employees').find(query).toArray();

    return empleados.map(emp => ({
      empleadoId: emp._id.toString(),
      companyId: emp.companyId,
      fechaContratacion: emp.fechaContratacion || emp.hireDate,
      accrued: emp.vacaciones?.accrued || 0,
      approvedPend: emp.vacaciones?.approvedPending || 0,
      enjoyed: emp.vacaciones?.enjoyed || 0,
      requestedPend: emp.vacaciones?.requestedPending || 0,
      suspensiones: emp.suspensiones || [],
      factorJornada: emp.factorJornada || 1.0,
      tipoContrato: emp.tipoContrato,
      equipoId: emp.equipoId || emp.departamentoId
    }));
  }

  /**
   * Obtiene solicitudes de vacaciones de un empleado
   */
  async obtenerSolicitudesEmpleado(empleadoId, companyId) {
    if (!this.db) {
      return [];
    }

    return await this.db.collection('vacation_requests')
      .find({
        empleadoId,
        companyId,
        estado: { $in: ['REQUESTED', 'APPROVED', 'SCHEDULED'] }
      })
      .sort({ fechaInicio: 1 })
      .toArray();
  }

  // --------------------------------------------------------------------------
  // LÓGICA DE AUDITORÍA
  // --------------------------------------------------------------------------

  /**
   * Audita un empleado individual
   */
  async auditarEmpleado(empleado) {
    const alertasEmpleado = [];
    const { empleadoId, accrued, approvedPend, enjoyed, requestedPend, fechaContratacion } = empleado;

    // 1. Recalcular saldo
    const resultadoSaldo = saldoDisponible(accrued, enjoyed, approvedPend);
    empleado.saldoCalculado = resultadoSaldo.disponible;

    // 2. Verificar saldo válido
    if (!resultadoSaldo.valido) {
      alertasEmpleado.push(this.crearAlerta({
        tipo: TIPO_ALERTA.SALDO_NEGATIVO,
        severidad: SEVERIDAD.CRITICA,
        empleadoId,
        mensaje: resultadoSaldo.error,
        datos: { accrued, enjoyed, approvedPend, saldoCalculado: resultadoSaldo.disponible },
        accionSugerida: 'Revisar manualmente los registros de vacaciones del empleado'
      }));
    }

    // 3. Verificar requestedPend > saldo
    if (requestedPend > resultadoSaldo.disponible + this.config.TOLERANCIA_REDONDEO) {
      alertasEmpleado.push(this.crearAlerta({
        tipo: TIPO_ALERTA.REQUESTED_EXCEDE_SALDO,
        severidad: SEVERIDAD.CRITICA,
        empleadoId,
        mensaje: `Días solicitados (${requestedPend}) exceden saldo disponible (${resultadoSaldo.disponible})`,
        datos: { requestedPend, saldoDisponible: resultadoSaldo.disponible, excedente: requestedPend - resultadoSaldo.disponible },
        accionSugerida: 'Rechazar solicitudes excedentes o ajustar días solicitados'
      }));
    }

    // 4. Verificar approvedPend > saldo
    if (approvedPend > resultadoSaldo.disponible + approvedPend + this.config.TOLERANCIA_REDONDEO) {
      // approvedPend ya está restado del saldo, verificamos contra accrued - enjoyed
      const saldoSinApproved = accrued - enjoyed;
      if (approvedPend > saldoSinApproved + this.config.TOLERANCIA_REDONDEO) {
        alertasEmpleado.push(this.crearAlerta({
          tipo: TIPO_ALERTA.APPROVED_EXCEDE_SALDO,
          severidad: SEVERIDAD.CRITICA,
          empleadoId,
          mensaje: `Días aprobados pendientes (${approvedPend}) exceden saldo antes de aprobación (${saldoSinApproved})`,
          datos: { approvedPend, saldoSinApproved, accrued, enjoyed },
          accionSugerida: 'Revisar aprobaciones previas; posible error de cálculo'
        }));
      }
    }

    // 5. Verificar enjoyed > accrued
    if (enjoyed > accrued + this.config.TOLERANCIA_REDONDEO) {
      alertasEmpleado.push(this.crearAlerta({
        tipo: TIPO_ALERTA.ENJOYED_EXCEDE_ACCRUED,
        severidad: SEVERIDAD.CRITICA,
        empleadoId,
        mensaje: `Días disfrutados (${enjoyed}) exceden días causados (${accrued})`,
        datos: { enjoyed, accrued, diferencia: enjoyed - accrued },
        accionSugerida: 'URGENTE: Posible fraude o error grave. Auditoría manual requerida'
      }));
    }

    // 6. Verificar causación vs calculada
    if (fechaContratacion) {
      const causacionCalculada = calcularCausacion(
        fechaContratacion,
        new Date(),
        {
          periodosSinCausar: empleado.suspensiones,
          factorJornada: empleado.factorJornada
        }
      );

      if (!causacionCalculada.error) {
        const diferenciaCausacion = Math.abs(accrued - causacionCalculada.diasCausados);
        if (diferenciaCausacion > 1) { // Más de 1 día de diferencia
          alertasEmpleado.push(this.crearAlerta({
            tipo: TIPO_ALERTA.CAUSACION_INCONSISTENTE,
            severidad: SEVERIDAD.ALTA,
            empleadoId,
            mensaje: `Causación registrada (${accrued}) difiere de calculada (${causacionCalculada.diasCausados})`,
            datos: {
              accrued,
              calculado: causacionCalculada.diasCausados,
              diferencia: diferenciaCausacion
            },
            accionSugerida: 'Ejecutar recálculo de causación para este empleado'
          }));
        } else if (diferenciaCausacion > this.config.TOLERANCIA_REDONDEO) {
          alertasEmpleado.push(this.crearAlerta({
            tipo: TIPO_ALERTA.PRECISION_REDONDEO,
            severidad: SEVERIDAD.BAJA,
            empleadoId,
            mensaje: `Pequeña diferencia de redondeo en causación (${diferenciaCausacion.toFixed(4)} días)`,
            datos: { accrued, calculado: causacionCalculada.diasCausados, diferencia: diferenciaCausacion },
            accionSugerida: 'Ninguna acción requerida, diferencia dentro de tolerancia'
          }));
        }
      }
    }

    // 7. Verificar datos de suspensiones
    if (empleado.suspensiones && empleado.suspensiones.length > 0) {
      for (const suspension of empleado.suspensiones) {
        if (!suspension.inicio || !suspension.fin) {
          this.todos.push({
            empleadoId,
            tipo: 'DATOS_SUSPENSION_INCOMPLETOS',
            mensaje: 'Suspensión con fechas faltantes',
            datos: suspension
          });

          alertasEmpleado.push(this.crearAlerta({
            tipo: TIPO_ALERTA.DATOS_SUSPENSION_FALTANTES,
            severidad: SEVERIDAD.MEDIA,
            empleadoId,
            mensaje: 'Periodo de suspensión con datos incompletos',
            datos: { suspension },
            accionSugerida: 'Completar fechas de inicio y fin de suspensión'
          }));
        }
      }
    }

    // 8. Verificar datos de contrato
    if (!fechaContratacion) {
      this.todos.push({
        empleadoId,
        tipo: 'FECHA_CONTRATACION_FALTANTE',
        mensaje: 'Empleado sin fecha de contratación registrada'
      });

      alertasEmpleado.push(this.crearAlerta({
        tipo: TIPO_ALERTA.DATOS_CONTRATO_FALTANTES,
        severidad: SEVERIDAD.MEDIA,
        empleadoId,
        mensaje: 'Fecha de contratación no registrada',
        datos: {},
        accionSugerida: 'Registrar fecha de contratación del empleado'
      }));
    }

    // 9. Auditar solicitudes del empleado
    const solicitudes = await this.obtenerSolicitudesEmpleado(empleadoId, empleado.companyId);
    const alertasSolicitudes = this.auditarSolicitudes(empleadoId, solicitudes);
    alertasEmpleado.push(...alertasSolicitudes);

    // Agregar alertas al array global
    this.alertas.push(...alertasEmpleado);

    return alertasEmpleado;
  }

  /**
   * Audita solicitudes de un empleado
   */
  auditarSolicitudes(empleadoId, solicitudes) {
    const alertas = [];

    for (const solicitud of solicitudes) {
      // Verificar fecha fin < inicio
      if (solicitud.fechaFin && solicitud.fechaInicio) {
        const inicio = new Date(solicitud.fechaInicio);
        const fin = new Date(solicitud.fechaFin);

        if (fin < inicio) {
          alertas.push(this.crearAlerta({
            tipo: TIPO_ALERTA.FECHA_FIN_ANTERIOR_INICIO,
            severidad: SEVERIDAD.ALTA,
            empleadoId,
            solicitudId: solicitud._id?.toString(),
            mensaje: `Fecha fin (${solicitud.fechaFin}) anterior a fecha inicio (${solicitud.fechaInicio})`,
            datos: { solicitudId: solicitud._id?.toString(), fechaInicio: solicitud.fechaInicio, fechaFin: solicitud.fechaFin },
            accionSugerida: 'Corregir fechas de la solicitud'
          }));
        }
      }
    }

    // Verificar superposiciones entre solicitudes del mismo empleado
    for (let i = 0; i < solicitudes.length; i++) {
      for (let j = i + 1; j < solicitudes.length; j++) {
        if (this.periodosSuperpuestos(solicitudes[i], solicitudes[j])) {
          alertas.push(this.crearAlerta({
            tipo: TIPO_ALERTA.PERIODOS_SUPERPUESTOS,
            severidad: SEVERIDAD.ALTA,
            empleadoId,
            mensaje: `Solicitudes con periodos superpuestos`,
            datos: {
              solicitud1: { id: solicitudes[i]._id?.toString(), inicio: solicitudes[i].fechaInicio, fin: solicitudes[i].fechaFin },
              solicitud2: { id: solicitudes[j]._id?.toString(), inicio: solicitudes[j].fechaInicio, fin: solicitudes[j].fechaFin }
            },
            accionSugerida: 'Rechazar o modificar una de las solicitudes superpuestas'
          }));
        }
      }
    }

    return alertas;
  }

  /**
   * Audita superposiciones a nivel de equipo
   */
  async auditarSuperposicionesEquipo(empleados) {
    // Agrupar por equipo
    const equipos = {};
    for (const emp of empleados) {
      if (emp.equipoId) {
        if (!equipos[emp.equipoId]) {
          equipos[emp.equipoId] = [];
        }
        equipos[emp.equipoId].push(emp);
      }
    }

    // Por ahora solo logging, se puede extender para detectar
    // demasiadas ausencias simultáneas en un equipo
    for (const [equipoId, miembros] of Object.entries(equipos)) {
      if (miembros.length > 1) {
        // Verificar si hay demasiadas solicitudes aprobadas para el mismo periodo
        // Esta lógica se puede expandir según necesidades
      }
    }
  }

  // --------------------------------------------------------------------------
  // UTILIDADES
  // --------------------------------------------------------------------------

  /**
   * Verifica si dos periodos se superponen
   */
  periodosSuperpuestos(s1, s2) {
    if (!s1.fechaInicio || !s1.fechaFin || !s2.fechaInicio || !s2.fechaFin) {
      return false;
    }
    const inicio1 = new Date(s1.fechaInicio);
    const fin1 = new Date(s1.fechaFin);
    const inicio2 = new Date(s2.fechaInicio);
    const fin2 = new Date(s2.fechaFin);

    return inicio1 <= fin2 && inicio2 <= fin1;
  }

  /**
   * Crea una alerta estructurada
   */
  crearAlerta({ tipo, severidad, empleadoId, solicitudId = null, mensaje, datos, accionSugerida }) {
    const alerta = {
      id: `ALT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      tipo,
      severidad,
      empleadoId, // Solo ID, sin PII
      solicitudId,
      mensaje,
      datos,
      accionSugerida
    };

    // Actualizar estadísticas
    this.estadisticas.alertasPorSeveridad[severidad]++;
    this.estadisticas.alertasPorTipo[tipo] = (this.estadisticas.alertasPorTipo[tipo] || 0) + 1;

    return alerta;
  }

  // --------------------------------------------------------------------------
  // GENERACIÓN DE REPORTES
  // --------------------------------------------------------------------------

  /**
   * Genera todos los reportes
   */
  async generarReportes() {
    const fecha = new Date().toISOString().split('T')[0];
    const dirReportes = this.config.DIRECTORIO_REPORTES;

    // Crear directorio si no existe
    try {
      await fs.mkdir(dirReportes, { recursive: true });
    } catch (e) {
      // Directorio ya existe o error
    }

    const reportes = {
      resumen: await this.generarResumenMD(fecha, dirReportes),
      casos: await this.generarCasosCSV(fecha, dirReportes)
    };

    return reportes;
  }

  /**
   * Genera reporte resumen en Markdown
   */
  async generarResumenMD(fecha, directorio) {
    const porcentajeConAlerta = this.estadisticas.empleadosAuditados > 0
      ? ((this.estadisticas.empleadosConAlerta / this.estadisticas.empleadosAuditados) * 100).toFixed(2)
      : 0;

    // Top 10 inconsistencias por tipo
    const top10Tipos = Object.entries(this.estadisticas.alertasPorTipo)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    // Alertas críticas
    const alertasCriticas = this.alertas
      .filter(a => a.severidad === SEVERIDAD.CRITICA)
      .slice(0, 10);

    const contenido = `# Reporte de Auditoría de Vacaciones

**Fecha:** ${fecha}
**Hora de ejecución:** ${new Date().toISOString()}
**Tiempo de ejecución:** ${this.estadisticas.tiempoEjecucion}ms

## KPIs Principales

| Métrica | Valor |
|---------|-------|
| Empleados auditados | ${this.estadisticas.empleadosAuditados} |
| Empleados con alerta | ${this.estadisticas.empleadosConAlerta} |
| % Empleados con alerta | ${porcentajeConAlerta}% |
| Saldo promedio (días) | ${this.estadisticas.saldoPromedio} |
| Total alertas | ${this.alertas.length} |

## Alertas por Severidad

| Severidad | Cantidad |
|-----------|----------|
| CRÍTICA | ${this.estadisticas.alertasPorSeveridad.CRITICA} |
| ALTA | ${this.estadisticas.alertasPorSeveridad.ALTA} |
| MEDIA | ${this.estadisticas.alertasPorSeveridad.MEDIA} |
| BAJA | ${this.estadisticas.alertasPorSeveridad.BAJA} |

## Top 10 Tipos de Inconsistencias

| Tipo | Cantidad |
|------|----------|
${top10Tipos.map(([tipo, cantidad]) => `| ${tipo} | ${cantidad} |`).join('\n')}

## Alertas Críticas (Top 10)

${alertasCriticas.length > 0 ? alertasCriticas.map((a, i) => `
### ${i + 1}. ${a.tipo}
- **ID Alerta:** ${a.id}
- **Empleado ID:** ${a.empleadoId}
- **Mensaje:** ${a.mensaje}
- **Acción sugerida:** ${a.accionSugerida}
`).join('\n') : '*No hay alertas críticas*'}

## TODOs Pendientes

${this.todos.length > 0 ? this.todos.map((t, i) => `
${i + 1}. **${t.tipo}** (Empleado: ${t.empleadoId})
   - ${t.mensaje}
`).join('\n') : '*No hay TODOs pendientes*'}

---
*Reporte generado automáticamente por AuditorVacaciones*
`;

    const rutaArchivo = path.join(directorio, `resumen-${fecha}.md`);
    await fs.writeFile(rutaArchivo, contenido, 'utf8');

    return rutaArchivo;
  }

  /**
   * Genera reporte de casos en CSV
   */
  async generarCasosCSV(fecha, directorio) {
    const headers = [
      'id_alerta',
      'timestamp',
      'severidad',
      'tipo',
      'empleado_id',
      'solicitud_id',
      'mensaje',
      'accion_sugerida'
    ];

    const filas = this.alertas.map(a => [
      a.id,
      a.timestamp,
      a.severidad,
      a.tipo,
      a.empleadoId,
      a.solicitudId || '',
      `"${a.mensaje.replace(/"/g, '""')}"`,
      `"${a.accionSugerida.replace(/"/g, '""')}"`
    ]);

    const contenido = [
      headers.join(','),
      ...filas.map(f => f.join(','))
    ].join('\n');

    const rutaArchivo = path.join(directorio, `casos-${fecha}.csv`);
    await fs.writeFile(rutaArchivo, contenido, 'utf8');

    return rutaArchivo;
  }

  // --------------------------------------------------------------------------
  // INTEGRACIÓN CON ISSUE TRACKER
  // --------------------------------------------------------------------------

  /**
   * Crea issues automáticos para alertas críticas
   */
  async crearIssuesAutomaticos() {
    const alertasCriticas = this.alertas.filter(a => a.severidad === SEVERIDAD.CRITICA);

    for (const alerta of alertasCriticas) {
      const issue = {
        titulo: `[VACACIONES] ${alerta.tipo} - Empleado ${alerta.empleadoId}`,
        cuerpo: this.generarCuerpoIssue(alerta),
        etiquetas: ['vacaciones', 'auditoría', alerta.severidad.toLowerCase()],
        prioridad: 'alta'
      };

      // Aquí se integraría con el tracker (GitHub Issues, Jira, etc.)
      console.log(`[AuditorVacaciones] Issue a crear:`, issue.titulo);

      // Ejemplo de integración con GitHub (requiere configuración):
      // await this.githubClient.issues.create({ owner, repo, title: issue.titulo, body: issue.cuerpo, labels: issue.etiquetas });
    }
  }

  /**
   * Genera el cuerpo de un issue
   */
  generarCuerpoIssue(alerta) {
    return `## Descripción
${alerta.mensaje}

## Datos
\`\`\`json
${JSON.stringify(alerta.datos, null, 2)}
\`\`\`

## Pasos para Reproducir
1. Acceder al módulo de vacaciones
2. Buscar empleado con ID: \`${alerta.empleadoId}\`
3. Verificar los valores de saldo de vacaciones
4. Comparar con los valores reportados

## Acción Sugerida
${alerta.accionSugerida}

## Metadata
- **ID Alerta:** ${alerta.id}
- **Timestamp:** ${alerta.timestamp}
- **Severidad:** ${alerta.severidad}

---
*Issue generado automáticamente por AuditorVacaciones*
`;
  }

  // --------------------------------------------------------------------------
  // API PÚBLICA
  // --------------------------------------------------------------------------

  /**
   * Obtiene el estado actual del auditor
   */
  obtenerEstado() {
    return {
      activo: !!this.intervaloId,
      ejecucionEnProgreso: this.ejecucionActiva,
      ultimaEjecucion: this.estadisticas.tiempoEjecucion > 0 ? this.estadisticas : null,
      config: this.config
    };
  }

  /**
   * Obtiene alertas filtradas
   */
  obtenerAlertas(filtros = {}) {
    let resultado = [...this.alertas];

    if (filtros.severidad) {
      resultado = resultado.filter(a => a.severidad === filtros.severidad);
    }
    if (filtros.tipo) {
      resultado = resultado.filter(a => a.tipo === filtros.tipo);
    }
    if (filtros.empleadoId) {
      resultado = resultado.filter(a => a.empleadoId === filtros.empleadoId);
    }

    return resultado;
  }

  /**
   * Obtiene estadísticas de la última ejecución
   */
  obtenerEstadisticas() {
    return { ...this.estadisticas };
  }

  /**
   * Obtiene TODOs pendientes
   */
  obtenerTodos() {
    return [...this.todos];
  }
}

// ============================================================================
// FUNCIONES AUXILIARES EXPORTADAS
// ============================================================================

/**
 * Valida un saldo de vacaciones (para uso externo)
 */
function validarSaldoVacaciones(empleado) {
  const { accrued, enjoyed, approvedPend, requestedPend } = empleado;
  const alertas = [];

  const resultado = saldoDisponible(accrued, enjoyed, approvedPend);

  if (!resultado.valido) {
    alertas.push({
      tipo: TIPO_ALERTA.SALDO_NEGATIVO,
      severidad: SEVERIDAD.CRITICA,
      mensaje: resultado.error
    });
  }

  if (requestedPend > resultado.disponible) {
    alertas.push({
      tipo: TIPO_ALERTA.REQUESTED_EXCEDE_SALDO,
      severidad: SEVERIDAD.CRITICA,
      mensaje: `Solicitado (${requestedPend}) excede disponible (${resultado.disponible})`
    });
  }

  if (enjoyed > accrued) {
    alertas.push({
      tipo: TIPO_ALERTA.ENJOYED_EXCEDE_ACCRUED,
      severidad: SEVERIDAD.CRITICA,
      mensaje: `Disfrutado (${enjoyed}) excede causado (${accrued})`
    });
  }

  return {
    valido: alertas.length === 0,
    saldoDisponible: resultado.disponible,
    alertas
  };
}

/**
 * Detecta superposición de periodos
 */
function detectarSuperposicion(periodos) {
    const superposiciones = [];

    for (let i = 0; i < periodos.length; i++) {
      for (let j = i + 1; j < periodos.length; j++) {
        const p1 = periodos[i];
        const p2 = periodos[j];

        const inicio1 = new Date(p1.inicio || p1.fechaInicio);
        const fin1 = new Date(p1.fin || p1.fechaFin);
        const inicio2 = new Date(p2.inicio || p2.fechaInicio);
        const fin2 = new Date(p2.fin || p2.fechaFin);

        if (inicio1 <= fin2 && inicio2 <= fin1) {
          superposiciones.push({
            periodo1: { id: p1.id, inicio: inicio1, fin: fin1 },
            periodo2: { id: p2.id, inicio: inicio2, fin: fin2 }
          });
        }
      }
    }

    return superposiciones;
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  AuditorVacaciones,
  SEVERIDAD,
  TIPO_ALERTA,
  CONFIG_AUDITOR,
  validarSaldoVacaciones,
  detectarSuperposicion
};
