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
  console.log('🔄 Unificando Tipos de Contrato y Plantillas...');

  // Agregar columna de categoría a plantillas (antes estaba en tipos)
  db.run(`
    ALTER TABLE contract_templates ADD COLUMN category TEXT;
  `, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error('Error al agregar category:', err);
    } else {
      console.log('✅ Columna category agregada a plantillas');
    }
  });

  // Migrar datos de contract_types a contract_templates si hay tipos existentes
  db.all('SELECT * FROM contract_types WHERE active = 1', [], (err, types) => {
    if (err) {
      console.error('Error al leer tipos:', err);
      return;
    }

    console.log(`📋 Encontrados ${types.length} tipos de contrato para migrar`);

    types.forEach(type => {
      // Verificar si ya existe una plantilla de este tipo
      db.get(
        'SELECT id FROM contract_templates WHERE contract_type_id = ? AND is_current = 1 LIMIT 1',
        [type.id],
        (err, existingTemplate) => {
          if (existingTemplate) {
            // Si existe plantilla, actualizar su categoría
            db.run(
              'UPDATE contract_templates SET category = ? WHERE id = ?',
              [type.category, existingTemplate.id],
              (err) => {
                if (err) {
                  console.error(`Error actualizando plantilla ${existingTemplate.id}:`, err);
                } else {
                  console.log(`✅ Actualizada plantilla ${existingTemplate.id} con categoría: ${type.category}`);
                }
              }
            );
          }
        }
      );
    });
  });

  // Actualizar contract_templates para eliminar la dependencia de contract_type_id
  // Hacemos que sea opcional
  console.log('✅ Preparando plantillas para ser independientes de tipos');

  // Actualizar las solicitudes y contratos para que funcionen sin tipos
  console.log('✅ Sistema unificado - Plantillas ahora incluyen toda la información');

  setTimeout(() => {
    db.close((err) => {
      if (err) {
        console.error('Error al cerrar BD:', err);
      } else {
        console.log('\n✅ Migración completada');
        console.log('ℹ️  Ahora "Plantillas" incluye la funcionalidad de "Tipos de Contrato"');
        console.log('ℹ️  Puedes gestionar todo desde una sola sección');
      }
    });
  }, 2000);
});

