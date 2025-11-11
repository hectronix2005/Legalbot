import React, { useState, useEffect } from 'react';
import api from '../services/api';
import './ThirdPartyFieldConfigModal.css';

interface SuggestedField {
  name: string;
  label: string;
  field_type: string;
  category: string;
  required: boolean;
  excluded: boolean;
  recommended?: 'required' | 'excluded' | null;
  original_marker: string;
  display_order: number;
  options?: string[];
}

interface ThirdPartyType {
  _id: string;
  code: string;
  label: string;
  icon: string;
}

interface ThirdPartyFieldConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  detectedVariables: Array<{
    marker: string;
    field_name: string;
    field_label: string;
    field_type: string;
  }>;
  thirdPartyTypeCode: string;
  onConfigApplied?: (typeId: string) => void;
}

const ThirdPartyFieldConfigModal: React.FC<ThirdPartyFieldConfigModalProps> = ({
  isOpen,
  onClose,
  detectedVariables,
  thirdPartyTypeCode,
  onConfigApplied
}) => {
  const [suggestedFields, setSuggestedFields] = useState<SuggestedField[]>([]);
  const [thirdPartyTypes, setThirdPartyTypes] = useState<ThirdPartyType[]>([]);
  const [selectedTypeId, setSelectedTypeId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [categories, setCategories] = useState<{ [key: string]: SuggestedField[] }>({});
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newTypeName, setNewTypeName] = useState('');
  const [newTypeCode, setNewTypeCode] = useState('');
  const [newTypeDescription, setNewTypeDescription] = useState('');
  const [newTypeIcon, setNewTypeIcon] = useState('📄');
  const [newTypeDefaultIdType, setNewTypeDefaultIdType] = useState('NIT');

  const categoryLabels: { [key: string]: string } = {
    identification: '🆔 Identificación',
    personal: '👤 Información Personal',
    business: '🏢 Información Empresarial',
    legal: '⚖️ Representación Legal',
    contact: '📞 Contacto',
    address: '📍 Dirección',
    employment: '💼 Información Laboral',
    financial: '💰 Información Financiera',
    dates: '📅 Fechas',
    other: '📋 Otros'
  };

  useEffect(() => {
    if (isOpen) {
      fetchThirdPartyTypes();
      analyzeSuggestedFields();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, detectedVariables, thirdPartyTypeCode]);

  const fetchThirdPartyTypes = async () => {
    try {
      const response = await api.get('/third-party-types');
      setThirdPartyTypes(response.data);

      // Buscar el tipo que coincide con el código
      const matchingType = response.data.find(
        (t: ThirdPartyType) => t.code === thirdPartyTypeCode
      );

      if (matchingType) {
        setSelectedTypeId(matchingType._id);
      }
    } catch (error) {
      console.error('Error al cargar tipos de terceros:', error);
    }
  };

  const analyzeSuggestedFields = async () => {
    if (!detectedVariables || detectedVariables.length === 0) return;

    setAnalyzing(true);
    try {
      // Transformar variables detectadas al formato esperado por el backend
      const fieldsToAnalyze = detectedVariables.map(v => ({
        field_name: v.field_name || v.marker,
        original_marker: v.marker
      }));

      console.log('🔍 Analizando variables:', fieldsToAnalyze);

      const response = await api.post('/third-party-types/suggest-from-template', {
        fields: fieldsToAnalyze,
        third_party_type: thirdPartyTypeCode
      });

      console.log('✅ Sugerencias recibidas:', response.data);

      setSuggestedFields(response.data.suggested);
      setCategories(response.data.categories || {});
    } catch (error) {
      console.error('Error al analizar variables:', error);
      alert('Error al analizar las variables de la plantilla');
    } finally {
      setAnalyzing(false);
    }
  };

  const toggleRequired = (index: number) => {
    const updated = [...suggestedFields];
    updated[index].required = !updated[index].required;
    setSuggestedFields(updated);
  };

  const toggleExcluded = (index: number) => {
    const updated = [...suggestedFields];
    updated[index].excluded = !updated[index].excluded;
    // Si se excluye, no puede ser requerido
    if (updated[index].excluded) {
      updated[index].required = false;
    }
    setSuggestedFields(updated);
  };

  const handleApplyConfiguration = async () => {
    setLoading(true);
    try {
      let typeId = selectedTypeId;

      // Si está creando un nuevo tipo, primero créalo
      if (isCreatingNew) {
        if (!newTypeName.trim() || !newTypeCode.trim()) {
          alert('Por favor ingresa el nombre y código del nuevo tipo de tercero');
          setLoading(false);
          return;
        }

        console.log('🆕 Creando nuevo tipo de tercero...');
        const createResponse = await api.post('/third-party-types', {
          code: newTypeCode.toLowerCase().trim(),
          label: newTypeName.trim(),
          description: newTypeDescription.trim() || `Tipo de tercero: ${newTypeName}`,
          icon: newTypeIcon || '📄',
          default_identification_types: [newTypeDefaultIdType],
          fields: []
        });

        typeId = createResponse.data.type._id;
        console.log('✅ Nuevo tipo creado:', typeId);
      }

      if (!typeId) {
        alert('Por favor selecciona o crea un tipo de tercero');
        setLoading(false);
        return;
      }

      // Aplicar configuración de campos
      const response = await api.put(
        `/third-party-types/${typeId}/apply-suggested-fields`,
        { fields: suggestedFields }
      );

      console.log('✅ Configuración aplicada:', response.data);

      alert(
        `Configuración ${isCreatingNew ? 'creada' : 'actualizada'} exitosamente!\n\n` +
        `Campos agregados: ${response.data.fieldsAdded}\n` +
        `Campos excluidos: ${response.data.fieldsExcluded}`
      );

      if (onConfigApplied) {
        onConfigApplied(typeId);
      }

      onClose();
    } catch (error: any) {
      console.error('Error al aplicar configuración:', error);
      alert('Error al aplicar la configuración: ' + (error.response?.data?.error || 'Error desconocido'));
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const includedCount = suggestedFields.filter(f => !f.excluded).length;
  const requiredCount = suggestedFields.filter(f => f.required && !f.excluded).length;
  const excludedCount = suggestedFields.filter(f => f.excluded).length;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content third-party-config-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>🔧 Configurar Tipo de Tercero</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        <div className="modal-body">
          {analyzing ? (
            <div className="analyzing-section">
              <div className="spinner"></div>
              <p>Analizando variables de la plantilla...</p>
            </div>
          ) : (
            <>
              <div className="config-header">
                <p className="config-description">
                  Se detectaron <strong>{detectedVariables.length} variables</strong> en tu plantilla.
                  Configura qué campos serán obligatorios o excluidos para el tipo de tercero seleccionado.
                </p>

                <div className="config-stats">
                  <div className="stat">
                    <span className="stat-label">Incluidos:</span>
                    <span className="stat-value">{includedCount}</span>
                  </div>
                  <div className="stat">
                    <span className="stat-label">Requeridos:</span>
                    <span className="stat-value required">{requiredCount}</span>
                  </div>
                  <div className="stat">
                    <span className="stat-label">Excluidos:</span>
                    <span className="stat-value excluded">{excludedCount}</span>
                  </div>
                </div>

                <div className="form-group">
                  <label>Tipo de Tercero:</label>

                  {/* Toggle para crear nuevo o usar existente */}
                  <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
                    <button
                      type="button"
                      onClick={() => setIsCreatingNew(false)}
                      style={{
                        flex: 1,
                        padding: '8px 12px',
                        backgroundColor: !isCreatingNew ? '#3b82f6' : '#e5e7eb',
                        color: !isCreatingNew ? 'white' : '#6b7280',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: '600',
                        transition: 'all 0.2s'
                      }}
                    >
                      Usar Existente
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsCreatingNew(true)}
                      style={{
                        flex: 1,
                        padding: '8px 12px',
                        backgroundColor: isCreatingNew ? '#10b981' : '#e5e7eb',
                        color: isCreatingNew ? 'white' : '#6b7280',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: '600',
                        transition: 'all 0.2s'
                      }}
                    >
                      + Crear Nuevo
                    </button>
                  </div>

                  {!isCreatingNew ? (
                    <select
                      value={selectedTypeId}
                      onChange={(e) => setSelectedTypeId(e.target.value)}
                      className="form-select"
                    >
                      <option value="">Selecciona un tipo...</option>
                      {thirdPartyTypes.map((type) => (
                        <option key={type._id} value={type._id}>
                          {type.icon} {type.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div>
                        <label style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px', display: 'block' }}>
                          Nombre del Tipo <span style={{ color: '#dc2626' }}>*</span>
                        </label>
                        <input
                          type="text"
                          value={newTypeName}
                          onChange={(e) => {
                            setNewTypeName(e.target.value);
                            // Auto-generar código desde el nombre
                            setNewTypeCode(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '_'));
                          }}
                          placeholder="Ej: Proveedor de Servicios"
                          className="form-select"
                          style={{ padding: '10px 12px' }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px', display: 'block' }}>
                          Código <span style={{ color: '#dc2626' }}>*</span>
                        </label>
                        <input
                          type="text"
                          value={newTypeCode}
                          onChange={(e) => setNewTypeCode(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                          placeholder="Ej: proveedor_servicios"
                          className="form-select"
                          style={{ padding: '10px 12px', fontFamily: 'monospace' }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px', display: 'block' }}>
                          Descripción
                        </label>
                        <input
                          type="text"
                          value={newTypeDescription}
                          onChange={(e) => setNewTypeDescription(e.target.value)}
                          placeholder="Descripción del tipo de tercero"
                          className="form-select"
                          style={{ padding: '10px 12px' }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px', display: 'block' }}>
                          Icono (Emoji)
                        </label>
                        <input
                          type="text"
                          value={newTypeIcon}
                          onChange={(e) => setNewTypeIcon(e.target.value)}
                          placeholder="📄"
                          className="form-select"
                          style={{ padding: '10px 12px', fontSize: '20px' }}
                          maxLength={2}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px', display: 'block' }}>
                          Tipo de Identificación por Defecto <span style={{ color: '#dc2626' }}>*</span>
                        </label>
                        <select
                          value={newTypeDefaultIdType}
                          onChange={(e) => setNewTypeDefaultIdType(e.target.value)}
                          className="form-select"
                          style={{ padding: '10px 12px' }}
                        >
                          <option value="NIT">NIT (Empresa)</option>
                          <option value="NIT (PH)">NIT (Propiedad Horizontal)</option>
                          <option value="CC">Cédula de Ciudadanía</option>
                          <option value="CE">Cédula de Extranjería</option>
                          <option value="Pasaporte">Pasaporte</option>
                          <option value="RUT">RUT</option>
                          <option value="Otro">Otro</option>
                        </select>
                        <p style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>
                          Este tipo de identificación se usará por defecto al crear terceros de este tipo
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="fields-by-category">
                {Object.entries(categories).map(([category, fields]) => (
                  <div key={category} className="category-section">
                    <h3 className="category-title">
                      {categoryLabels[category] || category}
                    </h3>
                    <div className="fields-list">
                      {fields.map((field, index) => {
                        const globalIndex = suggestedFields.findIndex(f => f.name === field.name);
                        const currentField = suggestedFields[globalIndex];

                        return (
                          <div
                            key={field.name}
                            className={`field-item ${currentField.excluded ? 'excluded' : ''} ${currentField.recommended === 'required' ? 'recommended-required' : ''} ${currentField.recommended === 'excluded' ? 'recommended-excluded' : ''}`}
                          >
                            <div className="field-info">
                              <div className="field-header">
                                <span className="field-label">{field.label}</span>
                                <span className="field-type-badge">{field.field_type}</span>
                              </div>
                              <div className="field-details">
                                <span className="field-marker">{'{{' + field.original_marker + '}}'}</span>
                                {currentField.recommended && (
                                  <span className={`recommendation-badge ${currentField.recommended}`}>
                                    {currentField.recommended === 'required' ? '⭐ Recomendado como obligatorio' : '🚫 Recomendado excluir'}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="field-actions">
                              <label className="checkbox-label">
                                <input
                                  type="checkbox"
                                  checked={currentField.required}
                                  onChange={() => toggleRequired(globalIndex)}
                                  disabled={currentField.excluded}
                                />
                                <span>Requerido</span>
                              </label>
                              <label className="checkbox-label">
                                <input
                                  type="checkbox"
                                  checked={currentField.excluded}
                                  onChange={() => toggleExcluded(globalIndex)}
                                />
                                <span>Excluir</span>
                              </label>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn-cancel" onClick={onClose} disabled={loading}>
            Cancelar
          </button>
          <button
            className="btn-apply"
            onClick={handleApplyConfiguration}
            disabled={loading || analyzing || (!isCreatingNew && !selectedTypeId)}
          >
            {loading ? (isCreatingNew ? 'Creando...' : 'Aplicando...') : 'Aplicar Configuración'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ThirdPartyFieldConfigModal;
