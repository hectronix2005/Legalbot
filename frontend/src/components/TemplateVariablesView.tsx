import React, { useState, useEffect } from 'react';
import api from '../services/api';
import './TemplateVariablesView.css';

interface Variable {
  number: number;
  original_marker: string;
  field_name: string;
  field_label: string;
  field_type: string;
  description: string;
  required: boolean;
  can_repeat: boolean;
  repeat_source: number | null;
  repeat_count: number;
  display_order: number;
}

interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  content: string;
  created_by: {
    name: string;
    email: string;
  };
  company: {
    name: string;
    tax_id: string;
  } | null;
  created_at: string;
  updated_at: string;
}

interface TemplateVariablesViewProps {
  templateId: string;
  onClose: () => void;
}

const TemplateVariablesView: React.FC<TemplateVariablesViewProps> = ({ templateId, onClose }) => {
  const [template, setTemplate] = useState<Template | null>(null);
  const [variables, setVariables] = useState<Variable[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editedVariables, setEditedVariables] = useState<Variable[]>([]);

  useEffect(() => {
    fetchTemplateDetails();
  }, [templateId]);

  const fetchTemplateDetails = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/templates/template-details/${templateId}`);
      setTemplate(response.data.template);
      setVariables(response.data.variables);
      setEditedVariables(response.data.variables);
    } catch (error) {
      console.error('Error fetching template details:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleVariableChange = (index: number, field: keyof Variable, value: any) => {
    const updatedVariables = [...editedVariables];
    updatedVariables[index] = { ...updatedVariables[index], [field]: value };
    setEditedVariables(updatedVariables);
  };

  const handleRepeatToggle = (index: number) => {
    const updatedVariables = [...editedVariables];
    updatedVariables[index] = { 
      ...updatedVariables[index], 
      can_repeat: !updatedVariables[index].can_repeat,
      repeat_source: !updatedVariables[index].can_repeat ? null : updatedVariables[index].repeat_source
    };
    setEditedVariables(updatedVariables);
  };

  const handleRepeatSourceChange = (index: number, sourceNumber: string) => {
    const sourceIndex = parseInt(sourceNumber) - 1;
    const updatedVariables = [...editedVariables];
    
    if (sourceNumber && sourceIndex >= 0 && sourceIndex < editedVariables.length && sourceIndex !== index) {
      // Copiar datos de la variable origen
      const sourceVariable = editedVariables[sourceIndex];
      updatedVariables[index] = {
        ...updatedVariables[index],
        field_name: sourceVariable.field_name,
        field_label: sourceVariable.field_label,
        field_type: sourceVariable.field_type,
        description: sourceVariable.description,
        repeat_source: sourceIndex + 1
      };
    } else if (sourceNumber === '') {
      // Limpiar la selección
      updatedVariables[index] = {
        ...updatedVariables[index],
        repeat_source: null
      };
    } else {
      // Solo actualizar el repeat_source sin copiar datos
      updatedVariables[index] = {
        ...updatedVariables[index],
        repeat_source: sourceNumber ? parseInt(sourceNumber) : null
      };
    }
    
    setEditedVariables(updatedVariables);
  };

  const handleSave = async () => {
    try {
      await api.put(`/templates/template-variables/${templateId}`, {
        variables: editedVariables
      });
      
      setVariables(editedVariables);
      setEditing(false);
      alert('Variables actualizadas correctamente');
    } catch (error) {
      console.error('Error updating variables:', error);
      alert('Error al actualizar las variables');
    }
  };

  const handleCancel = () => {
    setEditedVariables(variables);
    setEditing(false);
  };

  if (loading) {
    return (
      <div className="template-variables-overlay">
        <div className="template-variables-modal">
          <div className="loading">Cargando detalles de la plantilla...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="template-variables-overlay">
      <div className="template-variables-modal">
        <div className="modal-header">
          <h2>Variables de la Plantilla: {template?.name}</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        <div className="template-info">
          <div className="info-section">
            <h3>Información de la Plantilla</h3>
            <p><strong>Categoría:</strong> {template?.category}</p>
            <p><strong>Descripción:</strong> {template?.description || 'Sin descripción'}</p>
            <p><strong>Creado por:</strong> {template?.created_by?.name}</p>
            <p><strong>Empresa:</strong> {template?.company?.name || 'Sin empresa'}</p>
            <p><strong>Total de variables:</strong> {variables.length}</p>
          </div>
        </div>

        <div className="variables-section">
          <div className="section-header">
            <h3>Variables Detectadas</h3>
            <div className="section-actions">
              {!editing ? (
                <button className="btn-edit" onClick={() => setEditing(true)}>
                  Editar Variables
                </button>
              ) : (
                <div className="edit-actions">
                  <button className="btn-save" onClick={handleSave}>
                    Guardar Cambios
                  </button>
                  <button className="btn-cancel" onClick={handleCancel}>
                    Cancelar
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="variables-list">
            {(editing ? editedVariables : variables).map((variable, index) => (
              <div key={index} className="variable-card">
                <div className="variable-header">
                  <span className="variable-number">#{variable.number}</span>
                  <span className="variable-marker">{variable.original_marker}</span>
                  {variable.repeat_count > 1 && (
                    <span className="repeat-count">(aparece {variable.repeat_count} veces)</span>
                  )}
                  {editedVariables.some((v, i) => i !== index && v.repeat_source === variable.number) && (
                    <span className="source-indicator">📋 Variable origen</span>
                  )}
                </div>

                <div className="variable-details">
                  <div className="detail-row">
                    <label>Información de Campo:</label>
                    {editing ? (
                      <input
                        type="text"
                        value={variable.field_name}
                        onChange={(e) => handleVariableChange(index, 'field_name', e.target.value)}
                        className="field-input"
                      />
                    ) : (
                      <span className="field-value">{variable.field_name}</span>
                    )}
                  </div>

                  <div className="detail-row">
                    <label>Nombre de Variable:</label>
                    {editing ? (
                      <input
                        type="text"
                        value={variable.field_label}
                        onChange={(e) => handleVariableChange(index, 'field_label', e.target.value)}
                        className="field-input"
                      />
                    ) : (
                      <span className="field-value">{variable.field_label}</span>
                    )}
                  </div>

                  <div className="detail-row">
                    <label>Tipo:</label>
                    {editing ? (
                      <select
                        value={variable.field_type}
                        onChange={(e) => handleVariableChange(index, 'field_type', e.target.value)}
                        className="field-select"
                      >
                        <option value="text">Texto</option>
                        <option value="number">Número</option>
                        <option value="date">Fecha</option>
                        <option value="email">Email</option>
                        <option value="textarea">Área de texto</option>
                        <option value="select">Selección</option>
                      </select>
                    ) : (
                      <span className="field-value">{variable.field_type}</span>
                    )}
                  </div>

                  <div className="detail-row">
                    <label>Descripción:</label>
                    {editing ? (
                      <textarea
                        value={variable.description}
                        onChange={(e) => handleVariableChange(index, 'description', e.target.value)}
                        className="field-textarea"
                        rows={2}
                      />
                    ) : (
                      <span className="field-value">{variable.description}</span>
                    )}
                  </div>

                  <div className="detail-row">
                    <label>Requerido:</label>
                    {editing ? (
                      <input
                        type="checkbox"
                        checked={variable.required}
                        onChange={(e) => handleVariableChange(index, 'required', e.target.checked)}
                        className="field-checkbox"
                      />
                    ) : (
                      <span className="field-value">{variable.required ? 'Sí' : 'No'}</span>
                    )}
                  </div>

                  {editing && (
                    <div className="repeat-section">
                      <div className="detail-row">
                        <label>
                          <input
                            type="checkbox"
                            checked={variable.can_repeat}
                            onChange={() => handleRepeatToggle(index)}
                            className="field-checkbox"
                          />
                          Puede repetir información
                        </label>
                      </div>

                      {variable.can_repeat && (
                        <div className="detail-row">
                          <label>Repetir información de la variable:</label>
                          <select
                            value={variable.repeat_source || ''}
                            onChange={(e) => handleRepeatSourceChange(index, e.target.value)}
                            className="field-select"
                          >
                            <option value="">Seleccionar variable origen...</option>
                            {editedVariables.map((otherVariable, otherIndex) => (
                              otherIndex !== index && (
                                <option key={otherIndex} value={otherIndex + 1}>
                                  #{otherIndex + 1} - {otherVariable.field_label} ({'{'}{'{'}{otherVariable.original_marker}{'}'}{'}'})
                                </option>
                              )
                            ))}
                          </select>
                          {variable.repeat_source && (
                            <div className="repeat-info">
                              <small>
                                Esta variable copiará la información de: <strong>#{variable.repeat_source} - {editedVariables[variable.repeat_source - 1]?.field_label}</strong>
                              </small>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TemplateVariablesView;
