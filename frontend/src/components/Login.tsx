import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import './Login.css';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
    } catch (err: any) {
      // Extract error message from different error types
      let errorMessage = 'Error al iniciar sesión';
      
      if (err.response) {
        // Server responded with error status
        if (err.response.data) {
          if (err.response.data.error) {
            errorMessage = err.response.data.error;
          } else if (err.response.data.message) {
            errorMessage = err.response.data.message;
          } else if (err.response.data.errors && Array.isArray(err.response.data.errors)) {
            // Validation errors
            errorMessage = err.response.data.errors.map((e: any) => e.msg || e.message).join(', ');
          }
        } else if (err.response.status === 401) {
          errorMessage = 'Credenciales inválidas';
        } else if (err.response.status === 500) {
          errorMessage = 'Error del servidor. Por favor, intenta más tarde';
        } else if (err.response.status === 404) {
          errorMessage = 'Servicio no encontrado. Verifica la configuración';
        }
      } else if (err.request) {
        // Request was made but no response received
        errorMessage = 'No se pudo conectar con el servidor. Verifica tu conexión';
      } else if (err.message) {
        // Error setting up the request
        errorMessage = err.message;
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h1>Legal Bot</h1>
        <h2>Iniciar Sesión</h2>
        
        {error && <div className="error-message">{error}</div>}
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">Email:</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="password">Contraseña:</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
            />
          </div>
          
          <button type="submit" disabled={loading} className="login-button">
            {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
          </button>
        </form>
        
        <div className="demo-credentials">
          <h3>Credenciales de Demo:</h3>
          
          <div className="super-admin-section">
            <h4>🔧 Super Administrador</h4>
            <div className="role-credentials">
              <div className="role-card super-admin">
                <h5>🔧 Super Admin</h5>
                <p><strong>Email:</strong> superadmin@legalbot.com</p>
                <p><strong>Contraseña:</strong> 123456</p>
                <p><em>Gestión completa del sistema</em></p>
              </div>
            </div>
          </div>
          
          <h3>Credenciales de Sistema:</h3>
          
          <div className="company-section">
            <h4>🏢 Sistema Legal Bot</h4>
            <div className="role-credentials">
              <div className="role-card admin">
                <h5>👑 Administrador</h5>
                <p><strong>Email:</strong> admin@demo.com</p>
                <p><strong>Contraseña:</strong> 123456</p>
              </div>
              <div className="role-card lawyer">
                <h5>⚖️ Abogado</h5>
                <p><strong>Email:</strong> abogado@demo.com</p>
                <p><strong>Contraseña:</strong> 123456</p>
              </div>
              <div className="role-card user">
                <h5>👤 Usuario</h5>
                <p><strong>Email:</strong> solicitante@demo.com</p>
                <p><strong>Contraseña:</strong> 123456</p>
              </div>
            </div>
          </div>

          <div className="company-section">
            <h4>⚖️ LegalFirm & Asociados</h4>
            <div className="role-credentials">
              <div className="role-card admin">
                <h5>👑 Admin</h5>
                <p><strong>Email:</strong> admin@legalfirm.com</p>
                <p><strong>Contraseña:</strong> 123456</p>
              </div>
              <div className="role-card lawyer">
                <h5>⚖️ Lawyer</h5>
                <p><strong>Email:</strong> lawyer@legalfirm.com</p>
                <p><strong>Contraseña:</strong> 123456</p>
              </div>
              <div className="role-card user">
                <h5>👤 User</h5>
                <p><strong>Email:</strong> user@legalfirm.com</p>
                <p><strong>Contraseña:</strong> 123456</p>
              </div>
            </div>
          </div>

          <div className="company-section">
            <h4>🏢 BusinessCorp Internacional</h4>
            <div className="role-credentials">
              <div className="role-card admin">
                <h5>👑 Admin</h5>
                <p><strong>Email:</strong> admin@businesscorp.com</p>
                <p><strong>Contraseña:</strong> 123456</p>
              </div>
              <div className="role-card lawyer">
                <h5>⚖️ Lawyer</h5>
                <p><strong>Email:</strong> lawyer@businesscorp.com</p>
                <p><strong>Contraseña:</strong> 123456</p>
              </div>
              <div className="role-card user">
                <h5>👤 User</h5>
                <p><strong>Email:</strong> user@businesscorp.com</p>
                <p><strong>Contraseña:</strong> 123456</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
