const fs = require('fs');
const path = require('path');

// Rutas
const frontendBuildPath = path.join(__dirname, '../frontend/build');
const backendPublicPath = path.join(__dirname, '../backend/public');

console.log('📦 Copiando build del frontend al backend...');
console.log(`   Origen: ${frontendBuildPath}`);
console.log(`   Destino: ${backendPublicPath}`);

// Verificar que existe el build del frontend
if (!fs.existsSync(frontendBuildPath)) {
  console.error('❌ Error: No se encontró el build del frontend.');
  console.error(`   Ejecuta primero: cd frontend && npm run build`);
  process.exit(1);
}

// Eliminar el directorio público anterior si existe
if (fs.existsSync(backendPublicPath)) {
  console.log('🗑️  Eliminando build anterior...');
  fs.rmSync(backendPublicPath, { recursive: true, force: true });
}

// Crear directorio público
fs.mkdirSync(backendPublicPath, { recursive: true });

// Función para copiar directorios recursivamente
function copyRecursive(src, dest) {
  const entries = fs.readdirSync(src, { withFileTypes: true });
  
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    
    if (entry.isDirectory()) {
      fs.mkdirSync(destPath, { recursive: true });
      copyRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// Copiar archivos
try {
  copyRecursive(frontendBuildPath, backendPublicPath);
  console.log('✅ Build copiado exitosamente!');
  console.log(`   Archivos en: ${backendPublicPath}`);
} catch (error) {
  console.error('❌ Error copiando archivos:', error);
  process.exit(1);
}

