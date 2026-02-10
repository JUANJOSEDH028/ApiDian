# Diagnóstico: n8n Docker → API Host

## Paso 1: Verificar que docker-compose se actualizó

```bash
# Ver el contenido del docker-compose actual
cat docker-compose.yml | grep -A 5 "extra_hosts"
cat docker-compose.yml | grep "DIAN_API_URL"
```

Deberías ver:
- `extra_hosts:` con `host.docker.internal:host-gateway`
- `DIAN_API_URL: http://host.docker.internal:3456`

## Paso 2: Verificar que n8n se reinició con los cambios

```bash
# Ver si n8n tiene la variable de entorno
docker exec n8n env | grep DIAN_API_URL

# Ver si puede resolver host.docker.internal
docker exec n8n ping -c 2 host.docker.internal
```

## Paso 3: Probar conectividad desde dentro del contenedor n8n

```bash
# Entrar al contenedor
docker exec -it n8n sh

# Dentro del contenedor, probar diferentes URLs:
# Opción 1: host.docker.internal
wget -O- http://host.docker.internal:3456/search \
  --post-data='{"cufe":"test"}' \
  --header='Content-Type: application/json'

# Opción 2: IP del servidor
wget -O- http://10.0.0.63:3456/search \
  --post-data='{"cufe":"test"}' \
  --header='Content-Type: application/json'

# Opción 3: Gateway de Docker
wget -O- http://172.17.0.1:3456/search \
  --post-data='{"cufe":"test"}' \
  --header='Content-Type: application/json'

# Opción 4: Obtener IP del gateway
ip route | grep default
# Usa esa IP en lugar de 172.17.0.1
```

## Paso 4: Verificar logs de n8n cuando ejecutas el flujo

```bash
# Ver logs en tiempo real
docker logs -f n8n

# Luego ejecuta el flujo desde n8n y observa los errores
```

## Paso 5: Verificar que la API está escuchando en todas las interfaces

En el servidor (fuera de Docker):

```bash
# Verificar que está escuchando en 0.0.0.0
netstat -tuln | grep 3456
# o
ss -tuln | grep 3456

# Debería mostrar: 0.0.0.0:3456
```

## Paso 6: Probar desde el servidor directamente

```bash
# Esto debería funcionar siempre
curl http://127.0.0.1:3456/search \
  -H "Content-Type: application/json" \
  -d '{"cufe":"test"}'
```

## Soluciones según el resultado

### Si `host.docker.internal` no resuelve:

**Solución A:** Usar IP del servidor directamente

Edita `docker-compose.yml`:
```yaml
environment:
  DIAN_API_URL: http://10.0.0.63:3456
```

**Solución B:** Usar network_mode: host (cambia toda la configuración de red)

```yaml
  n8n:
    network_mode: host
    # Quita la línea "ports:" porque con host mode no es necesaria
```

### Si la IP del servidor no funciona:

Verifica firewall:
```bash
sudo ufw status
sudo ufw allow 3456/tcp
```

### Si nada funciona:

Usa `network_mode: host` temporalmente para probar:

```yaml
  n8n:
    network_mode: host
    # Comenta o quita: ports, extra_hosts
    environment:
      DIAN_API_URL: http://127.0.0.1:3456
      # ... resto de variables ...
```
