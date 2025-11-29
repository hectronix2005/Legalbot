import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import RoleGuard from './RoleGuard';
import CompanySwitcher from './CompanySwitcher';
import api from '../services/api';
import './Navbar.css';

const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [adminDropdownOpen, setAdminDropdownOpen] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isActive = (path: string) => location.pathname === path;

  // Cerrar dropdown cuando se hace click fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setAdminDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const adminPaths = ['/companies', '/user-management', '/company-users', '/role-management', '/admin'];
  const isAdminActive = adminPaths.some(path => location.pathname === path);
  const isTercerosActive = location.pathname === '/terceros';
  const isVacacionesActive = location.pathname === '/vacaciones';

  const handlePasswordChange = async () => {
    setPasswordError('');
    setPasswordSuccess('');

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('Las contraseñas nuevas no coinciden');
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      setPasswordError('La nueva contraseña debe tener al menos 6 caracteres');
      return;
    }

    try {
      await api.patch('/users/me/password', {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword
      });
      setPasswordSuccess('Contraseña actualizada exitosamente');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setTimeout(() => {
        setShowPasswordModal(false);
        setPasswordSuccess('');
      }, 2000);
    } catch (error: any) {
      setPasswordError(error.response?.data?.error || 'Error al cambiar contraseña');
    }
  };

  return (
    <nav className="navbar">
      <div className="navbar-left">
        <CompanySwitcher />
        <div className="navbar-brand">
          <Link to="/dashboard">Legal Bot</Link>
        </div>
      </div>

      <div className="navbar-links">
        <Link
          to="/dashboard"
          className={isActive('/dashboard') ? 'active' : ''}
        >
          Dashboard
        </Link>

        <RoleGuard allowedRoles={['super_admin', 'admin', 'lawyer']}>
          <Link
            to="/unified-templates"
            className={isActive('/unified-templates') ? 'active' : ''}
          >
            🚀 Contratos
          </Link>
        </RoleGuard>

        <Link
          to="/requests-approvals"
          className={isActive('/requests-approvals') ? 'active' : ''}
        >
          📋 Solicitudes
        </Link>

        <Link
          to="/vacaciones"
          className={isVacacionesActive ? 'active' : ''}
        >
          🏖️ Vacaciones
        </Link>

        <RoleGuard allowedRoles={['super_admin', 'admin', 'lawyer']}>
          <Link
            to="/terceros"
            className={isTercerosActive ? 'active' : ''}
          >
            👥 Terceros
          </Link>
        </RoleGuard>

        <RoleGuard allowedRoles={['super_admin']}>
          <div className="navbar-dropdown" ref={dropdownRef}>
            <button
              className={`navbar-dropdown-button ${isAdminActive ? 'active' : ''}`}
              onClick={() => setAdminDropdownOpen(!adminDropdownOpen)}
            >
              Administracion
              <span className={`dropdown-arrow ${adminDropdownOpen ? 'open' : ''}`}>▼</span>
            </button>

            {adminDropdownOpen && (
              <div className="navbar-dropdown-menu">
                <Link
                  to="/companies"
                  className={isActive('/companies') ? 'active' : ''}
                  onClick={() => setAdminDropdownOpen(false)}
                >
                  Empresas
                </Link>

                <Link
                  to="/user-management"
                  className={isActive('/user-management') ? 'active' : ''}
                  onClick={() => setAdminDropdownOpen(false)}
                >
                  Gestion de Usuarios
                </Link>

                <Link
                  to="/company-users"
                  className={isActive('/company-users') ? 'active' : ''}
                  onClick={() => setAdminDropdownOpen(false)}
                >
                  Relaciones Empresa-Usuario
                </Link>

                <Link
                  to="/role-management"
                  className={isActive('/role-management') ? 'active' : ''}
                  onClick={() => setAdminDropdownOpen(false)}
                >
                  Gestion de Roles
                </Link>
              </div>
            )}
          </div>
        </RoleGuard>
      </div>
      
      <div className="navbar-user">
        <span>Hola, {user?.name || user?.email}</span>
        <button
          onClick={() => {
            setShowPasswordModal(true);
            setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
            setPasswordError('');
            setPasswordSuccess('');
          }}
          className="change-password-btn"
          title="Cambiar Contraseña"
        >
          Cambiar Contraseña
        </button>
        <button onClick={logout} className="logout-btn">
          Cerrar Sesion
        </button>
      </div>

      {showPasswordModal && (
        <div className="modal-overlay" onClick={() => setShowPasswordModal(false)}>
          <div className="modal-content password-modal" onClick={(e) => e.stopPropagation()}>
            <button
              className="modal-close-btn"
              onClick={() => setShowPasswordModal(false)}
              title="Cerrar"
            >
              &times;
            </button>
            <h2>Cambiar Contraseña</h2>

            {passwordError && <div className="error-message">{passwordError}</div>}
            {passwordSuccess && <div className="success-message">{passwordSuccess}</div>}

            <div className="form-group">
              <label>Contraseña Actual:</label>
              <input
                type="password"
                value={passwordForm.currentPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                placeholder="Ingresa tu contraseña actual"
              />
            </div>

            <div className="form-group">
              <label>Nueva Contraseña:</label>
              <input
                type="password"
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                placeholder="Minimo 6 caracteres"
              />
            </div>

            <div className="form-group">
              <label>Confirmar Nueva Contraseña:</label>
              <input
                type="password"
                value={passwordForm.confirmPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                placeholder="Repite la nueva contraseña"
              />
            </div>

            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowPasswordModal(false)}>
                Cancelar
              </button>
              <button
                className="btn-primary"
                onClick={handlePasswordChange}
                disabled={!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword}
              >
                Cambiar Contraseña
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
