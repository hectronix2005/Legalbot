import React, { useState, useEffect } from 'react';
import api from '../services/api';
import './ContractCategoryManagement.css';

interface Question {
  question: string;
  field_name: string;
  type: 'text' | 'textarea' | 'number' | 'date' | 'select' | 'multiselect' | 'checkbox' | 'radio' | 'email' | 'phone';
  options?: string[];
  required: boolean;
  placeholder?: string;
  help_text?: string;
  order: number;
}

interface ContractCategory {
  _id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  questionnaire: Question[];
  template?: {
    _id: string;
    name: string;
  };
  requires_approval: boolean;
  auto_assign_lawyer: boolean;
  active: boolean;
  createdAt: string;
}

interface Template {
  _id: string;
  name: string;
}

const ContractCategoryManagement: React.FC = () => {
  const [categories, setCategories] = useState<ContractCategory[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ContractCategory | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    icon: 'document',
    color: '#3B82F6',
    template: '',
    requires_approval: true,
    auto_assign_lawyer: false
  });

  const [questionnaire, setQuestionnaire] = useState<Question[]>([]);

  useEffect(() => {
    fetchCategories();
    fetchTemplates();
  }, []);

  const fetchCategories = async () => {
    try {
      const selectedCompanyId = localStorage.getItem('selectedCompanyId');
      console.log('🔍 Fetching categories with companyId:', selectedCompanyId);
      
      const response = await api.get('/contract-categories');
      console.log('✅ Categories received:', response.data.length);
      setCategories(response.data);
      
      if (response.data.length === 0) {
        console.warn('⚠️  No se encontraron categorías. Verifica:');
        console.warn('   - selectedCompanyId en localStorage:', selectedCompanyId);
        console.warn('   - Que el usuario tenga acceso a la empresa');
      }
    } catch (error: any) {
      console.error('❌ Error fetching categories:', error);
      console.error('   Response:', error.response?.data);
      console.error('   Status:', error.response?.status);
      // Mostrar mensaje de error al usuario
      alert(error.response?.data?.error || 'Error al cargar las categorías');
    } finally {
      setLoading(false);
    }
  };

  const fetchTemplates = async () => {
    try {
      const response = await api.get('/templates');
      setTemplates(response.data);
    } catch (error) {
      console.error('Error fetching templates:', error);
    }
  };

  const handleCreateNew = () => {
    setEditingCategory(null);
    setFormData({
      name: '',
      description: '',
      icon: 'document',
      color: '#3B82F6',
      template: '',
      requires_approval: true,
      auto_assign_lawyer: false
    });
    setQuestionnaire([]);
    setShowModal(true);
  };

  const handleEdit = (category: ContractCategory) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      description: category.description,
      icon: category.icon,
      color: category.color,
      template: category.template?._id || '',
      requires_approval: category.requires_approval,
      auto_assign_lawyer: category.auto_assign_lawyer
    });
    setQuestionnaire([...category.questionnaire]);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const data = {
        ...formData,
        questionnaire: questionnaire.sort((a, b) => a.order - b.order)
      };

      if (editingCategory) {
        await api.put(`/contract-categories/${editingCategory._id}`, data);
      } else {
        await api.post('/contract-categories', data);
      }

      await fetchCategories();
      setShowModal(false);
    } catch (error: any) {
      console.error('Error saving category:', error);
      alert(error.response?.data?.error || 'Error al guardar la categoría');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('¿Está seguro de que desea desactivar esta categoría?')) {
      return;
    }

    try {
      await api.delete(`/contract-categories/${id}`);
      await fetchCategories();
    } catch (error) {
      console.error('Error deleting category:', error);
      alert('Error al eliminar la categoría');
    }
  };

  const addQuestion = () => {
    const newQuestion: Question = {
      question: '',
      field_name: '',
      type: 'text',
      required: true,
      order: questionnaire.length + 1
    };
    setQuestionnaire([...questionnaire, newQuestion]);
  };

  const updateQuestion = (index: number, field: keyof Question, value: any) => {
    const updated = [...questionnaire];
    updated[index] = { ...updated[index], [field]: value };
    setQuestionnaire(updated);
  };

  const removeQuestion = (index: number) => {
    setQuestionnaire(questionnaire.filter((_, i) => i !== index));
  };

  const moveQuestion = (index: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === questionnaire.length - 1)
    ) {
      return;
    }

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    const updated = [...questionnaire];
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];

    // Actualizar orden
    updated.forEach((q, i) => {
      q.order = i + 1;
    });

    setQuestionnaire(updated);
  };

  if (loading) {
    return <div className="loading">Cargando categorías...</div>;
  }

  return (
    <div className="category-management">
      <div className="page-header">
        <h1>Gestión de Categorías de Contratos</h1>
        <button className="btn-primary" onClick={handleCreateNew}>
          Nueva Categoría
        </button>
      </div>

      <div className="categories-grid">
        {categories.length === 0 ? (
          <div className="empty-state">
            <h3>No hay categorías</h3>
            <p>Crea la primera categoría para comenzar</p>
          </div>
        ) : (
          categories.map((category) => (
            <div key={category._id} className="category-card" style={{ borderLeftColor: category.color }}>
              <div className="category-header">
                <div className="category-icon" style={{ backgroundColor: category.color + '20', color: category.color }}>
                  📋
                </div>
                <h3>{category.name}</h3>
              </div>

              <p className="category-description">{category.description}</p>

              <div className="category-meta">
                <span className="badge">
                  {category.questionnaire.length} preguntas
                </span>
                {category.requires_approval && (
                  <span className="badge badge-warning">Requiere aprobación</span>
                )}
                {category.template && (
                  <span className="badge badge-info">{category.template.name}</span>
                )}
              </div>

              <div className="category-actions">
                <button className="btn-secondary" onClick={() => handleEdit(category)}>
                  Editar
                </button>
                <button className="btn-danger" onClick={() => handleDelete(category._id)}>
                  Desactivar
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal de creación/edición */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal modal-large">
            <h3>{editingCategory ? 'Editar Categoría' : 'Nueva Categoría'}</h3>

            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label>Nombre de la Categoría *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    placeholder="Ej: Contrato Laboral, NDA, Contrato Comercial"
                  />
                </div>

                <div className="form-group">
                  <label>Color</label>
                  <input
                    type="color"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Descripción *</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  required
                  rows={3}
                  placeholder="Describe el tipo de contratos de esta categoría"
                />
              </div>

              <div className="form-group">
                <label>Plantilla Asociada</label>
                <select
                  value={formData.template}
                  onChange={(e) => setFormData({ ...formData, template: e.target.value })}
                >
                  <option value="">Seleccionar plantilla...</option>
                  {templates.map((template) => (
                    <option key={template._id} value={template._id}>
                      {template.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-row">
                <div className="form-group checkbox-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={formData.requires_approval}
                      onChange={(e) => setFormData({ ...formData, requires_approval: e.target.checked })}
                    />
                    Requiere aprobación de abogado
                  </label>
                </div>

                <div className="form-group checkbox-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={formData.auto_assign_lawyer}
                      onChange={(e) => setFormData({ ...formData, auto_assign_lawyer: e.target.checked })}
                    />
                    Auto-asignar abogado disponible
                  </label>
                </div>
              </div>

              <hr />

              <div className="questionnaire-section">
                <div className="section-header">
                  <h4>Cuestionario</h4>
                  <button type="button" className="btn-secondary btn-sm" onClick={addQuestion}>
                    + Agregar Pregunta
                  </button>
                </div>

                {questionnaire.map((question, index) => (
                  <div key={index} className="question-editor">
                    <div className="question-header">
                      <span className="question-number">Pregunta {index + 1}</span>
                      <div className="question-controls">
                        <button
                          type="button"
                          onClick={() => moveQuestion(index, 'up')}
                          disabled={index === 0}
                          className="btn-icon"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          onClick={() => moveQuestion(index, 'down')}
                          disabled={index === questionnaire.length - 1}
                          className="btn-icon"
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          onClick={() => removeQuestion(index)}
                          className="btn-icon btn-danger"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>

                    <div className="form-row">
                      <div className="form-group flex-2">
                        <label>Pregunta</label>
                        <input
                          type="text"
                          value={question.question}
                          onChange={(e) => updateQuestion(index, 'question', e.target.value)}
                          placeholder="¿Cuál es...?"
                        />
                      </div>

                      <div className="form-group flex-1">
                        <label>Nombre del campo</label>
                        <input
                          type="text"
                          value={question.field_name}
                          onChange={(e) => updateQuestion(index, 'field_name', e.target.value)}
                          placeholder="nombre_campo"
                        />
                      </div>
                    </div>

                    <div className="form-row">
                      <div className="form-group">
                        <label>Tipo de campo</label>
                        <select
                          value={question.type}
                          onChange={(e) => updateQuestion(index, 'type', e.target.value)}
                        >
                          <option value="text">Texto</option>
                          <option value="textarea">Texto largo</option>
                          <option value="number">Número</option>
                          <option value="date">Fecha</option>
                          <option value="email">Email</option>
                          <option value="phone">Teléfono</option>
                          <option value="select">Selección única</option>
                          <option value="multiselect">Selección múltiple</option>
                          <option value="radio">Radio buttons</option>
                          <option value="checkbox">Checkbox</option>
                        </select>
                      </div>

                      <div className="form-group checkbox-group">
                        <label>
                          <input
                            type="checkbox"
                            checked={question.required}
                            onChange={(e) => updateQuestion(index, 'required', e.target.checked)}
                          />
                          Campo obligatorio
                        </label>
                      </div>
                    </div>

                    {['select', 'multiselect', 'radio'].includes(question.type) && (
                      <div className="form-group">
                        <label>Opciones (una por línea)</label>
                        <textarea
                          value={(question.options || []).join('\n')}
                          onChange={(e) => updateQuestion(index, 'options', e.target.value.split('\n').filter(o => o.trim()))}
                          rows={3}
                          placeholder="Opción 1&#10;Opción 2&#10;Opción 3"
                        />
                      </div>
                    )}

                    <div className="form-group">
                      <label>Texto de ayuda (opcional)</label>
                      <input
                        type="text"
                        value={question.help_text || ''}
                        onChange={(e) => updateQuestion(index, 'help_text', e.target.value)}
                        placeholder="Información adicional para el usuario"
                      />
                    </div>
                  </div>
                ))}

                {questionnaire.length === 0 && (
                  <div className="empty-questionnaire">
                    <p>No hay preguntas en el cuestionario</p>
                    <p className="text-muted">Haz clic en "Agregar Pregunta" para comenzar</p>
                  </div>
                )}
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn-primary">
                  {editingCategory ? 'Actualizar' : 'Crear'} Categoría
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContractCategoryManagement;
