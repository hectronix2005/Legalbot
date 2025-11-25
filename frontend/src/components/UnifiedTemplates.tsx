// CACHE BUSTER v3.0.0: Ultra-aggressive deduplication - 2025-11-08-FINAL
import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import UnifiedWordTemplateUpload from './UnifiedWordTemplateUpload';
import ThirdPartyFieldConfigModal from './ThirdPartyFieldConfigModal';
import api from '../services/api';
import './UnifiedTemplates.css';

interface Template {
  _id: string;
  name: string;
  description: string;
  category: string;
  createdAt: string;
  fields: any[];
}

interface Contract {
  _id: string;
  contract_number: string;
  template?: {
    name: string;
    category?: string;
  };
  status: string;
  createdAt: string;
  file_path?: string;
  pdf_path?: string;
  generated_by?: {
    name: string;
    email?: string;
  };
  content?: string;
  title?: string;
  description?: string;
  company_name?: string;
  company?: string;
}

interface Supplier {
  _id: string;
  identification_type: string;
  identification_number: string;
  id_issue_city?: string;
  legal_name: string;
  legal_name_short: string;
  legal_representative_name: string;
  legal_representative_id_type: string;
  legal_representative_id_number: string;
  full_name?: string;
  licensee_name?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
  active?: boolean;
  custom_fields?: Record<string, any>;
  third_party_type_id?: string;
}

const UnifiedTemplates: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // Leer el tab de la URL, por defecto 'create'
  const getTabFromURL = (): 'create' | 'templates' | 'contracts' => {
    const params = new URLSearchParams(location.search);
    const tab = params.get('tab');
    if (tab === 'templates' || tab === 'contracts' || tab === 'create') {
      return tab;
    }
    return 'create';
  };

  const [activeTab, setActiveTab] = useState<'create' | 'templates' | 'contracts'>(getTabFromURL());
  const [templates, setTemplates] = useState<Template[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [loadingContracts, setLoadingContracts] = useState(false);
  const [selectedTemplateForReplace, setSelectedTemplateForReplace] = useState<Template | null>(null);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [selectedTemplateForGenerate, setSelectedTemplateForGenerate] = useState<Template | null>(null);
  const [contractData, setContractData] = useState<Record<string, string>>({});
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [showNewSupplierModal, setShowNewSupplierModal] = useState(false);
  const [showFieldSuggestions, setShowFieldSuggestions] = useState(false);
  const [suggestedFields, setSuggestedFields] = useState<any[]>([]);
  const [showThirdPartyConfigModal, setShowThirdPartyConfigModal] = useState(false);
  const [detectedVariablesForConfig, setDetectedVariablesForConfig] = useState<any[]>([]);

  // Estados para tipos de terceros dinámicos
  const [thirdPartyTypes, setThirdPartyTypes] = useState<any[]>([]);
  const [selectedThirdPartyType, setSelectedThirdPartyType] = useState<string>('');
  const [dynamicFields, setDynamicFields] = useState<any[]>([]);
  const [dynamicFormData, setDynamicFormData] = useState<Record<string, any>>({});

  // Estados para modal de crear nuevo tipo de tercero
  const [showCreateTypeModal, setShowCreateTypeModal] = useState(false);
  const [newTypeData, setNewTypeData] = useState({
    code: '',
    label: '',
    description: '',
    icon: '📄'
  });

  const [newSupplierData, setNewSupplierData] = useState({
    identification_type: 'NIT',
    identification_number: '',
    legal_name: '',
    legal_name_short: '',
    full_name: '', // Para personas naturales
    legal_representative_name: '',
    legal_representative_id_type: 'CC',
    legal_representative_id_number: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    country: 'Colombia'
  });

  // Estados para filtros de contratos
  const [contractSearchTerm, setContractSearchTerm] = useState('');
  const [contractTemplateFilter, setContractTemplateFilter] = useState('');
  const [contractTerceroFilter, setContractTerceroFilter] = useState('');
  const [contractStatusFilter, setContractStatusFilter] = useState<string[]>([]);
  const [contractStartDate, setContractStartDate] = useState('');
  const [contractEndDate, setContractEndDate] = useState('');
  const [showContractFilters, setShowContractFilters] = useState(false);

  // Estados para filtros de plantillas
  const [templateSearchTerm, setTemplateSearchTerm] = useState('');
  const [templateCategoryFilter, setTemplateCategoryFilter] = useState<string[]>([]);
  const [templateStartDate, setTemplateStartDate] = useState('');
  const [templateEndDate, setTemplateEndDate] = useState('');
  const [showTemplateFilters, setShowTemplateFilters] = useState(false);

  // Estados para modal de edición de plantilla
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedTemplateForEdit, setSelectedTemplateForEdit] = useState<Template | null>(null);
  const [editFormData, setEditFormData] = useState({
    name: '',
    description: '',
    category: ''
  });

  const handleTemplateCreated = (templateId: string) => {
    console.log('Plantilla creada:', templateId);
    // Recargar lista de plantillas
    fetchTemplates();
  };

  const handleContractGenerated = (contractId: string) => {
    console.log('Contrato generado:', contractId);
    // Recargar listas
    fetchTemplates();
    fetchContracts();
  };

  const fetchTemplates = async () => {
    setLoadingTemplates(true);
    try {
      const response = await api.get('/templates');
      setTemplates(response.data);
    } catch (error) {
      console.error('Error fetching templates:', error);
    } finally {
      setLoadingTemplates(false);
    }
  };

  const fetchContracts = async () => {
    setLoadingContracts(true);
    try {
      const response = await api.get('/contracts');
      setContracts(response.data);
    } catch (error) {
      console.error('Error fetching contracts:', error);
    } finally {
      setLoadingContracts(false);
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (!window.confirm('¿Estás seguro de que quieres eliminar esta plantilla?')) return;

    try {
      await api.delete(`/templates/${templateId}`);
      fetchTemplates();
      alert('Plantilla eliminada exitosamente');
    } catch (error) {
      console.error('Error deleting template:', error);
      alert('Error al eliminar la plantilla');
    }
  };

  const handleDownloadTemplateWord = async (template: Template) => {
    try {
      const response = await api.get(`/templates/${template._id}/download-word`, {
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${template.name}.docx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading template Word:', error);
      alert('Error al descargar el archivo Word de la plantilla');
    }
  };

  const handleCopyTemplate = async (templateId: string, templateName: string) => {
    const newName = prompt('Nombre para la copia de la plantilla:', `Copia de ${templateName}`);

    if (!newName || newName.trim() === '') {
      return;
    }

    setLoadingTemplates(true);
    try {
      const response = await api.post(`/templates/${templateId}/copy`, {
        newName: newName.trim()
      });

      alert(`Plantilla copiada exitosamente: ${response.data.template.name}`);
      fetchTemplates();
    } catch (error) {
      console.error('Error copying template:', error);
      alert('Error al copiar la plantilla: ' + ((error as any).response?.data?.error || 'Error desconocido'));
    } finally {
      setLoadingTemplates(false);
    }
  };

  const handleOpenEditModal = (template: Template) => {
    setSelectedTemplateForEdit(template);
    setEditFormData({
      name: template.name,
      description: template.description || '',
      category: template.category || ''
    });
    setShowEditModal(true);
  };

  const handleCloseEditModal = () => {
    setShowEditModal(false);
    setSelectedTemplateForEdit(null);
    setEditFormData({
      name: '',
      description: '',
      category: ''
    });
  };

  const handleSaveTemplateEdit = async () => {
    if (!selectedTemplateForEdit) return;

    if (!editFormData.name.trim()) {
      alert('El nombre de la plantilla es requerido');
      return;
    }

    try {
      await api.put(`/templates/${selectedTemplateForEdit._id}`, {
        name: editFormData.name.trim(),
        description: editFormData.description.trim(),
        category: editFormData.category.trim()
      });

      alert('Plantilla actualizada exitosamente');
      handleCloseEditModal();
      fetchTemplates();
    } catch (error) {
      console.error('Error updating template:', error);
      alert('Error al actualizar la plantilla: ' + ((error as any).response?.data?.error || 'Error desconocido'));
    }
  };

  const handleReplaceWordFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file || !selectedTemplateForReplace) {
      return;
    }

    if (!file.name.toLowerCase().endsWith('.docx')) {
      alert('Por favor selecciona un archivo Word (.docx)');
      return;
    }

    if (!window.confirm(`¿Estás seguro de que quieres reemplazar el archivo Word de la plantilla "${selectedTemplateForReplace.name}"? Las variables existentes se mantendrán.`)) {
      setSelectedTemplateForReplace(null);
      return;
    }

    setLoadingTemplates(true);
    try {
      const formData = new FormData();
      formData.append('wordFile', file);

      await api.post(`/templates/${selectedTemplateForReplace._id}/replace-word`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      alert('Archivo Word reemplazado exitosamente');
      fetchTemplates();
    } catch (error) {
      console.error('Error replacing Word file:', error);
      alert('Error al reemplazar el archivo Word: ' + ((error as any).response?.data?.error || 'Error desconocido'));
    } finally {
      setLoadingTemplates(false);
      setSelectedTemplateForReplace(null);
    }
  };

  // Función auxiliar para remover acentos
  const removeAccents = (str: string): string => {
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  };

  // Normalizar nombres de campo para agrupar variables similares
  // Sistema ultra-robusto que elimina TODOS los caracteres especiales y artículos
  const normalizeFieldName = (fieldName: string): string => {
    if (!fieldName) return '';

    let normalized = removeAccents(fieldName)
      .toLowerCase()
      .trim()
      .replace(/[_\s\/\-\.,:;()[\]{}]+/g, '') // Remover TODOS los caracteres especiales y espacios
      .replace(/\bde\b/g, '') // Remover "de"
      .replace(/\bdel\b/g, '') // Remover "del"
      .replace(/\bla\b/g, '') // Remover "la"
      .replace(/\bel\b/g, '') // Remover "el"
      .replace(/\blos\b/g, '') // Remover "los"
      .replace(/\blas\b/g, ''); // Remover "las"

    // Lista de patrones que representan el mismo concepto
    // Cualquier combinación de estas palabras se normaliza al mismo valor
    const patterns = [
      { keywords: ['nombre', 'razon', 'social'], normalized: 'razonsocial' },
      { keywords: ['representante', 'legal'], normalized: 'representantelegal' },
      { keywords: ['numero', 'nit'], normalized: 'numeronit' },
      { keywords: ['cedula', 'representante'], normalized: 'cedularepresentante' },
      { keywords: ['correo', 'electronico'], normalized: 'correoelectronico' },
      { keywords: ['propiedad', 'horizontal'], normalized: 'propiedadhorizontal' }
    ];

    for (const pattern of patterns) {
      const hasAllKeywords = pattern.keywords.every(keyword => normalized.includes(keyword));
      if (hasAllKeywords) {
        return pattern.normalized;
      }
    }

    // Si contiene "nombre" O "razonsocial" (incluso por separado), normalizar a razonsocial
    if (normalized.includes('nombre') || normalized.includes('razonsocial') || normalized.includes('razon')) {
      // Verificar que no sea otro tipo de nombre (como nombre_representante)
      if (!normalized.includes('representante') && !normalized.includes('licenciatario')) {
        return 'razonsocial';
      }
    }

    return normalized;
  };

  // Obtener variables únicas (agrupadas por nombre normalizado)
  // Sistema robusto con múltiples estrategias de deduplicación
  const getUniqueVariables = (fields: any[]) => {
    if (!fields || fields.length === 0) {
      return [];
    }

    const seenNormalized = new Set<string>();
    const seenExact = new Set<string>();
    const uniqueVars: any[] = [];

    console.log('🔍 getUniqueVariables - Procesando campos (Sistema Robusto v2):');

    fields.forEach((field, index) => {
      const fieldName = field.field_name || '';
      const fieldNameTrimmed = fieldName.trim();
      const normalized = normalizeFieldName(fieldName);

      console.log(`  ${index + 1}. "${fieldName}"`);
      console.log(`      Normalizado: "${normalized}"`);

      // Estrategia 1: Verificar por nombre normalizado
      if (seenNormalized.has(normalized)) {
        console.log(`      ❌ DUPLICADO por normalización (ignorado)`);
        return;
      }

      // Estrategia 2: Verificar por nombre exacto (incluyendo mayúsculas/minúsculas)
      const exactLower = fieldNameTrimmed.toLowerCase();
      if (seenExact.has(exactLower)) {
        console.log(`      ❌ DUPLICADO por nombre exacto (ignorado)`);
        return;
      }

      // Estrategia 3: Verificar similitud con campos ya agregados
      // Si hay un campo muy similar (>90% similitud), ignorarlo
      for (const existingField of uniqueVars) {
        const existingName = (existingField.field_name || '').toLowerCase().trim();
        if (existingName === exactLower) {
          console.log(`      ❌ DUPLICADO por similitud exacta (ignorado)`);
          return;
        }
      }

      // Si pasó todas las verificaciones, agregarlo
      seenNormalized.add(normalized);
      seenExact.add(exactLower);
      uniqueVars.push(field);
      console.log(`      ✅ AGREGADO como campo único`);
    });

    console.log(`\n📊 Resumen: ${fields.length} campos totales → ${uniqueVars.length} campos únicos\n`);

    return uniqueVars;
  };

  const handleOpenGenerateModal = async (template: Template) => {
    setSelectedTemplateForGenerate(template);
    setShowGenerateModal(true);

    // Inicializar datos del contrato vacíos
    const initialData: Record<string, string> = {};
    template.fields?.forEach((field: any) => {
      initialData[field.field_name] = '';
    });
    setContractData(initialData);

    // Cargar terceros y tipos de terceros
    try {
      const response = await api.get('/suppliers');
      setSuppliers(response.data.suppliers || []);

      // Cargar tipos de terceros
      await fetchThirdPartyTypes();
    } catch (error) {
      console.error('Error fetching suppliers:', error);
    }
  };

  // Función para cargar tipos de terceros desde la API
  const fetchThirdPartyTypes = async () => {
    try {
      // Agregar cache-busting con timestamp para forzar recarga
      const cacheBuster = `?t=${Date.now()}`;
      const response = await api.get(`/third-party-types${cacheBuster}`);
      console.log('📋 Tipos de terceros cargados:', response.data.length);
      console.log('📋 [DEBUG] Códigos:', response.data.map((t: any) => t.code).join(', '));
      console.log('✅ [DEBUG] Tiene Propiedad Horizontal (ph):', response.data.some((t: any) => t.code === 'ph'));
      console.log('✅ [DEBUG] Tiene Contador PH (contador_ph):', response.data.some((t: any) => t.code === 'contador_ph'));
      setThirdPartyTypes(response.data);
    } catch (error) {
      console.error('Error cargando tipos de terceros:', error);
    }
  };

  // Función para cargar campos dinámicos cuando se selecciona un tipo de tercero
  const handleThirdPartyTypeSelect = async (typeId: string) => {
    // Detectar si se seleccionó la opción de crear nuevo tipo
    if (typeId === '__CREATE_NEW__') {
      setShowCreateTypeModal(true);
      setSelectedThirdPartyType('');
      setDynamicFields([]);
      return;
    }

    setSelectedThirdPartyType(typeId);
    setDynamicFormData({}); // Resetear datos del formulario

    if (!typeId) {
      setDynamicFields([]);
      return;
    }

    try {
      const response = await api.get(`/third-party-types/${typeId}`);
      console.log('📝 Campos del tipo de tercero:', response.data.fields);
      setDynamicFields(response.data.fields || []);

      // Inicializar datos del formulario con valores vacíos
      const initialFormData: Record<string, any> = {};
      response.data.fields?.forEach((field: any) => {
        initialFormData[field.name] = '';
      });
      setDynamicFormData(initialFormData);
    } catch (error) {
      console.error('Error cargando campos del tipo de tercero:', error);
      alert('Error al cargar la configuración del tipo de tercero');
    }
  };

  // Función para crear un nuevo tipo de tercero
  const handleCreateNewType = async () => {
    // Validar campos requeridos
    if (!newTypeData.code.trim() || !newTypeData.label.trim()) {
      alert('El código y el nombre son requeridos');
      return;
    }

    try {
      console.log('🆕 Creando nuevo tipo de tercero...');

      const response = await api.post('/third-party-types', {
        code: newTypeData.code.toLowerCase().trim(),
        label: newTypeData.label.trim(),
        description: newTypeData.description.trim() || `Tipo de tercero: ${newTypeData.label}`,
        icon: newTypeData.icon || '📄',
        fields: [] // Inicialmente sin campos
      });

      const newType = response.data.type;
      console.log('✅ Nuevo tipo creado:', newType);

      // Actualizar lista de tipos
      await fetchThirdPartyTypes();

      // Seleccionar el nuevo tipo
      setSelectedThirdPartyType(newType._id);
      await handleThirdPartyTypeSelect(newType._id);

      // Cerrar modal y resetear form
      setShowCreateTypeModal(false);
      setNewTypeData({
        code: '',
        label: '',
        description: '',
        icon: '📄'
      });

      alert('Tipo de tercero creado exitosamente');
    } catch (error: any) {
      console.error('Error al crear tipo de tercero:', error);
      alert('Error al crear el tipo de tercero: ' + (error.response?.data?.error || 'Error desconocido'));
    }
  };

  // Función para abrir el modal de creación de terceros con tipos cargados
  const handleOpenNewSupplierModal = async () => {
    setShowNewSupplierModal(true);
    await fetchThirdPartyTypes();
  };

  const handleSupplierSelect = (supplierId: string) => {
    setSelectedSupplier(supplierId);

    if (!supplierId || !selectedTemplateForGenerate) {
      return;
    }

    const supplier = suppliers.find(s => s._id === supplierId);
    if (!supplier) {
      return;
    }

    // Mapear datos del tercero a los campos del contrato
    const mapping: Record<string, any> = {
      // Razón social / Nombre Propiedad Horizontal
      'razon_social': supplier.legal_name,
      'razonsocial': supplier.legal_name,
      'razón social': supplier.legal_name,
      'legal_name': supplier.legal_name,
      'nombre': supplier.legal_name,
      'nombre / razón social': supplier.legal_name,
      'nombre / razon social': supplier.legal_name,
      'nombre/razón social': supplier.legal_name,
      'nombre/razon social': supplier.legal_name,
      'nombre_razon_social': supplier.legal_name,
      'nombrerazonsocial': supplier.legal_name,
      'nombre_de_la_propiedad_horizontal': supplier.legal_name,
      'nombre de la propiedad horizontal': supplier.legal_name,
      'nombredelapropiedadhorizontal': supplier.legal_name,
      'propiedad_horizontal': supplier.legal_name,
      'propiedadhorizontal': supplier.legal_name,

      // Razón social abreviada
      'razon_social_abreviada': supplier.legal_name_short,
      'razon social abreviada': supplier.legal_name_short,
      'razonsocialabreviada': supplier.legal_name_short,
      'legal_name_short': supplier.legal_name_short,

      // NIT / Numero del NIT
      'nit': supplier.identification_number,
      'numero_del_nit': supplier.identification_number,
      'numero del nit': supplier.identification_number,
      'numerodelnit': supplier.identification_number,
      'numero_nit': supplier.identification_number,
      'numeronit': supplier.identification_number,
      'identification_number': supplier.identification_number,

      // Representante legal
      'nombre_representante_legal': supplier.legal_representative_name,
      'nombre representante legal': supplier.legal_representative_name,
      'nombrerepresentantelegal': supplier.legal_representative_name,
      'nombrederepresentantelegal': supplier.legal_representative_name,
      'nombre_del_representante_legal': supplier.legal_representative_name,
      'representante_legal': supplier.legal_representative_name,
      'representantelegal': supplier.legal_representative_name,
      'legal_representative_name': supplier.legal_representative_name,

      // Cédula representante
      'cedula': supplier.legal_representative_id_number,
      'cedula_representante': supplier.legal_representative_id_number,
      'cedularepresentante': supplier.legal_representative_id_number,
      'cedula_rep_legal': supplier.legal_representative_id_number,
      'cedulareplegal': supplier.legal_representative_id_number,
      'cedula_representante_legal': supplier.legal_representative_id_number,
      'cedularepresentantelegal': supplier.legal_representative_id_number,
      'legal_representative_id_number': supplier.legal_representative_id_number,

      // Ciudad de expedición cédula
      'ciudad_expedicion': supplier.id_issue_city || '',
      'ciudad_de_expedicion': supplier.id_issue_city || '',
      'ciudaddeexpedicion': supplier.id_issue_city || '',
      'ciudad_expedicion_cedula': supplier.id_issue_city || '',
      'ciudad_de_expedicion_cedula': supplier.id_issue_city || '',
      'ciudad_de_expedicion_cedula_rep_legal': supplier.id_issue_city || '',
      'ciudaddeexpedicioncedulareplegal': supplier.id_issue_city || '',
      'lugar_expedicion': supplier.id_issue_city || '',
      'lugarexpedicion': supplier.id_issue_city || '',
      'id_issue_city': supplier.id_issue_city || '',

      // Correo electrónico
      'correo_electronico': supplier.email || '',
      'correo electronico': supplier.email || '',
      'correoelectronico': supplier.email || '',
      'correo': supplier.email || '',
      'email': supplier.email || '',
      'e-mail': supplier.email || '',
      'e_mail': supplier.email || '',
      'email_licenciatario': supplier.email || '',
      'e-mail_licenciatario': supplier.email || '',
      'emaillicenciatario': supplier.email || '',
      'e_mail_licenciatario': supplier.email || '',
      'correo_licenciatario': supplier.email || '',
      'correolicenciatario': supplier.email || '',

      // Teléfono
      'telefono': supplier.phone || '',
      'phone': supplier.phone || '',

      // Dirección
      'direccion': supplier.address || '',
      'address': supplier.address || '',

      // Ciudad
      'ciudad': supplier.city || '',
      'city': supplier.city || '',
      'ciudad_de_domicilio': supplier.city || '',

      // Nombre del licenciatario / full_name
      'nombre_licenciatario': supplier.licensee_name || supplier.full_name || '',
      'nombrelicenciatario': supplier.licensee_name || supplier.full_name || '',
      'nombre_del_licenciatario': supplier.licensee_name || supplier.full_name || '',
      'nombredellicenciatario': supplier.licensee_name || supplier.full_name || '',
      'licenciatario': supplier.licensee_name || supplier.full_name || '',
      'licensee_name': supplier.licensee_name || '',
      'full_name': supplier.full_name || '',

      // Fecha
      'fecha': new Date().toLocaleDateString('es-ES'),
      'dia_mes_y_ano': new Date().toLocaleDateString('es-ES'),
      'día_mes_y_año': new Date().toLocaleDateString('es-ES'),
      'diamesy ano': new Date().toLocaleDateString('es-ES'),
      'dia,_mes_y_ano': new Date().toLocaleDateString('es-ES'),
      'día,_mes_y_año': new Date().toLocaleDateString('es-ES')
    };

    // Fix para TypeScript: Agregar campos personalizados del tercero (custom_fields)
    // Usando type assertion para evitar errores de TypeScript con el campo custom_fields
    const supplierWithCustomFields = supplier as Supplier & { custom_fields?: Record<string, any> };
    if (supplierWithCustomFields.custom_fields && typeof supplierWithCustomFields.custom_fields === 'object') {
      console.log('🔍 Campos personalizados del tercero:', supplierWithCustomFields.custom_fields);
      Object.entries(supplierWithCustomFields.custom_fields).forEach(([key, value]) => {
        // Agregar múltiples variaciones del nombre del campo para maximizar coincidencias
        const keyWithoutAccents = removeAccents(key);
        const variations = [
          key,                                  // Original
          keyWithoutAccents,                    // Sin acentos
          key.toLowerCase(),                    // lowercase
          keyWithoutAccents.toLowerCase(),      // Sin acentos y lowercase
          key.replace(/_/g, ' '),              // Espacios en lugar de _
          keyWithoutAccents.replace(/_/g, ' '), // Sin acentos, con espacios
          key.replace(/ /g, '_'),              // _ en lugar de espacios
          keyWithoutAccents.replace(/ /g, '_'), // Sin acentos, con _
          normalizeFieldName(key),             // Normalizado (ya sin acentos)
          key.replace(/-/g, '_'),              // _ en lugar de -
          keyWithoutAccents.replace(/-/g, '_'), // Sin acentos, _ en lugar de -
          key.replace(/_/g, ''),               // Sin separadores
          keyWithoutAccents.replace(/_/g, ''), // Sin acentos, sin separadores
          key.replace(/ /g, ''),               // Sin espacios
          keyWithoutAccents.replace(/ /g, ''), // Sin acentos, sin espacios
          key.toLowerCase().replace(/[^a-z0-9]/g, ''), // Solo alfanumérico
          keyWithoutAccents.toLowerCase().replace(/[^a-z0-9]/g, ''), // Sin acentos, solo alfanumérico
        ];

        variations.forEach(variation => {
          mapping[variation] = value;
        });

        console.log(`   📌 Custom field mapeado: "${key}" -> "${value}" (incluye sin acentos: "${keyWithoutAccents}")`);
      });
    }

    console.log('📋 Mapping completo:', mapping);

    const newData: Record<string, string> = {};
    selectedTemplateForGenerate.fields?.forEach((field: any) => {
      const fieldName = field.field_name;

      // Generar múltiples variaciones del nombre del campo de la plantilla (incluyendo sin acentos)
      const fieldNameWithoutAccents = removeAccents(fieldName);
      const fieldVariations = [
        fieldName,
        fieldNameWithoutAccents,
        fieldName.toLowerCase(),
        fieldNameWithoutAccents.toLowerCase(),
        fieldName.replace(/_/g, ' '),
        fieldNameWithoutAccents.replace(/_/g, ' '),
        fieldName.replace(/ /g, '_'),
        fieldNameWithoutAccents.replace(/ /g, '_'),
        normalizeFieldName(fieldName),
        fieldName.replace(/-/g, '_'),
        fieldNameWithoutAccents.replace(/-/g, '_'),
        fieldName.replace(/_/g, ''),
        fieldNameWithoutAccents.replace(/_/g, ''),
        fieldName.replace(/ /g, ''),
        fieldNameWithoutAccents.replace(/ /g, ''),
        fieldName.toLowerCase().replace(/[^a-z0-9]/g, ''),
        fieldNameWithoutAccents.toLowerCase().replace(/[^a-z0-9]/g, ''),
      ];

      // Intentar encontrar coincidencia con cualquiera de las variaciones
      let matchedValue = null;
      for (const variation of fieldVariations) {
        if (mapping[variation] !== undefined && mapping[variation] !== null && mapping[variation] !== '') {
          matchedValue = mapping[variation];
          console.log(`✅ Campo "${fieldName}" coincide con variación "${variation}" -> "${matchedValue}"`);
          break;
        }
      }

      // Si no se encontró coincidencia directa, intentar con normalize en ambos lados
      if (!matchedValue) {
        const fieldNameNormalized = normalizeFieldName(fieldName);
        const matchedKey = Object.keys(mapping).find(key => normalizeFieldName(key) === fieldNameNormalized);
        if (matchedKey && mapping[matchedKey]) {
          matchedValue = mapping[matchedKey];
          console.log(`✅ Campo "${fieldName}" llenado con: "${matchedValue}"`);
        }
      }

      if (matchedValue) {
        newData[fieldName] = matchedValue;
      } else {
        newData[fieldName] = '';
        console.log(`⚠️  Campo "${fieldName}" no encontrado en mapping`);
      }
    });

    console.log('📝 Datos del contrato actualizados:', newData);
    setContractData(newData);
  };

  const handleContractDataChange = (fieldName: string, value: string) => {
    // Actualizar todas las variables con nombres similares
    const normalizedName = normalizeFieldName(fieldName);
    const relatedFields = selectedTemplateForGenerate?.fields
      ?.filter((f: any) => normalizeFieldName(f.field_name) === normalizedName)
      .map((f: any) => f.field_name) || [];

    const updates: Record<string, string> = {};
    relatedFields.forEach(field => {
      updates[field] = value;
    });

    setContractData(prev => ({
      ...prev,
      ...updates
    }));
  };

  const handleShowFieldSuggestions = async () => {
    if (!selectedTemplateForGenerate) return;

    setShowFieldSuggestions(true);

    try {
      // Analizar variables de la plantilla
      const fieldsToAnalyze = selectedTemplateForGenerate.fields?.map((field: any) => ({
        field_name: field.field_name,
        original_marker: field.marker || field.field_name
      })) || [];

      const response = await api.post('/third-party-types/suggest-from-template', {
        fields: fieldsToAnalyze,
        third_party_type: selectedTemplateForGenerate.category || 'otro'
      });

      setSuggestedFields(response.data.suggested || []);

      // Preparar variables para el modal de configuración
      const detectedVars = selectedTemplateForGenerate.fields?.map((field: any) => ({
        marker: field.marker || field.field_name,
        field_name: field.field_name,
        field_label: field.field_label || field.field_name,
        field_type: field.field_type || 'text'
      })) || [];

      setDetectedVariablesForConfig(detectedVars);
    } catch (error) {
      console.error('Error al obtener sugerencias:', error);
      alert('Error al analizar los campos de la plantilla');
    }
  };

  const handleOpenThirdPartyConfigModal = () => {
    setShowThirdPartyConfigModal(true);
  };

  const handleCloseThirdPartyConfigModal = () => {
    setShowThirdPartyConfigModal(false);
  };

  const handleCreateNewSupplier = async () => {
    // Validar que se haya seleccionado un tipo de tercero
    if (!selectedThirdPartyType) {
      alert('Por favor selecciona un tipo de tercero');
      return;
    }

    // Validar campos requeridos dinámicamente
    const missingFields: string[] = [];
    dynamicFields.forEach(field => {
      if (field.required) {
        const value = dynamicFormData[field.name];
        if (!value || (typeof value === 'string' && !value.trim())) {
          missingFields.push(field.label);
        }
      }
    });

    if (missingFields.length > 0) {
      alert(`Por favor completa los siguientes campos requeridos:\n\n${missingFields.join('\n')}`);
      return;
    }

    try {
      // Primero, detectar si existe un NIT para determinar contexto de "cedula"
      const hasNIT = Object.keys(dynamicFormData).some(key =>
        ['numero_del_nit', 'nit', 'numero_de_identificacion'].includes(key.toLowerCase().trim())
      );

      // Mapeo comprensivo de nombres de campos dinámicos a campos esperados por el backend
      const fieldMapping: Record<string, string> = {
        // Identificación
        'numero_del_nit': 'identification_number',
        'nit': 'identification_number',
        'numero_de_identificacion': 'identification_number',
        'numero_identificacion': 'identification_number',
        'numero_de_cedula': 'identification_number',
        'numero_cedula': 'identification_number',
        'cedula_numero': 'identification_number',
        'numero_documento': 'identification_number',
        'documento': 'identification_number',
        // 'cedula' se mapea dinámicamente más abajo según el contexto
        'cc': 'identification_number',
        'tipo_de_identificacion': 'identification_type',
        'tipo_identificacion': 'identification_type',

        // Razón social / Nombre legal (para empresas)
        'nombre_de_la_propiedad_horizontal': 'legal_name',
        'nombre_propiedad_horizontal': 'legal_name',
        'razon_social': 'legal_name',
        'nombre_empresa': 'legal_name',
        'empresa': 'legal_name',

        // Nombre completo (para personas naturales)
        'nombre_completo': 'full_name',
        'nombre': 'full_name',
        'nombre_del_trabajador': 'full_name',
        'nombre_del_empleado': 'full_name',
        'nombre_trabajador': 'full_name',
        'trabajador': 'full_name',
        'empleado': 'full_name',
        'nombre_persona': 'full_name',

        // Razón social abreviada
        'razon_social_abreviada': 'legal_name_short',
        'nombre_abreviado': 'legal_name_short',
        'nombre_corto': 'legal_name_short',

        // Representante legal
        'nombre_del_representante_legal': 'legal_representative_name',
        'representante_legal': 'legal_representative_name',
        'nombre_representante': 'legal_representative_name',
        'representante': 'legal_representative_name',
        'cedula_representante': 'legal_representative_id_number',
        'cedula_del_representante': 'legal_representative_id_number',
        'identificacion_representante': 'legal_representative_id_number',
        'tipo_id_representante': 'legal_representative_id_type',

        // Contacto
        'correo': 'email',
        'email': 'email',
        'correo_electronico': 'email',
        'telefono': 'phone',
        'celular': 'phone',
        'tel': 'phone',

        // Dirección
        'direccion': 'address',
        'dir': 'address',
        'ciudad': 'city',
        'ciudad_de_domicilio': 'city',
        'municipio': 'city',
        'pais': 'country',
        'country': 'country',

        // Licenciatario (para algunos tipos)
        'licenciatario': 'licensee_name',
        'nombre_licenciatario': 'licensee_name'
      };

      // Mapeo contextual inteligente para "cedula"
      // Si existe NIT, entonces cedula es del representante legal
      // Si NO existe NIT, entonces cedula es la identificación del tercero
      if (hasNIT) {
        fieldMapping['cedula'] = 'legal_representative_id_number';
        console.log('📋 Campo "cedula" mapeado a representante legal (se detectó NIT)');
      } else {
        fieldMapping['cedula'] = 'identification_number';
        console.log('📋 Campo "cedula" mapeado a identificación del tercero (no se detectó NIT)');
      }

      // Lista de campos requeridos por el backend
      const requiredBackendFields = [
        'identification_type',
        'identification_number',
        'legal_name',
        'legal_name_short',
        'legal_representative_name',
        'legal_representative_id_type',
        'legal_representative_id_number'
      ];

      // Aplicar mapeo y separar campos personalizados
      const mappedData: Record<string, any> = {};
      const customFields: Record<string, any> = {};

      Object.entries(dynamicFormData).forEach(([key, value]) => {
        const normalizedKey = key.toLowerCase().trim();
        const mappedKey = fieldMapping[normalizedKey] || key;

        // Si es un campo esperado por el backend, agregarlo a mappedData
        if (requiredBackendFields.includes(mappedKey) ||
            ['email', 'phone', 'address', 'city', 'country', 'licensee_name', 'full_name'].includes(mappedKey)) {
          mappedData[mappedKey] = value;
        } else {
          // Caso contrario, es un campo personalizado
          customFields[key] = value;
        }
      });

      // Obtener el tipo de identificación por defecto del tipo de tercero
      const selectedType = thirdPartyTypes.find(t => t._id === selectedThirdPartyType);
      const defaultIdentificationType = selectedType && selectedType.default_identification_types && selectedType.default_identification_types.length > 0
        ? selectedType.default_identification_types[0]
        : 'NIT';

      console.log('🏢 Usando tipo de identificación para', selectedType?.label || 'tipo desconocido', ':', defaultIdentificationType);

      // Asegurar valores por defecto para campos requeridos
      const dataToSend = {
        identification_type: mappedData.identification_type || defaultIdentificationType,
        identification_number: mappedData.identification_number || '',
        legal_name: mappedData.legal_name || '',
        legal_name_short: mappedData.legal_name_short || mappedData.legal_name || '',
        full_name: mappedData.full_name || mappedData.legal_name || '',
        legal_representative_name: mappedData.legal_representative_name || '',
        legal_representative_id_type: mappedData.legal_representative_id_type || 'CC',
        legal_representative_id_number: mappedData.legal_representative_id_number || '',

        // Campos opcionales
        email: mappedData.email || '',
        phone: mappedData.phone || '',
        address: mappedData.address || '',
        city: mappedData.city || '',
        country: mappedData.country || 'Colombia',
        licensee_name: mappedData.licensee_name || '',

        // ID del tipo de tercero
        third_party_type_id: selectedThirdPartyType,

        // Campos personalizados
        custom_fields: customFields
      };

      console.log('📤 Creando tercero con datos mapeados:', dataToSend);
      console.log('🔄 Mapeo aplicado:', {
        camposDinamicos: Object.keys(dynamicFormData),
        camposMapeados: Object.keys(mappedData),
        camposPersonalizados: Object.keys(customFields)
      });

      const response = await api.post('/suppliers', dataToSend);

      alert('Tercero creado exitosamente');

      // Actualizar lista de terceros
      const suppliersResponse = await api.get('/suppliers');
      setSuppliers(suppliersResponse.data.suppliers || []);

      // Seleccionar el tercero recién creado
      const newSupplierId = response.data.supplier._id;
      setSelectedSupplier(newSupplierId);
      handleSupplierSelect(newSupplierId);

      // Cerrar modal y resetear datos
      setShowNewSupplierModal(false);
      setSelectedThirdPartyType('');
      setDynamicFields([]);
      setDynamicFormData({});
    } catch (error: any) {
      console.error('Error creating supplier:', error);
      console.error('Error details:', error.response?.data);

      // Mostrar errores de validación específicos si existen
      if (error.response?.data?.errors && Array.isArray(error.response.data.errors)) {
        const validationErrors = error.response.data.errors
          .map((err: any) => `• ${err.msg} (campo: ${err.path})`)
          .join('\n');
        alert('Errores de validación:\n\n' + validationErrors);
      } else {
        alert('Error al crear el tercero: ' + (error.response?.data?.error || error.message || 'Error desconocido'));
      }
    }
  };

  const handleGenerateFromTemplate = async () => {
    if (!selectedTemplateForGenerate) {
      return;
    }

    // Validar que se haya seleccionado un tercero
    if (!selectedSupplier) {
      alert('Por favor selecciona un tercero para generar el contrato');
      return;
    }

    // Validar campos requeridos usando variables únicas
    const uniqueFields = getUniqueVariables(selectedTemplateForGenerate.fields || []);
    const requiredFields = uniqueFields.filter((f: any) => f.required);
    const missingFields = requiredFields.filter((f: any) => !contractData[f.field_name]?.trim());

    if (missingFields.length > 0) {
      alert(`Por favor completa los siguientes campos requeridos: ${missingFields.map((f: any) => f.field_label || f.field_name).join(', ')}`);
      return;
    }

    setIsGenerating(true);
    try {
      const response = await api.post(`/templates/${selectedTemplateForGenerate._id}/generate-contract`, {
        contractData: contractData
      });

      alert(`¡Contrato generado exitosamente!\n\nNúmero: ${response.data.contract.contract_number}`);

      // Cerrar modal y recargar contratos
      setShowGenerateModal(false);
      setSelectedTemplateForGenerate(null);
      setContractData({});
      setSelectedSupplier('');
      setShowFieldSuggestions(false);
      setSuggestedFields([]);
      setShowThirdPartyConfigModal(false);
      setDetectedVariablesForConfig([]);
      fetchContracts();
    } catch (error) {
      console.error('Error generating contract:', error);
      alert('Error al generar el contrato: ' + ((error as any).response?.data?.error || 'Error desconocido'));
    } finally {
      setIsGenerating(false);
    }
  };

  // Función para extraer información del tercero del contenido del contrato
  const extractTerceroFromContent = (content: string): string => {
    if (!content) return 'N/A';
    
    // Remover tags HTML para buscar en texto plano
    const textContent = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
    
    // Palabras clave comunes para identificar el tercero
    const terceroKeywords = [
      'razón social', 'razon social', 'nombre_tercero', 'nombre tercero',
      'empresa_tercero', 'empresa tercero', 'nombre_empresa', 'nombre empresa',
      'proveedor', 'cliente', 'contratista', 'tercero'
    ];
    
    // Buscar patrones comunes de nombres de terceros en el contenido
    const patterns = [
      /razón\s*social[:\s]+([^<\n,;]+)/i,
      /razon\s*social[:\s]+([^<\n,;]+)/i,
      /nombre\s+(?:del\s+)?(?:tercero|proveedor|cliente)[:\s]+([^<\n,;]+)/i,
      /tercero[:\s]+([^<\n,;]+)/i,
      /proveedor[:\s]+([^<\n,;]+)/i,
      /cliente[:\s]+([^<\n,;]+)/i,
      /legal_name[:\s]+([^<\n,;]+)/i,
      /nombre_empresa[:\s]+([^<\n,;]+)/i,
      /empresa[:\s]+([^<\n,;]+)/i
    ];
    
    for (const pattern of patterns) {
      const match = textContent.match(pattern);
      if (match && match[1]) {
        const extracted = match[1].trim();
        // Validar que sea un nombre válido (no muy corto ni muy largo)
        if (extracted.length > 3 && extracted.length < 100 && !extracted.match(/^\d+$/)) {
          return extracted;
        }
      }
    }
    
    // Buscar por palabras clave en el texto
    for (const keyword of terceroKeywords) {
      const regex = new RegExp(`${keyword}[:\s]+([^<\n,;]{5,80})`, 'i');
      const match = textContent.match(regex);
      if (match && match[1]) {
        const extracted = match[1].trim();
        if (extracted.length > 3 && extracted.length < 100) {
          return extracted;
        }
      }
    }
    
    return 'N/A';
  };

  const handleDeleteContract = async (contractId: string) => {
    try {
      await api.delete(`/contracts/${contractId}`);
      fetchContracts();
      alert('Contrato eliminado exitosamente');
    } catch (error) {
      console.error('Error deleting contract:', error);
      alert('Error al eliminar el contrato');
    }
  };

  const handleDownloadContract = async (contractId: string, contractNumber: string) => {
    try {
      const response = await api.get(`/documents/download/word/${contractId}`, {
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${contractNumber}.docx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading contract:', error);
      alert('Error al descargar el contrato');
    }
  };

  // Funciones de filtrado para contratos
  const clearContractFilters = () => {
    setContractSearchTerm('');
    setContractTemplateFilter('');
    setContractTerceroFilter('');
    setContractStatusFilter([]);
    setContractStartDate('');
    setContractEndDate('');
  };

  const handleContractStatusToggle = (status: string) => {
    setContractStatusFilter(prev =>
      prev.includes(status)
        ? prev.filter(s => s !== status)
        : [...prev, status]
    );
  };

  const getFilteredContracts = () => {
    let filtered = [...contracts];

    // Búsqueda general (número de contrato)
    if (contractSearchTerm.trim()) {
      const search = contractSearchTerm.toLowerCase();
      filtered = filtered.filter(contract =>
        contract.contract_number?.toLowerCase().includes(search)
      );
    }

    // Filtro por plantilla
    if (contractTemplateFilter.trim()) {
      const template = contractTemplateFilter.toLowerCase();
      filtered = filtered.filter(contract =>
        contract.template?.name?.toLowerCase().includes(template)
      );
    }

    // Filtro por tercero (busca en múltiples campos)
    if (contractTerceroFilter.trim()) {
      const tercero = contractTerceroFilter.toLowerCase();
      filtered = filtered.filter(contract =>
        (contract.content?.toLowerCase().includes(tercero)) ||
        (contract.title?.toLowerCase().includes(tercero)) ||
        (contract.description?.toLowerCase().includes(tercero)) ||
        (contract.company_name?.toLowerCase().includes(tercero)) ||
        (contract.contract_number?.toLowerCase().includes(tercero))
      );
    }

    // Filtro por estado
    if (contractStatusFilter.length > 0) {
      filtered = filtered.filter(contract =>
        contractStatusFilter.includes(contract.status)
      );
    }

    // Filtro por rango de fechas
    if (contractStartDate) {
      const start = new Date(contractStartDate);
      filtered = filtered.filter(contract =>
        new Date(contract.createdAt) >= start
      );
    }

    if (contractEndDate) {
      const end = new Date(contractEndDate);
      end.setHours(23, 59, 59, 999);
      filtered = filtered.filter(contract =>
        new Date(contract.createdAt) <= end
      );
    }

    return filtered;
  };

  const filteredContracts = getFilteredContracts();
  const activeContractFiltersCount = [
    contractSearchTerm.trim(),
    contractTemplateFilter.trim(),
    contractTerceroFilter.trim(),
    contractStatusFilter.length > 0,
    contractStartDate,
    contractEndDate
  ].filter(Boolean).length;

  // Funciones de filtrado para plantillas
  const clearTemplateFilters = () => {
    setTemplateSearchTerm('');
    setTemplateCategoryFilter([]);
    setTemplateStartDate('');
    setTemplateEndDate('');
  };

  const handleTemplateCategoryToggle = (category: string) => {
    setTemplateCategoryFilter(prev =>
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  const getFilteredTemplates = () => {
    let filtered = [...templates];

    // Búsqueda por nombre
    if (templateSearchTerm.trim()) {
      const search = templateSearchTerm.toLowerCase();
      filtered = filtered.filter(template =>
        template.name?.toLowerCase().includes(search) ||
        template.description?.toLowerCase().includes(search)
      );
    }

    // Filtro por categoría
    if (templateCategoryFilter.length > 0) {
      filtered = filtered.filter(template =>
        templateCategoryFilter.includes(template.category)
      );
    }

    // Filtro por rango de fechas
    if (templateStartDate) {
      const start = new Date(templateStartDate);
      filtered = filtered.filter(template =>
        new Date(template.createdAt) >= start
      );
    }

    if (templateEndDate) {
      const end = new Date(templateEndDate);
      end.setHours(23, 59, 59, 999);
      filtered = filtered.filter(template =>
        new Date(template.createdAt) <= end
      );
    }

    return filtered;
  };

  const filteredTemplates = getFilteredTemplates();
  const activeTemplateFiltersCount = [
    templateSearchTerm.trim(),
    templateCategoryFilter.length > 0,
    templateStartDate,
    templateEndDate
  ].filter(Boolean).length;

  // Función para cambiar tabs y actualizar la URL
  const handleTabChange = (tab: 'create' | 'templates' | 'contracts') => {
    setActiveTab(tab);
    navigate(`?tab=${tab}`, { replace: true });
  };

  // Sincronizar activeTab con cambios en la URL (botón atrás/adelante del navegador)
  useEffect(() => {
    const tabFromURL = getTabFromURL();
    if (tabFromURL !== activeTab) {
      setActiveTab(tabFromURL);
    }
  }, [location.search]);

  // Cargar plantillas y contratos cuando se cambia a esos tabs
  useEffect(() => {
    if (activeTab === 'templates' && templates.length === 0) {
      fetchTemplates();
    } else if (activeTab === 'contracts' && contracts.length === 0) {
      fetchContracts();
    }
  }, [activeTab]);

  return (
    <div className="unified-templates">
      <div className="page-header">
        <h1>🚀 Gestión de Contratos</h1>
        <p>Crea plantillas, genera contratos y administra todo desde un solo lugar</p>
      </div>

      {/* Tabs Navigation */}
      <div className="tabs-navigation">
        <button
          className={`tab-button ${activeTab === 'create' ? 'active' : ''}`}
          onClick={() => handleTabChange('create')}
        >
          ✨ Crear Contrato
        </button>
        <button
          className={`tab-button ${activeTab === 'templates' ? 'active' : ''}`}
          onClick={() => handleTabChange('templates')}
        >
          📋 Plantillas
        </button>
        <button
          className={`tab-button ${activeTab === 'contracts' ? 'active' : ''}`}
          onClick={() => handleTabChange('contracts')}
        >
          📄 Contratos Generados
        </button>
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {activeTab === 'create' && (
          <div className="create-tab">
            <UnifiedWordTemplateUpload
              onTemplateCreated={handleTemplateCreated}
              onContractGenerated={handleContractGenerated}
            />
          </div>
        )}

        {activeTab === 'templates' && (
          <div className="templates-tab">
            <div className="tab-header">
              <h2>Plantillas Creadas</h2>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  className="btn-primary"
                  onClick={() => handleTabChange('create')}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: '600',
                    fontSize: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  ✨ Nueva Plantilla
                </button>
                <button
                  className="btn-refresh"
                  onClick={(e) => {
                    e.preventDefault();
                    fetchTemplates();
                  }}
                  disabled={loadingTemplates}
                  title="Recargar lista de plantillas sin cambiar de página"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="23 4 23 10 17 10"></polyline>
                    <polyline points="1 20 1 14 7 14"></polyline>
                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                  </svg>
                  Actualizar Plantillas
                </button>
              </div>
            </div>

            {/* Sección de Filtros */}
            <div className="filters-container">
              <div className="filters-header">
                <button
                  className="btn-toggle-filters"
                  onClick={() => setShowTemplateFilters(!showTemplateFilters)}
                >
                  {showTemplateFilters ? '▼' : '▶'} Filtros
                  {activeTemplateFiltersCount > 0 && (
                    <span className="filter-badge">{activeTemplateFiltersCount}</span>
                  )}
                </button>
                {activeTemplateFiltersCount > 0 && (
                  <button className="btn-clear-filters" onClick={clearTemplateFilters}>
                    Limpiar Filtros
                  </button>
                )}
                <div className="results-count">
                  Mostrando {filteredTemplates.length} de {templates.length} plantillas
                </div>
              </div>

              {showTemplateFilters && (
                <div className="filters-content">
                  {/* Búsqueda */}
                  <div className="filter-group">
                    <label>Buscar:</label>
                    <input
                      type="text"
                      placeholder="Buscar por nombre o descripción..."
                      value={templateSearchTerm}
                      onChange={(e) => setTemplateSearchTerm(e.target.value)}
                      className="filter-input"
                    />
                  </div>

                  {/* Filtro por Categoría */}
                  <div className="filter-group">
                    <label>Categoría:</label>
                    <div className="status-checkboxes">
                      {Array.from(new Set(templates.map(t => t.category || 'General'))).map(category => (
                        <label key={category} className="checkbox-label">
                          <input
                            type="checkbox"
                            checked={templateCategoryFilter.includes(category)}
                            onChange={() => handleTemplateCategoryToggle(category)}
                          />
                          <span className={`status-label status-${category.toLowerCase().replace(/\s+/g, '-')}`}>
                            {category}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Filtro por Rango de Fechas */}
                  <div className="filter-group">
                    <label>Fecha de creación:</label>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <input
                        type="date"
                        value={templateStartDate}
                        onChange={(e) => setTemplateStartDate(e.target.value)}
                        className="filter-input"
                        placeholder="Desde"
                      />
                      <span>hasta</span>
                      <input
                        type="date"
                        value={templateEndDate}
                        onChange={(e) => setTemplateEndDate(e.target.value)}
                        className="filter-input"
                        placeholder="Hasta"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {loadingTemplates ? (
              <div className="loading">Cargando plantillas...</div>
            ) : templates.length === 0 ? (
              <div className="empty-state">
                <h3>No hay plantillas</h3>
                <p>Ve al tab "Crear Contrato" para crear tu primera plantilla</p>
              </div>
            ) : filteredTemplates.length === 0 ? (
              <div className="empty-state">
                <h3>No se encontraron plantillas</h3>
                <p>No hay plantillas que coincidan con los filtros aplicados</p>
                <button className="btn-clear-filters" onClick={clearTemplateFilters}>
                  Limpiar Filtros
                </button>
              </div>
            ) : (
              <div className="templates-view">
                {/* Vista de tabla para desktop */}
                <div className="templates-table-container">
                  <table className="templates-table">
                    <thead>
                      <tr>
                        <th>Nombre</th>
                        <th className="hide-mobile">Descripción</th>
                        <th>Categoría</th>
                        <th className="hide-tablet">Variables</th>
                        <th className="hide-tablet">Fecha</th>
                        <th className="hide-mobile-tablet">Hora</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTemplates.map((template) => {
                        const createdDate = new Date(template.createdAt);
                        return (
                          <tr key={template._id}>
                            <td className="template-name">
                              <div className="name-wrapper">
                                <span className="name-text">{template.name}</span>
                                <span className="mobile-meta">
                                  <span className="meta-item">{template.fields?.length || 0} vars</span>
                                  <span className="meta-item">{createdDate.toLocaleDateString('es-ES')}</span>
                                </span>
                              </div>
                            </td>
                            <td className="template-description hide-mobile">
                              {template.description || 'Sin descripción'}
                            </td>
                            <td>
                              <span className="item-badge">{template.category || 'General'}</span>
                            </td>
                            <td className="template-variables hide-tablet">{template.fields?.length || 0}</td>
                            <td className="template-date hide-tablet">{createdDate.toLocaleDateString('es-ES')}</td>
                            <td className="template-time hide-mobile-tablet">
                              {createdDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td className="template-actions">
                              <div className="actions-buttons">
                                <button
                                  className="btn-action btn-generate"
                                  onClick={() => handleOpenGenerateModal(template)}
                                  title="Generar Contrato"
                                >
                                  🚀
                                </button>
                                <button
                                  className="btn-action btn-edit"
                                  onClick={() => handleOpenEditModal(template)}
                                  title="Editar"
                                >
                                  ✏️
                                </button>
                                <button
                                  className="btn-action btn-copy hide-mobile"
                                  onClick={() => handleCopyTemplate(template._id, template.name)}
                                  title="Copiar"
                                >
                                  📋
                                </button>
                                <button
                                  className="btn-action btn-replace hide-mobile"
                                  onClick={() => {
                                    setSelectedTemplateForReplace(template);
                                    document.getElementById(`replace-word-${template._id}`)?.click();
                                  }}
                                  title="Reemplazar"
                                >
                                  🔄
                                </button>
                                <input
                                  id={`replace-word-${template._id}`}
                                  type="file"
                                  accept=".docx"
                                  style={{ display: 'none' }}
                                  onChange={handleReplaceWordFile}
                                />
                                <button
                                  className="btn-action btn-download hide-mobile"
                                  onClick={() => handleDownloadTemplateWord(template)}
                                  title="Descargar"
                                >
                                  📥
                                </button>
                                <button
                                  className="btn-action btn-delete"
                                  onClick={() => handleDeleteTemplate(template._id)}
                                  title="Eliminar"
                                >
                                  🗑️
                                </button>
                                {/* Botón de menú en móviles */}
                                <div className="mobile-menu-wrapper show-mobile-only">
                                  <button
                                    className="btn-action btn-menu"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const menu = e.currentTarget.nextElementSibling;
                                      menu?.classList.toggle('show');
                                    }}
                                    title="Más acciones"
                                  >
                                    ⋮
                                  </button>
                                  <div className="mobile-actions-menu">
                                    <button
                                      onClick={() => handleCopyTemplate(template._id, template.name)}
                                    >
                                      📋 Copiar
                                    </button>
                                    <button
                                      onClick={() => {
                                        setSelectedTemplateForReplace(template);
                                        document.getElementById(`replace-word-${template._id}`)?.click();
                                      }}
                                    >
                                      🔄 Reemplazar
                                    </button>
                                    <button
                                      onClick={() => handleDownloadTemplateWord(template)}
                                    >
                                      📥 Descargar
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'contracts' && (
          <div className="contracts-tab">
            <div className="tab-header">
              <h2>Contratos Generados</h2>
              <button
                className="btn-refresh"
                onClick={(e) => {
                  e.preventDefault();
                  fetchContracts();
                }}
                disabled={loadingContracts}
                title="Recargar lista de contratos sin cambiar de página"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="23 4 23 10 17 10"></polyline>
                  <polyline points="1 20 1 14 7 14"></polyline>
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                </svg>
                Actualizar Contratos
              </button>
            </div>

            {/* Sección de Filtros */}
            <div className="filters-container">
              <div className="filters-header">
                <button
                  className="btn-toggle-filters"
                  onClick={() => setShowContractFilters(!showContractFilters)}
                >
                  {showContractFilters ? '▼' : '▶'} Filtros
                  {activeContractFiltersCount > 0 && (
                    <span className="filter-badge">{activeContractFiltersCount}</span>
                  )}
                </button>
                {activeContractFiltersCount > 0 && (
                  <button className="btn-clear-filters" onClick={clearContractFilters}>
                    Limpiar Filtros
                  </button>
                )}
                <div className="results-count">
                  Mostrando {filteredContracts.length} de {contracts.length} contratos
                </div>
              </div>

              {showContractFilters && (
                <div className="filters-content">
                  {/* Búsqueda */}
                  <div className="filter-group">
                    <label>Buscar:</label>
                    <input
                      type="text"
                      placeholder="Buscar por número de contrato..."
                      value={contractSearchTerm}
                      onChange={(e) => setContractSearchTerm(e.target.value)}
                      className="filter-input"
                    />
                  </div>

                  {/* Filtro por Plantilla */}
                  <div className="filter-group">
                    <label>Plantilla:</label>
                    <input
                      type="text"
                      placeholder="Filtrar por nombre de plantilla..."
                      value={contractTemplateFilter}
                      onChange={(e) => setContractTemplateFilter(e.target.value)}
                      className="filter-input"
                    />
                  </div>

                  {/* Filtro por Tercero */}
                  <div className="filter-group">
                    <label>Tercero:</label>
                    <input
                      type="text"
                      placeholder="Filtrar por nombre o identificación del tercero..."
                      value={contractTerceroFilter}
                      onChange={(e) => setContractTerceroFilter(e.target.value)}
                      className="filter-input"
                    />
                  </div>

                  {/* Filtro por Estado */}
                  <div className="filter-group">
                    <label>Estado:</label>
                    <div className="status-checkboxes">
                      {['borrador', 'revision', 'aprobado', 'firmado', 'cancelado'].map(status => (
                        <label key={status} className="checkbox-label">
                          <input
                            type="checkbox"
                            checked={contractStatusFilter.includes(status)}
                            onChange={() => handleContractStatusToggle(status)}
                          />
                          <span className={`status-label ${status}`}>{status}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Filtro por Rango de Fechas */}
                  <div className="filter-group-row">
                    <div className="filter-group">
                      <label>Fecha desde:</label>
                      <input
                        type="date"
                        value={contractStartDate}
                        onChange={(e) => setContractStartDate(e.target.value)}
                        className="filter-input"
                      />
                    </div>
                    <div className="filter-group">
                      <label>Fecha hasta:</label>
                      <input
                        type="date"
                        value={contractEndDate}
                        onChange={(e) => setContractEndDate(e.target.value)}
                        className="filter-input"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {loadingContracts ? (
              <div className="loading">Cargando contratos...</div>
            ) : contracts.length === 0 ? (
              <div className="empty-state">
                <h3>No hay contratos generados</h3>
                <p>Ve al tab "Crear Contrato" para generar tu primer contrato</p>
              </div>
            ) : filteredContracts.length === 0 ? (
              <div className="empty-state">
                <h3>No se encontraron contratos</h3>
                <p>Intenta ajustar los filtros para ver más resultados</p>
              </div>
            ) : (
              <div className="contracts-view">
                <div className="contracts-table-container">
                  <table className="contracts-table">
                    <thead>
                      <tr>
                        <th className="contract-number-col">N° Contrato</th>
                        <th className="contract-title-col">Título</th>
                        <th className="contract-template-col hide-mobile">Plantilla</th>
                        <th className="contract-tercero-col">Tercero</th>
                        <th className="contract-status-col">Estado</th>
                        <th className="contract-generator-col hide-tablet">Generado por</th>
                        <th className="contract-date-col hide-tablet">Fecha</th>
                        <th className="contract-time-col hide-mobile-tablet">Hora</th>
                        <th className="contract-actions-col">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredContracts.map((contract) => {
                        const createdDate = new Date(contract.createdAt);
                        // Extraer información del tercero del contenido o company_name
                        const terceroInfo = contract.company_name || 
                          (contract.content ? extractTerceroFromContent(contract.content) : 'N/A');
                        
                        return (
                          <tr key={contract._id}>
                            <td className="contract-number">
                              <div className="name-wrapper">
                                <span className="name-text">{contract.contract_number}</span>
                                <span className="mobile-meta">
                                  <span className="meta-item">{contract.template?.name || 'Sin plantilla'}</span>
                                  <span className="meta-item">{createdDate.toLocaleDateString('es-ES')}</span>
                                </span>
                              </div>
                            </td>
                            <td className="contract-title">
                              <div>
                                <strong>{contract.title || contract.contract_number}</strong>
                                {contract.description && (
                                  <div style={{ fontSize: '0.85rem', color: '#6c757d', marginTop: '0.25rem' }}>
                                    {contract.description.length > 50 
                                      ? contract.description.substring(0, 50) + '...' 
                                      : contract.description}
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="contract-template hide-mobile">
                              <span className="item-badge">{contract.template?.name || 'Sin plantilla'}</span>
                            </td>
                            <td className="contract-tercero">
                              <div>
                                <div style={{ fontWeight: '600', color: '#495057', marginBottom: '0.25rem' }}>
                                  {terceroInfo !== 'N/A' ? terceroInfo : (
                                    <span style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '0.9rem' }}>
                                      No disponible
                                    </span>
                                  )}
                                </div>
                                {contract.description && (
                                  <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.25rem' }}>
                                    {contract.description.length > 30 
                                      ? contract.description.substring(0, 30) + '...' 
                                      : contract.description}
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="contract-status">
                              <span className={`item-badge status-${contract.status}`}>
                                {contract.status}
                              </span>
                            </td>
                            <td className="contract-generator hide-tablet">
                              {contract.generated_by?.name || 'Usuario'}
                            </td>
                            <td className="contract-date hide-tablet">
                              {createdDate.toLocaleDateString('es-ES')}
                            </td>
                            <td className="contract-time hide-mobile-tablet">
                              {createdDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td className="contract-actions">
                              <div className="actions-buttons">
                                {contract.file_path && (
                                  <button
                                    className="btn-action btn-download"
                                    onClick={() => handleDownloadContract(contract._id, contract.contract_number)}
                                    title="Descargar Word"
                                  >
                                    📥
                                  </button>
                                )}
                                <button
                                  className="btn-action btn-delete"
                                  onClick={() => {
                                    if (window.confirm('¿Estás seguro de eliminar este contrato?')) {
                                      handleDeleteContract(contract._id);
                                    }
                                  }}
                                  title="Eliminar"
                                >
                                  🗑️
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal para generar contrato desde plantilla */}
      {showGenerateModal && selectedTemplateForGenerate && (
        <div className="modal-overlay" onClick={() => {
          setShowGenerateModal(false);
          setShowFieldSuggestions(false);
          setSuggestedFields([]);
          setShowThirdPartyConfigModal(false);
          setDetectedVariablesForConfig([]);
        }}>
          <div className="modal-content-generate" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-generate">
              <h2>🚀 Generar Contrato</h2>
              <p>Plantilla: <strong>{selectedTemplateForGenerate.name}</strong></p>
              <button
                className="modal-close"
                onClick={() => {
                  setShowGenerateModal(false);
                  setShowFieldSuggestions(false);
                  setSuggestedFields([]);
                  setShowThirdPartyConfigModal(false);
                  setDetectedVariablesForConfig([]);
                }}
              >
                ✕
              </button>
            </div>

            <div className="modal-body-generate">
              {/* Selector de Terceros */}
              <div className="supplier-selector">
                <h3>Seleccionar Tercero <span className="required">*</span></h3>
                <p>Selecciona el tercero con el cual se generará el contrato</p>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <select
                      value={selectedSupplier}
                      onChange={(e) => handleSupplierSelect(e.target.value)}
                      className="form-input"
                      required
                    >
                      <option value="">-- Seleccionar tercero --</option>
                      {suppliers
                        .filter(s => {
                          // Filtrar por activo
                          if (s.active === false) return false;

                          // Filtrar por categoría de la plantilla si está disponible
                          if (selectedTemplateForGenerate?.category && s.third_party_type_id) {
                            // Comparar el código del tipo de tercero con la categoría de la plantilla
                            return s.third_party_type_id === selectedTemplateForGenerate.category;
                          }

                          // Si no hay categoría en la plantilla o tipo en el tercero, mostrar todos
                          return true;
                        })
                        .map(supplier => (
                          <option key={supplier._id} value={supplier._id}>
                            {supplier.legal_name} - {supplier.identification_number}
                          </option>
                        ))
                      }
                    </select>
                  </div>
                  <button
                    type="button"
                    className="btn-create-supplier"
                    onClick={handleOpenNewSupplierModal}
                    style={{
                      padding: '10px 20px',
                      backgroundColor: '#4CAF50',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      fontWeight: '600'
                    }}
                  >
                    + Crear Tercero
                  </button>
                </div>

                {/* Botón para ver campos sugeridos */}
                <button
                  type="button"
                  onClick={handleShowFieldSuggestions}
                  style={{
                    marginTop: '10px',
                    padding: '8px 16px',
                    backgroundColor: '#2196F3',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    width: 'fit-content'
                  }}
                >
                  💡 Ver campos sugeridos para esta plantilla
                </button>

                {/* Mostrar sugerencias de campos */}
                {showFieldSuggestions && suggestedFields.length > 0 && (
                  <div style={{
                    marginTop: '15px',
                    padding: '15px',
                    backgroundColor: '#E3F2FD',
                    border: '2px solid #2196F3',
                    borderRadius: '6px'
                  }}>
                    <h4 style={{ margin: '0 0 10px 0', color: '#1976D2' }}>
                      📋 Campos necesarios para el tercero:
                    </h4>
                    <p style={{ fontSize: '13px', color: '#555', marginBottom: '10px' }}>
                      Basándonos en las variables de esta plantilla, el tercero debería tener los siguientes datos:
                    </p>
                    <ul style={{ margin: '0', paddingLeft: '20px', fontSize: '14px' }}>
                      {suggestedFields.filter((f: any) => !f.excluded).slice(0, 10).map((field: any, index: number) => (
                        <li key={index} style={{ marginBottom: '5px' }}>
                          <strong>{field.label}</strong>
                          {field.required && <span style={{ color: '#D32F2F', marginLeft: '5px' }}>*</span>}
                          <span style={{
                            marginLeft: '8px',
                            fontSize: '12px',
                            color: '#666',
                            backgroundColor: '#fff',
                            padding: '2px 6px',
                            borderRadius: '3px'
                          }}>
                            {field.field_type}
                          </span>
                        </li>
                      ))}
                    </ul>
                    {suggestedFields.filter((f: any) => !f.excluded).length > 10 && (
                      <p style={{ fontSize: '12px', color: '#666', marginTop: '10px', marginBottom: '0' }}>
                        ... y {suggestedFields.filter((f: any) => !f.excluded).length - 10} campos más
                      </p>
                    )}
                    <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                      <button
                        onClick={handleOpenThirdPartyConfigModal}
                        style={{
                          padding: '8px 16px',
                          backgroundColor: '#4CAF50',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '14px',
                          fontWeight: '600'
                        }}
                      >
                        🔧 Configurar Tipo de Tercero
                      </button>
                      <button
                        onClick={() => setShowFieldSuggestions(false)}
                        style={{
                          padding: '5px 12px',
                          backgroundColor: '#fff',
                          color: '#2196F3',
                          border: '1px solid #2196F3',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '13px'
                        }}
                      >
                        Ocultar sugerencias
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Campos del contrato */}
              <div className="contract-fields-modal">
                <h3>Datos del Contrato</h3>
                {getUniqueVariables(selectedTemplateForGenerate.fields || []).map((field: any, index: number) => (
                  <div key={index} className="field-group">
                    <label>
                      {field.field_label || field.field_name}
                      {field.required && <span className="required">*</span>}
                    </label>
                    <input
                      type="text"
                      value={contractData[field.field_name] || ''}
                      onChange={(e) => handleContractDataChange(field.field_name, e.target.value)}
                      placeholder={`Ingresa ${(field.field_label || field.field_name).toLowerCase()}`}
                      className="form-input"
                      required={field.required}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="modal-footer-generate">
              <button
                className="btn-cancel"
                onClick={() => {
                  setShowGenerateModal(false);
                  setShowFieldSuggestions(false);
                  setSuggestedFields([]);
                  setShowThirdPartyConfigModal(false);
                  setDetectedVariablesForConfig([]);
                }}
              >
                Cancelar
              </button>
              <button
                className="btn-generate-final"
                onClick={handleGenerateFromTemplate}
                disabled={isGenerating}
              >
                {isGenerating ? 'Generando...' : '🚀 Generar Contrato'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para crear nuevo tercero */}
      {showNewSupplierModal && (
        <div className="modal-overlay" onClick={() => setShowNewSupplierModal(false)}>
          <div className="modal-content-generate" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="modal-header-generate">
              <h2>Crear Nuevo Tercero</h2>
              <button
                className="modal-close"
                onClick={() => setShowNewSupplierModal(false)}
              >
                ✕
              </button>
            </div>

            <div className="modal-body-generate" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              <div className="contract-fields-modal">
                {/* PASO 1: Seleccionar Tipo de Tercero */}
                <div className="field-group" style={{
                  backgroundColor: '#f0f9ff',
                  padding: '15px',
                  borderRadius: '8px',
                  border: '2px solid #3b82f6',
                  marginBottom: '20px'
                }}>
                  <label style={{ fontSize: '16px', fontWeight: '600', color: '#1e40af' }}>
                    1. Tipo de Tercero <span className="required">*</span>
                  </label>
                  <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '10px' }}>
                    Selecciona el tipo de tercero para cargar los campos correspondientes
                  </p>
                  <select
                    value={selectedThirdPartyType}
                    onChange={(e) => handleThirdPartyTypeSelect(e.target.value)}
                    className="form-input"
                    style={{ fontSize: '14px', padding: '12px' }}
                  >
                    <option value="">-- Selecciona un tipo --</option>
                    {thirdPartyTypes.map((type) => (
                      <option key={type._id} value={type._id}>
                        {type.icon} {type.label}
                      </option>
                    ))}
                    <option
                      value="__CREATE_NEW__"
                      style={{
                        backgroundColor: '#f0fdf4',
                        color: '#16a34a',
                        fontWeight: '600'
                      }}
                    >
                      + Crear Nuevo Tipo de Tercero
                    </option>
                  </select>
                </div>

                {/* Mensaje cuando se selecciona un tipo sin campos */}
                {selectedThirdPartyType && selectedThirdPartyType !== '__CREATE_NEW__' && dynamicFields.length === 0 && (
                  <div style={{
                    backgroundColor: '#fef3c7',
                    border: '2px solid #f59e0b',
                    borderRadius: '8px',
                    padding: '20px',
                    marginBottom: '20px',
                    textAlign: 'center'
                  }}>
                    <p style={{ fontSize: '16px', fontWeight: '600', color: '#92400e', marginBottom: '10px' }}>
                      ⚠️ Este tipo de tercero no tiene campos configurados
                    </p>
                    <p style={{ fontSize: '14px', color: '#78350f', marginBottom: '15px' }}>
                      Para poder crear terceros de este tipo, primero debes configurar los campos desde el módulo de Gestión de Tipos de Terceros o desde una plantilla Word.
                    </p>
                    <p style={{ fontSize: '13px', color: '#78350f', fontStyle: 'italic' }}>
                      💡 Sugerencia: Sube una plantilla Word con variables y el sistema te ayudará a configurar los campos automáticamente.
                    </p>
                  </div>
                )}

                {/* PASO 2: Mostrar campos dinámicos si hay un tipo seleccionado */}
                {selectedThirdPartyType && dynamicFields.length > 0 && (
                  <div>
                    <h3 style={{ marginBottom: '15px', color: '#1e293b' }}>
                      2. Información del Tercero
                    </h3>

                    {/* Renderizar cada campo dinámicamente */}
                    {dynamicFields.filter(f => f.name !== 'legal_name_short').map((field, index) => (
                      <div key={field.name || index} className="field-group">
                        <label>
                          {field.label}
                          {field.required && <span className="required"> *</span>}
                        </label>

                        {/* Renderizar campo según su tipo */}
                        {field.field_type === 'text' && (
                          <input
                            type="text"
                            value={dynamicFormData[field.name] || ''}
                            onChange={(e) => {
                              const updatedData: Record<string, any> = {
                                ...dynamicFormData,
                                [field.name]: e.target.value
                              };
                              // Si es legal_name, copiar automáticamente a legal_name_short
                              if (field.name === 'legal_name') {
                                updatedData.legal_name_short = e.target.value;
                              }
                              setDynamicFormData(updatedData);
                            }}
                            placeholder={`Ingrese ${field.label.toLowerCase()}`}
                            className="form-input"
                            required={field.required}
                          />
                        )}

                        {field.field_type === 'email' && (
                          <input
                            type="email"
                            value={dynamicFormData[field.name] || ''}
                            onChange={(e) => setDynamicFormData({
                              ...dynamicFormData,
                              [field.name]: e.target.value
                            })}
                            placeholder={`Ingrese ${field.label.toLowerCase()}`}
                            className="form-input"
                            required={field.required}
                          />
                        )}

                        {field.field_type === 'phone' && (
                          <input
                            type="tel"
                            value={dynamicFormData[field.name] || ''}
                            onChange={(e) => setDynamicFormData({
                              ...dynamicFormData,
                              [field.name]: e.target.value
                            })}
                            placeholder={`Ingrese ${field.label.toLowerCase()}`}
                            className="form-input"
                            required={field.required}
                          />
                        )}

                        {field.field_type === 'number' && (
                          <input
                            type="number"
                            value={dynamicFormData[field.name] || ''}
                            onChange={(e) => setDynamicFormData({
                              ...dynamicFormData,
                              [field.name]: e.target.value
                            })}
                            placeholder={`Ingrese ${field.label.toLowerCase()}`}
                            className="form-input"
                            required={field.required}
                          />
                        )}

                        {field.field_type === 'date' && (
                          <input
                            type="date"
                            value={dynamicFormData[field.name] || ''}
                            onChange={(e) => setDynamicFormData({
                              ...dynamicFormData,
                              [field.name]: e.target.value
                            })}
                            className="form-input"
                            required={field.required}
                          />
                        )}

                        {field.field_type === 'textarea' && (
                          <textarea
                            value={dynamicFormData[field.name] || ''}
                            onChange={(e) => setDynamicFormData({
                              ...dynamicFormData,
                              [field.name]: e.target.value
                            })}
                            placeholder={`Ingrese ${field.label.toLowerCase()}`}
                            className="form-input"
                            rows={3}
                            required={field.required}
                          />
                        )}

                        {field.field_type === 'select' && field.options && (
                          <select
                            value={dynamicFormData[field.name] || ''}
                            onChange={(e) => setDynamicFormData({
                              ...dynamicFormData,
                              [field.name]: e.target.value
                            })}
                            className="form-input"
                            required={field.required}
                          >
                            <option value="">-- Seleccione --</option>
                            {field.options.map((option: string, idx: number) => (
                              <option key={idx} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        )}

                        {field.field_type === 'checkbox' && (
                          <div style={{ marginTop: '5px' }}>
                            <label style={{ display: 'flex', alignItems: 'center', fontWeight: 'normal' }}>
                              <input
                                type="checkbox"
                                checked={dynamicFormData[field.name] || false}
                                onChange={(e) => setDynamicFormData({
                                  ...dynamicFormData,
                                  [field.name]: e.target.checked
                                })}
                                style={{ marginRight: '8px', width: '18px', height: '18px' }}
                              />
                              {field.label}
                            </label>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Mensaje si no se ha seleccionado tipo */}
                {!selectedThirdPartyType && (
                  <div style={{
                    padding: '30px',
                    textAlign: 'center',
                    color: '#64748b',
                    backgroundColor: '#f8fafc',
                    borderRadius: '8px',
                    border: '2px dashed #cbd5e1'
                  }}>
                    <div style={{ fontSize: '48px', marginBottom: '10px' }}>📋</div>
                    <p style={{ margin: '0', fontSize: '14px' }}>
                      Selecciona un tipo de tercero para ver los campos disponibles
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="modal-footer-generate">
              <button
                className="btn-cancel"
                onClick={() => setShowNewSupplierModal(false)}
              >
                Cancelar
              </button>
              <button
                className="btn-generate-final"
                onClick={handleCreateNewSupplier}
                disabled={!selectedThirdPartyType || dynamicFields.length === 0}
                style={{
                  backgroundColor: selectedThirdPartyType && dynamicFields.length > 0 ? '#4CAF50' : '#94a3b8',
                  cursor: selectedThirdPartyType && dynamicFields.length > 0 ? 'pointer' : 'not-allowed'
                }}
              >
                Guardar Tercero
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de crear nuevo tipo de tercero */}
      {showCreateTypeModal && (
        <div className="modal-overlay" onClick={() => setShowCreateTypeModal(false)}>
          <div className="modal-content-generate" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '700px' }}>
            <div className="modal-header-generate">
              <h2>Crear Nuevo Tipo de Tercero</h2>
              <button
                className="modal-close"
                onClick={() => setShowCreateTypeModal(false)}
              >
                ✕
              </button>
            </div>

            <div className="modal-body-generate" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              <div className="contract-fields-modal">
                <div style={{
                  backgroundColor: '#f8fafc',
                  padding: '20px',
                  borderRadius: '8px',
                  marginBottom: '20px'
                }}>
                  <h3 style={{ margin: '0 0 15px 0', color: '#334155' }}>Información General</h3>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                    {/* Código */}
                    <div className="field-group">
                      <label>Código <span className="required">*</span></label>
                      <input
                        type="text"
                        value={newTypeData.code}
                        onChange={(e) => setNewTypeData({
                          ...newTypeData,
                          code: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '')
                        })}
                        placeholder="ej: proveedor"
                        className="form-input"
                        style={{ fontFamily: 'monospace' }}
                      />
                      <small style={{ fontSize: '12px', color: '#64748b', display: 'block', marginTop: '4px' }}>
                        Solo letras minúsculas, números y guión bajo
                      </small>
                    </div>

                    {/* Ícono */}
                    <div className="field-group">
                      <label>Ícono</label>
                      <input
                        type="text"
                        value={newTypeData.icon}
                        onChange={(e) => setNewTypeData({
                          ...newTypeData,
                          icon: e.target.value
                        })}
                        placeholder="📄"
                        className="form-input"
                        style={{ fontSize: '24px', textAlign: 'center' }}
                        maxLength={2}
                      />
                      <small style={{ fontSize: '12px', color: '#64748b', display: 'block', marginTop: '4px' }}>
                        Emoji que representa el tipo
                      </small>
                    </div>
                  </div>

                  {/* Nombre */}
                  <div className="field-group" style={{ marginTop: '20px' }}>
                    <label>Nombre <span className="required">*</span></label>
                    <input
                      type="text"
                      value={newTypeData.label}
                      onChange={(e) => {
                        setNewTypeData({
                          ...newTypeData,
                          label: e.target.value,
                          // Auto-generar código si está vacío
                          code: newTypeData.code || e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '_')
                        });
                      }}
                      placeholder="Proveedor"
                      className="form-input"
                    />
                    <small style={{ fontSize: '12px', color: '#64748b', display: 'block', marginTop: '4px' }}>
                      Nombre descriptivo del tipo de tercero
                    </small>
                  </div>

                  {/* Descripción */}
                  <div className="field-group" style={{ marginTop: '20px' }}>
                    <label>Descripción</label>
                    <textarea
                      value={newTypeData.description}
                      onChange={(e) => setNewTypeData({
                        ...newTypeData,
                        description: e.target.value
                      })}
                      placeholder="Descripción del tipo de tercero"
                      className="form-input"
                      rows={3}
                      style={{ resize: 'vertical' }}
                    />
                  </div>
                </div>

                <div style={{
                  backgroundColor: '#fffbeb',
                  border: '1px solid #fbbf24',
                  borderRadius: '8px',
                  padding: '12px',
                  display: 'flex',
                  gap: '10px',
                  alignItems: 'flex-start'
                }}>
                  <span style={{ fontSize: '20px' }}>ℹ️</span>
                  <div style={{ fontSize: '13px', color: '#92400e' }}>
                    <strong>Nota:</strong> El tipo se creará sin campos inicialmente.
                    Después podrás configurar los campos desde el modal de configuración de tipos.
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-footer-generate">
              <button
                className="btn-cancel"
                onClick={() => {
                  setShowCreateTypeModal(false);
                  setNewTypeData({
                    code: '',
                    label: '',
                    description: '',
                    icon: '📄'
                  });
                }}
              >
                Cancelar
              </button>
              <button
                className="btn-generate-final"
                onClick={handleCreateNewType}
                disabled={!newTypeData.code.trim() || !newTypeData.label.trim()}
                style={{
                  backgroundColor: newTypeData.code.trim() && newTypeData.label.trim() ? '#10b981' : '#94a3b8',
                  cursor: newTypeData.code.trim() && newTypeData.label.trim() ? 'pointer' : 'not-allowed'
                }}
              >
                Crear Tipo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de configuración de tipo de tercero */}
      {showThirdPartyConfigModal && selectedTemplateForGenerate && (
        <ThirdPartyFieldConfigModal
          isOpen={showThirdPartyConfigModal}
          onClose={handleCloseThirdPartyConfigModal}
          detectedVariables={detectedVariablesForConfig}
          thirdPartyTypeCode={selectedTemplateForGenerate.category || 'otro'}
          onConfigApplied={async (typeId: string) => {
            console.log('🎯 Tipo de tercero configurado, abriendo modal de creación con tipo:', typeId);

            // Cerrar modal de configuración
            handleCloseThirdPartyConfigModal();

            // Refrescar lista de tipos de terceros
            await fetchThirdPartyTypes();

            // Abrir modal de crear nuevo tercero
            setShowNewSupplierModal(true);

            // Pre-seleccionar el tipo recién creado y cargar sus campos
            await handleThirdPartyTypeSelect(typeId);

            console.log('✅ Modal de creación de tercero abierto con tipo pre-seleccionado');
          }}
        />
      )}

      {/* Modal de Edición de Plantilla */}
      {showEditModal && selectedTemplateForEdit && (
        <div className="modal-overlay" onClick={handleCloseEditModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Editar Plantilla</h2>
              <button className="modal-close" onClick={handleCloseEditModal}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Nombre de la Plantilla *</label>
                <input
                  type="text"
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                  placeholder="Nombre de la plantilla"
                  className="form-input"
                />
              </div>
              <div className="form-group">
                <label>Descripción</label>
                <textarea
                  value={editFormData.description}
                  onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                  placeholder="Descripción de la plantilla"
                  className="form-input"
                  rows={3}
                />
              </div>
              <div className="form-group">
                <label>Categoría</label>
                <input
                  type="text"
                  value={editFormData.category}
                  onChange={(e) => setEditFormData({ ...editFormData, category: e.target.value })}
                  placeholder="Categoría de la plantilla"
                  className="form-input"
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={handleCloseEditModal}>
                Cancelar
              </button>
              <button className="btn-primary" onClick={handleSaveTemplateEdit}>
                Guardar Cambios
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UnifiedTemplates;
