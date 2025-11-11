import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import './ThirdPartyTypeManagement.css';

interface FieldConfig {
  name: string;
  label: string;
  field_type: string;
  options?: string[];
  required: boolean;
  display_order: number;
  placeholder?: string;
}

interface ThirdPartyType {
  _id: string;
  code: string;
  label: string;
  description: string;
  icon: string;
  fields: FieldConfig[];
  default_identification_types?: string[];
  is_system: boolean;
  active: boolean;
  isGeneric: boolean;
  companies?: {
    _id: string;
    name: string;
  }[];
  company?: {
    _id: string;
    name: string;
  };
  created_by?: {
    name: string;
    email: string;
  };
  createdAt: string;
}

interface Company {
  _id: string;
  name: string;
  tax_id: string;
}

interface FieldTypeOption {
  value: string;
  label: string;
}

const ThirdPartyTypeManagement: React.FC = () => {
  const { user } = useAuth();
  const [types, setTypes] = useState<ThirdPartyType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingType, setEditingType] = useState<ThirdPartyType | null>(null);
  const [fieldTypes, setFieldTypes] = useState<FieldTypeOption[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);

  const [formData, setFormData] = useState({
    code: '',
    label: '',
    description: '',
    icon: '📄',
    fields: [] as FieldConfig[],
    default_identification_types: [] as string[],
    isGeneric: false,
    companies: [] as string[]
  });

  const [newField, setNewField] = useState<FieldConfig>({
    name: '',
    label: '',
    field_type: 'text',
    options: [],
    required: false,
    display_order: 0,
    placeholder: ''
  });

  // Estado para editar un campo existente
  const [editingFieldIndex, setEditingFieldIndex] = useState<number | null>(null);
  const [editingFieldData, setEditingFieldData] = useState<FieldConfig | null>(null);

  // Estados para gestión de tipos de identificación
  const [newIdType, setNewIdType] = useState('');
  const commonIdTypes = [
    'NIT',
    'CC',
    'CE',
    'TI',
    'Pasaporte',
    'PEP',
    'RUT',
    'DNI',
    'RUC',
    'CURP'
  ];

  useEffect(() => {
    fetchTypes();
    fetchFieldOptions();
    if (user?.role === 'super_admin' || user?.role === 'admin') {
      fetchCompanies();
    }
  }, [user]);

  const fetchTypes = async () => {
    try {
      const response = await api.get('/third-party-types');
      setTypes(response.data);
    } catch (error) {
      console.error('Error fetching third party types:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchFieldOptions = async () => {
    try {
      const response = await api.get('/third-party-types/config/field-options');
      setFieldTypes(response.data.field_types);
    } catch (error) {
      console.error('Error fetching field options:', error);
    }
  };

  const fetchCompanies = async () => {
    try {
      const response = await api.get('/third-party-types/config/companies');
      setCompanies(response.data);
    } catch (error) {
      console.error('Error fetching companies:', error);
    }
  };

  const handleCreate = () => {
    setEditingType(null);
    setFormData({
      code: '',
      label: '',
      description: '',
      icon: '📄',
      fields: [],
      default_identification_types: [],
      isGeneric: false,
      companies: []
    });
    setShowModal(true);
  };

  const handleEdit = (type: ThirdPartyType) => {
    setEditingType(type);
    setFormData({
      code: type.code,
      label: type.label,
      description: type.description,
      icon: type.icon,
      fields: type.fields,
      default_identification_types: type.default_identification_types || [],
      isGeneric: type.isGeneric || false,
      companies: type.companies ? type.companies.map(c => c._id) : []
    });
    setShowModal(true);
  };

  const toggleIdentificationType = (type: string) => {
    const types = formData.default_identification_types || [];
    if (types.includes(type)) {
      setFormData({
        ...formData,
        default_identification_types: types.filter(t => t !== type)
      });
    } else {
      setFormData({
        ...formData,
        default_identification_types: [...types, type]
      });
    }
  };

  const addCustomIdentificationType = () => {
    if (newIdType.trim()) {
      const type = newIdType.trim().toUpperCase();
      const types = formData.default_identification_types || [];
      if (!types.includes(type)) {
        setFormData({
          ...formData,
          default_identification_types: [...types, type]
        });
      }
      setNewIdType('');
    }
  };

  const removeIdentificationType = (type: string) => {
    setFormData({
      ...formData,
      default_identification_types: (formData.default_identification_types || []).filter(t => t !== type)
    });
  };

  const toggleCompany = (companyId: string) => {
    const currentCompanies = formData.companies || [];
    if (currentCompanies.includes(companyId)) {
      setFormData({
        ...formData,
        companies: currentCompanies.filter(id => id !== companyId)
      });
    } else {
      setFormData({
        ...formData,
        companies: [...currentCompanies, companyId]
      });
    }
  };

  const handleGenericToggle = (isGeneric: boolean) => {
    setFormData({
      ...formData,
      isGeneric,
      companies: isGeneric ? [] : formData.companies
    });
  };

  const handleSave = async () => {
    try {
      // Validar que si no es genérico, se seleccione al menos una empresa
      if (!formData.isGeneric && formData.companies.length === 0 && (user?.role === 'super_admin' || user?.role === 'admin')) {
        alert('Debes seleccionar al menos una empresa o marcar el tipo como genérico');
        return;
      }

      if (editingType) {
        await api.put(`/third-party-types/${editingType._id}`, formData);
        alert('Tipo de tercero actualizado exitosamente');
      } else {
        await api.post('/third-party-types', formData);
        alert('Tipo de tercero creado exitosamente');
      }
      await fetchTypes();
      setShowModal(false);
    } catch (error: any) {
      console.error('Error saving third party type:', error);
      alert(error.response?.data?.error || 'Error al guardar tipo de tercero');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('¿Estás seguro de eliminar este tipo de tercero?')) return;

    try {
      await api.delete(`/third-party-types/${id}`);
      alert('Tipo de tercero eliminado exitosamente');
      await fetchTypes();
    } catch (error: any) {
      console.error('Error deleting third party type:', error);
      alert(error.response?.data?.error || 'Error al eliminar tipo de tercero');
    }
  };

  const handleAddField = () => {
    if (!newField.name || !newField.label) {
      alert('El nombre y etiqueta del campo son requeridos');
      return;
    }

    setFormData({
      ...formData,
      fields: [...formData.fields, { ...newField, display_order: formData.fields.length }]
    });

    setNewField({
      name: '',
      label: '',
      field_type: 'text',
      options: [],
      required: false,
      display_order: 0,
      placeholder: ''
    });
  };

  const handleRemoveField = (index: number) => {
    const updatedFields = formData.fields.filter((_, i) => i !== index);
    setFormData({ ...formData, fields: updatedFields });
  };

  const handleMoveField = (index: number, direction: 'up' | 'down') => {
    const newFields = [...formData.fields];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;

    if (targetIndex < 0 || targetIndex >= newFields.length) return;

    [newFields[index], newFields[targetIndex]] = [newFields[targetIndex], newFields[index]];
    newFields.forEach((field, i) => field.display_order = i);

    setFormData({ ...formData, fields: newFields });
  };

  const handleStartEditField = (index: number) => {
    setEditingFieldIndex(index);
    setEditingFieldData({ ...formData.fields[index] });
  };

  const handleCancelEditField = () => {
    setEditingFieldIndex(null);
    setEditingFieldData(null);
  };

  const handleSaveEditField = () => {
    if (editingFieldIndex === null || !editingFieldData) return;

    if (!editingFieldData.name || !editingFieldData.label) {
      alert('El nombre y etiqueta del campo son requeridos');
      return;
    }

    const newFields = [...formData.fields];
    newFields[editingFieldIndex] = editingFieldData;
    setFormData({ ...formData, fields: newFields });
    setEditingFieldIndex(null);
    setEditingFieldData(null);
  };

  if (loading) {
    return <div className="loading">Cargando tipos de terceros...</div>;
  }

  return (
    <div className="third-party-type-management">
      <div className="header">
        <h1>Gestión de Tipos de Terceros</h1>
        <p>Configura qué información se solicita para cada tipo de tercero</p>
        <button onClick={handleCreate} className="btn-create">
          ➕ Crear Nuevo Tipo
        </button>
      </div>

      <div className="types-grid">
        {types.map((type) => (
          <div key={type._id} className="type-card">
            <div className="type-header">
              <div className="type-title">
                <span className="type-icon">{type.icon}</span>
                <div>
                  <h3>{type.label}</h3>
                  <span className="type-code">{type.code}</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {type.is_system && <span className="system-badge">Sistema</span>}
                {type.isGeneric && (
                  <span className="system-badge" style={{ backgroundColor: '#10b981' }}>
                    Genérico
                  </span>
                )}
              </div>
            </div>

            <p className="type-description">{type.description}</p>

            <div className="type-stats">
              <span>{type.fields.length} campos configurados</span>
              {!type.isGeneric && type.companies && type.companies.length > 0 && (
                <span style={{ color: '#3b82f6', fontSize: '0.85rem' }}>
                  {type.companies.length} empresa{type.companies.length > 1 ? 's' : ''}
                </span>
              )}
            </div>

            {!type.isGeneric && type.companies && type.companies.length > 0 && (
              <div style={{ marginTop: '0.5rem' }}>
                <strong style={{ fontSize: '0.8rem', color: '#64748b' }}>Empresas:</strong>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginTop: '0.25rem' }}>
                  {type.companies.map((company) => (
                    <span
                      key={company._id}
                      style={{
                        fontSize: '0.75rem',
                        padding: '0.15rem 0.5rem',
                        backgroundColor: '#e0f2fe',
                        color: '#0369a1',
                        borderRadius: '4px',
                        border: '1px solid #bae6fd'
                      }}
                    >
                      {company.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {type.default_identification_types && type.default_identification_types.length > 0 && (
              <div className="type-id-types-preview">
                <strong style={{ fontSize: '0.8rem', color: '#64748b' }}>Tipos de ID:</strong>
                <div className="id-types-badges">
                  {type.default_identification_types.map((idType, idx) => (
                    <span key={idx} className="id-type-badge-small">{idType}</span>
                  ))}
                </div>
              </div>
            )}

            <div className="type-actions">
              <button onClick={() => handleEdit(type)} className="btn-edit">
                ✏️ Editar
              </button>
              {!type.is_system && (
                <button onClick={() => handleDelete(type._id)} className="btn-delete">
                  🗑️ Eliminar
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingType ? 'Editar Tipo de Tercero' : 'Crear Nuevo Tipo de Tercero'}</h2>
              <button onClick={() => setShowModal(false)} className="btn-close">✖</button>
            </div>

            <div className="modal-body">
              <div className="form-section">
                <h3>Información General</h3>
                <div className="form-row">
                  <div className="form-group">
                    <label>Código *</label>
                    <input
                      type="text"
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value.toLowerCase() })}
                      placeholder="ej: proveedor"
                      disabled={!!editingType}
                    />
                  </div>
                  <div className="form-group">
                    <label>Ícono</label>
                    <input
                      type="text"
                      value={formData.icon}
                      onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                      placeholder="📦"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Nombre *</label>
                  <input
                    type="text"
                    value={formData.label}
                    onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                    placeholder="Proveedor"
                  />
                </div>

                <div className="form-group">
                  <label>Descripción</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Descripción del tipo de tercero"
                    rows={2}
                  />
                </div>
              </div>

              {(user?.role === 'super_admin' || user?.role === 'admin') && (
                <div className="form-section">
                  <h3>Alcance del Tipo de Tercero</h3>
                  <p className="form-hint">Define si este tipo aplica para todas las empresas o solo para empresas específicas</p>

                  <div className="form-group">
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={formData.isGeneric}
                        onChange={(e) => handleGenericToggle(e.target.checked)}
                      />
                      <span style={{ fontWeight: 500 }}>Genérico (aplica para todas las empresas)</span>
                    </label>
                  </div>

                  {!formData.isGeneric && (
                    <div className="companies-selector">
                      <label style={{ marginBottom: '0.5rem', fontWeight: 500, display: 'block' }}>
                        Seleccionar empresas ({formData.companies.length} seleccionadas):
                      </label>
                      {companies.length === 0 ? (
                        <p style={{ color: '#64748b', fontSize: '0.9rem' }}>No hay empresas disponibles</p>
                      ) : (
                        <div className="companies-grid" style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                          gap: '0.5rem',
                          maxHeight: '200px',
                          overflowY: 'auto',
                          border: '1px solid #e2e8f0',
                          borderRadius: '8px',
                          padding: '1rem'
                        }}>
                          {companies.map((company) => (
                            <label
                              key={company._id}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                padding: '0.5rem',
                                border: '1px solid #e2e8f0',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                backgroundColor: formData.companies.includes(company._id) ? '#e0f2fe' : 'white',
                                transition: 'all 0.2s'
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={formData.companies.includes(company._id)}
                                onChange={() => toggleCompany(company._id)}
                              />
                              <span style={{ fontSize: '0.9rem' }}>{company.name}</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="form-section">
                <h3>Tipos de Identificación Permitidos</h3>
                <p className="form-hint">Selecciona los tipos de identificación que se usarán con este tipo de tercero</p>

                <div className="id-types-common">
                  <label style={{ marginBottom: '0.5rem', fontWeight: 500, display: 'block' }}>Tipos comunes:</label>
                  <div className="id-types-grid">
                    {commonIdTypes.map((type) => (
                      <button
                        key={type}
                        type="button"
                        className={`id-type-btn ${(formData.default_identification_types || []).includes(type) ? 'selected' : ''}`}
                        onClick={() => toggleIdentificationType(type)}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="custom-id-input-container">
                  <label style={{ marginBottom: '0.5rem', fontWeight: 500, display: 'block' }}>Agregar tipo personalizado:</label>
                  <div className="custom-id-input-wrapper">
                    <input
                      type="text"
                      value={newIdType}
                      onChange={(e) => setNewIdType(e.target.value)}
                      placeholder="Ej: RFC, CUIL, etc."
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addCustomIdentificationType();
                        }
                      }}
                      style={{ flex: 1 }}
                    />
                    <button
                      type="button"
                      onClick={addCustomIdentificationType}
                      className="btn-add-custom-id"
                    >
                      + Agregar
                    </button>
                  </div>
                </div>

                {formData.default_identification_types && formData.default_identification_types.length > 0 && (
                  <div className="selected-id-types-container">
                    <label style={{ marginBottom: '0.5rem', fontWeight: 500, display: 'block' }}>Tipos seleccionados ({formData.default_identification_types.length}):</label>
                    <div className="selected-id-types-list">
                      {formData.default_identification_types.map((type) => (
                        <span key={type} className="selected-id-badge">
                          {type}
                          <button
                            type="button"
                            onClick={() => removeIdentificationType(type)}
                            className="remove-id-btn"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="form-section">
                <h3>Campos Personalizados ({formData.fields.length})</h3>

                <div className="add-field-section">
                  <h4>Agregar Campo</h4>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Nombre del campo *</label>
                      <input
                        type="text"
                        value={newField.name}
                        onChange={(e) => setNewField({ ...newField, name: e.target.value.toLowerCase().replace(/\s/g, '_') })}
                        placeholder="nombre_campo"
                      />
                    </div>
                    <div className="form-group">
                      <label>Etiqueta *</label>
                      <input
                        type="text"
                        value={newField.label}
                        onChange={(e) => setNewField({ ...newField, label: e.target.value })}
                        placeholder="Etiqueta visible"
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Tipo de campo *</label>
                      <select
                        value={newField.field_type}
                        onChange={(e) => setNewField({ ...newField, field_type: e.target.value })}
                      >
                        {fieldTypes.map((ft) => (
                          <option key={ft.value} value={ft.value}>{ft.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Placeholder</label>
                      <input
                        type="text"
                        value={newField.placeholder}
                        onChange={(e) => setNewField({ ...newField, placeholder: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label>
                      <input
                        type="checkbox"
                        checked={newField.required}
                        onChange={(e) => setNewField({ ...newField, required: e.target.checked })}
                      />
                      Campo obligatorio
                    </label>
                  </div>

                  <button onClick={handleAddField} className="btn-add-field">
                    ➕ Agregar Campo
                  </button>
                </div>

                <div className="fields-list">
                  {formData.fields.map((field, index) => (
                    <div key={index} className="field-item">
                      {editingFieldIndex === index ? (
                        // Modo de edición
                        <div className="field-edit-form">
                          <div className="form-row">
                            <div className="form-group">
                              <label>Nombre del Campo (interno)</label>
                              <input
                                type="text"
                                value={editingFieldData?.name || ''}
                                onChange={(e) => setEditingFieldData({ ...editingFieldData!, name: e.target.value })}
                                placeholder="ej: nombre_completo"
                              />
                            </div>
                            <div className="form-group">
                              <label>Etiqueta (visible)</label>
                              <input
                                type="text"
                                value={editingFieldData?.label || ''}
                                onChange={(e) => setEditingFieldData({ ...editingFieldData!, label: e.target.value })}
                                placeholder="ej: Nombre Completo"
                              />
                            </div>
                          </div>

                          <div className="form-row">
                            <div className="form-group">
                              <label>Tipo de Campo</label>
                              <select
                                value={editingFieldData?.field_type || 'text'}
                                onChange={(e) => setEditingFieldData({ ...editingFieldData!, field_type: e.target.value })}
                              >
                                {fieldTypes.map((type) => (
                                  <option key={type.value} value={type.value}>
                                    {type.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="form-group">
                              <label>Placeholder</label>
                              <input
                                type="text"
                                value={editingFieldData?.placeholder || ''}
                                onChange={(e) => setEditingFieldData({ ...editingFieldData!, placeholder: e.target.value })}
                                placeholder="Texto de ayuda"
                              />
                            </div>
                          </div>

                          <div className="form-group">
                            <label>
                              <input
                                type="checkbox"
                                checked={editingFieldData?.required || false}
                                onChange={(e) => setEditingFieldData({ ...editingFieldData!, required: e.target.checked })}
                              />
                              Campo obligatorio
                            </label>
                          </div>

                          <div className="field-edit-actions">
                            <button onClick={handleSaveEditField} className="btn-save-field">
                              ✅ Guardar
                            </button>
                            <button onClick={handleCancelEditField} className="btn-cancel-field">
                              ❌ Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        // Modo de visualización
                        <>
                          <div className="field-info">
                            <strong>{field.label}</strong>
                            <span className="field-details">
                              {field.name} • {field.field_type}
                              {field.required && ' • Requerido'}
                            </span>
                          </div>
                          <div className="field-actions">
                            <button
                              onClick={() => handleStartEditField(index)}
                              className="btn-icon btn-edit"
                              title="Editar campo"
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                              </svg>
                            </button>
                            <button
                              onClick={() => handleMoveField(index, 'up')}
                              disabled={index === 0}
                              className="btn-icon"
                              title="Mover arriba"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="18 15 12 9 6 15"></polyline>
                              </svg>
                            </button>
                            <button
                              onClick={() => handleMoveField(index, 'down')}
                              disabled={index === formData.fields.length - 1}
                              className="btn-icon"
                              title="Mover abajo"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="6 9 12 15 18 9"></polyline>
                              </svg>
                            </button>
                            <button
                              onClick={() => handleRemoveField(index)}
                              className="btn-icon-delete"
                              title="Eliminar campo"
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                              </svg>
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button onClick={() => setShowModal(false)} className="btn-cancel">
                Cancelar
              </button>
              <button onClick={handleSave} className="btn-save">
                {editingType ? 'Actualizar' : 'Crear'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ThirdPartyTypeManagement;
