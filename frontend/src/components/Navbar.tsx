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

  const adminPaths = ['/companies', '/user-management', '/company-users', '/third-parties', '/contract-categories', '/supplier-contracts', '/requests-approvals', '/admin'];
  const isAdminActive = adminPaths.some(path => location.pathname === path);

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

        <RoleGuard allowedRoles={['super_admin', 'admin']}>
          <div className="navbar-dropdown" ref={dropdownRef}>
            <button
              className={`navbar-dropdown-button ${isAdminActive ? 'active' : ''}`}
              onClick={() => setAdminDropdownOpen(!adminDropdownOpen)}
            >
              Administración
              <span className={`dropdown-arrow ${adminDropdownOpen ? 'open' : ''}`}>▼</span>
            </button>

            {adminDropdownOpen && (
              <div className="navbar-dropdown-menu">
                <RoleGuard allowedRoles={['super_admin']}>
                  <Link
                    to="/companies"
                    className={isActive('/companies') ? 'active' : ''}
                    onClick={() => setAdminDropdownOpen(false)}
                  >
                    Empresas
                  </Link>
                </RoleGuard>

                <RoleGuard allowedRoles={['super_admin']}>
                  <Link
                    to="/user-management"
                    className={isActive('/user-management') ? 'active' : ''}
                    onClick={() => setAdminDropdownOpen(false)}
                  >
                    Gestión de Usuarios
                  </Link>
                </RoleGuard>

                <RoleGuard allowedRoles={['super_admin']}>
                  <Link
                    to="/company-users"
                    className={isActive('/company-users') ? 'active' : ''}
                    onClick={() => setAdminDropdownOpen(false)}
                  >
                    Relaciones Empresa-Usuario
                  </Link>
                </RoleGuard>

                <RoleGuard allowedRoles={['super_admin', 'admin']}>
                  <Link
                    to="/third-parties"
                    className={isActive('/third-parties') ? 'active' : ''}
                    onClick={() => setAdminDropdownOpen(false)}
                  >
                    Creación de Terceros
                  </Link>
                </RoleGuard>

                <RoleGuard allowedRoles={['super_admin', 'admin']}>
                  <Link
                    to="/contract-categories"
                    className={isActive('/contract-categories') ? 'active' : ''}
                    onClick={() => setAdminDropdownOpen(false)}
                  >
                    Categorías de Contratos
                  </Link>
                </RoleGuard>

                <RoleGuard allowedRoles={['super_admin', 'admin', 'lawyer']}>
                  <Link
                    to="/supplier-contracts"
                    className={isActive('/supplier-contracts') ? 'active' : ''}
                    onClick={() => setAdminDropdownOpen(false)}
                  >
                    📋 Contratos por Tercero
                  </Link>
                </RoleGuard>
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
