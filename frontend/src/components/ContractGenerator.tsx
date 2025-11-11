import React, { useState, useEffect } from 'react';
import api from '../services/api';
import './ContractGenerator.css';

interface TemplateField {
  field_name: string;
  field_label: string;
  field_type: string;
  required: boolean;
  original_marker: string;
  can_repeat: boolean;
  repeat_source?: number | string;
  repeat_count: number;
  field_options?: string[];
}

interface Template {
  _id: string;
  name: string;
  description: string;
  category: string;
  fields: TemplateField[];
}

interface ContractData {
  [key: string]: string;
}

const ContractGenerator: React.FC = () => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [contractData, setContractData] = useState<ContractData>({});
  const [generatedContract, setGeneratedContract] = useState<string>('');
  const [generatedContractId, setGeneratedContractId] = useState<string>('');
  const [generatedContractNumber, setGeneratedContractNumber] = useState<string>('');
  const [wordFile, setWordFile] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [allFieldsFilled, setAllFieldsFilled] = useState(false);
  
  // Wrapper para setAllFieldsFilled con logging
  const setAllFieldsFilledWithLog = (value: boolean) => {
    console.log('🔄 setAllFieldsFilled llamado con:', value);
    setAllFieldsFilled(value);
  };

  console.log('🔄 ContractGenerator render - allFieldsFilled:', allFieldsFilled);

  // Cargar plantillas disponibles
  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const response = await api.get('/templates');
        setTemplates(response.data);
      } catch (err) {
        console.error('Error fetching templates:', err);
        setError('Error al cargar las plantillas');
      }
    };

    fetchTemplates();
  }, []);

  // Función auxiliar para remover acentos (necesaria antes de useEffect)
  const removeAccentsHelper = (str: string): string => {
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  };

  // Normalizar nombres de campo (necesaria antes de useEffect)
  const normalizeFieldNameHelper = (fieldName: string): string => {
    return removeAccentsHelper(fieldName)
      .toLowerCase()
      .replace(/[_\s\/\-]+/g, '')
      .replace(/de/g, '')
      .replace(/del/g, '')
      .replace(/la/g, '')
      .replace(/el/g, '');
  };

  // Actualizar estado de validación cuando cambien los datos o la plantilla
  useEffect(() => {
    console.log('🔄 useEffect ejecutado - Validación');
    console.log('  - selectedTemplate:', !!selectedTemplate);
    console.log('  - selectedTemplate name:', selectedTemplate?.name);
    console.log('  - contractData keys:', Object.keys(contractData));
    console.log('  - contractData values:', Object.values(contractData));

    if (selectedTemplate) {
      // Obtener campos únicos requeridos usando normalización (evitar duplicados)
      const uniqueRequiredFields = new Map<string, TemplateField>();
      selectedTemplate.fields.forEach(field => {
        if (field.required) {
          const normalizedName = normalizeFieldNameHelper(field.field_name);
          if (!uniqueRequiredFields.has(normalizedName)) {
            uniqueRequiredFields.set(normalizedName, field);
          }
        }
      });

      const requiredFields = Array.from(uniqueRequiredFields.values());
      console.log('  - Required fields count (unique):', requiredFields.length);
      console.log('  - Required field names:', requiredFields.map(f => f.field_name));

      const fieldResults = requiredFields.map(field => {
        const value = contractData[field.field_name];
        const isFilled = value && value.trim() !== '';
        console.log(`    - ${field.field_name}: "${value}" → ${isFilled ? 'LLENO' : 'VACÍO'}`);
        return isFilled;
      });

      const filled = fieldResults.every(result => result);
      console.log('  - Todos llenos:', filled);
      console.log('  - Llamando setAllFieldsFilled con:', filled);
      setAllFieldsFilledWithLog(filled);
    } else {
      console.log('  - No hay plantilla seleccionada');
      console.log('  - Llamando setAllFieldsFilled con: false');
      setAllFieldsFilledWithLog(false);
    }
  }, [contractData, selectedTemplate]);

  // useEffect adicional para forzar validación en cada render
  useEffect(() => {
    console.log('🔄 useEffect adicional - Forzar validación');
    if (selectedTemplate && Object.keys(contractData).length > 0) {
      // Usar normalización también aquí
      const uniqueRequiredFields = new Map<string, TemplateField>();
      selectedTemplate.fields.forEach(field => {
        if (field.required) {
          const normalizedName = normalizeFieldNameHelper(field.field_name);
          if (!uniqueRequiredFields.has(normalizedName)) {
            uniqueRequiredFields.set(normalizedName, field);
          }
        }
      });

      const requiredFields = Array.from(uniqueRequiredFields.values());
      const filled = requiredFields.every(field => {
        const value = contractData[field.field_name];
        return value && value.trim() !== '';
      });

      console.log('🔄 Validación forzada - Todos llenos:', filled);
      if (allFieldsFilled !== filled) {
        console.log('🔄 Estado cambió, actualizando...');
        setAllFieldsFilledWithLog(filled);
      }
    }
  });

  // Manejar selección de plantilla
  const handleTemplateSelect = (template: Template) => {
    setSelectedTemplate(template);
    setContractData({});
    setGeneratedContract('');
    setGeneratedContractId('');
    setGeneratedContractNumber('');
    setWordFile('');
    setError('');
    
    // Inicializar datos del contrato con valores vacíos para TODOS los campos
    const initialData: ContractData = {};
    
    // Usar un Set para evitar campos duplicados
    const uniqueFieldNames = new Set<string>();
    
    template.fields.forEach(field => {
      const fieldName = field.field_name;
      if (!uniqueFieldNames.has(fieldName)) {
        uniqueFieldNames.add(fieldName);
        initialData[fieldName] = '';
      }
    });
    
    console.log('📝 Inicializando datos de plantilla:');
    console.log('  - Total fields in template:', template.fields.length);
    console.log('  - Unique field names:', uniqueFieldNames.size);
    console.log('  - Field names:', Array.from(uniqueFieldNames));
    
    setContractData(initialData);
  };

  // Manejar cambios en los campos del formulario
  const handleFieldChange = (fieldName: string, value: string) => {
    const newData = { ...contractData };
    newData[fieldName] = value;

    console.log('📝 CAMPO ACTUALIZADO:', fieldName, '→', `"${value}"`);

    // Actualizar todas las variables con nombres similares (mismo nombre normalizado)
    if (selectedTemplate) {
      const normalizedName = normalizeFieldName(fieldName);
      const relatedFields = selectedTemplate.fields.filter(f =>
        normalizeFieldName(f.field_name) === normalizedName
      );

      relatedFields.forEach(relatedField => {
        if (relatedField.field_name !== fieldName) {
          newData[relatedField.field_name] = value;
          console.log('🔄 CAMPO SIMILAR ACTUALIZADO:', relatedField.field_name, '→', `"${value}"`);
        }
      });

      // También actualizar variables que se repiten explícitamente
      const sourceField = selectedTemplate.fields.find(f => f.field_name === fieldName);
      if (sourceField) {
        const dependentFields = selectedTemplate.fields.filter(f =>
          f.can_repeat && f.repeat_source && f.repeat_source === sourceField.field_name
        );

        dependentFields.forEach(dependentField => {
          const dependentFieldName = dependentField.field_name;
          newData[dependentFieldName] = value;
          console.log('🔄 VARIABLE REPETIDA ACTUALIZADA:', dependentFieldName, '→', `"${value}"`);
        });
      }
    }

    setContractData(newData);
  };

  // Verificar si todos los campos requeridos están llenos
  const areAllRequiredFieldsFilled = () => {
    return allFieldsFilled;
  };

  // Generar contrato
  const generateContract = async () => {
    if (!selectedTemplate) return;

    // Validar campos requeridos antes de enviar
    if (!areAllRequiredFieldsFilled()) {
      const requiredFields = selectedTemplate.fields.filter(field => field.required);
      const missingFields = requiredFields.filter(field => {
        const value = contractData[field.field_name];
        return !value || value.trim() === '';
      });
      
      setError(`Por favor completa todos los campos requeridos. Faltan: ${missingFields.map(f => f.field_label).join(', ')}`);
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Asegurar que todos los campos de la plantilla estén presentes
      const completeData: ContractData = {};
      selectedTemplate.fields.forEach(field => {
        // Usar field_name directamente del backend, no normalizar
        const fieldName = field.field_name;
        completeData[fieldName] = contractData[fieldName] || '';
      });

      console.log('📤 Enviando datos completos:', {
        templateId: selectedTemplate._id,
        dataFields: Object.keys(completeData).length,
        data: completeData
      });
      
      // Log detallado de la plantilla
      console.log('🔍 DEBUG: Información de la plantilla:');
      console.log('  - Template ID:', selectedTemplate._id);
      console.log('  - Template Name:', selectedTemplate.name);
      console.log('  - Total fields:', selectedTemplate.fields.length);
      
      // Log de campos requeridos
      const requiredFields = selectedTemplate.fields.filter(field => field.required);
      console.log('  - Required fields:', requiredFields.length);
      requiredFields.forEach((field, index) => {
        console.log(`    ${index + 1}. ${field.field_label} (${field.field_name})`);
      });
      
      // Log de datos enviados
      console.log('🔍 DEBUG: Datos que se enviarán:');
      Object.keys(completeData).forEach(fieldName => {
        const value = completeData[fieldName];
        const isEmpty = !value || value.trim() === '';
        console.log(`  - ${fieldName}: "${value}" ${isEmpty ? '(VACÍO)' : '(LLENO)'}`);
      });
      
      // Verificar campos faltantes
      const missingFields = requiredFields.filter(field => 
        !completeData[field.field_name] || completeData[field.field_name].trim() === ''
      );
      if (missingFields.length > 0) {
        console.log('❌ CAMPOS FALTANTES:');
        missingFields.forEach(field => {
          console.log(`  - ${field.field_label} (${field.field_name})`);
        });
      } else {
        console.log('✅ Todos los campos requeridos están llenos');
      }

      const response = await api.post('/contract-generator/generate', {
        templateId: selectedTemplate._id,
        data: completeData
      });

      setGeneratedContract(response.data.contract);
      setGeneratedContractId(response.data.contractId);
      setGeneratedContractNumber(response.data.contract_number);
      setWordFile(response.data.word_file);

      console.log('✅ Contrato generado exitosamente:');
      console.log('  - ID:', response.data.contractId);
      console.log('  - Número:', response.data.contract_number);
      console.log('  - Word file:', response.data.word_file);
    } catch (err: any) {
      console.error('❌ Error generating contract:', err);
      console.error('❌ Error response:', err.response?.data);
      console.error('❌ Error status:', err.response?.status);
      
      if (err.response?.data?.missingFields) {
        console.error('❌ Missing fields:', err.response.data.missingFields);
      }
      
      setError(err.response?.data?.message || 'Error al generar el contrato');
    } finally {
      setLoading(false);
    }
  };

  // Función para descargar archivos
  const downloadFile = async (filePath: string, fileName: string) => {
    try {
      const response = await api.get(`/contracts/download/${encodeURIComponent(filePath)}`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading file:', error);
      setError('Error al descargar el archivo');
    }
  };

  // Función auxiliar para remover acentos
  const removeAccents = (str: string): string => {
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  };

  // Normalizar nombres de campo para agrupar variables similares
  const normalizeFieldName = (fieldName: string): string => {
    return removeAccents(fieldName)
      .toLowerCase()
      .replace(/[_\s\/\-]+/g, '') // Remover espacios, guiones bajos, barras y guiones
      .replace(/de/g, '') // Remover "de"
      .replace(/del/g, '') // Remover "del"
      .replace(/la/g, '') // Remover "la"
      .replace(/el/g, ''); // Remover "el"
  };

  // Obtener campos únicos (sin repeticiones, usando normalización)
  const getUniqueFields = () => {
    if (!selectedTemplate) return [];

    // Filtrar campos únicos usando normalización para detectar duplicados
    const uniqueFields: TemplateField[] = [];
    const seenNormalizedNames = new Set<string>();

    selectedTemplate.fields.forEach(field => {
      const normalizedName = normalizeFieldName(field.field_name);
      if (!seenNormalizedNames.has(normalizedName)) {
        seenNormalizedNames.add(normalizedName);
        uniqueFields.push(field);
        console.log(`✅ Campo único: "${field.field_name}" (normalizado: "${normalizedName}")`);
      } else {
        console.log(`⚠️  Campo duplicado omitido: "${field.field_name}" (normalizado: "${normalizedName}")`);
      }
    });

    console.log('🔍 getUniqueFields:');
    console.log('  - Total fields in template:', selectedTemplate.fields.length);
    console.log('  - Unique fields returned:', uniqueFields.length);

    return uniqueFields;
  };

  // Extraer el nombre de la variable del marcador original
  // const getVariableName = (originalMarker: string) => {
  //   // Extraer el contenido entre {{}}
  //   const match = originalMarker.match(/\{\{([^}]+)\}\}/);
  //   if (!match) return originalMarker;
  //
  //   // Normalizar el nombre de la variable
  //   let variableName = match[1].trim();
  //
  //   // Remover etiquetas HTML y normalizar
  //   variableName = variableName
  //     .replace(/<[^>]*>/g, '') // Remover etiquetas HTML
  //     .replace(/\s+/g, '_') // Reemplazar espacios con guiones bajos
  //     .replace(/[^a-zA-Z0-9_]/g, '') // Remover caracteres especiales
  //     .toLowerCase();
  //
  //   return variableName;
  // };

  // Obtener variables que se repiten
  const getRepeatedVariables = () => {
    if (!selectedTemplate) return [];
    
    // Filtrar variables reutilizadas y eliminar duplicados
    const repeatedFields: TemplateField[] = [];
    const seenVariables = new Set<string>();
    
    selectedTemplate.fields.forEach(field => {
      if (field.can_repeat && field.repeat_source) {
        const fieldName = field.field_name;
        if (!seenVariables.has(fieldName)) {
          seenVariables.add(fieldName);
          repeatedFields.push(field);
        }
      }
    });
    
    return repeatedFields;
  };

  return (
    <div className="contract-generator">
      <div className="generator-header">
        <h2>Generador de Contratos</h2>
        <p>Selecciona una plantilla y completa los datos para generar tu contrato</p>
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {/* Selección de plantilla */}
      <div className="template-selection">
        <h3>1. Seleccionar Plantilla</h3>
        <div className="templates-grid">
          {templates.map(template => (
            <div 
              key={template._id}
              className={`template-card ${selectedTemplate?._id === template._id ? 'selected' : ''}`}
              onClick={() => handleTemplateSelect(template)}
            >
              <h4>{template.name}</h4>
              <p className="template-category">{template.category}</p>
              <p className="template-description">{template.description}</p>
              <div className="template-stats">
                <span>{template.fields.length} campos</span>
                {template.fields.filter(f => f.can_repeat).length > 0 && (
                  <span className="repeat-info">
                    {template.fields.filter(f => f.can_repeat).length} variables reutilizables
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Formulario de datos */}
      {selectedTemplate && (
        <div className="contract-form">
          <h3>2. Completar Información</h3>
          
          {/* Campos únicos */}
          <div className="form-section">
            <h4>Información Principal</h4>
            <div className="form-grid">
              {getUniqueFields().map((field, index) => {
                const fieldName = field.field_name;
                return (
                  <div key={`${field.field_name}-${index}`} className="form-field">
                    <label htmlFor={fieldName}>
                      {field.field_label}
                      {field.required && <span className="required">*</span>}
                    </label>
                    
                    {field.field_type === 'textarea' ? (
                      <textarea
                        id={fieldName}
                        value={contractData[fieldName] || ''}
                        onChange={(e) => handleFieldChange(fieldName, e.target.value)}
                        className="form-input"
                        rows={3}
                        required={field.required}
                      />
                    ) : field.field_type === 'select' ? (
                      <select
                        id={fieldName}
                        value={contractData[fieldName] || ''}
                        onChange={(e) => handleFieldChange(fieldName, e.target.value)}
                        className="form-input"
                        required={field.required}
                      >
                        <option value="">Seleccionar...</option>
                        {field.field_options?.map((option: string) => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type={field.field_type === 'date' ? 'date' : field.field_type === 'email' ? 'email' : 'text'}
                        id={fieldName}
                        value={contractData[fieldName] || ''}
                        onChange={(e) => handleFieldChange(fieldName, e.target.value)}
                        className="form-input"
                        required={field.required}
                      />
                    )}
                    
                    {field.repeat_count > 1 && (
                      <div className="repeat-indicator">
                        📋 Se usará en {field.repeat_count} ubicaciones
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Variables reutilizadas */}
          {getRepeatedVariables().length > 0 && (
            <div className="form-section">
              <h4>Variables Reutilizadas</h4>
              <p className="section-description">
                Estas variables se llenan automáticamente basándose en la información principal
              </p>
              <div className="repeated-variables">
                {getRepeatedVariables().map((field, index) => {
                  const fieldName = field.field_name;
                  const sourceField = selectedTemplate.fields.find(f => f.field_name === String(field.repeat_source));
                  return (
                    <div key={`${field.field_name}-${index}`} className="repeated-variable">
                      <div className="variable-info">
                        <strong>{field.field_label}</strong>
                        <span className="source-info">
                          ← Copia de: {sourceField?.field_label}
                        </span>
                      </div>
                      <div className="variable-value">
                        {contractData[fieldName] || 'Se llenará automáticamente'}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Botón de generación */}
          <div className="form-actions">
            <button 
              onClick={generateContract}
              disabled={loading || !areAllRequiredFieldsFilled()}
              className="generate-button"
            >
              {loading ? 'Generando...' : 'Generar Contrato'}
            </button>
            {!areAllRequiredFieldsFilled() && (
              <p className="validation-message">
                ⚠️ Completa todos los campos requeridos para generar el contrato
              </p>
            )}
            {/* Debug info */}
            <div style={{ fontSize: '12px', color: '#666', marginTop: '10px' }}>
              DEBUG: allFieldsFilled = {allFieldsFilled.toString()}
            </div>
          </div>
        </div>
      )}

      {/* Contrato generado */}
      {generatedContract && (
        <div className="generated-contract">
          <h3>3. Contrato Generado</h3>
          {generatedContractNumber && (
            <div className="contract-info">
              <p><strong>Número de Contrato:</strong> {generatedContractNumber}</p>
              <p><strong>ID:</strong> {generatedContractId}</p>
            </div>
          )}
          <div className="contract-content">
            <pre>{generatedContract}</pre>
          </div>
          <div className="contract-actions">
            <button 
              onClick={() => navigator.clipboard.writeText(generatedContract)}
              className="copy-button"
            >
              Copiar Contrato
            </button>
            {wordFile && (
              <button 
                onClick={() => downloadFile(wordFile, `contrato-${generatedContractNumber || selectedTemplate?.name || 'generado'}.docx`)}
                className="download-button word-button"
              >
                📄 Descargar Word
              </button>
            )}
            <button 
              onClick={() => {
                const blob = new Blob([generatedContract], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `contrato-${generatedContractNumber || selectedTemplate?.name || 'generado'}.txt`;
                a.click();
              }}
              className="download-button"
            >
              📝 Descargar TXT
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContractGenerator;
