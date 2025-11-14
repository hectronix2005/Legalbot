import React, { useState, useEffect } from 'react';
import api from '../services/api';
import './CompanyUserManagement.css';

interface Company {
  _id: string;
  name: string;
  tax_id: string;
  email: string;
  phone: string;
  address: string;
}

interface User {
  _id: string;
  name: string;
  email: string;
  role: string;
}

interface CompanyUser {
  _id: string;
  company: Company;
  user: User;
  role: string;
  permissions: {
    canView: boolean;
    canEdit: boolean;
    canDelete: boolean;
    canManageUsers: boolean;
    canManageContracts: boolean;
    canManageTemplates: boolean;
  };
  isActive: boolean;
  assignedAt: string;
  assignedBy: User;
}

const CompanyUserManagement: React.FC = () => {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [companyUsers, setCompanyUsers] = useState<CompanyUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedRelation, setSelectedRelation] = useState<CompanyUser | null>(null);
  const [newAssignment, setNewAssignment] = useState({
    companyId: '',
    userId: '',
    role: 'requester',
    permissions: {
      canView: true,
      canEdit: false,
      canDelete: false,
      canManageUsers: false,
      canManageContracts: false,
      canManageTemplates: false
    }
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [companiesRes, usersRes, relationsRes] = await Promise.all([
        api.get('/company-users/companies'),
        api.get('/company-users/users'),
        api.get('/company-users/relations')
      ]);
      
      setCompanies(companiesRes.data);
      setUsers(usersRes.data);
      setCompanyUsers(relationsRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAssignUser = async () => {
    try {
      await api.post('/company-users/assign', newAssignment);
      await fetchData();
      setShowAssignModal(false);
      setNewAssignment({
        companyId: '',
        userId: '',
        role: 'requester',
        permissions: {
          canView: true,
          canEdit: false,
          canDelete: false,
          canManageUsers: false,
          canManageContracts: false,
          canManageTemplates: false
        }
      });
    } catch (error) {
      console.error('Error assigning user:', error);
    }
  };

  const handleEditRelation = (relation: CompanyUser) => {
    setSelectedRelation(relation);
    setShowEditModal(true);
  };

  const handleUpdateRelation = async () => {
    if (!selectedRelation) return;
    
    try {
      await api.put(`/company-users/update-permissions/${selectedRelation._id}`, {
        role: selectedRelation.role,
        permissions: selectedRelation.permissions
      });
      await fetchData();
      setShowEditModal(false);
      setSelectedRelation(null);
    } catch (error) {
      console.error('Error updating relation:', error);
    }
  };

  const handleRemoveRelation = async (relationId: string) => {
    if (!window.confirm('¿Estás seguro de que quieres remover esta relación?')) return;
    
    try {
      await api.delete(`/company-users/remove/${relationId}`);
      await fetchData();
    } catch (error) {
      console.error('Error removing relation:', error);
    }
  };

  const updatePermission = (permission: string, value: boolean) => {
    if (!selectedRelation) return;
    
    setSelectedRelation({
      ...selectedRelation,
      permissions: {
        ...selectedRelation.permissions,
        [permission]: value
      }
    });
  };

  if (loading) {
    return <div className="loading">Cargando relaciones empresa-usuario...</div>;
  }

  return (
    <div className="company-user-management">
      <div className="page-header">
        <h1>Gestión de Relaciones Empresa-Usuario</h1>
        <button 
          className="btn-primary"
          onClick={() => setShowAssignModal(true)}
        >
          Asignar Usuario a Empresa
        </button>
      </div>

      <div className="relations-list">
        {companyUsers.length === 0 ? (
          <div className="empty-state">
            <h3>No hay relaciones</h3>
            <p>Asigna usuarios a empresas para comenzar</p>
          </div>
        ) : (
          companyUsers.map((relation) => (
            <div key={relation._id} className="relation-card">
              <div className="relation-info">
                <h3>{relation.user.name}</h3>
                <p><strong>Email:</strong> {relation.user.email}</p>
                <p><strong>Empresa:</strong> {relation.company.name}</p>
                <p><strong>Rol:</strong> <span className={`role-badge role-${relation.role}`}>{relation.role}</span></p>
                <p><strong>Asignado:</strong> {new Date(relation.assignedAt).toLocaleDateString()}</p>
              </div>
              
              <div className="permissions-info">
                <h4>Permisos:</h4>
                <div className="permissions-grid">
                  {Object.entries(relation.permissions).map(([key, value]) => (
                    <span key={key} className={`permission ${value ? 'granted' : 'denied'}`}>
                      {key.replace('can', '').replace(/([A-Z])/g, ' $1').trim()}
                    </span>
                  ))}
                </div>
              </div>
              
              <div className="relation-actions">
                <button 
                  className="btn-secondary"
                  onClick={() => handleEditRelation(relation)}
                >
                  Editar
                </button>
                <button 
                  className="btn-danger"
                  onClick={() => handleRemoveRelation(relation._id)}
                >
                  Remover
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal para asignar usuario */}
      {showAssignModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Asignar Usuario a Empresa</h3>
            
            <div className="form-group">
              <label>Empresa:</label>
              <select 
                value={newAssignment.companyId}
                onChange={(e) => setNewAssignment({...newAssignment, companyId: e.target.value})}
                required
              >
                <option value="">Seleccionar empresa</option>
                {companies.map(company => (
                  <option key={company._id} value={company._id}>
                    {company.name} - {company.tax_id}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="form-group">
              <label>Usuario:</label>
              <select 
                value={newAssignment.userId}
                onChange={(e) => setNewAssignment({...newAssignment, userId: e.target.value})}
                required
              >
                <option value="">Seleccionar usuario</option>
                {users.map(user => (
                  <option key={user._id} value={user._id}>
                    {user.name} - {user.email}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="form-group">
              <label>Rol:</label>
              <select
                value={newAssignment.role}
                onChange={(e) => setNewAssignment({...newAssignment, role: e.target.value})}
                required
              >
                <option value="requester">Solicitante</option>
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
                {Object.entries(newAssignment.permissions).map(([key, value]) => (
                  <label key={key} className="permission-checkbox">
                    <input 
                      type="checkbox"
                      checked={value}
                      onChange={(e) => setNewAssignment({
                        ...newAssignment,
                        permissions: {
                          ...newAssignment.permissions,
                          [key]: e.target.checked
                        }
                      })}
                    />
                    {key.replace('can', '').replace(/([A-Z])/g, ' $1').trim()}
                  </label>
                ))}
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
                disabled={!newAssignment.companyId || !newAssignment.userId}
              >
                Asignar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para editar relación */}
      {showEditModal && selectedRelation && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Editar Relación</h3>
            
            <div className="form-group">
              <label>Usuario:</label>
              <p>{selectedRelation.user.name} - {selectedRelation.user.email}</p>
            </div>
            
            <div className="form-group">
              <label>Empresa:</label>
              <p>{selectedRelation.company.name}</p>
            </div>
            
            <div className="form-group">
              <label>Rol:</label>
              <select
                value={selectedRelation.role}
                onChange={(e) => setSelectedRelation({...selectedRelation, role: e.target.value})}
                required
              >
                <option value="requester">Solicitante</option>
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
                {Object.entries(selectedRelation.permissions).map(([key, value]) => (
                  <label key={key} className="permission-checkbox">
                    <input 
                      type="checkbox"
                      checked={value}
                      onChange={(e) => updatePermission(key, e.target.checked)}
                    />
                    {key.replace('can', '').replace(/([A-Z])/g, ' $1').trim()}
                  </label>
                ))}
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
                onClick={handleUpdateRelation}
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

export default CompanyUserManagement;
