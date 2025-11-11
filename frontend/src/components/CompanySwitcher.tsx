import React, { useState } from 'react';
import { useCompany } from '../contexts/CompanyContext';
import './CompanySwitcher.css';

const CompanySwitcher: React.FC = () => {
  const { selectedCompanyId, selectedCompanyName, userCompanies, selectCompany, currentRoles } = useCompany();
  const [isOpen, setIsOpen] = useState(false);

  // Super admin siempre ve el dropdown (incluye opción "ALL")
  const isSuperAdmin = currentRoles.includes('super_admin');

  if (userCompanies.length <= 1 && !isSuperAdmin) {
    // Si solo tiene una empresa y NO es super_admin, mostrar solo el ícono de menú
    return (
      <div className="company-switcher-single">
        <span className="menu-icon">☰</span>
      </div>
    );
  }

  return (
    <div className="company-switcher">
      <button
        className="company-switcher-button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        title="Cambiar empresa"
      >
        <span className="menu-icon">☰</span>
      </button>

      {isOpen && (
        <div className="company-dropdown">
          <div className="dropdown-header">
            <div className="dropdown-header-content">
              <span className="dropdown-title">Empresas</span>
              <span className="dropdown-current">{selectedCompanyName}</span>
            </div>
            <button className="close-button" onClick={() => setIsOpen(false)}>✕</button>
          </div>
          <div className="company-list">
            {/* Opción "Todas las empresas" solo para super_admin */}
            {currentRoles.includes('super_admin') && (
              <button
                key="ALL"
                className={`company-item ${selectedCompanyId === 'ALL' ? 'active' : ''}`}
                onClick={() => {
                  selectCompany('ALL');
                  setIsOpen(false);
                }}
              >
                <div className="company-item-details">
                  <span className="company-item-name">🌐 Todas las empresas</span>
                  <span className="company-item-roles">Vista Global</span>
                </div>
                {selectedCompanyId === 'ALL' && (
                  <span className="check-icon">✓</span>
                )}
              </button>
            )}

            {userCompanies.map((company) => (
              <button
                key={company.companyId}
                className={`company-item ${selectedCompanyId === company.companyId ? 'active' : ''}`}
                onClick={() => {
                  selectCompany(company.companyId);
                  setIsOpen(false);
                }}
              >
                <div className="company-item-details">
                  <span className="company-item-name">{company.companyName}</span>
                  <span className="company-item-roles">{company.roles.join(', ')}</span>
                </div>
                {selectedCompanyId === company.companyId && (
                  <span className="check-icon">✓</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Click outside to close */}
      {isOpen && (
        <div
          className="company-dropdown-overlay"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
};

export default CompanySwitcher;
