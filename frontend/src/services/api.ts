import axios from 'axios';

// Usar ruta relativa ya que frontend y backend están en el mismo puerto (3002)
const API_BASE_URL = process.env.REACT_APP_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 second timeout
});

// Interceptor para agregar token de autenticación y X-Company-Id header
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');

  // DEBUG: Log token status
  if (!token) {
    console.warn('⚠️ [API Interceptor] No token found in localStorage for request:', config.url);
  } else {
    console.log('✅ [API Interceptor] Token found, adding to request:', config.url);
    config.headers.Authorization = `Bearer ${token}`;
  }

  // Agregar X-Company-Id header para multi-tenant
  const selectedCompanyId = localStorage.getItem('selectedCompanyId');
  if (selectedCompanyId) {
    config.headers['X-Company-Id'] = selectedCompanyId;
    console.log('✅ [API Interceptor] Company ID added:', selectedCompanyId);
  }

  // Log final headers for debugging
  console.log('📡 [API Interceptor] Request headers:', {
    Authorization: config.headers.Authorization ? 'Bearer ***' : 'MISSING',
    'X-Company-Id': config.headers['X-Company-Id'] || 'NOT SET',
    'Content-Type': config.headers['Content-Type']
  });

  return config;
});

// Interceptor para manejar errores de respuesta
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Log error details for debugging
    if (error.response) {
      // Server responded with error status
      console.error('API Error Response:', {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data,
        url: error.config?.url
      });
    } else if (error.request) {
      // Request was made but no response received
      console.error('API Network Error:', {
        message: error.message,
        code: error.code,
        url: error.config?.url,
        method: error.config?.method,
        headers: error.config?.headers,
        timeout: error.config?.timeout,
        fullError: error
      });
    } else {
      // Error setting up the request
      console.error('API Request Setup Error:', error.message);
    }
    return Promise.reject(error);
  }
);

// ===================================================================
// THIRD PARTY PROFILES API
// ===================================================================

export interface TemplateField {
  field_name: string;
  field_label: string;
  field_type: string;
  required: boolean;
  original_marker?: string;
  supplier_field?: string | null;
  is_custom_field?: boolean;
  category?: string;
  options?: string[];
  description?: string;
}

export interface RoleFields {
  role: string;
  role_label: string;
  fields: TemplateField[];
  total_fields: number;
  base_fields_count: number;
  custom_fields_count: number;
}

export interface TemplateFieldsResponse {
  success: boolean;
  template: {
    _id: string;
    name: string;
    category: string;
    third_party_type?: string;
  };
  base_fields: TemplateField[];
  roles: Record<string, RoleFields>;
  roles_detected: string[];
  total_variables: number;
}

export interface CreateSupplierWithProfileData {
  template_id: string;
  role_in_template: string;
  identification_type: string;
  identification_number: string;
  legal_name?: string;
  legal_name_short?: string;
  full_name?: string;
  legal_representative_name?: string;
  legal_representative_id_type?: string;
  legal_representative_id_number?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
  template_fields?: Record<string, any>;
}

// Obtener campos requeridos para crear un tercero según una plantilla
export const getTemplateFields = async (templateId: string): Promise<TemplateFieldsResponse> => {
  const response = await api.get(`/third-party-profiles/template-fields/${templateId}`);
  return response.data;
};

// Crear tercero con perfil de plantilla en una sola operación
export const createSupplierWithProfile = async (data: CreateSupplierWithProfileData) => {
  const response = await api.post('/third-party-profiles/create-with-supplier', data);
  return response.data;
};

// Obtener plantillas disponibles para un tercero con estado de perfil
export const getSupplierTemplates = async (supplierId: string) => {
  const response = await api.get(`/third-party-profiles/supplier-templates/${supplierId}`);
  return response.data;
};

// Obtener perfiles de un tercero
export const getSupplierProfiles = async (supplierId: string) => {
  const response = await api.get(`/third-party-profiles/by-supplier/${supplierId}`);
  return response.data;
};

// Obtener perfiles disponibles para una plantilla
export const getTemplateProfiles = async (templateId: string, role?: string) => {
  const params = role ? `?role=${role}` : '';
  const response = await api.get(`/third-party-profiles/by-template/${templateId}${params}`);
  return response.data;
};

// Analizar variables de una plantilla
export const analyzeTemplateVariables = async (templateId: string) => {
  const response = await api.post(`/third-party-profiles/analyze-template/${templateId}`);
  return response.data;
};

// Auto-llenar perfil desde datos del tercero
export const autoFillProfile = async (supplierId: string, templateId: string, roleInTemplate: string) => {
  const response = await api.post('/third-party-profiles/auto-fill', {
    supplier_id: supplierId,
    template_id: templateId,
    role_in_template: roleInTemplate
  });
  return response.data;
};

// Crear o encontrar perfil
export const findOrCreateProfile = async (supplierId: string, templateId: string, roleInTemplate: string) => {
  const response = await api.post('/third-party-profiles/find-or-create', {
    supplier_id: supplierId,
    template_id: templateId,
    role_in_template: roleInTemplate
  });
  return response.data;
};

// Actualizar campo de un perfil
export const updateProfileField = async (profileId: string, templateVariable: string, value: any, sourceField?: string) => {
  const response = await api.post(`/third-party-profiles/${profileId}/update-field`, {
    template_variable: templateVariable,
    value,
    source_field: sourceField
  });
  return response.data;
};

// ===================================================================
// CONSOLIDACIÓN DE CONTRATOS POR TERCERO
// ===================================================================

export interface ConsolidatedSupplierContract {
  _id: string;
  contract_number: string;
  title: string;
  status: string;
  createdAt: string;
  template?: {
    _id: string;
    name: string;
    category: string;
  };
  generated_by?: {
    _id: string;
    name: string;
    email: string;
  };
  company?: string;
  company_name?: string;
}

export interface ConsolidatedSupplierProfile {
  _id: string;
  template: {
    _id: string;
    name: string;
    category: string;
  };
  role_in_template: string;
  role_label: string;
  usage_count: number;
  last_used_at?: string;
  is_complete: boolean;
}

export interface ConsolidatedSupplierData {
  supplier: {
    _id: string;
    legal_name: string;
    legal_name_short?: string;
    full_name?: string;
    identification_type: string;
    identification_number: string;
    email?: string;
    phone?: string;
    address?: string;
    city?: string;
    active: boolean;
    third_party_type?: {
      _id: string;
      code: string;
      label: string;
      icon: string;
    };
    company?: {
      _id: string;
      name: string;
    };
  };
  contracts: ConsolidatedSupplierContract[];
  profiles: ConsolidatedSupplierProfile[];
  stats: {
    total: number;
    by_status: Record<string, number>;
  };
  profile_count: number;
}

export interface ConsolidatedSuppliersResponse {
  success: boolean;
  totals: {
    suppliers_count: number;
    total_contracts: number;
    suppliers_with_contracts: number;
    suppliers_without_contracts: number;
  };
  data: ConsolidatedSupplierData[];
}

export interface SupplierContractsResponse {
  success: boolean;
  supplier: any;
  contracts: ConsolidatedSupplierContract[];
  profiles: ConsolidatedSupplierProfile[];
  stats: {
    total_contracts: number;
    by_status: Record<string, number>;
    by_template: Record<string, number>;
    recent_activity: ConsolidatedSupplierContract[];
  };
}

// Obtener todos los terceros con sus contratos consolidados
export const getConsolidatedSupplierContracts = async (params?: {
  search?: string;
  includeInactive?: boolean;
  withContractsOnly?: boolean;
  sortBy?: 'contract_count' | 'name' | 'recent';
}): Promise<ConsolidatedSuppliersResponse> => {
  const queryParams = new URLSearchParams();
  if (params?.search) queryParams.append('search', params.search);
  if (params?.includeInactive) queryParams.append('includeInactive', 'true');
  if (params?.withContractsOnly) queryParams.append('withContractsOnly', 'true');
  if (params?.sortBy) queryParams.append('sortBy', params.sortBy);

  const queryString = queryParams.toString();
  const url = `/suppliers/contracts/consolidated${queryString ? `?${queryString}` : ''}`;
  const response = await api.get(url);
  return response.data;
};

// Obtener contratos de un tercero específico
export const getSupplierContracts = async (supplierId: string): Promise<SupplierContractsResponse> => {
  const response = await api.get(`/suppliers/${supplierId}/contracts`);
  return response.data;
};

export default api;
