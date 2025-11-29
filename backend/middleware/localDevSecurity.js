/**
 * Middleware de seguridad para entorno de desarrollo local
 * Previene acceso no autorizado al servidor de desarrollo
 */

const isLocalhost = (req) => {
  const host = req.hostname || req.headers.host;
  return (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '::1' ||
    host?.startsWith('localhost:') ||
    host?.startsWith('127.0.0.1:')
  );
};

const isLocalIP = (ip) => {
  return (
    ip === '127.0.0.1' ||
    ip === '::1' ||
    ip === '::ffff:127.0.0.1' ||
    ip?.startsWith('127.') ||
    ip === 'localhost'
  );
};

/**
 * Middleware que solo permite conexiones desde localhost
 */
const restrictToLocalhost = (req, res, next) => {
  // En producción, omitir esta verificación
  if (process.env.NODE_ENV === 'production') {
    return next();
  }

  const clientIP = req.ip || req.connection.remoteAddress;

  // Verificar que la conexión viene de localhost
  if (!isLocalhost(req) && !isLocalIP(clientIP)) {
    console.warn(`🚨 Intento de acceso rechazado desde: ${clientIP}`);
    return res.status(403).json({
      error: 'Acceso denegado',
      message: 'Este servidor de desarrollo solo acepta conexiones desde localhost'
    });
  }

  next();
};

/**
 * Middleware que verifica el origen de las peticiones
 */
const verifyLocalOrigin = (req, res, next) => {
  // En producción, omitir esta verificación
  if (process.env.NODE_ENV === 'production') {
    return next();
  }

  const origin = req.headers.origin || req.headers.referer;

  // Permitir requests sin origin (como desde Postman, curl, etc)
  if (!origin) {
    return next();
  }

  // Verificar que el origin sea localhost
  const allowedOrigins = [
    'http://localhost:3002',
    'http://localhost:3003',
    'http://localhost:3000',
    'http://127.0.0.1:3002',
    'http://127.0.0.1:3003',
    'http://127.0.0.1:3000'
  ];

  if (!allowedOrigins.some(allowed => origin.startsWith(allowed))) {
    console.warn(`🚨 Origen no autorizado rechazado: ${origin}`);
    return res.status(403).json({
      error: 'Origen no autorizado',
      message: 'Este servidor solo acepta peticiones desde localhost'
    });
  }

  next();
};

/**
 * Middleware que registra todos los accesos
 */
const logAccess = (req, res, next) => {
  if (process.env.NODE_ENV === 'development') {
    const timestamp = new Date().toISOString();
    const ip = req.ip || req.connection.remoteAddress;
    const method = req.method;
    const path = req.path;
    const origin = req.headers.origin || 'no-origin';

    console.log(`[${timestamp}] ${method} ${path} - IP: ${ip} - Origin: ${origin}`);
  }
  next();
};

/**
 * Configuración de seguridad para el servidor local
 */
const configureLocalSecurity = (app) => {
  if (process.env.NODE_ENV === 'development') {
    console.log('🔒 Configurando seguridad para entorno de desarrollo local...');

    // Aplicar middlewares de seguridad
    app.use(logAccess);
    app.use(restrictToLocalhost);
    app.use(verifyLocalOrigin);

    console.log('✅ Seguridad local configurada:');
    console.log('   - Solo accesible desde localhost');
    console.log('   - Solo acepta orígenes de localhost');
    console.log('   - Todos los accesos son registrados');
  }
};

module.exports = {
  restrictToLocalhost,
  verifyLocalOrigin,
  logAccess,
  configureLocalSecurity
};
