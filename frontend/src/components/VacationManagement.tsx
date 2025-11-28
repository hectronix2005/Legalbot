import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import './VacationManagement.css';

// ============ INTERFACES ============
interface VacationBalance {
  _id: string;
  employeeId: {
    _id: string;
    name: string;
    email: string;
  };
  hireDate: string;
  leaderId?: {
    _id: string;
    name: string;
    email: string;
  };
  position?: string;
  department?: string;
  accruedDays: number;
  enjoyedDays: number;
  historicalEnjoyedDays: number;
  approvedPendingDays: number;
  availableDays: number;
  workTimeFactor: number;
  calculationBase: string;
}

interface VacationRequest {
  _id: string;
  employeeId: {
    _id: string;
    name: string;
    email: string;
  };
  requestedDays: number;
  startDate: string;
  endDate: string;
  status: string;
  employeeNotes?: string;
  leaderId?: {
    _id: string;
    name: string;
  };
  leaderApprovalDate?: string;
  leaderComments?: string;
  hrApproverId?: {
    _id: string;
    name: string;
  };
  hrApprovalDate?: string;
  hrComments?: string;
  rejectionReason?: string;
  rejectedBy?: string;
  requestDate: string;
  approvalStage?: {
    stage: number;
    label: string;
    color: string;
  };
}

interface HistoricalRecord {
  _id: string;
  employeeId: string;
  servicePeriod: {
    startDate: string;
    endDate: string;
  };
  daysEnjoyed: number;
  enjoyedStartDate: string;
  enjoyedEndDate: string;
  type: string;
  supportDocument?: string;
  notes?: string;
  isVerified: boolean;
  registeredBy: {
    name: string;
    email: string;
  };
  verifiedBy?: {
    name: string;
  };
}

interface User {
  _id: string;
  name: string;
  email: string;
  role: string;
}

type TabType = 'my-balance' | 'my-requests' | 'new-request' | 'leader-approvals' | 'hr-approvals' | 'employees' | 'historical';

const VacationManagement: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // Determinar permisos basados en el rol del usuario
  const userRole = user?.role;
  const isEmployee = true; // Todos pueden ver su balance
  const isLeader = userRole === 'admin' || userRole === 'talento_humano' || userRole === 'super_admin';
  const isHR = userRole === 'talento_humano' || userRole === 'admin' || userRole === 'super_admin';

  const getTabFromURL = (): TabType => {
    const params = new URLSearchParams(location.search);
    const tab = params.get('tab');
    const validTabs: TabType[] = ['my-balance', 'my-requests', 'new-request', 'leader-approvals', 'hr-approvals', 'employees', 'historical'];
    if (tab && validTabs.includes(tab as TabType)) {
      return tab as TabType;
    }
    return 'my-balance';
  };

  const [activeTab, setActiveTab] = useState<TabType>(getTabFromURL());

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    navigate(`?tab=${tab}`, { replace: true });
  };

  useEffect(() => {
    const tabFromURL = getTabFromURL();
    if (tabFromURL !== activeTab) {
      setActiveTab(tabFromURL);
    }
  }, [location.search]);

  const renderTabContent = () => {
    switch (activeTab) {
      case 'my-balance':
        return <MyBalanceTab />;
      case 'my-requests':
        return <MyRequestsTab />;
      case 'new-request':
        return <NewRequestTab onSuccess={() => handleTabChange('my-requests')} />;
      case 'leader-approvals':
        return <LeaderApprovalsTab />;
      case 'hr-approvals':
        return <HRApprovalsTab />;
      case 'employees':
        return <EmployeesTab />;
      case 'historical':
        return <HistoricalTab />;
      default:
        return <MyBalanceTab />;
    }
  };

  return (
    <div className="vacation-management">
      <div className="vacation-header">
        <h1>Gestión de Vacaciones</h1>
        <p className="subtitle">Sistema según legislación colombiana (CST Art. 186)</p>
      </div>

      <div className="vacation-tabs">
        <button
          className={`tab-btn ${activeTab === 'my-balance' ? 'active' : ''}`}
          onClick={() => handleTabChange('my-balance')}
        >
          Mi Balance
        </button>
        <button
          className={`tab-btn ${activeTab === 'my-requests' ? 'active' : ''}`}
          onClick={() => handleTabChange('my-requests')}
        >
          Mis Solicitudes
        </button>
        <button
          className={`tab-btn ${activeTab === 'new-request' ? 'active' : ''}`}
          onClick={() => handleTabChange('new-request')}
        >
          Nueva Solicitud
        </button>
        {isLeader && (
          <button
            className={`tab-btn ${activeTab === 'leader-approvals' ? 'active' : ''}`}
            onClick={() => handleTabChange('leader-approvals')}
          >
            Aprobaciones (Líder)
          </button>
        )}
        {isHR && (
          <>
            <button
              className={`tab-btn ${activeTab === 'hr-approvals' ? 'active' : ''}`}
              onClick={() => handleTabChange('hr-approvals')}
            >
              Aprobaciones (TH)
            </button>
            <button
              className={`tab-btn ${activeTab === 'employees' ? 'active' : ''}`}
              onClick={() => handleTabChange('employees')}
            >
              Empleados
            </button>
            <button
              className={`tab-btn ${activeTab === 'historical' ? 'active' : ''}`}
              onClick={() => handleTabChange('historical')}
            >
              Histórico
            </button>
          </>
        )}
      </div>

      <div className="tab-content">
        {renderTabContent()}
      </div>
    </div>
  );
};

// ============ MY BALANCE TAB ============
const MyBalanceTab: React.FC = () => {
  const [balance, setBalance] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchBalance();
  }, []);

  const fetchBalance = async () => {
    try {
      setLoading(true);
      const response = await api.get('/vacations-v2/my-balance');
      setBalance(response.data.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error cargando balance');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="loading">Cargando balance...</div>;
  if (error) return <div className="error-message">{error}</div>;
  if (!balance) return <div className="no-data">No tienes balance de vacaciones configurado. Contacta a Talento Humano.</div>;

  const { summary, causacion } = balance;

  return (
    <div className="balance-view">
      <div className="balance-cards">
        <div className="balance-card primary">
          <h3>Días Disponibles</h3>
          <div className="balance-value">{summary.availableDays.toFixed(2)}</div>
          <p>días hábiles</p>
        </div>
        <div className="balance-card">
          <h3>Días Causados</h3>
          <div className="balance-value">{summary.accruedDays.toFixed(2)}</div>
          <p>total acumulado</p>
        </div>
        <div className="balance-card">
          <h3>Días Disfrutados</h3>
          <div className="balance-value">{summary.totalEnjoyedDays.toFixed(2)}</div>
          <p>{summary.historicalEnjoyedDays > 0 && `(${summary.historicalEnjoyedDays} históricos)`}</p>
        </div>
        <div className="balance-card">
          <h3>Días Pendientes</h3>
          <div className="balance-value">{summary.approvedPendingDays.toFixed(2)}</div>
          <p>aprobados por disfrutar</p>
        </div>
      </div>

      <div className="balance-details">
        <h3>Información Laboral</h3>
        <div className="details-grid">
          <div className="detail-item">
            <label>Fecha de Contratación:</label>
            <span>{new Date(balance.balance.hireDate).toLocaleDateString('es-CO')}</span>
          </div>
          <div className="detail-item">
            <label>Años de Servicio:</label>
            <span>{summary.yearsOfService.toFixed(2)} años</span>
          </div>
          <div className="detail-item">
            <label>Factor de Jornada:</label>
            <span>{(summary.workTimeFactor * 100).toFixed(0)}% ({summary.workTimeFactor === 1 ? 'Tiempo completo' : 'Tiempo parcial'})</span>
          </div>
          <div className="detail-item">
            <label>Base de Cálculo:</label>
            <span>{summary.calculationBase} días</span>
          </div>
        </div>
      </div>

      {causacion && (
        <div className="causation-info">
          <h3>Cálculo de Causación</h3>
          <p className="formula">
            Fórmula: (Días trabajados / {causacion.base}) × 15 días = {causacion.diasCausados.toFixed(4)} días
          </p>
          <div className="details-grid">
            <div className="detail-item">
              <label>Días Calendario:</label>
              <span>{causacion.diasCalendario}</span>
            </div>
            <div className="detail-item">
              <label>Días Trabajados:</label>
              <span>{causacion.diasTrabajados}</span>
            </div>
            <div className="detail-item">
              <label>Tasa Diaria:</label>
              <span>{causacion.tasaDiaria.toFixed(6)} días/día</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============ MY REQUESTS TAB ============
const MyRequestsTab: React.FC = () => {
  const [requests, setRequests] = useState<VacationRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const response = await api.get('/vacations-v2/requests/my');
      setRequests(response.data.data.requests);
    } catch (err) {
      console.error('Error fetching requests:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (request: VacationRequest) => {
    const statusMap: Record<string, { label: string; class: string }> = {
      requested: { label: 'Pendiente Líder', class: 'warning' },
      leader_approved: { label: 'Pendiente TH', class: 'info' },
      leader_rejected: { label: 'Rechazada (Líder)', class: 'error' },
      hr_approved: { label: 'Aprobada', class: 'success' },
      hr_rejected: { label: 'Rechazada (TH)', class: 'error' },
      scheduled: { label: 'Programada', class: 'success' },
      enjoyed: { label: 'Disfrutada', class: 'default' },
      cancelled: { label: 'Cancelada', class: 'default' }
    };
    const status = statusMap[request.status] || { label: request.status, class: 'default' };
    return <span className={`status-badge ${status.class}`}>{status.label}</span>;
  };

  if (loading) return <div className="loading">Cargando solicitudes...</div>;

  return (
    <div className="requests-list">
      <h3>Mis Solicitudes de Vacaciones</h3>
      {requests.length === 0 ? (
        <div className="no-data">No tienes solicitudes de vacaciones</div>
      ) : (
        <table className="requests-table">
          <thead>
            <tr>
              <th>Fecha Solicitud</th>
              <th>Días</th>
              <th>Período</th>
              <th>Estado</th>
              <th>Notas</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((req) => (
              <tr key={req._id}>
                <td>{new Date(req.requestDate).toLocaleDateString('es-CO')}</td>
                <td>{req.requestedDays}</td>
                <td>
                  {new Date(req.startDate).toLocaleDateString('es-CO')} - {new Date(req.endDate).toLocaleDateString('es-CO')}
                </td>
                <td>{getStatusBadge(req)}</td>
                <td>
                  {req.rejectionReason && (
                    <span className="rejection-reason">Rechazo: {req.rejectionReason}</span>
                  )}
                  {req.leaderComments && (
                    <span className="comment">Líder: {req.leaderComments}</span>
                  )}
                  {req.hrComments && (
                    <span className="comment">TH: {req.hrComments}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

// ============ NEW REQUEST TAB ============
interface NewRequestTabProps {
  onSuccess?: () => void;
}

const NewRequestTab: React.FC<NewRequestTabProps> = ({ onSuccess }) => {
  const [formData, setFormData] = useState({
    requestedDays: '',
    startDate: '',
    endDate: '',
    employeeNotes: ''
  });
  const [balance, setBalance] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetchBalance();
  }, []);

  const fetchBalance = async () => {
    try {
      const response = await api.get('/vacations-v2/my-balance');
      setBalance(response.data.data);
    } catch (err) {
      console.error('Error fetching balance:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await api.post('/vacations-v2/requests', {
        requestedDays: parseFloat(formData.requestedDays),
        startDate: formData.startDate,
        endDate: formData.endDate,
        employeeNotes: formData.employeeNotes || undefined
      });

      setSuccess(true);
      setFormData({ requestedDays: '', startDate: '', endDate: '', employeeNotes: '' });
      setTimeout(() => {
        if (onSuccess) onSuccess();
      }, 2000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error creando solicitud');
    } finally {
      setLoading(false);
    }
  };

  if (!balance) {
    return <div className="no-data">No tienes balance de vacaciones configurado. Contacta a Talento Humano.</div>;
  }

  return (
    <div className="new-request-form">
      <h3>Nueva Solicitud de Vacaciones</h3>

      <div className="balance-summary">
        <p><strong>Días disponibles:</strong> {balance.summary.availableDays.toFixed(2)} días</p>
      </div>

      {success && (
        <div className="success-message">
          Solicitud creada exitosamente. Será revisada por tu líder y luego por Talento Humano.
        </div>
      )}

      {error && <div className="error-message">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="form-row">
          <div className="form-group">
            <label>Días Solicitados *</label>
            <input
              type="number"
              step="0.5"
              min="0.5"
              max={balance.summary.availableDays}
              value={formData.requestedDays}
              onChange={(e) => setFormData({ ...formData, requestedDays: e.target.value })}
              required
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Fecha Inicio *</label>
            <input
              type="date"
              value={formData.startDate}
              onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
              min={new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
              required
            />
          </div>
          <div className="form-group">
            <label>Fecha Fin *</label>
            <input
              type="date"
              value={formData.endDate}
              onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
              min={formData.startDate || new Date().toISOString().split('T')[0]}
              required
            />
          </div>
        </div>

        <div className="form-group">
          <label>Observaciones (opcional)</label>
          <textarea
            value={formData.employeeNotes}
            onChange={(e) => setFormData({ ...formData, employeeNotes: e.target.value })}
            maxLength={500}
            rows={3}
            placeholder="Agrega cualquier observación relevante..."
          />
        </div>

        <div className="form-info">
          <p>El flujo de aprobación es:</p>
          <ol>
            <li>Aprobación del Líder/Jefe inmediato</li>
            <li>Aprobación de Talento Humano</li>
          </ol>
          <p>Recibirás notificación cuando tu solicitud sea procesada.</p>
        </div>

        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Enviando...' : 'Enviar Solicitud'}
        </button>
      </form>
    </div>
  );
};

// ============ LEADER APPROVALS TAB ============
const LeaderApprovalsTab: React.FC = () => {
  const [requests, setRequests] = useState<VacationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectModal, setRejectModal] = useState<{ open: boolean; requestId: string | null; reason: string }>({
    open: false, requestId: null, reason: ''
  });

  useEffect(() => {
    fetchPending();
  }, []);

  const fetchPending = async () => {
    try {
      setLoading(true);
      const response = await api.get('/vacations-v2/pending/leader');
      setRequests(response.data.data);
    } catch (err) {
      console.error('Error fetching pending:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (requestId: string) => {
    try {
      setActionLoading(requestId);
      await api.put(`/vacations-v2/requests/${requestId}/approve-leader`, {
        comments: 'Aprobado'
      });
      fetchPending();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Error aprobando solicitud');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async () => {
    if (!rejectModal.requestId || !rejectModal.reason.trim()) return;

    try {
      setActionLoading(rejectModal.requestId);
      await api.put(`/vacations-v2/requests/${rejectModal.requestId}/reject-leader`, {
        reason: rejectModal.reason
      });
      setRejectModal({ open: false, requestId: null, reason: '' });
      fetchPending();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Error rechazando solicitud');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) return <div className="loading">Cargando solicitudes pendientes...</div>;

  return (
    <div className="approvals-list">
      <h3>Solicitudes Pendientes de Aprobación (Líder)</h3>
      {requests.length === 0 ? (
        <div className="no-data">No hay solicitudes pendientes de aprobación</div>
      ) : (
        <table className="requests-table">
          <thead>
            <tr>
              <th>Empleado</th>
              <th>Fecha Solicitud</th>
              <th>Días</th>
              <th>Período</th>
              <th>Notas</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((req) => (
              <tr key={req._id}>
                <td>
                  <strong>{req.employeeId.name}</strong>
                  <br />
                  <small>{req.employeeId.email}</small>
                </td>
                <td>{new Date(req.requestDate).toLocaleDateString('es-CO')}</td>
                <td>{req.requestedDays}</td>
                <td>
                  {new Date(req.startDate).toLocaleDateString('es-CO')} - {new Date(req.endDate).toLocaleDateString('es-CO')}
                </td>
                <td>{req.employeeNotes || '-'}</td>
                <td>
                  <div className="action-buttons">
                    <button
                      className="btn-approve"
                      onClick={() => handleApprove(req._id)}
                      disabled={actionLoading === req._id}
                    >
                      Aprobar
                    </button>
                    <button
                      className="btn-reject"
                      onClick={() => setRejectModal({ open: true, requestId: req._id, reason: '' })}
                      disabled={actionLoading === req._id}
                    >
                      Rechazar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {rejectModal.open && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Rechazar Solicitud</h3>
            <div className="form-group">
              <label>Razón del rechazo *</label>
              <textarea
                value={rejectModal.reason}
                onChange={(e) => setRejectModal({ ...rejectModal, reason: e.target.value })}
                rows={3}
                placeholder="Explica la razón del rechazo..."
              />
            </div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setRejectModal({ open: false, requestId: null, reason: '' })}>
                Cancelar
              </button>
              <button className="btn-reject" onClick={handleReject} disabled={!rejectModal.reason.trim()}>
                Confirmar Rechazo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============ HR APPROVALS TAB ============
const HRApprovalsTab: React.FC = () => {
  const [requests, setRequests] = useState<VacationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectModal, setRejectModal] = useState<{ open: boolean; requestId: string | null; reason: string }>({
    open: false, requestId: null, reason: ''
  });

  useEffect(() => {
    fetchPending();
  }, []);

  const fetchPending = async () => {
    try {
      setLoading(true);
      const response = await api.get('/vacations-v2/pending/hr');
      setRequests(response.data.data);
    } catch (err) {
      console.error('Error fetching pending:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (requestId: string) => {
    try {
      setActionLoading(requestId);
      await api.put(`/vacations-v2/requests/${requestId}/approve-hr`, {
        comments: 'Aprobado por Talento Humano'
      });
      fetchPending();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Error aprobando solicitud');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async () => {
    if (!rejectModal.requestId || !rejectModal.reason.trim()) return;

    try {
      setActionLoading(rejectModal.requestId);
      await api.put(`/vacations-v2/requests/${rejectModal.requestId}/reject-hr`, {
        reason: rejectModal.reason
      });
      setRejectModal({ open: false, requestId: null, reason: '' });
      fetchPending();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Error rechazando solicitud');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) return <div className="loading">Cargando solicitudes pendientes...</div>;

  return (
    <div className="approvals-list">
      <h3>Solicitudes Pendientes de Aprobación (Talento Humano)</h3>
      <p className="info-text">Estas solicitudes ya fueron aprobadas por el líder y requieren aprobación final.</p>

      {requests.length === 0 ? (
        <div className="no-data">No hay solicitudes pendientes de aprobación</div>
      ) : (
        <table className="requests-table">
          <thead>
            <tr>
              <th>Empleado</th>
              <th>Fecha Solicitud</th>
              <th>Días</th>
              <th>Período</th>
              <th>Aprobado por Líder</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((req) => (
              <tr key={req._id}>
                <td>
                  <strong>{req.employeeId.name}</strong>
                  <br />
                  <small>{req.employeeId.email}</small>
                </td>
                <td>{new Date(req.requestDate).toLocaleDateString('es-CO')}</td>
                <td>{req.requestedDays}</td>
                <td>
                  {new Date(req.startDate).toLocaleDateString('es-CO')} - {new Date(req.endDate).toLocaleDateString('es-CO')}
                </td>
                <td>
                  {req.leaderId?.name || 'N/A'}
                  <br />
                  <small>{req.leaderApprovalDate && new Date(req.leaderApprovalDate).toLocaleDateString('es-CO')}</small>
                </td>
                <td>
                  <div className="action-buttons">
                    <button
                      className="btn-approve"
                      onClick={() => handleApprove(req._id)}
                      disabled={actionLoading === req._id}
                    >
                      Aprobar (Final)
                    </button>
                    <button
                      className="btn-reject"
                      onClick={() => setRejectModal({ open: true, requestId: req._id, reason: '' })}
                      disabled={actionLoading === req._id}
                    >
                      Rechazar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {rejectModal.open && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Rechazar Solicitud</h3>
            <div className="form-group">
              <label>Razón del rechazo *</label>
              <textarea
                value={rejectModal.reason}
                onChange={(e) => setRejectModal({ ...rejectModal, reason: e.target.value })}
                rows={3}
                placeholder="Explica la razón del rechazo..."
              />
            </div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setRejectModal({ open: false, requestId: null, reason: '' })}>
                Cancelar
              </button>
              <button className="btn-reject" onClick={handleReject} disabled={!rejectModal.reason.trim()}>
                Confirmar Rechazo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============ EMPLOYEES TAB (HR) ============
const EmployeesTab: React.FC = () => {
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInitForm, setShowInitForm] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [formData, setFormData] = useState({
    employeeId: '',
    hireDate: '',
    leaderId: '',
    position: '',
    department: '',
    historicalEnjoyedDays: '0'
  });
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    fetchEmployees();
    fetchUsers();
  }, []);

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const response = await api.get('/vacations-v2/employees');
      setEmployees(response.data.data);
    } catch (err) {
      console.error('Error fetching employees:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await api.get('/users');
      setUsers(response.data.users || response.data);
    } catch (err) {
      console.error('Error fetching users:', err);
    }
  };

  const handleInitialize = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError(null);

    try {
      await api.post('/vacations-v2/balance/initialize', {
        employeeId: formData.employeeId,
        hireDate: formData.hireDate,
        leaderId: formData.leaderId || undefined,
        position: formData.position || undefined,
        department: formData.department || undefined,
        historicalEnjoyedDays: parseFloat(formData.historicalEnjoyedDays) || 0
      });

      setShowInitForm(false);
      setFormData({ employeeId: '', hireDate: '', leaderId: '', position: '', department: '', historicalEnjoyedDays: '0' });
      fetchEmployees();
    } catch (err: any) {
      setFormError(err.response?.data?.error || 'Error inicializando balance');
    } finally {
      setFormLoading(false);
    }
  };

  if (loading) return <div className="loading">Cargando empleados...</div>;

  return (
    <div className="employees-list">
      <div className="list-header">
        <h3>Gestión de Empleados</h3>
        <button className="btn-primary" onClick={() => setShowInitForm(true)}>
          + Inicializar Empleado
        </button>
      </div>

      {employees.length === 0 ? (
        <div className="no-data">No hay empleados con balance de vacaciones</div>
      ) : (
        <table className="employees-table">
          <thead>
            <tr>
              <th>Empleado</th>
              <th>Departamento</th>
              <th>Líder</th>
              <th>Años Servicio</th>
              <th>Causados</th>
              <th>Disfrutados</th>
              <th>Disponibles</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((emp) => (
              <tr key={emp._id}>
                <td>
                  <strong>{emp.employeeId?.name || 'N/A'}</strong>
                  <br />
                  <small>{emp.position || '-'}</small>
                </td>
                <td>{emp.department || '-'}</td>
                <td>{emp.leaderId?.name || '-'}</td>
                <td>{emp.yearsOfService?.toFixed(2) || '0'}</td>
                <td>{emp.accruedDays?.toFixed(2) || '0'}</td>
                <td>
                  {emp.enjoyedDays?.toFixed(2) || '0'}
                  {emp.historicalEnjoyedDays > 0 && (
                    <small> (+{emp.historicalEnjoyedDays} hist.)</small>
                  )}
                </td>
                <td><strong>{emp.availableDays?.toFixed(2) || '0'}</strong></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showInitForm && (
        <div className="modal-overlay">
          <div className="modal wide">
            <h3>Inicializar Balance de Empleado</h3>
            {formError && <div className="error-message">{formError}</div>}

            <form onSubmit={handleInitialize}>
              <div className="form-row">
                <div className="form-group">
                  <label>Empleado *</label>
                  <select
                    value={formData.employeeId}
                    onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                    required
                  >
                    <option value="">Seleccionar...</option>
                    {users.map((u) => (
                      <option key={u._id} value={u._id}>{u.name} ({u.email})</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Fecha de Contratación *</label>
                  <input
                    type="date"
                    value={formData.hireDate}
                    onChange={(e) => setFormData({ ...formData, hireDate: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Líder/Jefe Inmediato</label>
                  <select
                    value={formData.leaderId}
                    onChange={(e) => setFormData({ ...formData, leaderId: e.target.value })}
                  >
                    <option value="">Seleccionar...</option>
                    {users.filter(u => ['admin', 'talento_humano'].includes(u.role)).map((u) => (
                      <option key={u._id} value={u._id}>{u.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Cargo</label>
                  <input
                    type="text"
                    value={formData.position}
                    onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                    placeholder="Ej: Desarrollador Senior"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Departamento</label>
                  <input
                    type="text"
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    placeholder="Ej: Tecnología"
                  />
                </div>
                <div className="form-group">
                  <label>Días Históricos Disfrutados</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={formData.historicalEnjoyedDays}
                    onChange={(e) => setFormData({ ...formData, historicalEnjoyedDays: e.target.value })}
                    placeholder="Días disfrutados antes del sistema"
                  />
                  <small>Vacaciones disfrutadas antes de implementar el sistema</small>
                </div>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowInitForm(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn-primary" disabled={formLoading}>
                  {formLoading ? 'Guardando...' : 'Inicializar Balance'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// ============ HISTORICAL TAB (HR) ============
const HistoricalTab: React.FC = () => {
  const [employees, setEmployees] = useState<any[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<string>('');
  const [history, setHistory] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    daysEnjoyed: '',
    enjoyedStartDate: '',
    enjoyedEndDate: '',
    supportDocument: '',
    notes: ''
  });
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      const response = await api.get('/vacations-v2/employees');
      setEmployees(response.data.data);
    } catch (err) {
      console.error('Error fetching employees:', err);
    }
  };

  const fetchHistory = async (employeeId: string) => {
    try {
      setLoading(true);
      const response = await api.get(`/vacations-v2/historical/${employeeId}`);
      setHistory(response.data.data);
    } catch (err) {
      console.error('Error fetching history:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleEmployeeSelect = (employeeId: string) => {
    setSelectedEmployee(employeeId);
    if (employeeId) {
      fetchHistory(employeeId);
    } else {
      setHistory(null);
    }
  };

  const handleAddHistorical = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployee) return;

    setFormLoading(true);
    setFormError(null);

    try {
      await api.post('/vacations-v2/historical', {
        employeeId: selectedEmployee,
        daysEnjoyed: parseFloat(formData.daysEnjoyed),
        enjoyedStartDate: formData.enjoyedStartDate,
        enjoyedEndDate: formData.enjoyedEndDate,
        supportDocument: formData.supportDocument || undefined,
        notes: formData.notes || undefined
      });

      setShowAddForm(false);
      setFormData({ daysEnjoyed: '', enjoyedStartDate: '', enjoyedEndDate: '', supportDocument: '', notes: '' });
      fetchHistory(selectedEmployee);
    } catch (err: any) {
      setFormError(err.response?.data?.error || 'Error registrando histórico');
    } finally {
      setFormLoading(false);
    }
  };

  const handleVerify = async (recordId: string) => {
    try {
      await api.put(`/vacations-v2/historical/${recordId}/verify`);
      fetchHistory(selectedEmployee);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Error verificando registro');
    }
  };

  return (
    <div className="historical-tab">
      <h3>Registro de Vacaciones Históricas</h3>
      <p className="info-text">Registra vacaciones disfrutadas antes de la implementación del sistema.</p>

      <div className="form-group">
        <label>Seleccionar Empleado</label>
        <select
          value={selectedEmployee}
          onChange={(e) => handleEmployeeSelect(e.target.value)}
        >
          <option value="">Seleccionar empleado...</option>
          {employees.map((emp) => (
            <option key={emp._id} value={emp.employeeId?._id}>
              {emp.employeeId?.name} - {emp.department || 'Sin departamento'}
            </option>
          ))}
        </select>
      </div>

      {selectedEmployee && (
        <>
          <div className="historical-actions">
            <button className="btn-primary" onClick={() => setShowAddForm(true)}>
              + Agregar Registro Histórico
            </button>
          </div>

          {loading ? (
            <div className="loading">Cargando historial...</div>
          ) : history ? (
            <>
              <div className="historical-summary">
                <div className="summary-card">
                  <label>Total Registros</label>
                  <span>{history.summary.totalRecords}</span>
                </div>
                <div className="summary-card">
                  <label>Total Días</label>
                  <span>{history.summary.totalDays.toFixed(2)}</span>
                </div>
                <div className="summary-card">
                  <label>Verificados</label>
                  <span>{history.summary.verifiedDays.toFixed(2)}</span>
                </div>
                <div className="summary-card">
                  <label>Pendientes Verificación</label>
                  <span>{history.summary.pendingVerificationCount}</span>
                </div>
              </div>

              {history.records.length > 0 && (
                <table className="historical-table">
                  <thead>
                    <tr>
                      <th>Período</th>
                      <th>Días</th>
                      <th>Documento</th>
                      <th>Registrado Por</th>
                      <th>Estado</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.records.map((record: HistoricalRecord) => (
                      <tr key={record._id}>
                        <td>
                          {new Date(record.enjoyedStartDate).toLocaleDateString('es-CO')} - {new Date(record.enjoyedEndDate).toLocaleDateString('es-CO')}
                        </td>
                        <td>{record.daysEnjoyed}</td>
                        <td>{record.supportDocument || '-'}</td>
                        <td>{record.registeredBy?.name || 'N/A'}</td>
                        <td>
                          {record.isVerified ? (
                            <span className="status-badge success">Verificado</span>
                          ) : (
                            <span className="status-badge warning">Pendiente</span>
                          )}
                        </td>
                        <td>
                          {!record.isVerified && (
                            <button className="btn-small" onClick={() => handleVerify(record._id)}>
                              Verificar
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          ) : (
            <div className="no-data">No hay registros históricos</div>
          )}
        </>
      )}

      {showAddForm && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Agregar Registro Histórico</h3>
            {formError && <div className="error-message">{formError}</div>}

            <form onSubmit={handleAddHistorical}>
              <div className="form-group">
                <label>Días Disfrutados *</label>
                <input
                  type="number"
                  step="0.5"
                  min="0.5"
                  value={formData.daysEnjoyed}
                  onChange={(e) => setFormData({ ...formData, daysEnjoyed: e.target.value })}
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Fecha Inicio *</label>
                  <input
                    type="date"
                    value={formData.enjoyedStartDate}
                    onChange={(e) => setFormData({ ...formData, enjoyedStartDate: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Fecha Fin *</label>
                  <input
                    type="date"
                    value={formData.enjoyedEndDate}
                    onChange={(e) => setFormData({ ...formData, enjoyedEndDate: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Documento de Soporte</label>
                <input
                  type="text"
                  value={formData.supportDocument}
                  onChange={(e) => setFormData({ ...formData, supportDocument: e.target.value })}
                  placeholder="Ej: Resolución No. 001-2023"
                />
              </div>

              <div className="form-group">
                <label>Notas</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={2}
                  placeholder="Observaciones adicionales..."
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowAddForm(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn-primary" disabled={formLoading}>
                  {formLoading ? 'Guardando...' : 'Guardar Registro'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default VacationManagement;
