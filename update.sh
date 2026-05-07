#!/bin/bash

# Update script for Marmoles
echo "================================================="
echo "   ACTUALIZACIÓN MARMOLES - Sistema Docker"
echo "================================================="
echo ""

# Pull latest changes
echo "📥 Descargando cambios del repositorio..."
git pull origin master

echo "⚙️  Reconstruyendo servicios con Docker..."
docker compose up -d --build --remove-orphans

# Prune unused images to save space
echo "🧹 Limpiando imágenes antiguas de Docker..."
docker image prune -f

echo ""
echo "================================================="
echo "✅ Actualización completada exitosamente"
echo "================================================="
echo ""
echo "Estado de servicios:"
docker compose ps
echo ""
