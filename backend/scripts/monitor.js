const { createBackup, healthCheck } = require('./auto-backup');
const fs = require('fs');
const path = require('path');

// Configuración de monitoreo
const MONITOR_INTERVAL = 60 * 60 * 1000; // 1 hora
const BACKUP_INTERVAL = 24 * 60 * 60 * 1000; // 24 horas

let lastBackup = 0;
let isMonitoring = false;

const startMonitoring = () => {
  if (isMonitoring) {
    console.log('⚠️  El monitoreo ya está activo');
    return;
  }
  
  isMonitoring = true;
  console.log('🔍 Iniciando monitoreo continuo de la base de datos...');
  
  const monitorInterval = setInterval(async () => {
    try {
      console.log('🔍 Verificando salud de la base de datos...');
      
      const isHealthy = await healthCheck();
      
      if (!isHealthy) {
        console.error('❌ Base de datos no saludable - creando respaldo de emergencia');
        await createBackup();
      }
      
      // Crear respaldo programado
      const now = Date.now();
      if (now - lastBackup > BACKUP_INTERVAL) {
        console.log('⏰ Creando respaldo programado...');
        await createBackup();
        lastBackup = now;
      }
      
      console.log('✅ Verificación completada');
      
    } catch (error) {
      console.error('❌ Error en monitoreo:', error);
    }
  }, MONITOR_INTERVAL);
  
  // Manejar cierre del proceso
  process.on('SIGINT', () => {
    console.log('\n🛑 Deteniendo monitoreo...');
    clearInterval(monitorInterval);
    isMonitoring = false;
    process.exit(0);
  });
  
  process.on('SIGTERM', () => {
    console.log('\n🛑 Deteniendo monitoreo...');
    clearInterval(monitorInterval);
    isMonitoring = false;
    process.exit(0);
  });
};

const stopMonitoring = () => {
  if (!isMonitoring) {
    console.log('⚠️  El monitoreo no está activo');
    return;
  }
  
  isMonitoring = false;
  console.log('🛑 Monitoreo detenido');
  process.exit(0);
};

// Comandos de línea
if (require.main === module) {
  const command = process.argv[2];
  
  switch (command) {
    case 'start':
      startMonitoring();
      break;
    case 'stop':
      stopMonitoring();
      break;
    case 'status':
      console.log(`Estado del monitoreo: ${isMonitoring ? 'ACTIVO' : 'INACTIVO'}`);
      break;
    default:
      console.log('Uso: node monitor.js [start|stop|status]');
      break;
  }
}

module.exports = { startMonitoring, stopMonitoring };

