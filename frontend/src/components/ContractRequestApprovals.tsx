import React, { useState, useEffect } from 'react';
import api from '../services/api';
import './ContractRequestApprovals.css';

interface ContractRequest {
  _id: string;
  title: string;
  status: 'pending' | 'in_review' | 'approved' | 'rejected' | 'completed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: { name: string; color: string; questionnaire: any[] };
  requester: { name: string; email: string };
  questionnaire_answers: Record<string, any>;
  createdAt: string;
  assigned_lawyer?: { name: string };
  rejection_reason?: string;
}

const ContractRequestApprovals: React.FC = () => {
  const [requests, setRequests] = useState<ContractRequest[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<ContractRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [rejectionReason, setRejectionReason] = useState('');
  const [legalNotes, setLegalNotes] = useState('');

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      const response = await api.get('/contract-requests-v2');
      setRequests(response.data);
    } catch (error) {
      console.error('Error fetching requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAssign = async (id: string) => {
    try {
      await api.post(`/contract-requests-v2/${id}/assign`, {});
      alert('Solicitud asignada a ti');
      fetchRequests();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Error al asignar');
    }
  };

  const handleApprove = async (id: string) => {
    if (!window.confirm('¿Aprobar y generar contrato automáticamente?')) return;

    try {
      await api.post(`/contract-requests-v2/${id}/approve`, {
        legal_notes: legalNotes
      });
      alert('¡Contrato generado exitosamente!');
      setSelectedRequest(null);
      setLegalNotes('');
      fetchRequests();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Error al aprobar');
    }
  };

  const handleReject = async (id: string) => {
    if (!rejectionReason.trim()) {
      alert('Proporciona una razón del rechazo');
      return;
    }

    try {
      await api.post(`/contract-requests-v2/${id}/reject`, {
        rejection_reason: rejectionReason
      });
      alert('Solicitud rechazada');
      setSelectedRequest(null);
      setRejectionReason('');
      fetchRequests();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Error al rechazar');
    }
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      pending: { bg: '#fef3c7', color: '#92400e', text: 'Pendiente' },
      in_review: { bg: '#dbeafe', color: '#1e40af', text: 'En Revisión' },
      approved: { bg: '#d1fae5', color: '#065f46', text: 'Aprobado' },
      rejected: { bg: '#fee2e2', color: '#991b1b', text: 'Rechazado' },
      completed: { bg: '#d1fae5', color: '#065f46', text: 'Completado' }
    };
    const style = styles[status as keyof typeof styles];
    return (
      <span className="status-badge" style={{ background: style.bg, color: style.color }}>
        {style.text}
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

  if (loading) {
    return <div className="loading">Cargando solicitudes...</div>;
  }

  return (
    <div className="contract-request-approvals">
      <div className="page-header">
        <div>
          <h1>Aprobación de Solicitudes</h1>
          <p className="subtitle">Revisa y aprueba solicitudes de contratos</p>
        </div>
      </div>

      {requests.length === 0 ? (
        <div className="empty-state">
          <h3>No hay solicitudes</h3>
          <p>Las solicitudes aparecerán aquí cuando sean creadas</p>
        </div>
      ) : (
        <div className="requests-table-wrapper">
          <table className="requests-table">
            <thead>
              <tr>
                <th className="th-request-title">Solicitud</th>
                <th className="th-category">Categoría</th>
                <th className="th-priority">Prioridad</th>
                <th className="th-requester">Solicitante</th>
                <th className="th-date">Fecha</th>
                <th className="th-assigned">Asignado</th>
                <th className="th-status">Estado</th>
                <th className="th-actions">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((request) => (
                <tr key={request._id} className={`request-row status-${request.status}`}>
                  <td className="title-col">
                    <div className="request-title-info">
                      <strong title={request.title}>{request.title}</strong>
                    </div>
                  </td>
                  <td className="category-col">
                    <span
                      className="category-badge-compact"
                      style={{
                        background: request.category.color + '20',
                        color: request.category.color,
                        border: `1px solid ${request.category.color}40`
                      }}
                      title={request.category.name}
                    >
                      {request.category.name}
                    </span>
                  </td>
                  <td className="priority-col">
                    {getPriorityBadge(request.priority)}
                  </td>
                  <td className="requester-col">
                    <div className="requester-info">
                      <span className="requester-name" title={request.requester.email}>
                        {request.requester.name}
                      </span>
                    </div>
                  </td>
                  <td className="date-col">
                    <span className="date-value">
                      {new Date(request.createdAt).toLocaleDateString('es-ES')}
                    </span>
                  </td>
                  <td className="assigned-col">
                    {request.assigned_lawyer ? (
                      <span className="assigned-name" title={request.assigned_lawyer.name}>
                        {request.assigned_lawyer.name}
                      </span>
                    ) : (
                      <span className="not-assigned">No asignado</span>
                    )}
                  </td>
                  <td className="status-col">
                    {getStatusBadge(request.status)}
                  </td>
                  <td className="actions-col">
                    <div className="action-buttons">
                      {request.status === 'pending' && (
                        <button
                          className="btn-action btn-assign"
                          onClick={() => handleAssign(request._id)}
                          title={`Asignarme la solicitud: ${request.title}`}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                            <circle cx="8.5" cy="7" r="4"></circle>
                            <line x1="20" y1="8" x2="20" y2="14"></line>
                            <line x1="23" y1="11" x2="17" y2="11"></line>
                          </svg>
                        </button>
                      )}
                      <button
                        className="btn-action btn-view"
                        onClick={() => setSelectedRequest(request)}
                        title={`Ver detalles de: ${request.title}`}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                          <circle cx="12" cy="12" r="3"></circle>
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

      {/* Modal de detalles */}
      {selectedRequest && (
        <div className="modal-overlay" onClick={() => setSelectedRequest(null)}>
          <div className="modal modal-large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{selectedRequest.title}</h3>
              <button className="modal-close" onClick={() => setSelectedRequest(null)}>
                ×
              </button>
            </div>

            <div className="modal-body">
              <div className="request-detail-section">
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
                    <label>Estado:</label>
                    {getStatusBadge(selectedRequest.status)}
                  </div>
                  <div>
                    <label>Solicitante:</label>
                    <span>{selectedRequest.requester.name}</span>
                  </div>
                </div>
              </div>

              <div className="request-detail-section">
                <h4>Respuestas del Cuestionario</h4>
                <div className="questionnaire-answers">
                  {selectedRequest.category.questionnaire.map((question: any) => {
                    const answer = selectedRequest.questionnaire_answers[question.field_name];
                    return (
                      <div key={question.field_name} className="answer-row">
                        <label>{question.question}:</label>
                        <span>
                          {Array.isArray(answer)
                            ? answer.join(', ')
                            : typeof answer === 'boolean'
                            ? answer
                              ? 'Sí'
                              : 'No'
                            : answer || 'N/A'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {selectedRequest.rejection_reason && (
                <div className="rejection-notice">
                  <strong>Razón del rechazo:</strong> {selectedRequest.rejection_reason}
                </div>
              )}

              {(selectedRequest.status === 'in_review' || selectedRequest.status === 'pending') && (
                <div className="approval-section">
                  <div className="form-group">
                    <label>Notas Legales (opcional):</label>
                    <textarea
                      value={legalNotes}
                      onChange={(e) => setLegalNotes(e.target.value)}
                      rows={3}
                      placeholder="Agrega notas o comentarios legales..."
                    />
                  </div>

                  <div className="form-group">
                    <label>Razón del Rechazo (si aplica):</label>
                    <textarea
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      rows={3}
                      placeholder="Explica por qué se rechaza esta solicitud..."
                    />
                  </div>

                  <div className="modal-actions">
                    <button
                      className="btn-approve"
                      onClick={() => handleApprove(selectedRequest._id)}
                    >
                      ✓ Aprobar y Generar Contrato
                    </button>
                    <button
                      className="btn-danger"
                      onClick={() => handleReject(selectedRequest._id)}
                      disabled={!rejectionReason.trim()}
                    >
                      × Rechazar Solicitud
                    </button>
                  </div>
                </div>
              )}

              {(selectedRequest.status === 'completed' || selectedRequest.status === 'approved') && (
                <div className="success-notice">
                  ✓ Esta solicitud ya fue aprobada y el contrato fue generado
                </div>
              )}

              {selectedRequest.status === 'rejected' && (
                <div className="rejection-notice">Esta solicitud fue rechazada</div>
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

export default ContractRequestApprovals;
