import React, { useState, useEffect } from 'react';
import {
  getConsolidatedSupplierContracts,
  getSupplierContracts,
  ConsolidatedSupplierData,
  ConsolidatedSupplierContract,
  SupplierContractsResponse
} from '../services/api';
import './SupplierContractsConsolidated.css';

const SupplierContractsConsolidated: React.FC = () => {
  const [data, setData] = useState<ConsolidatedSupplierData[]>([]);
  const [totals, setTotals] = useState({
    suppliers_count: 0,
    total_contracts: 0,
    suppliers_with_contracts: 0,
    suppliers_without_contracts: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'contract_count' | 'name' | 'recent'>('contract_count');
  const [withContractsOnly, setWithContractsOnly] = useState(false);
  const [includeInactive, setIncludeInactive] = useState(false);

  // Modal de detalle
  const [selectedSupplier, setSelectedSupplier] = useState<string | null>(null);
  const [supplierDetail, setSupplierDetail] = useState<SupplierContractsResponse | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Expandir/colapsar filas
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchData();
  }, [sortBy, withContractsOnly, includeInactive]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await getConsolidatedSupplierContracts({
        search: searchTerm.trim() || undefined,
        sortBy,
        withContractsOnly,
        includeInactive
      });

      setData(response.data);
      setTotals(response.totals);
    } catch (err: any) {
      console.error('Error fetching consolidated data:', err);
      setError(err.response?.data?.error || 'Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchData();
  };

  const toggleRowExpand = (supplierId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(supplierId)) {
      newExpanded.delete(supplierId);
    } else {
      newExpanded.add(supplierId);
    }
    setExpandedRows(newExpanded);
  };

  const openSupplierDetail = async (supplierId: string) => {
    try {
      setSelectedSupplier(supplierId);
      setLoadingDetail(true);
      const response = await getSupplierContracts(supplierId);
      setSupplierDetail(response);
    } catch (err: any) {
      console.error('Error fetching supplier detail:', err);
      setError('Error al cargar detalle del tercero');
    } finally {
      setLoadingDetail(false);
    }
  };

  const closeSupplierDetail = () => {
    setSelectedSupplier(null);
    setSupplierDetail(null);
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'active':
      case 'aprobado':
      case 'firmado':
        return 'status-badge-success';
      case 'borrador':
      case 'revision':
        return 'status-badge-warning';
      case 'terminated':
      case 'expired':
      case 'cancelado':
        return 'status-badge-danger';
      default:
        return 'status-badge-default';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const renderContractsList = (contracts: ConsolidatedSupplierContract[]) => {
    if (contracts.length === 0) {
      return <div className="no-contracts">Sin contratos asociados</div>;
    }

    return (
      <div className="contracts-mini-list">
        {contracts.slice(0, 5).map(contract => (
          <div key={contract._id} className="contract-mini-item">
            <span className="contract-number">{contract.contract_number}</span>
            <span className={`status-badge ${getStatusBadgeClass(contract.status)}`}>
              {contract.status}
            </span>
            <span className="contract-date">{formatDate(contract.createdAt)}</span>
          </div>
        ))}
        {contracts.length > 5 && (
          <div className="more-contracts">
            +{contracts.length - 5} contratos más
          </div>
        )}
      </div>
    );
  };

  if (loading && data.length === 0) {
    return (
      <div className="consolidated-container">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Cargando datos consolidados...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="consolidated-container">
      {/* Header */}
      <div className="consolidated-header">
        <div className="header-info">
          <h1>Contratos por Tercero</h1>
          <p>Vista consolidada de todos los contratos asociados a cada tercero</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="stats-cards">
        <div className="stat-card">
          <div className="stat-icon">👥</div>
          <div className="stat-content">
            <span className="stat-value">{totals.suppliers_count}</span>
            <span className="stat-label">Terceros</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">📄</div>
          <div className="stat-content">
            <span className="stat-value">{totals.total_contracts}</span>
            <span className="stat-label">Contratos Totales</span>
          </div>
        </div>
        <div className="stat-card stat-success">
          <div className="stat-icon">✓</div>
          <div className="stat-content">
            <span className="stat-value">{totals.suppliers_with_contracts}</span>
            <span className="stat-label">Con Contratos</span>
          </div>
        </div>
        <div className="stat-card stat-warning">
          <div className="stat-icon">○</div>
          <div className="stat-content">
            <span className="stat-value">{totals.suppliers_without_contracts}</span>
            <span className="stat-label">Sin Contratos</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="filters-section">
        <form onSubmit={handleSearch} className="search-form">
          <input
            type="text"
            placeholder="Buscar por nombre, ID o email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
          <button type="submit" className="btn-search">
            Buscar
          </button>
        </form>

        <div className="filter-options">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="filter-select"
          >
            <option value="contract_count">Más contratos</option>
            <option value="name">Por nombre</option>
            <option value="recent">Más reciente</option>
          </select>

          <label className="filter-checkbox">
            <input
              type="checkbox"
              checked={withContractsOnly}
              onChange={(e) => setWithContractsOnly(e.target.checked)}
            />
            Solo con contratos
          </label>

          <label className="filter-checkbox">
            <input
              type="checkbox"
              checked={includeInactive}
              onChange={(e) => setIncludeInactive(e.target.checked)}
            />
            Incluir inactivos
          </label>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="error-alert">
          {error}
          <button onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {/* Table */}
      <div className="table-container">
        <table className="consolidated-table">
          <thead>
            <tr>
              <th className="expand-col"></th>
              <th>Tercero</th>
              <th>Tipo</th>
              <th>Identificación</th>
              <th>Contacto</th>
              <th className="contracts-col">Contratos</th>
              <th className="profiles-col">Perfiles</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {data.map(item => (
              <React.Fragment key={item.supplier._id}>
                <tr className={!item.supplier.active ? 'inactive-row' : ''}>
                  <td className="expand-col">
                    {item.stats.total > 0 && (
                      <button
                        className="btn-expand"
                        onClick={() => toggleRowExpand(item.supplier._id)}
                      >
                        {expandedRows.has(item.supplier._id) ? '▼' : '▶'}
                      </button>
                    )}
                  </td>
                  <td>
                    <div className="supplier-info">
                      <strong>{item.supplier.legal_name}</strong>
                      {item.supplier.legal_name_short && item.supplier.legal_name_short !== item.supplier.legal_name && (
                        <small>{item.supplier.legal_name_short}</small>
                      )}
                    </div>
                  </td>
                  <td>
                    {item.supplier.third_party_type ? (
                      <span className="type-badge">
                        {item.supplier.third_party_type.icon} {item.supplier.third_party_type.label}
                      </span>
                    ) : '-'}
                  </td>
                  <td>
                    <div className="id-info">
                      <span className="id-type">{item.supplier.identification_type}</span>
                      <span className="id-number">{item.supplier.identification_number}</span>
                    </div>
                  </td>
                  <td>
                    <div className="contact-info">
                      {item.supplier.email && <span className="email">{item.supplier.email}</span>}
                      {item.supplier.phone && <span className="phone">{item.supplier.phone}</span>}
                      {!item.supplier.email && !item.supplier.phone && <span className="no-contact">-</span>}
                    </div>
                  </td>
                  <td className="contracts-col">
                    <div className={`contract-count ${item.stats.total > 0 ? 'has-contracts' : ''}`}>
                      <span className="count-number">{item.stats.total}</span>
                      {item.stats.total > 0 && Object.keys(item.stats.by_status).length > 0 && (
                        <div className="status-breakdown">
                          {Object.entries(item.stats.by_status).map(([status, count]) => (
                            <span key={status} className={`mini-badge ${getStatusBadgeClass(status)}`}>
                              {count} {status}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="profiles-col">
                    <span className="profile-count">{item.profile_count}</span>
                  </td>
                  <td>
                    <div className="action-buttons">
                      <button
                        className="btn-action btn-view"
                        onClick={() => openSupplierDetail(item.supplier._id)}
                        title="Ver detalle"
                      >
                        Ver
                      </button>
                    </div>
                  </td>
                </tr>

                {/* Expanded Row */}
                {expandedRows.has(item.supplier._id) && (
                  <tr className="expanded-row">
                    <td colSpan={8}>
                      <div className="expanded-content">
                        <h4>Contratos Recientes</h4>
                        {renderContractsList(item.contracts)}

                        {item.profiles.length > 0 && (
                          <>
                            <h4>Perfiles de Plantilla</h4>
                            <div className="profiles-list">
                              {item.profiles.map(profile => (
                                <div key={profile._id} className="profile-item">
                                  <span className="profile-template">{profile.template?.name}</span>
                                  <span className="profile-role">{profile.role_label || profile.role_in_template}</span>
                                  <span className={`profile-complete ${profile.is_complete ? 'complete' : 'incomplete'}`}>
                                    {profile.is_complete ? '✓ Completo' : '○ Incompleto'}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>

        {data.length === 0 && !loading && (
          <div className="empty-state">
            <h3>No se encontraron terceros</h3>
            <p>Ajusta los filtros de búsqueda o crea nuevos terceros</p>
          </div>
        )}
      </div>

      {/* Modal de Detalle */}
      {selectedSupplier && (
        <div className="modal-overlay" onClick={closeSupplierDetail}>
          <div className="modal-detail" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Detalle de Contratos</h2>
              <button className="btn-close" onClick={closeSupplierDetail}>✕</button>
            </div>

            {loadingDetail ? (
              <div className="loading-state">
                <div className="spinner"></div>
                <p>Cargando...</p>
              </div>
            ) : supplierDetail ? (
              <div className="modal-content">
                {/* Supplier Info */}
                <div className="detail-section">
                  <h3>Información del Tercero</h3>
                  <div className="supplier-detail-card">
                    <div className="detail-row">
                      <span className="label">Nombre:</span>
                      <span className="value">{supplierDetail.supplier.legal_name}</span>
                    </div>
                    <div className="detail-row">
                      <span className="label">Identificación:</span>
                      <span className="value">
                        {supplierDetail.supplier.identification_type} {supplierDetail.supplier.identification_number}
                      </span>
                    </div>
                    {supplierDetail.supplier.email && (
                      <div className="detail-row">
                        <span className="label">Email:</span>
                        <span className="value">{supplierDetail.supplier.email}</span>
                      </div>
                    )}
                    {supplierDetail.supplier.phone && (
                      <div className="detail-row">
                        <span className="label">Teléfono:</span>
                        <span className="value">{supplierDetail.supplier.phone}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Stats */}
                <div className="detail-section">
                  <h3>Estadísticas</h3>
                  <div className="stats-grid">
                    <div className="stat-item">
                      <span className="stat-number">{supplierDetail.stats.total_contracts}</span>
                      <span className="stat-text">Contratos Totales</span>
                    </div>
                    {Object.entries(supplierDetail.stats.by_status).map(([status, count]) => (
                      <div key={status} className="stat-item">
                        <span className="stat-number">{count as number}</span>
                        <span className="stat-text">{status}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Contracts List */}
                <div className="detail-section">
                  <h3>Lista de Contratos ({supplierDetail.contracts.length})</h3>
                  <div className="contracts-detail-list">
                    {supplierDetail.contracts.length === 0 ? (
                      <p className="no-data">No hay contratos asociados</p>
                    ) : (
                      supplierDetail.contracts.map(contract => (
                        <div key={contract._id} className="contract-detail-card">
                          <div className="contract-header">
                            <span className="contract-number">{contract.contract_number}</span>
                            <span className={`status-badge ${getStatusBadgeClass(contract.status)}`}>
                              {contract.status}
                            </span>
                          </div>
                          <div className="contract-body">
                            {contract.title && <p className="contract-title">{contract.title}</p>}
                            <div className="contract-meta">
                              <span>Plantilla: {contract.template?.name || 'N/A'}</span>
                              <span>Fecha: {formatDate(contract.createdAt)}</span>
                              {contract.generated_by && (
                                <span>Generado por: {contract.generated_by.name}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Profiles */}
                {supplierDetail.profiles.length > 0 && (
                  <div className="detail-section">
                    <h3>Perfiles de Plantilla ({supplierDetail.profiles.length})</h3>
                    <div className="profiles-detail-list">
                      {supplierDetail.profiles.map(profile => (
                        <div key={profile._id} className="profile-detail-card">
                          <span className="profile-template">{profile.template?.name}</span>
                          <span className="profile-role">{profile.role_label || profile.role_in_template}</span>
                          <span className={`profile-status ${profile.is_complete ? 'complete' : 'incomplete'}`}>
                            {profile.is_complete ? 'Completo' : 'Incompleto'}
                          </span>
                          <span className="profile-usage">Usado {profile.usage_count} veces</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="error-state">
                <p>Error al cargar los datos</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SupplierContractsConsolidated;
