import React, { useState, useEffect } from 'react';
import api from '../services/api';
import './UserManagement.css';

interface Company {
  _id: string;
  name: string;
  tax_id: string;
  email: string;
  phone: string;
  address: string;
}

interface UserCompany {
  _id: string;
  company: {
    _id: string;
    name: string;
    tax_id: string;
  };
  role: string;
  permissions: {
    canView: boolean;
    canEdit: boolean;
    canDelete: boolean;
    canManageUsers: boolean;
  };
  isActive: boolean;
  assignedAt: string;
}

interface User {
  _id: string;
  email: string;
  name: string;
  role: string;
  active: boolean;
  companies: UserCompany[];
  company?: {
    _id: string;
    name: string;
    tax_id: string;
  };
}

const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<string>('');
  const [selectedRole, setSelectedRole] = useState<string>('requester');
  const [permissions, setPermissions] = useState({
    canView: true,
    canEdit: false,
    canDelete: false,
    canManageUsers: false
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [showUserInfoModal, setShowUserInfoModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
  const [selectedUserCompany, setSelectedUserCompany] = useState<UserCompany | null>(null);
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());
  const [editUser, setEditUser] = useState({
    id: '',
    name: '',
    email: '',
    role: 'requester'
  });
  const [resetPasswordUser, setResetPasswordUser] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('');

  // Filtros y ordenamiento
  const [filterText, setFilterText] = useState('');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [filterCompanyCount, setFilterCompanyCount] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [newUser, setNewUser] = useState({
    email: '',
    name: '',
    password: '',
    role: 'requester',
    companyId: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [usersRes, companiesRes] = await Promise.all([
        api.get('/multi-companies/users'),
        api.get('/multi-companies/companies')
      ]);
      setUsers(usersRes.data);
      setCompanies(companiesRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAssignUser = async () => {
    if (!selectedUser || !selectedCompany) return;

    try {
      await api.post('/multi-companies/assign-user-company', {
        userId: selectedUser._id,
        companyId: selectedCompany,
        role: selectedRole,
        permissions
      });

      await fetchData();
      setShowAssignModal(false);
      setSelectedUser(null);
      setSelectedCompany('');
      setSelectedRole('requester');
      setPermissions({
        canView: true,
        canEdit: false,
        canDelete: false,
        canManageUsers: false
      });
      setSearchTerm('');
    } catch (error: any) {
      console.error('Error assigning user:', error);
      alert(error.response?.data?.error || 'Error al asignar usuario a empresa');
    }
  };

  const handleRemoveUserFromCompany = async (userId: string, companyId: string) => {
    if (!window.confirm('¿Está seguro de remover este usuario de la empresa?')) {
      return;
    }

    try {
      await api.post('/multi-companies/remove-user-company', {
        userId,
        companyId
      });

      await fetchData();
    } catch (error: any) {
      console.error('Error removing user:', error);
      alert(error.response?.data?.error || 'Error al remover usuario de empresa');
    }
  };

  const handleUpdatePermissions = async () => {
    if (!selectedUserCompany || !selectedUser) return;

    try {
      await api.put('/multi-companies/update-user-company-permissions', {
        userId: selectedUser._id,
        companyId: selectedUserCompany.company._id,
        role: selectedRole,
        permissions
      });

      await fetchData();
      setShowPermissionsModal(false);
      setSelectedUserCompany(null);
    } catch (error: any) {
      console.error('Error updating permissions:', error);
      alert(error.response?.data?.error || 'Error al actualizar permisos');
    }
  };

  const handleCreateUser = async () => {
    try {
      await api.post('/super-admin/create-user', newUser);

      await fetchData();
      setShowCreateModal(false);
      setNewUser({
        email: '',
        name: '',
        password: '',
        role: 'requester',
        companyId: ''
      });
    } catch (error: any) {
      console.error('Error creating user:', error);
      alert(error.response?.data?.error || 'Error al crear usuario');
    }
  };

  const openPermissionsModal = (user: User, userCompany: UserCompany) => {
    setSelectedUser(user);
    setSelectedUserCompany(userCompany);
    setSelectedRole(userCompany.role);
    setPermissions(userCompany.permissions);
    setShowPermissionsModal(true);
  };

  const openAssignModal = (user: User) => {
    setSelectedUser(user);
    setSelectedCompany('');
    setSelectedRole('requester');
    setPermissions({
      canView: true,
      canEdit: false,
      canDelete: false,
      canManageUsers: false
    });
    setSearchTerm('');
    setShowAssignModal(true);
  };

  const openUserInfoModal = (user: User) => {
    setSelectedUser(user);
    setShowUserInfoModal(true);
  };

  const toggleUserExpanded = (userId: string) => {
    setExpandedUsers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(userId)) {
        newSet.delete(userId);
      } else {
        newSet.add(userId);
      }
      return newSet;
    });
  };

  // Abrir modal de edición de usuario
  const openEditModal = (user: User) => {
    setEditUser({
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role
    });
    setShowEditModal(true);
  };

  // Editar información del usuario
  const handleEditUser = async () => {
    try {
      await api.put(`/multi-companies/edit-user/${editUser.id}`, {
        name: editUser.name,
        email: editUser.email,
        role: editUser.role
      });
      await fetchData();
      setShowEditModal(false);
      alert('Usuario actualizado exitosamente');
    } catch (error: any) {
      alert(error.response?.data?.error || 'Error al editar usuario');
    }
  };

  // Activar/desactivar usuario
  const handleToggleUserStatus = async (userId: string, userName: string, isActive: boolean) => {
    const action = isActive ? 'desactivar' : 'activar';
    if (!window.confirm(`¿Está seguro de ${action} al usuario ${userName}?`)) return;

    try {
      await api.patch(`/multi-companies/toggle-user-status/${userId}`);
      await fetchData();
      alert(`Usuario ${action === 'desactivar' ? 'desactivado' : 'activado'} exitosamente`);
    } catch (error: any) {
      alert(error.response?.data?.error || `Error al ${action} usuario`);
    }
  };

  // Eliminar usuario
  const handleDeleteUser = async (userId: string, userName: string) => {
    if (!window.confirm(`¿Está seguro de eliminar al usuario ${userName}?\n\nEsta acción desactivará el usuario y todas sus asignaciones a empresas.`)) return;

    try {
      await api.delete(`/multi-companies/delete-user/${userId}`);
      await fetchData();
      alert('Usuario eliminado exitosamente');
    } catch (error: any) {
      alert(error.response?.data?.error || 'Error al eliminar usuario');
    }
  };

  // Abrir modal de reset de contraseña
  const openResetPasswordModal = (user: User) => {
    setResetPasswordUser(user);
    setNewPassword('');
    setShowResetPasswordModal(true);
  };

  // Reiniciar contraseña de un usuario
  const handleResetPassword = async () => {
    if (!resetPasswordUser || !newPassword) return;

    if (newPassword.length < 6) {
      alert('La nueva contraseña debe tener al menos 6 caracteres');
      return;
    }

    try {
      await api.post(`/users/${resetPasswordUser._id}/reset-password`, { newPassword });
      alert(`Contraseña reiniciada exitosamente para ${resetPasswordUser.name}`);
      setShowResetPasswordModal(false);
      setResetPasswordUser(null);
      setNewPassword('');
    } catch (error: any) {
      alert(error.response?.data?.error || 'Error al reiniciar contraseña');
    }
  };

  // Función para normalizar texto (remover acentos/tildes)
  const normalizeText = (text: string): string => {
    return text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  };

  // Filtrar empresas por término de búsqueda (sin acentos)
  const filteredCompanies = companies.filter(company =>
    normalizeText(company.name).includes(normalizeText(searchTerm)) ||
    normalizeText(company.tax_id).includes(normalizeText(searchTerm))
  );

  // Filtrar y ordenar usuarios
  const filteredAndSortedUsers = users
    .filter(user => {
      // Filtro por texto (email o nombre) - sin acentos
      const matchesText = !filterText ||
        normalizeText(user.email).includes(normalizeText(filterText)) ||
        normalizeText(user.name).includes(normalizeText(filterText));

      // Filtro por rol
      const matchesRole = filterRole === 'all' || user.role === filterRole;

      // Filtro por número de empresas
      const companyCount = user.companies?.length || 0;
      let matchesCompanyCount = true;
      if (filterCompanyCount === 'none') {
        matchesCompanyCount = companyCount === 0;
      } else if (filterCompanyCount === 'one') {
        matchesCompanyCount = companyCount === 1;
      } else if (filterCompanyCount === 'multiple') {
        matchesCompanyCount = companyCount > 1;
      }

      return matchesText && matchesRole && matchesCompanyCount;
    })
    .sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'email':
          comparison = a.email.localeCompare(b.email);
          break;
        case 'role':
          comparison = a.role.localeCompare(b.role);
          break;
        case 'companies':
          comparison = (a.companies?.length || 0) - (b.companies?.length || 0);
          break;
        default:
          comparison = 0;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

  if (loading) {
    return <div className="loading">Cargando gestión de usuarios...</div>;
  }

  return (
    <div className="user-management">
      <div className="page-header">
        <h1>Gestión de Usuarios y Empresas</h1>
        <button
          className="btn-primary"
          onClick={() => setShowCreateModal(true)}
        >
          Crear Usuario
        </button>
      </div>

      {/* Filtros y ordenamiento */}
      <div className="filters-section">
        <div className="filters-row">
          <div className="filter-group">
            <label>Buscar:</label>
            <input
              type="text"
              placeholder="Email o nombre..."
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              className="filter-input"
            />
          </div>

          <div className="filter-group">
            <label>Rol:</label>
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="filter-select"
            >
              <option value="all">Todos</option>
              <option value="super_admin">Super Admin</option>
              <option value="admin">Admin</option>
              <option value="lawyer">Lawyer</option>
              <option value="requester">Requester</option>
            </select>
          </div>

          <div className="filter-group">
            <label>Empresas:</label>
            <select
              value={filterCompanyCount}
              onChange={(e) => setFilterCompanyCount(e.target.value)}
              className="filter-select"
            >
              <option value="all">Todas</option>
              <option value="none">Sin empresas</option>
              <option value="one">1 empresa</option>
              <option value="multiple">Múltiples</option>
            </select>
          </div>

          <div className="filter-group">
            <label>Ordenar por:</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="filter-select"
            >
              <option value="name">Nombre</option>
              <option value="email">Email</option>
              <option value="role">Rol</option>
              <option value="companies">N° Empresas</option>
            </select>
          </div>

          <div className="filter-group">
            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="btn-sort"
              title={sortOrder === 'asc' ? 'Orden ascendente' : 'Orden descendente'}
            >
              {sortOrder === 'asc' ? '↑' : '↓'}
            </button>
          </div>

          <div className="filter-group">
            <button
              onClick={() => {
                setFilterText('');
                setFilterRole('all');
                setFilterCompanyCount('all');
                setSortBy('name');
                setSortOrder('asc');
              }}
              className="btn-clear-filters"
            >
              Limpiar
            </button>
          </div>
        </div>

        <div className="results-count">
          Mostrando {filteredAndSortedUsers.length} de {users.length} usuarios
        </div>
      </div>

      <div className="users-list">
        {filteredAndSortedUsers.map((user) => (
          <div key={user._id} className="user-row">
            <div className="user-main-info">
              <div className="user-email-section">
                <span className="user-email">{user.email}</span>
                <span className="user-name-visible">{user.name}</span>
              </div>
              <span className={`role-badge ${user.role}`}>{user.role}</span>
              <span className={`status-badge ${user.active ? 'active' : 'inactive'}`}>
                {user.active ? 'Activo' : 'Inactivo'}
              </span>
              <div className="user-actions">
                <button
                  className="btn-view-info"
                  onClick={() => openUserInfoModal(user)}
                  title="Ver información del usuario"
                >
                  👁️
                </button>
                <button
                  className="btn-edit"
                  onClick={() => openEditModal(user)}
                  title="Editar usuario"
                >
                  ✎
                </button>
                <button
                  className="btn-reset-password"
                  onClick={() => openResetPasswordModal(user)}
                  title="Reiniciar contraseña"
                >
                  🔑
                </button>
                <button
                  className={`btn-toggle-status ${user.active ? 'deactivate' : 'activate'}`}
                  onClick={() => handleToggleUserStatus(user._id, user.name, user.active)}
                  title={user.active ? 'Desactivar usuario' : 'Activar usuario'}
                >
                  {user.active ? '🔒' : '🔓'}
                </button>
                <button
                  className="btn-delete"
                  onClick={() => handleDeleteUser(user._id, user.name)}
                  title="Eliminar usuario"
                >
                  🗑️
                </button>
                <button
                  className="btn-view-companies"
                  onClick={() => toggleUserExpanded(user._id)}
                  title={expandedUsers.has(user._id) ? 'Ocultar empresas' : 'Ver empresas'}
                >
                  <span className={`toggle-arrow ${expandedUsers.has(user._id) ? 'expanded' : ''}`}>▶</span>
                  Empresas ({user.companies?.length || 0})
                </button>
                <button
                  className="btn-small btn-primary"
                  onClick={() => openAssignModal(user)}
                >
                  Asignar
                </button>
              </div>
            </div>

            {expandedUsers.has(user._id) && (
              <div className="user-companies-expanded">
                {!user.companies || user.companies.length === 0 ? (
                  <p className="no-companies">Sin empresas asignadas</p>
                ) : (
                  user.companies.map((userCompany) => (
                    <div key={userCompany._id} className="company-row">
                      <div className="company-name">
                        <strong>{userCompany.company.name}</strong>
                        <span className="tax-id">({userCompany.company.tax_id})</span>
                      </div>
                      <span className={`role-badge-mini ${userCompany.role}`}>{userCompany.role}</span>
                      <div className="perms">
                        <span className={userCompany.permissions.canView ? 'on' : 'off'} title="Ver">V</span>
                        <span className={userCompany.permissions.canEdit ? 'on' : 'off'} title="Editar">E</span>
                        <span className={userCompany.permissions.canDelete ? 'on' : 'off'} title="Eliminar">D</span>
                        <span className={userCompany.permissions.canManageUsers ? 'on' : 'off'} title="Gestionar">G</span>
                      </div>
                      <div className="actions-mini">
                        <button onClick={() => openPermissionsModal(user, userCompany)} title="Editar">✎</button>
                        <button onClick={() => handleRemoveUserFromCompany(user._id, userCompany.company._id)} title="Eliminar">✕</button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Modal para asignar usuario a empresa */}
      {showAssignModal && selectedUser && (
        <div className="modal-overlay" onClick={() => { setShowAssignModal(false); setSelectedUser(null); setSearchTerm(''); }}>
          <div className="modal modal-assign modal-content" onClick={(e) => e.stopPropagation()}>
            <button
              className="modal-close-btn"
              onClick={() => {
                setShowAssignModal(false);
                setSelectedUser(null);
                setSearchTerm('');
              }}
              title="Cerrar"
            >
              &times;
            </button>
            <div className="modal-header-fixed">
              <h3>Asignar Usuario a Empresa</h3>
              <p><strong>Usuario:</strong> {selectedUser.name} ({selectedUser.email})</p>
            </div>

            <div className="modal-body-scroll">
              <div className="form-group compact">
                <label>Buscar Empresa:</label>
                <input
                  type="text"
                  placeholder="Buscar por nombre o NIT/RUC..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="search-input"
                />
              </div>

              <div className="form-group compact">
                <label>Seleccionar Empresa:</label>
                <div className="company-list">
                  {filteredCompanies.length === 0 ? (
                    <p className="no-results">No se encontraron empresas</p>
                  ) : (
                    <select
                      value={selectedCompany}
                      onChange={(e) => setSelectedCompany(e.target.value)}
                      size={Math.min(filteredCompanies.length, 4)}
                    >
                      <option value="">Seleccionar empresa...</option>
                      {filteredCompanies.map((company) => (
                        <option key={company._id} value={company._id}>
                          {company.name} - {company.tax_id}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              <div className="form-group compact">
                <label>Rol en la Empresa:</label>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                >
                  <option value="requester">Usuario</option>
                  <option value="lawyer">Abogado</option>
                  <option value="admin">Administrador</option>
                  <option value="super_admin">Super Admin</option>
                  <option value="talento_humano">Talento Humano</option>
                  <option value="colaboradores">Colaboradores</option>
                </select>
              </div>

              <div className="form-group compact">
                <label>Permisos:</label>
                <div className="permissions-grid-compact">
                  <label>
                    <input
                      type="checkbox"
                      checked={permissions.canView}
                      onChange={(e) => setPermissions({...permissions, canView: e.target.checked})}
                    />
                    Ver
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={permissions.canEdit}
                      onChange={(e) => setPermissions({...permissions, canEdit: e.target.checked})}
                    />
                    Editar
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={permissions.canDelete}
                      onChange={(e) => setPermissions({...permissions, canDelete: e.target.checked})}
                    />
                    Eliminar
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={permissions.canManageUsers}
                      onChange={(e) => setPermissions({...permissions, canManageUsers: e.target.checked})}
                    />
                    Gestionar Usuarios
                  </label>
                </div>
              </div>
            </div>

            <div className="modal-actions-fixed">
              <button
                className="btn-secondary"
                onClick={() => {
                  setShowAssignModal(false);
                  setSelectedUser(null);
                  setSearchTerm('');
                }}
              >
                Cancelar
              </button>
              <button
                className="btn-primary"
                onClick={handleAssignUser}
                disabled={!selectedCompany}
              >
                Asignar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para editar permisos */}
      {showPermissionsModal && selectedUserCompany && selectedUser && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Editar Permisos</h3>
            <p><strong>Usuario:</strong> {selectedUser.name}</p>
            <p><strong>Empresa:</strong> {selectedUserCompany.company.name}</p>

            <div className="form-group">
              <label>Rol en la Empresa:</label>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
              >
                <option value="requester">Usuario</option>
                <option value="lawyer">Abogado</option>
                <option value="admin">Administrador</option>
                <option value="super_admin">Super Admin</option>
                <option value="talento_humano">Talento Humano</option>
                <option value="colaboradores">Colaboradores</option>
              </select>
            </div>

            <div className="form-group">
              <label>Permisos:</label>
              <div className="permissions-grid">
                <label>
                  <input
                    type="checkbox"
                    checked={permissions.canView}
                    onChange={(e) => setPermissions({...permissions, canView: e.target.checked})}
                  />
                  Ver
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={permissions.canEdit}
                    onChange={(e) => setPermissions({...permissions, canEdit: e.target.checked})}
                  />
                  Editar
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={permissions.canDelete}
                    onChange={(e) => setPermissions({...permissions, canDelete: e.target.checked})}
                  />
                  Eliminar
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={permissions.canManageUsers}
                    onChange={(e) => setPermissions({...permissions, canManageUsers: e.target.checked})}
                  />
                  Gestionar Usuarios
                </label>
              </div>
            </div>

            <div className="modal-actions">
              <button
                className="btn-secondary"
                onClick={() => {
                  setShowPermissionsModal(false);
                  setSelectedUserCompany(null);
                  setSelectedUser(null);
                }}
              >
                Cancelar
              </button>
              <button
                className="btn-primary"
                onClick={handleUpdatePermissions}
              >
                Actualizar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para crear usuario */}
      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Crear Nuevo Usuario</h3>

            <div className="form-group">
              <label>Nombre:</label>
              <input
                type="text"
                value={newUser.name}
                onChange={(e) => setNewUser({...newUser, name: e.target.value})}
                required
              />
            </div>

            <div className="form-group">
              <label>Email:</label>
              <input
                type="email"
                value={newUser.email}
                onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                required
              />
            </div>

            <div className="form-group">
              <label>Contraseña:</label>
              <input
                type="password"
                value={newUser.password}
                onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                required
              />
            </div>

            <div className="form-group">
              <label>Rol:</label>
              <select
                value={newUser.role}
                onChange={(e) => setNewUser({...newUser, role: e.target.value})}
              >
                <option value="requester">Usuario</option>
                <option value="lawyer">Abogado</option>
                <option value="admin">Administrador</option>
                <option value="super_admin">Super Admin</option>
                <option value="talento_humano">Talento Humano</option>
                <option value="colaboradores">Colaboradores</option>
              </select>
            </div>

            <div className="form-group">
              <label>Empresa (opcional):</label>
              <select
                value={newUser.companyId}
                onChange={(e) => setNewUser({...newUser, companyId: e.target.value})}
              >
                <option value="">Sin empresa</option>
                {companies.map((company) => (
                  <option key={company._id} value={company._id}>
                    {company.name} - {company.tax_id}
                  </option>
                ))}
              </select>
            </div>

            <div className="modal-actions">
              <button
                className="btn-secondary"
                onClick={() => setShowCreateModal(false)}
              >
                Cancelar
              </button>
              <button
                className="btn-primary"
                onClick={handleCreateUser}
                disabled={!newUser.name || !newUser.email || !newUser.password}
              >
                Crear Usuario
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para ver información del usuario */}
      {showUserInfoModal && selectedUser && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Información del Usuario</h3>

            <div className="user-info-details">
              <div className="info-row">
                <span className="info-label">Nombre Completo:</span>
                <span className="info-value">{selectedUser.name}</span>
              </div>

              <div className="info-row">
                <span className="info-label">Email:</span>
                <span className="info-value">{selectedUser.email}</span>
              </div>

              <div className="info-row">
                <span className="info-label">Rol del Sistema:</span>
                <span className={`role-badge ${selectedUser.role}`}>{selectedUser.role}</span>
              </div>

              <div className="info-row">
                <span className="info-label">Estado:</span>
                <span className={`status-badge ${selectedUser.active ? 'active' : 'inactive'}`}>
                  {selectedUser.active ? 'Activo' : 'Inactivo'}
                </span>
              </div>

              <div className="info-row">
                <span className="info-label">Empresas Asignadas:</span>
                <span className="info-value">{selectedUser.companies?.length || 0}</span>
              </div>

              {selectedUser.companies && selectedUser.companies.length > 0 && (
                <div className="info-section">
                  <h4>Empresas y Roles:</h4>
                  <div className="companies-info-list">
                    {selectedUser.companies.map((userCompany) => (
                      <div key={userCompany._id} className="company-info-item">
                        <div className="company-info-header">
                          <strong>{userCompany.company.name}</strong>
                          <span className={`role-badge-mini ${userCompany.role}`}>{userCompany.role}</span>
                        </div>
                        <div className="company-info-details">
                          <span className="tax-id">NIT/RUC: {userCompany.company.tax_id}</span>
                          <div className="perms">
                            <span className={userCompany.permissions.canView ? 'on' : 'off'} title="Ver">V</span>
                            <span className={userCompany.permissions.canEdit ? 'on' : 'off'} title="Editar">E</span>
                            <span className={userCompany.permissions.canDelete ? 'on' : 'off'} title="Eliminar">D</span>
                            <span className={userCompany.permissions.canManageUsers ? 'on' : 'off'} title="Gestionar">G</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="modal-actions">
              <button
                className="btn-secondary"
                onClick={() => {
                  setShowUserInfoModal(false);
                  setSelectedUser(null);
                }}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para editar usuario */}
      {showEditModal && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Editar Usuario</h2>
            <div className="modal-body">
              <div className="form-group">
                <label>Nombre:</label>
                <input
                  type="text"
                  value={editUser.name}
                  onChange={(e) => setEditUser({ ...editUser, name: e.target.value })}
                  placeholder="Nombre completo del usuario"
                />
              </div>

              <div className="form-group">
                <label>Email:</label>
                <input
                  type="email"
                  value={editUser.email}
                  onChange={(e) => setEditUser({ ...editUser, email: e.target.value })}
                  placeholder="correo@ejemplo.com"
                />
              </div>

              <div className="form-group">
                <label>Rol:</label>
                <select
                  value={editUser.role}
                  onChange={(e) => setEditUser({ ...editUser, role: e.target.value })}
                >
                  <option value="requester">Usuario</option>
                  <option value="lawyer">Abogado</option>
                  <option value="admin">Administrador</option>
                  <option value="super_admin">Super Admin</option>
                  <option value="talento_humano">Talento Humano</option>
                  <option value="colaboradores">Colaboradores</option>
                </select>
              </div>
            </div>

            <div className="modal-actions">
              <button
                className="btn-secondary"
                onClick={() => setShowEditModal(false)}
              >
                Cancelar
              </button>
              <button
                className="btn-primary"
                onClick={handleEditUser}
              >
                Guardar Cambios
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para reiniciar contraseña */}
      {showResetPasswordModal && resetPasswordUser && (
        <div className="modal-overlay" onClick={() => setShowResetPasswordModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button
              className="modal-close-btn"
              onClick={() => {
                setShowResetPasswordModal(false);
                setResetPasswordUser(null);
                setNewPassword('');
              }}
              title="Cerrar"
            >
              &times;
            </button>
            <h2>Reiniciar Contraseña</h2>
            <div className="modal-body">
              <p><strong>Usuario:</strong> {resetPasswordUser.name} ({resetPasswordUser.email})</p>

              <div className="form-group">
                <label>Nueva Contraseña:</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimo 6 caracteres"
                />
              </div>
            </div>

            <div className="modal-actions">
              <button
                className="btn-secondary"
                onClick={() => {
                  setShowResetPasswordModal(false);
                  setResetPasswordUser(null);
                  setNewPassword('');
                }}
              >
                Cancelar
              </button>
              <button
                className="btn-primary"
                onClick={handleResetPassword}
                disabled={!newPassword || newPassword.length < 6}
              >
                Reiniciar Contraseña
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
