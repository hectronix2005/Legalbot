#!/bin/bash

# Script de deploy automatizado para Heroku
# Uso: ./scripts/deploy.sh [mensaje de commit]

set -e  # Salir si hay algún error

echo "🚀 Iniciando proceso de deploy a Heroku..."
echo ""

# Colores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Verificar que estamos en la raíz del proyecto
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Error: Debes ejecutar este script desde la raíz del proyecto${NC}"
    exit 1
fi

# Verificar que Heroku CLI está instalado
if ! command -v heroku &> /dev/null; then
    echo -e "${RED}❌ Error: Heroku CLI no está instalado${NC}"
    echo "   Instala desde: https://devcenter.heroku.com/articles/heroku-cli"
    exit 1
fi

# Verificar que estamos logueados en Heroku
if ! heroku auth:whoami &> /dev/null; then
    echo -e "${YELLOW}⚠️  No estás logueado en Heroku${NC}"
    echo "   Ejecutando: heroku login"
    heroku login
fi

# Paso 1: Build del frontend
echo -e "${GREEN}📦 Paso 1: Construyendo frontend...${NC}"
cd frontend
npm run build
cd ..

# Paso 2: Copiar build al backend
echo -e "${GREEN}📦 Paso 2: Copiando build al backend...${NC}"
npm run copy-build

# Paso 3: Verificar que el build existe
if [ ! -d "backend/public" ]; then
    echo -e "${RED}❌ Error: No se encontró el build en backend/public${NC}"
    exit 1
fi

# Paso 4: Verificar cambios en Git
echo -e "${GREEN}📝 Paso 3: Verificando cambios en Git...${NC}"
if [ -z "$(git status --porcelain)" ]; then
    echo -e "${YELLOW}⚠️  No hay cambios para commitear${NC}"
else
    # Mensaje de commit
    COMMIT_MSG=${1:-"Deploy to Heroku - $(date +'%Y-%m-%d %H:%M:%S')"}
    
    echo -e "${GREEN}📝 Agregando cambios...${NC}"
    git add .
    
    echo -e "${GREEN}💾 Creando commit: ${COMMIT_MSG}${NC}"
    git commit -m "$COMMIT_MSG" || echo "No hay cambios nuevos para commitear"
fi

# Paso 5: Deploy a Heroku
echo -e "${GREEN}🚀 Paso 4: Desplegando a Heroku...${NC}"
git push heroku main || git push heroku master

# Paso 6: Verificar deploy
echo -e "${GREEN}✅ Paso 5: Verificando deploy...${NC}"
sleep 3
heroku logs --tail --num 50

echo ""
echo -e "${GREEN}🎉 ¡Deploy completado!${NC}"
echo ""
echo "Para ver la aplicación:"
echo "  heroku open"
echo ""
echo "Para ver logs en tiempo real:"
echo "  heroku logs --tail"
echo ""

