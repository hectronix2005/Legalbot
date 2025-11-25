import React, { useState, useEffect } from 'react';
import api from '../services/api';
import './ThirdPartyProfileSelector.css';

interface Supplier {
  _id: string;
  identification_type: string;
  identification_number: string;
  legal_name?: string;
  full_name?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  active: boolean;
}

interface RoleGroup {
  role: string;
  role_label: string;
  variables: string[];
  suggested_mappings: Array<{
    template_variable: string;
    suggested_source_field: string;
    confidence: number;
  }>;
}

interface TemplateAnalysis {
  template_id: string;
  total_variables: number;
  roles_detected: string[];
  roles_count: number;
  role_groups: RoleGroup[];
  classification_rate: number;
}

interface FieldMapping {
  template_variable: string;
  source_field?: string;
  value: any;
  is_auto_filled: boolean;
}

interface ThirdPartyProfile {
  _id: string;
  supplier: string;
  template: string;
  role_in_template: string;
  role_label: string;
  field_mappings: FieldMapping[];
  template_specific_fields: Record<string, any>;
  completeness: {
    required_fields_count: number;
    filled_fields_count: number;
    percentage: number;
    missing_fields: string[];
  };
  usage_count: number;
}

interface ThirdPartyProfileSelectorProps {
  templateId: string;
  onProfileSelect: (profileData: Record<string, any>) => void;
  onChange?: (profile: ThirdPartyProfile | null) => void;
}

const ThirdPartyProfileSelector: React.FC<ThirdPartyProfileSelectorProps> = ({
  templateId,
  onProfileSelect,
  onChange
}) => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [templateAnalysis, setTemplateAnalysis] = useState<TemplateAnalysis | null>(null);
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [profile, setProfile] = useState<ThirdPartyProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);
  const [analyzingTemplate, setAnalyzingTemplate] = useState(false);
  const [error, setError] = useState<string>('');

  // Load suppliers on mount
  useEffect(() => {
    fetchSuppliers();
  }, []);

  // Analyze template when templateId changes
  useEffect(() => {
    if (templateId) {
      analyzeTemplate();
    } else {
      setTemplateAnalysis(null);
      setSelectedRole('');
      setProfile(null);
    }
  }, [templateId]);

  // Notify parent when profile changes
  useEffect(() => {
    if (onChange) {
      onChange(profile);
    }

    // Send profile data to parent for contract generation
    if (profile) {
      const contractData: Record<string, any> = {};
      profile.field_mappings.forEach(mapping => {
        const fieldName = mapping.template_variable.replace(/[{}]/g, '');
        contractData[fieldName] = mapping.value || '';
      });
      onProfileSelect(contractData);
    } else {
      onProfileSelect({});
    }
  }, [profile, onChange, onProfileSelect]);

  const fetchSuppliers = async () => {
    setLoadingSuppliers(true);
    try {
      const response = await api.get('/suppliers');
      const suppliersList = Array.isArray(response.data)
        ? response.data
        : response.data.suppliers || [];
      setSuppliers(suppliersList.filter((s: Supplier) => s.active));
    } catch (error: any) {
      console.error('Error fetching suppliers:', error);
      setError('Error al cargar terceros');
    } finally {
      setLoadingSuppliers(false);
    }
  };

  const analyzeTemplate = async () => {
    if (!templateId) return;

    setAnalyzingTemplate(true);
    setError('');

    try {
      const response = await api.post(`/third-party-profiles/analyze-template/${templateId}`);

      if (response.data.success) {
        setTemplateAnalysis(response.data.analysis);

        // Auto-select first role if only one detected
        if (response.data.analysis.roles_detected.length === 1) {
          setSelectedRole(response.data.analysis.roles_detected[0]);
        }
      }
    } catch (error: any) {
      console.error('Error analyzing template:', error);
      setError('Error al analizar plantilla');
    } finally {
      setAnalyzingTemplate(false);
    }
  };

  const handleSupplierChange = async (supplierId: string) => {
    if (!supplierId) {
      setSelectedSupplier(null);
      setProfile(null);
      return;
    }

    const supplier = suppliers.find(s => s._id === supplierId);
    if (!supplier) return;

    setSelectedSupplier(supplier);

    // If role is already selected, auto-fill profile
    if (selectedRole && templateId) {
      await autoFillProfile(supplierId, selectedRole);
    }
  };

  const handleRoleChange = async (role: string) => {
    setSelectedRole(role);

    // If supplier is already selected, auto-fill profile
    if (selectedSupplier && templateId) {
      await autoFillProfile(selectedSupplier._id, role);
    }
  };

  const autoFillProfile = async (supplierId: string, role: string) => {
    if (!templateId || !supplierId || !role) return;

    setLoading(true);
    setError('');

    try {
      const response = await api.post('/third-party-profiles/auto-fill', {
        supplier_id: supplierId,
        template_id: templateId,
        role_in_template: role
      });

      if (response.data.success) {
        setProfile(response.data.profile);
      }
    } catch (error: any) {
      console.error('Error auto-filling profile:', error);
      setError('Error al auto-llenar perfil');
    } finally {
      setLoading(false);
    }
  };

  const handleFieldChange = (templateVariable: string, value: any) => {
    if (!profile) return;

    // Update field in profile
    const updatedMappings = profile.field_mappings.map(mapping =>
      mapping.template_variable === templateVariable
        ? { ...mapping, value, is_auto_filled: false }
        : mapping
    );

    const updatedProfile = {
      ...profile,
      field_mappings: updatedMappings
    };

    setProfile(updatedProfile);
  };

  const getCompletenessColor = (percentage: number): string => {
    if (percentage >= 80) return '#4caf50';
    if (percentage >= 50) return '#ff9800';
    return '#f44336';
  };

  const getRoleGroupForSelectedRole = (): RoleGroup | undefined => {
    if (!templateAnalysis || !selectedRole) return undefined;
    return templateAnalysis.role_groups.find(g => g.role === selectedRole);
  };

  return (
    <div className="third-party-profile-selector">
      <h4>Seleccionar Tercero para esta Plantilla</h4>

      {/* Template Analysis Info */}
      {analyzingTemplate && (
        <div className="loading-message">
          Analizando plantilla...
        </div>
      )}

      {templateAnalysis && templateAnalysis.roles_count > 0 && (
        <div className="template-analysis-info">
          <div className="analysis-summary">
            <span className="analysis-badge">
              {templateAnalysis.roles_count} rol(es) detectado(s)
            </span>
            <span className="analysis-badge">
              {templateAnalysis.total_variables} variables
            </span>
            <span className="analysis-badge">
              {templateAnalysis.classification_rate}% clasificadas
            </span>
          </div>
        </div>
      )}

      {/* Role Selector - Only show if multiple roles detected */}
      {templateAnalysis && templateAnalysis.roles_count > 1 && (
        <div className="form-group">
          <label className="form-label">
            Rol del Tercero en este Contrato
            <span className="required">*</span>
          </label>
          <select
            value={selectedRole}
            onChange={(e) => handleRoleChange(e.target.value)}
            className="form-select"
            disabled={loading}
          >
            <option value="">-- Seleccionar rol --</option>
            {templateAnalysis.role_groups.map(roleGroup => (
              <option key={roleGroup.role} value={roleGroup.role}>
                {roleGroup.role_label} ({roleGroup.variables.length} campos)
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Supplier Selector */}
      <div className="form-group">
        <label className="form-label">
          Tercero
          <span className="required">*</span>
        </label>
        <select
          value={selectedSupplier?._id || ''}
          onChange={(e) => handleSupplierChange(e.target.value)}
          className="form-select"
          disabled={loadingSuppliers || loading}
        >
          <option value="">-- Seleccionar tercero --</option>
          {suppliers.map(supplier => {
            const displayName = supplier.legal_name || supplier.full_name || supplier.identification_number;
            return (
              <option key={supplier._id} value={supplier._id}>
                {displayName} ({supplier.identification_number})
              </option>
            );
          })}
        </select>
        {loadingSuppliers && (
          <span className="loading-text">Cargando terceros...</span>
        )}
      </div>

      {/* Loading State */}
      {loading && (
        <div className="loading-message">
          Auto-llenando perfil desde datos del tercero...
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {/* Profile Preview */}
      {profile && (
        <div className="profile-preview">
          <div className="profile-header">
            <div className="profile-title">
              <h5>Perfil: {profile.role_label}</h5>
              <span className="profile-meta">
                {selectedSupplier?.legal_name || selectedSupplier?.full_name}
              </span>
            </div>
            <div className="completeness-indicator">
              <div className="completeness-bar-container">
                <div
                  className="completeness-bar"
                  style={{
                    width: `${profile.completeness.percentage}%`,
                    backgroundColor: getCompletenessColor(profile.completeness.percentage)
                  }}
                />
              </div>
              <span className="completeness-text">
                {profile.completeness.percentage}% completo
              </span>
            </div>
          </div>

          {/* Auto-filled fields summary */}
          <div className="profile-stats">
            <span className="stat">
              {profile.field_mappings.filter(m => m.is_auto_filled).length} auto-llenados
            </span>
            <span className="stat">
              {profile.completeness.filled_fields_count}/{profile.field_mappings.length} llenos
            </span>
            {profile.usage_count > 0 && (
              <span className="stat">
                Usado {profile.usage_count} vez(es)
              </span>
            )}
          </div>

          {/* Editable Fields */}
          {profile.completeness.percentage < 100 && (
            <div className="missing-fields-section">
              <h6>Campos Faltantes</h6>
              <div className="fields-grid">
                {profile.field_mappings
                  .filter(mapping => !mapping.value || mapping.value === '')
                  .slice(0, 5)
                  .map((mapping, index) => {
                    const fieldName = mapping.template_variable.replace(/[{}]/g, '');
                    return (
                      <div key={index} className="field-item">
                        <label className="field-label">
                          {fieldName}
                        </label>
                        <input
                          type="text"
                          className="field-input"
                          placeholder={`Ingrese ${fieldName}`}
                          value={mapping.value || ''}
                          onChange={(e) => handleFieldChange(mapping.template_variable, e.target.value)}
                        />
                      </div>
                    );
                  })}
              </div>
              {profile.completeness.missing_fields.length > 5 && (
                <p className="more-fields-text">
                  Y {profile.completeness.missing_fields.length - 5} campo(s) más...
                </p>
              )}
            </div>
          )}

          {/* Success Message */}
          {profile.completeness.percentage === 100 && (
            <div className="success-message">
              Todos los campos están completos. El perfil está listo para generar el contrato.
            </div>
          )}
        </div>
      )}

      {/* Help Text */}
      {!selectedSupplier && !profile && (
        <div className="help-text">
          Selecciona un tercero para auto-llenar los campos del contrato con su información.
          {templateAnalysis && templateAnalysis.roles_count > 0 && (
            <span> Los campos detectados para el rol seleccionado se llenarán automáticamente.</span>
          )}
        </div>
      )}
    </div>
  );
};

export default ThirdPartyProfileSelector;
