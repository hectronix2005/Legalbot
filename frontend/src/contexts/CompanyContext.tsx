import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

interface CompanyRole {
  companyId: string;
  companyName: string;
  roles: string[];
}

interface CompanyContextType {
  selectedCompanyId: string | null;
  selectedCompanyName: string | null;
  userCompanies: CompanyRole[];
  currentRoles: string[];
  selectCompany: (companyId: string) => void;
  hasRole: (role: string | string[]) => boolean;
  isLoading: boolean;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

export const useCompany = () => {
  const context = useContext(CompanyContext);
  if (!context) {
    throw new Error('useCompany must be used within a CompanyProvider');
  }
  return context;
};

interface CompanyProviderProps {
  children: ReactNode;
}

export const CompanyProvider: React.FC<CompanyProviderProps> = ({ children }) => {
  const { user } = useAuth();
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [userCompanies, setUserCompanies] = useState<CompanyRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Cargar empresas del usuario desde el endpoint /my-companies
  useEffect(() => {
    const loadUserCompanies = async () => {
      if (!user) {
        setIsLoading(false);
        return;
      }

      try {
        const response = await api.get('/companies/my-companies');
        console.log('Respuesta de /my-companies:', response.data);

        // Asegurar que companies es un array válido
        const companiesData = response.data;
        let companies: CompanyRole[] = [];

        if (Array.isArray(companiesData)) {
          companies = companiesData;
        } else if (companiesData && typeof companiesData === 'object') {
          // Si es un objeto, intentar convertirlo a array
          console.warn('Respuesta no es array, intentando convertir:', companiesData);
          companies = [];
        } else {
          console.warn('Respuesta inesperada de /my-companies:', companiesData);
          companies = [];
        }

        setUserCompanies(companies);

        if (companies.length === 0) {
          console.warn('No hay empresas disponibles para el usuario. El usuario debe tener al menos una empresa asignada.');
          setIsLoading(false);
          return;
        }

        // Leer empresa de URL o localStorage
        const urlParams = new URLSearchParams(window.location.search);
        const companyFromUrl = urlParams.get('company');
        const companyFromStorage = localStorage.getItem('selectedCompanyId');

        // Prioridad: URL > localStorage > Primera empresa
        let companyToSelect = companyFromUrl || companyFromStorage || companies[0]?.companyId;

        // Verificar que el usuario tiene acceso a esa empresa
        // Permitir "ALL" para super_admin sin validación adicional
        const isSuperAdmin = companies.some(c => c.roles.includes('super_admin'));
        const hasAccess = companyToSelect === 'ALL'
          ? isSuperAdmin
          : companies.some(c => c.companyId === companyToSelect);

        if (!hasAccess && companies.length > 0) {
          companyToSelect = companies[0].companyId;
        }

        if (companyToSelect) {
          setSelectedCompanyId(companyToSelect);
          localStorage.setItem('selectedCompanyId', companyToSelect);
          console.log(`✅ CompanyContext: Empresa seleccionada: ${companyToSelect === 'ALL' ? 'TODAS LAS EMPRESAS' : companyToSelect}`);

          // Actualizar URL sin reload
          if (companyFromUrl !== companyToSelect) {
            const newUrl = new URL(window.location.href);
            newUrl.searchParams.set('company', companyToSelect);
            window.history.replaceState({}, '', newUrl.toString());
          }
        }

        setIsLoading(false);
      } catch (error) {
        console.error('Error al cargar empresas:', error);
        setIsLoading(false);
      }
    };

    loadUserCompanies();
  }, [user]);

  const selectCompany = (companyId: string) => {
    // Permitir "ALL" para super_admin
    if (companyId === 'ALL') {
      const isSuperAdmin = userCompanies.some(c => c.roles.includes('super_admin'));
      if (!isSuperAdmin) {
        console.error('Solo super_admin puede acceder a todas las empresas');
        return;
      }
    } else {
      // Verificar acceso para empresas específicas
      const hasAccess = userCompanies.some(c => c.companyId === companyId);
      if (!hasAccess) {
        console.error('No tienes acceso a esta empresa');
        return;
      }
    }

    setSelectedCompanyId(companyId);
    localStorage.setItem('selectedCompanyId', companyId);

    // Actualizar URL
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.set('company', companyId);
    window.history.pushState({}, '', newUrl.toString());

    // Opcional: Recargar datos
    window.location.reload();
  };

  const currentRoles = selectedCompanyId === 'ALL'
    ? ['super_admin']
    : userCompanies.find(c => c.companyId === selectedCompanyId)?.roles || [];

  const selectedCompanyName = selectedCompanyId === 'ALL'
    ? 'Todas las empresas'
    : userCompanies.find(c => c.companyId === selectedCompanyId)?.companyName || null;

  const hasRole = (role: string | string[]): boolean => {
    if (Array.isArray(role)) {
      return role.some(r => currentRoles.includes(r));
    }
    return currentRoles.includes(role);
  };

  const value: CompanyContextType = {
    selectedCompanyId,
    selectedCompanyName,
    userCompanies,
    currentRoles,
    selectCompany,
    hasRole,
    isLoading
  };

  return (
    <CompanyContext.Provider value={value}>
      {children}
    </CompanyContext.Provider>
  );
};
