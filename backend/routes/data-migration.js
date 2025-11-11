/**
 * Rutas para migraciones de datos
 * Permite actualizar estructura de datos cuando cambian los esquemas
 */

const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const Supplier = require('../models/Supplier');

// Mapeo de nombres antiguos a nombres nuevos
const FIELD_MAPPINGS = {
  // Nombres/Razón Social
  'Nombre / Razón Social': 'razon_social',
  'Razón Social': 'razon_social',
  'Nombre': 'nombre_completo',
  'Nombre Completo': 'nombre_completo',

  // Representante Legal
  'Representante Legal': 'representante_legal',
  'Nombre Representante Legal': 'representante_legal',
  'Nombre Reprentante Legal': 'representante_legal',

  // Identificación
  'Tipo de Identificación': 'tipo_identificacion',
  'Tipo ID': 'tipo_identificacion',
  'Número de Identificación': 'numero_identificacion',
  'NIT': 'numero_identificacion',
  'Cédula': 'numero_identificacion',

  // Representante Legal ID
  'Tipo ID Representante': 'tipo_id_representante',
  'Número ID Representante': 'numero_id_representante',
  'Cédula Representante': 'numero_id_representante',

  // Contacto
  'Email': 'email',
  'Correo': 'email',
  'Teléfono': 'telefono',
  'Celular': 'telefono',

  // Dirección
  'Dirección': 'direccion',
  'Ciudad': 'ciudad',
  'País': 'pais',

  // Específicos de Propiedad Horizontal
  'Nombre de la Propiedad Horizontal': 'razon_social',
  'NOMBRE DE LA PROPIEDAD HORIZONTAL': 'razon_social',
  'Nombre del Licenciatario': 'licenciatario',
  'NOMBRE DEL LICENCIATARIO': 'licenciatario',
  'Licenciatario': 'licenciatario',

  // Razón Social Corta
  'Razón Social Corta': 'razon_social_corta',
  'Nombre Corto': 'razon_social_corta',

  // Bancarios
  'Banco': 'banco',
  'Cuenta Bancaria': 'cuenta_bancaria',
  'Tipo de Cuenta': 'tipo_cuenta',

  // Laborales
  'Cargo': 'cargo',
  'Salario': 'salario',
  'EPS': 'eps',
  'AFP': 'afp',
  'ARL': 'arl',

  // Otros
  'Descripción': 'descripcion',
  'Observaciones': 'observaciones'
};

/**
 * Normaliza un nombre de campo para comparación
 */
function normalizeForComparison(name) {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Encuentra el nombre nuevo para un campo antiguo
 */
function findNewFieldName(oldName) {
  // Buscar coincidencia exacta (case insensitive)
  for (const [oldKey, newKey] of Object.entries(FIELD_MAPPINGS)) {
    if (normalizeForComparison(oldKey) === normalizeForComparison(oldName)) {
      return newKey;
    }
  }

  // Si no hay coincidencia, convertir a snake_case
  return oldName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[\/\-]+/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

/**
 * Migra los campos de un tercero
 */
function migrateSupplierFields(supplier) {
  const changes = [];
  const newCustomFields = {};

  if (supplier.custom_fields) {
    for (const [oldKey, value] of Object.entries(supplier.custom_fields)) {
      const newKey = findNewFieldName(oldKey);

      if (oldKey !== newKey) {
        changes.push({
          field: oldKey,
          oldName: oldKey,
          newName: newKey,
          value: value
        });
      }

      newCustomFields[newKey] = value;
    }
  }

  return {
    changes,
    newCustomFields
  };
}

/**
 * POST /api/data-migration/preview-suppliers
 * Previsualiza qué cambios se harían en los terceros
 */
router.post('/preview-suppliers', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { supplierType } = req.body;

    const query = { company: req.companyId };
    if (supplierType) {
      query.supplier_type = supplierType;
    }

    const suppliers = await Supplier.find(query);

    const preview = [];
    let totalChanges = 0;

    for (const supplier of suppliers) {
      const { changes, newCustomFields } = migrateSupplierFields(supplier);

      if (changes.length > 0) {
        totalChanges += changes.length;
        preview.push({
          supplierId: supplier._id,
          name: supplier.legal_name || supplier.full_name || 'Sin nombre',
          type: supplier.supplier_type,
          changes: changes
        });
      }
    }

    res.json({
      totalSuppliers: suppliers.length,
      suppliersAffected: preview.length,
      totalChanges: totalChanges,
      preview: preview
    });

  } catch (error) {
    console.error('Error al previsualizar migración:', error);
    res.status(500).json({ error: 'Error al previsualizar migración' });
  }
});

/**
 * POST /api/data-migration/migrate-suppliers
 * Ejecuta la migración de nombres de campos en terceros
 */
router.post('/migrate-suppliers', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { supplierType, supplierIds } = req.body;

    const query = { company: req.companyId };

    // Si se especifican IDs específicos, solo migrar esos
    if (supplierIds && supplierIds.length > 0) {
      query._id = { $in: supplierIds };
    } else if (supplierType) {
      // Si no, filtrar por tipo si se especifica
      query.supplier_type = supplierType;
    }

    const suppliers = await Supplier.find(query);

    const results = [];
    let totalChanges = 0;
    let suppliersAffected = 0;

    for (const supplier of suppliers) {
      const { changes, newCustomFields } = migrateSupplierFields(supplier);

      if (changes.length > 0) {
        suppliersAffected++;
        totalChanges += changes.length;

        // Actualizar el tercero
        supplier.custom_fields = newCustomFields;
        await supplier.save();

        results.push({
          supplierId: supplier._id,
          name: supplier.legal_name || supplier.full_name,
          type: supplier.supplier_type,
          changesApplied: changes.length
        });
      }
    }

    console.log(`✅ Migración completada: ${suppliersAffected} terceros actualizados, ${totalChanges} campos migrados`);

    res.json({
      success: true,
      totalSuppliers: suppliers.length,
      suppliersAffected: suppliersAffected,
      totalChanges: totalChanges,
      results: results
    });

  } catch (error) {
    console.error('Error al ejecutar migración:', error);
    res.status(500).json({ error: 'Error al ejecutar migración' });
  }
});

/**
 * GET /api/data-migration/check-suppliers
 * Verifica si hay terceros que necesitan migración
 */
router.get('/check-suppliers', authenticate, authorize('admin'), async (req, res) => {
  try {
    const suppliers = await Supplier.find({ company: req.companyId });

    let needsMigration = 0;

    for (const supplier of suppliers) {
      const { changes } = migrateSupplierFields(supplier);
      if (changes.length > 0) {
        needsMigration++;
      }
    }

    res.json({
      totalSuppliers: suppliers.length,
      needsMigration: needsMigration,
      requiresMigration: needsMigration > 0
    });

  } catch (error) {
    console.error('Error al verificar terceros:', error);
    res.status(500).json({ error: 'Error al verificar terceros' });
  }
});

module.exports = router;
