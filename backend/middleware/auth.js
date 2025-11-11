const jwt = require('jsonwebtoken');
require('dotenv').config();

const authenticate = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      console.log('❌ authenticate: Token no proporcionado para ruta:', req.path);
      return res.status(401).json({ error: 'Token no proporcionado' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    console.log('❌ authenticate: Token inválido o expirado para ruta:', req.path, 'Error:', error.message);
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    // Super admin tiene acceso a todo
    if (req.user.role === 'super_admin') {
      return next();
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'No tiene permisos para esta acción' });
    }

    next();
  };
};

// Middleware especial para super admin
const requireSuperAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'No autenticado' });
  }

  if (req.user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Se requiere rol de Super Admin' });
  }

  next();
};

// Middleware para verificar tenant (companyId)
const verifyTenant = async (req, res, next) => {
  try {
    // Obtener companyId del header
    const companyId = req.headers['x-company-id'];
    console.log(`🔍 verifyTenant: user=${req.user?.id}, role=${req.user?.role}, companyId=${companyId}`);

    // Super admin con "ALL" = acceso a todas las empresas sin filtro
    if (req.user.role === 'super_admin' && companyId === 'ALL') {
      console.log('✅ verifyTenant: Super admin with ALL access');
      req.companyId = 'ALL';
      return next();
    }

    // Super admin no necesita companyId (acceso global)
    if (req.user.role === 'super_admin') {
      console.log('✅ verifyTenant: Super admin with global access');
      req.companyId = companyId || null;
      return next();
    }

    // Para otros usuarios, companyId es requerido
    if (!companyId) {
      console.log('❌ verifyTenant: Missing X-Company-Id header');
      return res.status(400).json({ error: 'X-Company-Id header es requerido' });
    }

    // Verificar que el usuario tiene acceso a esta empresa
    const UserCompany = require('../models/UserCompany');
    console.log(`🔍 verifyTenant: Querying UserCompany for user=${req.user.id}, company=${companyId}`);

    const userCompany = await UserCompany.findOne({
      user: req.user.id,
      company: companyId,
      isActive: true
    }).maxTimeMS(5000); // 5 second timeout for the query

    console.log(`🔍 verifyTenant: UserCompany result=${userCompany ? 'found' : 'not found'}`);

    if (!userCompany) {
      console.log(`❌ verifyTenant: No access to company ${companyId} for user ${req.user.id}`);
      return res.status(403).json({ error: 'No tienes acceso a esta empresa' });
    }

    // Agregar companyId y rol específico de la empresa al request
    req.companyId = companyId;
    req.companyRole = userCompany.role;
    req.companyPermissions = userCompany.permissions;
    console.log(`✅ verifyTenant: Access granted with role=${userCompany.role}`);

    next();
  } catch (error) {
    console.error('❌ Error en verifyTenant:', error);
    return res.status(500).json({ error: 'Error al verificar acceso a la empresa', details: error.message });
  }
};

// Middleware para autorizar roles específicos por empresa
const authorizeCompanyRole = (...roles) => {
  return (req, res, next) => {
    console.log(`🔍 authorizeCompanyRole: required roles=[${roles.join(', ')}], user role=${req.user?.role}, companyRole=${req.companyRole}`);

    // Super admin siempre tiene acceso
    if (req.user.role === 'super_admin') {
      console.log('✅ authorizeCompanyRole: Super admin has access');
      return next();
    }

    // Verificar que se haya ejecutado verifyTenant primero
    if (!req.companyRole) {
      console.log('❌ authorizeCompanyRole: Missing companyRole - verifyTenant not executed?');
      return res.status(403).json({ error: 'Verificación de tenant requerida' });
    }

    // Verificar rol en la empresa
    if (!roles.includes(req.companyRole)) {
      console.log(`❌ authorizeCompanyRole: User role '${req.companyRole}' not in required roles [${roles.join(', ')}]`);
      return res.status(403).json({ error: 'No tienes permisos para esta acción en esta empresa' });
    }

    console.log('✅ authorizeCompanyRole: Access granted');
    next();
  };
};

module.exports = {
  authenticate,
  authorize,
  requireSuperAdmin,
  verifyTenant,
  authorizeCompanyRole
};

