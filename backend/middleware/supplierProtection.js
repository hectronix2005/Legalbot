const Supplier = require('../models/Supplier');
const SupplierAuditLog = require('../models/SupplierAuditLog');
const { createFullBackup } = require('../services/robustBackup');

/**
 * Middleware de Protección para Operaciones de Terceros
 *
 * Protege contra:
 * - Eliminaciones masivas accidentales
 * - Operaciones no autorizadas
 * - Pérdida de datos críticos
 */

/**
 * Middleware para prevenir eliminaciones masivas
 */
const preventBulkDeletion = async (req, res, next) => {
  // Solo aplicar en rutas de eliminación
  if (req.method !== 'DELETE' && !req.path.includes('/bulk-delete')) {
    return next();
  }

  try {
    const userId = req.user?._id || req.user?.id;
    const userRole = req.user?.role;

    if (!userId) {
      return res.status(401).json({ error: 'Usuario no autenticado' });
    }

    // Verificar eliminaciones recientes del usuario
    const recentDeletions = await SupplierAuditLog.countDocuments({
      performedBy: userId,
      operation: { $in: ['DELETE', 'BULK_DELETE'] },
      createdAt: { $gte: new Date(Date.now() - 5 * 60 * 1000) } // Últimos 5 minutos
    });

    // Límite de eliminaciones: 10 en 5 minutos (excepto super_admin)
    const MAX_DELETIONS_PER_5_MIN = userRole === 'super_admin' ? 50 : 10;

    if (recentDeletions >= MAX_DELETIONS_PER_5_MIN) {
      console.error(`🚨 ELIMINACIÓN BLOQUEADA: Usuario ${userId} ha eliminado ${recentDeletions} terceros en 5 minutos`);

      return res.status(429).json({
        error: 'Límite de eliminaciones excedido',
        message: `Has eliminado ${recentDeletions} terceros en los últimos 5 minutos. Por seguridad, espera antes de continuar.`,
        recentDeletions,
        maxAllowed: MAX_DELETIONS_PER_5_MIN,
        tryAgainAfter: '5 minutos'
      });
    }

    next();
  } catch (error) {
    console.error('Error en middleware de protección:', error);
    next(); // Permitir continuar en caso de error del middleware
  }
};

/**
 * Middleware para crear backup antes de eliminaciones críticas
 */
const backupBeforeCriticalOperation = async (req, res, next) => {
  // Solo aplicar en operaciones masivas o críticas
  const isCritical = req.path.includes('/bulk-delete') ||
                     req.path.includes('/restore-all') ||
                     (req.method === 'DELETE' && req.query.force === 'true');

  if (!isCritical) {
    return next();
  }

  try {
    console.log('🔒 Operación crítica detectada - Creando backup preventivo...');

    const backup = await createFullBackup('BEFORE_CRITICAL_OPERATION');

    if (backup) {
      console.log(`✅ Backup preventivo creado: ${backup.filename}`);
      req.backupFile = backup.filename; // Guardar referencia del backup
    } else {
      console.warn('⚠️  No se pudo crear backup preventivo - continuando con precaución');
    }

    next();
  } catch (error) {
    console.error('Error creando backup preventivo:', error);
    // Permitir continuar pero con advertencia
    next();
  }
};

/**
 * Middleware para auditar todas las operaciones
 */
const auditSupplierOperation = (operation) => {
  return async (req, res, next) => {
    // Guardar el método send original
    const originalSend = res.send;
    const originalJson = res.json;

    // Variables para capturar datos
    let stateBefore = null;
    let stateAfter = null;

    try {
      // Capturar estado anterior si es UPDATE o DELETE
      if ((operation === 'UPDATE' || operation === 'DELETE') && req.params.id) {
        stateBefore = await Supplier.findById(req.params.id);
      }

      // Interceptar respuesta exitosa
      res.send = function(data) {
        res.send = originalSend; // Restaurar original

        // Solo auditar si fue exitoso (2xx)
        if (res.statusCode >= 200 && res.statusCode < 300) {
          setImmediate(async () => {
            try {
              const supplierId = req.params.id || (data && data.supplier && data.supplier._id);

              if (supplierId) {
                // Capturar estado posterior
                if (operation === 'UPDATE' || operation === 'CREATE') {
                  stateAfter = await Supplier.findById(supplierId);
                }

                // Crear log de auditoría
                await SupplierAuditLog.logOperation({
                  supplier: supplierId,
                  operation,
                  performedBy: req.user?._id || req.user?.id,
                  company: req.companyId,
                  stateBefore,
                  stateAfter,
                  ipAddress: req.ip || req.connection.remoteAddress,
                  userAgent: req.get('User-Agent'),
                  reason: req.body.reason || req.query.reason,
                  metadata: {
                    path: req.path,
                    method: req.method,
                    backupFile: req.backupFile
                  }
                });
              }
            } catch (auditError) {
              console.error('Error en auditoría:', auditError);
            }
          });
        }

        return originalSend.call(this, data);
      };

      res.json = function(data) {
        res.json = originalJson; // Restaurar original

        // Solo auditar si fue exitoso (2xx)
        if (res.statusCode >= 200 && res.statusCode < 300) {
          setImmediate(async () => {
            try {
              const supplierId = req.params.id || (data && data.supplier && data.supplier._id);

              if (supplierId) {
                // Capturar estado posterior
                if (operation === 'UPDATE' || operation === 'CREATE') {
                  stateAfter = await Supplier.findById(supplierId);
                }

                // Crear log de auditoría
                await SupplierAuditLog.logOperation({
                  supplier: supplierId,
                  operation,
                  performedBy: req.user?._id || req.user?.id,
                  company: req.companyId,
                  stateBefore,
                  stateAfter,
                  ipAddress: req.ip || req.connection.remoteAddress,
                  userAgent: req.get('User-Agent'),
                  reason: req.body.reason || req.query.reason,
                  metadata: {
                    path: req.path,
                    method: req.method,
                    backupFile: req.backupFile
                  }
                });
              }
            } catch (auditError) {
              console.error('Error en auditoría:', auditError);
            }
          });
        }

        return originalJson.call(this, data);
      };

      next();
    } catch (error) {
      console.error('Error en middleware de auditoría:', error);
      next();
    }
  };
};

/**
 * Middleware para validar que el tercero no está siendo usado
 */
const validateNotInUse = async (req, res, next) => {
  if (req.method !== 'DELETE') {
    return next();
  }

  try {
    const supplierId = req.params.id;
    const supplier = await Supplier.findById(supplierId);

    if (!supplier) {
      return next(); // Dejará que el endpoint maneje el 404
    }

    // El endpoint ya verifica referencias, pero agregamos validación extra
    // para asegurar que no se eliminen terceros críticos
    const Contract = require('../models/Contract');
    const ThirdPartyProfile = require('../models/ThirdPartyProfile');

    const [contractCount, profileCount] = await Promise.all([
      Contract.countDocuments({
        $or: [
          { content: { $regex: supplier.legal_name || '', $options: 'i' } },
          { content: { $regex: supplier.identification_number, $options: 'i' } }
        ]
      }),
      ThirdPartyProfile.countDocuments({
        supplier: supplierId,
        active: true
      })
    ]);

    if (contractCount > 0 || profileCount > 0) {
      // Permitir que el endpoint original maneje esto, solo loggeamos
      console.warn(`⚠️  Intento de eliminar tercero en uso: ${supplier.legal_name}`);
      console.warn(`   Contratos: ${contractCount}, Perfiles: ${profileCount}`);
    }

    next();
  } catch (error) {
    console.error('Error validando uso de tercero:', error);
    next(); // Permitir continuar
  }
};

module.exports = {
  preventBulkDeletion,
  backupBeforeCriticalOperation,
  auditSupplierOperation,
  validateNotInUse
};
