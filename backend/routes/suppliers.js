const express = require('express');
const router = express.Router();
const { authenticate, verifyTenant, authorize } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const Supplier = require('../models/Supplier');
const ActivityLog = require('../models/ActivityLog');
const ThirdPartyTypeConfig = require('../models/ThirdPartyTypeConfig');
const Contract = require('../models/Contract');
const ContractTemplate = require('../models/ContractTemplate');

// Obtener tipos de terceros disponibles
router.get('/types', authenticate, async (req, res) => {
  try {
    const filter = { active: true };

    // Si el usuario no es super_admin, filtrar por empresa o tipos globales
    if (req.user.role !== 'super_admin' && req.companyId) {
      filter.$or = [
        { company: req.companyId },
        { company: null } // Tipos globales
      ];
    }

    console.log('🔍 [DEBUG] Fetching types with filter:', JSON.stringify(filter));
    console.log('🔍 [DEBUG] User role:', req.user.role, 'CompanyId:', req.companyId);

    const types = await ThirdPartyTypeConfig.find(filter)
      .select('code label icon description fields default_identification_types')
      .sort({ label: 1 });

    console.log('✅ [DEBUG] Types found:', types.length);
    console.log('📋 [DEBUG] Type codes:', types.map(t => t.code).join(', '));

    res.json({
      success: true,
      types
    });
  } catch (error) {
    console.error('Error al obtener tipos de terceros:', error);
    res.status(500).json({ error: 'Error al obtener tipos de terceros' });
  }
});

// Obtener todos los proveedores de la empresa (o todos si es super_admin)
router.get('/', authenticate, verifyTenant, async (req, res) => {
  try {
    const { active } = req.query;

    const filter = {};

    // Super admin con companyId='ALL' ve todos los terceros
    // Super admin con companyId específico ve solo esa empresa
    // Otros usuarios solo ven los de su compañía
    if (req.companyId && req.companyId !== 'ALL') {
      filter.company = req.companyId;
    }

    if (active !== undefined) {
      filter.active = active === 'true';
    }

    const suppliers = await Supplier.find(filter)
      .populate('created_by', 'name email')
      .populate('updated_by', 'name email')
      .populate('company', 'name')
      .populate('third_party_type', 'code label icon fields default_identification_types')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: suppliers.length,
      suppliers
    });
  } catch (error) {
    console.error('Error al obtener proveedores:', error);
    res.status(500).json({ error: 'Error al obtener proveedores' });
  }
});

// Verificar si un tercero tiene referencias en contratos o plantillas
router.get('/:id/check-references', authenticate, verifyTenant, async (req, res) => {
  try {
    // Construir query del supplier - si es "ALL", no filtrar por company
    const supplierQuery = { _id: req.params.id };
    if (req.companyId && req.companyId !== 'ALL') {
      supplierQuery.company = req.companyId;
    }

    const supplier = await Supplier.findOne(supplierQuery)
      .populate('third_party_type', 'code');

    if (!supplier) {
      return res.status(404).json({ error: 'Tercero no encontrado' });
    }

    const references = {
      hasReferences: false,
      canDelete: true,
      details: {
        contracts: 0,
        templates: 0
      }
    };

    // Buscar contratos que mencionen al tercero
    // Buscamos en el contenido del contrato si aparece su nombre o identificación
    const contractQuery = {
      $or: [
        { content: { $regex: supplier.legal_name, $options: 'i' } },
        { content: { $regex: supplier.identification_number, $options: 'i' } },
        { title: { $regex: supplier.legal_name, $options: 'i' } }
      ]
    };
    if (req.companyId && req.companyId !== 'ALL') {
      contractQuery.company = req.companyId;
    }

    const contractsWithReference = await Contract.find(contractQuery).countDocuments();

    references.details.contracts = contractsWithReference;

    // Buscar plantillas del mismo tipo de tercero
    if (supplier.third_party_type) {
      const templateQuery = {
        third_party_type: supplier.third_party_type.code,
        active: true
      };
      if (req.companyId && req.companyId !== 'ALL') {
        templateQuery.company = req.companyId;
      }

      const templatesWithType = await ContractTemplate.find(templateQuery).countDocuments();

      references.details.templates = templatesWithType;
    }

    // Si hay referencias, no se puede eliminar
    if (contractsWithReference > 0 || references.details.templates > 0) {
      references.hasReferences = true;
      references.canDelete = false;
    }

    res.json({
      success: true,
      references
    });
  } catch (error) {
    console.error('Error al verificar referencias del tercero:', error);
    res.status(500).json({ error: 'Error al verificar referencias' });
  }
});

// Obtener un proveedor específico
router.get('/:id', authenticate, verifyTenant, async (req, res) => {
  try {
    const supplier = await Supplier.findOne({
      _id: req.params.id,
      company: req.companyId
    })
      .populate('created_by', 'name email')
      .populate('updated_by', 'name email')
      .populate('company', 'name')
      .populate('third_party_type', 'code label icon fields default_identification_types');

    if (!supplier) {
      return res.status(404).json({ error: 'Proveedor no encontrado' });
    }

    res.json({
      success: true,
      supplier
    });
  } catch (error) {
    console.error('Error al obtener proveedor:', error);
    res.status(500).json({ error: 'Error al obtener proveedor' });
  }
});

// Crear proveedor
router.post('/',
  authenticate,
  verifyTenant,
  authorize('super_admin', 'admin'),
  [
    body('identification_type').notEmpty().withMessage('El tipo de identificación es requerido'),
    body('identification_number').notEmpty().withMessage('El número de identificación es requerido'),
    body('legal_name').notEmpty().withMessage('La razón social es requerida'),
    body('legal_name_short').notEmpty().withMessage('La razón social abreviada es requerida'),
    body('legal_representative_name').notEmpty().withMessage('El nombre del representante legal es requerido'),
    body('legal_representative_id_type').notEmpty().withMessage('El tipo de identificación del representante es requerido'),
    body('legal_representative_id_number').notEmpty().withMessage('El número de identificación del representante es requerido')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const {
        identification_type,
        identification_number,
        legal_name,
        legal_name_short,
        legal_representative_name,
        legal_representative_id_type,
        legal_representative_id_number,
        licensee_name,
        email,
        phone,
        address,
        city,
        country,
        third_party_type,
        custom_fields
      } = req.body;

      // Verificar si ya existe un proveedor con ese número de identificación en esta empresa
      const existingSupplier = await Supplier.findOne({
        company: req.companyId,
        identification_number
      });

      if (existingSupplier) {
        return res.status(400).json({
          error: 'Ya existe un proveedor con ese número de identificación en esta empresa'
        });
      }

      // Crear proveedor
      const supplier = await Supplier.create({
        identification_type,
        identification_number,
        legal_name,
        legal_name_short,
        legal_representative_name,
        legal_representative_id_type,
        legal_representative_id_number,
        licensee_name,
        email,
        phone,
        address,
        city,
        country,
        third_party_type,
        custom_fields: custom_fields || {},
        company: req.companyId,
        created_by: req.user.id
      });

      // Log de actividad
      await ActivityLog.create({
        user: req.user.id,
        action: 'CREATE',
        entity_type: 'supplier',
        entity_id: supplier._id,
        description: `Creó el proveedor: ${legal_name}`,
        company: req.companyId
      });

      res.status(201).json({
        success: true,
        message: 'Proveedor creado exitosamente',
        supplier
      });
    } catch (error) {
      console.error('Error al crear proveedor:', error);
      res.status(500).json({ error: 'Error al crear proveedor' });
    }
  }
);

// Actualizar proveedor
router.put('/:id',
  authenticate,
  verifyTenant,
  authorize('super_admin', 'admin'),
  async (req, res) => {
    try {
      const supplier = await Supplier.findOne({
        _id: req.params.id,
        company: req.companyId
      });

      if (!supplier) {
        return res.status(404).json({ error: 'Proveedor no encontrado' });
      }

      const {
        identification_type,
        identification_number,
        legal_name,
        legal_name_short,
        legal_representative_name,
        legal_representative_id_type,
        legal_representative_id_number,
        licensee_name,
        email,
        phone,
        address,
        city,
        country,
        third_party_type,
        custom_fields
      } = req.body;

      // Si se está cambiando el número de identificación, verificar que no exista otro con ese número
      if (identification_number && identification_number !== supplier.identification_number) {
        const existingSupplier = await Supplier.findOne({
          company: req.companyId,
          identification_number,
          _id: { $ne: req.params.id }
        });

        if (existingSupplier) {
          return res.status(400).json({
            error: 'Ya existe otro proveedor con ese número de identificación'
          });
        }
      }

      // Actualizar campos
      if (identification_type) supplier.identification_type = identification_type;
      if (identification_number) supplier.identification_number = identification_number;
      if (legal_name) supplier.legal_name = legal_name;
      if (legal_name_short) supplier.legal_name_short = legal_name_short;
      if (legal_representative_name) supplier.legal_representative_name = legal_representative_name;
      if (legal_representative_id_type) supplier.legal_representative_id_type = legal_representative_id_type;
      if (legal_representative_id_number) supplier.legal_representative_id_number = legal_representative_id_number;
      if (licensee_name !== undefined) supplier.licensee_name = licensee_name;
      if (email !== undefined) supplier.email = email;
      if (phone !== undefined) supplier.phone = phone;
      if (address !== undefined) supplier.address = address;
      if (city !== undefined) supplier.city = city;
      if (country !== undefined) supplier.country = country;
      if (third_party_type !== undefined) supplier.third_party_type = third_party_type;
      if (custom_fields !== undefined) supplier.custom_fields = custom_fields;

      supplier.updated_by = req.user.id;
      await supplier.save();

      // Log de actividad
      await ActivityLog.create({
        user: req.user.id,
        action: 'UPDATE',
        entity_type: 'supplier',
        entity_id: supplier._id,
        description: `Actualizó el proveedor: ${supplier.legal_name}`,
        company: req.companyId
      });

      res.json({
        success: true,
        message: 'Proveedor actualizado exitosamente',
        supplier
      });
    } catch (error) {
      console.error('Error al actualizar proveedor:', error);
      res.status(500).json({ error: 'Error al actualizar proveedor' });
    }
  }
);

// Desactivar/Activar proveedor
router.patch('/:id/toggle-status',
  authenticate,
  verifyTenant,
  authorize('super_admin', 'admin'),
  async (req, res) => {
    try {
      const supplier = await Supplier.findOne({
        _id: req.params.id,
        company: req.companyId
      });

      if (!supplier) {
        return res.status(404).json({ error: 'Proveedor no encontrado' });
      }

      supplier.active = !supplier.active;
      supplier.updated_by = req.user.id;
      await supplier.save();

      // Log de actividad
      await ActivityLog.create({
        user: req.user.id,
        action: 'UPDATE',
        entity_type: 'supplier',
        entity_id: supplier._id,
        description: `${supplier.active ? 'Activó' : 'Desactivó'} el proveedor: ${supplier.legal_name}`,
        company: req.companyId
      });

      res.json({
        success: true,
        message: `Proveedor ${supplier.active ? 'activado' : 'desactivado'} exitosamente`,
        supplier
      });
    } catch (error) {
      console.error('Error al cambiar estado del proveedor:', error);
      res.status(500).json({ error: 'Error al cambiar estado del proveedor' });
    }
  }
);

// Eliminar proveedor (solo si no tiene referencias)
router.delete('/:id',
  authenticate,
  verifyTenant,
  authorize('super_admin', 'admin'),
  async (req, res) => {
    try {
      const supplier = await Supplier.findOne({
        _id: req.params.id,
        company: req.companyId
      }).populate('third_party_type', 'code');

      if (!supplier) {
        return res.status(404).json({ error: 'Tercero no encontrado' });
      }

      // Verificar referencias antes de eliminar
      const contractsWithReference = await Contract.find({
        company: req.companyId,
        $or: [
          { content: { $regex: supplier.legal_name, $options: 'i' } },
          { content: { $regex: supplier.identification_number, $options: 'i' } },
          { title: { $regex: supplier.legal_name, $options: 'i' } }
        ]
      }).countDocuments();

      let templatesWithType = 0;
      if (supplier.third_party_type) {
        templatesWithType = await ContractTemplate.find({
          company: req.companyId,
          third_party_type: supplier.third_party_type.code,
          active: true
        }).countDocuments();
      }

      // Si tiene referencias, no permitir eliminación
      if (contractsWithReference > 0 || templatesWithType > 0) {
        return res.status(400).json({
          error: 'No se puede eliminar este tercero porque tiene referencias en contratos o plantillas',
          details: {
            contracts: contractsWithReference,
            templates: templatesWithType
          },
          suggestion: 'Desactiva el tercero en lugar de eliminarlo'
        });
      }

      // Si no tiene referencias, permitir eliminación
      await Supplier.deleteOne({ _id: req.params.id });

      // Log de actividad
      await ActivityLog.create({
        user: req.user.id,
        action: 'DELETE',
        entity_type: 'supplier',
        entity_id: req.params.id,
        description: `Eliminó el tercero: ${supplier.legal_name}`,
        company: req.companyId
      });

      res.json({
        success: true,
        message: 'Tercero eliminado exitosamente'
      });
    } catch (error) {
      console.error('Error al eliminar tercero:', error);
      res.status(500).json({ error: 'Error al eliminar tercero' });
    }
  }
);

module.exports = router;
