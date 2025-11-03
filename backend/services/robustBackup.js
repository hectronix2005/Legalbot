const fs = require('fs').promises;
const path = require('path');
const mongoose = require('mongoose');

/**
 * Sistema robusto de respaldo y recuperación de datos
 * Características:
 * - Backups automáticos cada hora
 * - Validación de contenido
 * - Rotación de backups (mantiene últimos 7 días + semanales)
 * - Alertas de pérdida de datos
 * - Restauración fácil
 */

const BACKUP_DIR = path.join(__dirname, '../backups');
const HOURLY_RETENTION = 24 * 7; // 7 días de backups horarios
const WEEKLY_RETENTION = 12; // 12 semanas de backups semanales

// Colecciones críticas a respaldar
const CRITICAL_COLLECTIONS = [
  'templates',
  'contracts',
  'companies',
  'users',
  'suppliers',
  'thirdpartytypeconfigs'
];

/**
 * Crea un backup completo de todas las colecciones críticas
 */
async function createFullBackup(type = 'HOURLY') {
  try {
    // Verificar que mongoose esté conectado
    if (mongoose.connection.readyState !== 1) {
      console.warn('⚠️  MongoDB no está conectado, omitiendo backup');
      return null;
    }

    console.log(`📦 Iniciando backup ${type}...`);

    const backup = {
      timestamp: new Date().toISOString(),
      type,
      collections: {},
      stats: {}
    };

    // Respaldar cada colección crítica
    for (const collectionName of CRITICAL_COLLECTIONS) {
      try {
        const collection = mongoose.connection.db.collection(collectionName);
        const documents = await collection.find({}).toArray();

        backup.collections[collectionName] = documents;
        backup.stats[collectionName] = documents.length;

        console.log(`   ✓ ${collectionName}: ${documents.length} documentos`);
      } catch (error) {
        console.error(`   ✗ Error respaldando ${collectionName}:`, error.message);
        backup.stats[collectionName] = 0;
        backup.collections[collectionName] = [];
      }
    }

    // Validar que el backup tenga contenido relevante
    const totalDocs = Object.values(backup.stats).reduce((a, b) => a + b, 0);

    if (totalDocs === 0) {
      console.warn('⚠️  ADVERTENCIA: Backup vacío - no se guardará');
      return null;
    }

    // Guardar backup con nombre descriptivo
    const filename = `backup-${type.toLowerCase()}-${Date.now()}.json`;
    const filepath = path.join(BACKUP_DIR, filename);

    await fs.writeFile(filepath, JSON.stringify(backup, null, 2));

    const fileStats = await fs.stat(filepath);
    const sizeMB = (fileStats.size / 1024 / 1024).toFixed(2);

    console.log(`✅ Backup completado: ${filename}`);
    console.log(`   📊 Total documentos: ${totalDocs}`);
    console.log(`   💾 Tamaño: ${sizeMB} MB`);

    return { filename, filepath, stats: backup.stats, size: fileStats.size };
  } catch (error) {
    console.error('❌ Error creando backup:', error);
    throw error;
  }
}

/**
 * Lista todos los backups disponibles
 */
async function listBackups() {
  try {
    const files = await fs.readdir(BACKUP_DIR);
    const backupFiles = files.filter(f => f.startsWith('backup-') && f.endsWith('.json'));

    const backups = await Promise.all(
      backupFiles.map(async (filename) => {
        const filepath = path.join(BACKUP_DIR, filename);
        const stats = await fs.stat(filepath);

        try {
          const content = await fs.readFile(filepath, 'utf8');
          const data = JSON.parse(content);

          return {
            filename,
            filepath,
            timestamp: data.timestamp,
            type: data.type || 'UNKNOWN',
            stats: data.stats || {},
            size: stats.size,
            created: stats.birthtime
          };
        } catch (error) {
          return {
            filename,
            filepath,
            error: 'Archivo corrupto',
            size: stats.size,
            created: stats.birthtime
          };
        }
      })
    );

    // Ordenar por fecha de creación (más reciente primero)
    return backups.sort((a, b) => new Date(b.created) - new Date(a.created));
  } catch (error) {
    console.error('Error listando backups:', error);
    return [];
  }
}

/**
 * Restaura datos desde un backup
 */
async function restoreFromBackup(backupFilename, options = {}) {
  const {
    dryRun = false,
    collections = null // null = todas, o array con nombres específicos
  } = options;

  try {
    console.log(`🔄 Restaurando desde: ${backupFilename}`);

    const filepath = path.join(BACKUP_DIR, backupFilename);
    const content = await fs.readFile(filepath, 'utf8');
    const backup = JSON.parse(content);

    if (dryRun) {
      console.log('🔍 Modo DRY-RUN - No se modificará la base de datos');
      console.log('📊 Contenido del backup:');
      Object.entries(backup.stats || {}).forEach(([coll, count]) => {
        console.log(`   - ${coll}: ${count} documentos`);
      });
      return { success: true, dryRun: true, stats: backup.stats };
    }

    const collectionsToRestore = collections || Object.keys(backup.collections);
    const results = {};

    for (const collectionName of collectionsToRestore) {
      if (!backup.collections[collectionName]) {
        console.warn(`   ⚠️  ${collectionName}: No encontrado en backup`);
        continue;
      }

      try {
        const collection = mongoose.connection.db.collection(collectionName);
        const documents = backup.collections[collectionName];

        if (documents.length === 0) {
          console.log(`   ⏭️  ${collectionName}: Vacío, omitiendo`);
          continue;
        }

        // Eliminar documentos existentes
        const deleteResult = await collection.deleteMany({});

        // Insertar documentos del backup
        const insertResult = await collection.insertMany(documents);

        results[collectionName] = {
          deleted: deleteResult.deletedCount,
          inserted: insertResult.insertedCount
        };

        console.log(`   ✅ ${collectionName}: ${deleteResult.deletedCount} eliminados, ${insertResult.insertedCount} restaurados`);
      } catch (error) {
        console.error(`   ❌ Error restaurando ${collectionName}:`, error.message);
        results[collectionName] = { error: error.message };
      }
    }

    console.log('✅ Restauración completada');
    return { success: true, results, timestamp: backup.timestamp };
  } catch (error) {
    console.error('❌ Error restaurando backup:', error);
    throw error;
  }
}

/**
 * Limpia backups antiguos según política de retención
 */
async function cleanOldBackups() {
  try {
    const backups = await listBackups();

    const hourlyBackups = backups.filter(b => b.type === 'HOURLY');
    const weeklyBackups = backups.filter(b => b.type === 'WEEKLY');
    const manualBackups = backups.filter(b => b.type === 'MANUAL');

    let deleted = 0;

    // Limpiar backups horarios antiguos (mantener solo últimos N)
    if (hourlyBackups.length > HOURLY_RETENTION) {
      const toDelete = hourlyBackups.slice(HOURLY_RETENTION);
      for (const backup of toDelete) {
        await fs.unlink(backup.filepath);
        deleted++;
        console.log(`   🗑️  Eliminado: ${backup.filename}`);
      }
    }

    // Limpiar backups semanales antiguos
    if (weeklyBackups.length > WEEKLY_RETENTION) {
      const toDelete = weeklyBackups.slice(WEEKLY_RETENTION);
      for (const backup of toDelete) {
        await fs.unlink(backup.filepath);
        deleted++;
        console.log(`   🗑️  Eliminado: ${backup.filename}`);
      }
    }

    // Limpiar backups vacíos o corruptos
    const emptyBackups = backups.filter(b => b.size < 200 || b.error);
    for (const backup of emptyBackups) {
      await fs.unlink(backup.filepath);
      deleted++;
      console.log(`   🗑️  Eliminado backup vacío/corrupto: ${backup.filename}`);
    }

    if (deleted > 0) {
      console.log(`✅ Limpieza completada: ${deleted} backups eliminados`);
    }

    return { deleted, remaining: backups.length - deleted };
  } catch (error) {
    console.error('Error limpiando backups:', error);
    return { deleted: 0, error: error.message };
  }
}

/**
 * Verifica la integridad de los datos y alerta si detecta problemas
 */
async function verifyDataIntegrity() {
  try {
    const integrity = {
      healthy: true,
      warnings: [],
      stats: {}
    };

    for (const collectionName of CRITICAL_COLLECTIONS) {
      try {
        const collection = mongoose.connection.db.collection(collectionName);
        const count = await collection.countDocuments();
        integrity.stats[collectionName] = count;
      } catch (error) {
        integrity.warnings.push(`Error accediendo a ${collectionName}: ${error.message}`);
        integrity.healthy = false;
      }
    }

    // Verificar si hay datos
    const totalDocs = Object.values(integrity.stats).reduce((a, b) => a + b, 0);
    if (totalDocs === 0) {
      integrity.warnings.push('⚠️  BASE DE DATOS COMPLETAMENTE VACÍA');
      integrity.healthy = false;
    }

    return integrity;
  } catch (error) {
    console.error('Error verificando integridad:', error);
    return { healthy: false, error: error.message };
  }
}

/**
 * Crea un backup semanal a partir del más reciente hourly
 */
async function promoteToWeekly() {
  try {
    const backups = await listBackups();
    const latestHourly = backups.find(b => b.type === 'HOURLY' && !b.error);

    if (!latestHourly) {
      console.warn('No hay backup horario disponible para promover');
      return null;
    }

    const content = await fs.readFile(latestHourly.filepath, 'utf8');
    const backup = JSON.parse(content);
    backup.type = 'WEEKLY';
    backup.promotedFrom = latestHourly.filename;

    const filename = `backup-weekly-${Date.now()}.json`;
    const filepath = path.join(BACKUP_DIR, filename);

    await fs.writeFile(filepath, JSON.stringify(backup, null, 2));

    console.log(`✅ Backup semanal creado: ${filename}`);
    return { filename, filepath };
  } catch (error) {
    console.error('Error creando backup semanal:', error);
    return null;
  }
}

module.exports = {
  createFullBackup,
  listBackups,
  restoreFromBackup,
  cleanOldBackups,
  verifyDataIntegrity,
  promoteToWeekly,
  BACKUP_DIR
};
