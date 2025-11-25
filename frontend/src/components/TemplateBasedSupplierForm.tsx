import React, { useState, useEffect } from 'react';
import api, {
  getTemplateFields,
  createSupplierWithProfile,
  TemplateFieldsResponse,
  RoleFields,
  TemplateField
} from '../services/api';
import './TemplateBasedSupplierForm.css';

interface Template {
  _id: string;
  name: string;
  category: string;
  third_party_type?: string;
}

interface TemplateBasedSupplierFormProps {
  onSuccess?: (supplier: any, profile: any) => void;
  onCancel?: () => void;
  preSelectedTemplateId?: string;
}

const TemplateBasedSupplierForm: React.FC<TemplateBasedSupplierFormProps> = ({
  onSuccess,
  onCancel,
  preSelectedTemplateId
}) => {
  // Estados
  const [step, setStep] = useState<'template' | 'role' | 'fields'>('template');
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [templateFields, setTemplateFields] = useState<TemplateFieldsResponse | null>(null);
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [roleFields, setRoleFields] = useState<RoleFields | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({
    identification_type: 'CC',
    identification_number: ''
  });
  const [loading, setLoading] = useState(false);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Cargar plantillas al inicio
  useEffect(() => {
    loadTemplates();
  }, []);

  // Si hay plantilla preseleccionada, cargarla
  useEffect(() => {
    if (preSelectedTemplateId && templates.length > 0) {
      const template = templates.find(t => t._id === preSelectedTemplateId);
      if (template) {
        handleTemplateSelect(template);
      }
    }
  }, [preSelectedTemplateId, templates]);

  const loadTemplates = async () => {
    try {
      setLoadingTemplates(true);
      const response = await api.get('/templates');
      setTemplates(response.data.templates || response.data || []);
    } catch (err) {
      console.error('Error loading templates:', err);
      setError('Error al cargar plantillas');
    } finally {
      setLoadingTemplates(false);
    }
  };

  const handleTemplateSelect = async (template: Template) => {
    try {
      setLoading(true);
      setError(null);
      setSelectedTemplate(template);

      // Obtener campos de la plantilla
      const fields = await getTemplateFields(template._id);
      setTemplateFields(fields);

      // Si solo hay un rol, seleccionarlo automáticamente
      const roles = Object.keys(fields.roles);
      if (roles.length === 1) {
        setSelectedRole(roles[0]);
        setRoleFields(fields.roles[roles[0]]);
        setStep('fields');
      } else if (roles.length > 1) {
        setStep('role');
      } else {
        setError('La plantilla no tiene variables de terceros definidas');
      }
    } catch (err) {
      console.error('Error loading template fields:', err);
      setError('Error al cargar campos de la plantilla');
    } finally {
      setLoading(false);
    }
  };

  const handleRoleSelect = (role: string) => {
    if (templateFields) {
      setSelectedRole(role);
      setRoleFields(templateFields.roles[role]);
      setStep('fields');
    }
  };

  const handleInputChange = (fieldName: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [fieldName]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // Validar campos requeridos
    if (!formData.identification_type || !formData.identification_number) {
      setError('Tipo y número de identificación son requeridos');
      return;
    }

    if (!selectedTemplate || !selectedRole) {
      setError('Debe seleccionar una plantilla y un rol');
      return;
    }

    try {
      setLoading(true);

      // Separar campos base de campos específicos de plantilla
      const baseFields = ['identification_type', 'identification_number', 'legal_name',
        'legal_name_short', 'full_name', 'legal_representative_name',
        'legal_representative_id_type', 'legal_representative_id_number',
        'email', 'phone', 'address', 'city', 'country'];

      const templateSpecificFields: Record<string, any> = {};

      Object.keys(formData).forEach(key => {
        if (!baseFields.includes(key) && formData[key]) {
          templateSpecificFields[key] = formData[key];
        }
      });

      const submitData = {
        template_id: selectedTemplate._id,
        role_in_template: selectedRole,
        identification_type: formData.identification_type,
        identification_number: formData.identification_number,
        legal_name: formData.legal_name || formData[`${selectedRole}_nombre`] || formData[`${selectedRole}_razon_social`],
        legal_name_short: formData.legal_name_short || formData[`${selectedRole}_razon_social_corta`],
        full_name: formData.full_name || formData[`${selectedRole}_nombre_completo`],
        legal_representative_name: formData.legal_representative_name || formData[`${selectedRole}_representante`] || formData[`${selectedRole}_representante_legal`],
        email: formData.email || formData[`${selectedRole}_email`] || formData[`${selectedRole}_correo`],
        phone: formData.phone || formData[`${selectedRole}_telefono`] || formData[`${selectedRole}_celular`],
        address: formData.address || formData[`${selectedRole}_direccion`],
        city: formData.city || formData[`${selectedRole}_ciudad`],
        country: formData.country,
        template_fields: templateSpecificFields
      };

      const result = await createSupplierWithProfile(submitData);

      setSuccess(result.message || 'Tercero creado exitosamente');

      if (onSuccess) {
        onSuccess(result.supplier, result.profile);
      }
    } catch (err: any) {
      console.error('Error creating supplier:', err);
      setError(err.response?.data?.error || 'Error al crear tercero');
    } finally {
      setLoading(false);
    }
  };

  const renderFieldInput = (field: TemplateField) => {
    const value = formData[field.field_name] || '';

    if (field.field_type === 'select' && field.options) {
      return (
        <select
          className="form-input"
          value={value}
          onChange={(e) => handleInputChange(field.field_name, e.target.value)}
          required={field.required}
        >
          <option value="">Seleccione...</option>
          {field.options.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      );
    }

    if (field.field_type === 'textarea') {
      return (
        <textarea
          className="form-input"
          value={value}
          onChange={(e) => handleInputChange(field.field_name, e.target.value)}
          required={field.required}
          rows={3}
        />
      );
    }

    if (field.field_type === 'date') {
      return (
        <input
          type="date"
          className="form-input"
          value={value}
          onChange={(e) => handleInputChange(field.field_name, e.target.value)}
          required={field.required}
        />
      );
    }

    if (field.field_type === 'number') {
      return (
        <input
          type="number"
          className="form-input"
          value={value}
          onChange={(e) => handleInputChange(field.field_name, e.target.value)}
          required={field.required}
        />
      );
    }

    if (field.field_type === 'email') {
      return (
        <input
          type="email"
          className="form-input"
          value={value}
          onChange={(e) => handleInputChange(field.field_name, e.target.value)}
          required={field.required}
        />
      );
    }

    return (
      <input
        type="text"
        className="form-input"
        value={value}
        onChange={(e) => handleInputChange(field.field_name, e.target.value)}
        required={field.required}
      />
    );
  };

  // Paso 1: Selección de plantilla
  const renderTemplateSelection = () => (
    <div className="step-content">
      <div className="step-header">
        <h3>Paso 1: Seleccionar Plantilla</h3>
        <p>Seleccione la plantilla para la cual desea crear el tercero</p>
      </div>

      {loadingTemplates ? (
        <div className="loading">Cargando plantillas...</div>
      ) : (
        <div className="templates-grid">
          {templates.map(template => (
            <div
              key={template._id}
              className={`template-card ${selectedTemplate?._id === template._id ? 'selected' : ''}`}
              onClick={() => handleTemplateSelect(template)}
            >
              <div className="template-icon">📄</div>
              <div className="template-info">
                <h4>{template.name}</h4>
                <span className="template-category">{template.category}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {templates.length === 0 && !loadingTemplates && (
        <div className="empty-state">
          <p>No hay plantillas disponibles. Primero debe crear una plantilla.</p>
        </div>
      )}
    </div>
  );

  // Paso 2: Selección de rol (si hay múltiples)
  const renderRoleSelection = () => (
    <div className="step-content">
      <div className="step-header">
        <h3>Paso 2: Seleccionar Rol</h3>
        <p>La plantilla "{selectedTemplate?.name}" tiene varios roles. Seleccione el rol del tercero:</p>
      </div>

      <div className="roles-grid">
        {templateFields && Object.entries(templateFields.roles).map(([role, data]) => (
          <div
            key={role}
            className={`role-card ${selectedRole === role ? 'selected' : ''}`}
            onClick={() => handleRoleSelect(role)}
          >
            <div className="role-icon">👤</div>
            <div className="role-info">
              <h4>{data.role_label}</h4>
              <span className="role-fields">{data.total_fields} campos</span>
            </div>
          </div>
        ))}
      </div>

      <div className="step-actions">
        <button type="button" className="btn-secondary" onClick={() => setStep('template')}>
          Volver
        </button>
      </div>
    </div>
  );

  // Paso 3: Formulario de campos
  const renderFieldsForm = () => {
    if (!roleFields || !templateFields) return null;

    // Combinar campos base con campos del rol
    const allFields = [...templateFields.base_fields, ...roleFields.fields];

    // Separar en grupos
    const identificationFields = allFields.filter(f => f.category === 'identification');
    const supplierBaseFields = roleFields.fields.filter(f => f.supplier_field);
    const customFields = roleFields.fields.filter(f => f.is_custom_field);

    return (
      <div className="step-content">
        <div className="step-header">
          <h3>Paso 3: Completar Datos</h3>
          <p>
            Plantilla: <strong>{selectedTemplate?.name}</strong> |
            Rol: <strong>{roleFields.role_label}</strong>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="fields-form">
          {/* Campos de identificación */}
          <div className="field-section">
            <h4>Identificación</h4>
            <div className="fields-grid">
              {identificationFields.map(field => (
                <div key={field.field_name} className="field-group">
                  <label className="field-label">
                    {field.field_label}
                    {field.required && <span className="required">*</span>}
                  </label>
                  {renderFieldInput(field)}
                </div>
              ))}
            </div>
          </div>

          {/* Campos base del tercero */}
          {supplierBaseFields.length > 0 && (
            <div className="field-section">
              <h4>Datos del Tercero</h4>
              <div className="fields-grid">
                {supplierBaseFields.map(field => (
                  <div key={field.field_name} className="field-group">
                    <label className="field-label">
                      {field.field_label}
                      {field.required && <span className="required">*</span>}
                    </label>
                    {field.description && (
                      <small className="field-description">{field.description}</small>
                    )}
                    {renderFieldInput(field)}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Campos específicos de la plantilla */}
          {customFields.length > 0 && (
            <div className="field-section">
              <h4>Campos Específicos de la Plantilla</h4>
              <div className="fields-grid">
                {customFields.map(field => (
                  <div key={field.field_name} className="field-group">
                    <label className="field-label">
                      {field.field_label}
                      {field.required && <span className="required">*</span>}
                    </label>
                    {field.description && (
                      <small className="field-description">{field.description}</small>
                    )}
                    {renderFieldInput(field)}
                    <small className="field-marker">{field.original_marker}</small>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Acciones */}
          <div className="form-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => Object.keys(templateFields.roles).length > 1 ? setStep('role') : setStep('template')}
            >
              Volver
            </button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Guardando...' : 'Crear Tercero'}
            </button>
          </div>
        </form>
      </div>
    );
  };

  return (
    <div className="template-based-supplier-form">
      <div className="form-header">
        <h2>Crear Tercero para Plantilla</h2>
        <p>Complete los datos del tercero según los campos requeridos por la plantilla seleccionada</p>
      </div>

      {/* Progress indicator */}
      <div className="steps-progress">
        <div className={`step-indicator ${step === 'template' ? 'active' : selectedTemplate ? 'completed' : ''}`}>
          <span className="step-number">1</span>
          <span className="step-label">Plantilla</span>
        </div>
        <div className="step-connector"></div>
        <div className={`step-indicator ${step === 'role' ? 'active' : selectedRole ? 'completed' : ''}`}>
          <span className="step-number">2</span>
          <span className="step-label">Rol</span>
        </div>
        <div className="step-connector"></div>
        <div className={`step-indicator ${step === 'fields' ? 'active' : ''}`}>
          <span className="step-number">3</span>
          <span className="step-label">Datos</span>
        </div>
      </div>

      {/* Mensajes */}
      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {/* Loading overlay */}
      {loading && step !== 'template' && (
        <div className="loading-overlay">
          <div className="spinner"></div>
          <p>Procesando...</p>
        </div>
      )}

      {/* Contenido según paso */}
      {step === 'template' && renderTemplateSelection()}
      {step === 'role' && renderRoleSelection()}
      {step === 'fields' && renderFieldsForm()}

      {/* Botón cancelar */}
      {onCancel && (
        <div className="cancel-action">
          <button type="button" className="btn-link" onClick={onCancel}>
            Cancelar
          </button>
        </div>
      )}
    </div>
  );
};

export default TemplateBasedSupplierForm;
