const jwt = require('jsonwebtoken');
require('dotenv').config();

const authenticate = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'Token no proporcionado' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
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

    // Super admin no necesita companyId (acceso global)
    if (req.user.role === 'super_admin') {
      req.companyId = companyId || null;
      return next();
    }

    // Para otros usuarios, companyId es requerido
    if (!companyId) {
      return res.status(400).json({ error: 'X-Company-Id header es requerido' });
    }

    // Verificar que el usuario tiene acceso a esta empresa
    const UserCompany = require('../models/UserCompany');
    const userCompany = await UserCompany.findOne({
      user: req.user.id,
      company: companyId,
      isActive: true
    });

    if (!userCompany) {
      return res.status(403).json({ error: 'No tienes acceso a esta empresa' });
    }

    // Agregar companyId y rol específico de la empresa al request
    req.companyId = companyId;
    req.companyRole = userCompany.role;
    req.companyPermissions = userCompany.permissions;

    next();
  } catch (error) {
    console.error('Error en verifyTenant:', error);
    return res.status(500).json({ error: 'Error al verificar acceso a la empresa' });
  }
};

// Middleware para autorizar roles específicos por empresa
const authorizeCompanyRole = (...roles) => {
  return (req, res, next) => {
    // Super admin siempre tiene acceso
    if (req.user.role === 'super_admin') {
      return next();
    }

    // Verificar que se haya ejecutado verifyTenant primero
    if (!req.companyRole) {
      return res.status(403).json({ error: 'Verificación de tenant requerida' });
    }

    // Verificar rol en la empresa
    if (!roles.includes(req.companyRole)) {
      return res.status(403).json({ error: 'No tienes permisos para esta acción en esta empresa' });
    }

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

