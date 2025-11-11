import React, { useState, useEffect } from 'react';
import api from '../services/api';
import './Suppliers.css';
import FieldSuggestionsPanel from './FieldSuggestionsPanel';
import FieldMerger from './FieldMerger';

interface ThirdPartyType {
  _id: string;
  code: string;
  label: string;
  icon: string;
  description: string;
  fields: any[];
  default_identification_types?: string[];
}

interface Supplier {
  _id: string;
  identification_type: string;
  identification_number: string;
  id_issue_city?: string; // Ciudad de expedición del documento
  legal_name: string;
  legal_name_short: string;
  legal_representative_name: string;
  legal_representative_id_type: string;
  legal_representative_id_number: string;
  licensee_name?: string; // Nombre del Licenciatario (para PH)
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
  active: boolean;
  approval_status: 'pending' | 'approved' | 'rejected';
  approved_by?: {
    name: string;
    email: string;
  };
  approved_at?: string;
  rejection_reason?: string;
  third_party_type?: ThirdPartyType;
  custom_fields?: { [key: string]: any };
  createdAt: string;
  created_by?: {
    name: string;
    email: string;
  };
  canDelete?: boolean; // Indica si se puede eliminar (basado en referencias)
  hasReferences?: boolean; // Indica si tiene referencias en contratos/plantillas
  referenceDetails?: {
    contracts: number;
    templates: number;
  };
}

interface SupplierFormData {
  identification_type: string;
  identification_number: string;
  id_issue_city: string; // Ciudad de expedición del documento
  legal_name: string;
  legal_name_short: string;
  full_name: string; // Para personas naturales
  legal_representative_name: string;
  legal_representative_id_type: string;
  legal_representative_id_number: string;
  licensee_name: string; // Nombre del Licenciatario (para PH)
  email: string;
  phone: string;
  address: string;
  city: string;
  country: string;
  third_party_type: string;
  custom_fields: { [key: string]: any };
}

// Datos de países y ciudades
const countriesWithCities: { [key: string]: string[] } = {
  'Colombia': [
    'Bogotá', 'Medellín', 'Cali', 'Barranquilla', 'Cartagena',
    'Cúcuta', 'Bucaramanga', 'Pereira', 'Santa Marta', 'Ibagué',
    'Pasto', 'Manizales', 'Neiva', 'Villavicencio', 'Armenia',
    'Valledupar', 'Montería', 'Popayán', 'Sincelejo', 'Tunja'
  ],
  'Estados Unidos': [
    'Nueva York', 'Los Ángeles', 'Chicago', 'Houston', 'Phoenix',
    'Filadelfia', 'San Antonio', 'San Diego', 'Dallas', 'San José',
    'Austin', 'Jacksonville', 'Fort Worth', 'Columbus', 'Charlotte'
  ],
  'México': [
    'Ciudad de México', 'Guadalajara', 'Monterrey', 'Puebla', 'Tijuana',
    'León', 'Juárez', 'Zapopan', 'Mérida', 'San Luis Potosí',
    'Aguascalientes', 'Hermosillo', 'Saltillo', 'Mexicali', 'Culiacán'
  ],
  'España': [
    'Madrid', 'Barcelona', 'Valencia', 'Sevilla', 'Zaragoza',
    'Málaga', 'Murcia', 'Palma', 'Las Palmas', 'Bilbao',
    'Alicante', 'Córdoba', 'Valladolid', 'Vigo', 'Gijón'
  ],
  'Argentina': [
    'Buenos Aires', 'Córdoba', 'Rosario', 'Mendoza', 'La Plata',
    'San Miguel de Tucumán', 'Mar del Plata', 'Salta', 'Santa Fe', 'San Juan',
    'Resistencia', 'Santiago del Estero', 'Corrientes', 'Posadas', 'Bahía Blanca'
  ],
  'Chile': [
    'Santiago', 'Valparaíso', 'Concepción', 'La Serena', 'Antofagasta',
    'Temuco', 'Rancagua', 'Talca', 'Arica', 'Chillán',
    'Iquique', 'Los Ángeles', 'Puerto Montt', 'Coquimbo', 'Osorno'
  ],
  'Perú': [
    'Lima', 'Arequipa', 'Trujillo', 'Chiclayo', 'Piura',
    'Iquitos', 'Cusco', 'Huancayo', 'Chimbote', 'Tacna',
    'Juliaca', 'Ica', 'Sullana', 'Ayacucho', 'Cajamarca'
  ],
  'Ecuador': [
    'Quito', 'Guayaquil', 'Cuenca', 'Santo Domingo', 'Machala',
    'Durán', 'Manta', 'Portoviejo', 'Loja', 'Ambato',
    'Esmeraldas', 'Quevedo', 'Riobamba', 'Milagro', 'Ibarra'
  ],
  'Brasil': [
    'São Paulo', 'Río de Janeiro', 'Brasilia', 'Salvador', 'Fortaleza',
    'Belo Horizonte', 'Manaos', 'Curitiba', 'Recife', 'Porto Alegre',
    'Belém', 'Goiânia', 'Guarulhos', 'Campinas', 'São Luís'
  ],
  'Venezuela': [
    'Caracas', 'Maracaibo', 'Valencia', 'Barquisimeto', 'Maracay',
    'Ciudad Guayana', 'Barcelona', 'Maturín', 'Puerto La Cruz', 'Petare',
    'Turmero', 'Ciudad Bolívar', 'Mérida', 'Santa Teresa', 'Valera'
  ],
  'Panamá': [
    'Ciudad de Panamá', 'San Miguelito', 'Tocumen', 'David', 'Arraiján',
    'Colón', 'Las Cumbres', 'La Chorrera', 'Pacora', 'Santiago',
    'Chitré', 'Penonomé', 'Changuinola', 'Aguadulce', 'Bocas del Toro'
  ],
  'Costa Rica': [
    'San José', 'Limón', 'San Francisco', 'Alajuela', 'Heredia',
    'Cartago', 'Puntarenas', 'Liberia', 'Paraíso', 'Curridabat',
    'San Vicente', 'San Isidro', 'Desamparados', 'Purral', 'San Felipe'
  ]
};

const Suppliers: React.FC = () => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [filteredSuppliers, setFilteredSuppliers] = useState<Supplier[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [thirdPartyTypes, setThirdPartyTypes] = useState<ThirdPartyType[]>([]);
  const [formData, setFormData] = useState<SupplierFormData>({
    identification_type: '',
    identification_number: '',
    id_issue_city: '',
    legal_name: '',
    legal_name_short: '',
    full_name: '', // Para personas naturales
    legal_representative_name: '',
    legal_representative_id_type: 'CC',
    legal_representative_id_number: '',
    licensee_name: '', // Nombre del Licenciatario (para PH)
    email: '',
    phone: '',
    address: '',
    city: '',
    country: 'Colombia',
    third_party_type: '',
    custom_fields: {}
  });

  useEffect(() => {
    console.log('🔵 Suppliers component loaded - VERSION 2025-11-11-00:25 with supplier extraction fix');
    fetchSuppliers();
    fetchThirdPartyTypes();
  }, []);

  // Filtrar terceros por tipo, razón social, número ID o email
  useEffect(() => {
    let filtered = suppliers;

    // Filter by type
    if (filterType !== 'all') {
      filtered = filtered.filter(s => s.third_party_type?.code === filterType);
    }

    // Filter by search term (legal name, ID number, or email)
    if (searchTerm.trim() !== '') {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(supplier =>
        supplier.legal_name.toLowerCase().includes(searchLower) ||
        supplier.identification_number.toLowerCase().includes(searchLower) ||
        (supplier.email && supplier.email.toLowerCase().includes(searchLower))
      );
    }

    setFilteredSuppliers(filtered);
  }, [searchTerm, filterType, suppliers]);

  const fetchThirdPartyTypes = async () => {
    try {
      // Agregar cache-busting con timestamp para forzar recarga
      const cacheBuster = `?t=${Date.now()}`;
      const response = await api.get(`/suppliers/types${cacheBuster}`);
      const types = response.data.types || [];

      console.log('🔍 [DEBUG] Tipos de terceros recibidos:', types.length);
      console.log('📋 [DEBUG] Códigos:', types.map((t: ThirdPartyType) => t.code).join(', '));
      console.log('✅ [DEBUG] Tiene Propiedad Horizontal (ph):', types.some((t: ThirdPartyType) => t.code === 'ph'));
      console.log('✅ [DEBUG] Tiene Contador PH (contador_ph):', types.some((t: ThirdPartyType) => t.code === 'contador_ph'));

      setThirdPartyTypes(types);
    } catch (error) {
      console.error('Error fetching third party types:', error);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const response = await api.get('/suppliers');
      const suppliersData = response.data.suppliers || [];

      // Verificar referencias para cada tercero
      const suppliersWithReferenceInfo = await Promise.all(
        suppliersData.map(async (supplier: Supplier) => {
          try {
            const refResponse = await api.get(`/suppliers/${supplier._id}/check-references`);
            const { references } = refResponse.data;

            return {
              ...supplier,
              canDelete: references.canDelete,
              hasReferences: references.hasReferences,
              referenceDetails: references.details
            };
          } catch (error) {
            console.error(`Error checking references for supplier ${supplier._id}:`, error);
            return {
              ...supplier,
              canDelete: false, // Por seguridad
              hasReferences: false
            };
          }
        })
      );

      setSuppliers(suppliersWithReferenceInfo);
    } catch (error) {
      console.error('Error fetching suppliers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSupplier = async () => {
    const isCompany = formData.identification_type === 'NIT';

    // Validar según el tipo
    if (isCompany) {
      if (!formData.legal_name.trim()) {
        alert('La razón social es requerida');
        return;
      }
      if (!formData.legal_representative_name.trim()) {
        alert('El nombre del representante legal es requerido');
        return;
      }
    } else {
      if (!formData.full_name.trim()) {
        alert('El nombre completo es requerido');
        return;
      }
    }

    try {
      // Preparar datos según el tipo
      const dataToSend = isCompany ? {
        ...formData,
        full_name: undefined // No enviar full_name para empresas
      } : {
        ...formData,
        legal_name: formData.full_name, // Usar full_name como legal_name
        legal_name_short: formData.full_name,
        legal_representative_name: undefined,
        legal_representative_id_type: undefined,
        legal_representative_id_number: undefined
      };

      await api.post('/suppliers', dataToSend);
      await fetchSuppliers();
      setShowCreateModal(false);
      resetForm();
    } catch (error: any) {
      console.error('Error creating supplier:', error);
      alert(error.response?.data?.error || 'Error al crear proveedor');
    }
  };

  // Función para recargar el supplier actual después de cambios (fusión, agregado de campos, etc.)
  const reloadCurrentSupplier = async () => {
    if (!editingSupplier?._id) return;

    try {
      console.log('🔄 Recargando supplier actual:', editingSupplier._id);
      const response = await api.get(`/suppliers/${editingSupplier._id}`);
      // El backend devuelve {success: true, supplier: {...}}, necesitamos extraer el supplier
      const updatedSupplier = response.data.supplier || response.data;

      console.log('📦 Response completo:', response.data);
      console.log('📦 Supplier extraído:', updatedSupplier);
      console.log('📦 Custom fields del backend:', updatedSupplier.custom_fields);
      console.log('📦 identification_type:', updatedSupplier.identification_type);
      console.log('📦 identification_number:', updatedSupplier.identification_number);
      console.log('📦 legal_name:', updatedSupplier.legal_name);
      console.log('📦 third_party_type:', updatedSupplier.third_party_type);

      // Actualizar editingSupplier
      setEditingSupplier(updatedSupplier);

      // Actualizar formData con los datos actualizados (mapear igual que openEditModal)
      const country = updatedSupplier.country || 'Colombia';
      const newFormData = {
        identification_type: updatedSupplier.identification_type,
        identification_number: updatedSupplier.identification_number,
        id_issue_city: updatedSupplier.id_issue_city || '',
        legal_name: updatedSupplier.legal_name,
        legal_name_short: updatedSupplier.legal_name_short,
        full_name: updatedSupplier.legal_name, // Para personas naturales
        legal_representative_name: updatedSupplier.legal_representative_name,
        legal_representative_id_type: updatedSupplier.legal_representative_id_type,
        legal_representative_id_number: updatedSupplier.legal_representative_id_number,
        licensee_name: updatedSupplier.licensee_name || '',
        email: updatedSupplier.email || '',
        phone: updatedSupplier.phone || '',
        address: updatedSupplier.address || '',
        city: updatedSupplier.city || '',
        country: country,
        third_party_type: updatedSupplier.third_party_type?._id || '',
        custom_fields: updatedSupplier.custom_fields || {}
      };

      console.log('📝 Nuevo formData completo:', newFormData);
      console.log('📝 Nuevo formData.custom_fields:', newFormData.custom_fields);
      console.log('📝 Nuevo formData.third_party_type:', newFormData.third_party_type);
      setFormData(newFormData);

      console.log('✅ Supplier recargado exitosamente - formData actualizado');
    } catch (error: any) {
      console.error('❌ Error recargando supplier:', error);
    }
  };

  const handleEditSupplier = async () => {
    if (!editingSupplier) return;

    console.log('🚀 Iniciando actualización de tercero');
    console.log('📋 formData.custom_fields antes de enviar:', formData.custom_fields);

    const isCompany = formData.identification_type === 'NIT';

    // Validar según el tipo
    if (isCompany) {
      if (!formData.legal_name.trim()) {
        alert('La razón social es requerida');
        return;
      }
      if (!formData.legal_representative_name.trim()) {
        alert('El nombre del representante legal es requerido');
        return;
      }
    } else {
      if (!formData.full_name.trim()) {
        alert('El nombre completo es requerido');
        return;
      }
    }

    try {
      // Preparar datos según el tipo
      const dataToSend = isCompany ? {
        ...formData,
        full_name: undefined // No enviar full_name para empresas
      } : {
        ...formData,
        legal_name: formData.full_name, // Usar full_name como legal_name
        legal_name_short: formData.full_name,
        legal_representative_name: undefined,
        legal_representative_id_type: undefined,
        legal_representative_id_number: undefined
      };

      console.log('📤 dataToSend.custom_fields:', dataToSend.custom_fields);
      console.log('🔍 Todas las claves de custom_fields:', Object.keys(dataToSend.custom_fields || {}));

      const updateResponse = await api.put(`/suppliers/${editingSupplier._id}`, dataToSend);
      console.log('✅ Tercero actualizado exitosamente');
      console.log('📤 Respuesta del servidor:', updateResponse.data);

      await fetchSuppliers();
      setShowEditModal(false);
      setEditingSupplier(null);
      resetForm();
    } catch (error: any) {
      console.error('❌ Error updating supplier:', error);
      alert(error.response?.data?.error || 'Error al actualizar proveedor');
    }
  };

  const handleToggleStatus = async (supplier: Supplier) => {
    try {
      await api.patch(`/suppliers/${supplier._id}/toggle-status`);
      await fetchSuppliers();
    } catch (error: any) {
      console.error('Error toggling supplier status:', error);
      alert(error.response?.data?.error || 'Error al cambiar estado del proveedor');
    }
  };

  const handleDeleteSupplier = async (supplier: Supplier) => {
    // Primero verificar si tiene referencias
    try {
      const checkResponse = await api.get(`/suppliers/${supplier._id}/check-references`);
      const { references } = checkResponse.data;

      if (!references.canDelete) {
        const message = `No se puede eliminar este tercero porque tiene:\n` +
          `- ${references.details.contracts} contrato(s) asociado(s)\n` +
          `- ${references.details.templates} plantilla(s) del mismo tipo\n\n` +
          `Desactívalo en lugar de eliminarlo para mantener la integridad de los datos.`;
        alert(message);
        return;
      }

      // Si puede eliminar, pedir confirmación
      if (!window.confirm(`¿Está seguro de eliminar el tercero "${supplier.legal_name}"?\n\nEsta acción no se puede deshacer.`)) {
        return;
      }

      await api.delete(`/suppliers/${supplier._id}`);
      await fetchSuppliers();
    } catch (error: any) {
      console.error('Error deleting supplier:', error);

      if (error.response?.data?.suggestion) {
        alert(`${error.response.data.error}\n\n${error.response.data.suggestion}`);
      } else {
        alert(error.response?.data?.error || 'Error al eliminar tercero');
      }
    }
  };

  const handleCountryChange = (country: string) => {
    const cities = countriesWithCities[country] || [];
    setFormData({
      ...formData,
      country: country,
      city: cities.length > 0 ? cities[0] : ''
    });
  };

  const openEditModal = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    const country = supplier.country || 'Colombia';
    setFormData({
      identification_type: supplier.identification_type,
      identification_number: supplier.identification_number,
      id_issue_city: supplier.id_issue_city || '',
      legal_name: supplier.legal_name,
      legal_name_short: supplier.legal_name_short,
      full_name: supplier.legal_name, // Para personas naturales, usar legal_name como full_name
      legal_representative_name: supplier.legal_representative_name,
      legal_representative_id_type: supplier.legal_representative_id_type,
      legal_representative_id_number: supplier.legal_representative_id_number,
      licensee_name: supplier.licensee_name || '',
      email: supplier.email || '',
      phone: supplier.phone || '',
      address: supplier.address || '',
      city: supplier.city || '',
      country: country,
      third_party_type: supplier.third_party_type?._id || '',
      custom_fields: supplier.custom_fields || {}
    });
    setShowEditModal(true);
  };

  const resetForm = () => {
    setFormData({
      identification_type: 'NIT',
      identification_number: '',
      id_issue_city: '',
      legal_name: '',
      legal_name_short: '',
      full_name: '', // Para personas naturales
      legal_representative_name: '',
      legal_representative_id_type: 'CC',
      legal_representative_id_number: '',
      licensee_name: '',
      email: '',
      phone: '',
      address: '',
      city: '',
      country: 'Colombia',
      third_party_type: '',
      custom_fields: {}
    });
  };

  const isFormValid = () => {
    const isCompany = formData.identification_type === 'NIT';

    console.log('=== VALIDACIÓN DE FORMULARIO ===');
    console.log('Tipo de tercero:', formData.third_party_type);
    console.log('Tipos disponibles:', thirdPartyTypes.length);
    console.log('Tipo de identificación:', formData.identification_type);
    console.log('Número de identificación:', formData.identification_number);
    console.log('Es empresa:', isCompany);
    console.log('Nombre completo:', formData.full_name);
    console.log('Razón social:', formData.legal_name);

    // Validar que haya tipo de tercero si hay tipos disponibles
    if (thirdPartyTypes.length > 0 && !formData.third_party_type) {
      console.log('❌ Falta tipo de tercero');
      return false;
    }

    // Campos comunes
    if (!formData.identification_type || !formData.identification_number) {
      console.log('❌ Falta tipo o número de identificación');
      return false;
    }

    if (isCompany) {
      // Para empresas: validar razón social y representante legal
      const valid = !!(formData.legal_name &&
             formData.legal_name_short &&
             formData.legal_representative_name &&
             formData.legal_representative_id_type &&
             formData.legal_representative_id_number);
      console.log('Validación empresa:', valid);
      return valid;
    } else {
      // Para personas naturales: solo validar nombre completo
      const valid = !!(formData.full_name && formData.full_name.trim());
      console.log('Validación persona natural:', valid);
      return valid;
    }
  };

  const getMissingFields = () => {
    const isCompany = formData.identification_type === 'NIT';
    const missing = [];

    // Tipo de tercero (si hay tipos disponibles)
    if (thirdPartyTypes.length > 0 && !formData.third_party_type) missing.push('Tipo de Tercero');

    // Campos comunes
    if (!formData.identification_type) missing.push('Tipo de Identificación');
    if (!formData.identification_number) missing.push('Número de Identificación');

    if (isCompany) {
      // Campos para empresas
      if (!formData.legal_name) missing.push('Razón Social');
      if (!formData.legal_name_short) missing.push('Nombre Corto');
      if (!formData.legal_representative_name) missing.push('Nombre del Representante Legal');
      if (!formData.legal_representative_id_type) missing.push('Tipo de ID del Representante');
      if (!formData.legal_representative_id_number) missing.push('Número de ID del Representante');
    } else {
      // Campos para personas naturales
      if (!formData.full_name || !formData.full_name.trim()) missing.push('Nombre Completo');
    }

    return missing;
  };

  if (loading) {
    return <div className="loading">Cargando terceros...</div>;
  }

  return (
    <div className="suppliers">
      <div className="gradient-header">
        <div className="header-content">
          <div className="header-text">
            <h1>Gestión de Terceros</h1>
            <p>Administra proveedores, clientes y contactos de tu organización</p>
          </div>
          <button
            className="btn-create-supplier"
            onClick={() => setShowCreateModal(true)}
          >
            + Nuevo Tercero
          </button>
        </div>
      </div>

      <div className="filters-container">
        <div className="filters-row">
          <select
            className="filter-select"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="all">Todos los tipos</option>
            {thirdPartyTypes.map((type) => (
              <option key={type._id} value={type.code}>
                {type.icon} {type.label}
              </option>
            ))}
          </select>
          <input
            type="text"
            className="search-input"
            placeholder="Buscar por razón social, número ID o email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <div className="results-badge">
            {filteredSuppliers.length} {filteredSuppliers.length === 1 ? 'tercero' : 'terceros'}
          </div>
        </div>
      </div>

      <div className="suppliers-list">
        {filteredSuppliers.length === 0 ? (
          <div className="empty-state">
            <h3>{suppliers.length === 0 ? 'No hay terceros' : 'No se encontraron terceros'}</h3>
            <p>{suppliers.length === 0 ? 'Agrega tu primer tercero para comenzar' : 'Intenta con otro término de búsqueda'}</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="suppliers-table-compact">
              <thead>
                <tr>
                  <th>Estado</th>
                  <th>Tipo</th>
                  <th>Información del Tercero</th>
                  <th>Identificación</th>
                  <th>Contacto</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredSuppliers.map((supplier) => (
                  <tr key={supplier._id} className={!supplier.active ? 'inactive-row' : ''}>
                    <td>
                      <span className={`status-badge ${
                        supplier.approval_status === 'approved' ? 'approved' :
                        supplier.approval_status === 'pending' ? 'pending' :
                        'rejected'
                      }`}>
                        {supplier.approval_status === 'approved' ? '✓ Aprobado' :
                         supplier.approval_status === 'pending' ? '⏳ Pendiente' :
                         '✗ Rechazado'}
                      </span>
                    </td>
                    <td className="type-col">
                      {supplier.third_party_type ? (
                        <span className="type-badge" title={supplier.third_party_type.description}>
                          {supplier.third_party_type.icon} {supplier.third_party_type.label}
                        </span>
                      ) : (
                        <span className="no-type">-</span>
                      )}
                    </td>
                    <td className="supplier-info-col">
                      <div className="supplier-name">
                        <strong>{supplier.legal_name}</strong>
                        {supplier.legal_name_short && supplier.legal_name_short !== supplier.legal_name && (
                          <small>{supplier.legal_name_short}</small>
                        )}
                      </div>
                      {supplier.legal_representative_name && (
                        <div className="representative-compact">
                          <span className="rep-label">Rep. Legal:</span> {supplier.legal_representative_name}
                        </div>
                      )}
                    </td>
                    <td className="id-col">
                      <div className="id-info">
                        <span className="id-type">{supplier.identification_type}</span>
                        <span className="id-number">{supplier.identification_number}</span>
                      </div>
                    </td>
                    <td className="contact-col">
                      <div className="contact-info">
                        {supplier.email && <div className="contact-email">{supplier.email}</div>}
                        {supplier.phone && <div className="contact-phone">{supplier.phone}</div>}
                        {!supplier.email && !supplier.phone && <span className="no-contact">Sin contacto</span>}
                      </div>
                    </td>
                    <td className="actions-col">
                      <div className="supplier-actions">
                        <button
                          className="btn-action btn-edit"
                          onClick={() => openEditModal(supplier)}
                          title={`Editar información de ${supplier.legal_name}`}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                          </svg>
                        </button>
                        <button
                          className={`btn-action ${supplier.active ? 'btn-toggle-off' : 'btn-toggle-on'}`}
                          onClick={() => handleToggleStatus(supplier)}
                          title={
                            supplier.hasReferences
                              ? `⚠️ Este tercero tiene ${supplier.referenceDetails?.contracts || 0} contrato(s) y ${supplier.referenceDetails?.templates || 0} plantilla(s) asociados. Solo puede ser desactivado, no eliminado.`
                              : supplier.active
                                ? `Desactivar a ${supplier.legal_name} (ya no aparecerá en listados activos)`
                                : `Activar a ${supplier.legal_name} (volverá a aparecer en listados)`
                          }
                        >
                          {supplier.active ? (
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <circle cx="12" cy="12" r="10"></circle>
                              <line x1="15" y1="9" x2="9" y2="15"></line>
                              <line x1="9" y1="9" x2="15" y2="15"></line>
                            </svg>
                          ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                              <polyline points="22 4 12 14.01 9 11.01"></polyline>
                            </svg>
                          )}
                        </button>
                        {supplier.canDelete && (
                          <button
                            className="btn-action btn-delete"
                            onClick={() => handleDeleteSupplier(supplier)}
                            title={`🗑️ Eliminar permanentemente a ${supplier.legal_name}. Esta acción no se puede deshacer.`}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6"></polyline>
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                              <line x1="10" y1="11" x2="10" y2="17"></line>
                              <line x1="14" y1="11" x2="14" y2="17"></line>
                            </svg>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal para crear tercero */}
      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal modal-large">
            <h3>Crear Nuevo Tercero</h3>

            <div className="modal-content">
              <div className="form-section">
                <h4>Información del Tercero</h4>

                {thirdPartyTypes.length > 0 && (
                  <div className="form-group">
                    <label>Tipo de Tercero:</label>
                    <select
                      value={formData.third_party_type}
                      onChange={(e) => {
                        const selectedTypeId = e.target.value;

                        if (!selectedTypeId) {
                          setFormData({...formData, third_party_type: ''});
                          return;
                        }

                        const selectedType = thirdPartyTypes.find(t => t._id === selectedTypeId);

                        // Obtener tipos de identificación permitidos
                        const allowedIdTypes = selectedType?.default_identification_types;

                        // SIEMPRE usar el primer tipo de identificación de la lista permitida
                        // Si no hay lista o está vacía, usar CC como predeterminado
                        let newIdType = 'CC'; // Default para personas naturales
                        if (allowedIdTypes && Array.isArray(allowedIdTypes) && allowedIdTypes.length > 0) {
                          newIdType = allowedIdTypes[0];
                        }

                        // Determinar si el nuevo tipo es empresa o persona natural
                        const isNewTypeCompany = newIdType === 'NIT' || newIdType === 'NIT';

                        console.log('=== CAMBIO DE TIPO DE TERCERO ===');
                        console.log('Tipo seleccionado:', selectedType?.label);
                        console.log('allowedIdTypes:', allowedIdTypes);
                        console.log('newIdType asignado:', newIdType);
                        console.log('Es empresa:', isNewTypeCompany);

                        // Limpiar campos según el tipo
                        setFormData({
                          ...formData,
                          third_party_type: selectedTypeId,
                          identification_type: newIdType,
                          // Limpiar campos de empresa si cambia a persona natural
                          legal_name: isNewTypeCompany ? formData.legal_name : '',
                          legal_name_short: isNewTypeCompany ? formData.legal_name_short : '',
                          legal_representative_name: isNewTypeCompany ? formData.legal_representative_name : '',
                          legal_representative_id_type: isNewTypeCompany ? formData.legal_representative_id_type : 'CC',
                          legal_representative_id_number: isNewTypeCompany ? formData.legal_representative_id_number : '',
                          licensee_name: isNewTypeCompany ? formData.licensee_name : '',
                          // Limpiar full_name si cambia a empresa
                          full_name: !isNewTypeCompany ? formData.full_name : ''
                        });
                      }}
                    >
                      <option value="">Seleccione un tipo (opcional)</option>
                      {thirdPartyTypes.map((type) => (
                        <option key={type._id} value={type._id}>
                          {type.icon} {type.label}
                        </option>
                      ))}
                    </select>
                    {formData.third_party_type && (
                      <small style={{ display: 'block', marginTop: '0.5rem', color: '#7f8c8d' }}>
                        {thirdPartyTypes.find(t => t._id === formData.third_party_type)?.description}
                      </small>
                    )}
                  </div>
                )}

                <div className="form-row">
                  <div className="form-group">
                    <label>Tipo de Identificación: *</label>
                    <select
                      value={formData.identification_type}
                      onChange={(e) => setFormData({
                        ...formData,
                        identification_type: e.target.value,
                        // Resetear campos al cambiar tipo
                        legal_name: '',
                        legal_name_short: '',
                        full_name: '',
                        legal_representative_name: '',
                        legal_representative_id_type: 'CC',
                        legal_representative_id_number: '',
                        licensee_name: ''
                      })}
                      required
                    >
                      {(() => {
                        // Si hay un tipo de tercero seleccionado y tiene tipos de ID configurados
                        const selectedType = thirdPartyTypes.find(t => t._id === formData.third_party_type);
                        const allowedIdTypes = selectedType?.default_identification_types;

                        if (allowedIdTypes && allowedIdTypes.length > 0) {
                          // Mostrar solo los tipos permitidos
                          return allowedIdTypes.map(idType => (
                            <option key={idType} value={idType}>{idType}</option>
                          ));
                        }

                        // Si no hay tipo seleccionado o no tiene tipos configurados, mostrar todos
                        return (
                          <>
                            {!formData.identification_type && <option value="">Seleccione tipo de identificación</option>}
                            <option value="NIT">NIT (Empresa)</option>
                            
                            <option value="CC">Cédula de Ciudadanía</option>
                            <option value="CE">Cédula de Extranjería</option>
                            <option value="Pasaporte">Pasaporte</option>
                          </>
                        );
                      })()}
                    </select>
                    {formData.third_party_type && (() => {
                      const selectedType = thirdPartyTypes.find(t => t._id === formData.third_party_type);
                      const allowedIdTypes = selectedType?.default_identification_types;
                      if (allowedIdTypes && allowedIdTypes.length > 0) {
                        return (
                          <small style={{ display: 'block', marginTop: '0.25rem', color: '#2563eb', fontSize: '0.85rem' }}>
                            Tipos permitidos para este tipo de tercero: {allowedIdTypes.join(', ')}
                          </small>
                        );
                      }
                      return null;
                    })()}
                  </div>

                  <div className="form-group">
                    <label>Número de Identificación: *</label>
                    <input
                      type="text"
                      value={formData.identification_number}
                      onChange={(e) => setFormData({...formData, identification_number: e.target.value})}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Ciudad de Expedición:</label>
                  <input
                    type="text"
                    value={formData.id_issue_city}
                    onChange={(e) => setFormData({...formData, id_issue_city: e.target.value})}
                    placeholder="Ej: Bogotá, Medellín, etc."
                  />
                </div>

                {/* Campos para EMPRESAS (NIT y NIT PH) */}
                {(formData.identification_type === 'NIT') && (
                  <>
                    {formData.identification_type === 'NIT' ? (
                      // Campos para NIT (PH) - Solo un campo
                      <>
                        <div className="form-group">
                          <label>Nombre de la Propiedad Horizontal: *</label>
                          <input
                            type="text"
                            value={formData.legal_name}
                            onChange={(e) => setFormData({
                              ...formData,
                              legal_name: e.target.value,
                              legal_name_short: e.target.value // Copiar automáticamente
                            })}
                            required
                          />
                        </div>

                        <div className="form-group">
                          <label>Nombre del Licenciatario:</label>
                          <input
                            type="text"
                            value={formData.licensee_name}
                            onChange={(e) => setFormData({...formData, licensee_name: e.target.value})}
                          />
                        </div>
                      </>
                    ) : (
                      // Campos para NIT (Empresa) - Un solo campo
                      <div className="form-group">
                        <label>Razón Social / Nombre: *</label>
                        <input
                          type="text"
                          value={formData.legal_name}
                          onChange={(e) => setFormData({
                            ...formData,
                            legal_name: e.target.value,
                            legal_name_short: e.target.value // Copiar automáticamente al campo abreviado
                          })}
                          required
                          placeholder="Ej: Constructora ABC S.A.S."
                        />
                      </div>
                    )}
                  </>
                )}

                {/* Campos para PERSONAS NATURALES (CC, CE, Pasaporte) */}
                {formData.identification_type !== 'NIT' && (
                  <div className="form-row">
                    <div className="form-group">
                      <label>Nombre Completo: *</label>
                      <input
                        type="text"
                        value={formData.full_name}
                        onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                        required
                        placeholder="Ej: Juan Pérez García"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Representante Legal - Solo para empresas */}
              {(formData.identification_type === 'NIT') && (
                <div className="form-section">
                  <h4>Representante Legal</h4>

                  <div className="form-group">
                    <label>Nombre del Representante Legal: *</label>
                    <input
                      type="text"
                      value={formData.legal_representative_name}
                      onChange={(e) => setFormData({...formData, legal_representative_name: e.target.value})}
                      required
                    />
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Tipo de Identificación: *</label>
                      <select
                        value={formData.legal_representative_id_type}
                        onChange={(e) => setFormData({...formData, legal_representative_id_type: e.target.value})}
                        required
                      >
                        <option value="CC">Cédula de Ciudadanía</option>
                        <option value="CE">Cédula de Extranjería</option>
                        <option value="Pasaporte">Pasaporte</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Número de Identificación: *</label>
                      <input
                        type="text"
                        value={formData.legal_representative_id_number}
                        onChange={(e) => setFormData({...formData, legal_representative_id_number: e.target.value})}
                        required
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="form-section">
                <h4>Información de Contacto (Opcional)</h4>

                <div className="form-row">
                  <div className="form-group">
                    <label>Email:</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                    />
                  </div>

                  <div className="form-group">
                    <label>Teléfono:</label>
                    <input
                      type="text"
                      value={formData.phone}
                      onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Dirección:</label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData({...formData, address: e.target.value})}
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>País:</label>
                    <select
                      value={formData.country}
                      onChange={(e) => handleCountryChange(e.target.value)}
                    >
                      {Object.keys(countriesWithCities).map(country => (
                        <option key={country} value={country}>{country}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Ciudad:</label>
                    <select
                      value={formData.city}
                      onChange={(e) => setFormData({...formData, city: e.target.value})}
                    >
                      <option value="">Seleccione una ciudad</option>
                      {(countriesWithCities[formData.country || 'Colombia'] || []).map((city: string) => (
                        <option key={city} value={city}>{city}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-actions">
              <button
                className="btn-secondary"
                onClick={() => {
                  setShowCreateModal(false);
                  resetForm();
                }}
              >
                Cancelar
              </button>
              <button
                className="btn-primary"
                onClick={handleCreateSupplier}
                disabled={!isFormValid()}
                title={!isFormValid() ? `Campos faltantes: ${getMissingFields().join(', ')}` : ''}
              >
                Crear Tercero
              </button>
            </div>
            {!isFormValid() && (
              <div style={{
                marginTop: '1rem',
                padding: '1rem',
                background: '#fff3cd',
                border: '1px solid #ffc107',
                borderRadius: '8px',
                color: '#856404'
              }}>
                <strong>⚠️ Campos obligatorios faltantes:</strong>
                <div style={{ fontSize: '0.85rem', marginTop: '0.5rem', color: '#666' }}>
                  Tipo de ID actual: <strong>{formData.identification_type || '(vacío)'}</strong>
                </div>
                <ul style={{ marginTop: '0.5rem', marginBottom: 0, paddingLeft: '1.5rem' }}>
                  {getMissingFields().map((field, idx) => (
                    <li key={idx}>{field}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal para editar tercero */}
      {showEditModal && editingSupplier && (
        <div className="modal-overlay">
          <div className="modal modal-large">
            <h3>Editar Tercero</h3>

            <div className="modal-content">
              <div className="form-section">
                <h4>Información del Tercero</h4>

                {thirdPartyTypes.length > 0 && (
                  <div className="form-group">
                    <label>Tipo de Tercero:</label>
                    <select
                      value={formData.third_party_type}
                      onChange={(e) => {
                        const selectedTypeId = e.target.value;

                        if (!selectedTypeId) {
                          setFormData({...formData, third_party_type: ''});
                          return;
                        }

                        const selectedType = thirdPartyTypes.find(t => t._id === selectedTypeId);

                        // Obtener tipos de identificación permitidos
                        const allowedIdTypes = selectedType?.default_identification_types;

                        // SIEMPRE usar el primer tipo de identificación de la lista permitida
                        // Si no hay lista o está vacía, usar CC como predeterminado
                        let newIdType = 'CC'; // Default para personas naturales
                        if (allowedIdTypes && Array.isArray(allowedIdTypes) && allowedIdTypes.length > 0) {
                          newIdType = allowedIdTypes[0];
                        }

                        // Determinar si el nuevo tipo es empresa o persona natural
                        const isNewTypeCompany = newIdType === 'NIT' || newIdType === 'NIT';

                        console.log('=== CAMBIO DE TIPO DE TERCERO ===');
                        console.log('Tipo seleccionado:', selectedType?.label);
                        console.log('allowedIdTypes:', allowedIdTypes);
                        console.log('newIdType asignado:', newIdType);
                        console.log('Es empresa:', isNewTypeCompany);

                        // Limpiar campos según el tipo
                        setFormData({
                          ...formData,
                          third_party_type: selectedTypeId,
                          identification_type: newIdType,
                          // Limpiar campos de empresa si cambia a persona natural
                          legal_name: isNewTypeCompany ? formData.legal_name : '',
                          legal_name_short: isNewTypeCompany ? formData.legal_name_short : '',
                          legal_representative_name: isNewTypeCompany ? formData.legal_representative_name : '',
                          legal_representative_id_type: isNewTypeCompany ? formData.legal_representative_id_type : 'CC',
                          legal_representative_id_number: isNewTypeCompany ? formData.legal_representative_id_number : '',
                          licensee_name: isNewTypeCompany ? formData.licensee_name : '',
                          // Limpiar full_name si cambia a empresa
                          full_name: !isNewTypeCompany ? formData.full_name : ''
                        });
                      }}
                    >
                      <option value="">Seleccione un tipo (opcional)</option>
                      {thirdPartyTypes.map((type) => (
                        <option key={type._id} value={type._id}>
                          {type.icon} {type.label}
                        </option>
                      ))}
                    </select>
                    {formData.third_party_type && (
                      <small style={{ display: 'block', marginTop: '0.5rem', color: '#7f8c8d' }}>
                        {thirdPartyTypes.find(t => t._id === formData.third_party_type)?.description}
                      </small>
                    )}
                  </div>
                )}

                <div className="form-row">
                  <div className="form-group">
                    <label>Tipo de Identificación: *</label>
                    <select
                      value={formData.identification_type}
                      onChange={(e) => setFormData({
                        ...formData,
                        identification_type: e.target.value,
                        // Resetear campos al cambiar tipo
                        legal_name: '',
                        legal_name_short: '',
                        full_name: '',
                        legal_representative_name: '',
                        legal_representative_id_type: 'CC',
                        legal_representative_id_number: '',
                        licensee_name: ''
                      })}
                      required
                    >
                      {(() => {
                        // Si hay un tipo de tercero seleccionado y tiene tipos de ID configurados
                        const selectedType = thirdPartyTypes.find(t => t._id === formData.third_party_type);
                        const allowedIdTypes = selectedType?.default_identification_types;

                        if (allowedIdTypes && allowedIdTypes.length > 0) {
                          // Mostrar solo los tipos permitidos
                          return allowedIdTypes.map(idType => (
                            <option key={idType} value={idType}>{idType}</option>
                          ));
                        }

                        // Si no hay tipo seleccionado o no tiene tipos configurados, mostrar todos
                        return (
                          <>
                            {!formData.identification_type && <option value="">Seleccione tipo de identificación</option>}
                            <option value="NIT">NIT (Empresa)</option>
                            
                            <option value="CC">Cédula de Ciudadanía</option>
                            <option value="CE">Cédula de Extranjería</option>
                            <option value="Pasaporte">Pasaporte</option>
                          </>
                        );
                      })()}
                    </select>
                    {formData.third_party_type && (() => {
                      const selectedType = thirdPartyTypes.find(t => t._id === formData.third_party_type);
                      const allowedIdTypes = selectedType?.default_identification_types;
                      if (allowedIdTypes && allowedIdTypes.length > 0) {
                        return (
                          <small style={{ display: 'block', marginTop: '0.25rem', color: '#2563eb', fontSize: '0.85rem' }}>
                            Tipos permitidos para este tipo de tercero: {allowedIdTypes.join(', ')}
                          </small>
                        );
                      }
                      return null;
                    })()}
                  </div>

                  <div className="form-group">
                    <label>Número de Identificación: *</label>
                    <input
                      type="text"
                      value={formData.identification_number}
                      onChange={(e) => setFormData({...formData, identification_number: e.target.value})}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Ciudad de Expedición:</label>
                  <input
                    type="text"
                    value={formData.id_issue_city}
                    onChange={(e) => setFormData({...formData, id_issue_city: e.target.value})}
                    placeholder="Ej: Bogotá, Medellín, etc."
                  />
                </div>

                {/* Campos para EMPRESAS (NIT y NIT PH) */}
                {(formData.identification_type === 'NIT') && (
                  <>
                    {formData.identification_type === 'NIT' ? (
                      // Campos para NIT (PH) - Solo un campo
                      <>
                        <div className="form-group">
                          <label>Nombre de la Propiedad Horizontal: *</label>
                          <input
                            type="text"
                            value={formData.legal_name}
                            onChange={(e) => setFormData({
                              ...formData,
                              legal_name: e.target.value,
                              legal_name_short: e.target.value // Copiar automáticamente
                            })}
                            required
                          />
                        </div>

                        <div className="form-group">
                          <label>Nombre del Licenciatario:</label>
                          <input
                            type="text"
                            value={formData.licensee_name}
                            onChange={(e) => setFormData({...formData, licensee_name: e.target.value})}
                          />
                        </div>
                      </>
                    ) : (
                      // Campos para NIT (Empresa) - Un solo campo
                      <div className="form-group">
                        <label>Razón Social / Nombre: *</label>
                        <input
                          type="text"
                          value={formData.legal_name}
                          onChange={(e) => setFormData({
                            ...formData,
                            legal_name: e.target.value,
                            legal_name_short: e.target.value // Copiar automáticamente al campo abreviado
                          })}
                          required
                          placeholder="Ej: Constructora ABC S.A.S."
                        />
                      </div>
                    )}
                  </>
                )}

                {/* Campos para PERSONAS NATURALES (CC, CE, Pasaporte) */}
                {formData.identification_type !== 'NIT' && (
                  <div className="form-row">
                    <div className="form-group">
                      <label>Nombre Completo: *</label>
                      <input
                        type="text"
                        value={formData.full_name}
                        onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                        required
                        placeholder="Ej: Juan Pérez García"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Representante Legal - Solo para empresas */}
              {(formData.identification_type === 'NIT') && (
                <div className="form-section">
                  <h4>Representante Legal</h4>

                  <div className="form-group">
                    <label>Nombre del Representante Legal: *</label>
                    <input
                      type="text"
                      value={formData.legal_representative_name}
                      onChange={(e) => setFormData({...formData, legal_representative_name: e.target.value})}
                      required
                    />
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Tipo de Identificación: *</label>
                      <select
                        value={formData.legal_representative_id_type}
                        onChange={(e) => setFormData({...formData, legal_representative_id_type: e.target.value})}
                        required
                      >
                        <option value="CC">Cédula de Ciudadanía</option>
                        <option value="CE">Cédula de Extranjería</option>
                        <option value="Pasaporte">Pasaporte</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Número de Identificación: *</label>
                      <input
                        type="text"
                        value={formData.legal_representative_id_number}
                        onChange={(e) => setFormData({...formData, legal_representative_id_number: e.target.value})}
                        required
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="form-section">
                <h4>Información de Contacto (Opcional)</h4>

                <div className="form-row">
                  <div className="form-group">
                    <label>Email:</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                    />
                  </div>

                  <div className="form-group">
                    <label>Teléfono:</label>
                    <input
                      type="text"
                      value={formData.phone}
                      onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Dirección:</label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData({...formData, address: e.target.value})}
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>País:</label>
                    <select
                      value={formData.country}
                      onChange={(e) => handleCountryChange(e.target.value)}
                    >
                      {Object.keys(countriesWithCities).map(country => (
                        <option key={country} value={country}>{country}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Ciudad:</label>
                    <select
                      value={formData.city}
                      onChange={(e) => setFormData({...formData, city: e.target.value})}
                    >
                      <option value="">Seleccione una ciudad</option>
                      {(countriesWithCities[formData.country || 'Colombia'] || []).map((city: string) => (
                        <option key={city} value={city}>{city}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Panel de Sugerencias de Campos */}
              {editingSupplier._id && (
                <div className="form-section" style={{ marginTop: '2rem', borderTop: '2px solid #e0e0e0', paddingTop: '2rem' }}>
                  <h4>Sugerencias de Campos</h4>
                  <FieldSuggestionsPanel
                    supplierId={editingSupplier._id}
                    onFieldsAdded={async () => {
                      await reloadCurrentSupplier();
                    }}
                  />
                </div>
              )}

              {/* Fusionador de Campos Duplicados */}
              {editingSupplier._id && editingSupplier.custom_fields && Object.keys(editingSupplier.custom_fields).length > 0 && (
                <div className="form-section" style={{ marginTop: '1rem' }}>
                  <FieldMerger
                    supplierId={editingSupplier._id}
                    customFields={editingSupplier.custom_fields}
                    thirdPartyTypeId={editingSupplier.third_party_type?._id}
                    onMergeComplete={async () => {
                      await reloadCurrentSupplier();
                    }}
                  />
                </div>
              )}
            </div>

            <div className="modal-actions">
              <button
                className="btn-secondary"
                onClick={() => {
                  setShowEditModal(false);
                  setEditingSupplier(null);
                  resetForm();
                }}
              >
                Cancelar
              </button>
              <button
                className="btn-primary"
                onClick={handleEditSupplier}
                disabled={!isFormValid()}
                title={!isFormValid() ? `Campos faltantes: ${getMissingFields().join(', ')}` : ''}
              >
                Actualizar Tercero
              </button>
            </div>
            {!isFormValid() && (
              <div style={{
                marginTop: '1rem',
                padding: '1rem',
                background: '#fff3cd',
                border: '1px solid #ffc107',
                borderRadius: '8px',
                color: '#856404'
              }}>
                <strong>⚠️ Campos obligatorios faltantes:</strong>
                <div style={{ fontSize: '0.85rem', marginTop: '0.5rem', color: '#666' }}>
                  Tipo de ID actual: <strong>{formData.identification_type || '(vacío)'}</strong>
                </div>
                <ul style={{ marginTop: '0.5rem', marginBottom: 0, paddingLeft: '1.5rem' }}>
                  {getMissingFields().map((field, idx) => (
                    <li key={idx}>{field}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Suppliers;
