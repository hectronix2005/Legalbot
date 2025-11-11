import React, { useState, useRef } from 'react';
import api from '../services/api';
import './WordTemplateUpload.css';

interface DetectedVariable {
  marker: string; // El marcador original {{variable}}
  name: string; // Nombre del campo asignado por el usuario
  type: 'text' | 'number' | 'date' | 'email' | 'select';
  options?: string[];
  required: boolean;
  description?: string;
  needsFieldName?: boolean; // Indica si necesita nombre de campo
}

interface WordTemplateUploadProps {
  onTemplateCreated?: (templateId: string) => void;
}

const WordTemplateUpload: React.FC<WordTemplateUploadProps> = ({ onTemplateCreated }) => {
  const [file, setFile] = useState<File | null>(null);
  const [detectedVariables, setDetectedVariables] = useState<DetectedVariable[]>([]);
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [preview, setPreview] = useState<string>('');
  const [repeatModes, setRepeatModes] = useState<{[key: number]: boolean}>({});
  const [sourceNumbers, setSourceNumbers] = useState<{[key: number]: string}>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.toLowerCase().endsWith('.docx')) {
      alert('Por favor selecciona un archivo Word (.docx)');
      return;
    }

    setFile(selectedFile);
    const nameFromFile = selectedFile.name.replace('.docx', '');
    setTemplateName(nameFromFile);

    // Procesar el archivo para detectar variables
    await processWordFile(selectedFile, nameFromFile);
  };

  const processWordFile = async (file: File, name?: string) => {
    setIsProcessing(true);

    try {
      const formData = new FormData();
      formData.append('wordFile', file);
      formData.append('name', name || templateName);
      formData.append('description', templateDescription);
      
      console.log('🚀 Enviando archivo para detectar variables y crear plantilla...');
      console.log('📝 Datos enviados:');
      console.log('  - Name:', name || templateName);
      console.log('  - Description:', templateDescription);
      console.log('  - File:', file.name);
      
      const response = await api.post('/templates/detect-variables', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      console.log('✅ Respuesta recibida:', response.data);
      
      if (response.data.templateId) {
        console.log('🎉 PLANTILLA CREADA EXITOSAMENTE:');
        console.log('  - Template ID:', response.data.templateId);
        console.log('  - Template name:', response.data.template.name);
        console.log('  - Fields:', response.data.template.fields);
        console.log('  - Variables:', response.data.template.variables);
        
        // Mostrar mensaje de éxito
        alert(`✅ Plantilla creada exitosamente!\n\nNombre: ${response.data.template.name}\nVariables detectadas: ${response.data.template.fields}\nID: ${response.data.templateId}`);
        
        // Limpiar formulario
        setFile(null);
        setTemplateName('');
        setTemplateDescription('');
        setDetectedVariables([]);
        setPreview('');
        setRepeatModes({});
        setSourceNumbers({});
        
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        
        // Notificar al componente padre
        if (onTemplateCreated) {
          onTemplateCreated(response.data.templateId);
        }
      } else {
        console.log('⚠️ No se pudo crear la plantilla');
        alert('No se pudo crear la plantilla. Revisa los logs del servidor.');
      }
    } catch (error) {
      console.error('Error processing Word file:', error);
      alert('Error al procesar el archivo Word: ' + (error as any).response?.data?.error || 'Error desconocido');
    } finally {
      setIsProcessing(false);
    }
  };

  const updateVariable = (index: number, field: keyof DetectedVariable, value: any) => {
    const updatedVariables = [...detectedVariables];
    updatedVariables[index] = { ...updatedVariables[index], [field]: value };
    setDetectedVariables(updatedVariables);
  };

  const addVariable = () => {
    setDetectedVariables([...detectedVariables, {
      marker: '',
      name: '',
      type: 'text',
      required: true,
      description: '',
      needsFieldName: true
    }]);
  };

  const duplicateVariable = (index: number) => {
    const variableToDuplicate = detectedVariables[index];
    
    // Generar un nombre único para la variable duplicada
    const baseName = variableToDuplicate.name || variableToDuplicate.marker;
    let newName = `${baseName}_2`;
    let counter = 2;
    
    // Verificar que el nombre no exista ya
    while (detectedVariables.some(v => v.name === newName)) {
      counter++;
      newName = `${baseName}_${counter}`;
    }
    
    const duplicatedVariable = {
      ...variableToDuplicate,
      name: newName,
      description: `${variableToDuplicate.description || `Variable: ${variableToDuplicate.marker}`} (Copia ${counter})`,
      marker: variableToDuplicate.marker // Mantener el mismo marcador original
    };
    
    setDetectedVariables([...detectedVariables, duplicatedVariable]);
  };

  const removeVariable = (index: number) => {
    setDetectedVariables(detectedVariables.filter((_, i) => i !== index));
  };

  const duplicateMultipleVariables = (indices: number[]) => {
    const newVariables: DetectedVariable[] = [];
    
    indices.forEach(index => {
      const variableToDuplicate = detectedVariables[index];
      
      // Generar un nombre único para cada variable duplicada
      const baseName = variableToDuplicate.name || variableToDuplicate.marker;
      let newName = `${baseName}_2`;
      let counter = 2;
      
      // Verificar que el nombre no exista ya (incluyendo las nuevas variables)
      while (detectedVariables.some(v => v.name === newName) || newVariables.some(v => v.name === newName)) {
        counter++;
        newName = `${baseName}_${counter}`;
      }
      
      const duplicatedVariable: DetectedVariable = {
        ...variableToDuplicate,
        name: newName,
        description: `${variableToDuplicate.description || `Variable: ${variableToDuplicate.marker}`} (Copia ${counter})`,
        marker: variableToDuplicate.marker
      };
      
      newVariables.push(duplicatedVariable);
    });
    
    setDetectedVariables([...detectedVariables, ...newVariables]);
  };

  const toggleRepeatMode = (index: number) => {
    const newRepeatModes = { ...repeatModes };
    newRepeatModes[index] = !newRepeatModes[index];
    setRepeatModes(newRepeatModes);
    
    // Si se desactiva el modo replicación, limpiar el número fuente
    if (!newRepeatModes[index]) {
      const newSourceNumbers = { ...sourceNumbers };
      delete newSourceNumbers[index];
      setSourceNumbers(newSourceNumbers);
    }
  };

  const handleSourceNumberChange = (index: number, sourceNumber: string) => {
    const newSourceNumbers = { ...sourceNumbers };
    newSourceNumbers[index] = sourceNumber;
    setSourceNumbers(newSourceNumbers);
    
    // Aplicar la replicación inmediatamente si el número es válido
    const sourceIndex = parseInt(sourceNumber) - 1;
    if (sourceIndex >= 0 && sourceIndex < detectedVariables.length && sourceIndex !== index) {
      applyReplication(index, sourceIndex);
    }
  };

  const applyReplication = (targetIndex: number, sourceIndex: number) => {
    const sourceVariable = detectedVariables[sourceIndex];
    const updatedVariables = [...detectedVariables];
    
    updatedVariables[targetIndex] = {
      ...updatedVariables[targetIndex],
      name: sourceVariable.name,
      type: sourceVariable.type,
      options: sourceVariable.options,
      required: sourceVariable.required,
      description: sourceVariable.description,
      needsFieldName: false
    };
    
    setDetectedVariables(updatedVariables);
  };

  const handleSubmit = async () => {
    if (!file || !templateName.trim()) {
      alert('Por favor completa todos los campos requeridos');
      return;
    }

    // Asignar nombres automáticos a las variables que no los tengan
    const variablesWithNames = detectedVariables.map((variable, index) => ({
      ...variable,
      name: variable.name || `variable_${index + 1}`
    }));

    try {
      // Primero asignar nombres de campos
      await api.post('/templates/assign-field-names', {
        variables: variablesWithNames
      });

      // Luego crear la plantilla
      const formData = new FormData();
      formData.append('wordFile', file);
      formData.append('name', templateName);
      formData.append('description', templateDescription);
      formData.append('variables', JSON.stringify(variablesWithNames));

      const response = await api.post('/templates/upload-word', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      alert('Plantilla creada exitosamente con las variables configuradas');
      
      if (onTemplateCreated) {
        onTemplateCreated(response.data.templateId);
      }

      // Reset form
      setFile(null);
      setDetectedVariables([]);
      setTemplateName('');
      setTemplateDescription('');
      setPreview('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Error creating template:', error);
      alert('Error al crear la plantilla: ' + (error as any).response?.data?.error || 'Error desconocido');
    }
  };

  return (
    <div className="word-template-upload">
      <div className="upload-section">
        <h2>Subir Plantilla desde Word</h2>
        
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
            <p>Procesando archivo Word...</p>
          </div>
        )}
      </div>

      {file && (
        <div className="template-config">
          <h3>Configuración de la Plantilla</h3>
          
          <div className="form-group">
            <label>Nombre de la Plantilla:</label>
            <input
              type="text"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="Nombre de la plantilla"
              required
            />
          </div>

          <div className="form-group">
            <label>Descripción:</label>
            <textarea
              value={templateDescription}
              onChange={(e) => setTemplateDescription(e.target.value)}
              placeholder="Descripción de la plantilla"
              rows={3}
            />
          </div>

          {preview && (
            <div className="preview-section">
              <h4>Vista Previa del Documento:</h4>
              <div className="preview-content" dangerouslySetInnerHTML={{ __html: preview }} />
            </div>
          )}

          <div className="variables-section">
            <div className="variables-header">
              <h4>Variables Detectadas</h4>
              <div className="header-actions">
                <button type="button" onClick={addVariable} className="btn-add">
                  + Agregar Variable
                </button>
                <button 
                  type="button" 
                  onClick={() => duplicateMultipleVariables(detectedVariables.map((_, index) => index))} 
                  className="btn-duplicate-all"
                  title="Duplicar todas las variables"
                >
                  📋 Duplicar Todas
                </button>
              </div>
            </div>

            {detectedVariables.length === 0 ? (
              <p className="no-variables">No se detectaron variables en el documento</p>
            ) : (
              <div className="variables-list">
                {detectedVariables.map((variable, index) => (
                  <div key={index} className="variable-item">
                    <div className="variable-header">
                      <h5>Variable {index + 1}</h5>
                      <div className="variable-actions">
                        <button 
                          type="button" 
                          onClick={() => duplicateVariable(index)}
                          className="btn-duplicate"
                          title="Duplicar esta variable"
                        >
                          📋
                        </button>
                        <button 
                          type="button" 
                          onClick={() => removeVariable(index)}
                          className="btn-remove"
                          title="Eliminar esta variable"
                        >
                          ×
                        </button>
                      </div>
                    </div>

                    <div className="variable-fields">
                      <div className="field-group">
                        <label>Marcador Detectado:</label>
                        <input
                          type="text"
                          value={variable.marker}
                          disabled
                          className="marker-display"
                          placeholder="{{variable}}"
                        />
                        <small>Este es el marcador que se encontró en el documento</small>
                      </div>

                      <div className="field-group">
                        <label>Tipo:</label>
                        <select
                          value={variable.type}
                          onChange={(e) => updateVariable(index, 'type', e.target.value)}
                        >
                          <option value="text">Texto</option>
                          <option value="number">Número</option>
                          <option value="date">Fecha</option>
                          <option value="email">Email</option>
                          <option value="select">Lista desplegable</option>
                        </select>
                      </div>

                      {variable.type === 'select' && (
                        <div className="field-group">
                          <label>Opciones (separadas por comas):</label>
                          <input
                            type="text"
                            value={variable.options?.join(', ') || ''}
                            onChange={(e) => updateVariable(index, 'options', e.target.value.split(',').map(s => s.trim()))}
                            placeholder="Opción 1, Opción 2, Opción 3"
                          />
                        </div>
                      )}

                      <div className="field-group">
                        <label>Descripción:</label>
                        <input
                          type="text"
                          value={variable.description || ''}
                          onChange={(e) => updateVariable(index, 'description', e.target.value)}
                          placeholder="Descripción de la variable"
                        />
                      </div>

                      <div className="field-group checkbox-group">
                        <label className="checkbox-label">
                          <input
                            type="checkbox"
                            checked={variable.required}
                            onChange={(e) => updateVariable(index, 'required', e.target.checked)}
                          />
                          Campo requerido
                        </label>
                      </div>

                      <div className="field-group checkbox-group">
                        <label className="checkbox-label">
                          <input
                            type="checkbox"
                            checked={repeatModes[index] || false}
                            onChange={() => toggleRepeatMode(index)}
                          />
                          Replicar de otra variable
                        </label>
                      </div>

                      {repeatModes[index] && (
                        <div className="field-group">
                          <label>Número de variable a replicar:</label>
                          <input
                            type="number"
                            min="1"
                            max={detectedVariables.length}
                            value={sourceNumbers[index] || ''}
                            onChange={(e) => handleSourceNumberChange(index, e.target.value)}
                            placeholder="Ej: 1, 2, 3..."
                            className="source-number-input"
                          />
                          <small>
                            Ingresa el número de la variable de la cual quieres copiar la información
                          </small>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="submit-section">
            <button 
              onClick={handleSubmit}
              className="btn-submit"
              disabled={!templateName.trim()}
            >
              Crear Plantilla
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

export default WordTemplateUpload;
