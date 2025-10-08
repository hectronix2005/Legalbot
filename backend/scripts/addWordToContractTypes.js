const sqlite3 = require('sqlite3').verbose();
const path = require('path');
require('dotenv').config();

const dbPath = process.env.DB_PATH || './database/contracts.db';

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error al conectar a la base de datos:', err);
    process.exit(1);
  }
  console.log('✅ Conectado a la base de datos');
});

db.serialize(() => {
  // Agregar columna para archivo Word en tipos de contrato
  db.run(`
    ALTER TABLE contract_types ADD COLUMN word_file_path TEXT;
  `, (err) => {
    if (err) {
      if (err.message.includes('duplicate column name')) {
        console.log('⚠️  La columna word_file_path ya existe');
      } else {
        console.error('Error al agregar columna:', err);
      }
    } else {
      console.log('✅ Columna word_file_path agregada a contract_types');
    }
  });

  db.run(`
    ALTER TABLE contract_types ADD COLUMN word_file_original_name TEXT;
  `, (err) => {
    if (err) {
      if (err.message.includes('duplicate column name')) {
        console.log('⚠️  La columna word_file_original_name ya existe');
      } else {
        console.error('Error al agregar columna:', err);
      }
    } else {
      console.log('✅ Columna word_file_original_name agregada a contract_types');
    }
  });

  // Agregar columna para almacenar campos detectados como JSON
  db.run(`
    ALTER TABLE contract_types ADD COLUMN detected_fields TEXT;
  `, (err) => {
    if (err) {
      if (err.message.includes('duplicate column name')) {
        console.log('⚠️  La columna detected_fields ya existe');
      } else {
        console.error('Error al agregar columna:', err);
      }
    } else {
      console.log('✅ Columna detected_fields agregada a contract_types');
    }
    
    db.close((err) => {
      if (err) {
        console.error('Error al cerrar la base de datos:', err);
      } else {
        console.log('✅ Migración completada exitosamente');
      }
    });
  });
});

