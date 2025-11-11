import React, { useState, useEffect } from 'react';
import api from '../services/api';
import SimpleWordTemplateUpload from './SimpleWordTemplateUpload';
import WordTemplateUploadWithFormat from './WordTemplateUploadWithFormat';
import WordContractGenerator from './WordContractGenerator';
import TemplateVariablesView from './TemplateVariablesView';
import './Templates.css';

interface Template {
  id: string;
  _id: string;
  name: string;
  type: string;
  description: string;
  content: string;
  createdAt: string;
}

const Templates: React.FC = () => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showWordUpload, setShowWordUpload] = useState(false);
  const [showWordUploadWithFormat, setShowWordUploadWithFormat] = useState(false);
  const [showWordGenerator, setShowWordGenerator] = useState(false);
  const [newTemplate, setNewTemplate] = useState({
    name: '',
    type: '',
    description: '',
    content: ''
  });
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showUseModal, setShowUseModal] = useState(false);
  const [showVariablesModal, setShowVariablesModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [editTemplate, setEditTemplate] = useState({
    name: '',
    type: '',
    description: '',
    content: ''
  });

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const response = await api.get('/templates');
      setTemplates(response.data);
    } catch (error) {
      console.error('Error fetching templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTemplate = async () => {
    try {
      await api.post('/templates', newTemplate);
      await fetchTemplates();
      setShowCreateModal(false);
      setNewTemplate({
        name: '',
        type: '',
        description: '',
        content: ''
      });
    } catch (error) {
      console.error('Error creating template:', error);
    }
  };

  const handleViewTemplate = (template: Template) => {
    setSelectedTemplate(template);
    setShowViewModal(true);
  };

  // Función para resaltar variables en el contenido HTML
  const highlightVariables = (content: string) => {
    if (!content) return '<p>Sin contenido</p>';
    
    // Buscar y resaltar variables {{variable}}
    const highlightedContent = content.replace(/\{\{([^}]+)\}\}/g, '<span class="variable">{{$1}}</span>');
    
    return highlightedContent;
  };

  const handleEditTemplate = (template: Template) => {
    setSelectedTemplate(template);
    setEditTemplate({
      name: template.name,
      type: template.type,
      description: template.description,
      content: template.content || ''
    });
    setShowEditModal(true);
  };

  const handleUpdateTemplate = async () => {
    if (!selectedTemplate) return;
    
    try {
      await api.put(`/templates/${selectedTemplate.id}`, editTemplate);
      await fetchTemplates();
      setShowEditModal(false);
      setSelectedTemplate(null);
    } catch (error) {
      console.error('Error updating template:', error);
    }
  };

  const handleUseTemplate = (template: Template) => {
    setSelectedTemplate(template);
    setShowUseModal(true);
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (!window.confirm('¿Estás seguro de que quieres eliminar esta plantilla?')) return;
    
    try {
      await api.delete(`/templates/${templateId}`);
      await fetchTemplates();
    } catch (error) {
      console.error('Error deleting template:', error);
    }
  };

  const handleViewVariables = (template: Template) => {
    setSelectedTemplate(template);
    setShowVariablesModal(true);
  };

  if (loading) {
    return <div className="loading">Cargando plantillas...</div>;
  }

  return (
    <div className="templates">
      <div className="page-header">
        <h1>Plantillas de Contratos</h1>
        <div className="header-actions">
          <button className="btn-secondary" onClick={() => setShowWordUpload(true)}>
            Subir desde Word
          </button>
          <button className="btn-secondary" onClick={() => setShowWordUploadWithFormat(true)}>
            Subir Word (Con Formato)
          </button>
          <button className="btn-secondary" onClick={() => setShowWordGenerator(true)}>
            Generar Contrato
          </button>
          <button 
            className="btn-primary"
            onClick={() => setShowCreateModal(true)}
          >
            Nueva Plantilla
          </button>
        </div>
      </div>

      <div className="templates-list">
        {templates.length === 0 ? (
          <div className="empty-state">
            <h3>No hay plantillas</h3>
            <p>Crea tu primera plantilla para comenzar</p>
          </div>
        ) : (
          templates.map((template) => (
            <div key={template._id || template.id} className="template-card">
              <h3>{template.name}</h3>
              <p><strong>Tipo:</strong> {template.type}</p>
              <p><strong>Descripción:</strong> {template.description}</p>
              <p><strong>Creado:</strong> {new Date(template.createdAt).toLocaleDateString()}</p>
              <div className="template-actions">
                <button 
                  className="btn-secondary"
                  onClick={() => handleViewTemplate(template)}
                >
                  Ver
                </button>
                <button 
                  className="btn-secondary"
                  onClick={() => handleEditTemplate(template)}
                >
                  Editar
                </button>
                <button 
                  className="btn-info"
                  onClick={() => handleViewVariables(template)}
                >
                  Variables
                </button>
                <button 
                  className="btn-primary"
                  onClick={() => handleUseTemplate(template)}
                >
                  Usar
                </button>
                <button 
                  className="btn-danger"
                  onClick={() => handleDeleteTemplate(template._id || template.id)}
                >
                  Eliminar
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal para crear plantilla */}
      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Crear Nueva Plantilla</h3>
            
            <div className="form-group">
              <label>Nombre de la Plantilla:</label>
              <input 
                type="text"
                value={newTemplate.name}
                onChange={(e) => setNewTemplate({...newTemplate, name: e.target.value})}
                required
              />
            </div>
            
            <div className="form-group">
              <label>Tipo:</label>
              <select 
                value={newTemplate.type}
                onChange={(e) => setNewTemplate({...newTemplate, type: e.target.value})}
                required
              >
                <option value="">Seleccionar tipo</option>
                <option value="contrato">Contrato</option>
                <option value="acuerdo">Acuerdo</option>
                <option value="convenio">Convenio</option>
                <option value="otro">Otro</option>
              </select>
            </div>
            
            <div className="form-group">
              <label>Descripción:</label>
              <textarea 
                value={newTemplate.description}
                onChange={(e) => setNewTemplate({...newTemplate, description: e.target.value})}
                rows={3}
                required
              />
            </div>
            
            <div className="form-group">
              <label>Contenido de la Plantilla:</label>
              <textarea 
                value={newTemplate.content}
                onChange={(e) => setNewTemplate({...newTemplate, content: e.target.value})}
                rows={10}
                placeholder="Escribe el contenido de la plantilla aquí..."
                required
              />
            </div>
            
            <div className="modal-actions">
              <button 
                className="btn-secondary"
                onClick={() => setShowCreateModal(false)}
              >
                Cancelar
              </button>
              <button 
                className="btn-primary"
                onClick={handleCreateTemplate}
                disabled={!newTemplate.name || !newTemplate.type || !newTemplate.content}
              >
                Crear Plantilla
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para ver plantilla */}
      {showViewModal && selectedTemplate && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Ver Plantilla: {selectedTemplate.name}</h3>
            
            <div className="form-group">
              <label>Nombre:</label>
              <p>{selectedTemplate.name}</p>
            </div>
            
            <div className="form-group">
              <label>Tipo:</label>
              <p>{selectedTemplate.type}</p>
            </div>
            
            <div className="form-group">
              <label>Descripción:</label>
              <p>{selectedTemplate.description}</p>
            </div>
            
            <div className="form-group">
              <label>Contenido:</label>
              <div 
                className="template-content-preview"
                style={{ 
                  border: '1px solid #ddd', 
                  padding: '1rem', 
                  borderRadius: '4px', 
                  backgroundColor: '#f9f9f9',
                  maxHeight: '400px',
                  overflowY: 'auto',
                  fontFamily: 'Times New Roman, serif',
                  lineHeight: '1.6',
                  color: '#333'
                }}
                dangerouslySetInnerHTML={{ 
                  __html: highlightVariables(selectedTemplate.content || '') 
                }}
              />
            </div>
            
            <div className="modal-actions">
              <button 
                className="btn-secondary"
                onClick={() => setShowViewModal(false)}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para editar plantilla */}
      {showEditModal && selectedTemplate && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Editar Plantilla: {selectedTemplate.name}</h3>
            
            <div className="form-group">
              <label>Nombre de la Plantilla:</label>
              <input 
                type="text"
                value={editTemplate.name}
                onChange={(e) => setEditTemplate({...editTemplate, name: e.target.value})}
                required
              />
            </div>
            
            <div className="form-group">
              <label>Tipo:</label>
              <select 
                value={editTemplate.type}
                onChange={(e) => setEditTemplate({...editTemplate, type: e.target.value})}
                required
              >
                <option value="">Seleccionar tipo</option>
                <option value="contrato">Contrato</option>
                <option value="acuerdo">Acuerdo</option>
                <option value="convenio">Convenio</option>
                <option value="otro">Otro</option>
              </select>
            </div>
            
            <div className="form-group">
              <label>Descripción:</label>
              <textarea 
                value={editTemplate.description}
                onChange={(e) => setEditTemplate({...editTemplate, description: e.target.value})}
                rows={3}
                required
              />
            </div>
            
            <div className="form-group">
              <label>Contenido de la Plantilla:</label>
              <textarea 
                value={editTemplate.content}
                onChange={(e) => setEditTemplate({...editTemplate, content: e.target.value})}
                rows={10}
                placeholder="Escribe el contenido de la plantilla aquí..."
                required
              />
            </div>
            
            <div className="modal-actions">
              <button 
                className="btn-secondary"
                onClick={() => setShowEditModal(false)}
              >
                Cancelar
              </button>
              <button 
                className="btn-primary"
                onClick={handleUpdateTemplate}
                disabled={!editTemplate.name || !editTemplate.type || !editTemplate.content}
              >
                Actualizar Plantilla
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para usar plantilla */}
      {showUseModal && selectedTemplate && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Usar Plantilla: {selectedTemplate.name}</h3>
            
            <div className="form-group">
              <label>Plantilla seleccionada:</label>
              <p><strong>{selectedTemplate.name}</strong> - {selectedTemplate.type}</p>
              <p>{selectedTemplate.description}</p>
            </div>
            
            <div className="form-group">
              <label>¿Qué quieres hacer con esta plantilla?</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <button 
                  className="btn-primary"
                  onClick={() => {
                    // Aquí podrías navegar a una página de creación de contrato
                    alert('Funcionalidad de crear contrato desde plantilla - En desarrollo');
                    setShowUseModal(false);
                  }}
                >
                  Crear Contrato
                </button>
                <button 
                  className="btn-secondary"
                  onClick={() => {
                    // Descargar plantilla
                    const blob = new Blob([selectedTemplate.content || ''], { type: 'text/plain' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${selectedTemplate.name}.txt`;
                    a.click();
                    URL.revokeObjectURL(url);
                    setShowUseModal(false);
                  }}
                >
                  Descargar Plantilla
                </button>
              </div>
            </div>
            
            <div className="modal-actions">
              <button 
                className="btn-secondary"
                onClick={() => setShowUseModal(false)}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para subir plantilla desde Word */}
      {showWordUpload && (
        <div className="modal-overlay">
          <div className="modal large-modal">
            <div className="modal-header">
              <h3>Subir Plantilla desde Word</h3>
              <button 
                className="btn-close"
                onClick={() => setShowWordUpload(false)}
              >
                ×
              </button>
            </div>
            <div className="modal-content">
              <SimpleWordTemplateUpload 
                onTemplateCreated={(templateId) => {
                  setShowWordUpload(false);
                  fetchTemplates();
                }}
              />
            </div>
          </div>
        </div>
      )}

      {showWordUploadWithFormat && (
        <div className="modal-overlay">
          <div className="modal large-modal">
            <div className="modal-header">
              <h3>Subir Plantilla desde Word (Con Formato Preservado)</h3>
              <button 
                className="btn-close"
                onClick={() => setShowWordUploadWithFormat(false)}
              >
                ×
              </button>
            </div>
            <div className="modal-content">
              <WordTemplateUploadWithFormat 
                onTemplateCreated={(template) => {
                  setShowWordUploadWithFormat(false);
                  fetchTemplates();
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Modal para generar contrato desde Word */}
      {showWordGenerator && (
        <div className="modal-overlay">
          <div className="modal large-modal">
            <div className="modal-header">
              <h3>Generar Contrato desde Word</h3>
              <button 
                className="btn-close"
                onClick={() => setShowWordGenerator(false)}
              >
                ×
              </button>
            </div>
            <div className="modal-content">
              <WordContractGenerator 
                onContractGenerated={(contractId) => {
                  setShowWordGenerator(false);
                  alert('Contrato generado exitosamente');
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Modal para ver variables de plantilla */}
      {showVariablesModal && selectedTemplate && (
        <TemplateVariablesView
          templateId={selectedTemplate._id || selectedTemplate.id}
          onClose={() => {
            setShowVariablesModal(false);
            setSelectedTemplate(null);
          }}
        />
      )}
    </div>
  );
};

export default Templates;
