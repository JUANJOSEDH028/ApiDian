# Solución Final: n8n Docker → API DIAN Host

## Problema identificado

El diagnóstico muestra que:
- ✅ La API responde en el host
- ✅ n8n está corriendo
- ✅ Variables configuradas correctamente
- ❌ **PERO Docker no puede conectar al puerto 3456 del host**

El gateway de Docker es `172.22.0.1` (red personalizada).

## Solución 1: Usar gateway de Docker (RECOMENDADA)

### Paso 1: Actualizar docker-compose.yml

Ya está actualizado para usar `172.22.0.1:3456`. Si necesitas cambiarlo manualmente:

```yaml
environment:
  DIAN_API_URL: http://172.22.0.1:3456
```

### Paso 2: Verificar firewall

```bash
# Ver estado del firewall
sudo ufw status

# Si está activo, permite el puerto 3456
sudo ufw allow 3456/tcp
sudo ufw reload

# Verificar que el puerto está abierto
sudo ufw status | grep 3456
```

### Paso 3: Reiniciar n8n

```bash
docker-compose restart n8n
```

### Paso 4: Probar conectividad

```bash
# Desde dentro del contenedor n8n
docker exec n8n wget -O- http://172.22.0.1:3456/search \
  --post-data='{"cufe":"test"}' \
  --header='Content-Type: application/json'
```

Si esto funciona, el flujo en n8n debería funcionar.

---

## Solución 2: Usar network_mode: host (MÁS SIMPLE)

Si la Solución 1 no funciona, usa `network_mode: host`. Esto hace que el contenedor comparta la red del host.

### Modificar docker-compose.yml

```yaml
  n8n:
    network_mode: host
    # COMENTA o ELIMINA estas líneas:
    # ports:
    #   - "127.0.0.1:5678:5678"
    # extra_hosts:
    #   - "host.docker.internal:host-gateway"
    environment:
      DIAN_API_URL: http://127.0.0.1:3456
      # ... resto de variables igual ...
```

### Reiniciar

```bash
docker-compose down n8n
docker-compose up -d n8n
```

**Nota:** Con `network_mode: host`, n8n estará accesible directamente en el puerto 5678 del servidor (no solo en localhost). Ajusta tu proxy/nginx si es necesario.

---

## Solución 3: Exponer puerto 3456 en docker-compose

Agrega el puerto 3456 al servicio n8n para que pueda acceder:

```yaml
  n8n:
    ports:
      - "127.0.0.1:5678:5678"
      - "127.0.0.1:3456:3456"  # ⬅️ AGREGAR ESTO
```

Y usa `127.0.0.1:3456` en lugar del gateway.

---

## Verificación final

Después de aplicar cualquier solución:

1. **Verifica que la API está corriendo:**
   ```bash
   curl http://127.0.0.1:3456/search -X POST \
     -H "Content-Type: application/json" \
     -d '{"cufe":"test"}'
   ```

2. **Verifica conectividad desde n8n:**
   ```bash
   docker exec n8n wget -O- http://172.22.0.1:3456/search \
     --post-data='{"cufe":"test"}' \
     --header='Content-Type: application/json'
   ```

3. **Ejecuta el flujo en n8n** y verifica que funciona.

---

## Mantener la API corriendo

Para que la API siga activa después de cerrar SSH:

```bash
# Opción 1: nohup
nohup node server-dian-api.js > api.log 2>&1 &

# Opción 2: PM2 (recomendado)
pm2 start server-dian-api.js --name dian-api
pm2 save
pm2 startup
```

---

## Resumen de URLs según solución

| Solución | URL en DIAN_API_URL |
|----------|---------------------|
| Gateway Docker | `http://172.22.0.1:3456` |
| IP del servidor | `http://10.0.0.63:3456` |
| network_mode: host | `http://127.0.0.1:3456` |
| host.docker.internal | `http://host.docker.internal:3456` |
