import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Suppliers from './Suppliers';
import ThirdPartyTypeManagement from './ThirdPartyTypeManagement';
import './ThirdPartyManagement.css';

const ThirdPartyManagement: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // Leer el tab de la URL, por defecto 'terceros'
  const getTabFromURL = (): 'terceros' | 'tipos' => {
    const params = new URLSearchParams(location.search);
    const tab = params.get('tab');
    if (tab === 'tipos' || tab === 'terceros') {
      return tab;
    }
    return 'terceros';
  };

  const [activeTab, setActiveTab] = useState<'terceros' | 'tipos'>(getTabFromURL());

  // Función para cambiar tabs y actualizar la URL
  const handleTabChange = (tab: 'terceros' | 'tipos') => {
    setActiveTab(tab);
    navigate(`?tab=${tab}`, { replace: true });
  };

  // Sincronizar activeTab con cambios en la URL (botón atrás/adelante del navegador)
  useEffect(() => {
    const tabFromURL = getTabFromURL();
    if (tabFromURL !== activeTab) {
      setActiveTab(tabFromURL);
    }
  }, [location.search]);

  return (
    <div className="third-party-management-container">
      <div className="gradient-header">
        <h1>Gestión de Terceros</h1>
        <p>Administra proveedores y configuración de tipos de terceros</p>
      </div>
      <div className="tabs-header">
        <button
          className={`tab-button ${activeTab === 'terceros' ? 'active' : ''}`}
          onClick={() => handleTabChange('terceros')}
        >
          📋 Gestión de Terceros
        </button>
        <button
          className={`tab-button ${activeTab === 'tipos' ? 'active' : ''}`}
          onClick={() => handleTabChange('tipos')}
        >
          ⚙️ Configuración de Tipos
        </button>
      </div>

      <div className="tab-content">
        {activeTab === 'terceros' ? (
          <Suppliers />
        ) : (
          <ThirdPartyTypeManagement />
        )}
      </div>
    </div>
  );
};

export default ThirdPartyManagement;
