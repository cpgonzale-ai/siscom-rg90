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

# 2. Verificar la integridad de la librería xlsx versionada en el repo (ver package.json):
# el hash debe coincidir con el que fijó el package-lock.json. Si no coincide, el deploy se
# corta acá, antes de compilar ni tocar producción.
XLSX_TGZ="vendor/xlsx-0.20.3.tgz"
XLSX_SHA512_ESPERADO="oLDq3jw7AcLqKWH2AhCpVTZl8mf6X2YReP+Neh0SJUzV/BdZYjth94tG5toiMB1PPrYtxOCfaoUCkvtuH+3AJA=="
XLSX_SHA512_REAL="$(openssl dgst -sha512 -binary "$XLSX_TGZ" | base64 -w0)"
if [ "$XLSX_SHA512_REAL" != "$XLSX_SHA512_ESPERADO" ]; then
  echo "ERROR: $XLSX_TGZ no coincide con el hash esperado. Deploy cancelado."
  exit 1
fi
echo "   Integridad de xlsx verificada."

# 3. Compilar la aplicación
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
