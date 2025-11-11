import React from 'react';
import './DynamicQuestionnaire.css';

interface Question {
  question: string;
  field_name: string;
  type: 'text' | 'textarea' | 'number' | 'date' | 'select' | 'multiselect' | 'checkbox' | 'radio' | 'email' | 'phone';
  options?: string[];
  required: boolean;
  placeholder?: string;
  help_text?: string;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
  };
}

interface DynamicQuestionnaireProps {
  questions: Question[];
  answers: Record<string, any>;
  onChange: (fieldName: string, value: any) => void;
  errors?: Record<string, string>;
  disabled?: boolean;
}

const DynamicQuestionnaire: React.FC<DynamicQuestionnaireProps> = ({
  questions,
  answers,
  onChange,
  errors = {},
  disabled = false
}) => {
  const renderField = (question: Question) => {
    const value = answers[question.field_name] || '';
    const error = errors[question.field_name];
    const commonProps = {
      disabled,
      required: question.required,
      placeholder: question.placeholder || ''
    };

    switch (question.type) {
      case 'text':
      case 'email':
      case 'phone':
        return (
          <input
            type={question.type}
            value={value}
            onChange={(e) => onChange(question.field_name, e.target.value)}
            {...commonProps}
            className={error ? 'input-error' : ''}
          />
        );

      case 'textarea':
        return (
          <textarea
            value={value}
            onChange={(e) => onChange(question.field_name, e.target.value)}
            rows={4}
            {...commonProps}
            className={error ? 'input-error' : ''}
          />
        );

      case 'number':
        return (
          <input
            type="number"
            value={value}
            onChange={(e) => {
              const val = e.target.value;
              // Para números enteros, usar parseInt para evitar problemas de precisión
              onChange(question.field_name, val ? parseInt(val, 10) : '');
            }}
            min={question.validation?.min}
            max={question.validation?.max}
            step="1"
            {...commonProps}
            className={error ? 'input-error' : ''}
          />
        );

      case 'date':
        return (
          <input
            type="date"
            value={value}
            onChange={(e) => onChange(question.field_name, e.target.value)}
            {...commonProps}
            className={error ? 'input-error' : ''}
          />
        );

      case 'select':
        return (
          <select
            value={value}
            onChange={(e) => onChange(question.field_name, e.target.value)}
            disabled={disabled}
            required={question.required}
            className={error ? 'input-error' : ''}
          >
            <option value="">Seleccionar...</option>
            {question.options?.map((option, idx) => (
              <option key={idx} value={option}>
                {option}
              </option>
            ))}
          </select>
        );

      case 'multiselect':
        return (
          <div className="multiselect">
            {question.options?.map((option, idx) => (
              <label key={idx} className="checkbox-label">
                <input
                  type="checkbox"
                  checked={Array.isArray(value) && value.includes(option)}
                  onChange={(e) => {
                    const currentValues = Array.isArray(value) ? [...value] : [];
                    if (e.target.checked) {
                      onChange(question.field_name, [...currentValues, option]);
                    } else {
                      onChange(
                        question.field_name,
                        currentValues.filter((v) => v !== option)
                      );
                    }
                  }}
                  disabled={disabled}
                />
                <span>{option}</span>
              </label>
            ))}
          </div>
        );

      case 'radio':
        return (
          <div className="radio-group">
            {question.options?.map((option, idx) => (
              <label key={idx} className="radio-label">
                <input
                  type="radio"
                  name={question.field_name}
                  value={option}
                  checked={value === option}
                  onChange={(e) => onChange(question.field_name, e.target.value)}
                  disabled={disabled}
                  required={question.required}
                />
                <span>{option}</span>
              </label>
            ))}
          </div>
        );

      case 'checkbox':
        return (
          <label className="checkbox-label single">
            <input
              type="checkbox"
              checked={!!value}
              onChange={(e) => onChange(question.field_name, e.target.checked)}
              disabled={disabled}
              required={question.required}
            />
            <span>{question.placeholder || 'Acepto'}</span>
          </label>
        );

      default:
        return <input type="text" value={value} disabled />;
    }
  };

  return (
    <div className="dynamic-questionnaire">
      {questions.map((question, index) => (
        <div key={question.field_name} className="question-group">
          <label className="question-label">
            {question.question}
            {question.required && <span className="required">*</span>}
          </label>

          {question.help_text && (
            <p className="help-text">{question.help_text}</p>
          )}

          {renderField(question)}

          {errors[question.field_name] && (
            <span className="error-message">{errors[question.field_name]}</span>
          )}
        </div>
      ))}
    </div>
  );
};

export default DynamicQuestionnaire;
