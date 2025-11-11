import React, { useState, useEffect } from 'react';
import api from '../services/api';
import './SupplierApprovals.css';

interface Supplier {
  _id: string;
  legal_name: string;
  identification_number: string;
  identification_type: string;
  legal_representative_name: string;
  approval_status: 'pending' | 'approved' | 'rejected';
  created_by: { name: string; email: string };
  createdAt: string;
  rejection_reason?: string;
  email?: string;
  phone?: string;
}

const SupplierApprovals: React.FC = () => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [filter, setFilter] = useState<'pending' | 'all'>('pending');
  const [loading, setLoading] = useState(true);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  useEffect(() => {
    fetchSuppliers();
  }, [filter]);

  const fetchSuppliers = async () => {
    try {
      const endpoint = filter === 'pending'
        ? '/supplier-approvals/pending'
        : '/supplier-approvals/all';
      const response = await api.get(endpoint);
      setSuppliers(response.data);
    } catch (error) {
      console.error('Error fetching suppliers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    if (!window.confirm('¿Aprobar este tercero?')) return;

    try {
      await api.post(`/supplier-approvals/${id}/approve`);
      alert('Tercero aprobado exitosamente');
      fetchSuppliers();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Error al aprobar');
    }
  };

  const handleReject = async (id: string) => {
    if (!rejectionReason.trim()) {
      alert('Debes proporcionar una razón del rechazo');
      return;
    }

    try {
      await api.post(`/supplier-approvals/${id}/reject`, { rejection_reason: rejectionReason });
      alert('Tercero rechazado');
      setRejecting(null);
      setRejectionReason('');
      fetchSuppliers();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Error al rechazar');
    }
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      pending: { bg: '#fef3c7', color: '#92400e', text: 'Pendiente' },
      approved: { bg: '#d1fae5', color: '#065f46', text: 'Aprobado' },
      rejected: { bg: '#fee2e2', color: '#991b1b', text: 'Rechazado' }
    };
    const style = styles[status as keyof typeof styles];
    return (
      <span className="status-badge" style={{ background: style.bg, color: style.color }}>
        {style.text}
      </span>
    );
  };

  if (loading) {
    return <div className="loading">Cargando terceros...</div>;
  }

  return (
    <div className="supplier-approvals">
      <div className="page-header">
        <div>
          <h1>Aprobación de Terceros</h1>
          <p className="subtitle">Revisa y aprueba terceros creados por usuarios</p>
        </div>
        <div className="filter-buttons">
          <button
            onClick={() => setFilter('pending')}
            className={filter === 'pending' ? 'btn-primary' : 'btn-secondary'}
          >
            Pendientes
          </button>
          <button
            onClick={() => setFilter('all')}
            className={filter === 'all' ? 'btn-primary' : 'btn-secondary'}
          >
            Todos
          </button>
        </div>
      </div>

      {suppliers.length === 0 ? (
        <div className="empty-state">
          <h3>No hay terceros {filter === 'pending' ? 'pendientes' : ''}</h3>
          <p>{filter === 'pending' ? 'Todos los terceros han sido revisados' : 'No hay terceros registrados'}</p>
        </div>
      ) : (
        <div className="approvals-table-wrapper">
          <table className="approvals-table">
            <thead>
              <tr>
                <th className="th-supplier-name">Tercero</th>
                <th className="th-identification">Identificación</th>
                <th className="th-representative">Representante Legal</th>
                <th className="th-contact">Contacto</th>
                <th className="th-creator">Creado Por</th>
                <th className="th-status">Estado</th>
                <th className="th-actions">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {suppliers.map((supplier) => (
                  <tr key={supplier._id} className={`approval-row status-${supplier.approval_status}`}>
                    <td className="supplier-name-col">
                      <div className="supplier-name-info">
                        <strong title={supplier.legal_name}>{supplier.legal_name}</strong>
                        {supplier.rejection_reason && (
                          <small className="inline-rejection" title={supplier.rejection_reason}>
                            Rechazado: {supplier.rejection_reason}
                          </small>
                        )}
                      </div>
                    </td>
                    <td className="identification-col">
                      <div className="id-badge" title={`${supplier.identification_type}: ${supplier.identification_number}`}>
                        <span className="id-type">{supplier.identification_type}</span>
                        <span className="id-number">{supplier.identification_number}</span>
                      </div>
                    </td>
                    <td className="representative-col">
                      <span className="representative-name" title={supplier.legal_representative_name}>
                        {supplier.legal_representative_name}
                      </span>
                    </td>
                    <td className="contact-col">
                      <div className="contact-info">
                        {supplier.email && (
                          <span className="contact-item" title={`Email: ${supplier.email}`}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                              <polyline points="22,6 12,13 2,6"></polyline>
                            </svg>
                            {supplier.email}
                          </span>
                        )}
                        {supplier.phone && (
                          <span className="contact-item" title={`Teléfono: ${supplier.phone}`}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                            </svg>
                            {supplier.phone}
                          </span>
                        )}
                        {!supplier.email && !supplier.phone && <span className="no-contact">N/A</span>}
                      </div>
                    </td>
                    <td className="creator-col">
                      <div className="creator-info">
                        <span className="creator-name" title={supplier.created_by.email}>{supplier.created_by.name}</span>
                        <small className="created-date">{new Date(supplier.createdAt).toLocaleDateString('es-ES')}</small>
                      </div>
                    </td>
                    <td className="status-col">
                      {getStatusBadge(supplier.approval_status)}
                    </td>
                    <td className="actions-col">
                      <div className="action-buttons">
                        {supplier.approval_status === 'pending' && !rejecting && (
                          <>
                            <button
                              className="btn-action btn-approve-action"
                              onClick={() => handleApprove(supplier._id)}
                              title={`Aprobar a ${supplier.legal_name}`}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12"></polyline>
                              </svg>
                            </button>
                            <button
                              className="btn-action btn-reject-action"
                              onClick={() => setRejecting(supplier._id)}
                              title={`Rechazar a ${supplier.legal_name}`}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                              </svg>
                            </button>
                          </>
                        )}
                        {rejecting === supplier._id && (
                          <div className="inline-rejection-form">
                            <textarea
                              value={rejectionReason}
                              onChange={(e) => setRejectionReason(e.target.value)}
                              rows={2}
                              placeholder="Razón del rechazo..."
                              className="inline-textarea"
                            />
                            <div className="inline-buttons">
                              <button className="btn-action btn-danger-sm" onClick={() => handleReject(supplier._id)} title="Confirmar rechazo">
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="20 6 9 17 4 12"></polyline>
                                </svg>
                              </button>
                              <button
                                className="btn-action btn-cancel-sm"
                                onClick={() => {
                                  setRejecting(null);
                                  setRejectionReason('');
                                }}
                                title="Cancelar"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <line x1="18" y1="6" x2="6" y2="18"></line>
                                  <line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default SupplierApprovals;
