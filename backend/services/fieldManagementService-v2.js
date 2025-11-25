const Supplier = require('../models/Supplier');

/**
 * Servicio robusto de gestión de campos de terceros
 * Versión 2.0 - Con manejo completo de errores y validaciones
 */
class FieldManagementServiceV2 {
  /**
   * Normaliza un nombre de campo para comparación
   */
  static normalizeFieldName(name) {
    if (!name || typeof name !== 'string') return '';

    try {
      return name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remover acentos
        .toLowerCase()
        .trim()
        .replace(/\./g, '_') // ⚠️ CRITICAL: Reemplazar puntos con guiones bajos (Mongoose Maps no soportan puntos)
        .replace(/[_\s\/\-]+/g, '_') // Unificar separadores
        .replace(/_+/g, '_') // Remover duplicados
        .replace(/^_|_$/g, ''); // Remover extremos
    } catch (error) {
      console.error('❌ Error normalizando nombre de campo:', name, error);
      return '';
    }
  }

  /**
   * Valida que un valor sea guardable
   */
  static isValidValue(value) {
    // null y undefined no son válidos
    if (value === null || value === undefined) {
      return false;
    }

    // Strings vacíos no son válidos
    if (typeof value === 'string' && value.trim() === '') {
      return false;
    }

    // Arrays vacíos no son válidos
    if (Array.isArray(value) && value.length === 0) {
      return false;
    }

    return true;
  }

  /**
   * Convierte un Map a objeto plano para serialización segura
   */
  static mapToObject(map) {
    if (!map) return {};

    if (map instanceof Map) {
      const obj = {};
      map.forEach((value, key) => {
        obj[key] = value;
      });
      return obj;
    }

    return map;
  }

  /**
   * Convierte un objeto plano a Map
   */
  static objectToMap(obj) {
    if (!obj) return new Map();

    if (obj instanceof Map) {
      return obj;
    }

    const map = new Map();
    Object.entries(obj).forEach(([key, value]) => {
      map.set(key, value);
    });
    return map;
  }

  /**
   * Agrega o actualiza campos en un tercero - VERSIÓN ROBUSTA
   * Usa findByIdAndUpdate para evitar problemas con Mongoose Maps
   */
  static async updateSupplierFields(supplierId, fieldsToUpdate, userId) {
    console.log('📝 [FieldManagementV2] updateSupplierFields called:', {
      supplierId,
      fieldsCount: fieldsToUpdate?.length,
      userId
    });

    // Validación de parámetros
    if (!supplierId) {
      throw new Error('supplierId es requerido');
    }

    if (!fieldsToUpdate || !Array.isArray(fieldsToUpdate)) {
      throw new Error('fieldsToUpdate debe ser un array');
    }

    if (fieldsToUpdate.length === 0) {
      return {
        success: true,
        supplier: null,
        updates: {
          fieldsAdded: [],
          fieldsUpdated: [],
          errors: []
        }
      };
    }

    let supplier;

    try {
      // Buscar tercero con timeout
      supplier = await Supplier.findById(supplierId).maxTimeMS(10000);

      if (!supplier) {
        throw new Error('Tercero no encontrado');
      }

      console.log('✅ [FieldManagementV2] Supplier found:', {
        id: supplier._id,
        identification: supplier.identification_number,
        hasCustomFields: !!supplier.custom_fields
      });

    } catch (error) {
      console.error('❌ [FieldManagementV2] Error finding supplier:', error);
      throw new Error(`Error buscando tercero: ${error.message}`);
    }

    // Obtener custom_fields actuales como objeto plano
    let currentCustomFields = {};
    if (supplier.custom_fields) {
      if (supplier.custom_fields instanceof Map) {
        supplier.custom_fields.forEach((value, key) => {
          currentCustomFields[key] = value;
        });
      } else if (typeof supplier.custom_fields === 'object') {
        currentCustomFields = { ...supplier.custom_fields };
      }
    }

    const updates = {
      fieldsAdded: [],
      fieldsUpdated: [],
      errors: []
    };

    // Objeto para la actualización con $set
    const fieldsToSet = {};

    // Procesar cada campo
    for (const fieldData of fieldsToUpdate) {
      try {
        const { name, value, label } = fieldData;

        console.log('🔄 [FieldManagementV2] Processing field:', {
          name,
          value,
          label,
          valueType: typeof value
        });

        // Validar nombre del campo
        if (!name || typeof name !== 'string') {
          const error = 'Nombre de campo inválido o vacío';
          console.warn('  ⚠️', error);
          updates.errors.push({ name: name || 'unknown', error });
          continue;
        }

        // Normalizar nombre
        const normalizedName = this.normalizeFieldName(name);

        if (!normalizedName) {
          const error = 'Nombre de campo no se pudo normalizar';
          console.warn('  ⚠️', error);
          updates.errors.push({ name, error });
          continue;
        }

        console.log('  → Normalized name:', normalizedName);

        // Validar valor
        if (!this.isValidValue(value)) {
          const error = 'Valor no puede ser nulo, undefined o vacío';
          console.warn('  ⚠️', error);
          updates.errors.push({ name: normalizedName, error });
          continue;
        }

        // Verificar si ya existe
        const existingValue = currentCustomFields[normalizedName];
        const isUpdate = existingValue !== undefined;

        // Agregar al objeto de actualización
        fieldsToSet[`custom_fields.${normalizedName}`] = value;
        currentCustomFields[normalizedName] = value;

        if (isUpdate) {
          console.log('  ✏️  Will update existing field');
          updates.fieldsUpdated.push({
            name: normalizedName,
            oldValue: existingValue,
            newValue: value
          });
        } else {
          console.log('  ➕ Will add new field');
          updates.fieldsAdded.push({
            name: normalizedName,
            value: value
          });
        }

      } catch (fieldError) {
        console.error('  ❌ Error processing field:', fieldError);
        updates.errors.push({
          name: fieldData?.name || 'unknown',
          error: `Error procesando campo: ${fieldError.message}`
        });
      }
    }

    // Si no hay campos para actualizar, retornar
    if (Object.keys(fieldsToSet).length === 0) {
      console.log('⚠️ [FieldManagementV2] No valid fields to update');
      return {
        success: true,
        supplier,
        updates
      };
    }

    // Agregar updated_by
    fieldsToSet.updated_by = userId;

    console.log('💾 [FieldManagementV2] Updating supplier with $set:', {
      fieldsCount: Object.keys(fieldsToSet).length - 1, // -1 for updated_by
      added: updates.fieldsAdded.length,
      updated: updates.fieldsUpdated.length,
      errors: updates.errors.length
    });

    // Usar findByIdAndUpdate con $set para evitar problemas con Maps
    try {
      const updatedSupplier = await Supplier.findByIdAndUpdate(
        supplierId,
        { $set: fieldsToSet },
        {
          new: true,
          runValidators: true,
          maxTimeMS: 15000 // 15 second timeout
        }
      );

      if (!updatedSupplier) {
        throw new Error('No se pudo actualizar el tercero');
      }

      console.log('✅ [FieldManagementV2] Supplier updated successfully');

      return {
        success: true,
        supplier: updatedSupplier,
        updates
      };

    } catch (saveError) {
      console.error('\n╔════════════════════════════════════════════════════════════════╗');
      console.error('║ ❌ [FieldManagementV2] ERROR ACTUALIZANDO SUPPLIER             ║');
      console.error('╚════════════════════════════════════════════════════════════════╝');
      console.error('  Supplier ID:', supplierId);
      console.error('  Error Name:', saveError.name);
      console.error('  Error Message:', saveError.message);
      console.error('  Error Code:', saveError.code);

      if (saveError.errors) {
        console.error('\n  Mongoose Validation Errors:');
        Object.entries(saveError.errors).forEach(([field, err]) => {
          console.error(`    - ${field}: ${err.message}`);
        });
      }

      console.error('\n  Stack Trace:');
      console.error(saveError.stack);
      console.error('╚════════════════════════════════════════════════════════════════╝\n');

      // Re-lanzar el error con contexto
      throw new Error(`Error al guardar tercero: ${saveError.message}`);
    }
  }
}

module.exports = FieldManagementServiceV2;
