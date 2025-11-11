/**
 * API Robusta para Gestión de Campos Dinámicos de Terceros
 * Sistema completo con análisis, sugerencias y migración automática
 */

const express = require('express');
const router = express.Router();
const { authenticate, authorize, verifyTenant } = require('../middleware/auth');
const FieldManagementService = require('../services/fieldManagementService');
const Supplier = require('../models/Supplier');
const ContractTemplate = require('../models/ContractTemplate');

/**
 * GET /api/field-management/supplier/:id/analysis
 * Análisis completo de campos del tercero
 */
router.get('/supplier/:id/analysis', authenticate, verifyTenant, async (req, res) => {
  try {
    console.log('🔍 [FIELD-MANAGEMENT] Analysis request:', {
      supplierId: req.params.id,
      companyId: req.companyId,
      userId: req.user?._id,
      userRole: req.user?.role
    });

    const supplier = await Supplier.findOne({
      _id: req.params.id,
      company: req.companyId
    }).populate('third_party_type', 'code label');

    if (!supplier) {
      return res.status(404).json({ error: 'Tercero no encontrado' });
    }

    const analysis = await FieldManagementService.analyzeMissingFields(
      supplier,
      req.companyId
    );

    res.json({
      success: true,
      supplier: {
        id: supplier._id,
        name: supplier.legal_name || supplier.full_name,
        type: supplier.third_party_type
      },
      analysis
    });
  } catch (error) {
    console.error('Error en análisis de campos:', error);
    res.status(500).json({ error: 'Error al analizar campos del tercero' });
  }
});

/**
 * GET /api/field-management/supplier/:id/suggestions
 * Sugerencias inteligentes basadas en terceros similares
 */
router.get('/supplier/:id/suggestions', authenticate, verifyTenant, async (req, res) => {
  try {
    const supplier = await Supplier.findOne({
      _id: req.params.id,
      company: req.companyId
    }).populate('third_party_type');

    if (!supplier) {
      return res.status(404).json({ error: 'Tercero no encontrado' });
    }

    const suggestions = await FieldManagementService.getSuggestionsFromSimilarSuppliers(
      supplier,
      req.companyId
    );

    res.json({
      success: true,
      supplier: {
        id: supplier._id,
        name: supplier.legal_name || supplier.full_name
      },
      suggestions
    });
  } catch (error) {
    console.error('Error obteniendo sugerencias:', error);
    res.status(500).json({ error: 'Error al obtener sugerencias' });
  }
});

/**
 * POST /api/field-management/supplier/:id/fields
 * Agrega o actualiza campos del tercero
 */
router.post('/supplier/:id/fields', authenticate, verifyTenant, authorize('admin', 'super_admin', 'lawyer'), async (req, res) => {
  try {
    const { fields } = req.body;

    if (!fields || !Array.isArray(fields)) {
      return res.status(400).json({ error: 'Se requiere un array de campos' });
    }

    // Verificar permisos
    const supplier = await Supplier.findOne({
      _id: req.params.id,
      company: req.companyId
    });

    if (!supplier) {
      return res.status(404).json({ error: 'Tercero no encontrado' });
    }

    const result = await FieldManagementService.updateSupplierFields(
      req.params.id,
      fields,
      req.user._id
    );

    res.json({
      success: true,
      message: `${result.updates.fieldsAdded.length} campos agregados, ${result.updates.fieldsUpdated.length} actualizados`,
      updates: result.updates
    });
  } catch (error) {
    console.error('Error actualizando campos:', error);
    res.status(500).json({ error: 'Error al actualizar campos' });
  }
});

/**
 * POST /api/field-management/supplier/:id/migrate
 * Migra campos a nombres normalizados
 */
router.post('/supplier/:id/migrate', authenticate, verifyTenant, authorize('admin', 'super_admin'), async (req, res) => {
  try {
    const supplier = await Supplier.findOne({
      _id: req.params.id,
      company: req.companyId
    });

    if (!supplier) {
      return res.status(404).json({ error: 'Tercero no encontrado' });
    }

    const result = await FieldManagementService.migrateSupplierFieldNames(
      req.params.id,
      req.user._id
    );

    res.json({
      success: true,
      result
    });
  } catch (error) {
    console.error('Error en migración:', error);
    res.status(500).json({ error: 'Error al migrar campos' });
  }
});

/**
 * POST /api/field-management/migrate-all
 * Migra todos los terceros de la empresa
 */
router.post('/migrate-all', authenticate, verifyTenant, authorize('admin', 'super_admin'), async (req, res) => {
  try {
    const { dryRun = false } = req.body;

    const suppliers = await Supplier.find({ company: req.companyId });

    const results = {
      total: suppliers.length,
      migrated: 0,
      skipped: 0,
      details: []
    };

    for (const supplier of suppliers) {
      if (dryRun) {
        // Solo analizar sin guardar
        const fields = supplier.custom_fields || {};
        const needsMigration = Object.keys(fields).some(key => {
          const normalized = FieldManagementService.normalizeFieldName(key);
          return normalized !== key;
        });

        if (needsMigration) {
          results.migrated++;
          results.details.push({
            id: supplier._id,
            name: supplier.legal_name || supplier.full_name,
            needsMigration: true
          });
        } else {
          results.skipped++;
        }
      } else {
        // Ejecutar migración
        const result = await FieldManagementService.migrateSupplierFieldNames(
          supplier._id,
          req.user._id
        );

        if (result.migrated) {
          results.migrated++;
          results.details.push({
            id: supplier._id,
            name: supplier.legal_name || supplier.full_name,
            migrationsCount: result.migrationsCount,
            migrations: result.migrations
          });
        } else {
          results.skipped++;
        }
      }
    }

    res.json({
      success: true,
      dryRun,
      results
    });
  } catch (error) {
    console.error('Error en migración masiva:', error);
    res.status(500).json({ error: 'Error al ejecutar migración masiva' });
  }
});

/**
 * GET /api/field-management/validate-template/:supplierId/:templateId
 * Valida si un tercero puede usar una plantilla
 */
router.get('/validate-template/:supplierId/:templateId', authenticate, async (req, res) => {
  try {
    const validation = await FieldManagementService.validateSupplierForTemplate(
      req.params.supplierId,
      req.params.templateId
    );

    res.json({
      success: true,
      validation
    });
  } catch (error) {
    console.error('Error en validación:', error);
    res.status(500).json({ error: 'Error al validar tercero para plantilla' });
  }
});

/**
 * GET /api/field-management/stats
 * Estadísticas generales de completitud de terceros
 */
router.get('/stats', authenticate, verifyTenant, async (req, res) => {
  try {
    const suppliers = await Supplier.find({
      company: req.companyId,
      active: true
    }).populate('third_party_type', 'code label');

    const stats = {
      total: suppliers.length,
      byType: {},
      avgCompleteness: 0,
      needsAttention: []
    };

    let totalCompleteness = 0;

    for (const supplier of suppliers) {
      const analysis = await FieldManagementService.analyzeMissingFields(
        supplier,
        req.companyId
      );

      const typeName = supplier.third_party_type?.label || 'Sin tipo';

      if (!stats.byType[typeName]) {
        stats.byType[typeName] = {
          count: 0,
          avgCompleteness: 0,
          totalCompleteness: 0
        };
      }

      stats.byType[typeName].count++;
      stats.byType[typeName].totalCompleteness += analysis.completionPercentage;
      totalCompleteness += analysis.completionPercentage;

      if (analysis.completionPercentage < 70) {
        stats.needsAttention.push({
          id: supplier._id,
          name: supplier.legal_name || supplier.full_name,
          type: typeName,
          completeness: analysis.completionPercentage,
          missingCount: analysis.totalMissing
        });
      }
    }

    // Calcular promedios
    if (stats.total > 0) {
      stats.avgCompleteness = Math.round(totalCompleteness / stats.total);
    }

    Object.values(stats.byType).forEach(typeStats => {
      typeStats.avgCompleteness = Math.round(
        typeStats.totalCompleteness / typeStats.count
      );
      delete typeStats.totalCompleteness;
    });

    // Ordenar los que necesitan atención por completitud (menor primero)
    stats.needsAttention.sort((a, b) => a.completeness - b.completeness);

    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    res.status(500).json({ error: 'Error al obtener estadísticas' });
  }
});

/**
 * GET /api/field-management/required-fields/:typeCode
 * Obtiene todos los campos requeridos para un tipo de tercero
 */
router.get('/required-fields/:typeCode', authenticate, verifyTenant, async (req, res) => {
  try {
    const requiredFields = await FieldManagementService.getRequiredFieldsForType(
      req.params.typeCode,
      req.companyId
    );

    res.json({
      success: true,
      typeCode: req.params.typeCode,
      requiredFields: Array.from(requiredFields.values())
    });
  } catch (error) {
    console.error('Error obteniendo campos requeridos:', error);
    res.status(500).json({ error: 'Error al obtener campos requeridos' });
  }
});

/**
 * POST /api/field-management/supplier/:id/merge-fields
 * Fusiona múltiples campos en uno solo
 */
router.post('/supplier/:id/merge-fields', authenticate, verifyTenant, authorize('admin', 'super_admin', 'lawyer'), async (req, res) => {
  try {
    const { fieldsToMerge, targetFieldName, targetValue, removeOriginals = true } = req.body;

    if (!fieldsToMerge || !Array.isArray(fieldsToMerge) || fieldsToMerge.length < 2) {
      return res.status(400).json({ error: 'Se requieren al menos 2 campos para fusionar' });
    }

    if (!targetFieldName) {
      return res.status(400).json({ error: 'Se requiere un nombre para el campo fusionado' });
    }

    console.log('🔄 [FIELD-MERGER] Merge request:', {
      supplierId: req.params.id,
      fieldsToMerge,
      targetFieldName,
      targetValue,
      removeOriginals,
      userId: req.user._id
    });

    // Verificar que el tercero existe y pertenece a la empresa
    const supplier = await Supplier.findOne({
      _id: req.params.id,
      company: req.companyId
    });

    if (!supplier) {
      return res.status(404).json({ error: 'Tercero no encontrado' });
    }

    // Obtener custom_fields actuales
    const customFields = supplier.custom_fields || {};

    // Verificar que todos los campos a fusionar existen
    const missingFields = fieldsToMerge.filter(field => !(field in customFields));
    if (missingFields.length > 0) {
      return res.status(400).json({
        error: `Campos no encontrados: ${missingFields.join(', ')}`
      });
    }

    // Crear el nuevo objeto de custom_fields
    const newCustomFields = { ...customFields };

    // Agregar o actualizar el campo fusionado
    newCustomFields[targetFieldName] = targetValue;

    // Eliminar los campos originales si se solicita
    if (removeOriginals) {
      fieldsToMerge.forEach(field => {
        delete newCustomFields[field];
      });
    }

    // Actualizar el tercero
    supplier.custom_fields = newCustomFields;
    await supplier.save();

    console.log('✅ [FIELD-MERGER] Fields merged successfully:', {
      supplierId: req.params.id,
      mergedInto: targetFieldName,
      removedFields: removeOriginals ? fieldsToMerge : []
    });

    res.json({
      success: true,
      message: 'Campos fusionados exitosamente',
      result: {
        mergedFields: fieldsToMerge,
        targetFieldName,
        targetValue,
        fieldsRemoved: removeOriginals,
        totalFieldsNow: Object.keys(newCustomFields).length
      }
    });
  } catch (error) {
    console.error('❌ [FIELD-MERGER] Error merging fields:', error);
    res.status(500).json({ error: 'Error al fusionar campos' });
  }
});

/**
 * POST /api/field-management/merge-fields-bulk
 * Fusión inteligente masiva: Aplica fusión a todos los terceros del mismo tipo
 */
router.post('/merge-fields-bulk', authenticate, verifyTenant, authorize('admin', 'super_admin'), async (req, res) => {
  try {
    const { thirdPartyTypeId, fieldsToMerge, targetFieldName, applyToAll = true } = req.body;

    if (!thirdPartyTypeId) {
      return res.status(400).json({ error: 'Se requiere el tipo de tercero' });
    }

    if (!fieldsToMerge || !Array.isArray(fieldsToMerge) || fieldsToMerge.length < 2) {
      return res.status(400).json({ error: 'Se requieren al menos 2 campos para fusionar' });
    }

    if (!targetFieldName) {
      return res.status(400).json({ error: 'Se requiere un nombre para el campo fusionado' });
    }

    console.log('🚀 [BULK-MERGE] Starting bulk merge:', {
      thirdPartyTypeId,
      fieldsToMerge,
      targetFieldName,
      companyId: req.companyId
    });

    // Obtener todos los terceros del mismo tipo
    const suppliers = await Supplier.find({
      company: req.companyId,
      third_party_type: thirdPartyTypeId
    });

    console.log(`📊 [BULK-MERGE] Found ${suppliers.length} suppliers of this type`);

    const results = {
      total: suppliers.length,
      merged: 0,
      skipped: 0,
      details: []
    };

    // Función de normalización (igual que en el frontend)
    const normalizeFieldName = (name) => {
      return name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');
    };

    // Normalizar los nombres de campos a buscar
    const normalizedFieldsToMerge = fieldsToMerge.map(normalizeFieldName);

    for (const supplier of suppliers) {
      const customFields = supplier.custom_fields || {};

      // Buscar campos que coincidan con los normalizados
      const matchingFields = {};
      Object.keys(customFields).forEach(fieldName => {
        const normalized = normalizeFieldName(fieldName);
        if (normalizedFieldsToMerge.includes(normalized)) {
          matchingFields[fieldName] = customFields[fieldName];
        }
      });

      // Si encontramos al menos 2 campos coincidentes, fusionar
      if (Object.keys(matchingFields).length >= 2) {
        // Seleccionar el valor no vacío
        let mergeValue = '';
        for (const [fieldName, value] of Object.entries(matchingFields)) {
          if (value && value !== '') {
            mergeValue = value;
            break;
          }
        }

        // Crear nuevo objeto de custom_fields
        const newCustomFields = { ...customFields };

        // Agregar el campo fusionado
        newCustomFields[targetFieldName] = mergeValue;

        // Eliminar los campos originales
        Object.keys(matchingFields).forEach(field => {
          delete newCustomFields[field];
        });

        // Actualizar el tercero
        supplier.custom_fields = newCustomFields;
        await supplier.save();

        results.merged++;
        results.details.push({
          supplierId: supplier._id,
          name: supplier.legal_name || supplier.full_name,
          mergedFields: Object.keys(matchingFields),
          value: mergeValue
        });

        console.log(`✅ [BULK-MERGE] Merged fields for: ${supplier.legal_name || supplier.full_name}`);
      } else {
        results.skipped++;
      }
    }

    console.log('🎉 [BULK-MERGE] Bulk merge completed:', results);

    res.json({
      success: true,
      message: `Fusión masiva completada: ${results.merged} terceros actualizados`,
      results
    });

  } catch (error) {
    console.error('❌ [BULK-MERGE] Error in bulk merge:', error);
    res.status(500).json({ error: 'Error en fusión masiva' });
  }
});

module.exports = router;
