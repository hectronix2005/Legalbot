const sqlite3 = require('sqlite3').verbose();
const path = require('path');
require('dotenv').config();

const dbPath = process.env.DB_PATH || './database/contracts.db';

class Database {
  constructor() {
    this.db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('Error al conectar a la base de datos:', err);
      } else {
        console.log('✅ Conectado a la base de datos SQLite');
        this.initializeTables();
      }
    });
  }

  initializeTables() {
    this.db.serialize(() => {
      // Tabla de usuarios
      this.db.run(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          email TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          name TEXT NOT NULL,
          role TEXT NOT NULL CHECK(role IN ('admin', 'lawyer', 'requester')),
          company_id INTEGER,
          active INTEGER DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (company_id) REFERENCES companies(id)
        )
      `);

      // Tabla de empresas
      this.db.run(`
        CREATE TABLE IF NOT EXISTS companies (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          tax_id TEXT UNIQUE NOT NULL,
          address TEXT,
          phone TEXT,
          active INTEGER DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Tabla de tipos de contrato
      this.db.run(`
        CREATE TABLE IF NOT EXISTS contract_types (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          description TEXT,
          category TEXT,
          active INTEGER DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Tabla de plantillas de contratos
      this.db.run(`
        CREATE TABLE IF NOT EXISTS contract_templates (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          contract_type_id INTEGER NOT NULL,
          name TEXT NOT NULL,
          description TEXT,
          content TEXT NOT NULL,
          version INTEGER DEFAULT 1,
          is_current INTEGER DEFAULT 1,
          company_id INTEGER,
          created_by INTEGER NOT NULL,
          active INTEGER DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (contract_type_id) REFERENCES contract_types(id),
          FOREIGN KEY (company_id) REFERENCES companies(id),
          FOREIGN KEY (created_by) REFERENCES users(id)
        )
      `);

      // Tabla de campos dinámicos para plantillas
      this.db.run(`
        CREATE TABLE IF NOT EXISTS template_fields (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          template_id INTEGER NOT NULL,
          field_name TEXT NOT NULL,
          field_label TEXT NOT NULL,
          field_type TEXT NOT NULL CHECK(field_type IN ('text', 'number', 'date', 'email', 'textarea', 'select')),
          field_options TEXT,
          required INTEGER DEFAULT 1,
          display_order INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (template_id) REFERENCES contract_templates(id) ON DELETE CASCADE
        )
      `);

      // Tabla de solicitudes de contratos
      this.db.run(`
        CREATE TABLE IF NOT EXISTS contract_requests (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          template_id INTEGER NOT NULL,
          requester_id INTEGER NOT NULL,
          company_id INTEGER NOT NULL,
          title TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'in_review', 'approved', 'rejected', 'completed')),
          field_data TEXT NOT NULL,
          assigned_lawyer_id INTEGER,
          legal_notes TEXT,
          rejection_reason TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          reviewed_at DATETIME,
          FOREIGN KEY (template_id) REFERENCES contract_templates(id),
          FOREIGN KEY (requester_id) REFERENCES users(id),
          FOREIGN KEY (company_id) REFERENCES companies(id),
          FOREIGN KEY (assigned_lawyer_id) REFERENCES users(id)
        )
      `);

      // Tabla de contratos generados
      this.db.run(`
        CREATE TABLE IF NOT EXISTS contracts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          request_id INTEGER NOT NULL,
          template_id INTEGER NOT NULL,
          contract_number TEXT UNIQUE NOT NULL,
          content TEXT NOT NULL,
          file_path TEXT,
          status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'terminated', 'expired')),
          generated_by INTEGER NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (request_id) REFERENCES contract_requests(id),
          FOREIGN KEY (template_id) REFERENCES contract_templates(id),
          FOREIGN KEY (generated_by) REFERENCES users(id)
        )
      `);

      // Tabla de historial de versiones
      this.db.run(`
        CREATE TABLE IF NOT EXISTS version_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          template_id INTEGER NOT NULL,
          version INTEGER NOT NULL,
          content TEXT NOT NULL,
          changes_description TEXT,
          created_by INTEGER NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (template_id) REFERENCES contract_templates(id),
          FOREIGN KEY (created_by) REFERENCES users(id)
        )
      `);

      // Tabla de comentarios/actividad
      this.db.run(`
        CREATE TABLE IF NOT EXISTS activity_log (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          action TEXT NOT NULL,
          entity_type TEXT NOT NULL,
          entity_id INTEGER NOT NULL,
          description TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id)
        )
      `);

      console.log('✅ Tablas de base de datos inicializadas');
    });
  }

  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve({ id: this.lastID, changes: this.changes });
      });
    });
  }

  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
}

module.exports = new Database();

