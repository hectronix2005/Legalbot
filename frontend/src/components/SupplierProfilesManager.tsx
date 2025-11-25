import React, { useState, useEffect } from 'react';
import api from '../services/api';
import ProfileVariantManager from './ProfileVariantManager';
import './SupplierProfilesManager.css';

interface Template {
  _id: string;
  name: string;
  category: string;
}

interface ThirdPartyProfile {
  _id: string;
  supplier: any;
  template: Template;
  role_in_template: string;
  role_label: string;
  field_mappings: Array<{
    template_variable: string;
    value: any;
    is_auto_filled: boolean;
  }>;
  variants: Array<{
    _id: string;
    variant_name: string;
    variant_description: string;
    context_tags: string[];
    is_default: boolean;
    active: boolean;
    usage_count: number;
  }>;
  completeness: {
    percentage: number;
    filled_fields_count: number;
    required_fields_count: number;
    missing_fields: string[];
  };
  usage_count: number;
  last_used_at?: string;
  createdAt: string;
}

interface SupplierProfilesManagerProps {
  supplierId: string;
  supplierName: string;
}

const SupplierProfilesManager: React.FC<SupplierProfilesManagerProps> = ({
  supplierId,
  supplierName
}) => {
  const [profiles, setProfiles] = useState<ThirdPartyProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [selectedProfile, setSelectedProfile] = useState<ThirdPartyProfile | null>(null);
  const [showVariantsModal, setShowVariantsModal] = useState(false);

  useEffect(() => {
    if (supplierId) {
      fetchProfiles();
    }
  }, [supplierId]);

  const fetchProfiles = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await api.get(`/third-party-profiles/by-supplier/${supplierId}`);

      if (response.data.success) {
        setProfiles(response.data.profiles);
      }
    } catch (error: any) {
      console.error('Error fetching profiles:', error);
      setError('Error al cargar perfiles del tercero');
    } finally {
      setLoading(false);
    }
  };

  const getCompletenessColor = (percentage: number): string => {
    if (percentage >= 80) return '#4caf50';
    if (percentage >= 50) return '#ff9800';
    return '#f44336';
  };

  const formatDate = (dateString?: string): string => {
    if (!dateString) return 'Nunca';

    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getUsageText = (profile: ThirdPartyProfile): string => {
    if (profile.usage_count === 0) return 'Sin usar';
    if (profile.usage_count === 1) return '1 vez';
    return `${profile.usage_count} veces`;
  };

  return (
    <div className="supplier-profiles-manager">
      <div className="manager-header">
        <h3>Perfiles de {supplierName}</h3>
        <p className="manager-subtitle">
          Gestiona los perfiles de este tercero para diferentes plantillas de contrato
        </p>
      </div>

      {loading && (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Cargando perfiles...</p>
        </div>
      )}

      {error && (
        <div className="error-alert">
          {error}
        </div>
      )}

      {!loading && !error && profiles.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">📋</div>
          <h4>Sin perfiles creados</h4>
          <p>
            Este tercero aún no tiene perfiles asociados a plantillas de contrato.
            Los perfiles se crean automáticamente al usar el Generador de Contratos.
          </p>
        </div>
      )}

      {!loading && !error && profiles.length > 0 && (
        <div className="profiles-grid">
          {profiles.map(profile => (
            <div
              key={profile._id}
              className={`profile-card ${selectedProfile?._id === profile._id ? 'selected' : ''}`}
              onClick={() => setSelectedProfile(profile)}
            >
              <div className="profile-card-header">
                <div className="template-info">
                  <h4>{profile.template.name}</h4>
                  <span className="template-category">{profile.template.category}</span>
                </div>
                <div className="header-badges">
                  <div className="role-badge">
                    {profile.role_label}
                  </div>
                  {profile.variants && profile.variants.length > 0 && (
                    <div className="variants-badge">
                      {profile.variants.filter(v => v.active).length} variante{profile.variants.filter(v => v.active).length !== 1 ? 's' : ''}
                    </div>
                  )}
                </div>
              </div>

              <div className="completeness-section">
                <div className="completeness-label">
                  <span>Completitud</span>
                  <strong>{profile.completeness.percentage}%</strong>
                </div>
                <div className="completeness-bar-container">
                  <div
                    className="completeness-bar"
                    style={{
                      width: `${profile.completeness.percentage}%`,
                      backgroundColor: getCompletenessColor(profile.completeness.percentage)
                    }}
                  />
                </div>
              </div>

              <div className="profile-stats">
                <div className="stat-item">
                  <span className="stat-label">Campos llenos</span>
                  <span className="stat-value">
                    {profile.completeness.filled_fields_count} / {profile.field_mappings.length}
                  </span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Uso</span>
                  <span className="stat-value">{getUsageText(profile)}</span>
                </div>
              </div>

              <div className="profile-footer">
                <span className="created-date">
                  Creado: {formatDate(profile.createdAt)}
                </span>
                {profile.last_used_at && (
                  <span className="last-used">
                    Último uso: {formatDate(profile.last_used_at)}
                  </span>
                )}
              </div>

              {profile.variants && profile.variants.length > 0 && (
                <button
                  className="btn-manage-variants"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedProfile(profile);
                    setShowVariantsModal(true);
                  }}
                >
                  Gestionar Variantes
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {selectedProfile && (
        <div className="profile-detail-modal" onClick={() => setSelectedProfile(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Detalle del Perfil</h3>
              <button className="close-button" onClick={() => setSelectedProfile(null)}>
                ✕
              </button>
            </div>

            <div className="modal-body">
              <div className="detail-section">
                <h4>Información General</h4>
                <div className="detail-grid">
                  <div className="detail-item">
                    <span className="label">Plantilla:</span>
                    <span className="value">{selectedProfile.template.name}</span>
                  </div>
                  <div className="detail-item">
                    <span className="label">Categoría:</span>
                    <span className="value">{selectedProfile.template.category}</span>
                  </div>
                  <div className="detail-item">
                    <span className="label">Rol:</span>
                    <span className="value">{selectedProfile.role_label}</span>
                  </div>
                  <div className="detail-item">
                    <span className="label">Completitud:</span>
                    <span className="value" style={{ color: getCompletenessColor(selectedProfile.completeness.percentage) }}>
                      {selectedProfile.completeness.percentage}%
                    </span>
                  </div>
                </div>
              </div>

              <div className="detail-section">
                <h4>Campos ({selectedProfile.field_mappings.length})</h4>
                <div className="fields-list">
                  {selectedProfile.field_mappings.slice(0, 10).map((mapping, index) => (
                    <div key={index} className="field-row">
                      <span className="field-name">
                        {mapping.template_variable.replace(/[{}]/g, '')}
                      </span>
                      <span className={`field-status ${mapping.value ? 'filled' : 'empty'}`}>
                        {mapping.value ? '✓ Lleno' : '○ Vacío'}
                      </span>
                      {mapping.is_auto_filled && (
                        <span className="auto-badge">Auto</span>
                      )}
                    </div>
                  ))}
                  {selectedProfile.field_mappings.length > 10 && (
                    <p className="more-fields">
                      Y {selectedProfile.field_mappings.length - 10} campos más...
                    </p>
                  )}
                </div>
              </div>

              {selectedProfile.completeness.missing_fields.length > 0 && (
                <div className="detail-section missing-section">
                  <h4>Campos Faltantes ({selectedProfile.completeness.missing_fields.length})</h4>
                  <div className="missing-fields-list">
                    {selectedProfile.completeness.missing_fields.slice(0, 5).map((field, index) => (
                      <span key={index} className="missing-field-tag">
                        {field.replace(/[{}]/g, '')}
                      </span>
                    ))}
                    {selectedProfile.completeness.missing_fields.length > 5 && (
                      <span className="more-tag">
                        +{selectedProfile.completeness.missing_fields.length - 5} más
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <p className="help-text">
                Los perfiles se editan desde el Generador de Contratos al seleccionar la plantilla correspondiente.
              </p>
              {selectedProfile.variants && selectedProfile.variants.length > 0 && (
                <button
                  className="btn-primary"
                  onClick={() => setShowVariantsModal(true)}
                >
                  Ver Variantes ({selectedProfile.variants.filter(v => v.active).length})
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Gestión de Variantes */}
      {showVariantsModal && selectedProfile && (
        <div className="modal-overlay" onClick={() => setShowVariantsModal(false)}>
          <div className="modal-content modal-variants" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3>Variantes del Perfil</h3>
                <p className="modal-subtitle">
                  {selectedProfile.supplier?.legal_name || selectedProfile.supplier?.full_name} - {selectedProfile.template.name}
                </p>
              </div>
              <button className="close-button" onClick={() => setShowVariantsModal(false)}>
                ✕
              </button>
            </div>

            <div className="modal-body">
              <ProfileVariantManager
                profileId={selectedProfile._id}
                showCreateButton={true}
              />
            </div>

            <div className="modal-footer">
              <button className="btn-primary" onClick={() => setShowVariantsModal(false)}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SupplierProfilesManager;
