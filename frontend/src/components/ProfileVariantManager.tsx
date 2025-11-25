import React, { useState, useEffect } from 'react';
import api from '../services/api';
import './ProfileVariantManager.css';

interface FieldMapping {
  template_variable: string;
  value: any;
  is_auto_filled: boolean;
  source_field?: string;
}

interface ProfileVariant {
  _id: string;
  variant_name: string;
  variant_description: string;
  context_tags: string[];
  field_mappings: FieldMapping[];
  is_default: boolean;
  active: boolean;
  usage_count: number;
  last_used_at?: string;
  createdAt: string;
  updatedAt: string;
}

interface Profile {
  _id: string;
  supplier: {
    _id: string;
    legal_name?: string;
    full_name?: string;
  };
  template: {
    _id: string;
    name: string;
    category: string;
  };
  role_in_template: string;
  role_label: string;
}

interface ProfileVariantManagerProps {
  profileId: string;
  onVariantSelect?: (variantId: string) => void;
  showCreateButton?: boolean;
}

const ProfileVariantManager: React.FC<ProfileVariantManagerProps> = ({
  profileId,
  onVariantSelect,
  showCreateButton = true
}) => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [variants, setVariants] = useState<ProfileVariant[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [selectedVariant, setSelectedVariant] = useState<ProfileVariant | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingVariant, setEditingVariant] = useState<ProfileVariant | null>(null);

  const [formData, setFormData] = useState({
    variant_name: '',
    variant_description: '',
    context_tags: [] as string[],
    is_default: false
  });

  useEffect(() => {
    if (profileId) {
      fetchVariants();
    }
  }, [profileId]);

  const fetchVariants = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await api.get(`/third-party-profiles/${profileId}/variants`);

      if (response.data.success) {
        setProfile(response.data.profile);
        setVariants(response.data.variants);

        // Seleccionar variante por defecto si existe
        const defaultVariant = response.data.variants.find((v: ProfileVariant) => v.is_default);
        if (defaultVariant && !selectedVariant) {
          setSelectedVariant(defaultVariant);
          if (onVariantSelect) {
            onVariantSelect(defaultVariant._id);
          }
        }
      }
    } catch (error: any) {
      console.error('Error fetching variants:', error);
      setError('Error al cargar variantes');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateVariant = async () => {
    if (!formData.variant_name.trim()) {
      setError('El nombre de la variante es requerido');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await api.post(`/third-party-profiles/${profileId}/variants`, {
        ...formData,
        field_mappings: [],
        template_specific_fields: {}
      });

      if (response.data.success) {
        setShowCreateModal(false);
        setFormData({
          variant_name: '',
          variant_description: '',
          context_tags: [],
          is_default: false
        });
        await fetchVariants();
      }
    } catch (error: any) {
      console.error('Error creating variant:', error);
      setError(error.response?.data?.error || 'Error al crear variante');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateVariant = async () => {
    if (!editingVariant) return;

    setLoading(true);
    setError('');

    try {
      const response = await api.put(
        `/third-party-profiles/${profileId}/variants/${editingVariant._id}`,
        formData
      );

      if (response.data.success) {
        setShowEditModal(false);
        setEditingVariant(null);
        setFormData({
          variant_name: '',
          variant_description: '',
          context_tags: [],
          is_default: false
        });
        await fetchVariants();
      }
    } catch (error: any) {
      console.error('Error updating variant:', error);
      setError(error.response?.data?.error || 'Error al actualizar variante');
    } finally {
      setLoading(false);
    }
  };

  const handleSetDefault = async (variantId: string) => {
    setLoading(true);
    setError('');

    try {
      const response = await api.post(
        `/third-party-profiles/${profileId}/variants/${variantId}/set-default`
      );

      if (response.data.success) {
        await fetchVariants();
      }
    } catch (error: any) {
      console.error('Error setting default variant:', error);
      setError('Error al establecer variante predeterminada');
    } finally {
      setLoading(false);
    }
  };

  const handleCloneVariant = async (variantId: string) => {
    const variantName = prompt('Nombre para la variante clonada:');
    if (!variantName) return;

    setLoading(true);
    setError('');

    try {
      const response = await api.post(
        `/third-party-profiles/${profileId}/variants/${variantId}/clone`,
        { variant_name: variantName }
      );

      if (response.data.success) {
        await fetchVariants();
      }
    } catch (error: any) {
      console.error('Error cloning variant:', error);
      setError('Error al clonar variante');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteVariant = async (variantId: string) => {
    if (!confirm('¿Está seguro de eliminar esta variante?')) return;

    setLoading(true);
    setError('');

    try {
      const response = await api.delete(
        `/third-party-profiles/${profileId}/variants/${variantId}`
      );

      if (response.data.success) {
        await fetchVariants();
      }
    } catch (error: any) {
      console.error('Error deleting variant:', error);
      setError(error.response?.data?.error || 'Error al eliminar variante');
    } finally {
      setLoading(false);
    }
  };

  const openEditModal = (variant: ProfileVariant) => {
    setEditingVariant(variant);
    setFormData({
      variant_name: variant.variant_name,
      variant_description: variant.variant_description,
      context_tags: variant.context_tags,
      is_default: variant.is_default
    });
    setShowEditModal(true);
  };

  const handleVariantClick = (variant: ProfileVariant) => {
    setSelectedVariant(variant);
    if (onVariantSelect) {
      onVariantSelect(variant._id);
    }
  };

  const getCompletenessPercentage = (variant: ProfileVariant): number => {
    if (!variant.field_mappings || variant.field_mappings.length === 0) {
      return 0;
    }

    const filledFields = variant.field_mappings.filter(m => {
      const value = m.value;
      return value !== null && value !== undefined && value !== '';
    });

    return Math.round((filledFields.length / variant.field_mappings.length) * 100);
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

  return (
    <div className="profile-variant-manager">
      <div className="variant-header">
        <div className="variant-header-info">
          <h3>Variantes del Perfil</h3>
          {profile && (
            <p className="variant-subtitle">
              {profile.supplier.legal_name || profile.supplier.full_name} - {profile.template.name}
            </p>
          )}
        </div>

        {showCreateButton && (
          <button
            className="btn-create-variant"
            onClick={() => setShowCreateModal(true)}
            disabled={loading}
          >
            + Nueva Variante
          </button>
        )}
      </div>

      {error && <div className="error-alert">{error}</div>}

      {loading && variants.length === 0 && (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Cargando variantes...</p>
        </div>
      )}

      {!loading && variants.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">🔀</div>
          <h4>Sin variantes creadas</h4>
          <p>
            Las variantes permiten tener diferentes configuraciones del mismo tercero
            para distintos contextos (residencial, comercial, etc.)
          </p>
          {showCreateButton && (
            <button className="btn-primary" onClick={() => setShowCreateModal(true)}>
              Crear Primera Variante
            </button>
          )}
        </div>
      )}

      {variants.length > 0 && (
        <div className="variants-grid">
          {variants.map(variant => (
            <div
              key={variant._id}
              className={`variant-card ${selectedVariant?._id === variant._id ? 'selected' : ''} ${
                variant.is_default ? 'default' : ''
              }`}
              onClick={() => handleVariantClick(variant)}
            >
              <div className="variant-card-header">
                <div className="variant-title">
                  <h4>{variant.variant_name}</h4>
                  {variant.is_default && <span className="default-badge">Predeterminada</span>}
                </div>

                <div className="variant-actions" onClick={(e) => e.stopPropagation()}>
                  <button
                    className="btn-icon"
                    onClick={() => openEditModal(variant)}
                    title="Editar"
                  >
                    ✏️
                  </button>
                  <button
                    className="btn-icon"
                    onClick={() => handleCloneVariant(variant._id)}
                    title="Clonar"
                  >
                    📋
                  </button>
                  {!variant.is_default && (
                    <button
                      className="btn-icon"
                      onClick={() => handleSetDefault(variant._id)}
                      title="Establecer como predeterminada"
                    >
                      ⭐
                    </button>
                  )}
                  {variants.filter(v => v.active).length > 1 && (
                    <button
                      className="btn-icon btn-danger"
                      onClick={() => handleDeleteVariant(variant._id)}
                      title="Eliminar"
                    >
                      🗑️
                    </button>
                  )}
                </div>
              </div>

              {variant.variant_description && (
                <p className="variant-description">{variant.variant_description}</p>
              )}

              {variant.context_tags.length > 0 && (
                <div className="context-tags">
                  {variant.context_tags.map((tag, index) => (
                    <span key={index} className="context-tag">
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              <div className="variant-stats">
                <div className="stat-item">
                  <span className="stat-label">Completitud</span>
                  <span className="stat-value">{getCompletenessPercentage(variant)}%</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Campos</span>
                  <span className="stat-value">{variant.field_mappings.length}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Usos</span>
                  <span className="stat-value">{variant.usage_count}</span>
                </div>
              </div>

              <div className="variant-footer">
                <span className="created-date">Creada: {formatDate(variant.createdAt)}</span>
                {variant.last_used_at && (
                  <span className="last-used">Último uso: {formatDate(variant.last_used_at)}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Crear Variante */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Crear Nueva Variante</h3>
              <button className="close-button" onClick={() => setShowCreateModal(false)}>
                ✕
              </button>
            </div>

            <div className="modal-body">
              <div className="form-group">
                <label>Nombre de la variante *</label>
                <input
                  type="text"
                  className="form-control"
                  value={formData.variant_name}
                  onChange={(e) => setFormData({ ...formData, variant_name: e.target.value })}
                  placeholder="Ej: Contrato Residencial, Contrato Comercial"
                />
              </div>

              <div className="form-group">
                <label>Descripción</label>
                <textarea
                  className="form-control"
                  value={formData.variant_description}
                  onChange={(e) =>
                    setFormData({ ...formData, variant_description: e.target.value })
                  }
                  placeholder="Describe el contexto o escenario de uso"
                  rows={3}
                />
              </div>

              <div className="form-group">
                <label>Etiquetas de contexto (separadas por coma)</label>
                <input
                  type="text"
                  className="form-control"
                  value={formData.context_tags.join(', ')}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      context_tags: e.target.value.split(',').map(t => t.trim()).filter(t => t)
                    })
                  }
                  placeholder="residencial, comercial, corto_plazo"
                />
              </div>

              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={formData.is_default}
                    onChange={(e) =>
                      setFormData({ ...formData, is_default: e.target.checked })
                    }
                  />
                  Establecer como predeterminada
                </label>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowCreateModal(false)}>
                Cancelar
              </button>
              <button
                className="btn-primary"
                onClick={handleCreateVariant}
                disabled={loading || !formData.variant_name.trim()}
              >
                {loading ? 'Creando...' : 'Crear Variante'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Editar Variante */}
      {showEditModal && editingVariant && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Editar Variante</h3>
              <button className="close-button" onClick={() => setShowEditModal(false)}>
                ✕
              </button>
            </div>

            <div className="modal-body">
              <div className="form-group">
                <label>Nombre de la variante *</label>
                <input
                  type="text"
                  className="form-control"
                  value={formData.variant_name}
                  onChange={(e) => setFormData({ ...formData, variant_name: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Descripción</label>
                <textarea
                  className="form-control"
                  value={formData.variant_description}
                  onChange={(e) =>
                    setFormData({ ...formData, variant_description: e.target.value })
                  }
                  rows={3}
                />
              </div>

              <div className="form-group">
                <label>Etiquetas de contexto (separadas por coma)</label>
                <input
                  type="text"
                  className="form-control"
                  value={formData.context_tags.join(', ')}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      context_tags: e.target.value.split(',').map(t => t.trim()).filter(t => t)
                    })
                  }
                />
              </div>

              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={formData.is_default}
                    onChange={(e) =>
                      setFormData({ ...formData, is_default: e.target.checked })
                    }
                  />
                  Establecer como predeterminada
                </label>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowEditModal(false)}>
                Cancelar
              </button>
              <button
                className="btn-primary"
                onClick={handleUpdateVariant}
                disabled={loading || !formData.variant_name.trim()}
              >
                {loading ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfileVariantManager;
