import React, { useState, useEffect } from 'react';
import api from '../services/api';
import './Companies.css';

interface Company {
  _id: string;
  name: string;
  tax_id?: string;
  email: string;
  phone: string;
  address: string;
  createdAt: string;
}

const Companies: React.FC = () => {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [filteredCompanies, setFilteredCompanies] = useState<Company[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [editCompany, setEditCompany] = useState({
    name: '',
    tax_id: '',
    email: '',
    phone: '',
    address: ''
  });
  const [newCompany, setNewCompany] = useState({
    name: '',
    tax_id: '',
    email: '',
    phone: '',
    address: ''
  });

  useEffect(() => {
    fetchCompanies();
  }, []);

  useEffect(() => {
    // Filtrar empresas por nombre
    if (searchTerm.trim() === '') {
      setFilteredCompanies(companies);
    } else {
      const filtered = companies.filter(company =>
        company.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (company.tax_id && company.tax_id.toLowerCase().includes(searchTerm.toLowerCase()))
      );
      setFilteredCompanies(filtered);
    }
  }, [searchTerm, companies]);

  const fetchCompanies = async () => {
    try {
      const response = await api.get('/companies');
      setCompanies(response.data);
      setFilteredCompanies(response.data);
    } catch (error) {
      console.error('Error fetching companies:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCompany = async () => {
    try {
      await api.post('/companies', newCompany);
      await fetchCompanies();
      setShowCreateModal(false);
      setNewCompany({
        name: '',
        tax_id: '',
        email: '',
        phone: '',
        address: ''
      });
    } catch (error) {
      console.error('Error creating company:', error);
    }
  };

  const handleViewCompany = (company: Company) => {
    setSelectedCompany(company);
    setShowViewModal(true);
  };

  const handleEditClick = (company: Company) => {
    setEditCompany({
      name: company.name,
      tax_id: company.tax_id || '',
      email: company.email,
      phone: company.phone,
      address: company.address
    });
    setSelectedCompany(company);
    setShowEditModal(true);
  };

  const handleEditCompany = async () => {
    if (!selectedCompany) return;

    try {
      await api.put(`/companies/${selectedCompany._id}`, editCompany);
      await fetchCompanies();
      setShowEditModal(false);
      setSelectedCompany(null);
    } catch (error) {
      console.error('Error editing company:', error);
    }
  };

  const handleDeleteCompany = async (companyId: string) => {
    if (!window.confirm('¿Está seguro de que desea eliminar esta empresa?')) {
      return;
    }

    try {
      await api.delete(`/companies/${companyId}`);
      await fetchCompanies();
    } catch (error) {
      console.error('Error deleting company:', error);
      alert('Error al eliminar la empresa. Puede que tenga contratos o plantillas asociadas.');
    }
  };

  if (loading) {
    return <div className="loading">Cargando empresas...</div>;
  }

  return (
    <div className="companies">
      <div className="page-header">
        <h1>Gestión de Empresas</h1>
        <button
          className="btn-primary"
          onClick={() => setShowCreateModal(true)}
        >
          Nueva Empresa
        </button>
      </div>

      <div className="filter-section">
        <input
          type="text"
          className="search-input"
          placeholder="Buscar por nombre o NIT..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <span className="results-count">
          {filteredCompanies.length} {filteredCompanies.length === 1 ? 'empresa' : 'empresas'}
        </span>
      </div>

      {filteredCompanies.length === 0 ? (
        <div className="empty-state">
          <h3>{companies.length === 0 ? 'No hay empresas' : 'No se encontraron empresas'}</h3>
          <p>{companies.length === 0 ? 'Agrega tu primera empresa para comenzar' : 'Intenta con otro término de búsqueda'}</p>
        </div>
      ) : (
        <div className="companies-table-container">
          <table className="companies-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>NIT</th>
                <th>Email</th>
                <th>Teléfono</th>
                <th>Dirección</th>
                <th>Fecha Registro</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredCompanies.map((company) => (
                <tr key={company._id}>
                  <td className="company-name">{company.name}</td>
                  <td>{company.tax_id || 'N/A'}</td>
                  <td>{company.email}</td>
                  <td>{company.phone}</td>
                  <td className="company-address">{company.address}</td>
                  <td>{new Date(company.createdAt).toLocaleDateString()}</td>
                  <td className="actions-cell">
                    <button
                      className="btn-icon btn-view"
                      onClick={() => handleViewCompany(company)}
                      title="Ver detalles"
                    >
                      👁️
                    </button>
                    <button
                      className="btn-icon btn-edit"
                      onClick={() => handleEditClick(company)}
                      title="Editar"
                    >
                      ✏️
                    </button>
                    <button
                      className="btn-icon btn-delete"
                      onClick={() => handleDeleteCompany(company._id)}
                      title="Eliminar"
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal para crear empresa */}
      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Crear Nueva Empresa</h3>

            <div className="form-group">
              <label>Nombre de la Empresa:</label>
              <input
                type="text"
                value={newCompany.name}
                onChange={(e) => setNewCompany({...newCompany, name: e.target.value})}
                required
              />
            </div>

            <div className="form-group">
              <label>NIT:</label>
              <input
                type="text"
                value={newCompany.tax_id}
                onChange={(e) => setNewCompany({...newCompany, tax_id: e.target.value})}
                required
              />
            </div>

            <div className="form-group">
              <label>Email:</label>
              <input
                type="email"
                value={newCompany.email}
                onChange={(e) => setNewCompany({...newCompany, email: e.target.value})}
                required
              />
            </div>

            <div className="form-group">
              <label>Teléfono:</label>
              <input
                type="text"
                value={newCompany.phone}
                onChange={(e) => setNewCompany({...newCompany, phone: e.target.value})}
                required
              />
            </div>

            <div className="form-group">
              <label>Dirección:</label>
              <input
                type="text"
                value={newCompany.address}
                onChange={(e) => setNewCompany({...newCompany, address: e.target.value})}
                required
              />
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
                onClick={handleCreateCompany}
                disabled={!newCompany.name || !newCompany.tax_id || !newCompany.email}
              >
                Crear Empresa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para ver empresa */}
      {showViewModal && selectedCompany && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Detalles de la Empresa</h3>

            <div className="view-details">
              <p><strong>Nombre:</strong> {selectedCompany.name}</p>
              <p><strong>NIT:</strong> {selectedCompany.tax_id || 'N/A'}</p>
              <p><strong>Email:</strong> {selectedCompany.email}</p>
              <p><strong>Teléfono:</strong> {selectedCompany.phone}</p>
              <p><strong>Dirección:</strong> {selectedCompany.address}</p>
              <p><strong>Fecha de Registro:</strong> {new Date(selectedCompany.createdAt).toLocaleDateString()}</p>
            </div>

            <div className="modal-actions">
              <button
                className="btn-primary"
                onClick={() => setShowViewModal(false)}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para editar empresa */}
      {showEditModal && selectedCompany && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Editar Empresa</h3>

            <div className="form-group">
              <label>Nombre de la Empresa:</label>
              <input
                type="text"
                value={editCompany.name}
                onChange={(e) => setEditCompany({...editCompany, name: e.target.value})}
                required
              />
            </div>

            <div className="form-group">
              <label>NIT:</label>
              <input
                type="text"
                value={editCompany.tax_id}
                onChange={(e) => setEditCompany({...editCompany, tax_id: e.target.value})}
                required
              />
            </div>

            <div className="form-group">
              <label>Email:</label>
              <input
                type="email"
                value={editCompany.email}
                onChange={(e) => setEditCompany({...editCompany, email: e.target.value})}
                required
              />
            </div>

            <div className="form-group">
              <label>Teléfono:</label>
              <input
                type="text"
                value={editCompany.phone}
                onChange={(e) => setEditCompany({...editCompany, phone: e.target.value})}
                required
              />
            </div>

            <div className="form-group">
              <label>Dirección:</label>
              <input
                type="text"
                value={editCompany.address}
                onChange={(e) => setEditCompany({...editCompany, address: e.target.value})}
                required
              />
            </div>

            <div className="modal-actions">
              <button
                className="btn-secondary"
                onClick={() => {
                  setShowEditModal(false);
                  setSelectedCompany(null);
                }}
              >
                Cancelar
              </button>
              <button
                className="btn-primary"
                onClick={handleEditCompany}
                disabled={!editCompany.name || !editCompany.tax_id || !editCompany.email}
              >
                Guardar Cambios
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Companies;
