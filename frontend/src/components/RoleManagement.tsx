import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import './RoleManagement.css';

interface RolePermissions {
  users: {
    canView: boolean;
    canCreate: boolean;
    canEdit: boolean;
    canDelete: boolean;
    canAssignToCompanies: boolean;
    canChangeRoles: boolean;
  };
  companies: {
    canView: boolean;
    canCreate: boolean;
    canEdit: boolean;
    canDelete: boolean;
  };
  contracts: {
    canView: boolean;
    canCreate: boolean;
    canEdit: boolean;
    canDelete: boolean;
    canApprove: boolean;
    canSign: boolean;
  };
  requests: {
    canView: boolean;
    canCreate: boolean;
    canEdit: boolean;
    canDelete: boolean;
    canApprove: boolean;
  };
  thirdParties: {
    canView: boolean;
    canCreate: boolean;
    canEdit: boolean;
    canDelete: boolean;
  };
  vacations: {
    canView: boolean;
    canRequest: boolean;
    canApproveAsLeader: boolean;
    canApproveAsTalentoHumano: boolean;
    canManageBalances: boolean;
    canRunAccrual: boolean;
    canViewAllEmployees: boolean;
  };
  dashboard: {
    canView: boolean;
    canViewAnalytics: boolean;
    canExportReports: boolean;
  };
  settings: {
    canView: boolean;
    canEdit: boolean;
    canManageRoles: boolean;
    canManageTemplates: boolean;
  };
}

interface Role {
  _id: string;
  name: string;
  code: string;
  description: string;
  isSystemRole: boolean;
  hierarchyLevel: number;
  permissions: RolePermissions;
  accessibleModules: string[];
  color: string;
  icon: string;
  companyId?: {
    _id: string;
    name: string;
  };
  active: boolean;
  createdBy?: {
    _id: string;
    name: string;
    email: string;
  };
  createdAt: string;
}

const defaultPermissions: RolePermissions = {
  users: { canView: false, canCreate: false, canEdit: false, canDelete: false, canAssignToCompanies: false, canChangeRoles: false },
  companies: { canView: false, canCreate: false, canEdit: false, canDelete: false },
  contracts: { canView: true, canCreate: false, canEdit: false, canDelete: false, canApprove: false, canSign: false },
  requests: { canView: true, canCreate: true, canEdit: false, canDelete: false, canApprove: false },
  thirdParties: { canView: false, canCreate: false, canEdit: false, canDelete: false },
  vacations: { canView: true, canRequest: true, canApproveAsLeader: false, canApproveAsTalentoHumano: false, canManageBalances: false, canRunAccrual: false, canViewAllEmployees: false },
  dashboard: { canView: true, canViewAnalytics: false, canExportReports: false },
  settings: { canView: false, canEdit: false, canManageRoles: false, canManageTemplates: false }
};

const availableModules = [
  { id: 'dashboard', label: 'Dashboard', icon: 'chart-bar' },
  { id: 'contracts', label: 'Contratos', icon: 'file-text' },
  { id: 'requests', label: 'Solicitudes', icon: 'inbox' },
  { id: 'users', label: 'Usuarios', icon: 'users' },
  { id: 'companies', label: 'Empresas', icon: 'building' },
  { id: 'third-parties', label: 'Terceros', icon: 'user-plus' },
  { id: 'vacations', label: 'Vacaciones', icon: 'calendar' },
  { id: 'templates', label: 'Plantillas', icon: 'file-plus' },
  { id: 'reports', label: 'Reportes', icon: 'pie-chart' },
  { id: 'settings', label: 'Configuracion', icon: 'settings' },
  { id: 'audit', label: 'Auditoria', icon: 'shield' }
];

const permissionLabels: Record<string, Record<string, string>> = {
  users: {
    canView: 'Ver usuarios',
    canCreate: 'Crear usuarios',
    canEdit: 'Editar usuarios',
    canDelete: 'Eliminar usuarios',
    canAssignToCompanies: 'Asignar a empresas',
    canChangeRoles: 'Cambiar roles'
  },
  companies: {
    canView: 'Ver empresas',
    canCreate: 'Crear empresas',
    canEdit: 'Editar empresas',
    canDelete: 'Eliminar empresas'
  },
  contracts: {
    canView: 'Ver contratos',
    canCreate: 'Crear contratos',
    canEdit: 'Editar contratos',
    canDelete: 'Eliminar contratos',
    canApprove: 'Aprobar contratos',
    canSign: 'Firmar contratos'
  },
  requests: {
    canView: 'Ver solicitudes',
    canCreate: 'Crear solicitudes',
    canEdit: 'Editar solicitudes',
    canDelete: 'Eliminar solicitudes',
    canApprove: 'Aprobar solicitudes'
  },
  thirdParties: {
    canView: 'Ver terceros',
    canCreate: 'Crear terceros',
    canEdit: 'Editar terceros',
    canDelete: 'Eliminar terceros'
  },
  vacations: {
    canView: 'Ver vacaciones',
    canRequest: 'Solicitar vacaciones',
    canApproveAsLeader: 'Aprobar como lider',
    canApproveAsTalentoHumano: 'Aprobar como TH',
    canManageBalances: 'Gestionar saldos',
    canRunAccrual: 'Ejecutar causacion',
    canViewAllEmployees: 'Ver todos los empleados'
  },
  dashboard: {
    canView: 'Ver dashboard',
    canViewAnalytics: 'Ver analiticas',
    canExportReports: 'Exportar reportes'
  },
  settings: {
    canView: 'Ver configuracion',
    canEdit: 'Editar configuracion',
    canManageRoles: 'Gestionar roles',
    canManageTemplates: 'Gestionar plantillas'
  }
};

const moduleLabels: Record<string, string> = {
  users: 'Usuarios',
  companies: 'Empresas',
  contracts: 'Contratos',
  requests: 'Solicitudes',
  thirdParties: 'Terceros',
  vacations: 'Vacaciones',
  dashboard: 'Dashboard',
  settings: 'Configuracion'
};

const RoleManagement: React.FC = () => {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [filterSystem, setFilterSystem] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    hierarchyLevel: 20,
    color: '#6c757d',
    icon: '',
    permissions: defaultPermissions,
    accessibleModules: ['dashboard'] as string[]
  });

  const fetchRoles = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get('/roles');
      // Verificar que la respuesta sea un array
      if (Array.isArray(response.data)) {
        setRoles(response.data);
      } else {
        console.error('Respuesta inesperada de /roles:', response.data);
        setRoles([]);
      }
    } catch (error) {
      console.error('Error fetching roles:', error);
      setRoles([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  const handleInitializeRoles = async () => {
    try {
      await api.post('/roles/initialize');
      await fetchRoles();
      alert('Roles del sistema inicializados exitosamente');
    } catch (error: any) {
      console.error('Error initializing roles:', error);
      alert(error.response?.data?.error || 'Error al inicializar roles');
    }
  };

  const handleCreateRole = async () => {
    try {
      if (!formData.name || !formData.code) {
        alert('El nombre y codigo son requeridos');
        return;
      }

      await api.post('/roles', formData);
      await fetchRoles();
      setShowCreateModal(false);
      resetForm();
      alert('Rol creado exitosamente');
    } catch (error: any) {
      console.error('Error creating role:', error);
      alert(error.response?.data?.error || 'Error al crear rol');
    }
  };

  const handleUpdateRole = async () => {
    if (!selectedRole) return;

    try {
      await api.put(`/roles/${selectedRole._id}`, formData);
      await fetchRoles();
      setShowEditModal(false);
      setSelectedRole(null);
      resetForm();
      alert('Rol actualizado exitosamente');
    } catch (error: any) {
      console.error('Error updating role:', error);
      alert(error.response?.data?.error || 'Error al actualizar rol');
    }
  };

  const handleDeleteRole = async (role: Role) => {
    if (role.isSystemRole) {
      alert('No se pueden eliminar roles del sistema');
      return;
    }

    if (!window.confirm(`¿Eliminar el rol "${role.name}"? Esta accion no se puede deshacer.`)) {
      return;
    }

    try {
      await api.delete(`/roles/${role._id}`);
      await fetchRoles();
      alert('Rol eliminado exitosamente');
    } catch (error: any) {
      console.error('Error deleting role:', error);
      alert(error.response?.data?.error || 'Error al eliminar rol');
    }
  };

  const handleDuplicateRole = async (role: Role) => {
    const newName = prompt('Nombre para el nuevo rol:', `${role.name} (Copia)`);
    if (!newName) return;

    const newCode = prompt('Codigo para el nuevo rol:', `${role.code}_copy`);
    if (!newCode) return;

    try {
      await api.post(`/roles/duplicate/${role._id}`, {
        name: newName,
        code: newCode.toLowerCase().replace(/\s+/g, '_')
      });
      await fetchRoles();
      alert('Rol duplicado exitosamente');
    } catch (error: any) {
      console.error('Error duplicating role:', error);
      alert(error.response?.data?.error || 'Error al duplicar rol');
    }
  };

  const openEditModal = (role: Role) => {
    setSelectedRole(role);
    setFormData({
      name: role.name,
      code: role.code,
      description: role.description,
      hierarchyLevel: role.hierarchyLevel,
      color: role.color,
      icon: role.icon,
      permissions: role.permissions || defaultPermissions,
      accessibleModules: role.accessibleModules || ['dashboard']
    });
    setShowEditModal(true);
  };

  const openPermissionsModal = (role: Role) => {
    setSelectedRole(role);
    setFormData({
      ...formData,
      permissions: role.permissions || defaultPermissions,
      accessibleModules: role.accessibleModules || ['dashboard']
    });
    setShowPermissionsModal(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      code: '',
      description: '',
      hierarchyLevel: 20,
      color: '#6c757d',
      icon: '',
      permissions: defaultPermissions,
      accessibleModules: ['dashboard']
    });
  };

  const handlePermissionChange = (module: string, permission: string, value: boolean) => {
    setFormData(prev => {
      const modulePermissions = prev.permissions[module as keyof RolePermissions];
      return {
        ...prev,
        permissions: {
          ...prev.permissions,
          [module]: {
            ...modulePermissions,
            [permission]: value
          }
        }
      };
    });
  };

  // Helper function to get permission value safely
  const getPermissionValue = (module: string, permKey: string): boolean => {
    const modulePerms = formData.permissions[module as keyof RolePermissions];
    if (!modulePerms) return false;
    return (modulePerms as Record<string, boolean>)[permKey] || false;
  };

  const handleModuleToggle = (moduleId: string) => {
    setFormData(prev => ({
      ...prev,
      accessibleModules: prev.accessibleModules.includes(moduleId)
        ? prev.accessibleModules.filter(m => m !== moduleId)
        : [...prev.accessibleModules, moduleId]
    }));
  };

  const filteredRoles = roles.filter(role => {
    const matchesSearch = role.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      role.code.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterSystem === 'all' ||
      (filterSystem === 'system' && role.isSystemRole) ||
      (filterSystem === 'custom' && !role.isSystemRole);
    return matchesSearch && matchesFilter;
  });

  if (loading) {
    return <div className="loading">Cargando gestion de roles...</div>;
  }

  return (
    <div className="role-management">
      <div className="page-header">
        <div className="header-left">
          <h1>Gestion de Roles</h1>
          <p className="header-description">Administra los roles y permisos del sistema</p>
        </div>
        <div className="header-actions">
          <button className="btn-secondary" onClick={handleInitializeRoles}>
            Inicializar Roles Sistema
          </button>
          <button className="btn-primary" onClick={() => { resetForm(); setShowCreateModal(true); }}>
            + Crear Rol
          </button>
        </div>
      </div>

      <div className="filters-section">
        <div className="filters-row">
          <div className="filter-group">
            <label>Buscar:</label>
            <input
              type="text"
              placeholder="Nombre o codigo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="filter-input"
            />
          </div>
          <div className="filter-group">
            <label>Tipo:</label>
            <select
              value={filterSystem}
              onChange={(e) => setFilterSystem(e.target.value)}
              className="filter-select"
            >
              <option value="all">Todos</option>
              <option value="system">Roles del Sistema</option>
              <option value="custom">Roles Personalizados</option>
            </select>
          </div>
        </div>
        <div className="results-count">
          Mostrando {filteredRoles.length} de {roles.length} roles
        </div>
      </div>

      <div className="roles-grid">
        {filteredRoles.map((role) => (
          <div key={role._id} className={`role-card ${role.isSystemRole ? 'system-role' : 'custom-role'}`}>
            <div className="role-header" style={{ borderLeftColor: role.color }}>
              <div className="role-icon" style={{ backgroundColor: role.color }}>
                {role.icon || role.name.charAt(0).toUpperCase()}
              </div>
              <div className="role-info">
                <h3>{role.name}</h3>
                <span className="role-code">{role.code}</span>
              </div>
              {role.isSystemRole && (
                <span className="system-badge">Sistema</span>
              )}
            </div>

            <div className="role-body">
              <p className="role-description">{role.description || 'Sin descripcion'}</p>

              <div className="role-meta">
                <div className="meta-item">
                  <span className="meta-label">Nivel:</span>
                  <span className="meta-value">{role.hierarchyLevel}</span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">Modulos:</span>
                  <span className="meta-value">{role.accessibleModules?.length || 0}</span>
                </div>
              </div>

              <div className="role-modules">
                {role.accessibleModules?.slice(0, 4).map(mod => (
                  <span key={mod} className="module-tag">{mod}</span>
                ))}
                {role.accessibleModules?.length > 4 && (
                  <span className="module-tag more">+{role.accessibleModules.length - 4}</span>
                )}
              </div>
            </div>

            <div className="role-actions">
              <button
                className="btn-icon"
                onClick={() => openPermissionsModal(role)}
                title="Ver permisos"
              >
                <span role="img" aria-label="permisos">🔐</span>
              </button>
              <button
                className="btn-icon"
                onClick={() => openEditModal(role)}
                title="Editar rol"
              >
                <span role="img" aria-label="editar">✏️</span>
              </button>
              <button
                className="btn-icon"
                onClick={() => handleDuplicateRole(role)}
                title="Duplicar rol"
              >
                <span role="img" aria-label="duplicar">📋</span>
              </button>
              {!role.isSystemRole && (
                <button
                  className="btn-icon btn-danger"
                  onClick={() => handleDeleteRole(role)}
                  title="Eliminar rol"
                >
                  <span role="img" aria-label="eliminar">🗑️</span>
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Modal Crear Rol */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal modal-large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Crear Nuevo Rol</h2>
              <button className="btn-close" onClick={() => setShowCreateModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <div className="form-group">
                  <label>Nombre del Rol *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ej: Supervisor de Area"
                  />
                </div>
                <div className="form-group">
                  <label>Codigo *</label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
                    placeholder="Ej: supervisor_area"
                  />
                  <small>Solo letras minusculas y guiones bajos</small>
                </div>
              </div>

              <div className="form-group">
                <label>Descripcion</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe las responsabilidades de este rol..."
                  rows={2}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Nivel de Jerarquia (0-99)</label>
                  <input
                    type="number"
                    min="0"
                    max="99"
                    value={formData.hierarchyLevel}
                    onChange={(e) => setFormData({ ...formData, hierarchyLevel: parseInt(e.target.value) || 0 })}
                  />
                  <small>Mayor numero = mas permisos</small>
                </div>
                <div className="form-group">
                  <label>Color</label>
                  <input
                    type="color"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Icono (emoji)</label>
                  <input
                    type="text"
                    value={formData.icon}
                    onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                    placeholder=""
                    maxLength={2}
                  />
                </div>
              </div>

              <div className="form-section">
                <h4>Modulos Accesibles</h4>
                <div className="modules-grid">
                  {availableModules.map(mod => (
                    <label key={mod.id} className="module-checkbox">
                      <input
                        type="checkbox"
                        checked={formData.accessibleModules.includes(mod.id)}
                        onChange={() => handleModuleToggle(mod.id)}
                      />
                      <span>{mod.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="form-section">
                <h4>Permisos por Modulo</h4>
                <div className="permissions-accordion">
                  {Object.entries(permissionLabels).map(([module, perms]) => (
                    <details key={module} className="permission-group">
                      <summary>{moduleLabels[module] || module}</summary>
                      <div className="permission-checkboxes">
                        {Object.entries(perms).map(([permKey, permLabel]) => (
                          <label key={permKey} className="permission-checkbox">
                            <input
                              type="checkbox"
                              checked={getPermissionValue(module, permKey)}
                              onChange={(e) => handlePermissionChange(module, permKey, e.target.checked)}
                            />
                            <span>{permLabel}</span>
                          </label>
                        ))}
                      </div>
                    </details>
                  ))}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowCreateModal(false)}>
                Cancelar
              </button>
              <button className="btn-primary" onClick={handleCreateRole}>
                Crear Rol
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Editar Rol */}
      {showEditModal && selectedRole && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal modal-large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Editar Rol: {selectedRole.name}</h2>
              <button className="btn-close" onClick={() => setShowEditModal(false)}>×</button>
            </div>
            <div className="modal-body">
              {selectedRole.isSystemRole && (
                <div className="alert alert-warning">
                  Este es un rol del sistema. Solo se pueden modificar la descripcion, color e icono.
                </div>
              )}

              <div className="form-row">
                <div className="form-group">
                  <label>Nombre del Rol</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    disabled={selectedRole.isSystemRole}
                  />
                </div>
                <div className="form-group">
                  <label>Codigo</label>
                  <input
                    type="text"
                    value={formData.code}
                    disabled
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Descripcion</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={2}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Nivel de Jerarquia</label>
                  <input
                    type="number"
                    min="0"
                    max="99"
                    value={formData.hierarchyLevel}
                    onChange={(e) => setFormData({ ...formData, hierarchyLevel: parseInt(e.target.value) || 0 })}
                    disabled={selectedRole.isSystemRole}
                  />
                </div>
                <div className="form-group">
                  <label>Color</label>
                  <input
                    type="color"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Icono</label>
                  <input
                    type="text"
                    value={formData.icon}
                    onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                    maxLength={2}
                  />
                </div>
              </div>

              {!selectedRole.isSystemRole && (
                <>
                  <div className="form-section">
                    <h4>Modulos Accesibles</h4>
                    <div className="modules-grid">
                      {availableModules.map(mod => (
                        <label key={mod.id} className="module-checkbox">
                          <input
                            type="checkbox"
                            checked={formData.accessibleModules.includes(mod.id)}
                            onChange={() => handleModuleToggle(mod.id)}
                          />
                          <span>{mod.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="form-section">
                    <h4>Permisos por Modulo</h4>
                    <div className="permissions-accordion">
                      {Object.entries(permissionLabels).map(([module, perms]) => (
                        <details key={module} className="permission-group">
                          <summary>{moduleLabels[module] || module}</summary>
                          <div className="permission-checkboxes">
                            {Object.entries(perms).map(([permKey, permLabel]) => (
                              <label key={permKey} className="permission-checkbox">
                                <input
                                  type="checkbox"
                                  checked={getPermissionValue(module, permKey)}
                                  onChange={(e) => handlePermissionChange(module, permKey, e.target.checked)}
                                />
                                <span>{permLabel}</span>
                              </label>
                            ))}
                          </div>
                        </details>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowEditModal(false)}>
                Cancelar
              </button>
              <button className="btn-primary" onClick={handleUpdateRole}>
                Guardar Cambios
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Ver Permisos */}
      {showPermissionsModal && selectedRole && (
        <div className="modal-overlay" onClick={() => setShowPermissionsModal(false)}>
          <div className="modal modal-large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                <span style={{ backgroundColor: selectedRole.color, padding: '4px 8px', borderRadius: '4px', marginRight: '8px' }}>
                  {selectedRole.icon || selectedRole.name.charAt(0)}
                </span>
                Permisos de {selectedRole.name}
              </h2>
              <button className="btn-close" onClick={() => setShowPermissionsModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="permissions-summary">
                <div className="summary-section">
                  <h4>Informacion General</h4>
                  <div className="summary-grid">
                    <div><strong>Codigo:</strong> {selectedRole.code}</div>
                    <div><strong>Nivel:</strong> {selectedRole.hierarchyLevel}</div>
                    <div><strong>Tipo:</strong> {selectedRole.isSystemRole ? 'Sistema' : 'Personalizado'}</div>
                  </div>
                </div>

                <div className="summary-section">
                  <h4>Modulos Accesibles ({selectedRole.accessibleModules?.length || 0})</h4>
                  <div className="modules-list">
                    {selectedRole.accessibleModules?.map(mod => (
                      <span key={mod} className="module-badge">{mod}</span>
                    ))}
                  </div>
                </div>

                <div className="summary-section">
                  <h4>Permisos Detallados</h4>
                  <div className="permissions-detail">
                    {Object.entries(selectedRole.permissions || {}).map(([module, perms]) => (
                      <div key={module} className="permission-module">
                        <h5>{moduleLabels[module] || module}</h5>
                        <div className="permission-items">
                          {Object.entries(perms as Record<string, boolean>).map(([key, value]) => (
                            <span key={key} className={`permission-item ${value ? 'granted' : 'denied'}`}>
                              {value ? '✓' : '✗'} {permissionLabels[module]?.[key] || key}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowPermissionsModal(false)}>
                Cerrar
              </button>
              {!selectedRole.isSystemRole && (
                <button className="btn-primary" onClick={() => { setShowPermissionsModal(false); openEditModal(selectedRole); }}>
                  Editar Permisos
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RoleManagement;
