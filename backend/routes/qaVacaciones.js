/**
 * Endpoints REST para QAVacaciones
 * Control y consulta del servicio de QA continuo
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs').promises;
const { QAVacaciones, SEVERIDAD_BUG, TIPO_TEST } = require('../services/qaVacaciones');

// Instancia singleton
let qaInstancia = null;

/**
 * Inicializa el servicio QA con DB
 */
function inicializarQA(db, opciones = {}) {
  qaInstancia = new QAVacaciones(db, opciones);
  return qaInstancia;
}

/**
 * Obtiene la instancia del QA
 */
function obtenerQA() {
  if (!qaInstancia) {
    throw new Error('QA no inicializado. Llame a inicializarQA(db) primero.');
  }
  return qaInstancia;
}

// ============================================================================
// ENDPOINTS DE CONTROL
// ============================================================================

/**
 * POST /api/qa-vacaciones/iniciar
 * Inicia el ciclo de QA continuo
 */
router.post('/iniciar', async (req, res) => {
  try {
    const qa = obtenerQA();
    qa.iniciar();

    res.json({
      exito: true,
      mensaje: 'QA continuo iniciado',
      estado: qa.obtenerEstado()
    });
  } catch (error) {
    res.status(500).json({ exito: false, error: error.message });
  }
});

/**
 * POST /api/qa-vacaciones/detener
 * Detiene el ciclo de QA continuo
 */
router.post('/detener', async (req, res) => {
  try {
    const qa = obtenerQA();
    qa.detener();

    res.json({
      exito: true,
      mensaje: 'QA continuo detenido',
      estado: qa.obtenerEstado()
    });
  } catch (error) {
    res.status(500).json({ exito: false, error: error.message });
  }
});

/**
 * POST /api/qa-vacaciones/ejecutar
 * Ejecuta un ciclo de QA manualmente
 */
router.post('/ejecutar', async (req, res) => {
  try {
    const qa = obtenerQA();
    const resultado = await qa.ejecutarCicloQA();

    res.json({
      exito: true,
      resultado: {
        metricas: resultado.resultados.metricas,
        cobertura: resultado.resultados.cobertura,
        totalBugs: resultado.resultados.bugs.length,
        bugsCriticos: resultado.resultados.bugs.filter(b => b.severidad === SEVERIDAD_BUG.CRITICO).length,
        reporte: resultado.reporte
      }
    });
  } catch (error) {
    res.status(500).json({ exito: false, error: error.message });
  }
});

/**
 * GET /api/qa-vacaciones/estado
 * Obtiene el estado actual del servicio QA
 */
router.get('/estado', async (req, res) => {
  try {
    const qa = obtenerQA();
    res.json({
      exito: true,
      estado: qa.obtenerEstado()
    });
  } catch (error) {
    res.status(500).json({ exito: false, error: error.message });
  }
});

// ============================================================================
// ENDPOINTS DE CONSULTA
// ============================================================================

/**
 * GET /api/qa-vacaciones/resultados
 * Obtiene los resultados de la última ejecución
 */
router.get('/resultados', async (req, res) => {
  try {
    const qa = obtenerQA();
    res.json({
      exito: true,
      resultados: qa.obtenerResultados()
    });
  } catch (error) {
    res.status(500).json({ exito: false, error: error.message });
  }
});

/**
 * GET /api/qa-vacaciones/bugs
 * Obtiene bugs encontrados con filtros
 */
router.get('/bugs', async (req, res) => {
  try {
    const qa = obtenerQA();
    const { severidad, tipo } = req.query;

    const bugs = qa.obtenerBugs({ severidad, tipo });

    res.json({
      exito: true,
      total: bugs.length,
      bugs
    });
  } catch (error) {
    res.status(500).json({ exito: false, error: error.message });
  }
});

/**
 * GET /api/qa-vacaciones/cobertura
 * Obtiene métricas de cobertura
 */
router.get('/cobertura', async (req, res) => {
  try {
    const qa = obtenerQA();
    const resultados = qa.obtenerResultados();

    res.json({
      exito: true,
      cobertura: resultados.cobertura,
      minimoRequerido: qa.config.COBERTURA_MINIMA,
      cumple: resultados.cobertura.dominio >= qa.config.COBERTURA_MINIMA
    });
  } catch (error) {
    res.status(500).json({ exito: false, error: error.message });
  }
});

/**
 * GET /api/qa-vacaciones/historial
 * Obtiene historial de ejecuciones
 */
router.get('/historial', async (req, res) => {
  try {
    const qa = obtenerQA();
    const { limite = 10 } = req.query;

    res.json({
      exito: true,
      historial: qa.obtenerHistorial(parseInt(limite))
    });
  } catch (error) {
    res.status(500).json({ exito: false, error: error.message });
  }
});

/**
 * GET /api/qa-vacaciones/tests
 * Obtiene detalle de tests ejecutados
 */
router.get('/tests', async (req, res) => {
  try {
    const qa = obtenerQA();
    const resultados = qa.obtenerResultados();
    const { tipo } = req.query;

    let tests = resultados.tests;
    if (tipo) {
      tests = tests.filter(t => t.tipo === tipo);
    }

    res.json({
      exito: true,
      total: tests.length,
      tests
    });
  } catch (error) {
    res.status(500).json({ exito: false, error: error.message });
  }
});

/**
 * GET /api/qa-vacaciones/logs
 * Obtiene análisis de logs
 */
router.get('/logs', async (req, res) => {
  try {
    const qa = obtenerQA();
    const resultados = qa.obtenerResultados();

    res.json({
      exito: true,
      logs: resultados.logs
    });
  } catch (error) {
    res.status(500).json({ exito: false, error: error.message });
  }
});

// ============================================================================
// ENDPOINTS DE REPORTES
// ============================================================================

/**
 * GET /api/qa-vacaciones/reportes
 * Lista reportes generados
 */
router.get('/reportes', async (req, res) => {
  try {
    const qa = obtenerQA();
    const dirReportes = qa.config.DIRECTORIO_REPORTES;

    let archivos = [];
    try {
      archivos = await fs.readdir(dirReportes);
    } catch (e) {
      // Directorio no existe aún
    }

    const reportes = archivos
      .filter(a => a.startsWith('exec-') && a.endsWith('.md'))
      .map(archivo => {
        const match = archivo.match(/exec-(\d{4}-\d{2}-\d{2})-(\d{2}-\d{2}-\d{2})\.md/);
        return {
          nombre: archivo,
          fecha: match ? match[1] : 'desconocida',
          hora: match ? match[2].replace(/-/g, ':') : 'desconocida',
          ruta: `/api/qa-vacaciones/reportes/descargar/${archivo}`
        };
      })
      .sort((a, b) => b.nombre.localeCompare(a.nombre));

    res.json({
      exito: true,
      total: reportes.length,
      reportes
    });
  } catch (error) {
    res.status(500).json({ exito: false, error: error.message });
  }
});

/**
 * GET /api/qa-vacaciones/reportes/descargar/:archivo
 * Descarga un reporte específico
 */
router.get('/reportes/descargar/:archivo', async (req, res) => {
  try {
    const qa = obtenerQA();
    const { archivo } = req.params;

    // Validar nombre de archivo
    if (archivo.includes('..') || archivo.includes('/') || !archivo.endsWith('.md')) {
      return res.status(400).json({ exito: false, error: 'Nombre de archivo inválido' });
    }

    const rutaArchivo = path.join(qa.config.DIRECTORIO_REPORTES, archivo);
    const contenido = await fs.readFile(rutaArchivo, 'utf8');

    res.setHeader('Content-Type', 'text/markdown');
    res.send(contenido);
  } catch (error) {
    res.status(404).json({ exito: false, error: 'Reporte no encontrado' });
  }
});

/**
 * GET /api/qa-vacaciones/reportes/ultimo
 * Obtiene el último reporte generado
 */
router.get('/reportes/ultimo', async (req, res) => {
  try {
    const qa = obtenerQA();
    const dirReportes = qa.config.DIRECTORIO_REPORTES;

    const archivos = await fs.readdir(dirReportes).catch(() => []);
    const reportes = archivos
      .filter(a => a.startsWith('exec-') && a.endsWith('.md'))
      .sort()
      .reverse();

    if (reportes.length === 0) {
      return res.status(404).json({ exito: false, error: 'No hay reportes generados' });
    }

    const contenido = await fs.readFile(path.join(dirReportes, reportes[0]), 'utf8');

    res.json({
      exito: true,
      archivo: reportes[0],
      contenido
    });
  } catch (error) {
    res.status(500).json({ exito: false, error: error.message });
  }
});

// ============================================================================
// ENDPOINTS DE CONFIGURACIÓN
// ============================================================================

/**
 * GET /api/qa-vacaciones/configuracion
 * Obtiene configuración actual
 */
router.get('/configuracion', async (req, res) => {
  try {
    const qa = obtenerQA();
    res.json({
      exito: true,
      configuracion: qa.config
    });
  } catch (error) {
    res.status(500).json({ exito: false, error: error.message });
  }
});

/**
 * PUT /api/qa-vacaciones/configuracion
 * Actualiza configuración
 */
router.put('/configuracion', async (req, res) => {
  try {
    const qa = obtenerQA();
    const { intervaloMs, coberturaMinima, umbral4xx, umbral5xx } = req.body;

    if (intervaloMs !== undefined) {
      qa.config.INTERVALO_EJECUCION_MS = parseInt(intervaloMs);
    }
    if (coberturaMinima !== undefined) {
      qa.config.COBERTURA_MINIMA = parseInt(coberturaMinima);
    }
    if (umbral4xx !== undefined) {
      qa.config.UMBRAL_ERRORES_4XX = parseInt(umbral4xx);
    }
    if (umbral5xx !== undefined) {
      qa.config.UMBRAL_ERRORES_5XX = parseInt(umbral5xx);
    }

    // Reiniciar si estaba corriendo
    if (qa.intervaloId && intervaloMs !== undefined) {
      qa.detener();
      qa.iniciar();
    }

    res.json({
      exito: true,
      mensaje: 'Configuración actualizada',
      configuracion: qa.config
    });
  } catch (error) {
    res.status(500).json({ exito: false, error: error.message });
  }
});

/**
 * GET /api/qa-vacaciones/severidades
 * Lista severidades de bugs
 */
router.get('/severidades', (req, res) => {
  res.json({
    exito: true,
    severidades: Object.values(SEVERIDAD_BUG),
    descripcion: {
      CRITICO: 'Bloquea funcionalidad core, requiere fix inmediato',
      MAYOR: 'Afecta funcionalidad importante, debe corregirse pronto',
      MENOR: 'Problema menor, puede esperar',
      TRIVIAL: 'Cosmético o mejora'
    }
  });
});

/**
 * GET /api/qa-vacaciones/tipos-test
 * Lista tipos de tests
 */
router.get('/tipos-test', (req, res) => {
  res.json({
    exito: true,
    tipos: Object.values(TIPO_TEST),
    descripcion: {
      unit: 'Tests unitarios',
      integration: 'Tests de integración',
      e2e_smoke: 'Tests E2E básicos',
      business_rule: 'Validación de reglas de negocio',
      edge_case: 'Casos borde'
    }
  });
});

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = router;
module.exports.inicializarQA = inicializarQA;
module.exports.obtenerQA = obtenerQA;
