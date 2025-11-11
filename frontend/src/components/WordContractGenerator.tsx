import React, { useState, useEffect } from 'react';
import api from '../services/api';
import './WordContractGenerator.css';

interface WordTemplate {
  _id: string;
  name: string;
  description: string;
  fields: Array<{
    name: string;
    type: string;
    required: boolean;
    description?: string;
    options?: string[];
  }>;
  word_file_original_name: string;
}

interface Supplier {
  _id: string;
  identification_type: string;
  identification_number: string;
  id_issue_city?: string;
  legal_name?: string;
  legal_name_short?: string;
  legal_representative_name?: string;
  legal_representative_id_type?: string;
  legal_representative_id_number?: string;
  full_name?: string;
  licensee_name?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
  company: string;
  third_party_type?: string;
  custom_fields?: Record<string, any>;
  active: boolean;
  approval_status: string;
}

interface WordContractGeneratorProps {
  onContractGenerated?: (contractId: string) => void;
}

const WordContractGenerator: React.FC<WordContractGeneratorProps> = ({ onContractGenerated }) => {
  const [templates, setTemplates] = useState<WordTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<WordTemplate | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);

  useEffect(() => {
    fetchTemplates();
    fetchSuppliers();
  }, []);

  const fetchTemplates = async () => {
    try {
      const response = await api.get('/templates');
      setTemplates(response.data);
    } catch (error) {
      console.error('Error fetching templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSuppliers = async () => {
    setLoadingSuppliers(true);
    try {
      console.log('🔍 [WordContractGenerator] Fetching suppliers...');
      const response = await api.get('/suppliers');
      console.log('✅ [WordContractGenerator] Suppliers fetched:', response.data);

      // Asegurar que response.data es un array
      if (Array.isArray(response.data)) {
        setSuppliers(response.data);
      } else if (response.data && Array.isArray(response.data.suppliers)) {
        setSuppliers(response.data.suppliers);
      } else {
        console.error('⚠️ [WordContractGenerator] Unexpected response format:', response.data);
        setSuppliers([]);
      }
    } catch (error: any) {
      console.error('❌ [WordContractGenerator] Error fetching suppliers:', error);
      console.error('Error details:', error.response?.data);
      setSuppliers([]);
    } finally {
      setLoadingSuppliers(false);
    }
  };

  const handleTemplateSelect = (template: WordTemplate) => {
    setSelectedTemplate(template);
    setFormData({});
    setSelectedSupplier(null); // Reset supplier selection when changing template
  };

  const normalizeFieldName = (fieldName: string): string => {
    return fieldName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove accents
      .replace(/[^a-z0-9]/g, ''); // Remove special characters
  };

  const findMatchingSupplierField = (templateFieldName: string, supplier: Supplier): any => {
    const normalizedTemplateField = normalizeFieldName(templateFieldName);

    // Direct mapping dictionary with common variations
    const fieldMappings: Record<string, string[]> = {
      // Email
      'email': ['email', 'correo', 'correelectronico', 'mail'],
      // Phone
      'telefono': ['phone', 'telefono', 'celular', 'movil', 'tel'],
      'phone': ['phone', 'telefono', 'celular', 'movil', 'tel'],
      // Address
      'direccion': ['address', 'direccion', 'domicilio'],
      'address': ['address', 'direccion', 'domicilio'],
      // City
      'ciudad': ['city', 'ciudad', 'municipio'],
      'city': ['city', 'ciudad', 'municipio'],
      // Country
      'pais': ['country', 'pais', 'nacion'],
      'country': ['country', 'pais', 'nacion'],
      // Identification
      'identificacion': ['identification_number', 'identificacion', 'nit', 'cedula', 'documento', 'nrodocumento'],
      'nit': ['identification_number', 'identificacion', 'nit'],
      'cedula': ['identification_number', 'identificacion', 'cedula'],
      'documento': ['identification_number', 'identificacion', 'documento'],
      // Identification type
      'tipodocumento': ['identification_type', 'tipodocumento', 'tipoidentificacion'],
      'tipoidentificacion': ['identification_type', 'tipodocumento', 'tipoidentificacion'],
      // Names
      'nombre': ['full_name', 'legal_name', 'nombre', 'nombreCompleto', 'razonsocial'],
      'razonsocial': ['legal_name', 'razonsocial', 'nombre', 'nombreCompleto'],
      'nombreempresa': ['legal_name', 'legal_name_short', 'nombreempresa', 'empresa'],
      'empresa': ['legal_name', 'legal_name_short', 'nombreempresa', 'empresa'],
      // Legal representative
      'representantelegal': ['legal_representative_name', 'representantelegal', 'representante'],
      'representante': ['legal_representative_name', 'representantelegal', 'representante'],
      'cedularepresentante': ['legal_representative_id_number', 'cedularepresentante', 'documentorepresentante'],
      'documentorepresentante': ['legal_representative_id_number', 'cedularepresentante', 'documentorepresentante'],
      'tipoiddrepresentante': ['legal_representative_id_type', 'tipoiddrepresentante'],
      // City of issue
      'ciudadexpedicion': ['id_issue_city', 'ciudadexpedicion', 'lugarexpedicion'],
      'lugarexpedicion': ['id_issue_city', 'ciudadexpedicion', 'lugarexpedicion'],
    };

    // First check direct field mappings
    for (const [key, variations] of Object.entries(fieldMappings)) {
      const normalizedKey = normalizeFieldName(key);
      if (normalizedTemplateField.includes(normalizedKey) || normalizedKey.includes(normalizedTemplateField)) {
        for (const variation of variations) {
          const supplierValue = (supplier as any)[variation];
          if (supplierValue !== undefined && supplierValue !== null && supplierValue !== '') {
            return supplierValue;
          }
        }
      }
    }

    // Then try direct field name match in supplier
    const supplierFields = Object.keys(supplier);
    for (const supplierField of supplierFields) {
      const normalizedSupplierField = normalizeFieldName(supplierField);

      // Check if fields match or contain each other
      if (normalizedTemplateField === normalizedSupplierField ||
          normalizedTemplateField.includes(normalizedSupplierField) ||
          normalizedSupplierField.includes(normalizedTemplateField)) {
        const value = (supplier as any)[supplierField];
        if (value !== undefined && value !== null && value !== '') {
          return value;
        }
      }
    }

    // Check custom fields if they exist
    if (supplier.custom_fields) {
      for (const [customFieldKey, customFieldValue] of Object.entries(supplier.custom_fields)) {
        const normalizedCustomField = normalizeFieldName(customFieldKey);
        if (normalizedTemplateField === normalizedCustomField ||
            normalizedTemplateField.includes(normalizedCustomField) ||
            normalizedCustomField.includes(normalizedTemplateField)) {
          if (customFieldValue !== undefined && customFieldValue !== null && customFieldValue !== '') {
            return customFieldValue;
          }
        }
      }
    }

    return null;
  };

  const handleSupplierSelect = (supplierId: string) => {
    console.log('🔍 [handleSupplierSelect] Called with supplierId:', supplierId);

    if (!supplierId) {
      console.log('⚠️ [handleSupplierSelect] No supplier ID provided, clearing selection');
      setSelectedSupplier(null);
      return;
    }

    const supplier = suppliers.find(s => s._id === supplierId);
    console.log('🔍 [handleSupplierSelect] Found supplier:', supplier ? supplier.legal_name || supplier.full_name : 'NOT FOUND');
    console.log('🔍 [handleSupplierSelect] Selected template:', selectedTemplate ? selectedTemplate.name : 'NO TEMPLATE');

    if (!supplier || !selectedTemplate) {
      console.error('❌ [handleSupplierSelect] Missing supplier or template');
      return;
    }

    setSelectedSupplier(supplier);
    console.log('✅ [handleSupplierSelect] Supplier set:', supplier.legal_name || supplier.full_name);

    // Auto-fill form data with supplier information
    const newFormData: Record<string, any> = { ...formData };
    console.log('🔍 [handleSupplierSelect] Template fields count:', selectedTemplate.fields.length);

    let matchedFieldsCount = 0;
    selectedTemplate.fields.forEach(field => {
      const matchedValue = findMatchingSupplierField(field.name, supplier);
      console.log(`  📋 Field "${field.name}" -> ${matchedValue !== null ? `"${matchedValue}"` : 'NO MATCH'}`);

      if (matchedValue !== null) {
        newFormData[field.name] = matchedValue;
        matchedFieldsCount++;
      }
    });

    console.log(`✅ [handleSupplierSelect] Matched ${matchedFieldsCount}/${selectedTemplate.fields.length} fields`);
    console.log('🔍 [handleSupplierSelect] New form data:', newFormData);
    setFormData(newFormData);
    console.log('✅ [handleSupplierSelect] Form data updated');
  };

  const handleInputChange = (fieldName: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [fieldName]: value
    }));
  };

  const generateContract = async () => {
    if (!selectedTemplate) return;

    setGenerating(true);
    try {
      const response = await api.post('/templates/generate-word-contract', {
        templateId: selectedTemplate._id,
        formData
      }, {
        responseType: 'blob'
      });

      // Crear URL para descargar el documento
      const blob = new Blob([response.data], { 
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${selectedTemplate.name}_generado.docx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      // Crear contrato en la base de datos
      const contractResponse = await api.post('/contracts', {
        title: `${selectedTemplate.name} - ${new Date().toLocaleDateString()}`,
        company: 'Empresa del Usuario', // Esto debería venir del contexto del usuario
        status: 'borrador',
        description: `Contrato generado desde plantilla: ${selectedTemplate.name}`,
        template_id: selectedTemplate._id
      });

      if (onContractGenerated) {
        onContractGenerated(contractResponse.data.id);
      }

      alert('Contrato generado exitosamente');
    } catch (error) {
      console.error('Error generating contract:', error);
      alert('Error al generar el contrato');
    } finally {
      setGenerating(false);
    }
  };

  const renderField = (field: any) => {
    const value = formData[field.name] || '';

    switch (field.type) {
      case 'text':
      case 'email':
        return (
          <input
            type={field.type}
            value={value}
            onChange={(e) => handleInputChange(field.name, e.target.value)}
            placeholder={field.description || field.name}
            required={field.required}
            className="form-input"
          />
        );
      
      case 'number':
        return (
          <input
            type="number"
            value={value}
            onChange={(e) => handleInputChange(field.name, e.target.value)}
            placeholder={field.description || field.name}
            required={field.required}
            className="form-input"
          />
        );
      
      case 'date':
        return (
          <input
            type="date"
            value={value}
            onChange={(e) => handleInputChange(field.name, e.target.value)}
            required={field.required}
            className="form-input"
          />
        );
      
      case 'select':
        return (
          <select
            value={value}
            onChange={(e) => handleInputChange(field.name, e.target.value)}
            required={field.required}
            className="form-input"
          >
            <option value="">Seleccionar...</option>
            {field.options?.map((option: string, index: number) => (
              <option key={index} value={option}>{option}</option>
            ))}
          </select>
        );
      
      default:
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => handleInputChange(field.name, e.target.value)}
            placeholder={field.description || field.name}
            required={field.required}
            className="form-input"
          />
        );
    }
  };

  if (loading) {
    return <div className="loading">Cargando plantillas...</div>;
  }

  return (
    <div className="word-contract-generator">
      <div className="generator-header">
        <h2>Generador de Contratos desde Word</h2>
        <p>Selecciona una plantilla y completa los campos para generar tu contrato</p>
      </div>

      <div className="generator-content">
        <div className="templates-section">
          <h3>Plantillas Disponibles</h3>
          {templates.length === 0 ? (
            <div className="no-templates">
              <p>No hay plantillas disponibles</p>
            </div>
          ) : (
            <div className="templates-grid">
              {templates.map(template => (
                <div 
                  key={template._id} 
                  className={`template-card ${selectedTemplate?._id === template._id ? 'selected' : ''}`}
                  onClick={() => handleTemplateSelect(template)}
                >
                  <h4>{template.name}</h4>
                  <p>{template.description}</p>
                  <div className="template-info">
                    <span className="field-count">
                      {template.fields?.length || 0} campos
                    </span>
                    <span className="template-type">Word</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {selectedTemplate && (
          <div className="form-section">
            <div className="form-header">
              <h3>Completar Información</h3>
              <p>Plantilla: {selectedTemplate.name}</p>
            </div>

            {/* Selector de Terceros */}
            <div className="supplier-selector-section">
              <div className="field-group">
                <label className="field-label">
                  Seleccionar Tercero (Opcional)
                  <span className="field-hint"> - Prellena automáticamente los campos del formulario</span>
                </label>
                <select
                  value={selectedSupplier?._id || ''}
                  onChange={(e) => handleSupplierSelect(e.target.value)}
                  className="form-input supplier-select"
                  disabled={loadingSuppliers}
                >
                  <option value="">-- Seleccionar tercero existente --</option>
                  {suppliers.map(supplier => {
                    const displayName = supplier.legal_name || supplier.full_name || supplier.identification_number;
                    const displayId = supplier.identification_number;
                    return (
                      <option key={supplier._id} value={supplier._id}>
                        {displayName} ({displayId})
                      </option>
                    );
                  })}
                </select>
                {loadingSuppliers && <p className="loading-text">Cargando terceros...</p>}
                {selectedSupplier && (
                  <div className="selected-supplier-info">
                    <p className="info-text">
                      Tercero seleccionado: <strong>{selectedSupplier.legal_name || selectedSupplier.full_name}</strong>
                    </p>
                    <p className="info-subtext">Los campos se han prellenado automáticamente. Puedes modificarlos si es necesario.</p>
                  </div>
                )}
              </div>
            </div>

            <div className="form-fields">
              {selectedTemplate.fields?.map((field, index) => (
                <div key={index} className="field-group">
                  <label className="field-label">
                    {field.name}
                    {field.required && <span className="required">*</span>}
                  </label>
                  {field.description && (
                    <p className="field-description">{field.description}</p>
                  )}
                  {renderField(field)}
                </div>
              ))}
            </div>

            <div className="form-actions">
              <button
                onClick={generateContract}
                disabled={generating}
                className="btn-generate"
              >
                {generating ? 'Generando...' : 'Generar Contrato'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WordContractGenerator;
