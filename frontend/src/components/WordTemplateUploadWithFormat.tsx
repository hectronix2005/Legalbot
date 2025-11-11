import React, { useState } from 'react';
import api from '../services/api';

interface Variable {
  field_name: string;
  descriptive_name: string;
  type: string;
  required: boolean;
  original_marker: string;
  repeat_count: number;
  is_repeated?: boolean;
  repeat_source?: string;
}

interface WordTemplateUploadWithFormatProps {
  onTemplateCreated: (template: any) => void;
}

const WordTemplateUploadWithFormat: React.FC<WordTemplateUploadWithFormatProps> = ({ onTemplateCreated }) => {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [variables, setVariables] = useState<Variable[]>([]);
  const [formattedHtml, setFormattedHtml] = useState<string>('');
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [showVariableForm, setShowVariableForm] = useState(false);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
    }
  };

  const processWordFile = async () => {
    if (!file) return;

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      console.log('📄 Procesando archivo Word con formato preservado...');
      
      const response = await api.post('/templates/process-word-with-format', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      console.log('✅ Respuesta recibida:', response.data);
      console.log('📄 HTML completo recibido:', response.data.formattedHtml?.length, 'caracteres');
      console.log('📄 Vista previa recibida:', response.data.previewHtml?.length, 'caracteres');
      console.log('📄 Primeros 500 caracteres del HTML completo:', response.data.formattedHtml?.substring(0, 500));
      console.log('📄 Últimos 500 caracteres del HTML completo:', response.data.formattedHtml?.substring(Math.max(0, (response.data.formattedHtml?.length || 0) - 500)));
      
      if (response.data.variables && response.data.variables.length > 0) {
        setVariables(response.data.variables);
        setFormattedHtml(response.data.formattedHtml);
        setPreviewHtml(response.data.previewHtml);
        setShowVariableForm(true);
        
        // Generar nombres automáticos para las variables usando el original_marker
        const variablesWithNames = response.data.variables.map((variable: any, index: number) => ({
          ...variable,
          descriptive_name: variable.original_marker || `Variable ${index + 1}`,
          type: 'text',
          required: true
        }));
        setVariables(variablesWithNames);
      } else {
        alert('No se detectaron variables en el documento');
      }
    } catch (error) {
      console.error('Error procesando archivo Word:', error);
      alert('Error al procesar el archivo Word');
    } finally {
      setLoading(false);
    }
  };

  const handleVariableChange = (index: number, field: string, value: string) => {
    const updatedVariables = [...variables];
    updatedVariables[index] = { ...updatedVariables[index], [field]: value };
    setVariables(updatedVariables);
  };

  const handleCheckboxChange = (index: number, field: string, checked: boolean) => {
    const updatedVariables = [...variables];
    updatedVariables[index] = { ...updatedVariables[index], [field]: checked };
    setVariables(updatedVariables);
  };

  const createTemplate = async () => {
    if (!templateName.trim()) {
      alert('Por favor ingresa un nombre para la plantilla');
      return;
    }

    setLoading(true);
    try {
      console.log('🏗️ Creando plantilla con formato preservado...');
      
      // Preparar variables usando original_marker como información descriptiva
      const variablesForTemplate = variables.map(variable => ({
        ...variable,
        descriptive_name: variable.original_marker || variable.descriptive_name || `Variable ${variables.indexOf(variable) + 1}`
      }));

      const response = await api.post('/templates/create-template-with-names', {
        name: templateName,
        description: templateDescription,
        variables: variablesForTemplate,
        html: previewHtml,
        formattedHtml: formattedHtml // Enviar HTML con formato preservado
      });

      console.log('✅ Plantilla creada:', response.data);
      
      alert('Plantilla creada exitosamente con formato preservado');
      onTemplateCreated(response.data.template);
      
      // Reset form
      setFile(null);
      setVariables([]);
      setFormattedHtml('');
      setPreviewHtml('');
      setTemplateName('');
      setTemplateDescription('');
      setShowVariableForm(false);
      
    } catch (error) {
      console.error('Error creando plantilla:', error);
      alert('Error al crear la plantilla');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="word-template-upload">
      <h3>📄 Cargar Plantilla desde Word (Con Formato Preservado)</h3>
      
      <div className="upload-section">
        <input
          type="file"
          accept=".docx,.doc"
          onChange={handleFileChange}
          disabled={loading}
        />
        
        {file && (
          <div className="file-info">
            <p>📁 Archivo seleccionado: {file.name}</p>
            <button 
              onClick={processWordFile} 
              disabled={loading}
              className="btn btn-primary"
            >
              {loading ? 'Procesando...' : 'Procesar con Formato Completo'}
            </button>
          </div>
        )}
      </div>

      {showVariableForm && (
        <div className="variable-form">
          <h4>📝 Configurar Variables de la Plantilla</h4>
          
          <div className="form-group">
            <label>Nombre de la Plantilla:</label>
            <input
              type="text"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="Ej: Contrato de Servicios"
              className="form-control"
            />
          </div>
          
          <div className="form-group">
            <label>Descripción (opcional):</label>
            <textarea
              value={templateDescription}
              onChange={(e) => setTemplateDescription(e.target.value)}
              placeholder="Descripción de la plantilla..."
              className="form-control"
              rows={3}
            />
          </div>

          <h5>🔧 Variables Detectadas ({variables.length}):</h5>
          
          {variables.map((variable, index) => (
            <div key={index} className="variable-item">
              <div className="variable-header">
                <strong>Variable {index + 1}:</strong> {variable.original_marker}
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label>Tipo:</label>
                  <select
                    value={variable.type}
                    onChange={(e) => handleVariableChange(index, 'type', e.target.value)}
                    className="form-control"
                  >
                    <option value="text">Texto</option>
                    <option value="number">Número</option>
                    <option value="date">Fecha</option>
                    <option value="email">Email</option>
                    <option value="textarea">Texto Largo</option>
                  </select>
                </div>
                
                <div className="form-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={variable.required || false}
                      onChange={(e) => handleCheckboxChange(index, 'required', e.target.checked)}
                    />
                    Requerido
                  </label>
                </div>
              </div>

              {/* Campo de repetición de variables */}
              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    checked={variable.is_repeated || false}
                    onChange={(e) => handleCheckboxChange(index, 'is_repeated', e.target.checked)}
                  />
                  Variable repetida
                </label>
                {variable.is_repeated && (
                  <div className="form-group" style={{ marginTop: '10px' }}>
                    <label>Copiar información de la variable número:</label>
                    <select
                      value={variable.repeat_source || ''}
                      onChange={(e) => handleVariableChange(index, 'repeat_source', e.target.value)}
                      className="form-control"
                    >
                      <option value="">Seleccionar variable...</option>
                      {variables.map((otherVariable, otherIndex) => {
                        if (otherIndex !== index) {
                          return (
                            <option key={otherIndex} value={otherIndex + 1}>
                              #{otherIndex + 1} - {otherVariable.original_marker || otherVariable.descriptive_name}
                            </option>
                          );
                        }
                        return null;
                      })}
                    </select>
                  </div>
                )}
              </div>
            </div>
          ))}

          <div className="preview-section">
            <h5>👁️ Vista Previa del Formato:</h5>
            <div 
              className="html-preview"
              dangerouslySetInnerHTML={{ __html: formattedHtml || previewHtml }}
              style={{
                border: '1px solid #ddd',
                padding: '15px',
                borderRadius: '5px',
                backgroundColor: '#f9f9f9',
                maxHeight: '800px',
                overflow: 'auto',
                minHeight: '400px'
              }}
            />
          </div>

          <div className="form-actions">
            <button 
              onClick={createTemplate} 
              disabled={loading || !templateName.trim()}
              className="btn btn-success"
            >
              {loading ? 'Creando...' : 'Crear Plantilla con Formato Preservado'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default WordTemplateUploadWithFormat;
