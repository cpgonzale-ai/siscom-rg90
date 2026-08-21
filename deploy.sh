#!/bin/bash

# Salir inmediatamente si algún comando falla
set -e

PROJECT_DIR="/home/cpgonzalez/Documents/CSM_PWCLC/siscom-rg90"
PROD_DIR="/var/www/siscom"

echo "=========================================="
echo "   Iniciando despliegue de SISCOM Front   "
echo "=========================================="

# 1. Navegar al directorio del proyecto
cd "$PROJECT_DIR"

# 2. Compilar la aplicación
echo "1. Compilando la aplicación con npm run build..."
npm run build

# 3. Limpiar directorio de producción
echo "2. Limpiando el directorio de producción ($PROD_DIR)..."
rm -rf "$PROD_DIR"/*

# 4. Copiar archivos compilados a producción
echo "3. Copiando archivos a producción..."
cp -r "$PROJECT_DIR/dist"/* "$PROD_DIR"/

# 5. Ajustar permisos para Nginx (www-data)
echo "4. Ajustando permisos de propiedad (www-data)..."
chown -R www-data:www-data "$PROD_DIR"
chmod -R 755 "$PROD_DIR"

echo "=========================================="
echo "   ¡Despliegue completado con éxito!      "
echo "=========================================="
