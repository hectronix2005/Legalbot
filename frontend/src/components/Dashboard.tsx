import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import RoleGuard from './RoleGuard';
import './Dashboard.css';

interface DashboardStats {
  totalContracts: number;
  totalTemplates: number;
  totalCompanies: number;
  pendingRequests: number;
}

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats>({
    totalContracts: 0,
    totalTemplates: 0,
    totalCompanies: 0,
    pendingRequests: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      // Usar el endpoint de estadísticas del dashboard
      const statsRes = await api.get('/dashboard/stats');
      
      setStats({
        totalContracts: statsRes.data.totalContracts || 0,
        totalTemplates: statsRes.data.totalTemplates || 0,
        totalCompanies: statsRes.data.totalCompanies || 0,
        pendingRequests: statsRes.data.pendingRequests || 0
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      // Si falla, usar valores por defecto
      setStats({
        totalContracts: 0,
        totalTemplates: 0,
        totalCompanies: 0,
        pendingRequests: 0
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">Cargando dashboard...</div>;
  }

  const getRoleWelcome = () => {
    switch (user?.role) {
      case 'super_admin':
        return '🔧 Panel de Super Administración';
      case 'admin':
        return '👑 Panel de Administración';
      case 'lawyer':
        return '⚖️ Panel de Abogado';
      case 'requester':
        return '👤 Panel de Usuario';
      default:
        return 'Dashboard';
    }
  };

  return (
    <div className="dashboard">
      <h1>{getRoleWelcome()}</h1>
      <div className="user-info">
        <p>Bienvenido, <strong>{user?.name || user?.email}</strong></p>
        <span className="role-badge">{user?.role}</span>
        {user?.company && (
          <div className="company-info">
            <p><strong>Empresa:</strong> {user.company.name}</p>
            <p><strong>RUC:</strong> {user.company.tax_id}</p>
          </div>
        )}
      </div>
      
      <div className="stats-grid">
        <div className="stat-card">
          <h3>Contratos</h3>
          <div className="stat-number">{stats.totalContracts}</div>
        </div>
        
        <RoleGuard allowedRoles={['super_admin', 'admin', 'lawyer']}>
          <div className="stat-card">
            <h3>Plantillas</h3>
            <div className="stat-number">{stats.totalTemplates}</div>
          </div>
        </RoleGuard>
        
        <RoleGuard allowedRoles={['super_admin', 'admin', 'lawyer']}>
          <div className="stat-card">
            <h3>Empresas</h3>
            <div className="stat-number">{stats.totalCompanies}</div>
          </div>
        </RoleGuard>
        
        <RoleGuard allowedRoles={['super_admin', 'admin', 'lawyer']}>
          <div className="stat-card">
            <h3>Solicitudes Pendientes</h3>
            <div className="stat-number">{stats.pendingRequests}</div>
          </div>
        </RoleGuard>
      </div>

      <div className="quick-actions">
        <h2>Acciones Rápidas</h2>
        <div className="action-buttons">
          <button className="action-btn" onClick={() => navigate('/contracts')}>
            Ver Contratos
          </button>

          <RoleGuard allowedRoles={['super_admin', 'admin', 'lawyer']}>
            <button className="action-btn" onClick={() => navigate('/contract-generator')}>
              Crear Contrato
            </button>
            <button className="action-btn" onClick={() => navigate('/templates')}>
              Nueva Plantilla
            </button>
            <button className="action-btn" onClick={() => navigate('/companies')}>
              Agregar Empresa
            </button>
          </RoleGuard>

          <RoleGuard allowedRoles={['super_admin', 'admin']}>
            <button className="action-btn" onClick={() => navigate('/users')}>
              Administrar Usuarios
            </button>
            <button className="action-btn" onClick={() => navigate('/system-config')}>
              Configuración Sistema
            </button>
          </RoleGuard>

          <RoleGuard allowedRoles={['super_admin']}>
            <button className="action-btn" onClick={() => navigate('/suppliers')}>
              Gestión Completa
            </button>
            <button className="action-btn" onClick={() => navigate('/super-admin')}>
              Super Administración
            </button>
          </RoleGuard>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
