#!/bin/bash
# Script de diagnóstico para conectar n8n (Docker) con API DIAN (Host)

echo "=========================================="
echo "Diagnóstico: n8n Docker → API DIAN Host"
echo "=========================================="
echo ""

# 1. Verificar que la API está corriendo en el host
echo "1. Verificando API en el host..."
if curl -s http://127.0.0.1:3456/search -X POST \
   -H "Content-Type: application/json" \
   -d '{"cufe":"test"}' > /dev/null 2>&1; then
    echo "   ✅ API responde en el host (127.0.0.1:3456)"
else
    echo "   ❌ API NO responde en el host"
    echo "   → Inicia la API: node server-dian-api.js"
    exit 1
fi
echo ""

# 2. Verificar que n8n está corriendo
echo "2. Verificando contenedor n8n..."
if docker ps | grep -q "n8n"; then
    echo "   ✅ Contenedor n8n está corriendo"
else
    echo "   ❌ Contenedor n8n NO está corriendo"
    exit 1
fi
echo ""

# 3. Verificar variable DIAN_API_URL en n8n
echo "3. Verificando variable DIAN_API_URL en n8n..."
DIAN_URL=$(docker exec n8n env | grep DIAN_API_URL | cut -d'=' -f2)
if [ -z "$DIAN_URL" ]; then
    echo "   ⚠️  Variable DIAN_API_URL NO está configurada"
    echo "   → Agrega DIAN_API_URL en docker-compose.yml"
else
    echo "   ✅ DIAN_API_URL = $DIAN_URL"
fi
echo ""

# 4. Verificar extra_hosts
echo "4. Verificando extra_hosts en docker-compose..."
if docker inspect n8n | grep -q "host.docker.internal"; then
    echo "   ✅ extra_hosts configurado"
else
    echo "   ⚠️  extra_hosts NO configurado"
    echo "   → Agrega extra_hosts en docker-compose.yml"
fi
echo ""

# 5. Probar resolución de host.docker.internal
echo "5. Probando resolución de host.docker.internal..."
if docker exec n8n ping -c 1 host.docker.internal > /dev/null 2>&1; then
    echo "   ✅ host.docker.internal se resuelve"
else
    echo "   ❌ host.docker.internal NO se resuelve"
    echo "   → Usa IP del servidor (10.0.0.63:3456) en su lugar"
fi
echo ""

# 6. Probar conectividad desde n8n a la API
echo "6. Probando conectividad desde n8n a la API..."
echo "   Probando host.docker.internal:3456..."
if docker exec n8n wget -q -O- --timeout=5 \
   http://host.docker.internal:3456/search \
   --post-data='{"cufe":"test"}' \
   --header='Content-Type: application/json' > /dev/null 2>&1; then
    echo "   ✅ Conectividad OK con host.docker.internal"
    EXIT_CODE=0
else
    echo "   ❌ NO conecta con host.docker.internal"
    echo ""
    echo "   Probando IP del servidor (10.0.0.63:3456)..."
    if docker exec n8n wget -q -O- --timeout=5 \
       http://10.0.0.63:3456/search \
       --post-data='{"cufe":"test"}' \
       --header='Content-Type: application/json' > /dev/null 2>&1; then
        echo "   ✅ Conectividad OK con IP del servidor"
        echo "   → Usa: DIAN_API_URL=http://10.0.0.63:3456"
        EXIT_CODE=0
    else
        echo "   ❌ NO conecta con IP del servidor"
        echo ""
        echo "   Probando gateway Docker (172.17.0.1:3456)..."
        if docker exec n8n wget -q -O- --timeout=5 \
           http://172.17.0.1:3456/search \
           --post-data='{"cufe":"test"}' \
           --header='Content-Type: application/json' > /dev/null 2>&1; then
            echo "   ✅ Conectividad OK con gateway Docker"
            echo "   → Usa: DIAN_API_URL=http://172.17.0.1:3456"
            EXIT_CODE=0
        else
            echo "   ❌ NO conecta con ninguna opción"
            EXIT_CODE=1
        fi
    fi
fi
echo ""

# 7. Obtener IP del gateway de Docker
echo "7. IP del gateway de Docker:"
GATEWAY_IP=$(docker exec n8n ip route | grep default | awk '{print $3}')
echo "   Gateway: $GATEWAY_IP"
echo "   → Prueba también: DIAN_API_URL=http://$GATEWAY_IP:3456"
echo ""

# Resumen
echo "=========================================="
if [ $EXIT_CODE -eq 0 ]; then
    echo "✅ Diagnóstico completado - Conectividad OK"
else
    echo "❌ Diagnóstico completado - Problemas encontrados"
    echo ""
    echo "SOLUCIONES RECOMENDADAS:"
    echo "1. Verifica que la API esté corriendo: node server-dian-api.js"
    echo "2. Verifica firewall: sudo ufw allow 3456/tcp"
    echo "3. Usa network_mode: host en docker-compose (último recurso)"
fi
echo "=========================================="

exit $EXIT_CODE
