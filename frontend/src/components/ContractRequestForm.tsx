import React, { useState, useEffect } from 'react';
import api from '../services/api';
import DynamicQuestionnaire from './DynamicQuestionnaire';
import './ContractRequestForm.css';

interface ContractCategory {
  _id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  questionnaire: any[];
  template?: {
    _id: string;
    name: string;
  };
}

const ContractRequestForm: React.FC = () => {
  const [categories, setCategories] = useState<ContractCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<ContractCategory | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const response = await api.get('/contract-categories');
      setCategories(response.data);
    } catch (error) {
      console.error('Error fetching categories:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCategorySelect = (category: ContractCategory) => {
    setSelectedCategory(category);
    setAnswers({});
    setErrors({});
    setTitle(`${category.name} - `);
  };

  const handleAnswerChange = (fieldName: string, value: any) => {
    setAnswers({ ...answers, [fieldName]: value });
    // Limpiar error del campo cuando el usuario escribe
    if (errors[fieldName]) {
      const newErrors = { ...errors };
      delete newErrors[fieldName];
      setErrors(newErrors);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!title || title.trim() === '') {
      newErrors.title = 'El título es requerido';
    }

    if (!selectedCategory) {
      return false;
    }

    // Validar cada pregunta del cuestionario
    selectedCategory.questionnaire.forEach((question) => {
      const answer = answers[question.field_name];

      if (question.required && (!answer || answer === '' || (Array.isArray(answer) && answer.length === 0))) {
        newErrors[question.field_name] = `${question.question} es obligatorio`;
      }

      // Validación de email
      if (answer && question.type === 'email' && !answer.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
        newErrors[question.field_name] = 'Email inválido';
      }

      // Validación de número
      if (answer && question.type === 'number') {
        if (question.validation?.min !== undefined && Number(answer) < question.validation.min) {
          newErrors[question.field_name] = `Debe ser mayor o igual a ${question.validation.min}`;
        }
        if (question.validation?.max !== undefined && Number(answer) > question.validation.max) {
          newErrors[question.field_name] = `Debe ser menor o igual a ${question.validation.max}`;
        }
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setSubmitting(true);

    try {
      const response = await api.post('/contract-requests-v2', {
        category_id: selectedCategory!._id,
        title: title.trim(),
        questionnaire_answers: answers,
        field_data: answers, // Para compatibilidad
        priority
      });

      alert('¡Solicitud enviada exitosamente! Un abogado la revisará pronto.');

      // Reiniciar formulario
      setSelectedCategory(null);
      setTitle('');
      setAnswers({});
      setPriority('medium');
      setErrors({});
    } catch (error: any) {
      console.error('Error submitting request:', error);
      alert(error.response?.data?.error || 'Error al enviar la solicitud');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBack = () => {
    setSelectedCategory(null);
    setAnswers({});
    setErrors({});
  };

  if (loading) {
    return <div className="loading">Cargando categorías...</div>;
  }

  return (
    <div className="contract-request-form">
      <div className="page-header">
        <h1>Solicitar Contrato</h1>
        <p className="subtitle">Selecciona el tipo de contrato y completa la información</p>
      </div>

      {!selectedCategory ? (
        // Vista de selección de categoría
        <div className="categories-selection">
          <h2>Selecciona el tipo de contrato</h2>

          {categories.length === 0 ? (
            <div className="empty-state">
              <h3>No hay categorías disponibles</h3>
              <p>Contacta a un administrador para crear categorías de contratos</p>
            </div>
          ) : (
            <div className="categories-grid">
              {categories.map((category) => (
                <div
                  key={category._id}
                  className="category-option"
                  style={{ borderColor: category.color }}
                  onClick={() => handleCategorySelect(category)}
                >
                  <div className="category-icon" style={{ backgroundColor: category.color + '20', color: category.color }}>
                    📋
                  </div>
                  <h3>{category.name}</h3>
                  <p>{category.description}</p>
                  <div className="category-info">
                    <span className="badge">{category.questionnaire.length} preguntas</span>
                    {category.template && (
                      <span className="badge badge-info">Plantilla: {category.template.name}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        // Vista de formulario
        <div className="request-form-container">
          <div className="form-header">
            <button className="btn-back" onClick={handleBack}>
              ← Cambiar categoría
            </button>
            <div className="selected-category">
              <div className="category-badge" style={{ backgroundColor: selectedCategory.color }}>
                {selectedCategory.name}
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="form-section">
              <h3>Información General</h3>

              <div className="form-group">
                <label>
                  Título de la Solicitud <span className="required">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    if (errors.title) {
                      const newErrors = { ...errors };
                      delete newErrors.title;
                      setErrors(newErrors);
                    }
                  }}
                  placeholder={`Ej: ${selectedCategory.name} - Nombre del Cliente`}
                  className={errors.title ? 'input-error' : ''}
                />
                {errors.title && <span className="error-message">{errors.title}</span>}
                <p className="help-text">Un título descriptivo para identificar esta solicitud</p>
              </div>

              <div className="form-group">
                <label>Prioridad</label>
                <select value={priority} onChange={(e) => setPriority(e.target.value as any)}>
                  <option value="low">Baja</option>
                  <option value="medium">Media</option>
                  <option value="high">Alta</option>
                  <option value="urgent">Urgente</option>
                </select>
                <p className="help-text">Indica la urgencia de esta solicitud</p>
              </div>
            </div>

            <div className="form-section">
              <h3>Información Específica del Contrato</h3>
              <p className="section-description">Completa la siguiente información para tu {selectedCategory.name}</p>

              <DynamicQuestionnaire
                questions={selectedCategory.questionnaire}
                answers={answers}
                onChange={handleAnswerChange}
                errors={errors}
              />
            </div>

            <div className="form-actions">
              <button type="button" className="btn-secondary" onClick={handleBack}>
                Cancelar
              </button>
              <button type="submit" className="btn-primary" disabled={submitting}>
                {submitting ? 'Enviando...' : 'Enviar Solicitud'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default ContractRequestForm;
