import React, { useState, useRef } from 'react';
import api from '../services/api';
import './WordTemplateUpload.css';

interface SimpleWordTemplateUploadProps {
  onTemplateCreated?: (templateId: string) => void;
}

const SimpleWordTemplateUpload: React.FC<SimpleWordTemplateUploadProps> = ({ onTemplateCreated }) => {
  const [file, setFile] = useState<File | null>(null);
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [detectedVariables, setDetectedVariables] = useState<any[]>([]);
  const [descriptiveNames, setDescriptiveNames] = useState<{[key: string]: string}>({});
  const [showNameAssignment, setShowNameAssignment] = useState(false);
  const [htmlContent, setHtmlContent] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.toLowerCase().endsWith('.docx')) {
      alert('Por favor selecciona un archivo Word (.docx)');
      return;
    }

    setFile(selectedFile);
    setTemplateName(selectedFile.name.replace('.docx', ''));
  };

  const processWordFile = async (file: File) => {
    if (!templateName.trim()) {
      alert('Por favor ingresa el nombre de la plantilla');
      return;
    }

    setIsProcessing(true);
    
    try {
      const formData = new FormData();
      formData.append('wordFile', file);
      formData.append('name', templateName);
      formData.append('description', templateDescription);
      
      console.log('🚀 Enviando archivo para detectar variables...');
      console.log('📝 Datos enviados:');
      console.log('  - Name:', templateName);
      console.log('  - Description:', templateDescription);
      console.log('  - File:', file.name);
      
      const response = await api.post('/templates/detect-variables', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      console.log('✅ Respuesta recibida:', response.data);
      
      if (response.data.variables && response.data.variables.length > 0) {
        console.log('🎉 VARIABLES DETECTADAS EXITOSAMENTE:');
        console.log('  - Variables count:', response.data.variables.length);
        console.log('  - Message:', response.data.message);
        console.log('  - Variables:', response.data.variables);
        console.log('  - Requires field names:', response.data.requiresFieldNames);

        // Mostrar formulario para asignar nombres descriptivos
        setDetectedVariables(response.data.variables);
        setHtmlContent(response.data.previewHtml || '');
        setShowNameAssignment(true);
        
        // Inicializar nombres descriptivos con valores por defecto
        const initialNames: {[key: string]: string} = {};
        response.data.variables.forEach((variable: any) => {
          initialNames[variable.field_name] = variable.field_label;
        });
        setDescriptiveNames(initialNames);
      } else {
        console.log('⚠️ No se detectaron variables');
        console.log('  - Response data:', response.data);
        alert('No se detectaron variables en el documento. Asegúrate de usar marcadores {{variable}}');
      }
    } catch (error) {
      console.error('Error processing Word file:', error);
      alert('Error al procesar el archivo Word: ' + (error as any).response?.data?.error || 'Error desconocido');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCreateTemplate = async () => {
    if (!templateName.trim()) {
      alert('Por favor ingresa el nombre de la plantilla');
      return;
    }

    setIsProcessing(true);
    
    try {
      // Preparar variables con nombres descriptivos asignados
      const variablesWithNames = detectedVariables.map(variable => ({
        ...variable,
        descriptive_name: descriptiveNames[variable.field_name] || variable.field_label
      }));

      console.log('🏗️ CREANDO PLANTILLA CON NOMBRES DESCRIPTIVOS:');
      console.log('  - Name:', templateName);
      console.log('  - Variables:', variablesWithNames);

      const response = await api.post('/templates/create-template-with-names', {
        name: templateName,
        description: templateDescription,
        variables: variablesWithNames,
        html: htmlContent
      });
      
      console.log('✅ PLANTILLA CREADA EXITOSAMENTE:');
      console.log('  - Template ID:', response.data.templateId);
      console.log('  - Template name:', response.data.template.name);
      console.log('  - Fields:', response.data.template.fields);

      alert(`✅ Plantilla creada exitosamente!\n\nNombre: ${response.data.template.name}\nVariables detectadas: ${response.data.template.fields}\nID: ${response.data.templateId}`);

      // Limpiar formulario
      setFile(null);
      setTemplateName('');
      setTemplateDescription('');
      setDetectedVariables([]);
      setDescriptiveNames({});
      setShowNameAssignment(false);
      setHtmlContent('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      // Notificar al componente padre
      if (onTemplateCreated) {
        onTemplateCreated(response.data.templateId);
      }
    } catch (error) {
      console.error('Error creating template:', error);
      alert('Error al crear la plantilla: ' + (error as any).response?.data?.error || 'Error desconocido');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="word-template-upload">
      <div className="upload-section">
        <h2>Crear Plantilla desde Word</h2>
        <p className="upload-description">
          Sube un archivo Word con marcadores {'{{variable}}'} y se creará automáticamente una plantilla.
        </p>
        
        <div className="file-upload-area">
          <input
            ref={fileInputRef}
            type="file"
            accept=".docx"
            onChange={handleFileSelect}
            className="file-input"
            id="word-file"
          />
          <label htmlFor="word-file" className="file-label">
            {file ? file.name : 'Seleccionar archivo Word (.docx)'}
          </label>
        </div>

        {isProcessing && (
          <div className="processing">
            <div className="spinner"></div>
            <p>Procesando archivo Word y creando plantilla...</p>
          </div>
        )}

        {file && !isProcessing && (
          <div className="template-form">
            <div className="form-group">
              <label htmlFor="template-name">Nombre de la Plantilla:</label>
              <input
                id="template-name"
                type="text"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="Ej: Contrato de Servicios"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="template-description">Descripción:</label>
              <textarea
                id="template-description"
                value={templateDescription}
                onChange={(e) => setTemplateDescription(e.target.value)}
                placeholder="Descripción de la plantilla..."
                rows={3}
              />
            </div>

            <div className="submit-section">
              <button 
                onClick={() => processWordFile(file)}
                className="btn-submit"
                disabled={isProcessing || !templateName.trim()}
              >
                {isProcessing ? 'Procesando...' : 'Crear Plantilla'}
              </button>
            </div>
          </div>
        )}

        {showNameAssignment && (
          <div className="name-assignment-form">
            <h3>Asignar Nombres Descriptivos a las Variables</h3>
            <p className="assignment-description">
              Asigna nombres descriptivos a cada variable detectada. Estos nombres aparecerán en el formulario de generación de contratos.
            </p>
            
            <div className="variables-list">
              {detectedVariables.map((variable, index) => (
                <div key={`${variable.field_name}-${index}`} className="variable-item">
                  <div className="variable-info">
                    <strong>Variable {index + 1}:</strong>
                    <code>{'{'}{'{'}{variable.original_marker}{'}'}{'}'}</code>
                    <span className="variable-label">(aparece {variable.repeat_count} veces)</span>
                  </div>
                  <div className="name-assignment">
                    <label htmlFor={`descriptive-name-${variable.field_name}-${index}`}>
                      Nombre Descriptivo:
                    </label>
                    <input
                      id={`descriptive-name-${variable.field_name}-${index}`}
                      type="text"
                      value={descriptiveNames[variable.field_name] || ''}
                      onChange={(e) => setDescriptiveNames(prev => ({
                        ...prev,
                        [variable.field_name]: e.target.value
                      }))}
                      placeholder={`Ej: ${variable.field_label}`}
                      required
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="submit-section">
              <button 
                onClick={handleCreateTemplate}
                className="btn-submit"
                disabled={isProcessing}
              >
                {isProcessing ? 'Creando Plantilla...' : 'Crear Plantilla con Nombres Asignados'}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="instructions">
        <h3>Instrucciones:</h3>
        <ol>
          <li>Prepara tu documento Word con marcadores como: <code>{'{{nombre_empresa}}'}</code>, <code>{'{{fecha_contrato}}'}</code>, etc.</li>
          <li>Selecciona el archivo Word (.docx)</li>
          <li>Ingresa el nombre y descripción de la plantilla</li>
          <li>Haz clic en "Crear Plantilla"</li>
          <li>El sistema detectará automáticamente las variables y creará la plantilla</li>
        </ol>
      </div>
    </div>
  );
};

export default SimpleWordTemplateUpload;
