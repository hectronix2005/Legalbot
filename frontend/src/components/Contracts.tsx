import React, { useState, useEffect } from 'react';
import api from '../services/api';
import './Contracts.css';

interface Contract {
  _id?: string;
  id?: string;
  contract_number?: string;
  title: string;
  company: string;
  company_name?: string;
  status: string;
  createdAt: string;
  file_path?: string;
  pdf_path?: string;
  template?: {
    _id: string;
    name: string;
    category?: string;
  };
  content?: string;
}

const Contracts: React.FC = () => {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [newContract, setNewContract] = useState({
    title: '',
    company: '',
    status: 'borrador',
    description: '',
    template_id: ''
  });

  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [companyFilter, setCompanyFilter] = useState('');
  const [templateFilter, setTemplateFilter] = useState('');
  const [terceroFilter, setTerceroFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchContracts();
  }, []);

  const fetchContracts = async () => {
    try {
      const response = await api.get('/contracts');
      setContracts(response.data);
    } catch (error) {
      console.error('Error fetching contracts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateContract = async () => {
    try {
      await api.post('/contracts', newContract);
      await fetchContracts();
      setShowCreateModal(false);
      setNewContract({
        title: '',
        company: '',
        status: 'borrador',
        description: '',
        template_id: ''
      });
    } catch (error) {
      console.error('Error creating contract:', error);
    }
  };

  const handleDownloadWord = async (contractId: string) => {
    try {
      const response = await api.get(`/documents/download/word/${contractId}`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `contrato_${contractId}.docx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading Word document:', error);
      alert('Error al descargar el documento Word');
    }
  };


  const handleViewContract = (contract: Contract) => {
    setSelectedContract(contract);
    setShowViewModal(true);
  };

  const handleEditContract = (contract: Contract) => {
    setSelectedContract(contract);
    setShowEditModal(true);
  };

  const handleDeleteContract = async (contractId: string) => {
    if (window.confirm('¿Estás seguro de que quieres eliminar este contrato?')) {
      try {
        await api.delete(`/contracts/${contractId}`);
        await fetchContracts();
        alert('Contrato eliminado exitosamente');
      } catch (error) {
        console.error('Error deleting contract:', error);
        alert('Error al eliminar el contrato');
      }
    }
  };

  // Filter functions
  const handleStatusToggle = (status: string) => {
    setSelectedStatuses(prev =>
      prev.includes(status)
        ? prev.filter(s => s !== status)
        : [...prev, status]
    );
  };

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedStatuses([]);
    setStartDate('');
    setEndDate('');
    setCompanyFilter('');
    setTemplateFilter('');
    setTerceroFilter('');
  };

  const getFilteredContracts = () => {
    let filtered = [...contracts];

    // Search filter (title or contract number)
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(contract =>
        (contract.title?.toLowerCase().includes(search)) ||
        (contract.contract_number?.toLowerCase().includes(search))
      );
    }

    // Status filter
    if (selectedStatuses.length > 0) {
      filtered = filtered.filter(contract =>
        selectedStatuses.includes(contract.status)
      );
    }

    // Company filter
    if (companyFilter.trim()) {
      const company = companyFilter.toLowerCase();
      filtered = filtered.filter(contract =>
        (contract.company_name?.toLowerCase().includes(company)) ||
        (contract.company?.toLowerCase().includes(company))
      );
    }

    // Template filter
    if (templateFilter.trim()) {
      const template = templateFilter.toLowerCase();
      filtered = filtered.filter(contract =>
        contract.template?.name?.toLowerCase().includes(template)
      );
    }

    // Tercero filter (searches in content and title)
    if (terceroFilter.trim()) {
      const tercero = terceroFilter.toLowerCase();
      filtered = filtered.filter(contract =>
        (contract.content?.toLowerCase().includes(tercero)) ||
        (contract.title?.toLowerCase().includes(tercero))
      );
    }

    // Date range filter
    if (startDate) {
      const start = new Date(startDate);
      filtered = filtered.filter(contract =>
        new Date(contract.createdAt) >= start
      );
    }

    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999); // Include full end day
      filtered = filtered.filter(contract =>
        new Date(contract.createdAt) <= end
      );
    }

    return filtered;
  };

  const filteredContracts = getFilteredContracts();
  const activeFiltersCount = [
    searchTerm.trim(),
    selectedStatuses.length > 0,
    startDate,
    endDate,
    companyFilter.trim(),
    templateFilter.trim(),
    terceroFilter.trim()
  ].filter(Boolean).length;

  if (loading) {
    return <div className="loading">Cargando contratos...</div>;
  }

  return (
    <div className="contracts">
      <div className="page-header">
        <h1>Gestión de Contratos</h1>
        <button
          className="btn-primary"
          onClick={() => setShowCreateModal(true)}
        >
          Nuevo Contrato
        </button>
      </div>

      {/* Filters Section */}
      <div className="filters-container">
        <div className="filters-header">
          <button
            className="btn-toggle-filters"
            onClick={() => setShowFilters(!showFilters)}
          >
            {showFilters ? '▼' : '▶'} Filtros
            {activeFiltersCount > 0 && (
              <span className="filter-badge">{activeFiltersCount}</span>
            )}
          </button>
          {activeFiltersCount > 0 && (
            <button className="btn-clear-filters" onClick={clearFilters}>
              Limpiar Filtros
            </button>
          )}
          <div className="results-count">
            Mostrando {filteredContracts.length} de {contracts.length} contratos
          </div>
        </div>

        {showFilters && (
          <div className="filters-content">
            {/* Search Bar */}
            <div className="filter-group">
              <label>Buscar:</label>
              <input
                type="text"
                placeholder="Buscar por título o número de contrato..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="filter-input"
              />
            </div>

            {/* Company Filter */}
            <div className="filter-group">
              <label>Empresa:</label>
              <input
                type="text"
                placeholder="Filtrar por empresa..."
                value={companyFilter}
                onChange={(e) => setCompanyFilter(e.target.value)}
                className="filter-input"
              />
            </div>

            {/* Template Filter */}
            <div className="filter-group">
              <label>Plantilla:</label>
              <input
                type="text"
                placeholder="Filtrar por nombre de plantilla..."
                value={templateFilter}
                onChange={(e) => setTemplateFilter(e.target.value)}
                className="filter-input"
              />
            </div>

            {/* Tercero Filter */}
            <div className="filter-group">
              <label>Tercero:</label>
              <input
                type="text"
                placeholder="Filtrar por nombre o identificación del tercero..."
                value={terceroFilter}
                onChange={(e) => setTerceroFilter(e.target.value)}
                className="filter-input"
              />
            </div>

            {/* Status Filter */}
            <div className="filter-group">
              <label>Estado:</label>
              <div className="status-checkboxes">
                {['borrador', 'revision', 'aprobado', 'firmado', 'cancelado'].map(status => (
                  <label key={status} className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={selectedStatuses.includes(status)}
                      onChange={() => handleStatusToggle(status)}
                    />
                    <span className={`status-label ${status}`}>{status}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Date Range Filter */}
            <div className="filter-group-row">
              <div className="filter-group">
                <label>Fecha desde:</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="filter-input"
                />
              </div>
              <div className="filter-group">
                <label>Fecha hasta:</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="filter-input"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="contracts-list">
        {contracts.length === 0 ? (
          <div className="empty-state">
            <h3>No hay contratos</h3>
            <p>Crea tu primer contrato para comenzar</p>
          </div>
        ) : filteredContracts.length === 0 ? (
          <div className="empty-state">
            <h3>No se encontraron contratos</h3>
            <p>Intenta ajustar los filtros para ver más resultados</p>
          </div>
        ) : (
          <div className="contracts-table-wrapper">
            <table className="contracts-table-compact">
              <thead>
                <tr>
                  <th className="th-contract-number">Contrato</th>
                  <th className="th-template">Plantilla</th>
                  <th className="th-third-party">Tercero</th>
                  <th className="th-status">Estado</th>
                  <th className="th-date">Fecha</th>
                  <th className="th-actions">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredContracts.map((contract) => (
                  <tr key={contract._id || contract.id}>
                    <td className="contract-number-col">
                      <div className="contract-info">
                        <strong title={contract.contract_number || contract.title || 'N/A'}>
                          {contract.contract_number || contract.title || 'N/A'}
                        </strong>
                        {contract.title && contract.contract_number && (
                          <small title={contract.title}>{contract.title}</small>
                        )}
                      </div>
                    </td>
                    <td className="template-col">
                      <span className="template-badge" title={contract.template?.name || 'Sin plantilla'}>
                        {contract.template?.name || 'Sin plantilla'}
                      </span>
                    </td>
                    <td className="third-party-col">
                      <span className="third-party-name" title={contract.company_name || contract.company || 'N/A'}>
                        {contract.company_name || contract.company || 'N/A'}
                      </span>
                    </td>
                    <td className="status-col">
                      <span className={`status-badge status-${contract.status}`}>
                        {contract.status}
                      </span>
                    </td>
                    <td className="date-col">
                      <div className="date-time-info">
                        <span className="date-value">
                          {new Date(contract.createdAt).toLocaleDateString('es-ES', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric'
                          })}
                        </span>
                      </div>
                    </td>
                    <td className="actions-col">
                      <div className="action-buttons">
                        {contract.file_path && (
                          <button
                            className="btn-action btn-download"
                            onClick={() => handleDownloadWord(contract._id || contract.id || '')}
                            title={`Descargar ${contract.contract_number || 'contrato'}`}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                              <polyline points="7 10 12 15 17 10"></polyline>
                              <line x1="12" y1="15" x2="12" y2="3"></line>
                            </svg>
                          </button>
                        )}
                        <button
                          className="btn-action btn-delete"
                          onClick={() => handleDeleteContract(contract._id || contract.id || '')}
                          title={`Eliminar ${contract.contract_number || 'contrato'}`}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal para crear contrato */}
      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Crear Nuevo Contrato</h3>
            
            <div className="form-group">
              <label>Título del Contrato:</label>
              <input 
                type="text"
                value={newContract.title}
                onChange={(e) => setNewContract({...newContract, title: e.target.value})}
                required
              />
            </div>
            
            <div className="form-group">
              <label>Empresa:</label>
              <input 
                type="text"
                value={newContract.company}
                onChange={(e) => setNewContract({...newContract, company: e.target.value})}
                required
              />
            </div>
            
            <div className="form-group">
              <label>Estado:</label>
              <select 
                value={newContract.status}
                onChange={(e) => setNewContract({...newContract, status: e.target.value})}
                required
              >
                <option value="borrador">Borrador</option>
                <option value="revision">En Revisión</option>
                <option value="aprobado">Aprobado</option>
                <option value="firmado">Firmado</option>
                <option value="cancelado">Cancelado</option>
              </select>
            </div>
            
            <div className="form-group">
              <label>Descripción:</label>
              <textarea 
                value={newContract.description}
                onChange={(e) => setNewContract({...newContract, description: e.target.value})}
                rows={4}
                placeholder="Describe el contrato..."
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
                onClick={handleCreateContract}
                disabled={!newContract.title || !newContract.company}
              >
                Crear Contrato
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para ver contrato */}
      {showViewModal && selectedContract && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Detalles del Contrato</h3>
            
            <div className="contract-details">
              <div className="detail-row">
                <strong>Número:</strong> {selectedContract.contract_number || 'N/A'}
              </div>
              <div className="detail-row">
                <strong>Título:</strong> {selectedContract.title || 'Sin título'}
              </div>
              <div className="detail-row">
                <strong>Empresa:</strong> {selectedContract.company_name || selectedContract.company}
              </div>
              <div className="detail-row">
                <strong>Estado:</strong> <span className={`status ${selectedContract.status}`}>{selectedContract.status}</span>
              </div>
              <div className="detail-row">
                <strong>Creado:</strong> {new Date(selectedContract.createdAt).toLocaleDateString()}
              </div>
              {(selectedContract.file_path || selectedContract.pdf_path) && (
                <div className="detail-row">
                  <strong>Documentos:</strong>
                  <div className="document-links">
                    {selectedContract.file_path && (
                      <button 
                        className="btn-download-word"
                        onClick={() => handleDownloadWord(selectedContract._id || selectedContract.id || '')}
                      >
                        📄 Descargar Word
                      </button>
                    )}
                  </div>
                </div>
              )}
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

      {/* Modal para editar contrato */}
      {showEditModal && selectedContract && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Editar Contrato</h3>
            
            <div className="form-group">
              <label>Título del Contrato:</label>
              <input 
                type="text"
                value={selectedContract.title}
                onChange={(e) => setSelectedContract({...selectedContract, title: e.target.value})}
                required
              />
            </div>
            
            <div className="form-group">
              <label>Empresa:</label>
              <input 
                type="text"
                value={selectedContract.company_name || selectedContract.company}
                onChange={(e) => setSelectedContract({...selectedContract, company_name: e.target.value})}
                required
              />
            </div>
            
            <div className="form-group">
              <label>Estado:</label>
              <select 
                value={selectedContract.status}
                onChange={(e) => setSelectedContract({...selectedContract, status: e.target.value})}
                required
              >
                <option value="borrador">Borrador</option>
                <option value="revision">En Revisión</option>
                <option value="aprobado">Aprobado</option>
                <option value="firmado">Firmado</option>
                <option value="cancelado">Cancelado</option>
              </select>
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
                onClick={async () => {
                  try {
                    await api.put(`/contracts/${selectedContract._id || selectedContract.id}`, {
                      title: selectedContract.title,
                      company: selectedContract.company_name || selectedContract.company,
                      status: selectedContract.status
                    });
                    await fetchContracts();
                    setShowEditModal(false);
                    alert('Contrato actualizado exitosamente');
                  } catch (error) {
                    console.error('Error updating contract:', error);
                    alert('Error al actualizar el contrato');
                  }
                }}
                disabled={!selectedContract.title || !(selectedContract.company_name || selectedContract.company)}
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

export default Contracts;
