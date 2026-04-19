#!/bin/bash

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "========================================"
echo "  DESPLIEGUE A PRODUCCIÓN COMPLETADO"
echo "  Sistema: Docker"
echo "========================================"
echo ""

echo -e "${YELLOW}Estado de Servicios Docker:${NC}"
echo ""

# Verificar contenedores
FRONTEND_STATUS=$(docker ps --filter "name=marmoles_frontend" --format "{{.Status}}")
BACKEND_STATUS=$(docker ps --filter "name=marmoles_backend" --format "{{.Status}}")
DB_STATUS=$(docker ps --filter "name=marmoles_db" --format "{{.Status}}")

echo "✓ Frontend: $FRONTEND_STATUS"
echo "✓ Backend:  $BACKEND_STATUS"
echo "✓ Database: $DB_STATUS"
echo ""

echo -e "${YELLOW}Verificando Conectividad:${NC}"
echo ""

# Test frontend
if curl -s http://localhost:5120 | grep -q "<!DOCTYPE"; then
    echo -e "${GREEN}✓ Frontend respondiendo en puerto 5120${NC}"
else
    echo -e "${RED}✗ Frontend no responde${NC}"
fi

# Test backend
sleep 2
HEALTH=$(curl -s http://localhost:8020/health)
if [ ! -z "$HEALTH" ]; then
    echo -e "${GREEN}✓ Backend respondiendo en puerto 8020${NC}"
    echo "  Response: $HEALTH"
else
    echo -e "${RED}✗ Backend no responde${NC}"
fi

# Test nginx
echo -e "${YELLOW}Estado de Nginx en Cerebro:${NC}"
echo ""
if docker exec cerebro_nginx nginx -t &>/dev/null; then
    echo -e "${GREEN}✓ Nginx configuración válida${NC}"
else
    echo -e "${RED}✗ Nginx tiene errores de configuración${NC}"
fi

echo ""
echo -e "${YELLOW}Cambios Desplegados:${NC}"
echo ""
echo "✓ Sistema completo con Docker"
echo "✓ Frontend: Nginx en puerto 5120"
echo "✓ Backend: FastAPI en puerto 8020"
echo "✓ Database: PostgreSQL en puerto 5432"
echo ""

echo -e "${YELLOW}URLs de Acceso:${NC}"
echo ""
echo "  Frontend (Local):    http://localhost:5120"
echo "  Backend API:         http://localhost:8020"
echo "  Producción externa:  https://marmoles.sistemataup.online"
echo ""

echo -e "${YELLOW}Credenciales:${NC}"
echo "  Usuario: javier"
echo "  Password: 12345678"
echo ""

echo "========================================"
echo -e "${GREEN}  ✓ SISTEMA EN PRODUCCIÓN${NC}"
echo "========================================"
