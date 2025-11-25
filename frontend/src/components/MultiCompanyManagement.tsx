import React, { useState, useEffect } from 'react';
import api from '../services/api';
import './MultiCompanyManagement.css';

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
}

const MultiCompanyManagement: React.FC = () => {
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
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [selectedUserCompany, setSelectedUserCompany] = useState<UserCompany | null>(null);

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
    } catch (error) {
      console.error('Error assigning user:', error);
    }
  };

  const handleRemoveUser = async (userId: string, companyId: string) => {
    try {
      await api.post('/multi-companies/remove-user-company', {
        userId,
        companyId
      });
      
      await fetchData();
    } catch (error) {
      console.error('Error removing user:', error);
    }
  };

  const handleUpdatePermissions = async () => {
    if (!selectedUserCompany) return;

    try {
      await api.put('/multi-companies/update-user-company-permissions', {
        userId: selectedUserCompany.company._id,
        companyId: selectedUserCompany.company._id,
        role: selectedRole,
        permissions
      });
      
      await fetchData();
      setShowPermissionsModal(false);
      setSelectedUserCompany(null);
    } catch (error) {
      console.error('Error updating permissions:', error);
    }
  };

  const openPermissionsModal = (userCompany: UserCompany) => {
    setSelectedUserCompany(userCompany);
    setSelectedRole(userCompany.role);
    setPermissions(userCompany.permissions);
    setShowPermissionsModal(true);
  };

  if (loading) {
    return <div className="loading">Cargando gestión de múltiples empresas...</div>;
  }

  return (
    <div className="multi-company-management">
      <div className="page-header">
        <h1>Gestión de Múltiples Empresas por Usuario</h1>
        <button 
          className="btn-primary"
          onClick={() => setShowAssignModal(true)}
        >
          Asignar Usuario a Empresa
        </button>
      </div>

      <div className="users-grid">
        {users.map((user) => (
          <div key={user._id} className="user-card">
            <div className="user-info">
              <h3>{user.name}</h3>
              <p><strong>Email:</strong> {user.email}</p>
              <p><strong>Rol Global:</strong> <span className={`role-badge ${user.role}`}>{user.role}</span></p>
              <p><strong>Empresas Asignadas:</strong> {user.companies.length}</p>
            </div>
            
            <div className="user-companies">
              <h4>Empresas:</h4>
              {user.companies.length === 0 ? (
                <p className="no-companies">Sin empresas asignadas</p>
              ) : (
                user.companies.map((userCompany) => (
                  <div key={userCompany._id} className="company-assignment">
                    <div className="company-info">
                      <strong>{userCompany.company.name}</strong>
                      <span className="company-tax">({userCompany.company.tax_id})</span>
                      <span className={`role-badge ${userCompany.role}`}>{userCompany.role}</span>
                    </div>
                    <div className="permissions-info">
                      <span className={`permission ${userCompany.permissions.canView ? 'active' : ''}`}>Ver</span>
                      <span className={`permission ${userCompany.permissions.canEdit ? 'active' : ''}`}>Editar</span>
                      <span className={`permission ${userCompany.permissions.canDelete ? 'active' : ''}`}>Eliminar</span>
                      <span className={`permission ${userCompany.permissions.canManageUsers ? 'active' : ''}`}>Gestionar</span>
                    </div>
                    <div className="assignment-actions">
                      <button 
                        className="btn-small btn-secondary"
                        onClick={() => openPermissionsModal(userCompany)}
                      >
                        Editar Permisos
                      </button>
                      <button 
                        className="btn-small btn-danger"
                        onClick={() => handleRemoveUser(user._id, userCompany.company._id)}
                      >
                        Remover
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Modal para asignar usuario a empresa */}
      {showAssignModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Asignar Usuario a Empresa</h3>
            
            <div className="form-group">
              <label>Usuario:</label>
              <select 
                value={selectedUser?._id || ''} 
                onChange={(e) => {
                  const user = users.find(u => u._id === e.target.value);
                  setSelectedUser(user || null);
                }}
              >
                <option value="">Seleccionar usuario...</option>
                {users.map((user) => (
                  <option key={user._id} value={user._id}>
                    {user.name} ({user.email})
                  </option>
                ))}
              </select>
            </div>
            
            <div className="form-group">
              <label>Empresa:</label>
              <select 
                value={selectedCompany} 
                onChange={(e) => setSelectedCompany(e.target.value)}
              >
                <option value="">Seleccionar empresa...</option>
                {companies.map((company) => (
                  <option key={company._id} value={company._id}>
                    {company.name} - {company.tax_id}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="form-group">
              <label>Rol en la Empresa:</label>
              <select 
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
              >
                <option value="requester">Usuario</option>
                <option value="lawyer">Abogado</option>
                <option value="admin">Administrador</option>
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
                onClick={() => setShowAssignModal(false)}
              >
                Cancelar
              </button>
              <button 
                className="btn-primary"
                onClick={handleAssignUser}
                disabled={!selectedUser || !selectedCompany}
              >
                Asignar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para editar permisos */}
      {showPermissionsModal && selectedUserCompany && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Editar Permisos</h3>
            <p><strong>Usuario:</strong> {selectedUserCompany.company.name}</p>
            
            <div className="form-group">
              <label>Rol en la Empresa:</label>
              <select 
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
              >
                <option value="requester">Usuario</option>
                <option value="lawyer">Abogado</option>
                <option value="admin">Administrador</option>
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
                onClick={() => setShowPermissionsModal(false)}
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
    </div>
  );
};

export default MultiCompanyManagement;

