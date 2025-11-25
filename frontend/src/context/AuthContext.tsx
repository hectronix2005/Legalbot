import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api from '../services/api';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'super_admin' | 'admin' | 'lawyer' | 'requester' | 'talento_humano' | 'colaboradores';
  company_id?: string;
  company?: {
    _id: string;
    name: string;
    tax_id: string;
  };
  // Multi-tenant: roles por empresa
  companyRoles?: {
    [companyId: string]: {
      name: string;
      roles: string[];
    };
  };
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
  hasRole: (role: 'super_admin' | 'admin' | 'lawyer' | 'requester' | 'talento_humano' | 'colaboradores') => boolean;
  isSuperAdmin: () => boolean;
  isAdmin: () => boolean;
  isLawyer: () => boolean;
  isUser: () => boolean;
  getUserCompany: () => string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

// Funcion para obtener usuario inicial de localStorage (ejecuta SINCRONO antes del primer render)
const getInitialUser = (): User | null => {
  try {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    if (token && userData) {
      return JSON.parse(userData);
    }
  } catch (error) {
    console.error('Error parsing initial user data:', error);
  }
  return null;
};

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  // Inicializar usuario SINCRONAMENTE desde localStorage para evitar flash de redirect
  const [user, setUser] = useState<User | null>(getInitialUser);
  const loading = false; // Ya no necesitamos loading - usuario se carga sincronamente

  const isAuthenticated = !!user;

  useEffect(() => {
    // Este efecto solo maneja la configuracion de selectedCompanyId
    if (user) {
      const selectedCompanyId = localStorage.getItem('selectedCompanyId');

      // SIEMPRE establecer 'ALL' para super_admin (forzar correccion de sesiones antiguas)
      if (user.role === 'super_admin') {
        if (selectedCompanyId !== 'ALL') {
          localStorage.setItem('selectedCompanyId', 'ALL');
          console.log('✅ Super admin: Forzando selectedCompanyId a ALL (corrigiendo sesion antigua)');
        }
      } else if (!selectedCompanyId) {
        // Para otros roles, solo establecer si no existe
        if (user.companyRoles && Object.keys(user.companyRoles).length > 0) {
          const firstCompanyId = Object.keys(user.companyRoles)[0];
          localStorage.setItem('selectedCompanyId', firstCompanyId);
          console.log('✅ Company ID establecido al cargar:', firstCompanyId);
        } else if (user.company_id) {
          localStorage.setItem('selectedCompanyId', user.company_id);
          console.log('✅ Company ID (legacy) establecido al cargar:', user.company_id);
        }
      }
    }
  }, [user]);

  const login = async (email: string, password: string) => {
    try {
      const response = await api.post('/auth/login', { email, password });
      const { token, user } = response.data;

      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));

      // Si el usuario tiene companyRoles, guardar el primer company ID como selectedCompanyId
      if (user.companyRoles && Object.keys(user.companyRoles).length > 0) {
        const firstCompanyId = Object.keys(user.companyRoles)[0];
        localStorage.setItem('selectedCompanyId', firstCompanyId);
        console.log('✅ Company ID guardado:', firstCompanyId);
      } else if (user.company_id) {
        // Fallback: si tiene company_id directo (legacy)
        localStorage.setItem('selectedCompanyId', user.company_id);
        console.log('✅ Company ID (legacy) guardado:', user.company_id);
      } else if (user.role === 'super_admin') {
        // Super admin puede ver todas las empresas
        localStorage.setItem('selectedCompanyId', 'ALL');
        console.log('✅ Super admin: Todas las empresas seleccionadas (ALL)');
      } else {
        console.warn('⚠️  Usuario sin company asociada');
      }

      setUser(user);
    } catch (error: any) {
      // Log detailed error information
      console.error('Error de login:', {
        message: error?.message,
        response: error?.response?.data,
        status: error?.response?.status,
        statusText: error?.response?.statusText,
        code: error?.code,
        fullError: error
      });
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('selectedCompanyId');
    setUser(null);
  };

  const hasRole = (role: 'super_admin' | 'admin' | 'lawyer' | 'requester' | 'talento_humano' | 'colaboradores') => {
    return user?.role === role;
  };

  const isSuperAdmin = () => {
    return user?.role === 'super_admin';
  };

  const isAdmin = () => {
    return user?.role === 'admin';
  };

  const isLawyer = () => {
    return user?.role === 'lawyer';
  };

  const isUser = () => {
    return user?.role === 'requester';
  };

  const getUserCompany = () => {
    return user?.company_id || null;
  };

  const value = {
    user,
    isAuthenticated,
    login,
    logout,
    loading,
    hasRole,
    isSuperAdmin,
    isAdmin,
    isLawyer,
    isUser,
    getUserCompany
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
