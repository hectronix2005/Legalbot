import React, { ReactNode } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCompany } from '../contexts/CompanyContext';

interface RoleGuardProps {
  children: ReactNode;
  allowedRoles: ('super_admin' | 'admin' | 'lawyer' | 'requester' | 'talento_humano' | 'colaboradores')[];
  fallback?: ReactNode;
}

const RoleGuard: React.FC<RoleGuardProps> = ({
  children,
  allowedRoles,
  fallback = null
}) => {
  const { user } = useAuth();
  const { hasRole, currentRoles } = useCompany();

  // Si no hay usuario, no mostrar nada
  if (!user) {
    return <>{fallback}</>;
  }

  // Super admin siempre tiene acceso
  if (user.role === 'super_admin') {
    return <>{children}</>;
  }

  // Multi-tenant: Verificar roles por empresa
  if (user.companyRoles && currentRoles.length > 0) {
    const hasRequiredRole = hasRole(allowedRoles);
    if (hasRequiredRole) {
      return <>{children}</>;
    }
  } else {
    // Legacy: Verificar rol global
    if (allowedRoles.includes(user.role as any)) {
      return <>{children}</>;
    }
  }

  return <>{fallback}</>;
};

export default RoleGuard;
