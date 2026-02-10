# Instrucciones para actualizar docker-compose de n8n

## Cambios realizados

Se agregaron dos líneas al servicio `n8n`:

1. **`extra_hosts`**: Permite que el contenedor acceda al host usando `host.docker.internal`
2. **`DIAN_API_URL`**: Variable de entorno que apunta a la API DIAN en el host

## Pasos para aplicar

### 1. Hacer backup del docker-compose actual

```bash
cd /ruta/donde/esta/tu/docker-compose.yml
cp docker-compose.yml docker-compose.yml.backup
```

### 2. Reemplazar el archivo

Copia el contenido del archivo `docker-compose.yml` que está en este repositorio y reemplaza tu archivo actual.

**O** simplemente agrega estas líneas manualmente:

```yaml
  n8n:
    # ... líneas existentes ...
    extra_hosts:
      - "host.docker.internal:host-gateway"
    environment:
      DIAN_API_URL: http://host.docker.internal:3456
      # ... resto de tus variables ...
```

### 3. Reiniciar n8n

```bash
docker-compose down n8n
docker-compose up -d n8n
```

### 4. Verificar que funciona

```bash
# Ver logs de n8n
docker-compose logs -f n8n

# Probar conectividad desde dentro del contenedor
docker exec -it n8n sh
wget -O- http://host.docker.internal:3456/search \
  --post-data='{"cufe":"test"}' \
  --header='Content-Type: application/json'
```

Si ves una respuesta JSON (aunque sea un error), la conectividad funciona.

### 5. Probar el flujo en n8n

1. Importa el flujo `n8n_DIAN_con_Turnstile.json` en n8n
2. Ejecuta el flujo con un CUFE válido
3. Debería funcionar automáticamente usando `DIAN_API_URL`

## Solución de problemas

### Si `host.docker.internal` no funciona

Cambia la variable `DIAN_API_URL` en el docker-compose:

```yaml
environment:
  DIAN_API_URL: http://10.0.0.63:3456  # IP del servidor
```

Luego reinicia:
```bash
docker-compose down n8n
docker-compose up -d n8n
```

### Si la API no responde

Verifica que la API esté corriendo en el servidor:

```bash
# En el servidor (fuera de Docker)
curl http://127.0.0.1:3456/search \
  -H "Content-Type: application/json" \
  -d '{"cufe":"test"}'
```

Si funciona aquí pero no desde Docker, el problema es de red entre contenedores.

### Verificar que la variable está disponible en n8n

En n8n, crea un flujo de prueba con un nodo Code:

```javascript
return [{ json: { dian_api_url: process.env.DIAN_API_URL } }];
```

Debería mostrar: `http://host.docker.internal:3456`

## Notas importantes

- **No afecta otros servicios**: Solo agrega configuración, no modifica nada existente
- **Compatible con tu configuración actual**: Todos tus volúmenes, passwords y configuraciones se mantienen igual
- **Reversible**: Si algo falla, puedes restaurar el backup
