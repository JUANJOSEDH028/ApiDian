# Instrucciones: API DIAN en Docker

## ✅ Solución Simple: API DIAN en Docker

La API DIAN ahora corre en Docker, en la misma red que n8n. **Comunicación directa por nombre de servicio**, sin problemas de red.

## Pasos para desplegar

### 1. Copiar archivos al servidor

Asegúrate de tener estos archivos en el servidor:
- `Dockerfile`
- `package.json`
- `server-dian-api.js`
- `dian-search-by-cufe.js`
- `dian-search-by-cufe-visible.js`
- `extraer-turnstile-token.js`
- `.dockerignore`
- `docker-compose.yml` (actualizado)

### 2. Detener servicios actuales

```bash
cd /ruta/donde/esta/tu/docker-compose.yml
docker-compose down
```

### 3. Construir y levantar todo

```bash
# Construir la imagen de la API DIAN y levantar todos los servicios
docker-compose up -d --build
```

Esto hará:
- ✅ Construir la imagen de `dian-api`
- ✅ Levantar `dian-api`, `n8n`, `postgres_n8n`, `redis_n8n`
- ✅ Conectarlos todos en la misma red Docker

### 4. Verificar que todo está corriendo

```bash
# Ver todos los contenedores
docker-compose ps

# Ver logs de la API DIAN
docker-compose logs -f dian-api

# Ver logs de n8n
docker-compose logs -f n8n
```

Deberías ver en los logs de `dian-api`:
```
DIAN API: http://0.0.0.0:3456  →  POST /search con { "cufe": "..." }
```

### 5. Probar conectividad desde n8n

```bash
# Probar desde n8n a dian-api (mismo Docker, misma red)
docker exec n8n wget -O- http://dian-api:3456/search \
  --post-data='{"cufe":"test"}' \
  --header='Content-Type: application/json'
```

Si ves una respuesta JSON, **¡funciona!** 🎉

### 6. Probar el flujo en n8n

1. Importa `n8n_DIAN_con_Turnstile.json` en n8n
2. Ejecuta el flujo con un CUFE válido
3. Debería funcionar automáticamente usando `http://dian-api:3456`

## Ventajas de esta solución

✅ **Simple**: Todo en Docker, misma red  
✅ **Confiable**: Comunicación por nombre de servicio (DNS interno de Docker)  
✅ **Sin problemas de firewall**: Todo dentro de Docker  
✅ **Fácil de mantener**: Un solo `docker-compose up` levanta todo  
✅ **Escalable**: Puedes agregar más servicios fácilmente  

## Comandos útiles

```bash
# Ver logs de la API DIAN
docker-compose logs -f dian-api

# Reiniciar solo la API DIAN
docker-compose restart dian-api

# Reconstruir la API DIAN después de cambios
docker-compose up -d --build dian-api

# Ver estado de todos los servicios
docker-compose ps

# Detener todo
docker-compose down

# Levantar todo
docker-compose up -d
```

## Acceso externo a la API

La API está expuesta en `127.0.0.1:3456` del servidor, así que puedes acceder desde fuera del Docker:

```bash
# Desde el servidor
curl http://127.0.0.1:3456/search -X POST \
  -H "Content-Type: application/json" \
  -d '{"cufe":"TU_CUFE"}'

# Desde otro servidor (si abres el firewall)
curl http://10.0.0.63:3456/search -X POST \
  -H "Content-Type: application/json" \
  -d '{"cufe":"TU_CUFE"}'
```

## Modo visible (si headless falla)

Si la DIAN detecta automatización, puedes cambiar a modo visible editando `docker-compose.yml`:

```yaml
  dian-api:
    environment:
      DIAN_MODE: visible  # Cambiar de 'headless' a 'visible'
```

Luego reinicia:
```bash
docker-compose restart dian-api
```

## Troubleshooting

### La API no inicia

```bash
# Ver logs detallados
docker-compose logs dian-api

# Verificar que Playwright está instalado
docker exec dian-api ls /usr/bin/chromium-browser
```

### n8n no puede conectar a dian-api

```bash
# Verificar que están en la misma red
docker network inspect <nombre_red> | grep -A 10 "Containers"

# Probar conectividad
docker exec n8n ping dian-api
```

### Reconstruir desde cero

```bash
docker-compose down
docker-compose build --no-cache dian-api
docker-compose up -d
```
