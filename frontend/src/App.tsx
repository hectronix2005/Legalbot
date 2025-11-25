import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import Contracts from './components/Contracts';
import ContractGenerator from './components/ContractGenerator';
import Templates from './components/Templates';
import UnifiedTemplates from './components/UnifiedTemplates';
import Companies from './components/Companies';
import UserManagement from './components/UserManagement';
import CompanyUserManagement from './components/CompanyUserManagement';
import ThirdPartyManagement from './components/ThirdPartyManagement';
import ContractCategoryManagement from './components/ContractCategoryManagement';
import RequestsAndApprovals from './components/RequestsAndApprovals';
import SupplierContractsConsolidated from './components/SupplierContractsConsolidated';
import Navbar from './components/Navbar';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CompanyProvider } from './contexts/CompanyContext';
import './App.css';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />;
};

const AppContent: React.FC = () => {
  const { isAuthenticated } = useAuth();

  return (
    <div className="App">
      {isAuthenticated && <Navbar />}
      <main className="main-content">
        <Routes>
          <Route path="/login" element={!isAuthenticated ? <Login /> : <Navigate to="/dashboard" />} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/contracts" element={<ProtectedRoute><Contracts /></ProtectedRoute>} />
          <Route path="/contract-generator" element={<ProtectedRoute><ContractGenerator /></ProtectedRoute>} />
          <Route path="/templates" element={<ProtectedRoute><Templates /></ProtectedRoute>} />
          <Route path="/unified-templates" element={<ProtectedRoute><UnifiedTemplates /></ProtectedRoute>} />
          <Route path="/companies" element={<ProtectedRoute><Companies /></ProtectedRoute>} />
          <Route path="/user-management" element={<ProtectedRoute><UserManagement /></ProtectedRoute>} />
          <Route path="/company-users" element={<ProtectedRoute><CompanyUserManagement /></ProtectedRoute>} />
          <Route path="/third-parties" element={<ProtectedRoute><ThirdPartyManagement /></ProtectedRoute>} />
          <Route path="/contract-categories" element={<ProtectedRoute><ContractCategoryManagement /></ProtectedRoute>} />
          <Route path="/requests-approvals" element={<ProtectedRoute><RequestsAndApprovals /></ProtectedRoute>} />
          <Route path="/supplier-contracts" element={<ProtectedRoute><SupplierContractsConsolidated /></ProtectedRoute>} />
          {/* Redirecciones de rutas antiguas de solicitudes */}
          <Route path="/contract-request" element={<Navigate to="/requests-approvals" replace />} />
          <Route path="/my-requests" element={<Navigate to="/requests-approvals" replace />} />
          <Route path="/supplier-approvals" element={<Navigate to="/requests-approvals" replace />} />
          <Route path="/contract-approvals" element={<Navigate to="/requests-approvals" replace />} />
          {/* Redirecciones de rutas antiguas */}
          <Route path="/suppliers" element={<Navigate to="/third-parties" replace />} />
          <Route path="/third-party-types" element={<Navigate to="/third-parties" replace />} />
          <Route path="/" element={<Navigate to={isAuthenticated ? "/dashboard" : "/login"} />} />
        </Routes>
      </main>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <CompanyProvider>
        <Router>
          <AppContent />
        </Router>
      </CompanyProvider>
    </AuthProvider>
  );
};

export default App;