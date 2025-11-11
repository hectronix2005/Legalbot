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

interface WordContractGeneratorProps {
  onContractGenerated?: (contractId: string) => void;
}

const WordContractGenerator: React.FC<WordContractGeneratorProps> = ({ onContractGenerated }) => {
  const [templates, setTemplates] = useState<WordTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<WordTemplate | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    fetchTemplates();
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

  const handleTemplateSelect = (template: WordTemplate) => {
    setSelectedTemplate(template);
    setFormData({});
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
