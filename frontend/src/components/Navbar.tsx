import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import RoleGuard from './RoleGuard';
import CompanySwitcher from './CompanySwitcher';
import './Navbar.css';

const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [adminDropdownOpen, setAdminDropdownOpen] = useState(false);
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

  const adminPaths = ['/companies', '/user-management', '/company-users', '/admin'];
  const isAdminActive = adminPaths.some(path => location.pathname === path);
  const isTercerosActive = location.pathname === '/terceros';

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
              </div>
            )}
          </div>
        </RoleGuard>
      </div>
      
      <div className="navbar-user">
        <span>Hola, {user?.name || user?.email}</span>
        <button onClick={logout} className="logout-btn">
          Cerrar Sesión
        </button>
      </div>
    </nav>
  );
};

export default Navbar;
