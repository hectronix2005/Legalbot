import React, { useState, useEffect } from 'react';
import api from '../services/api';
import './MyContractRequests.css';

interface ContractRequest {
  _id: string;
  title: string;
  status: 'pending' | 'in_review' | 'approved' | 'rejected' | 'completed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: { name: string; color: string; icon?: string };
  questionnaire_answers: Record<string, any>;
  createdAt: string;
  assigned_lawyer?: { name: string };
  rejection_reason?: string;
  legal_notes?: string;
  generated_contract?: { _id: string; contract_number: string };
}

const MyContractRequests: React.FC = () => {
  const [requests, setRequests] = useState<ContractRequest[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<ContractRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'in_review' | 'approved' | 'rejected'>('all');

  useEffect(() => {
    fetchMyRequests();
  }, [filter]);

  const fetchMyRequests = async () => {
    try {
      const params = filter !== 'all' ? { status: filter } : {};
      const response = await api.get('/contract-requests-v2', { params });
      setRequests(response.data);
    } catch (error) {
      console.error('Error fetching requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      pending: { bg: '#fef3c7', color: '#92400e', text: 'Pendiente', icon: '⏳' },
      in_review: { bg: '#dbeafe', color: '#1e40af', text: 'En Revisión', icon: '👁️' },
      approved: { bg: '#d1fae5', color: '#065f46', text: 'Aprobado', icon: '✅' },
      rejected: { bg: '#fee2e2', color: '#991b1b', text: 'Rechazado', icon: '❌' },
      completed: { bg: '#d1fae5', color: '#065f46', text: 'Completado', icon: '🎉' }
    };
    const style = styles[status as keyof typeof styles];
    return (
      <span className="status-badge" style={{ background: style.bg, color: style.color }}>
        {style.icon} {style.text}
      </span>
    );
  };

  const getPriorityBadge = (priority: string) => {
    const styles = {
      low: { bg: '#e5e7eb', color: '#374151', text: 'Baja' },
      medium: { bg: '#fef3c7', color: '#92400e', text: 'Media' },
      high: { bg: '#fed7aa', color: '#9a3412', text: 'Alta' },
      urgent: { bg: '#fecaca', color: '#991b1b', text: 'Urgente' }
    };
    const style = styles[priority as keyof typeof styles];
    return (
      <span className="priority-badge" style={{ background: style.bg, color: style.color }}>
        {style.text}
      </span>
    );
  };

  const getStatusDescription = (status: string) => {
    const descriptions = {
      pending: 'Tu solicitud está en la cola esperando ser asignada a un abogado',
      in_review: 'Un abogado está revisando tu solicitud',
      approved: 'Tu solicitud fue aprobada y el contrato ha sido generado',
      rejected: 'Tu solicitud fue rechazada',
      completed: 'El proceso está completo'
    };
    return descriptions[status as keyof typeof descriptions];
  };

  if (loading) {
    return <div className="loading">Cargando mis solicitudes...</div>;
  }

  return (
    <div className="my-contract-requests">
      <div className="page-header">
        <div>
          <h1>Mis Solicitudes de Contratos</h1>
          <p className="subtitle">Revisa el estado de tus solicitudes</p>
        </div>
      </div>

      <div className="filter-bar">
        <button
          className={filter === 'all' ? 'filter-btn active' : 'filter-btn'}
          onClick={() => setFilter('all')}
        >
          Todas ({requests.length})
        </button>
        <button
          className={filter === 'pending' ? 'filter-btn active' : 'filter-btn'}
          onClick={() => setFilter('pending')}
        >
          ⏳ Pendientes
        </button>
        <button
          className={filter === 'in_review' ? 'filter-btn active' : 'filter-btn'}
          onClick={() => setFilter('in_review')}
        >
          👁️ En Revisión
        </button>
        <button
          className={filter === 'approved' ? 'filter-btn active' : 'filter-btn'}
          onClick={() => setFilter('approved')}
        >
          ✅ Aprobadas
        </button>
        <button
          className={filter === 'rejected' ? 'filter-btn active' : 'filter-btn'}
          onClick={() => setFilter('rejected')}
        >
          ❌ Rechazadas
        </button>
      </div>

      {requests.length === 0 ? (
        <div className="empty-state">
          <h3>No hay solicitudes</h3>
          <p>
            {filter === 'all'
              ? 'Aún no has creado ninguna solicitud de contrato'
              : `No tienes solicitudes con estado "${filter}"`}
          </p>
        </div>
      ) : (
        <div className="requests-grid">
          {requests.map((request) => (
            <div key={request._id} className="request-card" data-status={request.status}>
              <div className="card-header">
                <div
                  className="category-badge"
                  style={{
                    backgroundColor: request.category.color + '20',
                    color: request.category.color
                  }}
                >
                  {request.category.name}
                </div>
                {getStatusBadge(request.status)}
              </div>

              <h3 className="request-title">{request.title}</h3>

              <div className="request-meta">
                <div className="meta-item">
                  <span className="meta-label">Prioridad:</span>
                  {getPriorityBadge(request.priority)}
                </div>
                <div className="meta-item">
                  <span className="meta-label">Fecha:</span>
                  <span>{new Date(request.createdAt).toLocaleDateString('es-ES', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}</span>
                </div>
                {request.assigned_lawyer && (
                  <div className="meta-item">
                    <span className="meta-label">Asignado a:</span>
                    <span>{request.assigned_lawyer.name}</span>
                  </div>
                )}
              </div>

              <div className="status-description">
                <p>{getStatusDescription(request.status)}</p>
              </div>

              {request.rejection_reason && (
                <div className="rejection-notice">
                  <strong>Razón del rechazo:</strong>
                  <p>{request.rejection_reason}</p>
                </div>
              )}

              {request.generated_contract && (
                <div className="contract-notice">
                  <strong>✅ Contrato generado:</strong>
                  <p>Número: {request.generated_contract.contract_number}</p>
                </div>
              )}

              <div className="card-actions">
                <button className="btn-view" onClick={() => setSelectedRequest(request)}>
                  Ver Detalles
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de detalles */}
      {selectedRequest && (
        <div className="modal-overlay" onClick={() => setSelectedRequest(null)}>
          <div className="modal modal-large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3>{selectedRequest.title}</h3>
                <div style={{ marginTop: '0.5rem' }}>
                  {getStatusBadge(selectedRequest.status)}
                </div>
              </div>
              <button className="modal-close" onClick={() => setSelectedRequest(null)}>
                ×
              </button>
            </div>

            <div className="modal-body">
              <div className="detail-section">
                <h4>Información General</h4>
                <div className="detail-grid">
                  <div>
                    <label>Categoría:</label>
                    <span>{selectedRequest.category.name}</span>
                  </div>
                  <div>
                    <label>Prioridad:</label>
                    {getPriorityBadge(selectedRequest.priority)}
                  </div>
                  <div>
                    <label>Fecha de solicitud:</label>
                    <span>
                      {new Date(selectedRequest.createdAt).toLocaleDateString('es-ES', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                  {selectedRequest.assigned_lawyer && (
                    <div>
                      <label>Abogado asignado:</label>
                      <span>{selectedRequest.assigned_lawyer.name}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="detail-section">
                <h4>Información Proporcionada</h4>
                <div className="answers-list">
                  {Object.entries(selectedRequest.questionnaire_answers).map(([key, value]) => (
                    <div key={key} className="answer-item">
                      <label>{key.replace(/_/g, ' ')}:</label>
                      <span>
                        {Array.isArray(value)
                          ? value.join(', ')
                          : typeof value === 'boolean'
                          ? value
                            ? 'Sí'
                            : 'No'
                          : value || 'N/A'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {selectedRequest.legal_notes && (
                <div className="detail-section">
                  <h4>Notas Legales</h4>
                  <div className="legal-notes">
                    <p>{selectedRequest.legal_notes}</p>
                  </div>
                </div>
              )}

              {selectedRequest.rejection_reason && (
                <div className="rejection-notice-detail">
                  <h4>Razón del Rechazo</h4>
                  <p>{selectedRequest.rejection_reason}</p>
                </div>
              )}

              {selectedRequest.generated_contract && (
                <div className="contract-notice-detail">
                  <h4>✅ Contrato Generado</h4>
                  <p>
                    <strong>Número de contrato:</strong>{' '}
                    {selectedRequest.generated_contract.contract_number}
                  </p>
                  <p className="help-text">
                    El contrato ha sido generado y está disponible en la sección de Contratos
                  </p>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setSelectedRequest(null)}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyContractRequests;
