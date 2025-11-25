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

export default api;
