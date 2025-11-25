import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Suppliers from './Suppliers';
import ThirdPartyTypeManagement from './ThirdPartyTypeManagement';
import SupplierContractsConsolidated from './SupplierContractsConsolidated';
import ContractCategoryManagement from './ContractCategoryManagement';
import './ThirdPartiesHub.css';

type TabType = 'terceros' | 'tipos' | 'contratos' | 'categorias';

const ThirdPartiesHub: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // Leer el tab de la URL
  const getTabFromURL = (): TabType => {
    const params = new URLSearchParams(location.search);
    const tab = params.get('tab');
    if (tab === 'terceros' || tab === 'tipos' || tab === 'contratos' || tab === 'categorias') {
      return tab;
    }
    return 'terceros';
  };

  const [activeTab, setActiveTab] = useState<TabType>(getTabFromURL());

  // Cambiar tabs y actualizar URL
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    navigate(`?tab=${tab}`, { replace: true });
  };

  // Sincronizar con cambios en URL (boton atras/adelante)
  useEffect(() => {
    const tabFromURL = getTabFromURL();
    if (tabFromURL !== activeTab) {
      setActiveTab(tabFromURL);
    }
  }, [location.search]);

  const renderTabContent = () => {
    switch (activeTab) {
      case 'terceros':
        return <Suppliers />;
      case 'tipos':
        return <ThirdPartyTypeManagement />;
      case 'contratos':
        return <SupplierContractsConsolidated />;
      case 'categorias':
        return <ContractCategoryManagement />;
      default:
        return <Suppliers />;
    }
  };

  return (
    <div className="third-parties-hub">
      <div className="hub-header">
        <h1>Terceros</h1>
        <p>Gestion integral de terceros, contratos y categorias</p>
      </div>

      <div className="hub-tabs">
        <button
          className={`hub-tab ${activeTab === 'terceros' ? 'active' : ''}`}
          onClick={() => handleTabChange('terceros')}
        >
          <span className="tab-icon">👥</span>
          <span className="tab-text">Gestion de Terceros</span>
        </button>

        <button
          className={`hub-tab ${activeTab === 'tipos' ? 'active' : ''}`}
          onClick={() => handleTabChange('tipos')}
        >
          <span className="tab-icon">⚙️</span>
          <span className="tab-text">Tipos de Terceros</span>
        </button>

        <button
          className={`hub-tab ${activeTab === 'contratos' ? 'active' : ''}`}
          onClick={() => handleTabChange('contratos')}
        >
          <span className="tab-icon">📄</span>
          <span className="tab-text">Contratos por Tercero</span>
        </button>

        <button
          className={`hub-tab ${activeTab === 'categorias' ? 'active' : ''}`}
          onClick={() => handleTabChange('categorias')}
        >
          <span className="tab-icon">🏷️</span>
          <span className="tab-text">Categorias de Contratos</span>
        </button>
      </div>

      <div className="hub-content">
        {renderTabContent()}
      </div>
    </div>
  );
};

export default ThirdPartiesHub;
