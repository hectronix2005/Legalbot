/**
 * Componente para Fusionar Campos Duplicados de Terceros
 * Permite identificar y fusionar campos con nombres similares o duplicados
 */

import React, { useState, useEffect } from 'react';
import api from '../services/api';
import './FieldMerger.css';

interface FieldToMerge {
  name: string;
  value: any;
  normalizedName: string;
  suggestion?: string;
}

interface MergeGroup {
  normalizedName: string;
  suggestedName: string;
  fields: FieldToMerge[];
  selectedValue: any;
  selectedField: string;
}

interface Props {
  supplierId: string;
  customFields: Record<string, any>;
  thirdPartyTypeId?: string;
  onMergeComplete?: () => void;
}

const FieldMerger: React.FC<Props> = ({ supplierId, customFields, thirdPartyTypeId, onMergeComplete }) => {
  const [mergeGroups, setMergeGroups] = useState<MergeGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [merging, setMerging] = useState(false);
  const [bulkMerging, setBulkMerging] = useState(false);
  const [showDialog, setShowDialog] = useState(false);

  useEffect(() => {
    analyzeDuplicates();
  }, [customFields]);

  const analyzeDuplicates = () => {
    if (!customFields || Object.keys(customFields).length === 0) {
      setMergeGroups([]);
      return;
    }

    // Agrupar campos por nombre normalizado
    const grouped: Record<string, FieldToMerge[]> = {};

    Object.entries(customFields).forEach(([name, value]) => {
      const normalized = normalizeFieldName(name);

      if (!grouped[normalized]) {
        grouped[normalized] = [];
      }

      grouped[normalized].push({
        name,
        value,
        normalizedName: normalized,
        suggestion: getSuggestedName(normalized)
      });
    });

    // Filtrar solo grupos con más de 1 campo (duplicados)
    const duplicateGroups: MergeGroup[] = Object.entries(grouped)
      .filter(([_, fields]) => fields.length > 1)
      .map(([normalizedName, fields]) => {
        // Seleccionar el valor no vacío por defecto
        const nonEmptyField = fields.find(f => f.value && f.value !== '');
        const defaultField = nonEmptyField || fields[0];

        return {
          normalizedName,
          suggestedName: fields[0].suggestion || normalizedName,
          fields,
          selectedValue: defaultField.value,
          selectedField: defaultField.name
        };
      });

    setMergeGroups(duplicateGroups);
  };

  const normalizeFieldName = (name: string): string => {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
  };

  const getSuggestedName = (normalized: string): string => {
    // Mapeo de nombres normalizados a nombres sugeridos
    const suggestions: Record<string, string> = {
      'cedula_rep_legal': 'cedula_representante_legal',
      'cedula_representante': 'cedula_representante_legal',
      'tel': 'telefono',
      'phone': 'telefono',
      'mail': 'email',
      'correo': 'email',
      'dir': 'direccion',
      'address': 'direccion',
      'razon_social': 'legal_name',
      'nombre_empresa': 'legal_name'
    };

    return suggestions[normalized] || normalized;
  };

  const handleSelectField = (groupIndex: number, fieldName: string, value: any) => {
    const newGroups = [...mergeGroups];
    newGroups[groupIndex].selectedField = fieldName;
    newGroups[groupIndex].selectedValue = value;
    setMergeGroups(newGroups);
  };

  const handleMerge = async (groupIndex: number) => {
    const group = mergeGroups[groupIndex];

    try {
      setMerging(true);

      console.log('🔄 Merging fields:', {
        group: group.normalizedName,
        fields: group.fields.map(f => f.name),
        selectedField: group.selectedField,
        selectedValue: group.selectedValue,
        suggestedName: group.suggestedName
      });

      await api.post(`/field-management/supplier/${supplierId}/merge-fields`, {
        fieldsToMerge: group.fields.map(f => f.name),
        targetFieldName: group.suggestedName,
        targetValue: group.selectedValue,
        removeOriginals: true
      });

      console.log('✅ Fields merged successfully');

      // Remover el grupo fusionado
      const newGroups = mergeGroups.filter((_, i) => i !== groupIndex);
      setMergeGroups(newGroups);

      if (onMergeComplete) onMergeComplete();

      alert(`Campos fusionados exitosamente en: ${group.suggestedName}`);
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || err.message || 'Error al fusionar campos';
      console.error('❌ Error merging fields:', err);
      alert(`Error: ${errorMsg}`);
    } finally {
      setMerging(false);
    }
  };

  const handleMergeAll = async () => {
    if (mergeGroups.length === 0) return;

    if (!window.confirm(`¿Fusionar ${mergeGroups.length} grupo(s) de campos duplicados?`)) {
      return;
    }

    try {
      setMerging(true);

      for (let i = 0; i < mergeGroups.length; i++) {
        const group = mergeGroups[i];

        await api.post(`/field-management/supplier/${supplierId}/merge-fields`, {
          fieldsToMerge: group.fields.map(f => f.name),
          targetFieldName: group.suggestedName,
          targetValue: group.selectedValue,
          removeOriginals: true
        });
      }

      setMergeGroups([]);
      if (onMergeComplete) onMergeComplete();

      alert('Todos los campos han sido fusionados exitosamente');
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || err.message || 'Error al fusionar campos';
      console.error('❌ Error merging all fields:', err);
      alert(`Error: ${errorMsg}`);
    } finally {
      setMerging(false);
    }
  };

  const handleBulkMerge = async (groupIndex: number) => {
    const group = mergeGroups[groupIndex];

    if (!thirdPartyTypeId) {
      alert('No se puede determinar el tipo de tercero para la fusión masiva');
      return;
    }

    const confirmMsg = `¿Aplicar esta fusión a TODOS los terceros del mismo tipo?\n\nCampos: ${group.fields.map(f => f.name).join(', ')}\nFusionar en: ${group.suggestedName}\n\nEsto afectará a todos los terceros de este tipo en la empresa.`;

    if (!window.confirm(confirmMsg)) return;

    try {
      setBulkMerging(true);

      console.log('🚀 Iniciando fusión masiva:', {
        thirdPartyTypeId,
        fieldsToMerge: group.fields.map(f => f.name),
        targetFieldName: group.suggestedName
      });

      const response = await api.post('/field-management/merge-fields-bulk', {
        thirdPartyTypeId,
        fieldsToMerge: group.fields.map(f => f.name),
        targetFieldName: group.suggestedName
      });

      console.log('✅ Fusión masiva completada:', response.data);

      // Mostrar resultado detallado
      const results = response.data.results;
      const alertMsg = `✅ Fusión masiva completada exitosamente\n\n` +
        `📊 Resultados:\n` +
        `• Total de terceros: ${results.total}\n` +
        `• Terceros actualizados: ${results.merged}\n` +
        `• Terceros sin cambios: ${results.skipped}\n\n` +
        `Los campos duplicados han sido fusionados en: ${group.suggestedName}`;

      alert(alertMsg);

      // Remover el grupo fusionado
      const newGroups = mergeGroups.filter((_, i) => i !== groupIndex);
      setMergeGroups(newGroups);

      if (onMergeComplete) onMergeComplete();
    } catch (err: any) {
      console.error('❌ Error en fusión masiva:', err);
      const errorMsg = err.response?.data?.error || err.message || 'Error al realizar fusión masiva';
      alert(`Error: ${errorMsg}`);
    } finally {
      setBulkMerging(false);
    }
  };

  if (mergeGroups.length === 0) {
    return null;
  }

  return (
    <>
      <div className="field-merger-summary">
        <div className="merger-header">
          <div className="merger-info">
            <span className="merger-icon">🔄</span>
            <span className="merger-text">
              {mergeGroups.length} grupo(s) de campos duplicados detectados
            </span>
          </div>
          <button
            className="btn-show-merger"
            onClick={() => setShowDialog(true)}
          >
            Ver y Fusionar
          </button>
        </div>
      </div>

      {showDialog && (
        <div className="merger-dialog-overlay" onClick={() => setShowDialog(false)}>
          <div className="merger-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="merger-dialog-header">
              <h3>Fusionar Campos Duplicados</h3>
              <button className="merger-dialog-close" onClick={() => setShowDialog(false)}>×</button>
            </div>

            <div className="merger-dialog-content">
              <div className="merger-alert">
                <strong>⚠️ Campos duplicados detectados</strong>
                <p>
                  Se encontraron campos con nombres similares o duplicados.
                  Puedes fusionarlos para mantener tu información organizada.
                </p>
              </div>

              {mergeGroups.map((group, groupIndex) => (
                <div key={groupIndex} className="merge-group-card">
                  <div className="merge-group-header">
                    <h4>Grupo: {group.normalizedName}</h4>
                    <span className="merge-group-count">{group.fields.length} campos</span>
                  </div>

                  <div className="merge-suggestion">
                    <strong>Nombre sugerido:</strong> <code>{group.suggestedName}</code>
                  </div>

                  <div className="merge-fields-list">
                    {group.fields.map((field, fieldIndex) => (
                      <div
                        key={fieldIndex}
                        className={`merge-field-item ${group.selectedField === field.name ? 'selected' : ''}`}
                        onClick={() => handleSelectField(groupIndex, field.name, field.value)}
                      >
                        <div className="merge-field-radio">
                          <input
                            type="radio"
                            name={`group-${groupIndex}`}
                            checked={group.selectedField === field.name}
                            onChange={() => handleSelectField(groupIndex, field.name, field.value)}
                          />
                        </div>
                        <div className="merge-field-info">
                          <div className="merge-field-name">
                            <code>{field.name}</code>
                            {!field.value || field.value === '' ? (
                              <span className="merge-field-badge empty">Vacío</span>
                            ) : null}
                          </div>
                          <div className="merge-field-value">
                            <strong>Valor:</strong> {field.value || <em className="empty-value">(vacío)</em>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="merge-group-actions">
                    <button
                      className="btn-merge"
                      onClick={() => handleMerge(groupIndex)}
                      disabled={merging || bulkMerging}
                    >
                      {merging ? 'Fusionando...' : 'Fusionar Este Tercero'}
                    </button>

                    {thirdPartyTypeId && (
                      <button
                        className="btn-merge-bulk"
                        onClick={() => handleBulkMerge(groupIndex)}
                        disabled={merging || bulkMerging}
                        title="Aplicar esta fusión a todos los terceros del mismo tipo"
                      >
                        {bulkMerging ? 'Aplicando a todos...' : '⚡ Fusionar Todos del Mismo Tipo'}
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {mergeGroups.length > 1 && (
                <div className="merger-bulk-actions">
                  <button
                    className="btn-merge-all"
                    onClick={handleMergeAll}
                    disabled={merging}
                  >
                    {merging ? 'Fusionando...' : `Fusionar Todos (${mergeGroups.length} grupos)`}
                  </button>
                </div>
              )}
            </div>

            <div className="merger-dialog-footer">
              <p>
                <strong>Nota:</strong> La fusión eliminará los campos originales y creará un nuevo campo
                con el nombre sugerido y el valor seleccionado.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default FieldMerger;
