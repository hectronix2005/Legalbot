import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import DynamicQuestionnaire from './DynamicQuestionnaire';
import './RequestsAndApprovals.css';

// ============ INTERFACES ============
interface ContractCategory {
  _id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  questionnaire: any[];
  template?: {
    _id: string;
    name: string;
  };
}

interface ContractRequest {
  _id: string;
  title: string;
  status: 'pending' | 'in_review' | 'approved' | 'rejected' | 'completed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: { name: string; color: string; questionnaire?: any[] };
  requester?: { name: string; email: string };
  questionnaire_answers: Record<string, any>;
  createdAt: string;
  assigned_lawyer?: { name: string };
  rejection_reason?: string;
  legal_notes?: string;
  generated_contract?: { _id: string; contract_number: string };
}

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

type TabType = 'new-request' | 'my-requests' | 'supplier-approvals' | 'contract-approvals';

const RequestsAndApprovals: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // Determinar tabs disponibles segun rol
  const isRequester = user?.role === 'requester';
  const canApprove = ['super_admin', 'admin', 'lawyer'].includes(user?.role || '');

  // Leer el tab de la URL
  const getTabFromURL = (): TabType => {
    const params = new URLSearchParams(location.search);
    const tab = params.get('tab');
    if (tab === 'new-request' || tab === 'my-requests' || tab === 'supplier-approvals' || tab === 'contract-approvals') {
      return tab;
    }
    // Si no hay tab en URL, usar default segun rol
    if (isRequester) {
      return 'my-requests';
    } else if (canApprove) {
      return 'contract-approvals';
    }
    return 'my-requests';
  };

  const [activeTab, setActiveTab] = useState<TabType>(getTabFromURL());

  // Cambiar tabs y actualizar URL
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    navigate(`?tab=${tab}`, { replace: true });
  };

  // Sincronizar con cambios en URL (boton atras/adelante)
  useEffect(() => {
    const tabFromURL = getTabFromURL();
    if (tabFromURL !== activeTab) {
      setActiveTab(tabFromURL);
    }
  }, [location.search]);

  const renderTabContent = () => {
    switch (activeTab) {
      case 'new-request':
        return <NewRequestTab />;
      case 'my-requests':
        return <MyRequestsTab />;
      case 'supplier-approvals':
        return <SupplierApprovalsTab />;
      case 'contract-approvals':
        return <ContractApprovalsTab />;
      default:
        return null;
    }
  };

  return (
    <div className="requests-approvals-container">
      <div className="page-header">
        <h1>Solicitudes y Aprobaciones</h1>
        <p className="subtitle">Gestiona solicitudes de contratos y aprobaciones de terceros</p>
      </div>

      <div className="tabs-container">
        <div className="tabs-nav">
          {/* Tabs para solicitantes */}
          {(isRequester || canApprove) && (
            <button
              className={`tab-btn ${activeTab === 'new-request' ? 'active' : ''}`}
              onClick={() => handleTabChange('new-request')}
            >
              <span className="tab-icon">📝</span>
              Nueva Solicitud
            </button>
          )}

          <button
            className={`tab-btn ${activeTab === 'my-requests' ? 'active' : ''}`}
            onClick={() => handleTabChange('my-requests')}
          >
            <span className="tab-icon">📋</span>
            Mis Solicitudes
          </button>

          {/* Tabs para aprobadores */}
          {canApprove && (
            <>
              <button
                className={`tab-btn ${activeTab === 'supplier-approvals' ? 'active' : ''}`}
                onClick={() => handleTabChange('supplier-approvals')}
              >
                <span className="tab-icon">👥</span>
                Aprobar Terceros
              </button>

              <button
                className={`tab-btn ${activeTab === 'contract-approvals' ? 'active' : ''}`}
                onClick={() => handleTabChange('contract-approvals')}
              >
                <span className="tab-icon">✅</span>
                Aprobar Solicitudes
              </button>
            </>
          )}
        </div>

        <div className="tab-content">
          {renderTabContent()}
        </div>
      </div>
    </div>
  );
};

// ============ TAB: NUEVA SOLICITUD ============
const NewRequestTab: React.FC = () => {
  const [categories, setCategories] = useState<ContractCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<ContractCategory | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const response = await api.get('/contract-categories');
      setCategories(response.data);
    } catch (error) {
      console.error('Error fetching categories:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCategorySelect = (category: ContractCategory) => {
    setSelectedCategory(category);
    setAnswers({});
    setErrors({});
    setTitle(`${category.name} - `);
  };

  const handleAnswerChange = (fieldName: string, value: any) => {
    setAnswers({ ...answers, [fieldName]: value });
    if (errors[fieldName]) {
      const newErrors = { ...errors };
      delete newErrors[fieldName];
      setErrors(newErrors);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!title || title.trim() === '') {
      newErrors.title = 'El titulo es requerido';
    }
    if (!selectedCategory) return false;

    selectedCategory.questionnaire.forEach((question) => {
      const answer = answers[question.field_name];
      if (question.required && (!answer || answer === '' || (Array.isArray(answer) && answer.length === 0))) {
        newErrors[question.field_name] = `${question.question} es obligatorio`;
      }
      if (answer && question.type === 'email' && !answer.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
        newErrors[question.field_name] = 'Email invalido';
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSubmitting(true);
    try {
      await api.post('/contract-requests-v2', {
        category_id: selectedCategory!._id,
        title: title.trim(),
        questionnaire_answers: answers,
        field_data: answers,
        priority
      });
      alert('Solicitud enviada exitosamente!');
      setSelectedCategory(null);
      setTitle('');
      setAnswers({});
      setPriority('medium');
      setErrors({});
    } catch (error: any) {
      alert(error.response?.data?.error || 'Error al enviar la solicitud');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBack = () => {
    setSelectedCategory(null);
    setAnswers({});
    setErrors({});
  };

  if (loading) {
    return <div className="loading">Cargando categorias...</div>;
  }

  return (
    <div className="new-request-tab">
      {!selectedCategory ? (
        <div className="categories-selection">
          <h2>Selecciona el tipo de contrato</h2>
          {categories.length === 0 ? (
            <div className="empty-state">
              <h3>No hay categorias disponibles</h3>
              <p>Contacta a un administrador para crear categorias de contratos</p>
            </div>
          ) : (
            <div className="categories-grid">
              {categories.map((category) => (
                <div
                  key={category._id}
                  className="category-option"
                  style={{ borderColor: category.color }}
                  onClick={() => handleCategorySelect(category)}
                >
                  <div className="category-icon" style={{ backgroundColor: category.color + '20', color: category.color }}>
                    {category.icon || '📋'}
                  </div>
                  <h3>{category.name}</h3>
                  <p>{category.description}</p>
                  <div className="category-info">
                    <span className="badge">{category.questionnaire.length} preguntas</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="request-form-container">
          <div className="form-header">
            <button className="btn-back" onClick={handleBack}>
              ← Cambiar categoria
            </button>
            <div className="selected-category">
              <div className="category-badge" style={{ backgroundColor: selectedCategory.color }}>
                {selectedCategory.name}
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="form-section">
              <h3>Informacion General</h3>
              <div className="form-group">
                <label>Titulo de la Solicitud <span className="required">*</span></label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    if (errors.title) {
                      const newErrors = { ...errors };
                      delete newErrors.title;
                      setErrors(newErrors);
                    }
                  }}
                  placeholder={`Ej: ${selectedCategory.name} - Nombre del Cliente`}
                  className={errors.title ? 'input-error' : ''}
                />
                {errors.title && <span className="error-message">{errors.title}</span>}
              </div>

              <div className="form-group">
                <label>Prioridad</label>
                <select value={priority} onChange={(e) => setPriority(e.target.value as any)}>
                  <option value="low">Baja</option>
                  <option value="medium">Media</option>
                  <option value="high">Alta</option>
                  <option value="urgent">Urgente</option>
                </select>
              </div>
            </div>

            <div className="form-section">
              <h3>Informacion Especifica del Contrato</h3>
              <DynamicQuestionnaire
                questions={selectedCategory.questionnaire}
                answers={answers}
                onChange={handleAnswerChange}
                errors={errors}
              />
            </div>

            <div className="form-actions">
              <button type="button" className="btn-secondary" onClick={handleBack}>
                Cancelar
              </button>
              <button type="submit" className="btn-primary" disabled={submitting}>
                {submitting ? 'Enviando...' : 'Enviar Solicitud'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

// ============ TAB: MIS SOLICITUDES ============
const MyRequestsTab: React.FC = () => {
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
    const styles: Record<string, { bg: string; color: string; text: string; icon: string }> = {
      pending: { bg: '#fef3c7', color: '#92400e', text: 'Pendiente', icon: '⏳' },
      in_review: { bg: '#dbeafe', color: '#1e40af', text: 'En Revision', icon: '👁️' },
      approved: { bg: '#d1fae5', color: '#065f46', text: 'Aprobado', icon: '✅' },
      rejected: { bg: '#fee2e2', color: '#991b1b', text: 'Rechazado', icon: '❌' },
      completed: { bg: '#d1fae5', color: '#065f46', text: 'Completado', icon: '🎉' }
    };
    const style = styles[status] || styles.pending;
    return (
      <span className="status-badge" style={{ background: style.bg, color: style.color }}>
        {style.icon} {style.text}
      </span>
    );
  };

  const getPriorityBadge = (priority: string) => {
    const styles: Record<string, { bg: string; color: string; text: string }> = {
      low: { bg: '#e5e7eb', color: '#374151', text: 'Baja' },
      medium: { bg: '#fef3c7', color: '#92400e', text: 'Media' },
      high: { bg: '#fed7aa', color: '#9a3412', text: 'Alta' },
      urgent: { bg: '#fecaca', color: '#991b1b', text: 'Urgente' }
    };
    const style = styles[priority] || styles.medium;
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
    <div className="my-requests-tab">
      <div className="filter-bar">
        <button className={filter === 'all' ? 'filter-btn active' : 'filter-btn'} onClick={() => setFilter('all')}>
          Todas
        </button>
        <button className={filter === 'pending' ? 'filter-btn active' : 'filter-btn'} onClick={() => setFilter('pending')}>
          ⏳ Pendientes
        </button>
        <button className={filter === 'in_review' ? 'filter-btn active' : 'filter-btn'} onClick={() => setFilter('in_review')}>
          👁️ En Revision
        </button>
        <button className={filter === 'approved' ? 'filter-btn active' : 'filter-btn'} onClick={() => setFilter('approved')}>
          ✅ Aprobadas
        </button>
        <button className={filter === 'rejected' ? 'filter-btn active' : 'filter-btn'} onClick={() => setFilter('rejected')}>
          ❌ Rechazadas
        </button>
      </div>

      {requests.length === 0 ? (
        <div className="empty-state">
          <h3>No hay solicitudes</h3>
          <p>{filter === 'all' ? 'Aun no has creado ninguna solicitud' : `No tienes solicitudes con estado "${filter}"`}</p>
        </div>
      ) : (
        <div className="requests-grid">
          {requests.map((request) => (
            <div key={request._id} className="request-card" data-status={request.status}>
              <div className="card-header">
                <div className="category-badge" style={{ backgroundColor: request.category.color + '20', color: request.category.color }}>
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
                  <span>{new Date(request.createdAt).toLocaleDateString('es-ES')}</span>
                </div>
              </div>
              {request.rejection_reason && (
                <div className="rejection-notice">
                  <strong>Razon del rechazo:</strong> {request.rejection_reason}
                </div>
              )}
              {request.generated_contract && (
                <div className="contract-notice">
                  <strong>✅ Contrato:</strong> {request.generated_contract.contract_number}
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

      {selectedRequest && (
        <div className="modal-overlay" onClick={() => setSelectedRequest(null)}>
          <div className="modal modal-large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3>{selectedRequest.title}</h3>
                <div style={{ marginTop: '0.5rem' }}>{getStatusBadge(selectedRequest.status)}</div>
              </div>
              <button className="modal-close" onClick={() => setSelectedRequest(null)}>×</button>
            </div>
            <div className="modal-body">
              <div className="detail-section">
                <h4>Informacion General</h4>
                <div className="detail-grid">
                  <div><label>Categoria:</label><span>{selectedRequest.category.name}</span></div>
                  <div><label>Prioridad:</label>{getPriorityBadge(selectedRequest.priority)}</div>
                  <div><label>Fecha:</label><span>{new Date(selectedRequest.createdAt).toLocaleDateString('es-ES')}</span></div>
                </div>
              </div>
              <div className="detail-section">
                <h4>Informacion Proporcionada</h4>
                <div className="answers-list">
                  {Object.entries(selectedRequest.questionnaire_answers).map(([key, value]) => (
                    <div key={key} className="answer-item">
                      <label>{key.replace(/_/g, ' ')}:</label>
                      <span>{Array.isArray(value) ? value.join(', ') : typeof value === 'boolean' ? (value ? 'Si' : 'No') : value || 'N/A'}</span>
                    </div>
                  ))}
                </div>
              </div>
              {selectedRequest.legal_notes && (
                <div className="detail-section">
                  <h4>Notas Legales</h4>
                  <p>{selectedRequest.legal_notes}</p>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setSelectedRequest(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============ TAB: APROBAR TERCEROS ============
const SupplierApprovalsTab: React.FC = () => {
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
      const endpoint = filter === 'pending' ? '/supplier-approvals/pending' : '/supplier-approvals/all';
      const response = await api.get(endpoint);
      setSuppliers(response.data);
    } catch (error) {
      console.error('Error fetching suppliers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    if (!window.confirm('Aprobar este tercero?')) return;
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
      alert('Debes proporcionar una razon del rechazo');
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
    const styles: Record<string, { bg: string; color: string; text: string }> = {
      pending: { bg: '#fef3c7', color: '#92400e', text: 'Pendiente' },
      approved: { bg: '#d1fae5', color: '#065f46', text: 'Aprobado' },
      rejected: { bg: '#fee2e2', color: '#991b1b', text: 'Rechazado' }
    };
    const style = styles[status] || styles.pending;
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
    <div className="supplier-approvals-tab">
      <div className="filter-buttons">
        <button onClick={() => setFilter('pending')} className={filter === 'pending' ? 'btn-primary' : 'btn-secondary'}>
          Pendientes
        </button>
        <button onClick={() => setFilter('all')} className={filter === 'all' ? 'btn-primary' : 'btn-secondary'}>
          Todos
        </button>
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
                <th>Tercero</th>
                <th>Identificacion</th>
                <th>Representante</th>
                <th>Contacto</th>
                <th>Creado Por</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {suppliers.map((supplier) => (
                <tr key={supplier._id} className={`approval-row status-${supplier.approval_status}`}>
                  <td>
                    <div className="supplier-name-info">
                      <strong>{supplier.legal_name}</strong>
                      {supplier.rejection_reason && (
                        <small className="inline-rejection">Rechazado: {supplier.rejection_reason}</small>
                      )}
                    </div>
                  </td>
                  <td>
                    <div className="id-badge">
                      <span className="id-type">{supplier.identification_type}</span>
                      <span className="id-number">{supplier.identification_number}</span>
                    </div>
                  </td>
                  <td>{supplier.legal_representative_name}</td>
                  <td>
                    <div className="contact-info">
                      {supplier.email && <span className="contact-item">📧 {supplier.email}</span>}
                      {supplier.phone && <span className="contact-item">📞 {supplier.phone}</span>}
                      {!supplier.email && !supplier.phone && <span className="no-contact">N/A</span>}
                    </div>
                  </td>
                  <td>
                    <div className="creator-info">
                      <span>{supplier.created_by.name}</span>
                      <small>{new Date(supplier.createdAt).toLocaleDateString('es-ES')}</small>
                    </div>
                  </td>
                  <td>{getStatusBadge(supplier.approval_status)}</td>
                  <td>
                    <div className="action-buttons">
                      {supplier.approval_status === 'pending' && !rejecting && (
                        <>
                          <button className="btn-action btn-approve-action" onClick={() => handleApprove(supplier._id)} title="Aprobar">
                            ✓
                          </button>
                          <button className="btn-action btn-reject-action" onClick={() => setRejecting(supplier._id)} title="Rechazar">
                            ✕
                          </button>
                        </>
                      )}
                      {rejecting === supplier._id && (
                        <div className="inline-rejection-form">
                          <textarea
                            value={rejectionReason}
                            onChange={(e) => setRejectionReason(e.target.value)}
                            rows={2}
                            placeholder="Razon del rechazo..."
                            className="inline-textarea"
                          />
                          <div className="inline-buttons">
                            <button className="btn-action btn-danger-sm" onClick={() => handleReject(supplier._id)}>✓</button>
                            <button className="btn-action btn-cancel-sm" onClick={() => { setRejecting(null); setRejectionReason(''); }}>✕</button>
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

// ============ TAB: APROBAR SOLICITUDES ============
const ContractApprovalsTab: React.FC = () => {
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
    if (!window.confirm('Aprobar y generar contrato automaticamente?')) return;
    try {
      await api.post(`/contract-requests-v2/${id}/approve`, { legal_notes: legalNotes });
      alert('Contrato generado exitosamente!');
      setSelectedRequest(null);
      setLegalNotes('');
      fetchRequests();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Error al aprobar');
    }
  };

  const handleReject = async (id: string) => {
    if (!rejectionReason.trim()) {
      alert('Proporciona una razon del rechazo');
      return;
    }
    try {
      await api.post(`/contract-requests-v2/${id}/reject`, { rejection_reason: rejectionReason });
      alert('Solicitud rechazada');
      setSelectedRequest(null);
      setRejectionReason('');
      fetchRequests();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Error al rechazar');
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, { bg: string; color: string; text: string }> = {
      pending: { bg: '#fef3c7', color: '#92400e', text: 'Pendiente' },
      in_review: { bg: '#dbeafe', color: '#1e40af', text: 'En Revision' },
      approved: { bg: '#d1fae5', color: '#065f46', text: 'Aprobado' },
      rejected: { bg: '#fee2e2', color: '#991b1b', text: 'Rechazado' },
      completed: { bg: '#d1fae5', color: '#065f46', text: 'Completado' }
    };
    const style = styles[status] || styles.pending;
    return (
      <span className="status-badge" style={{ background: style.bg, color: style.color }}>
        {style.text}
      </span>
    );
  };

  const getPriorityBadge = (priority: string) => {
    const styles: Record<string, { bg: string; color: string; text: string }> = {
      low: { bg: '#e5e7eb', color: '#374151', text: 'Baja' },
      medium: { bg: '#fef3c7', color: '#92400e', text: 'Media' },
      high: { bg: '#fed7aa', color: '#9a3412', text: 'Alta' },
      urgent: { bg: '#fecaca', color: '#991b1b', text: 'Urgente' }
    };
    const style = styles[priority] || styles.medium;
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
    <div className="contract-approvals-tab">
      {requests.length === 0 ? (
        <div className="empty-state">
          <h3>No hay solicitudes</h3>
          <p>Las solicitudes apareceran aqui cuando sean creadas</p>
        </div>
      ) : (
        <div className="requests-table-wrapper">
          <table className="requests-table">
            <thead>
              <tr>
                <th>Solicitud</th>
                <th>Categoria</th>
                <th>Prioridad</th>
                <th>Solicitante</th>
                <th>Fecha</th>
                <th>Asignado</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((request) => (
                <tr key={request._id} className={`request-row status-${request.status}`}>
                  <td><strong>{request.title}</strong></td>
                  <td>
                    <span className="category-badge-compact" style={{ background: request.category.color + '20', color: request.category.color }}>
                      {request.category.name}
                    </span>
                  </td>
                  <td>{getPriorityBadge(request.priority)}</td>
                  <td>{request.requester?.name || 'N/A'}</td>
                  <td>{new Date(request.createdAt).toLocaleDateString('es-ES')}</td>
                  <td>{request.assigned_lawyer?.name || <span className="not-assigned">No asignado</span>}</td>
                  <td>{getStatusBadge(request.status)}</td>
                  <td>
                    <div className="action-buttons">
                      {request.status === 'pending' && (
                        <button className="btn-action btn-assign" onClick={() => handleAssign(request._id)} title="Asignarme">
                          👤+
                        </button>
                      )}
                      <button className="btn-action btn-view" onClick={() => setSelectedRequest(request)} title="Ver detalles">
                        👁️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedRequest && (
        <div className="modal-overlay" onClick={() => setSelectedRequest(null)}>
          <div className="modal modal-large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{selectedRequest.title}</h3>
              <button className="modal-close" onClick={() => setSelectedRequest(null)}>×</button>
            </div>
            <div className="modal-body">
              <div className="request-detail-section">
                <h4>Informacion General</h4>
                <div className="detail-grid">
                  <div><label>Categoria:</label><span>{selectedRequest.category.name}</span></div>
                  <div><label>Prioridad:</label>{getPriorityBadge(selectedRequest.priority)}</div>
                  <div><label>Estado:</label>{getStatusBadge(selectedRequest.status)}</div>
                  <div><label>Solicitante:</label><span>{selectedRequest.requester?.name || 'N/A'}</span></div>
                </div>
              </div>

              <div className="request-detail-section">
                <h4>Respuestas del Cuestionario</h4>
                <div className="questionnaire-answers">
                  {selectedRequest.category.questionnaire?.map((question: any) => {
                    const answer = selectedRequest.questionnaire_answers[question.field_name];
                    return (
                      <div key={question.field_name} className="answer-row">
                        <label>{question.question}:</label>
                        <span>{Array.isArray(answer) ? answer.join(', ') : typeof answer === 'boolean' ? (answer ? 'Si' : 'No') : answer || 'N/A'}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {selectedRequest.rejection_reason && (
                <div className="rejection-notice">
                  <strong>Razon del rechazo:</strong> {selectedRequest.rejection_reason}
                </div>
              )}

              {(selectedRequest.status === 'in_review' || selectedRequest.status === 'pending') && (
                <div className="approval-section">
                  <div className="form-group">
                    <label>Notas Legales (opcional):</label>
                    <textarea value={legalNotes} onChange={(e) => setLegalNotes(e.target.value)} rows={3} placeholder="Agrega notas o comentarios legales..." />
                  </div>
                  <div className="form-group">
                    <label>Razon del Rechazo (si aplica):</label>
                    <textarea value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} rows={3} placeholder="Explica por que se rechaza..." />
                  </div>
                  <div className="modal-actions">
                    <button className="btn-approve" onClick={() => handleApprove(selectedRequest._id)}>
                      ✓ Aprobar y Generar Contrato
                    </button>
                    <button className="btn-danger" onClick={() => handleReject(selectedRequest._id)} disabled={!rejectionReason.trim()}>
                      × Rechazar Solicitud
                    </button>
                  </div>
                </div>
              )}

              {(selectedRequest.status === 'completed' || selectedRequest.status === 'approved') && (
                <div className="success-notice">✓ Esta solicitud ya fue aprobada y el contrato fue generado</div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setSelectedRequest(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RequestsAndApprovals;
