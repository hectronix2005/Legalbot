import React, { useState, useRef, useEffect } from 'react';
import api from '../services/api';
import ThirdPartyFieldConfigModal from './ThirdPartyFieldConfigModal';
import './UnifiedWordTemplateUpload.css';

interface DetectedVariable {
  marker: string;
  field_name: string;
  field_label: string;
  field_type: string;
  required: boolean;
  is_repeated: boolean;
  repeat_source: number | null;
  repeat_count: number;
}

interface ThirdPartyType {
  value: string;
  label: string;
  description: string;
  icon: string;
}

interface UnifiedWordTemplateUploadProps {
  onTemplateCreated?: (templateId: string) => void;
  onContractGenerated?: (contractId: string) => void;
}

interface Company {
  _id: string;
  name: string;
  tax_id?: string;
}

const UnifiedWordTemplateUpload: React.FC<UnifiedWordTemplateUploadProps> = ({
  onTemplateCreated,
  onContractGenerated
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [thirdPartyType, setThirdPartyType] = useState('otro');
  const [thirdPartyTypes, setThirdPartyTypes] = useState<ThirdPartyType[]>([]);
  const [detectedVariables, setDetectedVariables] = useState<DetectedVariable[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStep, setCurrentStep] = useState<'upload' | 'variables'>('upload');
  const [preview, setPreview] = useState('');
  const [showConfigModal, setShowConfigModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Estados para gestión de empresas
  const [userRole, setUserRole] = useState<string>('');
  const [currentCompanyId, setCurrentCompanyId] = useState<string>('');
  const [availableCompanies, setAvailableCompanies] = useState<Company[]>([]);
  const [shareWithAllCompanies, setShareWithAllCompanies] = useState(false);
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([]);
  const [companySearchTerm, setCompanySearchTerm] = useState<string>('');

  // Cargar rol de usuario, company actual, y empresas disponibles
  useEffect(() => {
    const userData = localStorage.getItem('user');
    const selectedCompanyId = localStorage.getItem('selectedCompanyId') || '';

    if (userData) {
      const user = JSON.parse(userData);
      setUserRole(user.role);
      setCurrentCompanyId(selectedCompanyId);

      // Solo cargar empresas si es admin o super_admin
      if (user.role === 'admin' || user.role === 'super_admin') {
        fetchCompanies();
      } else if (user.role === 'lawyer') {
        // Para abogado, pre-seleccionar la empresa actual
        setSelectedCompanies([selectedCompanyId]);
      }
    }
  }, []);

  const fetchCompanies = async () => {
    try {
      const response = await api.get('/companies');
      setAvailableCompanies(response.data);
      console.log('📋 Empresas disponibles:', response.data.length);
    } catch (error) {
      console.error('Error cargando empresas:', error);
    }
  };

  // Cargar tipos de terceros al montar el componente
  useEffect(() => {
    const fetchThirdPartyTypes = async () => {
      try {
        // Agregar cache-busting con timestamp para forzar recarga
        const cacheBuster = `?t=${Date.now()}`;
        const response = await api.get(`/templates/third-party-types${cacheBuster}`);
        const types = response.data || [];

        console.log('🔍 [DEBUG] Tipos de terceros recibidos (UnifiedWordTemplateUpload):', types.length);
        console.log('📋 [DEBUG] Códigos:', types.map((t: any) => t.value || t.code).join(', '));
        console.log('✅ [DEBUG] Tiene Propiedad Horizontal (ph):', types.some((t: any) => (t.value || t.code) === 'ph'));
        console.log('✅ [DEBUG] Tiene Contador PH (contador_ph):', types.some((t: any) => (t.value || t.code) === 'contador_ph'));

        setThirdPartyTypes(types);
      } catch (error) {
        console.error('Error cargando tipos de terceros:', error);
      }
    };

    fetchThirdPartyTypes();
  }, []);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith('.docx')) {
      alert('Por favor selecciona un archivo Word (.docx)');
      return;
    }

    setFile(selectedFile);
    // Solo usar el nombre del archivo si el usuario no ha ingresado un nombre
    if (!templateName.trim()) {
      setTemplateName(selectedFile.name.replace('.docx', ''));
    }
    await processWordFile(selectedFile);
  };

  const processWordFile = async (file: File) => {
    if (!templateName.trim()) {
      alert('Por favor ingresa el nombre de la plantilla');
      return;
    }

    setIsProcessing(true);
    setCurrentStep('variables');

    try {
      const formData = new FormData();
      formData.append('wordFile', file);
      formData.append('name', templateName);
      formData.append('description', templateDescription);
      formData.append('thirdPartyType', thirdPartyType);

      console.log('🚀 Enviando archivo para detectar variables...');
      console.log('🏷️  Tipo de tercero:', thirdPartyType);

      const response = await api.post('/templates/process-word-with-format', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      console.log('✅ Variables detectadas:', response.data.variables);
      console.log('📋 Detalle de variables:');
      response.data.variables.forEach((v: DetectedVariable, i: number) => {
        console.log(`  ${i+1}. marker="${v.marker}", field_name="${v.field_name}", field_label="${v.field_label}"`);
      });

      setDetectedVariables(response.data.variables);
      setPreview(response.data.previewHtml);

    } catch (error) {
      console.error('Error procesando archivo:', error);
      alert('Error al procesar el archivo: ' + (error as any).response?.data?.error || 'Error desconocido');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCompanySelection = (companyId: string) => {
    if (selectedCompanies.includes(companyId)) {
      setSelectedCompanies(selectedCompanies.filter(id => id !== companyId));
    } else {
      setSelectedCompanies([...selectedCompanies, companyId]);
    }
  };

  const handleShareWithAllChange = (value: boolean) => {
    setShareWithAllCompanies(value);
    if (value) {
      // Si selecciona "todas", limpiar selecciones específicas
      setSelectedCompanies([]);
    }
  };

  const resetForm = () => {
    setFile(null);
    setTemplateName('');
    setTemplateDescription('');
    setThirdPartyType('otro');
    setDetectedVariables([]);
    setCurrentStep('upload');
    setShareWithAllCompanies(false);
    setSelectedCompanies([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleConfigModalClose = () => {
    setShowConfigModal(false);
    alert('Plantilla creada exitosamente. Ahora puedes generar contratos desde esta plantilla.');
    resetForm();
  };

  const handleCreateTemplate = async () => {
    if (!file || !templateName.trim()) {
      alert('Por favor ingresa un nombre para la plantilla');
      return;
    }

    setIsProcessing(true);

    try {
      // Paso 1: Subir archivo Word para obtener ruta del archivo
      const formData = new FormData();
      formData.append('wordFile', file);

      console.log('📤 Subiendo archivo Word...');
      const uploadResponse = await api.post('/templates/upload-word', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      const { filePath, content } = uploadResponse.data;

      // Paso 2: Crear plantilla con los datos
      const templateData: any = {
        name: templateName,
        description: templateDescription,
        third_party_type: thirdPartyType,
        content: content || '',
        fields: detectedVariables,
        wordFilePath: filePath,
        wordFileOriginalName: file.name
      };

      // Configurar compartición de plantillas según rol
      if (userRole === 'super_admin') {
        if (shareWithAllCompanies) {
          // Plantilla compartida con todas las empresas
          templateData.is_shared = true;
          console.log('🌐 Plantilla compartida con todas las empresas');
        } else if (selectedCompanies.length > 0) {
          // Plantilla compartida con empresas específicas
          templateData.is_shared = false;
          templateData.shared_with_companies = selectedCompanies;
          console.log('🏢 Plantilla compartida con', selectedCompanies.length, 'empresas');
        }
      } else if (userRole === 'admin') {
        if (selectedCompanies.length > 0) {
          // Admin puede compartir con empresas específicas
          templateData.shared_with_companies = selectedCompanies;
          console.log('🏢 Admin compartiendo con', selectedCompanies.length, 'empresas');
        } else {
          // Si no selecciona ninguna, solo para su empresa
          templateData.company = currentCompanyId;
        }
      } else if (userRole === 'lawyer') {
        // Abogado solo puede crear para su empresa
        templateData.company = currentCompanyId;
        console.log('👔 Plantilla solo para empresa actual:', currentCompanyId);
      }

      console.log('📝 Creando plantilla...');
      const response = await api.post('/templates', templateData);

      console.log('✅ Plantilla creada exitosamente');

      // Mostrar modal de configuración de campos si hay variables detectadas
      if (detectedVariables.length > 0) {
        console.log('🔧 Mostrando modal de configuración de campos...');
        setShowConfigModal(true);
      } else {
        alert('Plantilla creada exitosamente. Ahora puedes generar contratos desde esta plantilla.');
        resetForm();
      }

      if (onTemplateCreated) {
        onTemplateCreated(response.data.id);
      }
    } catch (error: any) {
      console.error('Error al crear plantilla:', error);
      alert('Error al crear la plantilla: ' + (error.response?.data?.error || 'Error desconocido'));
    } finally {
      setIsProcessing(false);
    }
  };

  const getStepTitle = () => {
    switch (currentStep) {
      case 'upload': return '1. Subir Archivo Word';
      case 'variables': return '2. Variables Detectadas';
      default: return 'Crear Plantilla';
    }
  };

  return (
    <div className="unified-word-template-upload">
      <div className="compact-header">
        <div className="header-content">
          <h2>📝 Crear Plantilla</h2>
          <div className="step-badges">
            <span className={`badge ${currentStep === 'upload' ? 'active' : ''}`}>1. Datos</span>
            <span className={`badge ${currentStep === 'variables' ? 'active' : ''}`}>2. Variables</span>
          </div>
        </div>
      </div>

      {currentStep === 'upload' && (
        <div className="two-column-layout">
          {/* Columna Izquierda - Información Básica */}
          <div className="left-column">
            <div className="section-card">
              <h3 className="card-title">Información Básica</h3>

              <div className="compact-field">
                <label>Nombre</label>
                <input
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="Ej: NDA, Contrato de Servicios"
                  className="compact-input"
                />
              </div>

              <div className="compact-field">
                <label>Descripción</label>
                <textarea
                  value={templateDescription}
                  onChange={(e) => setTemplateDescription(e.target.value)}
                  placeholder="Breve descripción..."
                  className="compact-textarea"
                  rows={2}
                />
              </div>

              <div className="compact-field">
                <label>Tipo de Tercero</label>
                <select
                  value={thirdPartyType}
                  onChange={(e) => setThirdPartyType(e.target.value)}
                  className="compact-select"
                >
                  {thirdPartyTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.icon} {type.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="file-upload-compact">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".docx"
                  onChange={handleFileSelect}
                  className="file-input"
                  id="word-file"
                />
                <label htmlFor="word-file" className="file-label-compact">
                  <span className="file-icon">📄</span>
                  <span className="file-text">{file ? file.name : 'Seleccionar .docx'}</span>
                </label>
              </div>
            </div>

            {userRole === 'lawyer' && (
              <div className="info-box">
                <span className="info-icon">👔</span>
                <span>Plantilla solo para tu empresa</span>
              </div>
            )}
          </div>

          {/* Columna Derecha - Compartir con Empresas */}
          <div className="right-column">

          {/* Selector de empresas - Solo para Admin y Super Admin */}
          {(userRole === 'admin' || userRole === 'super_admin') && (
            <div className="section-card">
              <h3 className="card-title">🏢 Compartir Plantilla</h3>

              {userRole === 'super_admin' && (
                <div className="global-checkbox-wrapper">
                  <label className="global-checkbox-label">
                    <input
                      type="checkbox"
                      id="shareWithAll"
                      checked={shareWithAllCompanies}
                      onChange={(e) => handleShareWithAllChange(e.target.checked)}
                    />
                    <span className="checkbox-text">
                      <strong>🌐 Plantilla Global</strong>
                      <small>Disponible para todas las empresas</small>
                    </span>
                  </label>
                </div>
              )}

              {!shareWithAllCompanies && (
                <>
                  {/* Buscador Compacto */}
                  {availableCompanies.length > 0 && (
                    <div className="search-box-compact">
                      <input
                        type="text"
                        placeholder="🔍 Buscar empresa o NIT..."
                        value={companySearchTerm}
                        onChange={(e) => setCompanySearchTerm(e.target.value)}
                        className="search-input-compact"
                      />
                      {companySearchTerm && (
                        <button
                          onClick={() => setCompanySearchTerm('')}
                          className="clear-btn"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  )}

                  <div className="companies-list-compact">
                    {availableCompanies.length === 0 ? (
                      <div className="loading-compact">Cargando...</div>
                    ) : (
                      (() => {
                        const filteredCompanies = availableCompanies.filter(company =>
                          company.name.toLowerCase().includes(companySearchTerm.toLowerCase()) ||
                          company.tax_id?.toLowerCase().includes(companySearchTerm.toLowerCase())
                        );

                        if (filteredCompanies.length === 0 && companySearchTerm) {
                          return (
                            <div className="no-results-compact">
                              No se encontraron empresas
                            </div>
                          );
                        }

                        return (
                          <div className="companies-grid">
                            {filteredCompanies.map((company) => (
                              <label
                                key={company._id}
                                className={`company-checkbox-item ${selectedCompanies.includes(company._id) ? 'checked' : ''}`}
                              >
                                <input
                                  type="checkbox"
                                  checked={selectedCompanies.includes(company._id)}
                                  onChange={() => handleCompanySelection(company._id)}
                                />
                                <div className="company-details">
                                  <div className="company-name-compact">{company.name}</div>
                                  <div className="company-nit-compact">{company.tax_id || 'Sin NIT'}</div>
                                </div>
                                <div className="check-icon">{selectedCompanies.includes(company._id) ? '✓' : ''}</div>
                              </label>
                            ))}
                          </div>
                        );
                      })()
                    )}
                  </div>
                </>
              )}

              {!shareWithAllCompanies && selectedCompanies.length > 0 && (
                <div className="selection-summary">
                  <strong>{selectedCompanies.length}</strong> {selectedCompanies.length === 1 ? 'empresa seleccionada' : 'empresas seleccionadas'}
                </div>
              )}
            </div>
          )}
          </div>
        </div>
      )}

      {currentStep === 'variables' && (
        <div className="two-column-layout">
          <div className="left-column">
            <div className="section-card">
              <h3 className="card-title">Variables Detectadas ({detectedVariables.length})</h3>

              <div className="variables-list-compact">
                {detectedVariables.map((variable, index) => (
                  <div key={index} className="variable-compact">
                    <div className="var-header">
                      <code>{`{{${variable.marker}}}`}</code>
                      {variable.required && <span className="badge-required">*</span>}
                    </div>
                    <div className="var-label">{variable.field_label}</div>
                    <div className="var-type">{variable.field_type}</div>
                  </div>
                ))}
              </div>

              <button
                onClick={handleCreateTemplate}
                className="btn-create-template"
                disabled={isProcessing}
              >
                {isProcessing ? 'Creando...' : '✓ Crear Plantilla'}
              </button>
            </div>
          </div>

          <div className="right-column">
            <div className="section-card">
              <h3 className="card-title">Vista Previa</h3>
              <div className="preview-content-compact" dangerouslySetInnerHTML={{ __html: preview }} />
            </div>
          </div>
        </div>
      )}

      {isProcessing && (
        <div className="processing">
          <div className="spinner"></div>
          <p>Procesando archivo Word...</p>
        </div>
      )}

      <ThirdPartyFieldConfigModal
        isOpen={showConfigModal}
        onClose={handleConfigModalClose}
        detectedVariables={detectedVariables}
        thirdPartyTypeCode={thirdPartyType}
        onConfigApplied={handleConfigModalClose}
      />
    </div>
  );
};

export default UnifiedWordTemplateUpload;
