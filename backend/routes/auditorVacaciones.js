/**
 * Endpoints REST para AuditorVacaciones
 * Permite ejecutar auditorías, consultar alertas y descargar reportes
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs').promises;
const {
  AuditorVacaciones,
  SEVERIDAD,
  TIPO_ALERTA,
  validarSaldoVacaciones
} = require('../services/auditorVacaciones');

// Instancia singleton del auditor (se inicializa con DB en el servidor)
let auditorInstancia = null;

/**
 * Inicializa el auditor con la conexión a DB
 */
function inicializarAuditor(db, opciones = {}) {
  auditorInstancia = new AuditorVacaciones(db, opciones);
  return auditorInstancia;
}

/**
 * Obtiene la instancia del auditor
 */
function obtenerAuditor() {
  if (!auditorInstancia) {
    throw new Error('Auditor no inicializado. Llame a inicializarAuditor(db) primero.');
  }
  return auditorInstancia;
}

// ============================================================================
// ENDPOINTS DE CONTROL
// ============================================================================

/**
 * POST /api/auditor-vacaciones/iniciar
 * Inicia la ejecución continua del auditor
 */
router.post('/iniciar', async (req, res) => {
  try {
    const auditor = obtenerAuditor();
    auditor.iniciar();

    res.json({
      exito: true,
      mensaje: 'Auditor iniciado en modo continuo',
      estado: auditor.obtenerEstado()
    });
  } catch (error) {
    res.status(500).json({
      exito: false,
      error: error.message
    });
  }
});

/**
 * POST /api/auditor-vacaciones/detener
 * Detiene la ejecución continua
 */
router.post('/detener', async (req, res) => {
  try {
    const auditor = obtenerAuditor();
    auditor.detener();

    res.json({
      exito: true,
      mensaje: 'Auditor detenido',
      estado: auditor.obtenerEstado()
    });
  } catch (error) {
    res.status(500).json({
      exito: false,
      error: error.message
    });
  }
});

/**
 * GET /api/auditor-vacaciones/estado
 * Obtiene el estado actual del auditor
 */
router.get('/estado', async (req, res) => {
  try {
    const auditor = obtenerAuditor();
    res.json({
      exito: true,
      estado: auditor.obtenerEstado()
    });
  } catch (error) {
    res.status(500).json({
      exito: false,
      error: error.message
    });
  }
});

// ============================================================================
// ENDPOINTS DE EJECUCIÓN
// ============================================================================

/**
 * POST /api/auditor-vacaciones/ejecutar
 * Ejecuta una auditoría manual
 */
router.post('/ejecutar', async (req, res) => {
  try {
    const auditor = obtenerAuditor();
    const { companyId } = req.body;

    const resultado = await auditor.ejecutarAuditoria(companyId);

    res.json({
      exito: true,
      resultado: {
        estadisticas: resultado.estadisticas,
        totalAlertas: resultado.alertas.length,
        totalTodos: resultado.todos.length,
        reportes: resultado.reportes
      }
    });
  } catch (error) {
    res.status(500).json({
      exito: false,
      error: error.message
    });
  }
});

/**
 * POST /api/auditor-vacaciones/validar-empleado
 * Valida el saldo de un empleado específico
 */
router.post('/validar-empleado', async (req, res) => {
  try {
    const { accrued, enjoyed, approvedPend, requestedPend } = req.body;

    if (typeof accrued !== 'number' || typeof enjoyed !== 'number' ||
        typeof approvedPend !== 'number') {
      return res.status(400).json({
        exito: false,
        error: 'Parámetros inválidos: accrued, enjoyed, approvedPend son requeridos'
      });
    }

    const resultado = validarSaldoVacaciones({
      accrued,
      enjoyed,
      approvedPend,
      requestedPend: requestedPend || 0
    });

    res.json({
      exito: true,
      validacion: resultado
    });
  } catch (error) {
    res.status(500).json({
      exito: false,
      error: error.message
    });
  }
});

// ============================================================================
// ENDPOINTS DE CONSULTA
// ============================================================================

/**
 * GET /api/auditor-vacaciones/alertas
 * Obtiene alertas con filtros opcionales
 */
router.get('/alertas', async (req, res) => {
  try {
    const auditor = obtenerAuditor();
    const { severidad, tipo, empleadoId, limite = 100, pagina = 1 } = req.query;

    let alertas = auditor.obtenerAlertas({ severidad, tipo, empleadoId });

    // Paginación
    const offset = (pagina - 1) * limite;
    const alertasPaginadas = alertas.slice(offset, offset + parseInt(limite));

    res.json({
      exito: true,
      total: alertas.length,
      pagina: parseInt(pagina),
      limite: parseInt(limite),
      alertas: alertasPaginadas
    });
  } catch (error) {
    res.status(500).json({
      exito: false,
      error: error.message
    });
  }
});

/**
 * GET /api/auditor-vacaciones/estadisticas
 * Obtiene estadísticas de la última auditoría
 */
router.get('/estadisticas', async (req, res) => {
  try {
    const auditor = obtenerAuditor();
    res.json({
      exito: true,
      estadisticas: auditor.obtenerEstadisticas()
    });
  } catch (error) {
    res.status(500).json({
      exito: false,
      error: error.message
    });
  }
});

/**
 * GET /api/auditor-vacaciones/todos
 * Obtiene TODOs pendientes
 */
router.get('/todos', async (req, res) => {
  try {
    const auditor = obtenerAuditor();
    res.json({
      exito: true,
      todos: auditor.obtenerTodos()
    });
  } catch (error) {
    res.status(500).json({
      exito: false,
      error: error.message
    });
  }
});

/**
 * GET /api/auditor-vacaciones/severidades
 * Lista las severidades disponibles
 */
router.get('/severidades', (req, res) => {
  res.json({
    exito: true,
    severidades: Object.values(SEVERIDAD),
    descripcion: {
      CRITICA: 'Excedentes de saldo - requiere acción inmediata',
      ALTA: 'Fechas inválidas - requiere corrección',
      MEDIA: 'Datos faltantes - requiere completar información',
      BAJA: 'Redondeos/precisión - informativo'
    }
  });
});

/**
 * GET /api/auditor-vacaciones/tipos-alerta
 * Lista los tipos de alerta disponibles
 */
router.get('/tipos-alerta', (req, res) => {
  res.json({
    exito: true,
    tipos: Object.values(TIPO_ALERTA)
  });
});

// ============================================================================
// ENDPOINTS DE REPORTES
// ============================================================================

/**
 * GET /api/auditor-vacaciones/reportes
 * Lista reportes disponibles
 */
router.get('/reportes', async (req, res) => {
  try {
    const dirReportes = 'auditoria';

    try {
      const archivos = await fs.readdir(dirReportes);
      const reportes = archivos.map(archivo => ({
        nombre: archivo,
        tipo: archivo.endsWith('.md') ? 'resumen' : 'casos',
        fecha: archivo.match(/\d{4}-\d{2}-\d{2}/)?.[0] || 'desconocida',
        ruta: `/api/auditor-vacaciones/reportes/descargar/${archivo}`
      }));

      res.json({
        exito: true,
        reportes: reportes.sort((a, b) => b.fecha.localeCompare(a.fecha))
      });
    } catch (e) {
      res.json({
        exito: true,
        reportes: [],
        mensaje: 'No hay reportes generados aún'
      });
    }
  } catch (error) {
    res.status(500).json({
      exito: false,
      error: error.message
    });
  }
});

/**
 * GET /api/auditor-vacaciones/reportes/descargar/:archivo
 * Descarga un reporte específico
 */
router.get('/reportes/descargar/:archivo', async (req, res) => {
  try {
    const { archivo } = req.params;
    const rutaArchivo = path.join('auditoria', archivo);

    // Validar que no se acceda fuera del directorio
    if (archivo.includes('..') || archivo.includes('/')) {
      return res.status(400).json({
        exito: false,
        error: 'Nombre de archivo inválido'
      });
    }

    const contenido = await fs.readFile(rutaArchivo, 'utf8');

    if (archivo.endsWith('.csv')) {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${archivo}"`);
    } else if (archivo.endsWith('.md')) {
      res.setHeader('Content-Type', 'text/markdown');
    }

    res.send(contenido);
  } catch (error) {
    res.status(404).json({
      exito: false,
      error: 'Reporte no encontrado'
    });
  }
});

/**
 * GET /api/auditor-vacaciones/reportes/ultimo-resumen
 * Obtiene el último resumen generado
 */
router.get('/reportes/ultimo-resumen', async (req, res) => {
  try {
    const dirReportes = 'auditoria';
    const archivos = await fs.readdir(dirReportes);

    const resumenes = archivos
      .filter(a => a.startsWith('resumen-') && a.endsWith('.md'))
      .sort()
      .reverse();

    if (resumenes.length === 0) {
      return res.status(404).json({
        exito: false,
        error: 'No hay resúmenes generados'
      });
    }

    const contenido = await fs.readFile(path.join(dirReportes, resumenes[0]), 'utf8');

    res.json({
      exito: true,
      archivo: resumenes[0],
      contenido
    });
  } catch (error) {
    res.status(500).json({
      exito: false,
      error: error.message
    });
  }
});

// ============================================================================
// ENDPOINTS DE CONFIGURACIÓN
// ============================================================================

/**
 * GET /api/auditor-vacaciones/configuracion
 * Obtiene la configuración actual
 */
router.get('/configuracion', async (req, res) => {
  try {
    const auditor = obtenerAuditor();
    res.json({
      exito: true,
      configuracion: auditor.config
    });
  } catch (error) {
    res.status(500).json({
      exito: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/auditor-vacaciones/configuracion
 * Actualiza la configuración (parcial)
 */
router.put('/configuracion', async (req, res) => {
  try {
    const auditor = obtenerAuditor();
    const { intervaloMs, habilitarIssues, toleranciaRedondeo } = req.body;

    if (intervaloMs !== undefined) {
      auditor.config.INTERVALO_EJECUCION_MS = parseInt(intervaloMs);
    }
    if (habilitarIssues !== undefined) {
      auditor.config.HABILITAR_ISSUES = !!habilitarIssues;
    }
    if (toleranciaRedondeo !== undefined) {
      auditor.config.TOLERANCIA_REDONDEO = parseFloat(toleranciaRedondeo);
    }

    // Si estaba corriendo, reiniciar con nuevo intervalo
    if (auditor.intervaloId && intervaloMs !== undefined) {
      auditor.detener();
      auditor.iniciar();
    }

    res.json({
      exito: true,
      mensaje: 'Configuración actualizada',
      configuracion: auditor.config
    });
  } catch (error) {
    res.status(500).json({
      exito: false,
      error: error.message
    });
  }
});

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = router;
module.exports.inicializarAuditor = inicializarAuditor;
module.exports.obtenerAuditor = obtenerAuditor;
