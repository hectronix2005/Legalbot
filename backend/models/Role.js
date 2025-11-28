const mongoose = require('mongoose');

const RoleSchema = new mongoose.Schema({
  // Nombre del rol (único por compañía o global)
  name: {
    type: String,
    required: true,
    trim: true
  },
  // Código interno del rol (lowercase, sin espacios)
  code: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },
  // Descripción del rol
  description: {
    type: String,
    default: ''
  },
  // Si es un rol del sistema (no editable/eliminable)
  isSystemRole: {
    type: Boolean,
    default: false
  },
  // Nivel de jerarquía (mayor número = más permisos)
  // super_admin = 100, admin = 80, talento_humano = 60, lawyer = 50, requester = 20, colaboradores = 10
  hierarchyLevel: {
    type: Number,
    default: 20,
    min: 0,
    max: 100
  },
  // Permisos del módulo de usuarios
  permissions: {
    // Gestión de usuarios
    users: {
      canView: { type: Boolean, default: false },
      canCreate: { type: Boolean, default: false },
      canEdit: { type: Boolean, default: false },
      canDelete: { type: Boolean, default: false },
      canAssignToCompanies: { type: Boolean, default: false },
      canChangeRoles: { type: Boolean, default: false }
    },
    // Gestión de empresas
    companies: {
      canView: { type: Boolean, default: false },
      canCreate: { type: Boolean, default: false },
      canEdit: { type: Boolean, default: false },
      canDelete: { type: Boolean, default: false }
    },
    // Gestión de contratos
    contracts: {
      canView: { type: Boolean, default: true },
      canCreate: { type: Boolean, default: false },
      canEdit: { type: Boolean, default: false },
      canDelete: { type: Boolean, default: false },
      canApprove: { type: Boolean, default: false },
      canSign: { type: Boolean, default: false }
    },
    // Gestión de solicitudes
    requests: {
      canView: { type: Boolean, default: true },
      canCreate: { type: Boolean, default: true },
      canEdit: { type: Boolean, default: false },
      canDelete: { type: Boolean, default: false },
      canApprove: { type: Boolean, default: false }
    },
    // Gestión de terceros/proveedores
    thirdParties: {
      canView: { type: Boolean, default: false },
      canCreate: { type: Boolean, default: false },
      canEdit: { type: Boolean, default: false },
      canDelete: { type: Boolean, default: false }
    },
    // Gestión de vacaciones
    vacations: {
      canView: { type: Boolean, default: true },
      canRequest: { type: Boolean, default: true },
      canApproveAsLeader: { type: Boolean, default: false },
      canApproveAsTalentoHumano: { type: Boolean, default: false },
      canManageBalances: { type: Boolean, default: false },
      canRunAccrual: { type: Boolean, default: false },
      canViewAllEmployees: { type: Boolean, default: false }
    },
    // Dashboard y reportes
    dashboard: {
      canView: { type: Boolean, default: true },
      canViewAnalytics: { type: Boolean, default: false },
      canExportReports: { type: Boolean, default: false }
    },
    // Configuración del sistema
    settings: {
      canView: { type: Boolean, default: false },
      canEdit: { type: Boolean, default: false },
      canManageRoles: { type: Boolean, default: false },
      canManageTemplates: { type: Boolean, default: false }
    }
  },
  // Módulos a los que tiene acceso
  accessibleModules: [{
    type: String,
    enum: [
      'dashboard',
      'contracts',
      'requests',
      'users',
      'companies',
      'third-parties',
      'vacations',
      'templates',
      'reports',
      'settings',
      'audit'
    ]
  }],
  // Color para identificación visual
  color: {
    type: String,
    default: '#6c757d'
  },
  // Icono (emoji o clase de icono)
  icon: {
    type: String,
    default: '👤'
  },
  // Compañía (null = rol global disponible para todas las empresas)
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    default: null
  },
  // Estado activo
  active: {
    type: Boolean,
    default: true
  },
  // Quién lo creó
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  // Fecha de creación
  createdAt: {
    type: Date,
    default: Date.now
  },
  // Fecha de última actualización
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Índices
RoleSchema.index({ code: 1, companyId: 1 }, { unique: true });
RoleSchema.index({ companyId: 1 });
RoleSchema.index({ isSystemRole: 1 });
RoleSchema.index({ hierarchyLevel: -1 });

// Virtual para obtener el nombre completo del rol
RoleSchema.virtual('displayName').get(function() {
  return this.icon ? `${this.icon} ${this.name}` : this.name;
});

// Método para verificar si tiene un permiso específico
RoleSchema.methods.hasPermission = function(module, permission) {
  if (!this.permissions || !this.permissions[module]) return false;
  return this.permissions[module][permission] === true;
};

// Método para verificar acceso a un módulo
RoleSchema.methods.canAccessModule = function(moduleName) {
  return this.accessibleModules.includes(moduleName);
};

// Pre-save para actualizar fecha
RoleSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Inicialización de roles del sistema por defecto
RoleSchema.statics.initializeSystemRoles = async function() {
  const systemRoles = [
    {
      name: 'Super Administrador',
      code: 'super_admin',
      description: 'Acceso total al sistema. Puede gestionar todas las empresas y usuarios.',
      isSystemRole: true,
      hierarchyLevel: 100,
      color: '#dc3545',
      icon: '👑',
      accessibleModules: ['dashboard', 'contracts', 'requests', 'users', 'companies', 'third-parties', 'vacations', 'templates', 'reports', 'settings', 'audit'],
      permissions: {
        users: { canView: true, canCreate: true, canEdit: true, canDelete: true, canAssignToCompanies: true, canChangeRoles: true },
        companies: { canView: true, canCreate: true, canEdit: true, canDelete: true },
        contracts: { canView: true, canCreate: true, canEdit: true, canDelete: true, canApprove: true, canSign: true },
        requests: { canView: true, canCreate: true, canEdit: true, canDelete: true, canApprove: true },
        thirdParties: { canView: true, canCreate: true, canEdit: true, canDelete: true },
        vacations: { canView: true, canRequest: true, canApproveAsLeader: true, canApproveAsTalentoHumano: true, canManageBalances: true, canRunAccrual: true, canViewAllEmployees: true },
        dashboard: { canView: true, canViewAnalytics: true, canExportReports: true },
        settings: { canView: true, canEdit: true, canManageRoles: true, canManageTemplates: true }
      }
    },
    {
      name: 'Administrador',
      code: 'admin',
      description: 'Administrador de empresa. Gestiona usuarios y configuración de su empresa.',
      isSystemRole: true,
      hierarchyLevel: 80,
      color: '#fd7e14',
      icon: '⚙️',
      accessibleModules: ['dashboard', 'contracts', 'requests', 'users', 'third-parties', 'vacations', 'templates', 'reports', 'settings'],
      permissions: {
        users: { canView: true, canCreate: true, canEdit: true, canDelete: false, canAssignToCompanies: false, canChangeRoles: true },
        companies: { canView: true, canCreate: false, canEdit: true, canDelete: false },
        contracts: { canView: true, canCreate: true, canEdit: true, canDelete: true, canApprove: true, canSign: true },
        requests: { canView: true, canCreate: true, canEdit: true, canDelete: true, canApprove: true },
        thirdParties: { canView: true, canCreate: true, canEdit: true, canDelete: true },
        vacations: { canView: true, canRequest: true, canApproveAsLeader: true, canApproveAsTalentoHumano: true, canManageBalances: true, canRunAccrual: true, canViewAllEmployees: true },
        dashboard: { canView: true, canViewAnalytics: true, canExportReports: true },
        settings: { canView: true, canEdit: true, canManageRoles: false, canManageTemplates: true }
      }
    },
    {
      name: 'Talento Humano',
      code: 'talento_humano',
      description: 'Gestión de recursos humanos, vacaciones y nómina.',
      isSystemRole: true,
      hierarchyLevel: 60,
      color: '#6f42c1',
      icon: '👥',
      accessibleModules: ['dashboard', 'users', 'vacations', 'reports'],
      permissions: {
        users: { canView: true, canCreate: false, canEdit: false, canDelete: false, canAssignToCompanies: false, canChangeRoles: false },
        companies: { canView: true, canCreate: false, canEdit: false, canDelete: false },
        contracts: { canView: true, canCreate: false, canEdit: false, canDelete: false, canApprove: false, canSign: false },
        requests: { canView: true, canCreate: true, canEdit: false, canDelete: false, canApprove: false },
        thirdParties: { canView: true, canCreate: false, canEdit: false, canDelete: false },
        vacations: { canView: true, canRequest: true, canApproveAsLeader: false, canApproveAsTalentoHumano: true, canManageBalances: true, canRunAccrual: true, canViewAllEmployees: true },
        dashboard: { canView: true, canViewAnalytics: true, canExportReports: true },
        settings: { canView: false, canEdit: false, canManageRoles: false, canManageTemplates: false }
      }
    },
    {
      name: 'Abogado',
      code: 'lawyer',
      description: 'Revisión y gestión legal de contratos.',
      isSystemRole: true,
      hierarchyLevel: 50,
      color: '#0d6efd',
      icon: '⚖️',
      accessibleModules: ['dashboard', 'contracts', 'requests', 'third-parties', 'templates'],
      permissions: {
        users: { canView: false, canCreate: false, canEdit: false, canDelete: false, canAssignToCompanies: false, canChangeRoles: false },
        companies: { canView: true, canCreate: false, canEdit: false, canDelete: false },
        contracts: { canView: true, canCreate: true, canEdit: true, canDelete: false, canApprove: true, canSign: false },
        requests: { canView: true, canCreate: true, canEdit: true, canDelete: false, canApprove: true },
        thirdParties: { canView: true, canCreate: true, canEdit: true, canDelete: false },
        vacations: { canView: true, canRequest: true, canApproveAsLeader: false, canApproveAsTalentoHumano: false, canManageBalances: false, canRunAccrual: false, canViewAllEmployees: false },
        dashboard: { canView: true, canViewAnalytics: false, canExportReports: false },
        settings: { canView: false, canEdit: false, canManageRoles: false, canManageTemplates: true }
      }
    },
    {
      name: 'Solicitante',
      code: 'requester',
      description: 'Usuario básico que puede crear y ver solicitudes.',
      isSystemRole: true,
      hierarchyLevel: 20,
      color: '#198754',
      icon: '📝',
      accessibleModules: ['dashboard', 'requests', 'vacations'],
      permissions: {
        users: { canView: false, canCreate: false, canEdit: false, canDelete: false, canAssignToCompanies: false, canChangeRoles: false },
        companies: { canView: false, canCreate: false, canEdit: false, canDelete: false },
        contracts: { canView: true, canCreate: false, canEdit: false, canDelete: false, canApprove: false, canSign: false },
        requests: { canView: true, canCreate: true, canEdit: false, canDelete: false, canApprove: false },
        thirdParties: { canView: false, canCreate: false, canEdit: false, canDelete: false },
        vacations: { canView: true, canRequest: true, canApproveAsLeader: false, canApproveAsTalentoHumano: false, canManageBalances: false, canRunAccrual: false, canViewAllEmployees: false },
        dashboard: { canView: true, canViewAnalytics: false, canExportReports: false },
        settings: { canView: false, canEdit: false, canManageRoles: false, canManageTemplates: false }
      }
    },
    {
      name: 'Colaborador',
      code: 'colaboradores',
      description: 'Empleado con acceso básico para consultas.',
      isSystemRole: true,
      hierarchyLevel: 10,
      color: '#6c757d',
      icon: '👤',
      accessibleModules: ['dashboard', 'vacations'],
      permissions: {
        users: { canView: false, canCreate: false, canEdit: false, canDelete: false, canAssignToCompanies: false, canChangeRoles: false },
        companies: { canView: false, canCreate: false, canEdit: false, canDelete: false },
        contracts: { canView: false, canCreate: false, canEdit: false, canDelete: false, canApprove: false, canSign: false },
        requests: { canView: true, canCreate: false, canEdit: false, canDelete: false, canApprove: false },
        thirdParties: { canView: false, canCreate: false, canEdit: false, canDelete: false },
        vacations: { canView: true, canRequest: true, canApproveAsLeader: false, canApproveAsTalentoHumano: false, canManageBalances: false, canRunAccrual: false, canViewAllEmployees: false },
        dashboard: { canView: true, canViewAnalytics: false, canExportReports: false },
        settings: { canView: false, canEdit: false, canManageRoles: false, canManageTemplates: false }
      }
    }
  ];

  for (const roleData of systemRoles) {
    const exists = await this.findOne({ code: roleData.code, companyId: null });
    if (!exists) {
      await this.create(roleData);
      console.log(`✅ Rol del sistema creado: ${roleData.name}`);
    }
  }
};

module.exports = mongoose.model('Role', RoleSchema);
