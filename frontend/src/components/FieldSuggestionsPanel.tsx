/**
 * Panel de Sugerencias de Campos para Terceros
 * Versión ROBUSTA sin dependencias externas - Solo React y CSS nativo
 */

import React, { useState, useEffect } from 'react';
import api from '../services/api';
import './FieldSuggestionsPanel.css';

interface FieldSuggestion {
  name: string;
  label: string;
  type: string;
  required: boolean;
  usedInTemplates: string[];
  templateIds: string[];
}

interface FieldDetail {
  name: string;
  value: any;
  source: 'standard' | 'custom';
  originalField?: string;
  originalKey?: string;
}

interface FieldAnalysis {
  hasType: boolean;
  typeCode: string;
  currentFields: string[];
  currentFieldsDetail: FieldDetail[];
  missingFields: FieldSuggestion[];
  matchedFields: any[];
  totalRequired: number;
  totalMatched: number;
  totalMissing: number;
  completionPercentage: number;
}

interface Props {
  supplierId: string;
  onFieldsAdded?: () => void;
}

const FieldSuggestionsPanel: React.FC<Props> = ({ supplierId, onFieldsAdded }) => {
  const [analysis, setAnalysis] = useState<FieldAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addingField, setAddingField] = useState(false);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [showDialog, setShowDialog] = useState(false);
  const [currentField, setCurrentField] = useState<FieldSuggestion | null>(null);
  const [showCurrentFields, setShowCurrentFields] = useState(false);

  useEffect(() => {
    if (supplierId) {
      fetchAnalysis();
    }
  }, [supplierId]);

  const fetchAnalysis = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('🔍 Fetching analysis for supplier:', supplierId);

      const response = await api.get(
        `/field-management/supplier/${supplierId}/analysis`
      );

      console.log('✅ Analysis response:', response.data);
      setAnalysis(response.data.analysis);
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || err.message || 'Error al obtener análisis de campos';
      console.error('❌ Error fetching analysis:', err);
      console.error('Error details:', err.response?.data);
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleAddField = (field: FieldSuggestion) => {
    setCurrentField(field);
    setFieldValues({ ...fieldValues, [field.name]: '' });
    setShowDialog(true);
  };

  const handleSaveField = async () => {
    if (!currentField || !fieldValues[currentField.name]) {
      alert('Por favor ingresa un valor para el campo');
      return;
    }

    try {
      setAddingField(true);

      console.log('💾 Saving field:', currentField.name, '=', fieldValues[currentField.name]);

      // VERIFICAR TOKEN ANTES DE HACER LA REQUEST
      const token = localStorage.getItem('token');
      if (!token) {
        console.error('❌ No hay token en localStorage - Usuario no autenticado');
        alert('Sesión expirada. Por favor inicia sesión nuevamente.');
        window.location.href = '/login';
        return;
      }

      console.log('✅ Token encontrado:', token.substring(0, 20) + '...');

      await api.post(
        `/field-management/supplier/${supplierId}/fields`,
        {
          fields: [
            {
              name: currentField.name,
              value: fieldValues[currentField.name],
              label: currentField.label,
            },
          ],
        }
      );

      console.log('✅ Field saved successfully');

      // Limpiar y cerrar
      const newValues = { ...fieldValues };
      delete newValues[currentField.name];
      setFieldValues(newValues);
      setShowDialog(false);
      setCurrentField(null);

      // Recargar análisis
      await fetchAnalysis();
      if (onFieldsAdded) onFieldsAdded();

      alert('Campo agregado exitosamente');
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || err.message || 'Error al agregar campo';

      // ============================================
      // DEBUGGING DETALLADO DE ERRORES
      // ============================================
      console.group('❌ ERROR AL GUARDAR CAMPO - DEBUG COMPLETO');

      console.error('📋 Datos del Campo:');
      console.error('  Nombre:', currentField.name);
      console.error('  Valor:', fieldValues[currentField.name]);
      console.error('  Label:', currentField.label);
      console.error('  Supplier ID:', supplierId);

      console.error('\n📡 Respuesta del Servidor:');
      console.error('  Status:', err.response?.status);
      console.error('  Status Text:', err.response?.statusText);
      console.error('  Error Message:', errorMsg);

      if (err.response?.data) {
        console.error('\n📦 Data Completa del Error:');
        console.error('  Error Type:', err.response.data.errorType);
        console.error('  Error:', err.response.data.error);
        console.error('  Validation Errors:', err.response.data.validationErrors);

        if (err.response.data.details) {
          console.error('\n🔍 Stack Trace del Servidor:');
          console.error(err.response.data.details);
        }

        console.error('\n📄 JSON Completo:');
        console.error(JSON.stringify(err.response.data, null, 2));
      }

      console.error('\n🌐 Detalles de la Request:');
      console.error('  URL:', err.config?.url);
      console.error('  Method:', err.config?.method);
      console.error('  Headers:', err.config?.headers);
      console.error('  Data enviada:', err.config?.data);

      console.error('\n💬 Error del Cliente:');
      console.error('  Message:', err.message);
      console.error('  Name:', err.name);
      console.error('  Code:', err.code);

      if (err.stack) {
        console.error('\n📚 Stack Trace del Cliente:');
        console.error(err.stack);
      }

      console.error('\n🔧 Error Object Completo:');
      console.error(err);

      console.groupEnd();
      // ============================================

      // Construir mensaje detallado para el usuario
      let userMessage = `❌ Error al guardar campo "${currentField.label}"\n\n`;
      userMessage += `Mensaje: ${errorMsg}\n`;

      if (err.response?.status) {
        userMessage += `HTTP Status: ${err.response.status}\n`;
      }

      if (err.response?.data?.errorType) {
        userMessage += `Tipo: ${err.response.data.errorType}\n`;
      }

      if (err.response?.data?.validationErrors) {
        userMessage += `\nErrores de validación:\n`;
        err.response.data.validationErrors.forEach((field: string) => {
          userMessage += `  - ${field}\n`;
        });
      }

      userMessage += '\n💡 Revisa la consola del navegador (F12) para más detalles técnicos.';

      alert(userMessage);
    } finally {
      setAddingField(false);
    }
  };

  const getCompletionColor = (percentage: number): string => {
    if (percentage >= 80) return 'success';
    if (percentage >= 50) return 'warning';
    return 'error';
  };

  const getCompletionMessage = (percentage: number): string => {
    if (percentage >= 80) return 'Buen estado';
    if (percentage >= 50) return 'Completar campos faltantes';
    return 'Requiere atención';
  };

  if (loading) {
    return (
      <div className="field-suggestions-panel">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Cargando análisis de campos...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="field-suggestions-panel">
        <div className="alert alert-error">
          <strong>Error:</strong> {error}
          <button className="btn-link" onClick={fetchAnalysis}>Reintentar</button>
        </div>
      </div>
    );
  }

  if (!analysis || !analysis.hasType) {
    return (
      <div className="field-suggestions-panel">
        <div className="alert alert-info">
          <strong>Sin tipo de tercero:</strong> Asigna un tipo a este tercero para ver sugerencias de campos.
        </div>
      </div>
    );
  }

  return (
    <div className="field-suggestions-panel">
      {/* Tarjeta de Completitud */}
      <div className="completion-card">
        <div className="completion-header">
          <h5>Completitud de Datos</h5>
          <button className="btn-refresh" onClick={fetchAnalysis} title="Recargar análisis">
            ↻
          </button>
        </div>

        <div className="completion-percentage">
          <div className={`percentage-value percentage-${getCompletionColor(analysis.completionPercentage)}`}>
            {analysis.completionPercentage}%
          </div>
          <div className={`completion-badge badge-${getCompletionColor(analysis.completionPercentage)}`}>
            {getCompletionMessage(analysis.completionPercentage)}
            {analysis.totalMissing > 0 && ` (${analysis.totalMissing} faltantes)`}
          </div>
        </div>

        <div className="progress-bar">
          <div
            className={`progress-fill progress-${getCompletionColor(analysis.completionPercentage)}`}
            style={{ width: `${analysis.completionPercentage}%` }}
          ></div>
        </div>

        <div className="stats-grid">
          <div className="stat-item">
            <div className="stat-value stat-primary">{analysis.totalRequired}</div>
            <div className="stat-label">Campos requeridos</div>
          </div>
          <div className="stat-item">
            <div className="stat-value stat-success">{analysis.totalMatched}</div>
            <div className="stat-label">Completos</div>
          </div>
          <div className="stat-item">
            <div className="stat-value stat-error">{analysis.totalMissing}</div>
            <div className="stat-label">Faltantes</div>
          </div>
        </div>
      </div>

      {/* Campos Faltantes */}
      {analysis.missingFields && analysis.missingFields.length > 0 && (
        <div className="missing-fields-card">
          <h5>Campos Faltantes ({analysis.missingFields.length})</h5>

          <div className="alert alert-warning">
            <strong>⚠️ Completa estos campos para generar contratos</strong>
            <p style={{ marginTop: '0.5rem', marginBottom: 0 }}>
              Los campos marcados como requeridos son necesarios para usar las plantillas asociadas.
            </p>
          </div>

          <div className="fields-list">
            {analysis.missingFields.map((field, index) => (
              <div key={field.name} className="field-item">
                <div className="field-info">
                  <div className="field-header">
                    <span className={`field-icon ${field.required ? 'required' : 'optional'}`}>
                      {field.required ? '⚠️' : 'ℹ️'}
                    </span>
                    <strong className="field-label">{field.label}</strong>
                    {field.required && (
                      <span className="badge badge-error">Requerido</span>
                    )}
                  </div>

                  <div className="field-details">
                    <small>Campo: <code>{field.name}</code> | Tipo: {field.type}</small>
                  </div>

                  <div className="field-templates">
                    <small>Usado en {field.usedInTemplates.length} plantilla(s):</small>
                    <div className="templates-chips">
                      {field.usedInTemplates.slice(0, 3).map((template, idx) => (
                        <span key={idx} className="template-chip">📄 {template}</span>
                      ))}
                      {field.usedInTemplates.length > 3 && (
                        <span className="template-chip">+{field.usedInTemplates.length - 3} más</span>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  className="btn-add"
                  onClick={() => handleAddField(field)}
                >
                  + Agregar
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Campos Actuales (Colapsable) */}
      {analysis.currentFieldsDetail && analysis.currentFieldsDetail.length > 0 && (
        <div className="current-fields-card">
          <div
            className="collapsible-header"
            onClick={() => setShowCurrentFields(!showCurrentFields)}
          >
            <h5>Campos Actuales ({analysis.currentFieldsDetail.length})</h5>
            <span className="collapse-icon">{showCurrentFields ? '▼' : '▶'}</span>
          </div>

          {showCurrentFields && (
            <div className="fields-list">
              {analysis.currentFieldsDetail.map((field, index) => (
                <div key={index} className="field-item current-field">
                  <span className="field-icon success">✓</span>
                  <div className="field-info">
                    <strong>{field.name}</strong>
                    <div className="field-details">
                      <small><strong>Valor:</strong> {field.value}</small>
                      <br />
                      <small>
                        Fuente: {field.source === 'standard' ? 'Campo estándar' : 'Campo personalizado'}
                        {field.originalField && ` (${field.originalField})`}
                      </small>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Mensaje de Éxito */}
      {analysis.completionPercentage === 100 && (
        <div className="alert alert-success">
          <strong>✅ Tercero Completo</strong>
          <p style={{ marginTop: '0.5rem', marginBottom: 0 }}>
            Este tercero tiene todos los campos necesarios para generar contratos con las plantillas disponibles.
          </p>
        </div>
      )}

      {/* Dialog para agregar campo */}
      {showDialog && currentField && (
        <div className="dialog-overlay" onClick={() => setShowDialog(false)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-header">
              <h4>Agregar Campo: {currentField.label}</h4>
              <button className="dialog-close" onClick={() => setShowDialog(false)}>×</button>
            </div>

            <div className="dialog-content">
              <div className="alert alert-info">
                <strong>Usado en plantillas:</strong>
                <ul style={{ marginTop: '0.5rem', paddingLeft: '1.5rem' }}>
                  {currentField.usedInTemplates.map((template, idx) => (
                    <li key={idx}><small>{template}</small></li>
                  ))}
                </ul>
              </div>

              <div className="form-group">
                <label>{currentField.label} {currentField.required && <span className="required-mark">*</span>}</label>
                <input
                  type={currentField.type === 'email' ? 'email' : currentField.type === 'number' ? 'number' : 'text'}
                  value={fieldValues[currentField.name] || ''}
                  onChange={(e) =>
                    setFieldValues({
                      ...fieldValues,
                      [currentField.name]: e.target.value,
                    })
                  }
                  required={currentField.required}
                  placeholder={`Ingrese ${currentField.label.toLowerCase()}`}
                  autoFocus
                />
                <small>Campo: {currentField.name}</small>
              </div>
            </div>

            <div className="dialog-actions">
              <button
                className="btn-secondary"
                onClick={() => setShowDialog(false)}
                disabled={addingField}
              >
                Cancelar
              </button>
              <button
                className="btn-primary"
                onClick={handleSaveField}
                disabled={addingField || !fieldValues[currentField.name]}
              >
                {addingField ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FieldSuggestionsPanel;
